'use strict';
/* Flowlace Server HTTP API. JSON over HTTPS; live updates as Server-Sent Events.
   Every request except /api/health and /api/login needs "Authorization: Bearer <token>".

   GET  /api/health                         service name/version (used by "Test connection")
   POST /api/login {username,password}      → {token, user}
   POST /api/logout                         GET /api/me          POST /api/me/password {current,password}
   GET  /api/workspaces                     list            POST /api/workspaces {name}              (admin)
   GET  /api/w/:id/info                     name, counts, backup status
   GET  /api/w/:id/snapshot                 all records with versions
   GET  /api/w/:id/changes?since=N          records changed after N
   POST /api/w/:id/commit {opId, ops}       one transaction; conflicts → 409
   GET  /api/w/:id/events?since=N           live updates (text/event-stream)
   GET  /api/w/:id/me/state  PUT …          personal view settings of the signed-in user only
   GET  /api/w/:id/activity?limit=          who changed what and when
   PATCH /api/w/:id {name}                  rename                                                    (admin)
   PUT  /api/w/:id/backup-settings          {everyHours, keep}                                        (admin)
   GET  /api/w/:id/backups  POST /api/w/:id/backups (back up now)  POST /api/w/:id/backups/inspect {name}
   POST /api/w/:id/restore {name}           exclusive restore with a copy made first                 (admin)
   GET  /api/users  POST /api/users  PATCH /api/users/:id                                             (admin)
   GET  /api/admin-log                                                                                (admin) */
const { httpErr } = require('./accounts');
const VERSION = require('../package.json').version;

const loginFails = new Map();   // ip -> { n, until }

function makeHandler({ cfg, accounts, hub, log }) {
  const json = (res, status, body) => {
    const s = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(s) });
    res.end(s);
  };
  const readBody = (req, limitMB = cfg.maxBodyMB) => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limitMB * 1024 * 1024) { reject(httpErr(413, 'The request is too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!size) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (_) { reject(httpErr(400, 'The request is not valid JSON.')); } });
    req.on('error', reject);
  });
  const auth = req => {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
    const s = accounts.session(tok, cfg.sessionHours);
    if (!s) throw httpErr(401, 'Your session has expired. Sign in again.', { kind: 'auth' });
    return { user: s.user, token: tok };
  };
  const admin = u => { if (u.role !== 'admin') throw httpErr(403, 'Only administrators can do this.', { kind: 'forbidden' }); };
  const ip = req => (req.socket && req.socket.remoteAddress) || '?';

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const m = req.method;
    try {
      if (p === '/api/health' && m === 'GET') return json(res, 200, { ok: true, service: 'Flowlace Server', version: VERSION, serverName: cfg.serverName, https: !!cfg.tlsOptions, time: new Date().toISOString() });

      if (p === '/api/login' && m === 'POST') {
        const who = ip(req), f = loginFails.get(who);
        if (f && f.until > Date.now()) throw httpErr(429, `Too many failed sign-ins. Try again in ${Math.ceil((f.until - Date.now()) / 1000)} s.`);
        const b = await readBody(req, 1);
        const r = accounts.login(b.username, b.password, b.client || req.headers['user-agent'], cfg.sessionHours);
        if (!r) {
          const n = (f ? f.n : 0) + 1; loginFails.set(who, { n, until: n >= 5 ? Date.now() + Math.min(15 * 60e3, 30e3 * 2 ** (n - 5)) : 0 });
          log(`failed sign-in for "${String(b.username || '').slice(0, 64)}" from ${who}`);
          throw httpErr(401, 'The user name or password is not correct.', { kind: 'login' });
        }
        loginFails.delete(who);
        accounts.log(r.user, 'sign-in', who);
        return json(res, 200, r);
      }

      const { user, token } = auth(req);

      if (p === '/api/logout' && m === 'POST') { accounts.logout(token); return json(res, 200, { ok: true }); }
      if (p === '/api/me' && m === 'GET') return json(res, 200, { user });
      if (p === '/api/me/password' && m === 'POST') {
        const b = await readBody(req, 1);
        if (!accounts.verifyPassword(user.id, b.current)) throw httpErr(400, 'The current password is not correct.');
        accounts.updateUser(user.id, { password: b.password, mustChange: false });
        accounts.log(user, 'password changed', null);
        return json(res, 200, { ok: true });
      }

      if (p === '/api/workspaces' && m === 'GET') return json(res, 200, { workspaces: accounts.listWorkspaces().map(w => ({ id: w.id, name: w.name, createdAt: w.createdAt })) });
      if (p === '/api/workspaces' && m === 'POST') { admin(user); const b = await readBody(req, 1); const w = hub.createWorkspace(b.name, user); accounts.log(user, 'workspace created', w.id); return json(res, 201, { workspace: { id: w.id, name: w.store.meta('workspace_name') } }); }

      if (p === '/api/users' && m === 'GET') { admin(user); return json(res, 200, { users: accounts.listUsers() }); }
      if (p === '/api/users' && m === 'POST') { admin(user); const b = await readBody(req, 1); const u = accounts.createUser({ username: b.username, name: b.name, role: b.role, password: b.password, mustChange: !!b.mustChange }); accounts.log(user, 'user created', `${u.username} (${u.role})`); return json(res, 201, { user: u }); }
      let mm = p.match(/^\/api\/users\/([\w-]+)$/);
      if (mm && m === 'PATCH') {
        admin(user); const b = await readBody(req, 1);
        const u = accounts.updateUser(mm[1], { name: b.name, role: b.role, active: b.active, password: b.password, mustChange: b.password !== undefined ? b.mustChange !== false : undefined });
        if (b.password !== undefined) accounts.dropSessions(u.id);   // a reset password closes the user's open sessions
        if (b.active === false || b.password !== undefined) hub.dropUser(u.id);
        accounts.log(user, 'user updated', `${u.username}: ${Object.keys(b).filter(k => k !== 'password').join(', ')}${b.password !== undefined ? ' password reset' : ''}`);
        return json(res, 200, { user: u });
      }
      if (p === '/api/admin-log' && m === 'GET') { admin(user); return json(res, 200, { log: accounts.adminLog(parseInt(url.searchParams.get('limit'), 10) || 100) }); }

      mm = p.match(/^\/api\/w\/([\w-]+)(\/.*)?$/);
      if (mm) {
        const w = hub.get(mm[1]); const sub = mm[2] || '';
        if (sub === '' && m === 'PATCH') { admin(user); const b = await readBody(req, 1); const n = w.store.rename(b.name); accounts.renameWorkspace(w.id, n); accounts.log(user, 'workspace renamed', `${w.id}: ${n}`); hub.broadcast(w, 'info', { name: n }); return json(res, 200, { name: n }); }
        if (sub === '/info' && m === 'GET') {
          const info = w.store.info();
          info.backup.dir = user.role === 'admin' ? hub.backupDir(w) : undefined;
          info.backup.location = 'server';
          return json(res, 200, { info, user, maintenance: w.maintenance });
        }
        if (sub === '/snapshot' && m === 'GET') return json(res, 200, w.store.snapshot());
        if (sub === '/changes' && m === 'GET') return json(res, 200, w.store.changesSince(parseInt(url.searchParams.get('since'), 10) || 0));
        if (sub === '/commit' && m === 'POST') {
          const b = await readBody(req);
          const r = hub.commit(w, b, user);
          return json(res, r.ok ? 200 : r.kind === 'conflict' ? 409 : r.kind === 'forbidden' ? 403 : 422, r);
        }
        if (sub === '/events' && m === 'GET') return sse(req, res, w, user, parseInt(url.searchParams.get('since'), 10));
        if (sub === '/me/state' && m === 'GET') return json(res, 200, w.store.getUserState(user.id));
        if (sub === '/me/state' && m === 'PUT') { const b = await readBody(req, 10); return json(res, 200, w.store.setUserState(user.id, b.data)); }
        if (sub === '/activity' && m === 'GET') return json(res, 200, { activity: w.store.audit(parseInt(url.searchParams.get('limit'), 10) || 50, url.searchParams.get('coll'), url.searchParams.get('id')) });
        if (sub === '/backup-settings' && m === 'PUT') { admin(user); const b = await readBody(req, 1); w.store.setBackupSettings({ everyHours: b.everyHours, keep: b.keep }); accounts.log(user, 'backup settings', JSON.stringify(b)); return json(res, 200, { info: w.store.info() }); }
        if (sub === '/backups' && m === 'GET') { admin(user); return json(res, 200, { backups: hub.listBackups(w), dir: hub.backupDir(w) }); }
        if (sub === '/backups' && m === 'POST') { admin(user); const r = hub.backupNow(w, user); return json(res, r.ok ? 200 : 500, r.ok ? { ok: true, name: require('path').basename(r.file), at: r.at, size: r.size, removed: r.removed } : r); }
        if (sub === '/backups/inspect' && m === 'POST') { admin(user); const b = await readBody(req, 1); return json(res, 200, hub.inspectBackup(w, b.name)); }
        if (sub === '/restore' && m === 'POST') { admin(user); const b = await readBody(req, 1); return json(res, 200, hub.restore(w, b.name, user)); }
      }
      throw httpErr(404, 'Not found.');
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) log(`error ${m} ${p}: ${e.stack || e.message}`);
      if (!res.headersSent) json(res, status, { ok: false, kind: e.kind || (status === 401 ? 'auth' : status === 403 ? 'forbidden' : status === 503 ? 'unavailable' : 'error'), message: status >= 500 && !e.status ? 'The server could not complete the request. See the server log.' : e.message, code: e.code });
      else try { res.end(); } catch (_) { /* ignore */ }
    }
  };

  function sse(req, res, w, user, since) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const client = { res, user };
    res.write(`event: hello\ndata: ${JSON.stringify({ seq: w.store.seq(), epoch: w.store.epoch(), maintenance: w.maintenance })}\n\n`);
    // anything missed since the client's last known change is sent first
    if (Number.isInteger(since) && since >= 0 && since < w.store.seq()) {
      const ch = w.store.changesSince(since);
      res.write(`event: catchup\ndata: ${JSON.stringify(ch)}\n\n`);
    }
    const off = hub.subscribe(w, client);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) { /* ignore */ } }, 20e3);
    const done = () => { clearInterval(ping); off(); };
    req.on('close', done); res.on('error', done);
  }
}

module.exports = { makeHandler };
