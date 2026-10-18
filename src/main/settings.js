'use strict';
/* Desktop settings kept in the user profile (%APPDATA%\Flowlace\flowlace-settings.json): which workspace to open,
   recent workspaces and the window size. Never inside the installation folder, so updating or reinstalling keeps them.
   Server sign-in tokens are stored separately, encrypted with the Windows user account (Electron safeStorage / DPAPI). */
const fs = require('fs');
const path = require('path');

class Settings {
  constructor(dir, safeStorage) {
    this.dir = dir; this.safe = safeStorage;
    this.file = path.join(dir, 'flowlace-settings.json');
    this.credFile = path.join(dir, 'flowlace-credentials.json');
    this.data = { version: 1, current: null, recent: [], window: null, ui: {} };
    try { if (fs.existsSync(this.file)) this.data = Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (_) { try { fs.copyFileSync(this.file, this.file + '.damaged'); } catch (__) { /* ignore */ } }
  }
  save() {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
  get current() { return this.data.current; }
  setCurrent(entry) {
    this.data.current = entry ? Object.assign({}, entry) : null;
    if (entry) {
      const k = keyOf(entry);
      this.data.recent = [Object.assign({}, entry, { lastOpenedAt: new Date().toISOString() }), ...this.data.recent.filter(r => keyOf(r) !== k)].slice(0, 10);
    }
    this.save();
  }
  forget(entry) { const k = keyOf(entry); this.data.recent = this.data.recent.filter(r => keyOf(r) !== k); if (this.data.current && keyOf(this.data.current) === k) this.data.current = null; this.save(); }
  get recent() { return this.data.recent; }

  /* tokens */
  readCreds() { try { return JSON.parse(fs.readFileSync(this.credFile, 'utf8')); } catch (_) { return {}; } }
  getToken(url, username) {
    const c = this.readCreds()[credKey(url, username)];
    if (!c) return null;
    try { return c.enc && this.safe && this.safe.isEncryptionAvailable() ? this.safe.decryptString(Buffer.from(c.enc, 'base64')) : null; } catch (_) { return null; }
  }
  setToken(url, username, token) {
    const all = this.readCreds(), k = credKey(url, username);
    if (!token) delete all[k];
    else {
      if (!this.safe || !this.safe.isEncryptionAvailable()) { delete all[k]; }    // never store a token in plain text
      else all[k] = { enc: this.safe.encryptString(token).toString('base64'), at: new Date().toISOString() };
    }
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.credFile, JSON.stringify(all, null, 2));
  }
}
function keyOf(e) { return e.mode === 'company' ? `company|${normUrl(e.url)}|${e.workspaceId}` : `local|${String(e.folder || '').toLowerCase()}`; }
function credKey(url, username) { return normUrl(url) + '|' + String(username || '').toLowerCase(); }
function normUrl(u) { return String(u || '').trim().replace(/\/+$/, '').toLowerCase(); }

module.exports = { Settings, keyOf, normUrl };
