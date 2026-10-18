'use strict';
/* Backup files of a workspace: names, listing, retention and the automatic schedule.
   Used by the desktop app (Local workspaces) and by Flowlace Server (Company workspaces). */
const fs = require('fs');
const path = require('path');
const { Store, stamp } = require('./store');

const PREFIX = 'flowlace-backup-';
const PRE_RESTORE = 'flowlace-before-restore-';

function slug(s) { return String(s || 'workspace').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'workspace'; }
function backupName(store, reason) { return `${PREFIX}${slug(store.meta('workspace_name'))}-${store.meta('workspace_id').slice(-6)}-${stamp()}${reason === 'auto' ? '-auto' : ''}.db`; }
function preRestoreName(store) { return `${PRE_RESTORE}${slug(store.meta('workspace_name'))}-${store.meta('workspace_id').slice(-6)}-${stamp()}.db`; }

function backupDirOf(store, defaultDir) { return store.meta('backup_dir') || defaultDir; }

function listBackups(dir, store) {
  if (!dir || !fs.existsSync(dir)) return [];
  const tag = store ? '-' + store.meta('workspace_id').slice(-6) + '-' : null;
  return fs.readdirSync(dir)
    .filter(f => (f.startsWith(PREFIX) || f.startsWith(PRE_RESTORE)) && f.endsWith('.db') && (!tag || f.includes(tag)))
    .map(f => { const st = fs.statSync(path.join(dir, f)); return { name: f, file: path.join(dir, f), size: st.size, at: st.mtime.toISOString(), kind: f.startsWith(PRE_RESTORE) ? 'before-restore' : (f.endsWith('-auto.db') ? 'automatic' : 'manual') }; })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/* Keeps the newest `keep` regular backups (manual + automatic). Copies made before a restore are never removed automatically. */
function applyRetention(dir, store) {
  const keep = parseInt(store.meta('backup_keep') || '14', 10) || 14;
  const regular = listBackups(dir, store).filter(b => b.kind !== 'before-restore');
  const removed = [];
  for (const b of regular.slice(keep)) { try { fs.unlinkSync(b.file); removed.push(b.name); } catch (_) { /* ignore */ } }
  return removed;
}

function runBackup(store, dir, reason = 'manual') {
  try {
    if (!dir) throw new Error('No backup folder is set.');
    fs.mkdirSync(dir, { recursive: true });
    const r = store.backupTo(path.join(dir, backupName(store, reason)), { reason });
    r.removed = applyRetention(dir, store);
    return Object.assign({ ok: true }, r);
  } catch (e) {
    try { store.setMeta('last_backup_error', `${new Date().toISOString()} ${e.message}`); } catch (_) { /* ignore */ }
    return { ok: false, message: e.message };
  }
}

function backupDue(store) {
  const h = parseFloat(store.meta('backup_every_hours') || '24');
  if (!(h > 0)) return false;
  const last = store.meta('last_backup_at');
  return !last || (Date.now() - Date.parse(last)) >= h * 3600e3;
}

/* Checks every few minutes and backs up when the interval has passed. getStore() may return null (closed). */
function startScheduler(getStore, getDir, onResult, everyMs = 5 * 60e3) {
  const tick = () => {
    const s = getStore(); if (!s || !s.db) return;
    try { if (backupDue(s)) { const r = runBackup(s, getDir(s), 'auto'); if (onResult) onResult(r); } } catch (e) { if (onResult) onResult({ ok: false, message: e.message }); }
  };
  const first = setTimeout(tick, 15e3);
  const t = setInterval(tick, everyMs);
  if (t.unref) { t.unref(); first.unref(); }
  return () => { clearInterval(t); clearTimeout(first); };
}

module.exports = { listBackups, applyRetention, runBackup, backupDue, startScheduler, backupDirOf, preRestoreName, inspect: f => Store.inspectBackup(f), PREFIX };
