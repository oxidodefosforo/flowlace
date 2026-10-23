'use strict';
/* Adding activities without rearranging, and one layout per view (phase / All phases × specialty filter) — v1.5:
    1 arranged blocks keep their on-screen place when an activity is added      2 a filtered view has no invisible walls
    3 Electrical arranged → All specialties is as it was                        4 All specialties changed → Electrical keeps its own
    5 the same specialties in another click order = the same view               6 a new activity is created once and joins the views that show it
    7 restarting keeps every view                                                8 Auto layout only rearranges the view where it runs */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');
const makeFixture = require('./wf-fixture');
const wfTools = require('./wf-tools');

const W = 196, HB = 84;
function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }
const rec = (rs, c, id) => (rs.find(r => r.coll === c && r.id === (id || '_')) || {}).data;

module.exports = async function run() {
  console.log('Workflow views: adding activities and one layout per filter (acceptance v1.5)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Views');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, { fine: true, phases: true });
  let { app, w } = await H.launch(ud);
  const T = wfTools(() => w), { box, allPos, zoom, drag } = T;
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const layouts = () => draft().layout || {};
  const E = 'sv-electrical', M = 'sv-mechanical', Hy = 'sv-hydraulics';
  const openStd = async (ph = 'ph-sd') => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click(`[data-act=wf-sphase][data-v=${ph}]`); await H.sleep(300); };
  const specs = async list => { await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(200); for (const s of list) { await w.click(`[data-act=wf-sspec][data-v=${s}]`); await H.sleep(200); } await H.sleep(150); };
  /* where each block is on screen inside the canvas (lane offsets included), and the lanes */
  const screen = () => w.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wfd .wfn')].map(n => [n.dataset.id, [parseFloat(n.style.left), parseFloat(n.style.top)]])));
  const lanes = () => w.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wfl[data-lane]')].map(l => [l.dataset.lane, [parseFloat(l.style.top), parseFloat(l.style.height)]])));
  const zb = () => w.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wfzb')].map(x => [x.dataset.zb, parseFloat(x.style.left)])));
  const nameId = n => w.evaluate(x => { const b = [...document.querySelectorAll('.wfd .wfn')].find(e => e.querySelector('.wfn-n').textContent === x); return b && b.dataset.id; }, n);
  const add = async (cat, name, spec) => { await w.selectOption(`#wf-add-${cat}-sp`, spec); await w.fill(`#wf-add-${cat}`, name); await w.press(`#wf-add-${cat}`, 'Enter'); await H.saved(w); await H.sleep(300); };
  const overlaps = P => { const L = Object.keys(P), o = []; for (const a of L) for (const b of L) if (a < b && Math.abs(P[a][0] - P[b][0]) < W && Math.abs(P[a][1] - P[b][1]) < HB) o.push(a + '/' + b); return o; };
  const dpos = (a, b) => Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => k + ':' + JSON.stringify([a[k], b[k]])).join(' ');
  const samePos = (a, b, tag) => { const d = dpos(a, b); assert.ok(!d, tag + ' — ' + d); };
  const sameExcept = (a, b, skip, tag) => { for (const id of Object.keys(a)) if (!skip.includes(id)) assert.deepStrictEqual(b[id], a[id], `${tag}: ${id} keeps its place`); };
  let full1 = null, elec1 = null, newId = null;

  await step('set-up', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Views'); await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary'); await H.appReady(w);
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    await w.click('#modal-root [data-act=modal-close]');
    await H.answerDialogs(app, { file: FX.file });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    await w.check('#modal-root input[name=imp-diff][value=replace]'); await w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 10000, 'imported'); await H.saved(w);
  });

  await step('1/6 · arrange, then add an activity: only the new block is placed, in a free slot of its lane and zone; nothing else moves', async () => {
    await openStd();
    await drag('hy-ac1', 40, 0); await drag('me-ac2', 30, 0); await drag('el-out1', 20, 0);   // arranged by hand
    // other views already saved: All phases and Mechanical only (excludes the new Electrical activity)
    await openStd('_all'); await drag('co-ti-out1', 0, 40);
    await openStd(); await specs([M]); await drag('me-ac2', 0, 30);
    const mechOnly0 = JSON.stringify(layouts()[`ph-sd~${M}`]), glob0 = JSON.parse(JSON.stringify(layouts()._global));
    await specs([]);
    const S0 = await screen(), L0 = await lanes(), Z0 = await zb(), routes0 = JSON.stringify(layouts()['ph-sd'].e || {});
    await add('action', 'Lighting calculations', E);
    newId = await nameId('Lighting calculations'); assert.ok(newId, 'shown in the diagram');
    const S1 = await screen(), L1 = await lanes();
    sameExcept(S0, S1, [newId], 'All specialties');
    assert.deepStrictEqual(L1, L0, 'lanes keep their place and height (no block moves because a lane grew)');
    assert.deepStrictEqual(await zb(), Z0, 'zone boundaries unchanged');
    assert.strictEqual(JSON.stringify(layouts()['ph-sd'].e || {}), routes0, 'manual routes unchanged');
    const p = S1[newId], el = L1[E];
    assert.ok(p[1] >= el[0] && p[1] + HB <= el[0] + el[1], 'in the Electrical lane');
    assert.ok(p[0] > Z0[1] && p[0] + W < Z0[2], 'in the Actions zone (between its boundaries)');
    assert.deepStrictEqual(overlaps(S1), [], 'no overlaps');
    const st = draft().steps.filter(s => s.name === 'Lighting calculations'); assert.strictEqual(st.length, 1, 'one activity in the data');
    // views: All phases gets only the new block; Mechanical only is untouched
    const g1 = layouts()._global; assert.ok(g1.n[newId], 'All phases: the new block has a place');
    for (const id of Object.keys(glob0.n)) assert.deepStrictEqual(g1.n[id], glob0.n[id], 'All phases: ' + id + ' unchanged');
    assert.strictEqual(JSON.stringify(layouts()[`ph-sd~${M}`]), mechOnly0, 'Mechanical only: not touched (its filter excludes the activity)');
    await openStd('_all'); const G = await screen();
    assert.ok(G[newId] && overlaps(G).length === 0, 'All phases shows it without overlaps');
    await openStd(); full1 = await screen();
    await H.shot(w, 'views-added');
  });

  await step('1 · a new activity placed outside the visible area is offered with “Locate new activity” (the view does not jump)', async () => {
    await w.evaluate(() => { const r = document.querySelector('.wfd-wrap'); r.scrollLeft = r.scrollWidth; }); await H.sleep(300);
    const v0 = await T.view(), S0 = await screen();
    await add('input', 'Site survey notes', Hy);
    const id = await nameId('Site survey notes'), v1 = await T.view();
    assert.ok(Math.abs(v1.wl - v0.wl) <= 1 && v1.z === v0.z, 'the diagram stayed where it was');
    sameExcept(S0, await screen(), [id], 'after adding an Input');
    assert.ok(await w.$('[data-wflay=locate]'), 'Locate new activity offered: ' + (await w.textContent('.wflay-ctx')));
    await w.click('[data-wflay=locate]'); await H.sleep(300);
    const vis = await w.evaluate(x => { const a = document.getElementById('wfn-' + x).getBoundingClientRect(), b = document.querySelector('.wfd-wrap').getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; }, id);
    assert.ok(vis, 'located: the block is in view ' + JSON.stringify(await w.evaluate(x => { const a = document.getElementById('wfn-' + x).getBoundingClientRect(), b = document.querySelector('.wfd-wrap').getBoundingClientRect(); return [a.left, a.right, b.left, b.right, document.querySelector('.wfd-wrap').scrollLeft]; }, id)));
    assert.ok(await w.evaluate(x => document.getElementById('wfn-' + x).classList.contains('sel'), id), 'and selected');
    full1 = await screen();
  });

  await step('2 · Electrical only: hidden activities leave no wall; the canvas is only as big as what is shown', async () => {
    const wd0 = await w.evaluate(() => parseFloat(document.querySelector('.wfd').style.width));
    await specs([E]);
    const ids = await T.ids();
    assert.ok(!ids.includes('me-ac2') && !ids.includes('hy-ac1') && !ids.includes('me-out2'), 'Mechanical and Hydraulics activities hidden (only what Electrical needs stays, as references)');
    const S = await screen(), zbs = await zb();
    // in All specialties el-out1 cannot go left of the Mechanical / Hydraulics actions; here it can
    const fullMinOut = Math.max(...['me-ac2', 'hy-ac1', 'el-ac3', 'el-ac2', 'el-ac1', 'me-out1', newId].map(i => full1[i][0] + W));
    await drag('el-out1', -600, 0);
    const p = await box('el-out1'), visRight = Math.max(...Object.entries(await screen()).filter(([id]) => !/^el-out|^co-ac|^hy-out|^me-out2/.test(id)).map(([, q]) => q[0] + W));
    assert.ok(p.x < fullMinOut, `moved into the space hidden Actions used (${p.x} < ${fullMinOut})`);
    assert.ok(p.x >= visRight + 40 - 1, 'still after the visible Actions (minimum zone space)');
    const wd1 = await w.evaluate(() => parseFloat(document.querySelector('.wfd').style.width));
    assert.ok(wd1 < wd0, `the filtered canvas is narrower (${wd1} < ${wd0})`);
    void S; void zbs;
    elec1 = await screen();
    await H.shot(w, 'views-electrical');
  });

  await step('2b · Mechanical: after widening the Inputs | Actions space, an Action can still come back up to the minimum gap (the stored space is not a wall)', async () => {
    await specs([M]);
    await w.click('[data-wflay=edit]');
    const c = await T.center('.wfzb[data-zb="1"]'); await T.dragFrom(c, 160 * (await zoom()), 0);
    await w.click('[data-wflay=edit]');
    const S = await screen(), inRight = Math.max(...Object.entries(S).filter(([id]) => ['me-in1', 'co-in1', 'fee-co-out'].includes(id)).map(([, q]) => q[0] + W));
    const a0 = await box('me-out1');
    assert.ok(a0.x - inRight >= 150, 'space widened: ' + (a0.x - inRight));
    await drag('me-out1', -400, 0);
    const a1 = await box('me-out1');
    assert.ok(a1.x - inRight <= 41 && a1.x - inRight >= 39, `the Action moves back to the minimum space after the Inputs (gap ${a1.x - inRight})`);
    await w.click('[data-wflay=undo]'); await H.sleep(150); await w.click('[data-wflay=undo]'); await H.sleep(200);
    await specs([E]); elec1 = await screen();
  });

  await step('3 · back to All specialties: its layout, spaces and boundaries as they were', async () => {
    await specs([]);
    samePos(full1, await screen(), 'every block where it was');
    assert.ok(layouts()[`ph-sd~${E}`] && layouts()[`ph-sd~${E}`].n['el-out1'], 'Electrical has its own layout');
  });

  await step('4 · change All specialties, then Electrical keeps its own adjustments', async () => {
    await drag('el-ac2', 30, 0);
    const changed = await screen(); assert.notDeepStrictEqual(changed, full1, 'All specialties changed');
    full1 = changed;
    await specs([E]);
    assert.deepStrictEqual(await screen(), elec1, 'Electrical as it was left');
  });

  await step('5 · Electrical + Hydraulics = Hydraulics + Electrical (one view, same layout)', async () => {
    await specs([E, Hy]); await drag('hy-ac1', 0, 30); const a = await screen(), za = await zoom();
    await specs([Hy, E]); assert.deepStrictEqual(await screen(), a, 'same layout in the other click order');
    assert.ok(Math.abs((await zoom()) - za) < 0.01, 'same zoom');
    const keys = Object.keys(layouts()).filter(k => k.startsWith('ph-sd~'));
    assert.ok(keys.includes(`ph-sd~${E}+${Hy}`) && !keys.includes(`ph-sd~${Hy}+${E}`), 'one stored view, normalised key: ' + keys);
  });

  await step('6 · another new activity joins the views that show it without rearranging them; specialty change moves it between views', async () => {
    await specs([E, Hy]); const eh0 = await screen();
    await specs([]); const f0 = await screen();
    await specs([E]); const e0 = await screen();
    const mech0 = JSON.stringify(layouts()[`ph-sd~${M}`]);
    await add('output', 'Lighting report addendum', E);
    const id = await nameId('Lighting report addendum'); assert.ok(id, 'shown in Electrical');
    sameExcept(e0, await screen(), [id], 'Electrical');
    assert.deepStrictEqual(overlaps(await screen()), [], 'no overlaps in Electrical');
    await specs([E, Hy]); sameExcept(eh0, await screen(), [id], 'Electrical + Hydraulics'); assert.ok((await screen())[id], 'in Electrical + Hydraulics');
    await specs([]); sameExcept(f0, await screen(), [id], 'All specialties'); assert.ok((await screen())[id], 'in All specialties');
    assert.strictEqual(JSON.stringify(layouts()[`ph-sd~${M}`]), mech0, 'Mechanical only untouched');
    assert.strictEqual(draft().steps.filter(s => s.name === 'Lighting report addendum').length, 1, 'once in the data');
    // the new Electrical action becomes Mechanical: it leaves Electrical and gets a free place in Mechanical only
    await specs([M]); const m0 = await screen();
    await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(200);
    await w.click(`#wfc-${newId} .wfc-more`); await H.sleep(150);
    await w.selectOption(`#wfs-${newId}-s`, M); await H.saved(w); await H.sleep(200);
    await specs([M]); const m1 = await screen();
    assert.ok(m1[newId], 'now in Mechanical'); sameExcept(m0, m1, [newId], 'Mechanical'); assert.deepStrictEqual(overlaps(m1), [], 'no overlaps in Mechanical');
    await specs([E]); assert.ok(!(await screen())[newId], 'no longer in Electrical');
  });

  await step('8 · Auto layout rearranges only the view where it runs', async () => {
    await specs([]); const f0 = await screen();
    await specs([E, Hy]); const eh0 = await screen();
    await specs([E]); const e0 = await screen();
    await w.click('[data-wflay=auto]'); await H.saved(w); await H.sleep(250);
    assert.notDeepStrictEqual(await screen(), e0, 'Electrical rearranged');
    await specs([E, Hy]); assert.deepStrictEqual(await screen(), eh0, 'Electrical + Hydraulics unchanged');
    await specs([]); assert.deepStrictEqual(await screen(), f0, 'All specialties unchanged');
    await specs([E]); await w.click('[data-wflay=undo]'); await H.sleep(250);
    assert.deepStrictEqual(await screen(), e0, 'Undo in Electrical brings its layout back');
  });

  await step('7 · restarting keeps every view (all specialties, filters, All phases) and their zoom', async () => {
    await specs([E]);
    const z = async target => { for (let i = 0; i < 20 && Math.abs((await zoom()) - target) > 0.01; i++) { await w.click(`[data-wflay=${(await zoom()) < target ? 'zoom-in' : 'zoom-out'}]`); await H.sleep(80); } };
    await z(0.8);
    const views = {};
    for (const [k, l] of [['all', []], ['e', [E]], ['eh', [E, Hy]], ['m', [M]]]) { await specs(l); views[k] = await screen(); }
    await specs([]); await openStd('_all'); views.glob = await screen();
    await openStd(); await w.click('[data-act=wf-save]'); await H.saved(w); await H.sleep(1500);
    await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w);
    await openStd();
    for (const [k, l] of [['all', []], ['e', [E]], ['eh', [E, Hy]], ['m', [M]]]) { await specs(l); assert.deepStrictEqual(await screen(), views[k], 'after restart: ' + k); }
    await specs([E]); assert.ok(Math.abs((await zoom()) - 0.8) < 0.01, 'Electrical keeps its 80 %');
    await specs([]); assert.ok(Math.abs((await zoom()) - 1) < 0.01, 'All specialties keeps 100 %');
    await openStd('_all'); samePos(views.glob, await screen(), 'All phases after restart');
    const pub = rec(records(dbFile), 'workflow').layout;
    assert.ok(pub['ph-sd'] && pub[`ph-sd~${E}`] && pub[`ph-sd~${E}+${Hy}`] && pub._global, 'all views published with the standard');
    // existing data
    const rs = records(dbFile), Tk = new Map(rs.filter(r => r.coll === 'tasks').map(r => [r.id, r.data]));
    for (const t of FX.data.tasks) { const x = Tk.get(t.id); assert.ok(x, t.id); for (const f of ['projectId', 'status', 'due', 'assignedToId']) assert.deepStrictEqual(x[f] ?? null, t[f] ?? null, `${t.id}.${f}`); }
    const steps = new Map(rec(rs, 'workflow').steps.map(s => [s.id, s]));
    for (const s of FX.data.workflow.steps) for (const dp of s.deps) assert.ok(steps.get(s.id).deps.includes(dp), `${s.id} keeps ${dp}`);
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('workflow views');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
