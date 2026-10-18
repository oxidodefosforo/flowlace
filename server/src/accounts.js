'use strict';
/* Flowlace Server accounts database (server.db in the data folder): users, sessions, the list of workspaces
   and a log of administrative actions. Project data is never stored here — each workspace has its own database. */
const crypto = require('crypto');
const { openDb } = require('../../shared/sqlite');

const SCHEMA = 1;
const ROLES = ['admin', 'member'];
const USER_RE = /^[a-z0-9._@-]{2,64}$/;

function hashPassword(pw, salt = crypto.randomBytes(16)) {
  const h = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { hash: h.toString('base64'), salt: salt.toString('base64') };
}
function checkPassword(pw, hash, salt) {
  const h = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const a = Buffer.from(hash, 'base64');
  return a.length === h.length && crypto.timingSafeEqual(a, h);
}
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Use a password of at least 10 characters.';
  if (pw.length > 200) return 'The password is too long.';
  return null;
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();

class Accounts {
  constructor(file) {
    this.db = openDb(file);
    this.db.exec('PRAGMA journal_mode = WAL'); this.db.exec('PRAGMA synchronous = FULL');
    const v = this.db.prepare('PRAGMA user_version').get().user_version;
    if (v > SCHEMA) throw new Error('server.db was created by a newer Flowlace Server. Update the server.');
    if (v < 1) {
      this.db.exec(`BEGIN;
        CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL,
          pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT);
        CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
          expires_at TEXT NOT NULL, client TEXT);
        CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT, archived INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE admin_log (at TEXT NOT NULL, user_id TEXT, user_name TEXT, action TEXT NOT NULL, detail TEXT);
        PRAGMA user_version = 1; COMMIT;`);
    }
  }
  close() { try { this.db.close(); } catch (_) { /* ignore */ } }

  log(user, action, detail) { this.db.prepare('INSERT INTO admin_log (at, user_id, user_name, action, detail) VALUES (?, ?, ?, ?, ?)').run(now(), user ? user.id : null, user ? user.name : 'server', action, detail ? String(detail).slice(0, 1000) : null); }
  adminLog(limit = 100) { return this.db.prepare('SELECT at, user_name AS userName, action, detail FROM admin_log ORDER BY rowid DESC LIMIT ?').all(Math.min(500, limit)); }

  /* users */
  pub(u) { return u ? { id: u.id, username: u.username, name: u.display_name, role: u.role, active: !!u.active, mustChange: !!u.must_change, createdAt: u.created_at, lastLoginAt: u.last_login_at } : null; }
  userById(id) { return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id); }
  userByName(n) { return this.db.prepare('SELECT * FROM users WHERE username = ?').get(String(n || '').trim().toLowerCase()); }
  listUsers() { return this.db.prepare('SELECT * FROM users ORDER BY display_name COLLATE NOCASE').all().map(u => this.pub(u)); }
  countAdmins() { return this.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n; }

  createUser({ username, name, role = 'member', password, mustChange = false }) {
    const un = String(username || '').trim().toLowerCase();
    if (!USER_RE.test(un)) throw httpErr(400, 'User names use 2–64 lowercase letters, digits and . _ @ -');
    if (!ROLES.includes(role)) throw httpErr(400, 'Role must be admin or member.');
    const pp = passwordProblem(password); if (pp) throw httpErr(400, pp);
    if (this.userByName(un)) throw httpErr(409, `The user name “${un}” is already used.`);
    const id = 'u-' + crypto.randomBytes(8).toString('hex');
    const { hash, salt } = hashPassword(password);
    const t = now();
    this.db.prepare('INSERT INTO users (id, username, display_name, role, pass_hash, pass_salt, active, must_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')
      .run(id, un, String(name || un).trim().slice(0, 80) || un, role, hash, salt, mustChange ? 1 : 0, t, t);
    return this.pub(this.userById(id));
  }

  updateUser(id, { name, role, active, password, mustChange }) {
    const u = this.userById(id); if (!u) throw httpErr(404, 'User not found.');
    if (role !== undefined && !ROLES.includes(role)) throw httpErr(400, 'Role must be admin or member.');
    const losingAdmin = u.role === 'admin' && u.active && ((role !== undefined && role !== 'admin') || active === false);
    if (losingAdmin && this.countAdmins() <= 1) throw httpErr(409, 'There must be at least one active administrator.');
    const t = now();
    if (name !== undefined) this.db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(String(name).trim().slice(0, 80) || u.username, t, id);
    if (role !== undefined) this.db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, t, id);
    if (active !== undefined) { this.db.prepare('UPDATE users SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, t, id); if (!active) this.dropSessions(id); }
    if (password !== undefined) {
      const pp = passwordProblem(password); if (pp) throw httpErr(400, pp);
      const { hash, salt } = hashPassword(password);
      this.db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, must_change = ?, updated_at = ? WHERE id = ?').run(hash, salt, mustChange ? 1 : 0, t, id);
    }
    return this.pub(this.userById(id));
  }

  /* sessions */
  login(username, password, client, hours) {
    const u = this.userByName(username);
    // always spend the same time hashing, whether or not the user exists
    const ok = u ? checkPassword(password, u.pass_hash, u.pass_salt) : (checkPassword(password, 'AAAA', 'AAAAAAAAAAAAAAAAAAAAAA=='), false);
    if (!ok || !u.active) return null;
    const token = crypto.randomBytes(32).toString('base64url');
    const t = new Date(), exp = new Date(t.getTime() + hours * 3600e3);
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at, client) VALUES (?, ?, ?, ?, ?, ?)').run(sha(token), u.id, t.toISOString(), t.toISOString(), exp.toISOString(), String(client || '').slice(0, 120));
    this.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(t.toISOString(), u.id);
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t.toISOString());
    return { token, user: this.pub(u), expiresAt: exp.toISOString() };
  }
  /* Sliding expiry: each use extends the session up to `hours` from now, never beyond 30 days after sign-in. */
  session(token, hours) {
    if (!token) return null;
    const s = this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha(token));
    if (!s) return null;
    const t = Date.now();
    if (Date.parse(s.expires_at) < t) { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(s.token_hash); return null; }
    const u = this.userById(s.user_id);
    if (!u || !u.active) return null;
    if (t - Date.parse(s.last_seen_at) > 60e3) {
      const exp = Math.min(t + hours * 3600e3, Date.parse(s.created_at) + 30 * 24 * 3600e3);
      this.db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?').run(new Date(t).toISOString(), new Date(exp).toISOString(), s.token_hash);
    }
    return { user: this.pub(u), tokenHash: s.token_hash };
  }
  verifyPassword(userId, pw) { const u = this.userById(userId); return !!u && checkPassword(pw, u.pass_hash, u.pass_salt); }
  logout(token) { if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token)); }
  dropSessions(userId) { this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }

  /* workspace registry */
  listWorkspaces() { return this.db.prepare('SELECT id, name, folder, created_at AS createdAt, archived FROM workspaces WHERE archived = 0 ORDER BY name COLLATE NOCASE').all(); }
  workspace(id) { return this.db.prepare('SELECT id, name, folder, created_at AS createdAt, archived FROM workspaces WHERE id = ?').get(id); }
  addWorkspace(id, name, folder, by) { this.db.prepare('INSERT INTO workspaces (id, name, folder, created_at, created_by) VALUES (?, ?, ?, ?, ?)').run(id, name, folder, now(), by || null); }
  renameWorkspace(id, name) { this.db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name, id); }
}

function httpErr(status, message, extra) { const e = new Error(message); e.status = status; Object.assign(e, extra || {}); return e; }

module.exports = { Accounts, httpErr, passwordProblem, ROLES };
