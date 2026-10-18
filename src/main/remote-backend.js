'use strict';
/* Company workspace: everything goes through Flowlace Server over HTTPS. This module never opens a database file.
   Live updates arrive as Server-Sent Events; when the connection drops it reconnects with increasing delays and
   asks for what it missed. The renderer is told the connection state so it can show "Disconnected". */

const TIMEOUT = 25e3, COMMIT_TIMEOUT = 90e3, STALE = 50e3;

class RemoteBackend {
  /* fetchImpl: Electron net.fetch in the app (uses the Windows certificate store), global fetch in tests. */
  constructor({ url, workspaceId, token, user, fetchImpl, emit, onToken }) {
    this.mode = 'company';
    this.url = normUrl(url); this.workspaceId = workspaceId; this.token = token; this.user = user || null;
    this.fetch = fetchImpl; this.emit = emit || (() => {}); this.onToken = onToken || (() => {});
    this.state = 'connecting'; this.lastError = null; this.lastSeq = 0; this.epoch = null; this.wsName = null;
    this.closed = false; this.retry = 0; this.sseAbort = null; this.sseTimer = null;
  }

  static async health(url, fetchImpl) {
    const t0 = Date.now();
    try {
      const r = await withTimeout(fetchImpl(normUrl(url) + '/api/health', { method: 'GET' }), 10e3);
      const body = await r.json().catch(() => null);
      if (!r.ok || !body || body.service !== 'Flowlace Server') return { ok: false, kind: 'not-flowlace', message: 'The address answered, but it is not a Flowlace Server.' };
      return { ok: true, ms: Date.now() - t0, https: normUrl(url).startsWith('https://'), server: body };
    } catch (e) { return { ok: false, kind: 'offline', message: netMessage(e, url) }; }
  }

  static async signIn(url, username, password, fetchImpl) {
    try {
      const r = await withTimeout(fetchImpl(normUrl(url) + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, client: 'Flowlace desktop' }) }), TIMEOUT);
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, kind: body.kind || 'error', message: body.message || `Sign-in failed (${r.status}).` };
      return { ok: true, token: body.token, user: body.user };
    } catch (e) { return { ok: false, kind: 'offline', message: netMessage(e, url) }; }
  }

  async req(method, path, body, timeout = TIMEOUT) {
    if (!this.token) return { ok: false, kind: 'auth', message: 'Sign in to the server.' };
    let r;
    try {
      r = await withTimeout(this.fetch(this.url + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + this.token }, body !== undefined ? { 'Content-Type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined }), timeout);
    } catch (e) { this.setState('offline', netMessage(e, this.url)); return { ok: false, kind: 'offline', message: netMessage(e, this.url) }; }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { this.setState('auth', data.message); return { ok: false, kind: 'auth', message: data.message || 'Sign in again.' }; }
    if (this.state === 'offline') this.setState('connecting');
    if (!r.ok) return Object.assign({ ok: false, kind: data.kind || (r.status === 409 ? 'conflict' : 'error'), message: data.message || `The server answered ${r.status}.`, status: r.status }, data);
    return Object.assign({ ok: true }, data);
  }

  setState(s, err) {
    const changed = s !== this.state || (err && err !== this.lastError);
    this.state = s; if (err !== undefined) this.lastError = err || null;
    if (s === 'connected') { this.lastError = null; this.connectedAt = new Date().toISOString(); }
    if (s === 'offline' && !this.offlineSince) this.offlineSince = new Date().toISOString();
    if (s === 'connected') this.offlineSince = null;
    if (changed) this.emit('connection', this.connection());
  }
  connection() { return { state: this.state, error: this.lastError, since: this.offlineSince, url: this.url, https: this.url.startsWith('https://') }; }
  describe() { return { mode: 'company', url: this.url, id: this.workspaceId, name: this.wsName, user: this.user }; }

  async snapshot() {
    const r = await this.req('GET', `/api/w/${this.workspaceId}/snapshot`, undefined, 120e3);
    if (r.ok) { this.lastSeq = r.seq; this.epoch = r.epoch; this.wsName = r.workspace && r.workspace.name; this.startEvents(); }
    return r;
  }
  changes(since) { return this.req('GET', `/api/w/${this.workspaceId}/changes?since=${Number(since) || 0}`); }
  async commit(batch) {
    const r = await this.req('POST', `/api/w/${this.workspaceId}/commit`, batch, COMMIT_TIMEOUT);
    if (r.ok && r.seq > this.lastSeq) this.lastSeq = r.seq;
    return r;
  }
  getUserState() { return this.req('GET', `/api/w/${this.workspaceId}/me/state`); }
  setUserState(data) { return this.req('PUT', `/api/w/${this.workspaceId}/me/state`, { data }); }
  activity(limit, coll, id) { return this.req('GET', `/api/w/${this.workspaceId}/activity?limit=${Number(limit) || 50}${coll ? `&coll=${encodeURIComponent(coll)}&id=${encodeURIComponent(id)}` : ''}`); }
  async info() { const r = await this.req('GET', `/api/w/${this.workspaceId}/info`); if (r.ok && r.user) this.user = r.user; if (r.ok && r.info) this.wsName = r.info.name; return r; }
  rename(name) { return this.req('PATCH', `/api/w/${this.workspaceId}`, { name }); }
  setBackupSettings({ everyHours, keep }) { return this.req('PUT', `/api/w/${this.workspaceId}/backup-settings`, { everyHours, keep }); }
  backupNow() { return this.req('POST', `/api/w/${this.workspaceId}/backups`, {}, 600e3); }
  listBackups() { return this.req('GET', `/api/w/${this.workspaceId}/backups`); }
  inspectBackup(ref) { return this.req('POST', `/api/w/${this.workspaceId}/backups/inspect`, { name: ref && ref.name }, 300e3); }
  restore(ref) { return this.req('POST', `/api/w/${this.workspaceId}/restore`, { name: ref && ref.name }, 900e3); }
  users() { return this.req('GET', '/api/users'); }
  createUser(u) { return this.req('POST', '/api/users', u); }
  updateUser(id, patch) { return this.req('PATCH', `/api/users/${encodeURIComponent(id)}`, patch); }
  adminLog() { return this.req('GET', '/api/admin-log?limit=100'); }
  changePassword(current, password) { return this.req('POST', '/api/me/password', { current, password }); }
  async signOut() { await this.req('POST', '/api/logout', {}); this.token = null; this.onToken(null); this.close(); return { ok: true }; }
  async useToken(token, user) { this.token = token; if (user) this.user = user; this.onToken(token); this.setState('connecting'); this.restartEvents(0); return { ok: true }; }

  /* live updates */
  startEvents() { if (!this.sseAbort && !this.closed) this.restartEvents(0); }
  restartEvents(delay) {
    if (this.closed) return;
    this.gen = (this.gen || 0) + 1;
    if (this.sseAbort) { try { this.sseAbort.abort(); } catch (_) { /* ignore */ } this.sseAbort = null; }
    clearTimeout(this.sseTimer);
    this.sseTimer = setTimeout(() => this.runEvents(), delay);
  }
  async runEvents() {
    if (this.closed || !this.token) return;
    const gen = this.gen;
    const ac = new AbortController(); this.sseAbort = ac;
    let lastData = Date.now();
    const watchdog = setInterval(() => { if (Date.now() - lastData > STALE) { try { ac.abort(); } catch (_) { /* ignore */ } } }, 5e3);
    try {
      const r = await this.fetch(`${this.url}/api/w/${this.workspaceId}/events?since=${this.lastSeq}`, { headers: { Authorization: 'Bearer ' + this.token, Accept: 'text/event-stream' }, signal: ac.signal });
      if (gen !== this.gen) { clearInterval(watchdog); try { ac.abort(); } catch (_) { /* ignore */ } return; }
      if (r.status === 401) { this.setState('auth', 'Your session has expired. Sign in again.'); clearInterval(watchdog); this.sseAbort = null; return; }
      if (!r.ok || !r.body) throw new Error(`events: ${r.status}`);
      const reader = r.body.getReader(); const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        lastData = Date.now();
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          let ev = 'message'; const data = [];
          for (const line of block.split('\n')) { if (line.startsWith('event:')) ev = line.slice(6).trim(); else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, '')); }
          if (!data.length) continue;
          let payload; try { payload = JSON.parse(data.join('\n')); } catch (_) { continue; }
          if (gen === this.gen) this.onEvent(ev, payload);
        }
      }
      throw new Error('The connection to the server closed.');
    } catch (e) {
      clearInterval(watchdog);
      if (this.closed || gen !== this.gen) return;   // replaced by a newer connection
      this.sseAbort = null;
      if (this.state !== 'auth') this.setState('offline', netMessage(e, this.url));
      const delays = [1e3, 2e3, 5e3, 10e3, 20e3, 30e3];
      this.restartEvents(delays[Math.min(this.retry++, delays.length - 1)]);
      return;
    }
  }
  onEvent(ev, p) {
    if (ev === 'hello') {
      this.retry = 0;
      if (this.epoch != null && p.epoch !== this.epoch) { this.epoch = p.epoch; this.lastSeq = p.seq; this.setState('connected'); this.emit('reset', { epoch: p.epoch, reason: 'restored' }); return; }
      this.epoch = p.epoch; this.setState('connected');
      if (p.maintenance) this.emit('maintenance', { on: true });
    } else if (ev === 'catchup' || ev === 'commit') {
      if (p.epoch != null && this.epoch != null && p.epoch !== this.epoch) return;
      if (p.seq > this.lastSeq) this.lastSeq = p.seq;
      this.emit('remote', { seq: p.seq, opId: p.opId || null, by: p.by || null, at: p.at || null, records: p.records || [], catchup: ev === 'catchup' });
    } else if (ev === 'reset') {
      this.epoch = p.epoch; this.lastSeq = p.seq; this.emit('reset', { epoch: p.epoch, by: p.by, from: p.from, reason: 'restored' });
    } else if (ev === 'maintenance') this.emit('maintenance', p);
    else if (ev === 'info') { if (p.name) this.wsName = p.name; this.emit('info', p); }
  }
  close() { this.closed = true; clearTimeout(this.sseTimer); if (this.sseAbort) { try { this.sseAbort.abort(); } catch (_) { /* ignore */ } } }
}

function normUrl(u) { let s = String(u || '').trim().replace(/\/+$/, ''); if (s && !/^https?:\/\//i.test(s)) s = 'https://' + s; return s; }
function withTimeout(p, ms) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms); })]).finally(() => clearTimeout(t)); }
function netMessage(e, url) {
  const m = String((e && (e.cause && e.cause.code || e.code || e.message)) || e);
  if (/CERT|SSL|TLS|certificate|ERR_CERT/i.test(m)) return `The server’s HTTPS certificate is not trusted by this computer (${m}). Ask IT to install the company certificate; Flowlace never skips this check.`;
  if (/TIMEOUT|timed out/i.test(m)) return `Flowlace Server at ${url} did not answer in time.`;
  if (/ENOTFOUND|NAME_NOT_RESOLVED/i.test(m)) return `The server name in ${url} can’t be found on this network.`;
  if (/ECONNREFUSED|CONNECTION_REFUSED/i.test(m)) return `Nothing is answering at ${url}. Is Flowlace Server running, and is the port open in the firewall?`;
  if (/abort/i.test(m)) return 'The connection to the server was interrupted.';
  return `Flowlace Server at ${url} can’t be reached (${m}).`;
}

module.exports = { RemoteBackend, normUrl, netMessage };
