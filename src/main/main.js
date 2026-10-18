'use strict';
/* Flowlace desktop — main process. Owns the window, the workspace (database or server connection) and every
   operating-system function. The interface runs sandboxed and reaches these only through src/preload/preload.js. */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, protocol, net, session, safeStorage, shell } = require('electron');

if (handleSquirrelEvent()) return;             // installer / uninstaller events: create or remove shortcuts and quit

const { Settings } = require('./settings');
const { WorkspaceManager } = require('./workspace-manager');
const { register, APP_ORIGIN } = require('./ipc');
const OS = require('./os-integration');

app.setAppUserModelId('com.alphazeta.flowlace');
if (!app.isPackaged && process.env.FLOWLACE_USER_DATA) app.setPath('userData', process.env.FLOWLACE_USER_DATA);   // tests and development only
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const RENDERER = path.join(__dirname, '..', 'renderer', 'dist');
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

let win = null, mgr = null, settings = null;
const logFile = () => path.join(app.getPath('userData'), 'logs', 'flowlace.log');
function log(msg) { try { fs.mkdirSync(path.dirname(logFile()), { recursive: true }); fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${msg}\n`); } catch (_) { /* ignore */ } }
process.on('uncaughtException', e => log('uncaught: ' + (e && e.stack || e)));
process.on('unhandledRejection', e => log('unhandled rejection: ' + (e && e.stack || e)));

function send(ch, payload) { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); }

function createWindow() {
  const b = settings.data.window || {};
  win = new BrowserWindow({
    width: b.width || 1440, height: b.height || 900, x: b.x, y: b.y, minWidth: 1000, minHeight: 640,
    title: 'Flowlace', show: false, backgroundColor: '#F5F4F0',
    icon: path.join(__dirname, '..', '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInWorker: false, webviewTag: false,
      webSecurity: true, allowRunningInsecureContent: false, spellcheck: true, devTools: !app.isPackaged || process.env.FLOWLACE_DEVTOOLS === '1'
    }
  });
  if (b.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  const keep = () => { if (!win || win.isDestroyed()) return; const max = win.isMaximized(); settings.data.window = Object.assign(max ? (settings.data.window || {}) : win.getBounds(), { maximized: max }); };
  win.on('resize', keep); win.on('move', keep);
  win.on('close', () => { keep(); try { settings.save(); } catch (_) { /* ignore */ } });
  win.on('closed', () => { win = null; });
  // links open in the default browser; the window never navigates away from Flowlace
  win.webContents.setWindowOpenHandler(({ url }) => { OS.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(APP_ORIGIN + '/')) { e.preventDefault(); OS.openExternal(url); } });
  win.webContents.on('will-attach-webview', e => e.preventDefault());
  win.webContents.on('render-process-gone', (_e, d) => log('renderer gone: ' + JSON.stringify(d)));
  win.loadURL(APP_ORIGIN + '/index.html');
}

function buildMenu() {
  const go = action => () => send('ev:menu', { action });
  const tpl = [
    { label: '&File', submenu: [
      { label: 'Switch workspace…', accelerator: 'CmdOrCtrl+Shift+O', click: go('switch-workspace') },
      { label: 'Workspace && Storage', click: go('workspace-settings') },
      { type: 'separator' },
      { label: 'Back up now', click: go('backup-now') },
      { label: 'Import from the HTML version (JSON)…', click: go('import-json') },
      { label: 'Export a JSON copy…', click: go('export-json') },
      { type: 'separator' },
      { role: 'quit', label: 'Exit' }] },
    { label: '&Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '&View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }].concat(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }]) },
    { label: '&Help', submenu: [
      { label: 'User guide', click: () => shell.openPath(path.join(__dirname, '..', '..', 'assets', 'docs', 'GUIA.html')) },
      { label: 'Open the log folder', click: () => shell.openPath(path.dirname(logFile())) },
      { type: 'separator' },
      { label: `About Flowlace ${app.getVersion()}`, click: go('about') }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function serveRenderer() {
  protocol.handle('app', req => {
    const u = new URL(req.url);
    if (u.host !== 'flowlace') return new Response('Not found', { status: 404 });
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(RENDERER, rel));
    if (!file.startsWith(RENDERER + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('Not found', { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' } });
  });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (mgr) mgr.close(); });
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', e => e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.whenReady().then(async () => {
  // nothing may be granted to the page except copying text to the clipboard
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'clipboard-sanitized-write'));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'clipboard-sanitized-write');
  serveRenderer();
  settings = new Settings(app.getPath('userData'), safeStorage);
  mgr = new WorkspaceManager({ settings, fetchImpl: (u, o) => net.fetch(u, o), emit: (ev, p) => send('ev:' + ev, p), userDataDir: app.getPath('userData'), isNetworkDrive: OS.isNetworkDrive });
  register({ mgr, settings, getWindow: () => win, pending: new OS.Pending(app.getPath('userData')) });
  await mgr.openCurrent();
  if (mgr.error) log(`workspace not opened: ${mgr.error.code} ${mgr.error.message}`);
  buildMenu();
  createWindow();
});

/* Squirrel.Windows installer events (install, update, uninstall): manage the Start menu and desktop shortcuts. */
function handleSquirrelEvent() {
  if (process.platform !== 'win32' || process.argv.length < 2) return false;
  const cmd = process.argv[1];
  if (!/^--squirrel-/.test(cmd)) return false;
  const { spawn } = require('child_process');
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  const exe = path.basename(process.execPath);
  const run = args => { try { spawn(updateExe, args, { detached: true }).on('close', () => app.quit()); } catch (_) { app.quit(); } };
  if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') { run(['--createShortcut', exe, '--shortcut-locations', 'Desktop,StartMenu']); setTimeout(() => app.quit(), 3000); return true; }
  if (cmd === '--squirrel-uninstall') { run(['--removeShortcut', exe]); setTimeout(() => app.quit(), 3000); return true; }   // workspaces and settings are not touched
  if (cmd === '--squirrel-obsolete') { app.quit(); return true; }
  return false;
}
