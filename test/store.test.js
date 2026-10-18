'use strict';
/* Store: versions, conflicts, idempotent retries, transactions, change feed, backups and restore. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store, restoreDatabase } = require('../shared/store');
const WF = require('../shared/workspace-folder');
const B = require('../shared/backups');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ms-test-'));
let n = 0; const op = () => 'op' + Date.now().toString(36) + (n++) + 'abcdefgh';
const A = { id: 'u-a', name: 'Ana', role: 'admin' }, M = { id: 'u-m', name: 'Mario', role: 'member' };
const proj = (id, name) => ({ id, name, code: 'C-' + id });
const task = (id, pid, name) => ({ id, projectId: pid, name });

test('create, reopen and persistence', () => {
  const dir = tmp();
  let s = WF.createWorkspace(dir, 'Test WS');
  const id = s.meta('workspace_id');
  const r = s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 0, data: proj('p1', 'One') }] }, A);
  assert.ok(r.ok); assert.strictEqual(r.results[0].v, 1);
  s.close();
  assert.throws(() => WF.createWorkspace(dir, 'again'), /already contains/);
  s = WF.openWorkspace(dir, { expectedId: id });
  const snap = s.snapshot();
  assert.strictEqual(snap.records.length, 1);
  assert.strictEqual(snap.records[0].data.name, 'One');
  s.close();
});

test('opening never creates an empty database', () => {
  const dir = tmp();
  assert.throws(() => WF.openWorkspace(path.join(dir, 'missing')), e => e.code === 'FOLDER_MISSING');
  assert.throws(() => WF.openWorkspace(dir), e => e.code === 'NO_WORKSPACE');
  const s = WF.createWorkspace(dir, 'X'); s.close();
  fs.unlinkSync(path.join(dir, 'flowlace.db'));
  assert.throws(() => WF.openWorkspace(dir), e => e.code === 'DB_MISSING');
  assert.ok(!fs.existsSync(path.join(dir, 'flowlace.db')));
});

test('version conflict is detected and nothing is applied', () => {
  const s = WF.createWorkspace(tmp(), 'C');
  s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 0, data: proj('p1', 'P') }, { type: 'put', coll: 'tasks', id: 't1', base: 0, data: task('t1', 'p1', 'Draw') }] }, A);
  const a = s.commit({ opId: op(), ops: [{ type: 'put', coll: 'tasks', id: 't1', base: 1, data: { ...task('t1', 'p1', 'Draw'), status: 'Done' } }] }, A);
  assert.ok(a.ok);
  // B edits from version 1 too, together with another record: whole batch rejected
  const b = s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 1, data: proj('p1', 'Renamed') }, { type: 'put', coll: 'tasks', id: 't1', base: 1, data: { ...task('t1', 'p1', 'Draw'), status: 'QA' } }] }, M);
  assert.strictEqual(b.ok, false); assert.strictEqual(b.kind, 'conflict');
  assert.strictEqual(b.conflicts.length, 1);
  assert.strictEqual(b.conflicts[0].current.data.status, 'Done');
  assert.strictEqual(b.conflicts[0].current.updatedBy, 'Ana');
  assert.strictEqual(s.snapshot().records.find(r => r.id === 'p1').data.name, 'P', 'transaction rolled back');
  // same content from an old version is not a conflict
  const c = s.commit({ opId: op(), ops: [{ type: 'put', coll: 'tasks', id: 't1', base: 1, data: { ...task('t1', 'p1', 'Draw'), status: 'Done' } }] }, M);
  assert.ok(c.ok); assert.ok(c.results[0].unchanged);
  // after review, saving on top of the current version works
  const d = s.commit({ opId: op(), ops: [{ type: 'put', coll: 'tasks', id: 't1', base: 2, data: { ...task('t1', 'p1', 'Draw'), status: 'QA' } }] }, M);
  assert.ok(d.ok); assert.strictEqual(d.results[0].v, 3);
  s.close();
});

test('retry with the same operation id is applied once', () => {
  const s = WF.createWorkspace(tmp(), 'R');
  const b = { opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 0, data: proj('p1', 'P') }] };
  const r1 = s.commit(b, A), r2 = s.commit(b, A);
  assert.ok(r1.ok && r2.ok && r2.replayed);
  assert.strictEqual(r1.seq, r2.seq);
  assert.strictEqual(s.seq(), 1);
  s.close();
});

test('validation, roles and missing parents', () => {
  const s = WF.createWorkspace(tmp(), 'V');
  assert.strictEqual(s.commit({ opId: op(), ops: [{ type: 'put', coll: 'nope', id: 'x', base: 0, data: {} }] }, A).kind, 'invalid');
  assert.strictEqual(s.commit({ opId: op(), ops: [{ type: 'put', coll: 'tasks', id: 'x', base: 0, data: { id: 'y', projectId: 'p', name: 'n' } }] }, A).kind, 'invalid');
  assert.strictEqual(s.commit({ opId: op(), ops: [{ type: 'put', coll: 'phases', id: 'ph1', base: 0, data: { id: 'ph1', name: 'Fee' } }] }, M, { enforceRoles: true }).kind, 'forbidden');
  assert.ok(s.commit({ opId: op(), ops: [{ type: 'put', coll: 'phases', id: 'ph1', base: 0, data: { id: 'ph1', name: 'Fee' } }] }, A, { enforceRoles: true }).ok);
  const r = s.commit({ opId: op(), ops: [{ type: 'put', coll: 'tasks', id: 't9', base: 0, data: task('t9', 'gone', 'x') }] }, M);
  assert.strictEqual(r.kind, 'missing-parent');
  s.close();
});

test('delete, tombstone, restore by undo and change feed', () => {
  const s = WF.createWorkspace(tmp(), 'D');
  s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 0, data: proj('p1', 'P') }] }, A);
  const seq1 = s.seq();
  const d = s.commit({ opId: op(), ops: [{ type: 'del', coll: 'projects', id: 'p1', base: 1 }] }, A);
  assert.ok(d.ok); assert.strictEqual(d.results[0].v, 2);
  const ch = s.changesSince(seq1);
  assert.deepStrictEqual(ch.records.map(r => [r.id, r.deleted]), [['p1', true]]);
  assert.strictEqual(s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 0, data: proj('p1', 'P') }] }, A).kind, 'conflict');
  assert.ok(s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 2, data: proj('p1', 'P') }] }, A).ok);
  assert.deepStrictEqual(s.audit(10).map(a => a.action), ['restore', 'delete', 'create']);
  s.close();
});

test('order of records is kept with positions', () => {
  const s = WF.createWorkspace(tmp(), 'O');
  s.commit({ opId: op(), ops: ['a', 'b', 'c'].map(id => ({ type: 'put', coll: 'phases', id, base: 0, data: { id, name: id } })) }, A);
  assert.deepStrictEqual(s.snapshot().records.map(r => r.id), ['a', 'b', 'c']);
  s.commit({ opId: op(), ops: [{ type: 'move', coll: 'phases', id: 'c', pos: -5 }] }, A);
  assert.deepStrictEqual(s.snapshot().records.map(r => r.id), ['c', 'a', 'b']);
  s.close();
});

test('backup, inspection and restore with a copy made first', () => {
  const dir = tmp();
  let s = WF.createWorkspace(dir, 'Bk');
  s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 0, data: proj('p1', 'Before') }] }, A);
  const bdir = path.join(dir, 'backups');
  const r = B.runBackup(s, bdir, 'manual');
  assert.ok(r.ok, r.message);
  const info = B.inspect(r.file);
  assert.ok(info.ok); assert.strictEqual(info.counts.projects, 1); assert.strictEqual(info.workspaceId, s.meta('workspace_id'));
  s.commit({ opId: op(), ops: [{ type: 'put', coll: 'projects', id: 'p1', base: 1, data: proj('p1', 'After') }, { type: 'put', coll: 'projects', id: 'p2', base: 0, data: proj('p2', 'New') }] }, A);
  const epoch = s.epoch();
  const res = restoreDatabase(s, r.file, path.join(bdir, B.preRestoreName(s)));
  s = res.store;
  assert.strictEqual(s.epoch(), epoch + 1);
  assert.deepStrictEqual(s.snapshot().records.map(x => x.data.name), ['Before']);
  const pre = B.inspect(res.preRestore.file);
  assert.ok(pre.ok); assert.strictEqual(pre.counts.projects, 2, 'pre-restore copy has the newer data');
  // a damaged file is refused and nothing changes
  const bad = path.join(dir, 'bad.db'); fs.writeFileSync(bad, 'not a database');
  assert.throws(() => restoreDatabase(s, bad, path.join(bdir, 'x.db')), /can’t be restored/);
  assert.strictEqual(s.snapshot().records.length, 1);
  // another workspace's backup is refused
  const other = WF.createWorkspace(tmp(), 'Other'); const ob = B.runBackup(other, path.join(tmp(), 'b'), 'manual'); other.close();
  assert.throws(() => restoreDatabase(s, ob.file, path.join(bdir, 'y.db')), /another workspace/);
  s.close();
});

test('retention keeps the newest backups', () => {
  const dir = tmp(); const s = WF.createWorkspace(dir, 'Ret'); s.setBackupSettings({ keep: 2 });
  const bdir = path.join(dir, 'backups');
  for (let i = 0; i < 4; i++) { const f = path.join(bdir, `flowlace-backup-ret-${s.meta('workspace_id').slice(-6)}-2026010${i}-000000.db`); s.backupTo(f); fs.utimesSync(f, new Date(2026, 0, i + 1), new Date(2026, 0, i + 1)); }
  B.applyRetention(bdir, s);
  assert.strictEqual(B.listBackups(bdir, s).length, 2);
  s.close();
});

test('lock: a second program cannot open the same workspace', () => {
  const dir = tmp(); WF.createWorkspace(dir, 'L').close();
  const rel = WF.acquireLock(dir, 'Test');
  fs.writeFileSync(path.join(dir, WF.LOCK), JSON.stringify({ pid: 1, host: 'OTHER-PC', user: 'x', app: 'Flowlace', at: new Date().toISOString() }));
  assert.throws(() => WF.acquireLock(dir, 'Test'), e => e.code === 'LOCKED');
  fs.writeFileSync(path.join(dir, WF.LOCK), JSON.stringify({ pid: 999999, host: os.hostname(), app: 'Flowlace' }));
  const rel2 = WF.acquireLock(dir, 'Test'); rel2(); rel();
  assert.ok(WF.isUncPath('\\\\server\\share\\x')); assert.ok(!WF.isUncPath('C:\\Users\\x'));
});
