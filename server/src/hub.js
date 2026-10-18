'use strict';
/* Workspaces served by this Flowlace Server: one Store (SQLite database) per workspace, opened only by this
   process. Keeps the live-update subscribers (Server-Sent Events), the automatic backups and restores. */
const fs = require('fs');
const path = require('path');
const WF = require('../../shared/workspace-folder');
const B = require('../../shared/backups');
const { restoreDatabase, newId } = require('../../shared/store');
const { httpErr } = require('./accounts');

class Hub {
  constructor(cfg, accounts, log) {
    this.cfg = cfg; this.accounts = accounts; this.log = log;
    this.open = new Map();      // id -> { store, release, clients:Set, maintenance:false, stopBackups }
  }

  folderOf(id) { return path.join(this.cfg.dataDir, 'workspaces', id); }
  defaultBackupDir(id) { return path.join(this.cfg.backupDir, id); }
  backupDir(w) { return B.backupDirOf(w.store, this.defaultBackupDir(w.id)); }

  createWorkspace(name, by) {
    const n = String(name || '').trim().slice(0, 120);
    if (!n) throw httpErr(400, 'Enter a workspace name.');
    const id = newId('ws');
    const dir = this.folderOf(id);
    WF.createWorkspace(dir, n, { id }).close();
    this.accounts.addWorkspace(id, n, dir, by && by.id);
    this.log(`workspace created: ${n} (${id})`);
    return this.get(id);
  }

  /* Opens (once) and returns the workspace. Never creates a database when the folder or file is missing. */
  get(id) {
    let w = this.open.get(id);
    if (w) return w;
    const reg = this.accounts.workspace(id);
    if (!reg || reg.archived) throw httpErr(404, 'This workspace does not exist on the server.');
    let store;
    try { store = WF.openWorkspace(reg.folder, { expectedId: id }); }
    catch (e) { throw httpErr(503, `The workspace “${reg.name}” can’t be opened on the server: ${e.message}`, { code: e.code }); }
    let release;
    try { release = WF.acquireLock(reg.folder, 'Flowlace Server'); } catch (e) { store.close(); throw httpErr(503, e.message, { code: e.code }); }
    w = { id, store, release, clients: new Set(), maintenance: false };
    w.stopBackups = B.startScheduler(() => w.store, () => this.backupDir(w), r => this.log(r.ok ? `automatic backup of ${id}: ${r.file}` : `automatic backup of ${id} FAILED: ${r.message}`));
    this.open.set(id, w);
    return w;
  }

  openAll() {
    for (const reg of this.accounts.listWorkspaces()) {
      try { this.get(reg.id); this.log(`workspace ready: ${reg.name} (${reg.id})`); }
      catch (e) { this.log(`workspace NOT available: ${reg.name} (${reg.id}): ${e.message}`); }
    }
  }

  closeAll() {
    for (const w of this.open.values()) {
      for (const c of w.clients) { try { c.res.end(); } catch (_) { /* ignore */ } }
      if (w.stopBackups) w.stopBackups();
      w.store.close(); w.release();
    }
    this.open.clear();
  }

  /* live updates */
  subscribe(w, client) { w.clients.add(client); return () => w.clients.delete(client); }
  broadcast(w, event, data, except) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of w.clients) if (c !== except) { try { c.res.write(msg); } catch (_) { /* closed */ } }
  }
  dropUser(userId) {
    for (const w of this.open.values()) for (const c of w.clients) if (c.user.id === userId) { try { c.res.end(); } catch (_) { /* ignore */ } }
  }

  commit(w, batch, user) {
    if (w.maintenance) throw httpErr(503, 'The workspace is being restored from a backup. Try again in a moment.', { kind: 'maintenance' });
    const r = w.store.commit(batch, { id: user.id, name: user.name, role: user.role }, { enforceRoles: true });
    if (r.ok && !r.replayed) {
      const records = w.store.recordsOf(r.results.filter(x => !x.unchanged || x.pos !== undefined));
      this.broadcast(w, 'commit', { seq: r.seq, epoch: r.epoch, opId: batch.opId, at: r.at, by: { id: user.id, name: user.name }, records });
    }
    return r;
  }

  backupNow(w, user) {
    const r = B.runBackup(w.store, this.backupDir(w), 'manual');
    this.accounts.log(user, 'backup', r.ok ? r.file : 'failed: ' + r.message);
    return r;
  }

  listBackups(w) { return B.listBackups(this.backupDir(w), w.store).map(b => ({ name: b.name, size: b.size, at: b.at, kind: b.kind })); }

  backupFile(w, name) {
    const list = B.listBackups(this.backupDir(w), w.store);
    const b = list.find(x => x.name === name);       // only files in this workspace's backup folder can be used
    if (!b) throw httpErr(404, 'That backup is not in the backup folder of this workspace.');
    return b.file;
  }

  inspectBackup(w, name) { return B.inspect(this.backupFile(w, name)); }

  /* Exclusive restore: writes are refused while it runs; Node runs it without interleaving other requests. */
  restore(w, name, user) {
    const file = this.backupFile(w, name);
    const check = B.inspect(file);
    if (!check.ok) throw httpErr(422, 'This backup can’t be restored: ' + check.message);
    w.maintenance = true;
    this.broadcast(w, 'maintenance', { on: true, by: user.name });
    try {
      const dir = this.backupDir(w);
      fs.mkdirSync(dir, { recursive: true });
      const res = restoreDatabase(w.store, file, path.join(dir, B.preRestoreName(w.store)));
      w.store = res.store;
      this.accounts.log(user, 'restore', `${name} (copy before restore: ${path.basename(res.preRestore.file)})`);
      this.log(`workspace ${w.id} restored from ${name} by ${user.name}`);
      this.broadcast(w, 'reset', { epoch: w.store.epoch(), seq: w.store.seq(), by: user.name, from: name });
      return { ok: true, restored: check, preRestore: path.basename(res.preRestore.file), epoch: w.store.epoch() };
    } catch (e) {
      // if the store was closed but not reopened, reopen the untouched database
      if (!w.store.db) { try { w.store = WF.openWorkspace(this.accounts.workspace(w.id).folder, { expectedId: w.id }); } catch (_) { /* reported below */ } }
      throw httpErr(e.status || 500, e.message, { code: e.code });
    } finally {
      w.maintenance = false;
      this.broadcast(w, 'maintenance', { on: false });
    }
  }
}

module.exports = { Hub };
