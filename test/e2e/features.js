'use strict';
/* Existing Flowlace functions on the desktop build, with real persistence:
   explicit example data → every main view renders (Overview timeline/table/calendar, Projects, project tabs,
   Tasks, Resources, Settings tabs) → edit a task in the panel → Workflow "Import activities" → restart →
   everything is still there and every relation in the database points to an existing record →
   removing the example data leaves no trace and nothing reappears on the next start. */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');

function dbRecords(dbFile) {
  const s = new Store(dbFile, { readOnly: true });
  try { return s.snapshot().records; } finally { s.close(); }
}
/* every reference between records must resolve */
function checkRelations(recs) {
  const by = c => new Map(recs.filter(r => r.coll === c).map(r => [r.id, r.data]));
  const P = by('projects'), T = by('tasks'), D = by('deliverables'), PH = by('phases'), PE = by('people'), SV = by('services'), PP = by('projectPhases');
  const wf = (recs.find(r => r.coll === 'workflow') || {}).data;
  const steps = new Set(((wf && wf.steps) || []).map(s => s.id));
  const bad = [];
  for (const [id, t] of T) {
    if (!P.has(t.projectId)) bad.push(`task ${id} → project ${t.projectId}`);
    if (t.deliverableId && !D.has(t.deliverableId)) bad.push(`task ${id} → deliverable ${t.deliverableId}`);
    if (t.assignedToId && !PE.has(t.assignedToId)) bad.push(`task ${id} → person ${t.assignedToId}`);
    if (t.serviceId && !SV.has(t.serviceId)) bad.push(`task ${id} → service ${t.serviceId}`);
    if (t.wfStepId && !steps.has(t.wfStepId)) bad.push(`task ${id} → workflow step ${t.wfStepId}`);
    for (const r of t.wfReqIds || t.reqTaskIds || []) if (!T.has(r)) bad.push(`task ${id} → required task ${r}`);
  }
  for (const [id, d] of D) {
    if (!P.has(d.projectId)) bad.push(`deliverable ${id} → project ${d.projectId}`);
    if (d.phaseId && !PH.has(d.phaseId)) bad.push(`deliverable ${id} → phase ${d.phaseId}`);
    for (const r of d.reqTaskIds || []) if (!T.has(r)) bad.push(`deliverable ${id} → required task ${r}`);
  }
  for (const [id, pp] of PP) { if (!P.has(pp.projectId)) bad.push(`projectPhase ${id} → project`); if (!PH.has(pp.phaseId)) bad.push(`projectPhase ${id} → phase ${pp.phaseId}`); }
  for (const r of recs.filter(x => x.coll === 'assignments')) { if (!P.has(r.data.projectId)) bad.push(`assignment ${r.id} → project`); if (!PE.has(r.data.personId)) bad.push(`assignment ${r.id} → person`); }
  return bad;
}

module.exports = async function run() {
  console.log('Existing functions on the desktop build');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-');
  const wsFolder = path.join(docs, 'Features'); fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db');
  let { app, w } = await H.launch(ud);
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const mainText = () => w.textContent('#main');
  let counts0 = null, tid = null, imported = 0;

  await step('example data loads only on request (Load example data)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]');
    await w.fill('#ms-start input[name=name]', 'Features');
    await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary');
    await H.appReady(w);
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    assert.strictEqual(dbRecords(dbFile).filter(r => r.coll === 'projects').length, 0, 'empty before asking');
    await w.click('#modal-root [data-act=load-examples]');
    await H.saved(w);
    await H.until(() => dbRecords(dbFile).filter(r => r.coll === 'projects').length >= 5, 8000, 'examples saved');
    const recs = dbRecords(dbFile);
    counts0 = { projects: recs.filter(r => r.coll === 'projects').length, tasks: recs.filter(r => r.coll === 'tasks').length };
    assert.ok(recs.filter(r => r.coll === 'projects').every(r => r.data.example), 'all marked as examples');
  });

  await step('Overview: timeline, table and calendar', async () => {
    await go('overview');
    for (const m of ['timeline', 'table', 'calendar']) {
      await w.click(`[data-act=ov-mode][data-v=${m}]`);
      await H.sleep(200);
      assert.ok((await mainText()).length > 200, 'overview ' + m);
    }
    await w.click('[data-act=ov-mode][data-v=timeline]');
    await H.shot(w, 'features-overview');
  });

  await step('Projects list and every project tab (summary, phases, deliverables, tasks, workflow)', async () => {
    await go('projects');
    assert.ok(/Riverside|Joondalup/.test(await mainText()));
    const pid = await w.evaluate(() => { const r = [...document.querySelectorAll('[data-prow],[data-pid]')].map(x => x.dataset.prow || x.dataset.pid).find(Boolean); return r; });
    assert.ok(pid, 'a project row');
    await go('p-' + pid);
    const tabs = await w.evaluate(() => [...document.querySelectorAll('[role=tab][data-act=ptab]')].map(b => b.dataset.v));
    assert.ok(tabs.includes('workflow') && tabs.includes('tasks'), 'tabs: ' + tabs);
    for (const t of tabs) { await w.click(`[role=tab][data-act=ptab][data-v="${t}"]`); await H.sleep(150); assert.ok((await mainText()).length > 100, 'tab ' + t); }
  });

  await step('Tasks: open a task in the side panel and change its status', async () => {
    await go('tasks');
    tid = await w.evaluate(() => { const r = document.querySelector('tr[data-trow]'); return r && r.dataset.trow; });
    assert.ok(tid, 'a task row');
    await w.click(`#to-${tid}`);
    await H.until(() => w.evaluate(() => !document.getElementById('panel').hidden && !!document.getElementById('pt-status')), 5000, 'panel');
    await w.selectOption('#pt-status', 'QA');
    await H.saved(w);
    await H.until(() => { const t = dbRecords(dbFile).find(r => r.coll === 'tasks' && r.id === tid); return t && t.data.status === 'QA'; }, 8000, 'status stored');
    await w.keyboard.press('Escape');
  });

  await step('Resources: weekly matrix and per-person view', async () => {
    await go('resources');
    for (const m of ['matrix', 'person']) { await w.click(`[data-act=rs-mode][data-v=${m}]`).catch(() => {}); await H.sleep(200); assert.ok((await mainText()).length > 100, 'resources ' + m); }
    await w.click('[data-act=rs-mode][data-v=matrix]').catch(() => {});
    await H.shot(w, 'features-resources');
  });

  await step('Settings: every tab renders, including Workspace & Storage', async () => {
    await go('settings');
    const tabs = await w.evaluate(() => [...document.querySelectorAll('[role=tab][data-act=stab]')].map(b => [b.dataset.v, b.textContent]));
    assert.ok(tabs.some(t => /Workspace & Storage/.test(t[1])), 'Workspace & Storage tab');
    for (const [v] of tabs) { await w.click(`[role=tab][data-act=stab][data-v="${v}"]`); await H.sleep(200); assert.ok((await mainText()).length > 100, 'settings ' + v); }
  });

  await step('Workflow: Import activities on a project creates linked tasks', async () => {
    const before = dbRecords(dbFile).filter(r => r.coll === 'tasks' && r.data.wfStepId).length;
    await go('projects');
    const pids = await w.evaluate(() => [...new Set([...document.querySelectorAll('[data-prow]')].map(x => x.dataset.prow))]);
    let done = false;
    for (const pid of pids) {
      await go('p-' + pid);
      await w.click('[role=tab][data-act=ptab][data-v=workflow]');
      await H.sleep(200);
      const btn = await w.$('[data-act=wf-import]');
      if (!btn) continue;
      await btn.click();
      await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'import dialog');
      // choose every phase / specialty offered, then confirm
      // the dialog re-renders when a phase is ticked (its specialties appear), so repeat until nothing is left
      for (let i = 0; i < 8; i++) {
        const c = await w.$('#modal-root input[type=checkbox]:not(:checked):not(:disabled)');
        if (!c) break;
        await c.click(); await H.sleep(150);
      }
      if (await w.evaluate(() => document.getElementById('wi-ok').disabled)) { await w.click('#modal-root [data-act=modal-close]'); continue; }
      await w.click('#wi-ok');
      await H.saved(w);
      done = true; break;
    }
    assert.ok(done, 'a project with activities to import');
    await H.until(() => dbRecords(dbFile).filter(r => r.coll === 'tasks' && r.data.wfStepId).length > before, 8000, 'imported tasks stored');
    imported = dbRecords(dbFile).filter(r => r.coll === 'tasks' && r.data.wfStepId).length;
    await H.shot(w, 'features-workflow');
  });

  await step('after a restart everything is still there and every relation resolves', async () => {
    await app.close();
    ({ app, w } = await H.launch(ud));
    await H.appReady(w);
    const recs = dbRecords(dbFile);
    assert.strictEqual(recs.filter(r => r.coll === 'projects').length, counts0.projects);
    assert.strictEqual(recs.filter(r => r.coll === 'tasks' && r.data.wfStepId).length, imported);
    assert.strictEqual(recs.find(r => r.coll === 'tasks' && r.id === tid).data.status, 'QA');
    const bad = checkRelations(recs);
    assert.deepStrictEqual(bad, [], bad.slice(0, 10).join('; '));
    await w.evaluate(() => { location.hash = 'tasks'; });
    await H.until(() => w.evaluate(id => !!document.querySelector(`tr[data-trow="${id}"]`), tid), 5000, 'task shown after restart');
  });

  await step('removing the example data leaves no example records, and they do not come back', async () => {
    await w.evaluate(() => { location.hash = 'settings'; });
    await H.sleep(200);
    await w.click('[role=tab][data-act=stab][data-v=data]');
    await w.click('[data-act=remove-examples]');
    await H.until(() => w.evaluate(() => !!document.querySelector('#modal-root [data-act=cf-yes]')), 4000, 'confirm');
    await w.click('#modal-root [data-act=cf-yes]');
    await H.saved(w);
    await H.until(() => dbRecords(dbFile).filter(r => r.coll === 'projects').length === 0, 8000, 'examples removed');
    await app.close();
    ({ app, w } = await H.launch(ud));
    await H.appReady(w);
    await H.sleep(800);
    const recs = dbRecords(dbFile);
    assert.strictEqual(recs.filter(r => r.coll === 'projects').length, 0, 'no projects reappear');
    assert.strictEqual(recs.filter(r => r.coll === 'tasks').length, 0, 'no tasks reappear');
    assert.deepStrictEqual(checkRelations(recs), []);
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('features');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
