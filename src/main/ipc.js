'use strict';
/* The only bridge between the interface and the rest of the program. Each channel does one thing, checks its
   arguments and that the request comes from Flowlace's own page, and answers { ok, … } (errors are answers too). */
const { ipcMain, app } = require('electron');
const OS = require('./os-integration');
const { keyOf } = require('./settings');

const APP_ORIGIN = 'app://flowlace';

function register({ mgr, settings, getWindow, pending }) {
  const handle = (ch, fn) => ipcMain.handle(ch, async (e, arg) => {
    const url = e.senderFrame && e.senderFrame.url || '';
    if (!url.startsWith(APP_ORIGIN + '/')) return { ok: false, kind: 'forbidden', message: 'Not allowed.' };
    try { const r = await fn(arg && typeof arg === 'object' ? arg : {}, e); return r === undefined ? { ok: true } : r; }
    catch (err) { return { ok: false, kind: (err.code || 'error').toLowerCase(), code: err.code, message: err.message, movedTo: err.movedTo }; }
  });
  const b = () => { if (!mgr.backend) { const e = new Error('No workspace is open.'); e.code = 'NO_WORKSPACE'; throw e; } return mgr.backend; };
  const str = (v, max = 500) => typeof v === 'string' ? v.slice(0, max) : '';
  const win = () => getWindow();

  /* workspace */
  handle('ws:status', () => Object.assign(mgr.status(), { app: { version: app.getVersion(), userData: app.getPath('userData') } }));
  handle('ws:pick-folder', ({ purpose }) => OS.chooseFolder(win(), {
    title: { create: 'Choose where to create the workspace', open: 'Open a Flowlace workspace folder', move: 'Choose the new folder for this workspace', backup: 'Choose the backup folder' }[purpose] || 'Choose a folder',
    buttonLabel: { create: 'Select', open: 'Open workspace', move: 'Move here', backup: 'Use this folder' }[purpose],
    defaultPath: purpose === 'create' ? app.getPath('documents') : undefined }));
  handle('ws:target-for', ({ ref, name }) => ({ ok: true, path: mgr.targetFor(OS.resolveRef(ref), str(name, 120)) }));
  handle('ws:create-local', async ({ ref, name }) => { const n = str(name, 120).trim(); if (!n) return { ok: false, kind: 'invalid', message: 'Enter a workspace name.' }; return mgr.createLocal(OS.resolveRef(ref), n); });
  handle('ws:open-local', ({ ref, force }) => mgr.openLocal(OS.resolveRef(ref), { force: !!force }));
  handle('ws:open-recent', async ({ key, force }) => {
    const r = settings.recent.find(x => keyOf(x) === key);
    if (!r) return { ok: false, kind: 'invalid', message: 'That workspace is no longer in the list.' };
    if (r.mode === 'local') return mgr.openLocal(r.folder, { force: !!force });
    return mgr.connectCompany(r.url, r.username, r.workspaceId);
  });
  handle('ws:open-moved', async ({ key }) => {
    const r = settings.recent.find(x => keyOf(x) === key) || settings.current;
    const err = mgr.error;
    if (!err || !err.movedTo) return { ok: false, kind: 'invalid', message: 'Nothing to open.' };
    const st = await mgr.openLocal(err.movedTo);
    if (r) settings.forget(r);
    return st;
  });
  handle('ws:forget', ({ key }) => { const r = settings.recent.find(x => keyOf(x) === key); if (r) settings.forget(r); return mgr.status(); });
  handle('ws:move-local', ({ ref }) => mgr.moveLocal(OS.resolveRef(ref)));
  handle('ws:test-server', ({ url }) => mgr.testServer(str(url)));
  handle('ws:sign-in', ({ url, username, password }) => mgr.signIn(str(url), str(username, 64), typeof password === 'string' ? password.slice(0, 200) : ''));
  handle('ws:server-workspaces', ({ url, username }) => mgr.serverWorkspaces(str(url), str(username, 64)));
  handle('ws:create-server-workspace', ({ url, username, name }) => mgr.createServerWorkspace(str(url), str(username, 64), str(name, 120)));
  handle('ws:connect-company', ({ url, username, workspaceId }) => mgr.connectCompany(str(url), str(username, 64), str(workspaceId, 80)));
  handle('ws:retry', () => mgr.openCurrent());
  handle('ws:reload', () => { const w = win(); if (w) setImmediate(() => w.webContents.reload()); });
  handle('ws:info', () => b().info());
  handle('ws:rename', ({ name }) => b().rename(str(name, 120)));
  handle('ws:show-folder', () => { const be = b(); return be.mode === 'local' ? OS.showFolder(be.folder) : { ok: false, message: 'Company workspaces are stored on the server.' }; });
  handle('ws:test-connection', async () => {
    const be = b();
    if (be.mode === 'local') { const fs = require('fs'); fs.accessSync(be.folder, fs.constants.W_OK); return { ok: true, mode: 'local', message: 'The workspace folder is available and writable.' }; }
    const h = await mgr.testServer(be.url); if (!h.ok) return h;
    const i = await be.info(); return Object.assign({ mode: 'company', ms: h.ms, https: h.https, server: h.server }, i);
  });

  /* data */
  handle('data:snapshot', () => b().snapshot());
  handle('data:commit', batch => b().commit(batch));
  handle('data:changes', ({ since }) => b().changes(Number(since) || 0));
  handle('data:get-state', () => b().getUserState());
  handle('data:set-state', ({ data }) => b().setUserState(data));
  handle('data:activity', ({ limit, coll, id }) => b().activity(limit, coll && str(coll, 40), id && str(id, 120)));
  handle('data:pending-save', ({ data }) => pending.save(b().describe().id, data));
  handle('data:pending-load', () => pending.load(b().describe().id));

  /* backups */
  handle('bk:now', () => b().backupNow());
  handle('bk:list', () => b().listBackups());
  handle('bk:pick-file', async () => { if (b().mode !== 'local') return { ok: false, message: 'On a Company workspace, restore from the backups kept by the server.' }; return OS.chooseFile(win(), { title: 'Choose a Flowlace backup', filters: [{ name: 'Flowlace backup', extensions: ['db'] }] }); });
  const ref = a => a.ref ? { file: OS.resolveRef(a.ref) } : { name: str(a.name, 300) };
  handle('bk:inspect', a => b().inspectBackup(ref(a)));
  handle('bk:restore', a => b().restore(ref(a)));
  handle('bk:set', ({ everyHours, keep }) => b().setBackupSettings({ everyHours, keep }));
  handle('bk:pick-dir', async () => {
    if (b().mode !== 'local') return { ok: false, message: 'The backup folder of a Company workspace is set on the server (see the server guide).' };
    const r = await OS.chooseFolder(win(), { title: 'Choose the backup folder', buttonLabel: 'Use this folder' });
    if (!r.ok) return r;
    return b().setBackupSettings({ dir: OS.resolveRef(r.ref) });
  });
  handle('bk:reset-dir', () => b().setBackupSettings({ dir: null }));

  /* files */
  handle('file:open-json', () => OS.openJSON(win()));
  handle('file:save-text', ({ suggestedName, text }) => OS.saveText(win(), { suggestedName: str(suggestedName, 200), text: typeof text === 'string' ? text : '' }));

  /* company administration (the server checks the role again) */
  const company = () => { const be = b(); if (be.mode !== 'company') { const e = new Error('Only for Company workspaces.'); e.code = 'INVALID'; throw e; } return be; };
  handle('adm:users', () => company().users());
  handle('adm:create-user', u => company().createUser({ username: str(u.username, 64), name: str(u.name, 80), role: u.role === 'admin' ? 'admin' : 'member', password: str(u.password, 200), mustChange: !!u.mustChange }));
  handle('adm:update-user', ({ id, patch }) => {
    const p = {}, src = patch || {};
    if ('name' in src) p.name = str(src.name, 80); if ('role' in src) p.role = src.role === 'admin' ? 'admin' : 'member';
    if ('active' in src) p.active = !!src.active; if ('password' in src) { p.password = str(src.password, 200); p.mustChange = src.mustChange !== false; }
    return company().updateUser(str(id, 80), p);
  });
  handle('adm:log', () => company().adminLog());
  handle('acc:change-password', ({ current, password }) => company().changePassword(str(current, 200), str(password, 200)));
  handle('acc:sign-out', async () => { const r = await company().signOut(); mgr.close(); mgr.error = { code: 'AUTH', message: 'You signed out.' }; return r; });

  /* app */
  handle('app:open-external', ({ url }) => OS.openExternal(url));
}

module.exports = { register, APP_ORIGIN };
