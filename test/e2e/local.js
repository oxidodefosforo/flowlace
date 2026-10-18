'use strict';
/* Local workspace, end to end with the real app:
   first start → create → empty (no examples) → edit → restart (persistence) → import JSON (summary, no duplicates)
   → backups → restore → missing folder (no empty database created) → personal preferences. */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;

module.exports = async function run() {
  console.log('Local workspace');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-');
  const wsFolder = path.join(docs, 'Alphazeta');
  fs.mkdirSync(wsFolder);
  let { app, w } = await H.launch(ud);

  await step('first start shows the choice of Local / Company', async () => {
    await H.until(() => w.evaluate(() => !document.getElementById('ms-start').hidden), 8000, 'start screen');
    const t = await w.textContent('#ms-start');
    assert.ok(/Local workspace/.test(t) && /Company workspace/.test(t));
    assert.ok(/A shared folder or a NAS that only stores files is not enough/.test(t));
  });

  await step('create a local workspace in a chosen folder', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]');
    await w.fill('#ms-start input[name=name]', 'Alphazeta Test');
    await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary');
    await H.appReady(w);
    assert.ok(fs.existsSync(path.join(wsFolder, 'flowlace.db')));
    assert.ok(fs.existsSync(path.join(wsFolder, 'flowlace-workspace.json')));
  });

  await step('a new workspace is empty: no example projects, empty workflow standard', async () => {
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    await w.click('#modal-root [data-act=modal-close]');
    await H.saved(w);
    await w.evaluate(() => { location.hash = 'projects'; });
    await H.sleep(300);
    const t = await w.textContent('#main');
    assert.ok(!/Riverside Medical Centre/.test(t), 'no examples');
  });

  await step('create a project; Saved appears only after the database confirms', async () => {
    await w.evaluate(() => { location.hash = 'projects'; });
    await w.click('[data-act=new-project]').catch(async () => { await w.click('text=New project'); });
    await w.fill('#modal-root input[name=name]', 'Perth Children Hospital');
    await w.fill('#modal-root input[name=code]', 'AZ-9001');
    await w.click('#modal-root button:has-text("Create project")');
    await H.saved(w);
    await H.shot(w, 'local-project');
  });

  await step('data persists after closing and reopening', async () => {
    await app.close();
    ({ app, w } = await H.launch(ud));
    await H.appReady(w);
    await w.evaluate(() => { location.hash = 'projects'; });
    await H.until(() => w.evaluate(() => /Perth Children Hospital/.test(document.getElementById('main').textContent)), 5000, 'project after restart');
  });

  await step('import the JSON export of the HTML version: summary, transaction, identifiers kept', async () => {
    const fixture = path.join(__dirname, '..', 'fixtures', 'web-export.json');
    const before = fs.readFileSync(fixture, 'utf8');
    await H.answerDialogs(app, { file: fixture });
    await w.evaluate(() => { location.hash = 'settings'; });
    await w.click('[data-act=stab][data-v=data]');
    await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    const summary = await w.textContent('#modal-root');
    assert.ok(/Projects\s*5\s*0\s*0/.test(summary.replace(/\s+/g, ' ')), 'summary counts: ' + summary.slice(0, 300));
    // the workspace already has its standard phases (different content): take the file's version
    await w.check('#modal-root input[name=imp-diff][value=replace]');
    await w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 10000, 'imported toast');
    assert.strictEqual(fs.readFileSync(fixture, 'utf8'), before, 'the export file is not changed');
    await w.evaluate(() => { location.hash = 'projects'; });
    await H.until(() => w.evaluate(() => /Riverside Medical Centre/.test(document.getElementById('main').textContent)), 5000, 'imported project');
  });

  await step('importing the same file again adds nothing (no duplicates)', async () => {
    await w.evaluate(() => { location.hash = 'settings'; });
    await w.click('[data-act=stab][data-v=data]');
    await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Nothing to import/.test(document.getElementById('modal-root').textContent)), 5000, 'nothing to import');
    await w.click('#modal-root [data-act=cf-no]');
  });

  await step('records and identifiers are in the SQLite database', async () => {
    const { Store } = require('../../shared/store');
    const s = new Store(path.join(wsFolder, 'flowlace.db'), { readOnly: true });
    const snap = s.snapshot(); s.close();
    const ids = new Set(snap.records.map(r => r.coll + '/' + r.id));
    const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'web-export.json'), 'utf8')).data;
    for (const c of ['projects', 'tasks', 'deliverables', 'people', 'phases', 'projectPhases']) for (const it of fx[c]) assert.ok(ids.has(c + '/' + it.id), `${c}/${it.id} kept`);
    assert.strictEqual(snap.records.filter(r => r.coll === 'projects').length, 6);
    assert.ok(snap.records.some(r => r.coll === 'workflow' && r.data.steps.length > 0), 'workflow standard imported');
  });

  await step('personal settings (saved view) are not shared records', async () => {
    const { Store } = require('../../shared/store');
    await H.sleep(1200);
    const s = new Store(path.join(wsFolder, 'flowlace.db'), { readOnly: true });
    const st = s.getUserState('local'); const snap = s.snapshot(); s.close();
    assert.ok(!snap.records.some(r => r.coll === 'views'));
    assert.ok(st.data && Array.isArray(st.data.views));
  });

  let bkName;
  await step('back up now creates a verified copy in the backup folder', async () => {
    await w.evaluate(() => { location.hash = 'settings'; });
    await w.click('[data-act=stab][data-v=data]');
    await w.click('[data-dact=bk-now]');
    await H.until(() => w.evaluate(() => /Backup saved/.test(document.getElementById('toasts').textContent)), 10000, 'backup toast');
    const files = fs.readdirSync(path.join(wsFolder, 'backups')).filter(f => f.endsWith('.db'));
    assert.strictEqual(files.length, 1); bkName = files[0];
    await H.until(() => w.evaluate(n => document.getElementById('main').textContent.includes(n), bkName), 5000, 'backup listed');
    await H.shot(w, 'local-storage-settings');
  });

  await step('restore: validated, a copy of the current data is made first, then data is replaced', async () => {
    // change something after the backup
    await w.evaluate(() => { location.hash = 'projects'; });
    await w.click('[data-act=new-project]');
    await w.fill('#modal-root input[name=name]', 'After backup');
    await w.fill('#modal-root input[name=code]', 'AZ-9002');
    await w.click('#modal-root button:has-text("Create project")');
    await H.saved(w);
    await w.evaluate(() => { location.hash = 'settings'; });
    await w.click('[data-act=stab][data-v=data]');
    await w.click(`[data-dact=bk-restore][data-name="${bkName}"]`);
    await H.until(() => w.evaluate(() => /Restore this backup\?/.test(document.getElementById('modal-root').textContent)), 8000, 'restore confirm');
    await w.click('#modal-root [data-act=cf-yes]');
    await H.until(async () => { try { return await w.evaluate(() => /Backup restored/.test(document.getElementById('toasts').textContent)); } catch (_) { return false; } }, 15000, 'restored');
    await H.appReady(w);
    const files = fs.readdirSync(path.join(wsFolder, 'backups'));
    assert.ok(files.some(f => f.startsWith('flowlace-before-restore-')), 'copy before restore');
    await w.evaluate(() => { location.hash = 'projects'; });
    await H.sleep(300);
    const t = await w.textContent('#main');
    assert.ok(/Perth Children Hospital/.test(t) && !/After backup/.test(t));
  });

  await step('the remembered workspace missing: problem shown, no empty database created', async () => {
    await app.close();
    const moved = wsFolder + '-away';
    fs.renameSync(wsFolder, moved);
    ({ app, w } = await H.launch(ud));
    await H.until(() => w.evaluate(() => /can’t be opened/.test(document.getElementById('ms-start').textContent)), 8000, 'error screen');
    assert.ok(!fs.existsSync(path.join(wsFolder, 'flowlace.db')));
    await H.shot(w, 'local-missing');
    fs.renameSync(moved, wsFolder);
    await w.click('[data-sact=retry]');
    await H.appReady(w);
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
};

if (require.main === module) module.exports().then(() => process.exit(H.summary('local'))).catch(e => { console.error(e); process.exit(1); });
