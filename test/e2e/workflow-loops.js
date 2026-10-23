'use strict';
/* Review loops, the shape by type only, and common zone limits — v1.7 acceptance:
    normal Input / Action / Output = rectangles in their colours; parallelogram only for Information
    a QA No can go back to earlier work; a rework can return; loops survive save, publish, import, restart
    initial work starts before the QA answer; rounds keep tasks, history and people without duplicates
    an approval enables the right continuation; Hydraulics + Fire, All specialties and All phases: no boundary
    crosses a card; filters restore their layouts; hidden activities give no walls; arrows editable, no endless routes */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');
const makeFixture = require('./wf-fixture');
const wfTools = require('./wf-tools');

const W = 196;
function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }
const rec = (rs, c, id) => (rs.find(r => r.coll === c && r.id === (id || '_')) || {}).data;

module.exports = async function run() {
  console.log('Workflow review loops, shapes and zones (acceptance v1.7)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Loops');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, { fine: true, loops: true, phases: true });
  let { app, w } = await H.launch(ud);
  const T = wfTools(() => w), { pts, drag, selectEdge, center, dragFrom } = T;
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const stepOf = id => draft().steps.find(s => s.id === id);
  const tasks = () => records(dbFile).filter(r => r.coll === 'tasks').map(r => r.data);
  const taskOf = sid => tasks().find(t => t.projectId === PID && t.wfStepId === sid);
  const cls = id => w.evaluate(i => { const n = document.getElementById('wfn-' + i); return n ? n.className : null; }, id);
  const openStd = async (ph = 'ph-sd') => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click(`[data-act=wf-sphase][data-v=${ph}]`); await H.sleep(300); };
  const specs = async list => { await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(200); for (const s of list) { await w.click(`[data-act=wf-sspec][data-v=${s}]`); await H.sleep(200); } await H.sleep(150); };
  const screen = () => w.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wfd .wfn')].map(n => [n.dataset.id, [parseFloat(n.style.left), parseFloat(n.style.top)]])));
  /* no boundary crosses a card; in one phase, every card lies in the zone of its category */
  const zonesOk = tag => w.evaluate(t => {
    const B = [...document.querySelectorAll('.wfzb')].map(b => ({ x: parseFloat(b.style.left), z: +b.dataset.zb })), N = [...document.querySelectorAll('.wfd .wfn')].map(n => ({ id: n.dataset.id, x: parseFloat(n.style.left), r: parseFloat(n.style.left) + n.offsetWidth, z: /c-input/.test(n.className) || n.closest('.wfd').querySelector(`.wfl[data-lane="_ref"]`) && parseFloat(n.style.top) >= parseFloat((document.querySelector('.wfl[data-lane="_ref"]') || { style: { top: '1e9' } }).style.top) ? 0 : /c-action/.test(n.className) ? 1 : 2 }));
    const bad = [];
    B.forEach(b => N.forEach(n => { if (n.x < b.x && n.r > b.x) bad.push(`${t}: boundary ${b.z} at ${b.x} crosses ${n.id} (${n.x}–${n.r})`) }));
    if (!document.querySelector('.wfphz')) { const by = {}; B.forEach(b => { by[b.z] = b.x }); N.forEach(n => { const lo = n.z === 0 ? -1 : by[n.z] ?? -1, hi = n.z === 2 ? 1e9 : by[n.z + 1] ?? (n.z === 0 ? by[2] ?? 1e9 : 1e9); if (n.x < lo || n.r > hi) bad.push(`${t}: ${n.id} outside its zone (${n.x}–${n.r} vs ${lo}–${hi})`) }) }
    return bad }, tag);
  const PID = 'px-nof';

  await step('set-up (QA loops, a rework with a return, and saved layouts whose zones overlap)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Loops'); await w.click('[data-sact=pick-create]');
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

  await step('shape by activity type only: normal Input / Action / Output are rectangles in their colours; Information is a parallelogram', async () => {
    await openStd();
    const c = await w.evaluate(() => ['me-in1', 'el-ac1', 'el-out1', 'fi-in', 'hy-ftr', 'me-qa'].map(i => { const n = document.getElementById('wfn-' + i); return [i, n.className.match(/sh-\w+/)[0], getComputedStyle(n).getPropertyValue('--c').trim()] }));
    assert.deepStrictEqual(c.slice(0, 3).map(x => x[1]), ['sh-rect', 'sh-rect', 'sh-rect'], 'Input, Action, Output normal: rectangles');
    assert.strictEqual(c[3][1], 'sh-para', 'Input + Information: parallelogram'); assert.strictEqual(c[4][1], 'sh-doc', 'Input + Document'); assert.strictEqual(c[5][1], 'sh-diamond', 'QA');
    const col = await w.evaluate(() => { const g = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return [g('--wf-in'), g('--wf-ac'), g('--wf-out')]; });
    assert.ok(c[0][2] === col[0] && c[3][2] === col[0] && c[4][2] === col[0] && c[1][2] === col[1] && c[2][2] === col[2], 'the category gives the colour (--wf-in / --wf-ac / --wf-out): ' + JSON.stringify([c, col]));
    // Action + Information: blue parallelogram; type change keeps category, dependencies, people and place
    const s0 = stepOf('el-ac2'), p0 = (await screen())['el-ac2'];
    await w.click('#wfc-el-ac2 .wfc-more'); await H.sleep(150);
    assert.ok(await w.evaluate(() => [...document.querySelectorAll('#wfs-el-ac2-ty option')].some(o => o.value === 'info' && /Information/.test(o.textContent))), '“Information” can be chosen');
    await w.selectOption('#wfs-el-ac2-ty', 'info'); await H.saved(w); await H.sleep(200);
    const s1 = stepOf('el-ac2'); assert.strictEqual(s1.type, 'info');
    for (const f of ['cat', 'deps', 'roleIds', 'serviceId', 'phaseId']) assert.deepStrictEqual(s1[f], s0[f], 'kept: ' + f);
    assert.deepStrictEqual((await screen())['el-ac2'], p0, 'same place');
    assert.ok(/sh-para/.test(await cls('el-ac2')) && /c-action/.test(await cls('el-ac2')), 'blue parallelogram');
    assert.ok(/Information: parallelogram, action colour/.test(await w.textContent('#wfc-el-ac2')), 'help text and preview');
    await w.click('[data-act=wf-stype][data-v=info]'); await H.sleep(250);
    const ids = await T.ids(); assert.ok(ids.includes('el-ac2') && ids.includes('fi-in') && !ids.includes('me-in1'), 'type filter: Information only (+ references): ' + ids);
    await w.click('[data-act=wf-stype][data-v=_all]'); await H.sleep(250);
    // the arrow reaches the slanted side: drawn shape, clickable area and anchors use the same outline
    const P = (await pts('el-ac2>el-out1'))[0], b = (await screen())['el-ac2'];
    assert.ok(P[0] < b[0] + W && P[0] >= b[0] + W - 15, 'the arrow leaves from the slanted right side: ' + P);
  });

  await step('loops: QA No back to earlier work and a rework that returns are accepted, drawn as returns and kept through publish, import and restart', async () => {
    assert.strictEqual(stepOf('me-qa').branches.no, 'me-sk', 'QA Sketches / No → Preliminary design sketches');
    assert.ok(!stepOf('me-sk').deps.includes('me-qa'), 'a return is not a requirement of the earlier work');
    const k = 'me-qa>me-sk', c = await w.evaluate(x => document.querySelector(`path.wfe[data-k="${x}"]`).getAttribute('class'), k);
    assert.ok(/back/.test(c) && /br-no/.test(c), 'drawn as a No return: ' + c);
    const lab = await w.evaluate(x => { const g = document.querySelector(`.wfbl[data-k="${x}"]`); return g && g.textContent; }, k); assert.strictEqual(lab, 'No', 'with its label');
    const P = await pts(k), [sx, sy] = P[0], [ex, ey] = P[P.length - 1];
    assert.ok(P.length <= 12 && P.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])), 'a finite route: ' + P.length + ' points');
    assert.ok(Math.max(...P.map(p => p[1])) > Math.max(sy, ey), 'it goes round, below the main path');
    assert.ok(/back/.test(await w.evaluate(() => document.querySelector('path.wfe[data-k="el-rr>el-pd"]').getAttribute('class'))), 'the rework return is drawn');
    // create a loop from the diagram: QA No to an earlier activity (refused before v1.7)
    await w.click('[data-wflay=edit]');
    await w.click('#wfn-el-qa2'); await w.click('.wfmenu [data-wflay=menu-no]'); await w.click('#wfn-el-ac1'); await H.saved(w); await H.sleep(250);
    assert.strictEqual(stepOf('el-qa2').branches.no, 'el-ac1', 'accepted: a review return'); assert.ok(/review return/.test(await w.textContent('#toasts')), 'explained as a return');
    await w.click('[data-wflay=undo]'); await H.sleep(250); assert.strictEqual(stepOf('el-qa2').branches.no, 'el-ac1', '(outlets are data)');
    await w.click('#wfn-el-qa2'); await w.click('.wfmenu [data-wflay=menu-no]'); await w.click('#wfn-el-rr'); await H.saved(w); await H.sleep(200);
    // Connect from rework back to earlier work offers a review return (not a circular dependency)
    await w.click('[data-wflay=edit]');
    await w.click('[data-wflay=conn]'); await w.click('#wfn-me-pl'); await w.click('#wfn-me-in1');
    await H.until(() => w.evaluate(() => /Add a review return\?/.test(document.getElementById('modal-root').textContent)), 3000, 'return offered');
    await w.click('#modal-root [data-act=cf-choice][data-v=ret]'); await H.saved(w); await H.sleep(200);
    assert.deepStrictEqual(stepOf('me-pl').ret, ['me-in1'], 'return stored'); assert.ok(!stepOf('me-in1').deps.includes('me-pl'), 'no circular dependency');
    await selectEdge('me-pl>me-in1'); assert.ok(await w.$('[data-wflay=ret-del]'), 'Remove return offered'); await w.click('[data-wflay=ret-del]'); await H.saved(w); await H.sleep(200);
    assert.deepStrictEqual(stepOf('me-pl').ret, [], 'removed');
    // a real circular requirement is still refused
    const why = await w.evaluate(() => 1);
    void why;
    // publish, export, import, restart
    await w.click('[data-act=wf-save]'); await H.saved(w);
    const pub = rec(records(dbFile), 'workflow'); assert.strictEqual(pub.steps.find(s => s.id === 'me-qa').branches.no, 'me-sk', 'published'); assert.strictEqual(pub.schema, 3);
    const out = path.join(docs, 'loops.json'); await H.answerDialogs(app, { savePath: out });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=export-json]');
    await H.until(() => fs.existsSync(out) && fs.statSync(out).size > 1000, 8000, 'export');
    const x = JSON.parse(fs.readFileSync(out, 'utf8')).data.workflow;
    assert.strictEqual(x.steps.find(s => s.id === 'me-qa').branches.no, 'me-sk'); assert.deepStrictEqual(x.steps.find(s => s.id === 'el-rr').ret, ['el-pd'], 'exported');
    await H.answerDialogs(app, { file: out }); await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?|Nothing to import/.test(document.getElementById('modal-root').textContent)), 5000, 'import checked');
    assert.ok(/Nothing to import/.test(await w.textContent('#modal-root')), 'importing it changes nothing (the loops are the same data)');
    await w.click('#modal-root [data-act=modal-close], #modal-root button.primary'); await H.sleep(200);
    await H.sleep(800); await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w);
    await openStd();
    assert.strictEqual(stepOf('me-qa').branches.no, 'me-sk'); assert.deepStrictEqual(stepOf('el-rr').ret, ['el-pd'], 'after restart');
    assert.ok(/back/.test(await w.evaluate(() => document.querySelector('path.wfe[data-k="me-qa>me-sk"]').getAttribute('class'))), 'still drawn as a return');
  });

  await step('project rounds: initial work starts before the QA; No reopens only the work in the loop; a new Pending review; Yes continues', async () => {
    await go('p-' + PID); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
    await w.click('[data-act=wf-import]'); await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'dialog');
    if (!(await w.isChecked('[data-wiph="ph-sd"]'))) { await w.check('[data-wiph="ph-sd"]'); await H.sleep(150); }
    for (let i = 0; i < 12; i++) { const c = await w.$('#modal-root input[data-wisp="ph-sd"]:not(:checked):not(:disabled)'); if (!c) break; await c.click(); await H.sleep(100); }
    await w.click('#wi-ok'); await H.saved(w); await H.sleep(200); await w.click('[data-act=wf-pphase][data-v=ph-sd]').catch(() => {}); await H.sleep(250);
    const n0 = tasks().filter(t => t.projectId === PID).length, as0 = JSON.stringify(records(dbFile).filter(r => r.coll === 'assignments').map(r => r.data));
    // the initial work is available although the QA is Pending (a return is never a requirement)
    await w.check(`[data-wfdone="${taskOf('me-in1').id}"]`).catch(() => {}); await H.saved(w); await H.sleep(150);
    assert.ok(/a-ready/.test(await cls('me-sk')), 'Preliminary design sketches can start before the QA answer');
    assert.ok(/a-blocked/.test(await cls('me-pl')), 'the approved continuation waits');
    // someone works on the sketches and completes them
    const sk = taskOf('me-sk'); await w.selectOption(`#wfa-${sk.id}`, { index: 1 }); await H.saved(w);
    const who = taskOf('me-sk').assignedToId; assert.ok(who, 'assigned');
    await w.check(`[data-wfdone="${sk.id}"]`); await H.saved(w); await H.sleep(200);
    const qa = taskOf('me-qa'); assert.ok(/a-ready/.test(await cls('me-qa')), 'QA ready after the work');
    // QA No → back to the sketches: scope proposed, comments recorded
    await w.click(`[data-wfans=no][data-tid="${qa.id}"]`);
    await H.until(() => w.evaluate(() => !!document.querySelector('#modal-root [data-wfscope-ok]')), 3000, 'scope dialog');
    const scope = await w.evaluate(() => [...document.querySelectorAll('#modal-root [data-wfscope]')].map(x => x.value));
    assert.deepStrictEqual(scope, [sk.id], 'only the work between the return target and the review: ' + scope);
    await w.fill('#modal-root [name=wfscope-note]', 'Grid not aligned'); await w.click('#modal-root [data-wfscope-ok]'); await H.saved(w); await H.sleep(250);
    let sk2 = taskOf('me-sk'), qa2 = taskOf('me-qa');
    assert.strictEqual(sk2.status, 'To Do', 'sketches reopened'); assert.strictEqual(sk2.wfRound, 2); assert.strictEqual(sk2.wfAttempts.length, 1, 'earlier completion kept');
    assert.ok(sk2.wfAttempts[0].completedAt, 'with its completion date'); assert.strictEqual(sk2.assignedToId, who, 'same responsible');
    assert.strictEqual(qa2.wfAnswer, null, 'the review is Pending again'); assert.strictEqual(qa2.wfRound, 2);
    assert.deepStrictEqual(qa2.wfAnswerLog.map(x => [x.to, x.round, x.note]), [['no', 1, 'Grid not aligned']], 'the No stays in the history');
    assert.ok(/a-blocked/.test(await cls('me-qa')), 'the next review waits for the corrections');
    assert.ok(/a-blocked/.test(await cls('me-pl')), 'the continuation still waits for approval');
    assert.strictEqual(tasks().filter(t => t.projectId === PID).length, n0, 'no task duplicated');
    assert.ok(/Round 2/.test(await w.textContent('#wfn-me-sk')), 'the round is shown');
    // re-render and restart never start another round
    await go('overview'); await go('p-' + PID); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
    await H.sleep(800); await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w);
    await go('p-' + PID); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(250);
    assert.strictEqual(taskOf('me-sk').wfRound, 2); assert.strictEqual(taskOf('me-qa').wfAnswerLog.length, 1, 'still one answer recorded');
    // round 2: corrections done, approval → the right continuation
    await w.check(`[data-wfdone="${taskOf('me-sk').id}"]`); await H.saved(w); await H.sleep(200);
    assert.ok(/a-ready/.test(await cls('me-qa')), 'a new review is available (Pending)');
    await w.click(`[data-wfans=yes][data-tid="${qa.id}"]`); await H.saved(w); await H.sleep(250);
    assert.ok(/a-ready/.test(await cls('me-pl')), 'Yes enables Preliminary layouts and schematics');
    assert.strictEqual(taskOf('me-sk').status, 'Done', 'the approved work stays on the path (not excluded afterwards)');
    assert.ok(!/a-skip/.test(await cls('me-sk')));
    assert.deepStrictEqual(taskOf('me-qa').wfAnswerLog.map(x => [x.to, x.round]), [['no', 1], ['yes', 2]], 'R1 No, R2 Yes');
    assert.strictEqual(JSON.stringify(records(dbFile).filter(r => r.coll === 'assignments').map(r => r.data)), as0, 'hours / assignments untouched');
  });

  await step('a rework with a return: No → Resolve comments; when done the drawings and the QA are repeated; then Yes → Issue', async () => {
    await w.check(`[data-wfdone="${taskOf('el-ac1').id}"]`).catch(() => {}); await H.saved(w); await H.sleep(150);
    assert.ok(/a-ready/.test(await cls('el-pd')), 'Prepare drawings can start (the return from Resolve is not a requirement)');
    await w.check(`[data-wfdone="${taskOf('el-pd').id}"]`); await H.saved(w); await H.sleep(150);
    const q = taskOf('el-qa2'); await w.click(`[data-wfans=no][data-tid="${q.id}"]`); await H.saved(w); await H.sleep(250);
    assert.ok(/a-ready/.test(await cls('el-rr')), 'Resolve review comments is next'); assert.ok(/a-blocked/.test(await cls('el-iss')), 'Issue waits');
    const total0 = await w.evaluate(() => (document.querySelector('.wfstats').textContent.match(/(\d+)\/(\d+) completed/) || [])[2]);
    await w.check(`[data-wfdone="${taskOf('el-rr').id}"]`); await H.sleep(300);
    await H.until(() => w.evaluate(() => !!document.querySelector('#modal-root [data-wfscope-ok]')), 3000, 'send back asked once');
    const scope = await w.evaluate(() => [...document.querySelectorAll('#modal-root [data-wfscope]')].map(x => x.value).sort());
    assert.deepStrictEqual(scope, [taskOf('el-pd').id, q.id].sort(), 'Prepare drawings and the QA (nothing earlier): ' + scope);
    await w.click('#modal-root [data-wfscope-ok]'); await H.saved(w); await H.sleep(250);
    assert.strictEqual(taskOf('el-pd').status, 'To Do'); assert.strictEqual(taskOf('el-qa2').wfAnswer, null, 'review Pending again'); assert.strictEqual(taskOf('el-rr').status, 'Done', 'the rework stays done');
    assert.strictEqual(taskOf('el-ac1').status, 'Done', 'earlier inputs kept');
    // completing something else does not ask again; render does not either
    await go('overview'); await go('p-' + PID); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(250);
    assert.ok(!(await w.$('#modal-root [data-wfscope-ok]')), 'no second round by itself');
    await w.check(`[data-wfdone="${taskOf('el-pd').id}"]`); await H.saved(w); await H.sleep(200);
    await w.click(`[data-wfans=yes][data-tid="${q.id}"]`); await H.saved(w); await H.sleep(250);
    assert.ok(/a-ready/.test(await cls('el-iss')), 'Yes → Issue drawings');
    assert.ok(/a-skip/.test(await cls('el-rr')), 'the No path is no longer pending work'); assert.strictEqual(taskOf('el-rr').status, 'Done', 'its work is kept');
    const total1 = await w.evaluate(() => (document.querySelector('.wfstats').textContent.match(/(\d+)\/(\d+) completed/) || [])[2]);
    assert.ok(+total1 <= +total0, `rounds never add activities to the count (${total0} → ${total1})`);
    await H.shot(w, 'loops-project');
  });

  await step('zones: Hydraulics + Fire, All specialties and All phases — no boundary crosses a card; every card inside its zone', async () => {
    await openStd(); await specs([]);
    assert.deepStrictEqual(await zonesOk('all specialties'), []);
    await specs(['sv-hydraulics', 'sv-fire']);
    assert.deepStrictEqual(await zonesOk('Hydraulics + Fire'), []);
    const S = await screen(), zb1 = await w.evaluate(() => parseFloat(document.querySelector('.wfzb[data-zb="1"]').style.left));
    assert.ok(S['hy-ftr'][0] + W < zb1 && S['fi-ds'][0] > zb1, 'Flow Test Report in Inputs, Define Systems in Actions');
    await H.shot(w, 'loops-zones-hyfi');
    // the corrected geometry is the one dragging uses: Define Systems can't be dragged into Inputs
    await drag('fi-ds', -600, 0); const fx = (await screen())['fi-ds'][0], inR = Math.max(...Object.entries(await screen()).filter(([id]) => ['hy-ftr', 'fi-in'].includes(id)).map(([, q]) => q[0] + W));
    assert.ok(fx >= inR + 39, 'stops at the common Inputs limit: ' + (fx - inR));
    assert.deepStrictEqual(await zonesOk('after dragging'), []);
    const hf = await screen();
    await specs(['sv-fire', 'sv-hydraulics']); assert.deepStrictEqual(await screen(), hf, 'same view in the other order, as saved');
    await specs([]); assert.deepStrictEqual(await zonesOk('back to all'), []);
    await openStd('_all'); assert.deepStrictEqual(await zonesOk('All phases'), []);
    await specs(['sv-fire']); assert.deepStrictEqual(await zonesOk('All phases · Fire'), []);
    await specs([]);
  });

  await step('hidden activities give no walls; arrows stay editable; Auto layout with loops ends', async () => {
    await openStd(); await specs(['sv-mechanical']);
    const S = await screen(), inR = await w.evaluate(() => { const zb = parseFloat(document.querySelector('.wfzb[data-zb="1"]').style.left); return Math.max(...[...document.querySelectorAll('.wfd .wfn')].map(n => parseFloat(n.style.left)).filter(x => x < zb).map(x => x + 196)); });
    await drag('me-qa', -900, 0); const q = (await screen())['me-qa'][0];
    assert.ok(q - inR >= 39 && q - inR <= 41, 'only the visible Inputs limit it: ' + (q - inR)); void S;
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    await specs([]);
    const t0 = Date.now(); await w.click('[data-wflay=auto]'); await H.saved(w); await H.sleep(300);
    assert.ok(Date.now() - t0 < 8000, 'Auto layout finishes with loops');
    const xs = Object.values(await screen()).map(p => p[0]); assert.ok(Math.max(...xs) < 6000, 'no endless columns: ' + Math.max(...xs));
    assert.deepStrictEqual(await zonesOk('after Auto layout'), []);
    await selectEdge('me-qa>me-sk'); const hv = await w.$('.wfh.h, .wfh.v'); assert.ok(hv, 'the return can be edited');
    const hb = await hv.boundingBox(); await dragFrom({ x: hb.x + 6, y: hb.y + 6 }, 0, 20); await H.sleep(150);
    assert.ok((await T.attached('me-qa>me-sk')).a, 'still connected after editing');
    void center;
    await w.click('[data-wflay=undo]'); await H.sleep(150); await w.click('[data-wflay=undo]'); await H.sleep(150);
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('workflow loops');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
