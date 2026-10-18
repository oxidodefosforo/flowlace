'use strict';
/* Company workspace, end to end: Flowlace Server + two desktop clients (an administrator and a member).
   Live updates without losing the open panel, a conflict on the same task, disconnection and reconnection,
   permissions checked by the server, personal preferences, and a restore by the administrator. */
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const H = require('./helpers');
const { assert, step } = H;

const SERVER = path.join(H.ROOT, 'server', 'src', 'index.js');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const URL_ = `http://127.0.0.1:${PORT}`;

function startServer(cfg) {
  const p = spawn(process.execPath, [SERVER, 'serve', '--config', cfg], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.log = '';
  p.stdout.on('data', d => { p.log += d; }); p.stderr.on('data', d => { p.log += d; });
  return p;
}
async function serverUp() { await H.until(async () => { try { const r = await fetch(URL_ + '/api/health'); return r.ok; } catch (_) { return false; } }, 10000, 'server'); }
async function api(method, p, token, body) { const r = await fetch(URL_ + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }); return Object.assign({ status: r.status }, await r.json()); }

async function connect(app, w, user, pass) {
  await H.until(() => w.evaluate(() => !document.getElementById('ms-start').hidden), 8000, 'start');
  await w.click('[data-sact=connect]');
  await w.fill('#ms-start input[name=url]', URL_);
  await w.click('#ms-start form[data-sform=test] button');
  await H.until(() => w.evaluate(() => /Flowlace Server/.test(document.querySelector('.st-ok') ? document.querySelector('.st-ok').textContent : '')), 8000, 'test ok');
  await w.fill('#ms-start input[name=username]', user);
  await w.fill('#ms-start input[name=password]', pass);
  await w.click('#ms-start form[data-sform=signin] button.primary');
  await H.until(() => w.evaluate(() => !!document.querySelector('#ms-start [data-sact=join]')), 8000, 'workspace list');
  await w.click('#ms-start button.btn[data-sact=join]');
  await H.appReady(w);
}
const taskName = (w, id) => w.evaluate(id => { const el = document.querySelector(`#pn-title`); return el ? el.textContent : null; }, id);

module.exports = async function run() {
  console.log('Company workspace (Flowlace Server + two clients)');
  const base = H.tmp('ms-srv-');
  const cfg = path.join(base, 'flowlace-server.json');
  execFileSync(process.execPath, [SERVER, 'init', '--config', cfg, '--data', path.join(base, 'data'), '--port', String(PORT), '--allow-http', '--admin', 'ana', '--admin-name', 'Ana Admin', '--workspace', 'Alphazeta'], { env: Object.assign({}, process.env, { FLOWLACE_PASSWORD: 'admin-pass-123' }) });
  execFileSync(process.execPath, [SERVER, 'create-user', '--config', cfg, '--username', 'mario', '--name', 'Mario Member'], { env: Object.assign({}, process.env, { FLOWLACE_PASSWORD: 'member-pass-123' }) });
  const c = JSON.parse(fs.readFileSync(cfg, 'utf8')); c.host = '127.0.0.1'; fs.writeFileSync(cfg, JSON.stringify(c));
  let srv = startServer(cfg); await serverUp();

  const A = await H.launch(H.tmp('ms-uda-')), B = await H.launch(H.tmp('ms-udb-'));
  let tid = null;

  await step('administrator connects (test connection, sign in, choose workspace)', async () => {
    await connect(A.app, A.w, 'ana', 'admin-pass-123');
    await H.saved(A.w);
    assert.ok(/Company/.test(await A.w.textContent('#save-ind')));
  });

  await step('administrator imports the HTML export into the Company workspace', async () => {
    await H.answerDialogs(A.app, { file: path.join(__dirname, '..', 'fixtures', 'web-export.json') });
    await A.w.evaluate(() => { location.hash = 'settings'; });
    await A.w.click('[data-act=stab][data-v=data]');
    await A.w.click('[data-dact=import-json]');
    await H.until(() => A.w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    await A.w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => A.w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 15000, 'imported');
  });

  await step('member connects on a second computer and sees the same data', async () => {
    await connect(B.app, B.w, 'mario', 'member-pass-123');
    await B.w.evaluate(() => { location.hash = 'projects'; });
    await H.until(() => B.w.evaluate(() => /Riverside Medical Centre/.test(document.getElementById('main').textContent)), 8000, 'data on B');
  });

  await step('member sees company settings read-only (checked by the server too)', async () => {
    await B.w.evaluate(() => { location.hash = 'settings'; });
    await B.w.click('[data-act=stab][data-v=phases]');
    const t = await B.w.textContent('#main');
    assert.ok(/Only administrators/.test(t));
    assert.ok(await B.w.evaluate(() => !!document.querySelector('#main .ro-box[inert]')));
    const login = await api('POST', '/api/login', null, { username: 'mario', password: 'member-pass-123' });
    const ws = (await api('GET', '/api/workspaces', login.token)).workspaces[0].id;
    const r = await api('POST', `/api/w/${ws}/commit`, login.token, { opId: 'optestmember01', ops: [{ type: 'put', coll: 'phases', id: 'ph-x', base: 0, data: { id: 'ph-x', name: 'Hack' } }] });
    assert.strictEqual(r.status, 403);
  });

  await step('a change by the administrator reaches the member live, without closing the open panel', async () => {
    // both open the same task in the side panel
    await A.w.evaluate(() => { location.hash = 'tasks'; });
    await B.w.evaluate(() => { location.hash = 'tasks'; });
    await H.sleep(400);
    tid = await A.w.evaluate(() => { const r = [...document.querySelectorAll('tr[data-trow]')].find(x => /Update lighting layout/.test(x.textContent) || [...x.querySelectorAll('input')].some(i => /Update lighting layout/.test(i.value))); return r && r.dataset.trow; });
    if (!tid) { await H.shot(A.w, 'debug-A-tasks'); console.log('A rows:', await A.w.evaluate(() => [document.querySelectorAll('tr[data-trow]').length, location.hash, document.getElementById('main').textContent.slice(0, 300)])); }
    assert.ok(tid, 'a task row');
    await A.w.click(`#to-${tid}`);
    await B.w.click(`#to-${tid}`);
    await H.until(() => B.w.evaluate(() => !document.getElementById('panel').hidden), 5000, 'panel B');
    const sel = await A.w.evaluate(() => { const el = document.querySelector('#panel input[data-f=name], #panel #pt-name, #panel input[id^="pt-n"]'); return el ? '#' + el.id : null; });
    assert.ok(sel, 'name field in panel');
    await A.w.fill(sel, 'Renamed by Ana');
    await A.w.press(sel, 'Tab');
    await H.saved(A.w);
    await H.until(() => B.w.evaluate(s => { const el = document.querySelector(s); return el && el.value === 'Renamed by Ana'; }, sel), 8000, 'live update on B');
    assert.ok(await B.w.evaluate(() => !document.getElementById('panel').hidden), 'panel still open');
    await H.shot(B.w, 'company-live-update');
  });

  await step('an edit in progress is not interrupted by an incoming update', async () => {
    const sel = await B.w.evaluate(() => { const el = document.querySelector('#panel textarea[data-f=notes], #panel textarea'); return el ? '#' + el.id : null; });
    await B.w.click(sel);
    await B.w.type(sel, 'typing…');
    // Ana changes another field of another record meanwhile
    await A.w.evaluate(() => { location.hash = 'projects'; });
    await A.w.click('[data-act=new-project]');
    await A.w.fill('#modal-root input[name=name]', 'Live project');
    await A.w.fill('#modal-root input[name=code]', 'AZ-7001');
    await A.w.click('#modal-root button:has-text("Create project")');
    await H.saved(A.w);
    await H.sleep(800);
    assert.strictEqual(await B.w.evaluate(s => document.activeElement && '#' + document.activeElement.id === s && document.activeElement.value.endsWith('typing…'), sel), true, 'still typing');
    await B.w.press(sel, 'Tab');
    await H.saved(B.w);
    await B.w.evaluate(() => { location.hash = 'projects'; });
    await H.until(() => B.w.evaluate(() => /Live project/.test(document.getElementById('main').textContent)), 8000, 'project appears after editing');
  });

  await step('disconnection: member keeps the data on screen, sees "Disconnected", nothing is saved', async () => {
    // the member's computer loses the network; the server keeps running for the administrator
    await B.app.evaluate(({ net }) => { net.__fetch = net.__fetch || net.fetch; net.fetch = () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')); });
    srv.kill(); await H.sleep(600); srv = startServer(cfg); await serverUp();       // drops the open live-update streams
    await H.until(() => B.w.evaluate(() => /Disconnected/.test(document.getElementById('save-ind').textContent) || /Disconnected/.test(document.getElementById('ms-banner').textContent)), 20000, 'B disconnected');
    await H.until(() => A.w.evaluate(() => !/Disconnected/.test(document.getElementById('ms-banner').textContent) || document.getElementById('ms-banner').hidden), 40000, 'A reconnected');
    await B.w.evaluate(() => { location.hash = 'tasks'; });
    await H.sleep(300);
    assert.ok(await B.w.evaluate(() => [...document.querySelectorAll('#main input')].some(i => i.value === 'Renamed by Ana') || /Renamed by Ana/.test(document.getElementById('main').textContent)), 'data still visible');
    await H.shot(B.w, 'company-disconnected');
  });

  await step('conflict: both change the same task; the member reviews the current version and keeps theirs', async () => {
    // member (offline) renames the task: kept as an unsaved change
    await B.w.click(`#to-${tid}`);
    const sel = await B.w.evaluate(() => { const el = document.querySelector('#panel input[data-f=name], #panel #pt-name, #panel input[id^="pt-n"]'); return '#' + el.id; });
    await B.w.fill(sel, 'Renamed by Mario');
    await B.w.press(sel, 'Tab');
    await H.until(() => B.w.evaluate(() => /unsaved change/.test(document.getElementById('ms-banner').textContent)), 5000, 'unsaved count');
    // administrator renames the same task meanwhile
    await A.w.evaluate(() => { location.hash = 'tasks'; });
    await A.w.click(`#to-${tid}`);
    const asel = await A.w.evaluate(() => { const el = document.querySelector('#panel input[data-f=name], #panel #pt-name, #panel input[id^="pt-n"]'); return '#' + el.id; });
    await A.w.fill(asel, 'Renamed again by Ana');
    await A.w.press(asel, 'Tab');
    await H.saved(A.w);
    // network back for the member
    await B.app.evaluate(({ net }) => { net.fetch = net.__fetch; });
    await H.until(() => B.w.evaluate(() => /Someone else changed this item/.test(document.getElementById('modal-root').textContent)), 40000, 'conflict dialog');
    const t = await B.w.textContent('#modal-root');
    assert.ok(/Renamed again by Ana/.test(t) && /Renamed by Mario/.test(t) && /Ana Admin/.test(t), 'shows both versions and who changed it');
    await H.shot(B.w, 'company-conflict');
    await B.w.click('#modal-root [data-dact=conflicts-apply]');           // default choice: keep my version
    await H.saved(B.w);
    await H.until(() => A.w.evaluate(s => document.querySelector(s) && document.querySelector(s).value === 'Renamed by Mario', asel), 8000, 'A receives the reviewed change');
  });

  await step('personal preferences stay per user (theme of the member does not change the administrator’s)', async () => {
    await B.w.evaluate(() => { location.hash = 'settings'; });
    await B.w.click('[data-act=stab][data-v=brand]');
    await B.w.click('[data-act=theme-set][data-v=dark]');
    await H.sleep(1500);
    assert.strictEqual(await B.w.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await H.sleep(500);
    assert.notStrictEqual(await A.w.evaluate(() => document.documentElement.dataset.theme), 'dark');
  });

  await step('the server records who changed what and when', async () => {
    const login = await api('POST', '/api/login', null, { username: 'ana', password: 'admin-pass-123' });
    const ws = (await api('GET', '/api/workspaces', login.token)).workspaces[0].id;
    const a = await api('GET', `/api/w/${ws}/activity?limit=200`, login.token);
    assert.ok(a.activity.some(x => x.userName === 'Mario Member' && x.coll === 'tasks' && x.action === 'update'));
    assert.ok(a.activity.some(x => x.userName === 'Ana Admin' && x.action === 'create'));
  });

  await step('administrator restores a server backup; both clients reload the restored data', async () => {
    await A.w.evaluate(() => { location.hash = 'settings'; });
    await A.w.click('[data-act=stab][data-v=data]');
    await A.w.click('[data-dact=bk-now]');
    await H.until(() => A.w.evaluate(() => /Backup saved/.test(document.getElementById('toasts').textContent)), 15000, 'backup');
    await A.w.evaluate(() => { location.hash = 'projects'; });
    await A.w.click('[data-act=new-project]');
    await A.w.fill('#modal-root input[name=name]', 'After the backup');
    await A.w.fill('#modal-root input[name=code]', 'AZ-7002');
    await A.w.click('#modal-root button:has-text("Create project")');
    await H.saved(A.w);
    await A.w.evaluate(() => { location.hash = 'settings'; });
    await A.w.click('[data-act=stab][data-v=data]');
    await H.until(() => A.w.evaluate(() => !!document.querySelector('[data-dact=bk-restore]')), 8000, 'backup list');
    await A.w.click('[data-dact=bk-restore]');
    await H.until(() => A.w.evaluate(() => /Restore this backup\?/.test(document.getElementById('modal-root').textContent)), 10000, 'confirm');
    await A.w.click('#modal-root [data-act=cf-yes]');
    await H.until(async () => { try { return await A.w.evaluate(() => /Backup restored/.test(document.getElementById('toasts').textContent)); } catch (_) { return false; } }, 20000, 'restored');
    await H.until(() => B.w.evaluate(() => /restored from a backup/.test(document.getElementById('modal-root').textContent)), 15000, 'B told');
    await B.w.click('#modal-root [data-dact=reload]');
    await H.appReady(B.w);
    await B.w.evaluate(() => { location.hash = 'projects'; });
    await H.sleep(500);
    const t = await B.w.textContent('#main');
    assert.ok(/Live project/.test(t) && !/After the backup/.test(t));
  });

  await step('no page errors in either client', async () => { assert.deepStrictEqual(A.w.errors.concat(B.w.errors), []); });
  await A.app.close(); await B.app.close();
  srv.kill();
};

if (require.main === module) module.exports().then(() => process.exit(H.summary('company'))).catch(e => { console.error(e); process.exit(1); });
