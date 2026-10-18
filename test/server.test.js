'use strict';
/* Flowlace Server over HTTP(S): sign-in, roles checked on the server, validation, idempotent retries,
   conflicts (409, never "last save wins"), live updates, catch-up after a restart, audit, backups and restore,
   HTTPS certificate validation and the configuration rules (local data disk, no plain HTTP by default). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn, execFileSync } = require('child_process');
const { RemoteBackend } = require('../src/main/remote-backend');
const { loadConfig } = require('../server/src/config');

const CLI = path.join(__dirname, '..', 'server', 'src', 'index.js');
const PW = 'correct-horse-battery';
let portN = 19300 + Math.floor(Math.random() * 400);
let n = 0; const opId = () => 'op' + Date.now().toString(36) + (n++) + 'testabcd';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000, what = 'condition') { const t = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('timeout: ' + what); await sleep(60); } }

function init(extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-srv-'));
  const port = portN++;
  const cfg = path.join(dir, 'flowlace-server.json');
  execFileSync(process.execPath, [CLI, 'init', '--config', cfg, '--data', path.join(dir, 'data'), '--port', String(port), '--admin', 'admin', '--workspace', 'Alphazeta', ...extra],
    { env: { ...process.env, FLOWLACE_PASSWORD: PW }, stdio: 'pipe' });
  return { dir, cfg, port };
}
function serve(s) {
  const p = spawn(process.execPath, [CLI, 'serve', '--config', s.cfg], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.out = ''; p.stdout.on('data', d => { p.out += d; }); p.stderr.on('data', d => { p.out += d; });
  s.proc = p;
  return until(() => /listening on/.test(p.out), 10000, 'server start: ' + p.out).then(() => p);
}
const stop = s => new Promise(r => { if (!s.proc || s.proc.exitCode !== null) return r(); s.proc.once('exit', r); s.proc.kill('SIGTERM'); });

async function api(base, method, p, body, token) {
  const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

let S, base, adminTok, memberTok, wsId;

test.before(async () => {
  S = init(['--allow-http']);
  await serve(S);
  base = `http://127.0.0.1:${S.port}`;
});
test.after(async () => { await stop(S); });

test('health and sign-in (wrong password refused, token issued)', async () => {
  const h = await api(base, 'GET', '/api/health');
  assert.strictEqual(h.body.service, 'Flowlace Server');
  const bad = await api(base, 'POST', '/api/login', { username: 'admin', password: 'nope' });
  assert.strictEqual(bad.status, 401);
  const ok = await api(base, 'POST', '/api/login', { username: 'admin', password: PW });
  assert.strictEqual(ok.status, 200); assert.ok(ok.body.token); assert.strictEqual(ok.body.user.role, 'admin');
  adminTok = ok.body.token;
  const ws = await api(base, 'GET', '/api/workspaces', undefined, adminTok);
  wsId = ws.body.workspaces[0].id;
  assert.strictEqual(ws.body.workspaces[0].name, 'Alphazeta');
  const noTok = await api(base, 'GET', `/api/w/${wsId}/snapshot`);
  assert.strictEqual(noTok.status, 401);
});

test('administrator creates a member; roles are enforced by the server', async () => {
  const u = await api(base, 'POST', '/api/users', { username: 'laura', name: 'Laura Chen', role: 'member', password: 'laura-password-1' }, adminTok);
  assert.strictEqual(u.status, 201);
  memberTok = (await api(base, 'POST', '/api/login', { username: 'laura', password: 'laura-password-1' })).body.token;
  // member: no user management, no restore, no backups list
  assert.strictEqual((await api(base, 'POST', '/api/users', { username: 'x', name: 'X', password: 'xxxxxxxxxxxx' }, memberTok)).status, 403);
  assert.strictEqual((await api(base, 'POST', `/api/w/${wsId}/restore`, { name: 'whatever.db' }, memberTok)).status, 403);
  assert.strictEqual((await api(base, 'GET', `/api/w/${wsId}/backups`, undefined, memberTok)).status, 403);
  // member: company configuration (phases) refused, project data allowed
  const ph = await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'put', coll: 'phases', id: 'ph-x', base: 0, data: { id: 'ph-x', name: 'Hack' } }] }, memberTok);
  assert.strictEqual(ph.status, 403); assert.strictEqual(ph.body.kind, 'forbidden');
  const pj = await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [
    { type: 'put', coll: 'projects', id: 'px-1', base: 0, data: { id: 'px-1', name: 'Joondalup Health', code: 'AZ-1' } },
    { type: 'put', coll: 'tasks', id: 'tk-1', base: 0, data: { id: 'tk-1', projectId: 'px-1', name: 'Lighting layout' } }] }, memberTok);
  assert.strictEqual(pj.status, 200, JSON.stringify(pj.body));
});

test('validation: malformed operations and orphans are rejected in one transaction', async () => {
  const noName = await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'put', coll: 'tasks', id: 'tk-bad', base: 0, data: { id: 'tk-bad', projectId: 'px-1' } }] }, adminTok);
  assert.strictEqual(noName.status, 422);
  const unknown = await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'put', coll: 'secrets', id: 'a', base: 0, data: { id: 'a' } }] }, adminTok);
  assert.strictEqual(unknown.status, 422);
  // one good + one orphan task → nothing is applied
  const mixed = await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [
    { type: 'put', coll: 'tasks', id: 'tk-ok', base: 0, data: { id: 'tk-ok', projectId: 'px-1', name: 'Fine' } },
    { type: 'put', coll: 'tasks', id: 'tk-orphan', base: 0, data: { id: 'tk-orphan', projectId: 'px-gone', name: 'Orphan' } }] }, adminTok);
  assert.strictEqual(mixed.status, 422); assert.strictEqual(mixed.body.kind, 'missing-parent');
  const snap = (await api(base, 'GET', `/api/w/${wsId}/snapshot`, undefined, adminTok)).body;
  assert.ok(!snap.records.some(r => r.id === 'tk-ok'), 'the valid half of the batch was not applied');
});

test('retrying the same operation id applies it once', async () => {
  const b = { opId: opId(), ops: [{ type: 'put', coll: 'tasks', id: 'tk-r', base: 0, data: { id: 'tk-r', projectId: 'px-1', name: 'Retry me' } }] };
  const a1 = await api(base, 'POST', `/api/w/${wsId}/commit`, b, adminTok);
  const a2 = await api(base, 'POST', `/api/w/${wsId}/commit`, b, adminTok);
  assert.strictEqual(a1.status, 200); assert.strictEqual(a2.status, 200);
  assert.strictEqual(a1.body.seq, a2.body.seq, 'same result returned');
  const snap = (await api(base, 'GET', `/api/w/${wsId}/snapshot`, undefined, adminTok)).body;
  assert.strictEqual(snap.records.find(r => r.id === 'tk-r').v, 1);
});

test('two users edit the same task from the same version: the second gets a conflict with the current version', async () => {
  const edit = (tok, name, v) => api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'put', coll: 'tasks', id: 'tk-1', base: v, data: { id: 'tk-1', projectId: 'px-1', name } }] }, tok);
  const first = await edit(adminTok, 'Lighting layout — Ana', 1);
  assert.strictEqual(first.status, 200);
  const second = await edit(memberTok, 'Lighting layout — Laura', 1);
  assert.strictEqual(second.status, 409);
  const c = second.body.conflicts[0];
  assert.strictEqual(c.id, 'tk-1'); assert.strictEqual(c.current.v, 2); assert.strictEqual(c.current.updatedBy, 'Administrator'); assert.strictEqual(c.current.data.name, 'Lighting layout — Ana');
  // after reviewing, Laura saves on top of the current version
  const third = await edit(memberTok, 'Lighting layout — Laura', 2);
  assert.strictEqual(third.status, 200);
  // deleting from an old version is a conflict too
  const del = await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'del', coll: 'tasks', id: 'tk-1', base: 2 }] }, adminTok);
  assert.strictEqual(del.status, 409);
});

test('live updates reach other clients; after a server restart a client catches up on what it missed', async () => {
  const events = [], conn = [];
  const B = new RemoteBackend({ url: base, workspaceId: wsId, token: memberTok, fetchImpl: fetch, emit: (ev, p) => { if (ev === 'remote') events.push(p); if (ev === 'connection') conn.push(p.state); } });
  const snap = await B.snapshot();
  assert.ok(snap.ok);
  await until(() => conn.includes('connected'), 5000, 'connected');
  const r = await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'put', coll: 'tasks', id: 'tk-live', base: 0, data: { id: 'tk-live', projectId: 'px-1', name: 'Live' } }] }, adminTok);
  assert.strictEqual(r.status, 200);
  await until(() => events.some(e => e.records.some(x => x.id === 'tk-live')), 5000, 'live event');
  assert.strictEqual(events.find(e => e.records.some(x => x.id === 'tk-live')).by.name, 'Administrator');

  // server stops: the client reports offline and keeps retrying
  await stop(S);
  await until(() => conn[conn.length - 1] === 'offline', 8000, 'offline');
  await serve(S);
  // a change happens right after the restart, before the client is back
  const tok2 = (await api(base, 'POST', '/api/login', { username: 'admin', password: PW })).body.token;
  adminTok = tok2;
  await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'put', coll: 'tasks', id: 'tk-missed', base: 0, data: { id: 'tk-missed', projectId: 'px-1', name: 'Missed while away' } }] }, adminTok);
  await until(() => conn[conn.length - 1] === 'connected', 40000, 'reconnected');
  await until(() => events.some(e => e.records.some(x => x.id === 'tk-missed')), 8000, 'catch-up');
  B.close();
});

test('the server records who changed what and when', async () => {
  const a = (await api(base, 'GET', `/api/w/${wsId}/activity?limit=50`, undefined, adminTok)).body.activity;
  const t1 = a.filter(x => x.id === 'tk-1');
  assert.ok(t1.some(x => x.userName === 'Laura Chen' && x.action === 'create'));
  assert.ok(t1.some(x => x.userName === 'Administrator' && x.action === 'update'));
  assert.ok(t1.every(x => /^\d{4}-\d\d-\d\dT/.test(x.at)));
});

test('personal settings are per user', async () => {
  await api(base, 'PUT', `/api/w/${wsId}/me/state`, { data: { prefs: { theme: 'dark' } } }, memberTok);
  const mine = (await api(base, 'GET', `/api/w/${wsId}/me/state`, undefined, memberTok)).body;
  const admins = (await api(base, 'GET', `/api/w/${wsId}/me/state`, undefined, adminTok)).body;
  assert.strictEqual(mine.data.prefs.theme, 'dark');
  assert.ok(!admins.data || !admins.data.prefs || admins.data.prefs.theme !== 'dark');
});

test('backups: administrator backs up and restores (validated, copy first); a deactivated user is locked out', async () => {
  const bk = await api(base, 'POST', `/api/w/${wsId}/backups`, {}, adminTok);
  assert.strictEqual(bk.status, 200, JSON.stringify(bk.body));
  await api(base, 'POST', `/api/w/${wsId}/commit`, { opId: opId(), ops: [{ type: 'put', coll: 'tasks', id: 'tk-after', base: 0, data: { id: 'tk-after', projectId: 'px-1', name: 'After backup' } }] }, adminTok);
  const insp = await api(base, 'POST', `/api/w/${wsId}/backups/inspect`, { name: bk.body.name }, adminTok);
  assert.ok(insp.body.ok, JSON.stringify(insp.body));
  const outside = await api(base, 'POST', `/api/w/${wsId}/restore`, { name: '../../server.db' }, adminTok);
  assert.strictEqual(outside.status, 404, 'only files in the backup folder');
  const rs = await api(base, 'POST', `/api/w/${wsId}/restore`, { name: bk.body.name }, adminTok);
  assert.strictEqual(rs.status, 200, JSON.stringify(rs.body)); assert.ok(rs.body.preRestore);
  const snap = (await api(base, 'GET', `/api/w/${wsId}/snapshot`, undefined, adminTok)).body;
  assert.ok(!snap.records.some(r => r.id === 'tk-after'), 'restored to the backup');
  const list = (await api(base, 'GET', `/api/w/${wsId}/backups`, undefined, adminTok)).body.backups;
  assert.ok(list.some(b => b.name === rs.body.preRestore), 'the copy made before restoring is listed');
  // deactivate the member
  const users = (await api(base, 'GET', '/api/users', undefined, adminTok)).body.users;
  const laura = users.find(u => u.username === 'laura');
  await api(base, 'PATCH', `/api/users/${laura.id}`, { active: false }, adminTok);
  assert.strictEqual((await api(base, 'GET', `/api/w/${wsId}/snapshot`, undefined, memberTok)).status, 401);
});

test('HTTPS: the certificate is validated (an untrusted certificate is refused, the company CA is accepted)', async t => {
  let openssl = true; try { execFileSync('openssl', ['version'], { stdio: 'pipe' }); } catch (_) { openssl = false; }
  if (!openssl) return t.skip('openssl not available');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-tls-'));
  const k = f => path.join(dir, f);
  // a small company CA and a server certificate for "localhost" signed by it
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k('ca.key'), '-out', k('ca.crt'), '-days', '30', '-subj', '/CN=Test Company CA'], { stdio: 'pipe' });
  execFileSync('openssl', ['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', k('srv.key'), '-out', k('srv.csr'), '-subj', '/CN=localhost'], { stdio: 'pipe' });
  fs.writeFileSync(k('ext.cnf'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n');
  execFileSync('openssl', ['x509', '-req', '-in', k('srv.csr'), '-CA', k('ca.crt'), '-CAkey', k('ca.key'), '-CAcreateserial', '-out', k('srv.crt'), '-days', '30', '-extfile', k('ext.cnf')], { stdio: 'pipe' });
  const T = init(['--cert', k('srv.crt'), '--key', k('srv.key')]);
  await serve(T);
  try {
    const get = ca => new Promise(resolve => {
      const req = https.get({ host: 'localhost', port: T.port, path: '/api/health', ca }, res => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve({ ok: true, body: JSON.parse(d) })); });
      req.on('error', e => resolve({ ok: false, code: e.code }));
    });
    const untrusted = await get(undefined);
    assert.ok(!untrusted.ok && /CERT|SIGN|ISSUER|VERIFY/i.test(untrusted.code), 'refused: ' + untrusted.code);
    const trusted = await get(fs.readFileSync(k('ca.crt')));
    assert.ok(trusted.ok); assert.strictEqual(trusted.body.https, true);
  } finally { await stop(T); }
});

test('configuration: data must be on a local disk; plain HTTP only when explicitly allowed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-cfg-'));
  const w = (o) => { const f = path.join(dir, 'c' + (n++) + '.json'); fs.writeFileSync(f, JSON.stringify(o)); return f; };
  const { isUncPath } = require('../shared/workspace-folder');
  assert.ok(isUncPath('\\\\nas\\share\\flowlace') && isUncPath('//nas/share') && !isUncPath('D:\\FlowlaceData'));
  if (process.platform === 'win32') assert.throws(() => loadConfig(w({ dataDir: '\\\\nas\\share\\flowlace', allowHttp: true })), /local disk/);
  assert.throws(() => loadConfig(w({ dataDir: path.join(dir, 'd') })), /HTTPS is not configured/);
  assert.ok(loadConfig(w({ dataDir: path.join(dir, 'd'), allowHttp: true })).dataDir);
});
