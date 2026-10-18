'use strict';
/* Helpers for end-to-end tests: start the real Electron app (Xvfb on Linux) with its own profile folder and
   answer the Windows dialogs (folder / file pickers) from the test. */
const { _electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = process.env.FLOWLACE_SHOTS || path.join(os.tmpdir(), 'flowlace-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p || 'ms-'));

async function launch(userData, { env = {} } = {}) {
  const app = await _electron.launch({ executablePath: require('electron'), args: [ROOT], env: Object.assign({}, process.env, { FLOWLACE_USER_DATA: userData }, env) });
  const w = await app.firstWindow();
  w.errors = [];
  w.on('pageerror', e => { w.errors.push(e.stack || e.message); console.log('  [pageerror]', e.stack || e.message); });
  w.on('console', m => { if (m.type() === 'error' && !/frame-ancestors/.test(m.text())) console.log('  [console]', m.text()); });
  await w.waitForLoadState('domcontentloaded');
  module.exports.lastWindow = w;
  return { app, w };
}

/* Next folder / file chosen in a dialog */
async function answerDialogs(app, { folder, file, savePath } = {}) {
  await app.evaluate(({ dialog }, a) => {
    dialog.showOpenDialog = async (_w, o) => {
      const opts = o || _w;
      const isDir = (opts.properties || []).includes('openDirectory');
      const p = isDir ? a.folder : a.file;
      return p ? { canceled: false, filePaths: [p] } : { canceled: true, filePaths: [] };
    };
    dialog.showSaveDialog = async () => a.savePath ? { canceled: false, filePath: a.savePath } : { canceled: true };
  }, { folder, file, savePath });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000, what = 'condition') {
  const t0 = Date.now();
  for (;;) { let v; try { v = await fn(); } catch (_) { v = false; } if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout waiting for ' + what); await sleep(100); }
}
/* the app's state is private; read it through what is rendered or through the main-process store */
const appReady = w => until(() => w.evaluate(() => !!document.querySelector('#top .nav') && document.getElementById('ms-start').hidden), 15000, 'app ready');
const saved = w => until(() => w.evaluate(() => { const el = document.getElementById('save-ind'); return el && /Saved|All changes saved/.test(el.textContent); }), 10000, 'saved');
async function shot(w, name) { await w.screenshot({ path: path.join(SHOTS, name + '.png') }); }

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; try { if (module.exports.lastWindow) await module.exports.lastWindow.screenshot({ path: path.join(SHOTS, 'FAIL-' + name.replace(/[^a-z0-9]+/gi, '-').slice(0, 60) + '.png') }); } catch (_) { /* ignore */ } console.log('  ✗ ' + name + '\n     ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
}
function summary(label) { console.log(`${label}: ${passed} passed, ${failed} failed`); return failed; }

module.exports = { launch, answerDialogs, until, sleep, appReady, saved, shot, step, summary, tmp, assert, ROOT, SHOTS };
