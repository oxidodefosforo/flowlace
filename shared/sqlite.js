'use strict';
/* SQLite access through the engine built into Node.js / Electron (node:sqlite). No native add-on is needed,
   so the same code runs in the desktop app, in Flowlace Server and in the tests on any platform. */
let warned = false;
function quietExperimentalWarning() {
  if (warned) return; warned = true;
  // node:sqlite is still flagged "experimental" in Node 22/24 and prints a warning on first use; keep other warnings.
  const listeners = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', w => {
    if (w && w.name === 'ExperimentalWarning' && /SQLite/i.test(String(w.message))) return;
    if (listeners.length) listeners.forEach(l => l(w)); else console.warn(w && w.stack || String(w));
  });
}
function sqlite() {
  quietExperimentalWarning();
  return require('node:sqlite');
}
function openDb(file, { readOnly = false } = {}) {
  const { DatabaseSync } = sqlite();
  const db = new DatabaseSync(file, { readOnly });
  db.exec('PRAGMA busy_timeout = 8000');
  return db;
}
/* Single-quoted SQL string literal (for VACUUM INTO, which doesn't accept bound parameters in every version). */
function sqlString(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
module.exports = { openDb, sqlString, sqlite };
