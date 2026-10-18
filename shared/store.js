'use strict';
/* Flowlace workspace store: one SQLite database per workspace.

   - Every list item of the application (project, task, deliverable, person…) is one record (coll, id) with its
     own version number. Single objects (company details, workflow standard…) are records with id "_".
   - Clients send batches of operations on concrete records: put (create / replace), del, move (order only).
     A batch is applied in one transaction: all of it or nothing.
   - Each put/del carries the version the client started from (base). If the record changed since then and the new
     content differs, the batch is rejected with the current version so the user can review it (no silent
     "last save wins"). A write that leaves the record exactly as it already is counts as done.
   - Every batch has an operation id; repeating it (a retry after a lost reply) returns the first result instead of
     applying it twice.
   - Each committed batch gets a sequence number; records remember the last one that touched them, so a client can
     ask for "everything since N" after a disconnection. The changes table records who changed what and when.
   - Backups use VACUUM INTO (a consistent copy of the live database), never a copy of the open file. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { openDb } = require('./sqlite');
const { canon } = require('./canonical');
const schema = require('./schema');

const SCHEMA_VERSION = 1;          // database structure (PRAGMA user_version)
const FORMAT = 'flowlace-workspace';

/* Database migrations. Never edit a released step: add a new one. Each runs inside a transaction. */
const MIGRATIONS = [
  null,
  db => {
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE records (
        coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT, version INTEGER NOT NULL, pos REAL,
        deleted INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL,
        created_at TEXT NOT NULL, created_by TEXT, updated_at TEXT NOT NULL, updated_by TEXT, updated_by_name TEXT,
        PRIMARY KEY (coll, id)) WITHOUT ROWID;
      CREATE INDEX records_seq ON records (seq);
      CREATE TABLE batches (seq INTEGER PRIMARY KEY, op_id TEXT NOT NULL UNIQUE, at TEXT NOT NULL,
        user_id TEXT, user_name TEXT, n_ops INTEGER NOT NULL, result TEXT NOT NULL);
      CREATE TABLE changes (seq INTEGER NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, action TEXT NOT NULL,
        version INTEGER, label TEXT, at TEXT NOT NULL, user_id TEXT, user_name TEXT);
      CREATE INDEX changes_seq ON changes (seq);
      CREATE INDEX changes_rec ON changes (coll, id);
      CREATE TABLE user_state (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);`);
  }
];

class StoreError extends Error {
  constructor(code, message, extra) { super(message); this.code = code; Object.assign(this, extra || {}); }
}

const nowISO = () => new Date().toISOString();
const newId = (p = 'ws') => p + '-' + crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');

class Store {
  /* Opens an existing workspace database. Never creates one (use Store.create). */
  constructor(file, { readOnly = false, backupDirForMigration = null } = {}) {
    if (!fs.existsSync(file)) throw new StoreError('DB_MISSING', `The workspace database was not found: ${file}`);
    this.file = file;
    this.readOnly = readOnly;
    this.db = openDb(file, { readOnly });
    if (!readOnly) {
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = FULL');   // "Saved" means it is on disk
    }
    const v = this.userVersion();
    if (v > SCHEMA_VERSION) {
      this.db.close();
      throw new StoreError('TOO_NEW', `This workspace was saved by a newer version of Flowlace (database version ${v}). Update Flowlace to open it.`);
    }
    if (v === 0) { this.db.close(); throw new StoreError('NOT_WORKSPACE', 'This file is not a Flowlace workspace database.'); }
    if (v < SCHEMA_VERSION && !readOnly) this.migrate(v, backupDirForMigration);
    if (this.meta('format') !== FORMAT) { this.db.close(); throw new StoreError('NOT_WORKSPACE', 'This file is not a Flowlace workspace database.'); }
    this.prepare();
  }

  static create(file, { name, id } = {}) {
    if (fs.existsSync(file)) throw new StoreError('EXISTS', `A database already exists at ${file}. Open it instead.`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = openDb(file);
    try {
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('BEGIN');
      MIGRATIONS[1](db);
      for (let v = 2; v <= SCHEMA_VERSION; v++) MIGRATIONS[v](db);
      const ins = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
      const meta = { format: FORMAT, workspace_id: id || newId(), workspace_name: String(name || 'Flowlace workspace').slice(0, 120),
        created_at: nowISO(), data_version: String(schema.DATA_VERSION), epoch: '1', backup_every_hours: '24', backup_keep: '14' };
      for (const [k, v] of Object.entries(meta)) ins.run(k, v);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
      db.close(); try { fs.unlinkSync(file); } catch (_) { /* ignore */ }
      throw e;
    }
    db.close();
    return new Store(file);
  }

  userVersion() { return this.db.prepare('PRAGMA user_version').get().user_version; }

  migrate(from, backupDir) {
    // Keep a copy of the database exactly as the previous version left it, then upgrade step by step.
    if (backupDir) {
      fs.mkdirSync(backupDir, { recursive: true });
      const f = path.join(backupDir, `pre-upgrade-v${from}-to-v${SCHEMA_VERSION}-${stamp()}.db`);
      this.db.prepare('VACUUM INTO ?').run(f);
    }
    for (let v = from + 1; v <= SCHEMA_VERSION; v++) {
      this.db.exec('BEGIN IMMEDIATE');
      try { MIGRATIONS[v](this.db); this.db.exec(`PRAGMA user_version = ${v}`); this.db.exec('COMMIT'); }
      catch (e) { this.db.exec('ROLLBACK'); throw new StoreError('MIGRATION_FAILED', `Upgrading the workspace database to version ${v} failed: ${e.message}`); }
    }
  }

  prepare() {
    const d = this.db;
    this.q = {
      meta: d.prepare('SELECT value FROM meta WHERE key = ?'),
      setMeta: d.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
      get: d.prepare('SELECT coll, id, data, version, pos, deleted, seq, updated_at, updated_by, updated_by_name FROM records WHERE coll = ? AND id = ?'),
      insert: d.prepare(`INSERT INTO records (coll, id, data, version, pos, deleted, seq, created_at, created_by, updated_at, updated_by, updated_by_name)
                         VALUES (?, ?, ?, 1, ?, 0, ?, ?, ?, ?, ?, ?)`),
      update: d.prepare('UPDATE records SET data = ?, version = ?, pos = COALESCE(?, pos), deleted = 0, seq = ?, updated_at = ?, updated_by = ?, updated_by_name = ? WHERE coll = ? AND id = ?'),
      tomb: d.prepare('UPDATE records SET version = ?, deleted = 1, seq = ?, updated_at = ?, updated_by = ?, updated_by_name = ? WHERE coll = ? AND id = ?'),
      move: d.prepare('UPDATE records SET pos = ?, seq = ? WHERE coll = ? AND id = ? AND deleted = 0'),
      maxPos: d.prepare('SELECT MAX(pos) AS m FROM records WHERE coll = ?'),
      maxSeq: d.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM batches'),
      batchByOp: d.prepare('SELECT result FROM batches WHERE op_id = ?'),
      addBatch: d.prepare('INSERT INTO batches (seq, op_id, at, user_id, user_name, n_ops, result) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      addChange: d.prepare('INSERT INTO changes (seq, coll, id, action, version, label, at, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      alive: d.prepare('SELECT 1 AS x FROM records WHERE coll = ? AND id = ? AND deleted = 0'),
      all: d.prepare('SELECT coll, id, data, version, pos FROM records WHERE deleted = 0 ORDER BY coll, pos, id'),
      since: d.prepare('SELECT coll, id, data, version, pos, deleted FROM records WHERE seq > ? ORDER BY seq, coll, pos'),
      counts: d.prepare('SELECT coll, COUNT(*) AS n FROM records WHERE deleted = 0 GROUP BY coll'),
      getState: d.prepare('SELECT data, updated_at FROM user_state WHERE user_id = ?'),
      setState: d.prepare('INSERT INTO user_state (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'),
      audit: d.prepare('SELECT seq, coll, id, action, version, label, at, user_id, user_name FROM changes ORDER BY seq DESC, rowid DESC LIMIT ?'),
      auditRec: d.prepare('SELECT seq, coll, id, action, version, label, at, user_id, user_name FROM changes WHERE coll = ? AND id = ? ORDER BY seq DESC LIMIT ?')
    };
  }

  close() { if (this.db) { try { this.db.close(); } catch (_) { /* ignore */ } this.db = null; } }

  meta(k) { const r = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(k); return r ? r.value : null; }
  setMeta(k, v) { this.q.setMeta.run(k, String(v)); }
  seq() { return this.q.maxSeq.get().s; }
  epoch() { return parseInt(this.meta('epoch'), 10) || 1; }

  info() {
    const counts = {};
    for (const r of this.q.counts.all()) counts[r.coll] = r.n;
    return {
      id: this.meta('workspace_id'), name: this.meta('workspace_name'), createdAt: this.meta('created_at'),
      schemaVersion: this.userVersion(), dataVersion: parseInt(this.meta('data_version'), 10) || schema.DATA_VERSION,
      seq: this.seq(), epoch: this.epoch(), counts,
      backup: { dir: this.meta('backup_dir') || null, everyHours: parseFloat(this.meta('backup_every_hours') || '24'), keep: parseInt(this.meta('backup_keep') || '14', 10),
        lastAt: this.meta('last_backup_at'), lastFile: this.meta('last_backup_file'), lastError: this.meta('last_backup_error') }
    };
  }

  /* Whole workspace for a client that starts or reloads. */
  snapshot() {
    const records = this.q.all.all().map(r => ({ coll: r.coll, id: r.id, v: r.version, pos: r.pos, data: JSON.parse(r.data) }));
    return { workspace: { id: this.meta('workspace_id'), name: this.meta('workspace_name') }, seq: this.seq(), epoch: this.epoch(),
      dataVersion: parseInt(this.meta('data_version'), 10) || schema.DATA_VERSION, records };
  }

  /* Records changed after sequence number `since` (including deletions). */
  changesSince(since) {
    const s = Number(since) || 0;
    const records = this.q.since.all(s).map(r => r.deleted ? { coll: r.coll, id: r.id, v: r.version, deleted: true }
      : { coll: r.coll, id: r.id, v: r.version, pos: r.pos, data: JSON.parse(r.data) });
    return { seq: this.seq(), epoch: this.epoch(), records };
  }

  /* Applies a batch. user = { id, name, role }. opts.enforceRoles: Company workspaces check administrator-only data. */
  commit(batch, user = {}, opts = {}) {
    if (this.readOnly) throw new StoreError('READ_ONLY', 'This workspace is open read-only.');
    const err = schema.checkBatch(batch);
    if (err) return { ok: false, kind: 'invalid', message: err };
    const prev = this.q.batchByOp.get(batch.opId);
    if (prev) return Object.assign(JSON.parse(prev.result), { replayed: true });
    if (opts.enforceRoles && user.role !== 'admin') {
      const bad = batch.ops.filter(op => schema.isAdminOnly(op.coll));
      if (bad.length) return { ok: false, kind: 'forbidden', message: 'Only administrators can change company settings (phases, disciplines, project teams, defaults, workflow standard, company details and appearance).',
        keys: bad.map(op => ({ coll: op.coll, id: op.id })) };
    }
    const at = nowISO(), uid = user.id || null, uname = user.name || null;
    const db = this.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      const seq = this.seq() + 1;
      const conflicts = [], results = [], changes = [];
      let nextPos = {};
      const posFor = coll => {
        if (nextPos[coll] === undefined) { const m = this.q.maxPos.get(coll).m; nextPos[coll] = (m == null ? 0 : m) + 1024; }
        const p = nextPos[coll]; nextPos[coll] += 1024; return p;
      };
      for (const op of batch.ops) {
        const cur = this.q.get.get(op.coll, op.id);
        if (op.type === 'move') {
          if (cur && !cur.deleted) { this.q.move.run(op.pos, seq, op.coll, op.id); results.push({ coll: op.coll, id: op.id, v: cur.version, pos: op.pos }); }
          continue;
        }
        if (op.type === 'put') {
          const json = canon(op.data);
          const label = schema.recordLabel(op.coll, op.data).slice(0, 200);
          if (!cur) {
            if (op.base !== 0) { conflicts.push(conflictOf(op, null, 'missing')); continue; }
            const pos = schema.isColl(op.coll) ? (op.pos !== undefined ? op.pos : posFor(op.coll)) : null;
            this.q.insert.run(op.coll, op.id, json, pos, seq, at, uid, at, uid, uname);
            results.push({ coll: op.coll, id: op.id, v: 1, pos }); changes.push([op.coll, op.id, 'create', 1, label]);
          } else if (cur.deleted) {
            if (op.base !== cur.version) { conflicts.push(conflictOf(op, cur, 'deleted')); continue; }
            const v = cur.version + 1, pos = schema.isColl(op.coll) ? (op.pos !== undefined ? op.pos : (cur.pos != null ? cur.pos : posFor(op.coll))) : null;
            this.q.update.run(json, v, pos, seq, at, uid, uname, op.coll, op.id);
            results.push({ coll: op.coll, id: op.id, v, pos }); changes.push([op.coll, op.id, 'restore', v, label]);
          } else if (cur.data === json) {
            // already exactly like this (for example the same change saved twice): nothing to do, no conflict
            if (op.pos !== undefined && op.pos !== cur.pos) this.q.move.run(op.pos, seq, op.coll, op.id);
            results.push({ coll: op.coll, id: op.id, v: cur.version, pos: op.pos !== undefined ? op.pos : cur.pos, unchanged: true });
          } else if (cur.version !== op.base) {
            conflicts.push(conflictOf(op, cur, 'changed'));
          } else {
            const v = cur.version + 1;
            this.q.update.run(json, v, op.pos !== undefined ? op.pos : null, seq, at, uid, uname, op.coll, op.id);
            results.push({ coll: op.coll, id: op.id, v, pos: op.pos !== undefined ? op.pos : cur.pos }); changes.push([op.coll, op.id, 'update', v, label]);
          }
          continue;
        }
        // del
        if (!cur || cur.deleted) { results.push({ coll: op.coll, id: op.id, v: cur ? cur.version : 0, deleted: true, unchanged: true }); continue; }
        if (cur.version !== op.base) { conflicts.push(conflictOf(op, cur, 'changed')); continue; }
        const v = cur.version + 1;
        this.q.tomb.run(v, seq, at, uid, uname, op.coll, op.id);
        results.push({ coll: op.coll, id: op.id, v, deleted: true });
        changes.push([op.coll, op.id, 'delete', v, schema.recordLabel(op.coll, safeParse(cur.data)).slice(0, 200)]);
      }
      if (conflicts.length) { db.exec('ROLLBACK'); return { ok: false, kind: 'conflict', conflicts }; }
      // records that belong to a project need that project to exist when the whole batch is applied
      const orphans = [];
      for (const op of batch.ops) {
        if (op.type !== 'put' || !schema.PROJECT_CHILDREN.includes(op.coll)) continue;
        if (!this.q.alive.get('projects', op.data.projectId)) orphans.push({ coll: op.coll, id: op.id, projectId: op.data.projectId, data: op.data });
      }
      if (orphans.length) {
        db.exec('ROLLBACK');
        return { ok: false, kind: 'missing-parent', message: `${orphans.length === 1 ? 'A change refers' : orphans.length + ' changes refer'} to a project that no longer exists (it was deleted by someone else).`, keys: orphans };
      }
      const result = { ok: true, seq, at, epoch: this.epoch(), by: { id: uid, name: uname }, results };
      for (const c of changes) this.q.addChange.run(seq, c[0], c[1], c[2], c[3], c[4], at, uid, uname);
      this.q.addBatch.run(seq, batch.opId, at, uid, uname, batch.ops.length, JSON.stringify(result));
      db.exec('COMMIT');
      return result;
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
      throw e;
    }
  }

  /* Records as they are now, for clients that receive a committed batch (live updates). */
  recordsOf(results) {
    return results.map(r => {
      const cur = this.q.get.get(r.coll, r.id);
      if (!cur) return null;
      return cur.deleted ? { coll: r.coll, id: r.id, v: cur.version, deleted: true } : { coll: r.coll, id: r.id, v: cur.version, pos: cur.pos, data: JSON.parse(cur.data) };
    }).filter(Boolean);
  }

  getUserState(userId) { const r = this.q.getState.get(String(userId)); return r ? { data: JSON.parse(r.data), updatedAt: r.updated_at } : { data: null, updatedAt: null }; }
  setUserState(userId, data) {
    const json = JSON.stringify(data == null ? {} : data);
    if (json.length > 8 * 1024 * 1024) throw new StoreError('TOO_LARGE', 'Personal settings are too large.');
    const at = nowISO(); this.q.setState.run(String(userId), json, at); return { updatedAt: at };
  }

  audit(limit = 50, coll = null, id = null) {
    const n = Math.max(1, Math.min(500, Number(limit) || 50));
    return (coll && id ? this.q.auditRec.all(coll, id, n) : this.q.audit.all(n)).map(r => ({ seq: r.seq, coll: r.coll, id: r.id, action: r.action, version: r.version, label: r.label, at: r.at, userId: r.user_id, userName: r.user_name }));
  }

  rename(name) { const n = String(name || '').trim().slice(0, 120); if (!n) throw new StoreError('INVALID', 'Enter a workspace name.'); this.setMeta('workspace_name', n); return n; }

  setBackupSettings({ dir, everyHours, keep }) {
    if (dir !== undefined) { if (dir) this.setMeta('backup_dir', dir); else this.db.prepare("DELETE FROM meta WHERE key = 'backup_dir'").run(); }
    if (everyHours !== undefined) { const h = Number(everyHours); if (!(h >= 0 && h <= 24 * 31)) throw new StoreError('INVALID', 'Choose how often to back up.'); this.setMeta('backup_every_hours', h); }
    if (keep !== undefined) { const k = parseInt(keep, 10); if (!(k >= 1 && k <= 1000)) throw new StoreError('INVALID', 'Keep between 1 and 1000 backups.'); this.setMeta('backup_keep', k); }
  }

  /* Consistent online backup to `file` (written to a temporary local file first, checked, then copied). */
  backupTo(file, { reason = 'manual' } = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlace-bk-'));
    const tmp = path.join(tmpDir, 'backup.db');
    try {
      this.db.prepare('VACUUM INTO ?').run(tmp);
      const b = openDb(tmp);
      try {
        const set = b.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        set.run('backup_taken_at', nowISO()); set.run('backup_reason', reason); set.run('backup_seq', String(this.seq()));
        b.exec('PRAGMA journal_mode = DELETE');
      } finally { b.close(); }
      const check = Store.inspectBackup(tmp);
      if (!check.ok) throw new StoreError('BACKUP_INVALID', 'The backup copy could not be verified: ' + check.message);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const part = file + '.partial';
      fs.copyFileSync(tmp, part);
      if (sha256(part) !== sha256(tmp)) { try { fs.unlinkSync(part); } catch (_) { /* ignore */ } throw new StoreError('BACKUP_COPY', 'The backup file was not copied correctly to ' + path.dirname(file)); }
      fs.renameSync(part, file);
      const at = nowISO();
      if (!this.readOnly) { this.setMeta('last_backup_at', at); this.setMeta('last_backup_file', file); this.db.prepare("DELETE FROM meta WHERE key = 'last_backup_error'").run(); }
      return { file, at, size: fs.statSync(file).size, counts: check.counts };
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    }
  }

  /* Checks a backup file without changing it: integrity, format, workspace and contents. */
  static inspectBackup(file) {
    let db;
    try {
      if (!fs.existsSync(file)) return { ok: false, message: 'The file does not exist.' };
      // work on a temporary copy so the original is never touched (no -wal / -shm files next to it)
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlace-chk-'));
      const tmp = path.join(tmpDir, 'check.db');
      try {
        fs.copyFileSync(file, tmp);
        db = openDb(tmp, { readOnly: true });
        const ic = db.prepare('PRAGMA integrity_check').all().map(r => Object.values(r)[0]);
        if (ic.length !== 1 || ic[0] !== 'ok') return { ok: false, message: 'The database is damaged (' + ic.slice(0, 3).join('; ') + ').' };
        const v = db.prepare('PRAGMA user_version').get().user_version;
        const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name));
        if (!v || !['meta', 'records', 'batches'].every(t => tables.has(t))) return { ok: false, message: 'This file is not a Flowlace workspace backup.' };
        const meta = {}; for (const r of db.prepare('SELECT key, value FROM meta').all()) meta[r.key] = r.value;
        if (meta.format !== FORMAT || !meta.workspace_id) return { ok: false, message: 'This file is not a Flowlace workspace backup.' };
        if (v > SCHEMA_VERSION) return { ok: false, message: `The backup was made by a newer version of Flowlace (database version ${v}).` };
        const counts = {}; for (const r of db.prepare('SELECT coll, COUNT(*) AS n FROM records WHERE deleted = 0 GROUP BY coll').all()) counts[r.coll] = r.n;
        // every record must be readable JSON
        let bad = 0; for (const r of db.prepare('SELECT data FROM records WHERE deleted = 0').iterate()) { try { JSON.parse(r.data); } catch (_) { bad++; } }
        if (bad) return { ok: false, message: `${bad} records in the backup can't be read.` };
        return { ok: true, workspaceId: meta.workspace_id, workspaceName: meta.workspace_name, schemaVersion: v, takenAt: meta.backup_taken_at || null,
          seq: parseInt(meta.backup_seq || '0', 10) || db.prepare('SELECT COALESCE(MAX(seq),0) AS s FROM batches').get().s, counts, size: fs.statSync(file).size };
      } finally {
        if (db) { try { db.close(); } catch (_) { /* ignore */ } }
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
      }
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }
}

/* Replaces the database at `dbFile` with a backup. The caller must have closed every connection to it (exclusive
   access): in the desktop app the main process owns the only one; in Flowlace Server the service does.
   Before anything changes, the current database is copied to `preRestoreFile`. Returns the reopened Store. */
function restoreDatabase(store, backupFile, preRestoreFile, { allowOtherWorkspace = false } = {}) {
  const check = Store.inspectBackup(backupFile);
  if (!check.ok) throw new StoreError('BACKUP_INVALID', 'This backup can’t be restored: ' + check.message);
  const wsId = store.meta('workspace_id'), wsName = store.meta('workspace_name');
  if (check.workspaceId !== wsId && !allowOtherWorkspace) throw new StoreError('OTHER_WORKSPACE', `This backup belongs to another workspace (“${check.workspaceName}”). Open or create that workspace instead.`);
  const dbFile = store.file, prevEpoch = store.epoch();
  const pre = store.backupTo(preRestoreFile, { reason: 'before-restore' });
  store.close();
  const staging = dbFile + '.restoring';
  fs.copyFileSync(backupFile, staging);
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(dbFile + ext); } catch (_) { /* ignore */ } }
  fs.renameSync(staging, dbFile);
  const s = new Store(dbFile);
  s.setMeta('epoch', prevEpoch + 1);              // clients see a new epoch and reload everything
  s.setMeta('workspace_name', wsName);
  s.setMeta('last_restore_at', nowISO());
  s.setMeta('last_restore_from', path.basename(backupFile));
  for (const k of ['backup_taken_at', 'backup_reason', 'backup_seq']) s.db.prepare('DELETE FROM meta WHERE key = ?').run(k);
  return { store: s, preRestore: pre, restored: check };
}

function conflictOf(op, cur, reason) {
  return { coll: op.coll, id: op.id, base: op.base, type: op.type, reason,
    current: cur ? { v: cur.version, deleted: !!cur.deleted, data: cur.deleted ? null : safeParse(cur.data), updatedAt: cur.updated_at, updatedBy: cur.updated_by_name || cur.updated_by || null } : null };
}
function safeParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }
function sha256(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
function stamp(d = new Date()) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }

module.exports = { Store, StoreError, restoreDatabase, SCHEMA_VERSION, FORMAT, newId, stamp, nowISO };
