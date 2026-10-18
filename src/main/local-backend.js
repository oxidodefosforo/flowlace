'use strict';
/* Local workspace: the SQLite database is in a folder chosen by the user, opened only by this Flowlace window. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const WF = require('../../shared/workspace-folder');
const B = require('../../shared/backups');
const { Store, StoreError, restoreDatabase } = require('../../shared/store');

const osUser = () => { try { return os.userInfo().username; } catch (_) { return 'local user'; } };

class LocalBackend {
  constructor(store, folder, release, emit) {
    this.mode = 'local';
    this.store = store; this.folder = folder; this.release = release; this.emit = emit || (() => {});
    this.user = { id: 'local', name: osUser(), role: 'admin' };
    this.stopBackups = B.startScheduler(() => this.store, () => this.backupDir(), r => this.emit('backup', r));
  }

  static create(folder, name, emit) {
    if (WF.isUncPath(folder)) throw new StoreError('NETWORK_PATH', 'A local workspace must be on a disk of this computer. For data shared on the network, use a Company workspace with Flowlace Server.');
    const store = WF.createWorkspace(folder, name);
    let release;
    try { release = WF.acquireLock(folder, 'Flowlace'); } catch (e) { store.close(); throw e; }
    return new LocalBackend(store, folder, release, emit);
  }

  static open(folder, { expectedId = null, force = false } = {}, emit) {
    if (WF.isUncPath(folder)) throw new StoreError('NETWORK_PATH', 'This folder is on a network share. Local workspaces must be on a disk of this computer: several computers writing to one SQLite file over the network can damage it. Use a Company workspace with Flowlace Server instead.');
    const m = fs.existsSync(folder) ? WF.markerOf(folder) : null;
    if (m && m.movedTo && !force) throw new StoreError('MOVED', `This workspace was moved to ${m.movedTo} on ${String(m.movedAt || '').slice(0, 10)}. Open the new location, or open this older copy anyway.`, { movedTo: m.movedTo });
    const release = fs.existsSync(folder) && m && !m.invalid ? WF.acquireLock(folder, 'Flowlace') : null;
    try {
      const store = WF.openWorkspace(folder, { expectedId });
      return new LocalBackend(store, folder, release, emit);
    } catch (e) { if (release) release(); throw e; }
  }

  describe() {
    return { mode: 'local', folder: this.folder, id: this.store.meta('workspace_id'), name: this.store.meta('workspace_name'), user: this.user, dbFile: this.store.file };
  }
  connection() { return { state: 'local' }; }

  snapshot() { return Object.assign({ ok: true }, this.store.snapshot()); }
  changes(since) { return Object.assign({ ok: true }, this.store.changesSince(since)); }
  commit(batch) {
    try { return this.store.commit(batch, this.user, { enforceRoles: false }); }
    catch (e) { return { ok: false, kind: 'error', message: storageMessage(e) }; }
  }
  getUserState() { return Object.assign({ ok: true }, this.store.getUserState(this.user.id)); }
  setUserState(data) { try { return Object.assign({ ok: true }, this.store.setUserState(this.user.id, data)); } catch (e) { return { ok: false, kind: 'error', message: storageMessage(e) }; } }
  activity(limit, coll, id) { return { ok: true, activity: this.store.audit(limit, coll, id) }; }

  info() {
    const info = this.store.info();
    info.backup.dir = this.backupDir(); info.backup.defaultDir = path.join(this.folder, 'backups'); info.backup.location = 'local';
    return { ok: true, info, folder: this.folder, dbFile: this.store.file, user: this.user };
  }
  rename(name) {
    const n = this.store.rename(name);
    WF.writeMarker(this.folder, this.store);
    return { ok: true, name: n };
  }

  backupDir() { return B.backupDirOf(this.store, path.join(this.folder, 'backups')); }
  setBackupSettings({ dir, everyHours, keep }) {
    if (dir !== undefined && dir) {
      const d = path.resolve(dir);
      if (d.toLowerCase() === path.resolve(this.folder).toLowerCase()) throw new StoreError('INVALID', 'Choose a backup folder different from the workspace folder itself (the default is its “backups” subfolder; another disk or a network folder protects better).');
      fs.mkdirSync(d, { recursive: true });
      fs.accessSync(d, fs.constants.W_OK);
    }
    this.store.setBackupSettings({ dir: dir === undefined ? undefined : (dir ? path.resolve(dir) : null), everyHours, keep });
    return this.info();
  }
  backupNow() { const r = B.runBackup(this.store, this.backupDir(), 'manual'); return r.ok ? Object.assign(r, { name: path.basename(r.file) }) : Object.assign(r, { kind: 'error' }); }
  listBackups() { return { ok: true, dir: this.backupDir(), backups: B.listBackups(this.backupDir(), this.store) }; }
  resolveBackup(ref) {
    if (ref && ref.file) return ref.file;                                   // chosen with the Windows file dialog
    const b = B.listBackups(this.backupDir(), this.store).find(x => x.name === (ref && ref.name));
    if (!b) throw new StoreError('NOT_FOUND', 'That backup is no longer in the backup folder.');
    return b.file;
  }
  inspectBackup(ref) { return B.inspect(this.resolveBackup(ref)); }
  /* Exclusive: the main process owns the only connection and the renderer waits for the result. */
  restore(ref) {
    const file = this.resolveBackup(ref);
    const dir = this.backupDir(); fs.mkdirSync(dir, { recursive: true });
    const res = restoreDatabase(this.store, file, path.join(dir, B.preRestoreName(this.store)));
    this.store = res.store;
    return { ok: true, restored: res.restored, preRestore: path.basename(res.preRestore.file), epoch: this.store.epoch() };
  }

  /* Moves the data to another folder: a consistent copy is written there and checked, then Flowlace switches to it.
     The old folder is left as it was, marked as moved (nothing is deleted). */
  moveTo(target) {
    const t = path.resolve(target);
    if (WF.isUncPath(t)) throw new StoreError('NETWORK_PATH', 'A local workspace must be on a disk of this computer.');
    if (t.toLowerCase() === path.resolve(this.folder).toLowerCase()) throw new StoreError('INVALID', 'Choose a different folder.');
    fs.mkdirSync(t, { recursive: true });
    if (WF.markerOf(t) || fs.existsSync(path.join(t, WF.DB))) throw new StoreError('EXISTS', 'The chosen folder already contains a Flowlace workspace. Choose an empty folder.');
    this.store.backupTo(path.join(t, WF.DB), { reason: 'move' });
    const moved = new Store(path.join(t, WF.DB));
    for (const k of ['backup_taken_at', 'backup_reason', 'backup_seq']) moved.db.prepare('DELETE FROM meta WHERE key = ?').run(k);
    if (this.store.meta('backup_dir') === path.join(this.folder, 'backups')) moved.db.prepare("DELETE FROM meta WHERE key = 'backup_dir'").run();
    WF.writeMarker(t, moved);
    fs.mkdirSync(path.join(t, 'backups'), { recursive: true });
    const counts = moved.info().counts; moved.close();
    const before = this.store.info().counts;
    if (JSON.stringify(counts) !== JSON.stringify(before)) throw new StoreError('MOVE_CHECK', 'The copy in the new folder does not match the workspace. Nothing was changed.');
    // mark the old location
    const mf = path.join(this.folder, WF.MARKER);
    const m = JSON.parse(fs.readFileSync(mf, 'utf8')); m.movedTo = t; m.movedAt = new Date().toISOString();
    fs.writeFileSync(mf, JSON.stringify(m, null, 2));
    fs.writeFileSync(path.join(this.folder, 'MOVED-TO.txt'), `This Flowlace workspace was moved on ${m.movedAt} to:\r\n${t}\r\nThe files here were left as they were. You can delete this folder once you have checked the new location.\r\n`);
    return { ok: true, folder: t, id: this.store.meta('workspace_id'), name: this.store.meta('workspace_name') };
  }

  close() {
    if (this.stopBackups) this.stopBackups();
    if (this.store) this.store.close();
    if (this.release) this.release();
    this.store = null;
  }
}

function storageMessage(e) {
  const m = String(e && e.message || e);
  if (/SQLITE_FULL|disk is full|ENOSPC/i.test(m)) return 'The disk is full: the change could not be saved. Free some space and try again.';
  if (/SQLITE_BUSY|database is locked/i.test(m)) return 'The workspace database is busy. Try again.';
  if (/SQLITE_IOERR|EIO|SQLITE_CANTOPEN/i.test(m)) return 'The workspace folder is not available (disk disconnected?). The change was not saved.';
  if (/SQLITE_READONLY|EACCES|EPERM/i.test(m)) return 'Flowlace has no permission to write in the workspace folder.';
  return 'The change could not be saved: ' + m;
}

module.exports = { LocalBackend, storageMessage };
