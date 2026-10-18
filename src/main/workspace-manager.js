'use strict';
/* Chooses, opens and switches workspaces. Remembers the choice in the user settings. Opening never creates an empty
   database: when the remembered location is missing, the problem is reported and the user decides. */
const fs = require('fs');
const path = require('path');
const { LocalBackend } = require('./local-backend');
const { RemoteBackend, normUrl } = require('./remote-backend');
const WF = require('../../shared/workspace-folder');

class WorkspaceManager {
  constructor({ settings, fetchImpl, emit, userDataDir, isNetworkDrive }) {
    this.settings = settings; this.fetch = fetchImpl; this.emit = emit; this.userDataDir = userDataDir;
    this.isNetworkDrive = isNetworkDrive || (async () => false);
    this.backend = null; this.error = null;
  }

  status() {
    const cur = this.settings.current;
    return {
      ok: true, configured: !!cur, entry: cur, open: !!this.backend,
      error: this.error, recent: this.settings.recent,
      workspace: this.backend ? this.backend.describe() : null,
      connection: this.backend ? this.backend.connection() : null
    };
  }

  async openCurrent() {
    this.error = null;
    const cur = this.settings.current;
    if (!cur) return this.status();
    try {
      if (cur.mode === 'local') this.backend = LocalBackend.open(cur.folder, { expectedId: cur.id, force: !!cur.forceOld }, this.emit);
      else {
        const token = this.settings.getToken(cur.url, cur.username);
        if (!token) { this.error = { code: 'AUTH', message: `Sign in to ${cur.url} to open “${cur.workspaceName || 'the workspace'}”.` }; return this.status(); }
        this.backend = this.remote(cur, token);
        const r = await this.backend.info();
        if (!r.ok) {
          const b = this.backend; this.backend = null; b.close();
          this.error = { code: r.kind === 'auth' ? 'AUTH' : r.kind === 'offline' ? 'OFFLINE' : 'SERVER', message: r.message };
        }
      }
    } catch (e) {
      this.backend = null;
      this.error = { code: e.code || 'ERROR', message: e.message, movedTo: e.movedTo };
    }
    return this.status();
  }

  remote(entry, token, user) {
    return new RemoteBackend({ url: entry.url, workspaceId: entry.workspaceId, token, user, fetchImpl: this.fetch, emit: this.emit,
      onToken: t => this.settings.setToken(entry.url, entry.username, t) });
  }

  close() { if (this.backend) { try { this.backend.close(); } catch (_) { /* ignore */ } } this.backend = null; }

  async checkLocalFolder(folder) {
    if (WF.isUncPath(folder) || await this.isNetworkDrive(folder)) {
      const e = new Error('This folder is on a network drive. A local workspace must be on a disk of this computer: several computers writing to one SQLite file over the network can damage it. For shared data, use a Company workspace with Flowlace Server.');
      e.code = 'NETWORK_PATH'; throw e;
    }
  }

  /* Where a new workspace named `name` goes when the user picked `folder`: the folder itself if it is empty, otherwise a subfolder. */
  targetFor(folder, name) {
    let entries = [];
    try { entries = fs.readdirSync(folder).filter(f => !/^(desktop\.ini|thumbs\.db|\.ds_store)$/i.test(f)); } catch (_) { return folder; }
    if (!entries.length) return folder;
    const base = String(name || 'Flowlace workspace').replace(/[<>:"/\\|?*\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Flowlace workspace';
    let t = path.join(folder, base), i = 2;
    while (fs.existsSync(t)) t = path.join(folder, `${base} (${i++})`);
    return t;
  }

  async createLocal(folder, name) {
    await this.checkLocalFolder(folder);
    const target = this.targetFor(folder, name);
    const b = LocalBackend.create(target, name, this.emit);
    this.close(); this.backend = b; this.error = null;
    const d = b.describe();
    this.settings.setCurrent({ mode: 'local', folder: target, id: d.id, name: d.name });
    return Object.assign(this.status(), { created: true, folder: target });
  }

  async openLocal(folder, { force = false } = {}) {
    await this.checkLocalFolder(folder);
    const b = LocalBackend.open(folder, { force }, this.emit);   // throws (and leaves the current workspace open) when it can't
    this.close(); this.backend = b; this.error = null;
    const d = b.describe();
    this.settings.setCurrent({ mode: 'local', folder, id: d.id, name: d.name, forceOld: force || undefined });
    return this.status();
  }

  async moveLocal(target) {
    if (!this.backend || this.backend.mode !== 'local') throw Object.assign(new Error('Only a local workspace can be moved.'), { code: 'INVALID' });
    await this.checkLocalFolder(target);
    const r = this.backend.moveTo(target);
    const old = this.backend.folder;
    this.close();
    this.backend = LocalBackend.open(r.folder, { expectedId: r.id }, this.emit);
    this.settings.setCurrent({ mode: 'local', folder: r.folder, id: r.id, name: r.name });
    this.settings.forget({ mode: 'local', folder: old });
    return Object.assign(this.status(), { moved: true, from: old, to: r.folder });
  }

  /* Company */
  testServer(url) { return RemoteBackend.health(url, this.fetch); }

  async signIn(url, username, password) {
    const u = normUrl(url);
    const h = await RemoteBackend.health(u, this.fetch);
    if (!h.ok) return h;
    const r = await RemoteBackend.signIn(u, username, password, this.fetch);
    if (!r.ok) return r;
    this.settings.setToken(u, username, r.token);
    this.pendingToken = { url: u, username: String(username).toLowerCase(), token: r.token, user: r.user };
    // an open Company workspace on the same server and account continues with the new session
    const cur = this.settings.current;
    if (this.backend && this.backend.mode === 'company' && cur && normUrl(cur.url) === u && String(cur.username).toLowerCase() === this.pendingToken.username) await this.backend.useToken(r.token, r.user);
    const ws = await this.serverWorkspaces(u, username);
    return Object.assign({ ok: true, user: r.user, server: h.server, https: h.https }, ws.ok ? { workspaces: ws.workspaces } : { workspaces: [] });
  }

  tokenFor(url, username) {
    const p = this.pendingToken;
    if (p && p.url === normUrl(url) && p.username === String(username).toLowerCase()) return p.token;
    return this.settings.getToken(normUrl(url), username);
  }

  async serverWorkspaces(url, username) {
    const t = this.tokenFor(url, username);
    const rb = new RemoteBackend({ url, workspaceId: '', token: t, fetchImpl: this.fetch });
    return rb.req('GET', '/api/workspaces');
  }

  async createServerWorkspace(url, username, name) {
    const rb = new RemoteBackend({ url, workspaceId: '', token: this.tokenFor(url, username), fetchImpl: this.fetch });
    return rb.req('POST', '/api/workspaces', { name });
  }

  async connectCompany(url, username, workspaceId) {
    const u = normUrl(url), token = this.tokenFor(u, username);
    if (!token) return { ok: false, kind: 'auth', message: 'Sign in first.' };
    const entry = { mode: 'company', url: u, username: String(username).toLowerCase(), workspaceId };
    const b = this.remote(entry, token);
    const r = await b.info();
    if (!r.ok) { b.close(); return r; }
    entry.workspaceName = r.info.name;
    this.close(); this.backend = b; this.error = null;
    this.settings.setCurrent(entry);
    return this.status();
  }

  forget(entry) { this.settings.forget(entry); return this.status(); }
  /* back to the start screen without opening anything */
  leave() { this.close(); this.settings.setCurrent(null); this.error = null; return this.status(); }
}

module.exports = { WorkspaceManager };
