'use strict';
/* A workspace on disk is a folder with:
     flowlace-workspace.json   identifies the workspace (id, name) — never contains project data
     flowlace.db               the SQLite database (+ -wal / -shm while open)
     backups/                   default backup folder (another location can be chosen)
     flowlace.lock             present while one program has the workspace open
   Opening never creates anything: a missing folder, marker or database is reported as an error. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store, StoreError, FORMAT } = require('./store');

const MARKER = 'flowlace-workspace.json';
const DB = 'flowlace.db';
const LOCK = 'flowlace.lock';

function markerOf(dir) {
  const f = path.join(dir, MARKER);
  if (!fs.existsSync(f)) return null;
  try { const m = JSON.parse(fs.readFileSync(f, 'utf8')); return m && m.format === FORMAT && m.id ? m : { invalid: true }; }
  catch (_) { return { invalid: true }; }
}

function writeMarker(dir, store) {
  const m = { format: FORMAT, id: store.meta('workspace_id'), name: store.meta('workspace_name'), createdAt: store.meta('created_at'), database: DB,
    note: 'Flowlace workspace. Open this folder from Flowlace (Settings → Workspace & Storage). Do not copy flowlace.db while Flowlace is running: use Back up now.' };
  const tmp = path.join(dir, MARKER + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  fs.renameSync(tmp, path.join(dir, MARKER));
  return m;
}

function createWorkspace(dir, name, { id } = {}) {
  if (!dir) throw new StoreError('INVALID', 'Choose a folder.');
  fs.mkdirSync(dir, { recursive: true });
  const m = markerOf(dir);
  if (m) throw new StoreError('EXISTS', 'This folder already contains a Flowlace workspace. Open it instead of creating a new one.');
  if (fs.existsSync(path.join(dir, DB))) throw new StoreError('EXISTS', 'This folder already contains a Flowlace database (flowlace.db). Open it, or choose an empty folder.');
  const store = Store.create(path.join(dir, DB), { name, id });
  writeMarker(dir, store);
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  return store;
}

/* Opens the workspace in `dir`. expectedId (optional): the id remembered in the settings, to detect a different workspace at the same path. */
function openWorkspace(dir, { expectedId = null, backupDir = null } = {}) {
  if (!dir || !fs.existsSync(dir)) throw new StoreError('FOLDER_MISSING', `The workspace folder is not available: ${dir}. If it is on a removable or network drive, connect it and try again.`);
  const m = markerOf(dir);
  if (!m) throw new StoreError('NO_WORKSPACE', 'There is no Flowlace workspace in this folder (flowlace-workspace.json is missing).');
  if (m.invalid) throw new StoreError('NO_WORKSPACE', 'The file flowlace-workspace.json in this folder is damaged.');
  const dbFile = path.join(dir, m.database || DB);
  if (!fs.existsSync(dbFile)) throw new StoreError('DB_MISSING', `The workspace “${m.name}” is described in this folder but its database (flowlace.db) is missing. Restore it from a backup; Flowlace will not create an empty one.`);
  const store = new Store(dbFile, { backupDirForMigration: backupDir || path.join(dir, 'backups') });
  if (store.meta('workspace_id') !== m.id) { store.close(); throw new StoreError('MISMATCH', 'The database in this folder belongs to a different workspace than flowlace-workspace.json says.'); }
  if (expectedId && expectedId !== m.id) { store.close(); throw new StoreError('OTHER_WORKSPACE', `This folder now contains a different workspace (“${m.name}”) than the one remembered.`); }
  return store;
}

/* Lock file: one program at a time. A lock left by a program that is no longer running on this computer is replaced. */
function acquireLock(dir, owner) {
  const f = path.join(dir, LOCK);
  const me = { pid: process.pid, host: os.hostname(), user: safeUser(), app: owner || 'Flowlace', at: new Date().toISOString() };
  for (let i = 0; i < 2; i++) {
    try { fs.writeFileSync(f, JSON.stringify(me), { flag: 'wx' }); return () => releaseLock(f, me); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let cur = null; try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { /* unreadable lock: treat as stale */ }
      const stale = !cur || (cur.host === me.host && !alive(cur.pid)) || (cur.host === me.host && cur.pid === me.pid);
      if (!stale) throw new StoreError('LOCKED', `This workspace is already open in ${cur.app || 'Flowlace'} by ${cur.user || 'another user'} on ${cur.host} (since ${String(cur.at || '').slice(0, 16).replace('T', ' ')}). Close it there first.`, { lock: cur });
      try { fs.unlinkSync(f); } catch (_) { /* ignore */ }
    }
  }
  throw new StoreError('LOCKED', 'The workspace lock could not be taken.');
}
function releaseLock(f, me) {
  try { const cur = JSON.parse(fs.readFileSync(f, 'utf8')); if (cur.pid === me.pid && cur.host === me.host) fs.unlinkSync(f); } catch (_) { /* ignore */ }
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function safeUser() { try { return os.userInfo().username; } catch (_) { return null; } }

/* A local workspace must be on a disk of this computer. UNC paths (\\server\share\…) are network locations. */
function isUncPath(p) { return /^\\\\[^\\]/.test(String(p || '')) || /^\/\/[^/]/.test(String(p || '')); }

module.exports = { MARKER, DB, LOCK, markerOf, writeMarker, createWorkspace, openWorkspace, acquireLock, isUncPath };
