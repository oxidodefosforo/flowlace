'use strict';
/* Workflow layout and roles, end to end with the real app:
   1 moving a block down grows its lane and pushes the lanes below      2 moving a block sideways moves the blocks after it,
   3 an edited arrow keeps its route across views and restarts          4 filtering specialties keeps hidden positions
   5 undo / redo restore a whole move                                   6 roles propose responsibles (project, specialty, role)
   7 existing assignments are kept                                      8 existing data keeps projects, tasks, dates, hours, links */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');

const W = 196, GAP = 24;
function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }
const rec = (rs, c, id) => (rs.find(r => r.coll === c && r.id === (id || '_')) || {}).data;

/* fixture: the HTML export with its own workflow tasks removed and a Schematic standard by specialty */
function makeFixture(dir) {
  const src = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'web-export.json'), 'utf8'));
  const d = src.data;
  const wfTasks = new Set(d.tasks.filter(t => t.wfStepId).map(t => t.id));
  d.tasks = d.tasks.filter(t => !wfTasks.has(t.id));
  d.deliverables.forEach(x => { x.reqTaskIds = (x.reqTaskIds || []).filter(id => !wfTasks.has(id)); });
  d.projects.forEach(p => { delete p.wfScope; delete p.wfDecide; delete p.wfVersion; });
  const E = 'sv-electrical', M = 'sv-mechanical', Hy = 'sv-hydraulics', C = 'sv-coordination';
  let o = 0; const st = (id, sv, cat, name, deps, roleIds) => ({ id, phaseId: 'ph-sd', serviceId: sv, cat, name, desc: '', deps, order: o++, retired: false, createdAt: null, roleIds });
  d.workflow = { version: 1, appliedAt: '2026-10-01T00:00:00.000Z', demo: false, schema: 2, demoV2: true, steps: [
    st('co-in1', C, 'input', 'Architectural background', [], ['ro-bimc']),
    st('el-ac1', E, 'action', 'Preliminary design sketches and notes', ['co-in1'], ['ro-eng']),
    st('el-ac2', E, 'action', 'Maximum demand calculation', ['el-ac1', 'me-out1'], ['ro-eng']),
    st('el-out1', E, 'output', 'Electrical schematic report', ['el-ac2'], ['ro-seng', 'ro-qa']),
    st('me-in1', M, 'input', 'Mechanical brief', [], ['ro-eng']),
    st('me-out1', M, 'output', 'Preliminary equipment load', ['me-in1'], ['ro-eng']),
    st('me-ac2', M, 'action', 'Mechanical schematic layout', ['me-out1'], ['ro-bimm', 'ro-dft']),
    st('me-out2', M, 'output', 'Mechanical schematic report', ['me-ac2'], ['ro-seng']),
    st('hy-ac1', Hy, 'action', 'Hydraulic schematic design', ['co-in1'], ['ro-bimm', 'ro-dft']),
    st('hy-out1', Hy, 'output', 'Hydraulic schematic report', ['hy-ac1'], ['ro-seng']),
    st('co-ac1', C, 'action', 'Services coordination', ['el-out1', 'me-out2', 'hy-out1'], ['ro-bimc'])] };
  d.workflowDraft = null;
  const f = path.join(dir, 'layout-fixture.json');
  fs.writeFileSync(f, JSON.stringify(src, null, 2));
  return { file: f, data: d };
}

module.exports = async function run() {
  console.log('Workflow layout and roles');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Layout');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db');
  const FX = makeFixture(docs);
  let { app, w } = await H.launch(ud);
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const box = id => w.evaluate(i => { const el = document.getElementById('wfn-' + i); return el ? { x: parseFloat(el.style.left), y: parseFloat(el.style.top) } : null; }, id);
  const lane = l => w.evaluate(k => { const el = document.querySelector(`.wfl[data-lane="${k}"]`); return el ? { y: parseFloat(el.style.top), h: parseFloat(el.style.height) } : null; }, l);
  const all = ids => Promise.all(ids.map(box)).then(v => Object.fromEntries(ids.map((id, i) => [id, v[i]])));
  const edgeD = k => w.evaluate(x => { const p = document.querySelector(`path.wfe[data-k="${x}"]`); return p && p.getAttribute('d'); }, k);
  async function drag(id, dx, dy) {
    const el = await w.$('#wfn-' + id); await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    await w.mouse.move(x, y); await w.mouse.down(); await w.mouse.move(x + dx / 3, y + dy / 3, { steps: 4 }); await w.mouse.move(x + dx, y + dy, { steps: 8 }); await w.mouse.up();
    await H.sleep(250);
  }
  const openStd = async () => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click('[data-act=wf-sphase][data-v=ph-sd]'); await H.sleep(250); };
  const IDS = ['co-in1', 'el-ac1', 'el-ac2', 'el-out1', 'me-in1', 'me-out1', 'me-ac2', 'me-out2', 'hy-ac1', 'hy-out1', 'co-ac1'];
  let afterV = null, afterH = null, routeD = null, stdPos = null;

  await step('set-up: workspace with the HTML data and a Schematic standard by specialty', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Layout');
    await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary');
    await H.appReady(w);
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    await w.click('#modal-root [data-act=modal-close]');
    await H.answerDialogs(app, { file: FX.file });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    await w.check('#modal-root input[name=imp-diff][value=replace]');
    await w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 10000, 'imported');
    await H.saved(w);
    const rs = records(dbFile);
    assert.strictEqual(rec(rs, 'workflow').steps.length, 11);
    assert.ok(rs.filter(r => r.coll === 'roles').length >= 7, 'default roles');
    await openStd();
    assert.ok(await box('el-ac1'), 'diagram shows the step');
  });

  await step('1 · moving “Preliminary design sketches and notes” down grows Electrical and pushes the lanes below', async () => {
    const before = await all(IDS), lanes0 = { E: await lane('sv-electrical'), M: await lane('sv-mechanical'), Hy: await lane('sv-hydraulics'), C: await lane('sv-coordination') };
    await drag('el-ac1', 0, 160);
    const after = await all(IDS), lanes1 = { E: await lane('sv-electrical'), M: await lane('sv-mechanical'), Hy: await lane('sv-hydraulics'), C: await lane('sv-coordination') };
    const moved = after['el-ac1'].y - before['el-ac1'].y;
    assert.ok(moved > 120, 'block moved down: ' + moved);
    assert.strictEqual(after['el-ac1'].x, before['el-ac1'].x, 'vertical move only');
    assert.ok(after['el-ac1'].y + 84 <= lanes1.E.y + lanes1.E.h, 'still inside Electrical');
    const grow = lanes1.E.h - lanes0.E.h;
    assert.ok(grow > 100, 'Electrical grew: ' + grow);
    for (const k of ['M', 'Hy', 'C']) assert.strictEqual(lanes1[k].y - lanes0[k].y, grow, k + ' lane pushed by the same amount');
    for (const id of ['me-in1', 'me-out1', 'me-ac2', 'me-out2', 'hy-ac1', 'hy-out1', 'co-ac1', 'co-in1']) assert.strictEqual(after[id].y - before[id].y, grow, id + ' keeps its place in its lane');
    // no overlap between blocks
    for (const a of IDS) for (const b of IDS) if (a < b) { const A = after[a], B = after[b]; assert.ok(!(Math.abs(A.x - B.x) < W && Math.abs(A.y - B.y) < 84), `overlap ${a}/${b}`); }
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('.wfl .wfl-n').length), 4, 'lane names shown');
    await H.saved(w);
    const lay = rec(records(dbFile), 'workflowDraft').layout['ph-sd'];
    assert.ok(lay.n['el-ac1'].dy > 120, 'stored relative to the lane: ' + JSON.stringify(lay.n['el-ac1']));
    assert.ok(lay.l['sv-electrical'].h > lanes0.E.h, 'lane height stored');
    afterV = after;
    await H.shot(w, 'layout-1-vertical');
  });

  await step('2 · moving “Preliminary equipment load” moves the activities to its right and stops at its predecessor', async () => {
    const b0 = await all(IDS);
    const set = ['me-out1', 'me-ac2', 'me-out2', 'el-ac2', 'el-out1', 'co-ac1'], still = ['me-in1', 'el-ac1', 'co-in1', 'hy-ac1', 'hy-out1'];
    await drag('me-out1', -220, 0);
    const b1 = await all(IDS), dx = b1['me-out1'].x - b0['me-out1'].x;
    assert.ok(dx < 0, 'moved left: ' + dx);
    assert.strictEqual(b1['me-out1'].x, b0['me-in1'].x + W + GAP, 'stopped at the minimum gap after its predecessor');
    for (const id of set) assert.strictEqual(b1[id].x - b0[id].x, dx, id + ' moved with it');
    for (const id of still) assert.strictEqual(b1[id].x, b0[id].x, id + ' stayed');
    await drag('me-out1', 140, 0);
    const b2 = await all(IDS), dx2 = b2['me-out1'].x - b1['me-out1'].x;
    assert.ok(dx2 > 100, 'moved right: ' + dx2);
    for (const id of set) assert.strictEqual(b2[id].x - b1[id].x, dx2, id + ' moved right with it');
    // every successor stays after its predecessors
    const steps = rec(records(dbFile), 'workflow').steps;
    for (const s of steps) for (const d of s.deps) assert.ok(b2[s.id].x >= b2[d].x + W + GAP - 1, `${d} → ${s.id} order kept`);
    assert.ok(!Number.isInteger((b2['me-out1'].x - 126) / 254), 'intermediate position between automatic columns');
    afterH = b2;
    await H.shot(w, 'layout-2-horizontal');
  });

  await step('5 · undo and redo restore the whole movement (all moved blocks at once)', async () => {
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    const u1 = await all(IDS);
    for (const id of ['me-out1', 'me-ac2', 'el-ac2', 'co-ac1']) assert.notStrictEqual(u1[id].x, afterH[id].x, id + ' undone');
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    const u3 = await all(IDS);
    assert.ok(u3['el-ac1'].y < afterV['el-ac1'].y, 'first move undone too');
    for (const k of ['redo', 'redo', 'redo']) { await w.click(`[data-wflay=${k}]`); await H.sleep(200); }
    const r = await all(IDS);
    for (const id of IDS) assert.deepStrictEqual(r[id], afterH[id], id + ' redone');
    await H.saved(w);
  });

  await step('3 · an arrow route can be edited; it is published and kept across views and restarts', async () => {
    await w.click('[data-wflay=edit]');
    const k = 'me-out1>el-ac2';
    const before = await edgeD(k);
    await w.dispatchEvent(`path.wfe-hit[data-wfe="${k}"]`, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
    await H.until(() => w.evaluate(() => !!document.querySelector('.wfh')), 3000, 'handles');
    const hd = await w.$('.wfh[data-wfseg="1"]'); await hd.scrollIntoViewIfNeeded(); const b = await hd.boundingBox();
    await w.mouse.move(b.x + 5, b.y + 5); await w.mouse.down(); await w.mouse.move(b.x + 25, b.y + 5, { steps: 4 }); await w.mouse.move(b.x + 41, b.y + 5, { steps: 4 }); await w.mouse.up(); await H.sleep(250);
    routeD = await edgeD(k);
    assert.notStrictEqual(routeD, before, 'route changed');
    assert.ok(/^M[\d.,]+( L[\d.,]+)+$/.test(routeD), 'orthogonal polyline');
    const pts = routeD.slice(1).split(' L').map(p => p.split(',').map(Number));
    for (let i = 1; i < pts.length; i++) assert.ok(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1], 'only horizontal and vertical segments');
    const end = pts[pts.length - 1], prev = pts[pts.length - 2], tgt = await box('el-ac2');
    assert.ok(end[0] === tgt.x - 2 && prev[1] === end[1] && prev[0] < end[0], 'still ends at its target, pointing right');
    // add a bend, then remove it
    const segs = () => w.evaluate(() => document.querySelectorAll('.wfh').length);
    const n0 = await segs();
    const mid = await w.evaluate(x => { const p = document.querySelector(`path.wfe-hit[data-wfe="${x}"]`), r = p.getBoundingClientRect(); return { x: r.x + 2, y: r.y + r.height / 2 }; }, k);
    void mid;
    await w.evaluate(x => { const p = document.querySelector(`path.wfe-hit[data-wfe="${x}"]`), b = p.getBBox(), r = document.querySelector('.wfd').getBoundingClientRect(); p.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + b.x + b.width / 2 + 1, clientY: r.top + b.y + b.height / 2 })); }, k);
    await H.sleep(250);
    assert.ok(await segs() > n0, 'bend added');
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    assert.strictEqual(await edgeD(k), routeD, 'undo removes the bend');
    await w.click('[data-wflay=edit]');
    // publish the standard with its layout
    await w.click('[data-act=wf-save]'); await H.saved(w);
    const rs = records(dbFile);
    assert.ok(rec(rs, 'workflow').layout['ph-sd'].e[k].s.length >= 1, 'published with the route');
    await w.click('[data-act=wf-sphase][data-v=ph-fee]').catch(() => {}); await go('tasks'); await openStd();
    assert.strictEqual(await edgeD(k), routeD, 'same route after changing view');
    await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w); await openStd();
    assert.strictEqual(await edgeD(k), routeD, 'same route after restarting');
    const b2 = await all(IDS);
    for (const id of IDS) assert.deepStrictEqual(b2[id], afterH[id], id + ' same position after restarting');
    stdPos = b2;
  });

  await step('4 · filtering specialties keeps the positions of the hidden blocks', async () => {
    const elLane0 = await lane('sv-hydraulics'), hy0 = await box('hy-ac1');
    await w.click('[data-act=wf-sspec][data-v=sv-hydraulics]'); await H.sleep(250);
    const elLane1 = await lane('sv-hydraulics'), hy1 = await box('hy-ac1');
    assert.strictEqual(hy1.x, hy0.x); assert.strictEqual(hy1.y - elLane1.y, hy0.y - elLane0.y, 'same place inside its lane');
    assert.strictEqual(await box('me-ac2'), null, 'Mechanical hidden');
    await drag('hy-out1', 30, 0);                       // arranging while filtered…
    await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(250);
    const b = await all(IDS);
    for (const id of IDS.filter(i => !i.startsWith('hy'))) assert.deepStrictEqual(b[id], stdPos[id], id + ' unchanged by the filter');
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    await w.click('[data-act=wf-save]'); await H.saved(w);
  });

  await step('6 · roles: catalogue in Settings → People, several roles per person, specialty kept apart', async () => {
    await go('settings'); await w.click('[role=tab][data-act=stab][data-v=people]'); await H.sleep(200);
    const t = await w.textContent('#main');
    for (const r of ['Project Manager', 'Engineer', 'Senior Engineer', 'BIM Coordinator', 'BIM Modeler', 'Drafter', 'Reviewer / QA']) assert.ok(t.includes(r), r);
    const pick = async (pe, roleId) => { await w.evaluate(id => { const d = document.querySelector(`[data-perole="${id}"]`).closest('details'); d.open = true; }, pe); await w.check(`[data-perole="${pe}"][value="${roleId}"]`); await H.sleep(150); };
    await pick('pe-sm', 'ro-eng'); await pick('pe-jo', 'ro-eng'); await pick('pe-jo', 'ro-bimm'); await pick('pe-lc', 'ro-eng');
    // a new role, renamed, then deactivated (kept as a reference)
    await w.fill('#ro-new', 'Graduate Engineer'); await w.press('#ro-new', 'Enter'); await H.sleep(200);
    const nid = await w.evaluate(() => [...document.querySelectorAll('[data-role][data-f=name]')].find(i => i.value === 'Graduate Engineer').dataset.role);
    await pick('pe-dr', nid);
    await w.fill(`#ro-${nid}`, 'Graduate Engineer (EIT)'); await w.press(`#ro-${nid}`, 'Tab'); await H.sleep(200);
    await w.uncheck(`#ro-${nid}-a`); await H.sleep(200);
    await H.saved(w);
    const rs = records(dbFile), pj = rec(rs, 'people', 'pe-jo'), pd = rec(rs, 'people', 'pe-dr'), nr = rec(rs, 'roles', nid);
    assert.deepStrictEqual(pj.roleIds, ['ro-eng', 'ro-bimm']); assert.strictEqual(pj.disciplineId, 'sv-electrical');
    assert.deepStrictEqual(pd.roleIds, [nid], 'reference to the deactivated role kept');
    assert.strictEqual(nr.name, 'Graduate Engineer (EIT)'); assert.strictEqual(nr.active, false);
  });

  await step('6 · Import activities proposes responsibles by specialty and role; manual choice possible', async () => {
    await go('p-px-nof'); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
    await w.click('[data-act=wf-import]');
    await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'dialog');
    if (!(await w.isChecked('[data-wiph="ph-sd"]'))) await w.check('[data-wiph="ph-sd"]');
    for (let i = 0; i < 6; i++) { const c = await w.$('#modal-root input[data-wisp="ph-sd"]:not(:checked)'); if (!c) break; await c.click(); await H.sleep(120); }
    const sel = id => w.evaluate(x => { const s = document.querySelector(`[data-wias="${x}"]`); return s ? { v: s.value, note: s.parentElement.querySelector('.wi-why').textContent } : null; }, id);
    const me = await sel('me-out1'), el = await sel('el-ac1'), hy = await sel('hy-ac1'), co = await sel('co-ac1');
    assert.strictEqual(me.v, 'pe-lc', 'single Mechanical engineer preselected: ' + JSON.stringify(me));
    assert.strictEqual(el.v, '', 'two Electrical engineers: choose'); assert.ok(/2 active Electrical people/.test(el.note), el.note);
    assert.strictEqual(hy.v, ''); assert.ok(/No active Hydraulics person with role BIM Modeler or Drafter/.test(hy.note), hy.note);
    assert.ok(/No active Coordination person/.test(co.note), co.note);
    await w.selectOption('[data-wias="el-ac1"]', 'pe-dr');   // explicit manual choice outside the proposal
    assert.ok(/Manual choice/.test((await sel('el-ac1')).note));
    await w.click('#wi-ok'); await H.saved(w);
    const ts = records(dbFile).filter(r => r.coll === 'tasks' && r.data.projectId === 'px-nof' && r.data.wfStepId).map(r => r.data), by = id => ts.find(t => t.wfStepId === id);
    assert.strictEqual(by('me-out1').assignedToId, 'pe-lc'); assert.strictEqual(by('el-ac1').assignedToId, 'pe-dr');
    assert.ok(!by('hy-ac1').assignedToId && !by('el-ac2').assignedToId, 'no valid person → unassigned');
  });

  await step('6/7 · project mapping + Assign by role fill only unassigned activities; earlier assignments are kept', async () => {
    await w.evaluate(() => { const d = document.querySelector('details.wfmap'); d.open = true; });
    await w.selectOption('[data-wfmap="sv-electrical|ro-eng"]', 'pe-jo'); await H.saved(w);
    await w.click('[data-wfabr]');
    await H.until(() => w.evaluate(() => /Assign by role/.test(document.getElementById('modal-root').textContent)), 4000, 'modal');
    const v = await w.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-abr]')].map(s => [s.dataset.abr, s.value])));
    const ts0 = records(dbFile).filter(r => r.coll === 'tasks' && r.data.projectId === 'px-nof' && r.data.wfStepId).map(r => r.data), tid = id => ts0.find(t => t.wfStepId === id).id;
    assert.ok(!(tid('el-ac1') in v) && !(tid('me-out1') in v), 'assigned activities are not listed');
    assert.strictEqual(v[tid('el-ac2')], 'pe-jo', 'project mapping proposed');
    await w.click('#abr-ok'); await H.saved(w);
    const ts = records(dbFile).filter(r => r.coll === 'tasks' && r.data.projectId === 'px-nof' && r.data.wfStepId).map(r => r.data), by = id => ts.find(t => t.wfStepId === id);
    assert.strictEqual(by('el-ac2').assignedToId, 'pe-jo');
    assert.strictEqual(by('el-ac1').assignedToId, 'pe-dr', 'manual assignment kept');
    assert.strictEqual(by('me-out1').assignedToId, 'pe-lc', 'kept');
    // changing a person's roles never reassigns existing tasks
    await go('settings'); await w.click('[role=tab][data-act=stab][data-v=people]'); await H.sleep(200);
    await w.evaluate(() => { document.querySelector('[data-perole="pe-lc"]').closest('details').open = true; });
    await w.uncheck('[data-perole="pe-lc"][value="ro-eng"]'); await H.saved(w);
    assert.strictEqual(records(dbFile).find(r => r.coll === 'tasks' && r.data.wfStepId === 'me-out1' && r.data.projectId === 'px-nof').data.assignedToId, 'pe-lc');
  });

  await step('3 · projects start from the standard layout; their own adjustments never change the standard', async () => {
    await go('p-px-nof'); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
    await w.click('[data-act=wf-pphase][data-v=ph-sd]').catch(() => {}); await H.sleep(250);
    const p0 = await all(IDS);
    for (const id of ['el-ac1', 'me-out1', 'co-ac1']) assert.strictEqual(p0[id].x, stdPos[id].x, id + ' same x as the standard');
    assert.strictEqual(await edgeD('me-out1>el-ac2'), routeD, 'route from the standard');
    const std0 = JSON.stringify(rec(records(dbFile), 'workflow').layout);
    await drag('hy-ac1', 60, 40); await H.saved(w);
    const rs = records(dbFile), p = rec(rs, 'projects', 'px-nof');
    assert.ok(p.wfLayout['ph-sd'].n['hy-ac1'], 'stored in the project');
    assert.strictEqual(JSON.stringify(rec(rs, 'workflow').layout), std0, 'standard unchanged');
    await w.click('[data-wflay=reset]'); await H.saved(w); await H.sleep(200);
    assert.deepStrictEqual(await box('hy-ac1'), p0['hy-ac1'], 'Reset layout → back to the standard');
    assert.ok(!(rec(records(dbFile), 'projects', 'px-nof').wfLayout || {})['ph-sd'], 'project adjustments removed');
    await H.shot(w, 'layout-project');
  });

  await step('export keeps the layout and the roles (JSON)', async () => {
    const out = path.join(docs, 'export.json');
    await H.answerDialogs(app, { savePath: out });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=export-json]');
    await H.until(() => fs.existsSync(out) && fs.statSync(out).size > 1000, 8000, 'export');
    const x = JSON.parse(fs.readFileSync(out, 'utf8')).data;
    assert.ok(x.workflow.layout['ph-sd'].e['me-out1>el-ac2'], 'route exported');
    assert.ok(x.roles.length >= 8 && x.people.find(p => p.id === 'pe-jo').roleIds.length === 2, 'roles exported');
    assert.ok(x.workflow.steps.find(s => s.id === 'hy-ac1').roleIds.includes('ro-dft'));
  });

  await step('8 · existing data keeps its projects, tasks, statuses, dates, hours and links', async () => {
    const rs = records(dbFile), d = FX.data, by = c => new Map(rs.filter(r => r.coll === c).map(r => [r.id, r.data]));
    const P = by('projects'), T = by('tasks'), D = by('deliverables'), A = by('assignments'), PP = by('projectPhases');
    assert.strictEqual(P.size, d.projects.length); assert.strictEqual(D.size, d.deliverables.length); assert.strictEqual(PP.size, d.projectPhases.length); assert.strictEqual(A.size, (d.assignments || []).length);
    for (const t of d.tasks) { const x = T.get(t.id); assert.ok(x, t.id); for (const f of ['projectId', 'status', 'due', 'start', 'assignedToId', 'deliverableId', 'phaseId']) assert.deepStrictEqual(x[f] ?? null, t[f] ?? null, `${t.id}.${f}`); }
    for (const x of d.deliverables) { const y = D.get(x.id); for (const f of ['projectId', 'phaseId', 'due', 'status']) assert.deepStrictEqual(y[f] ?? null, x[f] ?? null, `${x.id}.${f}`); }
    for (const [, t] of T) { assert.ok(P.has(t.projectId)); if (t.deliverableId) assert.ok(D.has(t.deliverableId)); }
    for (const [, x] of D) for (const r of x.reqTaskIds || []) assert.ok(T.has(r));
    const steps = new Map(rec(rs, 'workflow').steps.map(s => [s.id, s]));
    for (const s of steps.values()) for (const dep of s.deps) assert.ok(steps.has(dep), 'dependency kept');
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('workflow layout');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
