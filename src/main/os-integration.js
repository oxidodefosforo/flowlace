'use strict';
/* Operating-system functions the interface may use, each through a narrow IPC call: Windows folder and file pickers,
   opening a folder in Explorer, opening web links in the default browser, and per-workspace pending changes. */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { dialog, shell } = require('electron');

/* Paths chosen in a dialog are kept here; the interface only receives a reference and the text to show. */
const picked = new Map();
let seq = 0;
function remember(p) { const ref = 'pick-' + (++seq); picked.set(ref, p); if (picked.size > 50) picked.delete(picked.keys().next().value); return ref; }
function resolveRef(ref) { const p = picked.get(ref); if (!p) { const e = new Error('Choose the folder or file again.'); e.code = 'INVALID'; throw e; } return p; }

async function chooseFolder(win, { title, defaultPath, buttonLabel } = {}) {
  const r = await dialog.showOpenDialog(win, { title, defaultPath, buttonLabel, properties: ['openDirectory', 'createDirectory', 'promptToCreate'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, kind: 'cancelled' };
  return { ok: true, ref: remember(r.filePaths[0]), path: r.filePaths[0] };
}

async function chooseFile(win, { title, filters, defaultPath } = {}) {
  const r = await dialog.showOpenDialog(win, { title, defaultPath, filters, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, kind: 'cancelled' };
  return { ok: true, ref: remember(r.filePaths[0]), path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
}

/* Reads a JSON file chosen by the user (the file itself is never changed). */
async function openJSON(win, title) {
  const r = await dialog.showOpenDialog(win, { title: title || 'Choose a Flowlace JSON export', filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'All files', extensions: ['*'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, kind: 'cancelled' };
  const f = r.filePaths[0], st = fs.statSync(f);
  if (st.size > 200 * 1024 * 1024) return { ok: false, kind: 'invalid', message: 'The file is larger than 200 MB; it is not a Flowlace export.' };
  return { ok: true, name: path.basename(f), path: f, size: st.size, modifiedAt: st.mtime.toISOString(), text: fs.readFileSync(f, 'utf8').replace(/^﻿/, '') };
}

async function saveText(win, { suggestedName, text, title, filters }) {
  const r = await dialog.showSaveDialog(win, { title: title || 'Save', defaultPath: path.join(require('electron').app.getPath('documents'), String(suggestedName || 'flowlace-export.json').replace(/[<>:"/\\|?*]+/g, '-')), filters: filters || [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: false, kind: 'cancelled' };
  const tmp = r.filePath + '.tmp';
  fs.writeFileSync(tmp, String(text)); fs.renameSync(tmp, r.filePath);
  return { ok: true, path: r.filePath, name: path.basename(r.filePath) };
}

function openExternal(url) {
  let u; try { u = new URL(String(url)); } catch (_) { return { ok: false, message: 'Invalid link.' }; }
  if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return { ok: false, message: 'Only web and e-mail links can be opened.' };
  shell.openExternal(u.toString());
  return { ok: true };
}

async function showFolder(p) { if (!p || !fs.existsSync(p)) return { ok: false, message: 'The folder is not available.' }; const e = await shell.openPath(p); return e ? { ok: false, message: e } : { ok: true }; }

/* Windows: is this drive letter a network drive (DriveType 4)? Best effort; UNC paths are detected separately. */
function isNetworkDrive(p) {
  return new Promise(resolve => {
    const m = /^([a-zA-Z]):/.exec(String(p || ''));
    if (process.platform !== 'win32' || !m) return resolve(false);
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${m[1].toUpperCase()}:'").DriveType`], { timeout: 8000, windowsHide: true },
      (err, out) => resolve(!err && String(out).trim() === '4'));
  });
}

/* Changes not yet confirmed by the workspace (conflict, disconnection, error), kept per workspace in the user profile
   so they survive closing Flowlace. They are offered again — never applied silently — when the workspace reopens. */
class Pending {
  constructor(dir) { this.dir = path.join(dir, 'pending'); }
  file(wsId) { return path.join(this.dir, String(wsId).replace(/[^A-Za-z0-9_-]/g, '_') + '.json'); }
  save(wsId, data) {
    if (!wsId) return { ok: false };
    const s = JSON.stringify(data || null);
    if (s.length > 50 * 1024 * 1024) return { ok: false, message: 'Too many pending changes to keep.' };
    fs.mkdirSync(this.dir, { recursive: true });
    const f = this.file(wsId), tmp = f + '.tmp';
    if (!data) { try { fs.unlinkSync(f); } catch (_) { /* ignore */ } return { ok: true }; }
    fs.writeFileSync(tmp, s); fs.renameSync(tmp, f);
    return { ok: true };
  }
  load(wsId) { try { return { ok: true, data: JSON.parse(fs.readFileSync(this.file(wsId), 'utf8')) }; } catch (_) { return { ok: true, data: null }; } }
}

module.exports = { chooseFolder, chooseFile, openJSON, saveText, openExternal, showFolder, isNetworkDrive, resolveRef, Pending };
