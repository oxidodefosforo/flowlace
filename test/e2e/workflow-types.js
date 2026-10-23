'use strict';
/* Activity types, Decision / QA outlets with project answers, multiple selection and moving — v1.6 acceptance:
    types created and edited (shapes: Decision amber rhombus, QA violet rhombus + label, Document wavy bottom)
    outlets to existing or new activities; answers per project; the path not chosen neither blocks nor counts
    shared activities once; A does not drag C and B does not block A; A + C together; A + B + C as a block
    hidden activities give no limits; arrows stay connected; one Undo per block move; Fire above Coordination;
    layouts and views kept; earlier data still works */
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
  console.log('Workflow types, outlets, answers and selection (acceptance v1.6)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Types');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, { fine: true, types: true });
  let { app, w } = await H.launch(ud);
  const T = wfTools(() => w), { box, pts, center, dragFrom, drag, noToasts } = T;
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const stepOf = id => draft().steps.find(s => s.id === id);
  const taskOf = (pid, sid) => records(dbFile).filter(r => r.coll === 'tasks').map(r => r.data).find(t => t.projectId === pid && t.wfStepId === sid);
  const openStd = async (ph = 'ph-sd') => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click(`[data-act=wf-sphase][data-v=${ph}]`); await H.sleep(300); };
  const screen = () => w.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wfd .wfn')].map(n => [n.dataset.id, [parseFloat(n.style.left), parseFloat(n.style.top)]])));
  const cls = id => w.evaluate(i => { const n = document.getElementById('wfn-' + i); return n ? n.className : null; }, id);
  const nameId = n => w.evaluate(x => { const b = [...document.querySelectorAll('.wfd .wfn')].find(e => e.querySelector('.wfn-n').textContent === x); return b && b.dataset.id; }, n);
  const clickNode = async (id, mod) => { const c = await center('#wfn-' + id); if (mod) await w.keyboard.down(mod); await w.mouse.click(c.x, c.y); if (mod) await w.keyboard.up(mod); await H.sleep(200); };
  const specs = async list => { await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(200); for (const s of list) { await w.click(`[data-act=wf-sspec][data-v=${s}]`); await H.sleep(200); } };
  const PID = 'px-nof', PID2 = 'px-jps';

  await step('set-up (Decision, QA, Documents, and A / B / C from the screenshot)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Types'); await w.click('[data-sact=pick-create]');
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

  await step('earlier data opens with compatible default types; Fire sits above Coordination', async () => {
    const st = draft().steps;
    assert.strictEqual(st.find(s => s.id === 'el-ac1').type, 'normal', 'a step without type gets “normal”');
    assert.strictEqual(st.find(s => s.id === 'co-in1').type, 'document');
    assert.deepStrictEqual(st.find(s => s.id === 'el-dec').branches, { yes: 'el-yes', no: 'el-no' }, 'outlets kept');
    await openStd();
    const lanes = await w.evaluate(() => [...document.querySelectorAll('.wfl[data-lane]')].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top)).map(l => l.dataset.lane));
    assert.ok(lanes.indexOf('sv-fire') >= 0 && lanes.indexOf('sv-fire') < lanes.indexOf('sv-coordination'), 'lanes: ' + lanes);
    assert.strictEqual(lanes[lanes.indexOf('sv-coordination') + 1] || '_ref', '_ref', 'Coordination is the last specialty lane');
    const chips = await w.evaluate(() => [...document.querySelectorAll('[data-act=wf-sspec]')].map(b => b.dataset.v).filter(v => v !== '_all'));
    assert.strictEqual(chips[chips.length - 1], 'sv-coordination', 'Coordination last in the specialty selector: ' + chips);
  });

  await step('shapes: Decision amber rhombus, QA violet rhombus with “QA”, Document wavy bottom, Inputs/Outputs parallelograms', async () => {
    const c = await cls('el-dec'); assert.ok(/sh-diamond/.test(c) && /t-decision/.test(c), c);
    const q = await cls('co-qa'); assert.ok(/sh-diamond/.test(q) && /t-qa/.test(q), q);
    assert.strictEqual((await w.textContent('#wfn-co-qa .wfn-qa')).trim(), 'QA', 'QA label');
    const col = await w.evaluate(() => ({ d: getComputedStyle(document.querySelector('#wfn-el-dec .wfn-sh path')).stroke, q: getComputedStyle(document.querySelector('#wfn-co-qa .wfn-sh path')).stroke }));
    assert.ok(/183, 121, 31|240, 180, 76/.test(col.d), 'amber: ' + col.d); assert.ok(/124, 58, 237|183, 148, 246/.test(col.q), 'violet: ' + col.q);
    assert.ok(/sh-doc/.test(await cls('co-in1')) && /C/.test(await w.evaluate(() => document.querySelector('#wfn-co-in1 .wfn-sh path').getAttribute('d'))), 'document: wavy bottom');
    assert.ok(/sh-para/.test(await cls('me-in1')) && /sh-para/.test(await cls('el-out1')), 'normal Input / Output: parallelogram');
    assert.ok(/sh-rect/.test(await cls('el-ac1')), 'normal Action: rectangle');
    const clip = await w.evaluate(() => getComputedStyle(document.getElementById('wfn-el-dec')).clipPath);
    assert.ok(/polygon/.test(clip), 'the clickable area follows the rhombus');
    // arrows end on the outline: into the rhombus at its left vertex, the No outlet from its bottom vertex
    const d = await box('el-dec'), into = (await pts('el-ac1>el-dec')).pop(), no = (await pts('el-dec>el-no'))[0];
    assert.ok(Math.abs(into[0] - (d.x - 2)) <= 3 && Math.abs(into[1] - (d.y + HB / 2)) <= 12, 'arrow reaches the rhombus outline: ' + into);
    assert.ok(Math.abs(no[0] - (d.x + W / 2)) <= 2 && Math.abs(no[1] - (d.y + HB)) <= 2, 'No leaves from the bottom vertex: ' + no);
    await H.shot(w, 'types-shapes');
  });

  await step('Yes / No outlets: labelled branches; set from the diagram and to a new activity; pending outlets flagged', async () => {
    const lab = await w.evaluate(() => [...document.querySelectorAll('.wfbl')].map(g => [g.dataset.k, g.textContent.trim(), g.getAttribute('class')]));
    assert.ok(lab.some(([k, t, c]) => k === 'el-dec>el-yes' && t === 'Yes' && /br-yes/.test(c)) && lab.some(([k, t]) => k === 'el-dec>el-no' && t === 'No'), 'labels: ' + JSON.stringify(lab));
    assert.ok(/br-yes/.test(await w.evaluate(() => document.querySelector('path.wfe[data-k="el-dec>el-yes"]').getAttribute('class'))), 'Yes in green class');
    // a new Decision from the matrix: no outlets yet → flagged, nothing created
    const n0 = draft().steps.length;
    await w.selectOption('#wf-add-action-t', 'decision'); await w.selectOption('#wf-add-action-sp', 'sv-mechanical'); await w.fill('#wf-add-action', 'Is a smoke exhaust needed?'); await w.press('#wf-add-action', 'Enter'); await H.saved(w); await H.sleep(300);
    const dec = await nameId('Is a smoke exhaust needed?'); assert.ok(dec, 'created');
    assert.strictEqual(stepOf(dec).type, 'decision'); assert.strictEqual(draft().steps.length, n0 + 1, 'only the decision was created');
    assert.ok(/Yes and No outlets not set/.test(await w.textContent('#wfn-' + dec)), 'pending outlets shown on the block');
    // Yes → an existing activity, from the block menu
    await clickNode(dec); await w.click('.wfmenu [data-wflay=menu-yes]'); await H.sleep(150);
    assert.ok(/Click the activity that follows/.test(await w.textContent('.wflay-ctx')));
    await clickNode('me-ac2'); await H.saved(w); await H.sleep(200);
    assert.strictEqual(stepOf(dec).branches.yes, 'me-ac2', 'Yes → Mechanical schematic layout'); assert.ok(stepOf('me-ac2').deps.includes(dec), 'the link is also a requirement of the target');
    // No → a new activity, from the editor
    await clickNode(dec); await w.click('.wfmenu [data-wflay=menu-details]');
    await H.until(() => w.evaluate(() => !!document.querySelector('#wffloat [data-wfbr=no]')), 3000, 'outlets in the editor');
    assert.ok(await w.$('#wffloat .wfty-prev svg'), 'shape preview in the editor');
    await w.selectOption('#wffloat [data-wfbr=no]', '_new');
    await H.until(() => w.evaluate(() => !!document.querySelector('#modal-root form[data-form=wf-newbr]')), 3000, 'new activity form');
    await w.fill('#modal-root input[name=name]', 'Natural ventilation only'); await w.click('#modal-root button.primary'); await H.saved(w); await H.sleep(300);
    const nw = draft().steps.find(s => s.name === 'Natural ventilation only'); assert.ok(nw, 'new activity created on request');
    assert.strictEqual(stepOf(dec).branches.no, nw.id); assert.ok(nw.deps.includes(dec));
    assert.ok(!/outlet/.test(await w.textContent('#wfn-' + dec)), 'no pending flag any more');
    await w.keyboard.press('Escape'); await H.sleep(150);
    // a loop is refused
    await clickNode(dec); await w.click('.wfmenu [data-wflay=menu-no]'); await clickNode('me-ac2'); await H.sleep(250);
    assert.strictEqual(stepOf(dec).branches.no, nw.id, 'Yes and No cannot lead to the same activity: refused, unchanged');
    assert.ok(/already the Yes outlet/.test(await w.textContent('#toasts')), 'with the reason');
  });

  await step('changing the type keeps everything; leaving Decision asks what to do with its outlets', async () => {
    const s0 = stepOf('el-ac2');
    await w.click('[data-act=wf-exp][data-id=el-ac2]').catch(() => {}); await H.sleep(150);
    if (!(await w.$('#wfs-el-ac2-ty'))) { await w.click('#wfc-el-ac2 .wfc-more'); await H.sleep(150); }
    await w.selectOption('#wfs-el-ac2-ty', 'document'); await H.saved(w); await H.sleep(200);
    const s1 = stepOf('el-ac2'); assert.strictEqual(s1.type, 'document');
    for (const f of ['id', 'name', 'desc', 'cat', 'phaseId', 'serviceId']) assert.deepStrictEqual(s1[f], s0[f], 'kept: ' + f);
    assert.deepStrictEqual(s1.deps, s0.deps, 'dependencies kept'); assert.deepStrictEqual(s1.roleIds, s0.roleIds, 'roles kept');
    assert.ok(/sh-doc/.test(await cls('el-ac2')), 'new shape drawn');
    // a Decision with outlets → Standard: explained and resolved before saving
    const dec = draft().steps.find(s => s.name === 'Is a smoke exhaust needed?').id;
    if (!(await w.$(`#wfs-${dec}-ty`))) { await w.click(`#wfc-${dec} .wfc-more`); await H.sleep(150); }
    await w.selectOption(`#wfs-${dec}-ty`, 'normal');
    await H.until(() => w.evaluate(() => /Change the activity type\?/.test(document.getElementById('modal-root').textContent)), 3000, 'explained');
    assert.ok(/Mechanical schematic layout/.test(await w.textContent('#modal-root')), 'lists the outlets');
    await w.click('#modal-root [data-act=cf-no]'); await H.sleep(200);
    assert.strictEqual(stepOf(dec).type, 'decision', 'cancel: nothing changed');
    await w.selectOption(`#wfs-${dec}-ty`, 'normal'); await H.until(() => w.evaluate(() => !!document.querySelector('#modal-root [data-act=cf-choice][data-v=keep]')), 3000, 'choice');
    await w.click('#modal-root [data-act=cf-choice][data-v=keep]'); await H.saved(w); await H.sleep(200);
    const s2 = stepOf(dec); assert.strictEqual(s2.type, 'normal'); assert.deepStrictEqual(s2.branches, { yes: null, no: null }); assert.ok(stepOf('me-ac2').deps.includes(dec), 'kept as a normal dependency');
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    assert.strictEqual(stepOf(dec).type, 'normal', 'type changes are data (Undo restores layout and dependencies only)');
  });

  await step('type filter: independent of category, specialty and phase; its own view', async () => {
    await w.click('[data-act=wf-stype][data-v=decision]'); await H.sleep(150); await w.click('[data-act=wf-stype][data-v=qa]'); await H.sleep(250);
    const ids = await T.ids(), st = draft().steps;
    const own = ids.filter(id => { const s = st.find(x => x.id === id); return s && (s.type === 'decision' || s.type === 'qa'); });
    assert.ok(own.includes('el-dec') && own.includes('co-qa') && !ids.includes('el-ac3'), 'only Decision / QA (plus what they need, as references): ' + ids);
    await drag('co-qa', 0, 30); await H.saved(w);
    assert.ok(Object.keys(draft().layout).some(k => /\^decision\+qa$/.test(k)), 'stored as its own view: ' + Object.keys(draft().layout));
    await w.click('[data-act=wf-stype][data-v=_all]'); await H.sleep(250);
  });

  await step('A does not drag C, B does not block A; A + C move together with B fixed; A + B + C as a block; one Undo', async () => {
    await openStd(); await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(200);
    const s0 = await screen(), A0 = s0['me-a'], B0 = s0['me-b'], C0 = s0['me-c'];
    await drag('me-a', 320, 0);
    let s1 = await screen();
    assert.ok(Math.abs(s1['me-a'][0] - A0[0] - 320) <= 8, 'A moved the whole way: ' + (s1['me-a'][0] - A0[0]));
    assert.deepStrictEqual(s1['me-c'], C0, 'C did not move'); assert.deepStrictEqual(s1['me-b'], B0, 'B did not move');
    for (const k of ['me-a>me-c', 'me-b>me-c']) { const at = await T.attached(k); assert.ok(at.a && at.b, 'arrow still connected: ' + k); }
    await drag('me-a', -320, 0); s1 = await screen(); assert.ok(Math.abs(s1['me-a'][0] - A0[0]) <= 8, 'and back to the left, nothing in the way');
    // A + C selected (Ctrl+click), B stays
    const before = await screen();
    await clickNode('me-a'); await clickNode('me-c', 'Control');
    assert.ok(/2 activities selected/.test(await w.textContent('.wfgrpbox')), 'outline with the counter');
    await drag('me-a', 60, 0);
    const s2 = await screen(), dA = [s2['me-a'][0] - before['me-a'][0], s2['me-a'][1] - before['me-a'][1]], dC = [s2['me-c'][0] - before['me-c'][0], s2['me-c'][1] - before['me-c'][1]];
    assert.deepStrictEqual(dA, dC, 'A and C moved by the same offset: ' + JSON.stringify([dA, dC]));
    assert.ok(dA[0] > 30, 'moved: ' + dA);
    assert.deepStrictEqual(s2['me-b'], before['me-b'], 'B fixed');
    await w.click('[data-wflay=undo]'); await H.sleep(250);
    const s3 = await screen(); assert.deepStrictEqual([s3['me-a'], s3['me-c']], [before['me-a'], before['me-c']], 'one Undo puts both back');
    // A + B + C with a rectangle on empty space, then moved as a block
    await w.keyboard.press('Escape'); await H.sleep(150);
    const a = await (await w.$('#wfn-me-a')).boundingBox(), c = await (await w.$('#wfn-me-c')).boundingBox(), b = await (await w.$('#wfn-me-b')).boundingBox();
    const X0 = Math.min(a.x, b.x, c.x), Y0 = Math.min(a.y, b.y, c.y), X1 = Math.max(a.x + a.width, b.x + b.width, c.x + c.width), Y1 = Math.max(a.y + a.height, b.y + b.height, c.y + c.height);
    const st = await w.evaluate(([x0, y0]) => { for (let dy = 4; dy < 40; dy += 3) for (let dx = 4; dx < 60; dx += 3) { const e = document.elementFromPoint(x0 - dx, y0 - dy); if (e && e.closest('.wfd') && !e.closest('.wfn,.wfe-hit,.wfzb')) return [x0 - dx, y0 - dy]; } return [x0 - 10, y0 - 6]; }, [X0, Y0]);
    const exp = await w.evaluate(([x0, y0, x1, y1]) => [...document.querySelectorAll('.wfd .wfn')].filter(n => { const r = n.getBoundingClientRect(); return r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0; }).map(n => n.dataset.id).sort(), [st[0], st[1], X1 + 6, Y1 + 6]);
    await noToasts(); await w.mouse.move(st[0], st[1]); await w.mouse.down(); await w.mouse.move(X1 + 6, Y1 + 6, { steps: 8 }); await w.mouse.up(); await H.sleep(250);
    const sel = await w.evaluate(() => [...document.querySelectorAll('.wfn.multi')].map(n => n.dataset.id).sort());
    assert.ok(['me-a', 'me-b', 'me-c'].every(x => sel.includes(x)), 'rectangle selected A, B and C: ' + sel);
    assert.deepStrictEqual(sel, exp, 'exactly the visible activities the rectangle touches');
    assert.ok(/activities selected/.test(await w.textContent('.wfgrpbox')));
    const b0 = await screen(); await drag('me-b', 40, 30); const b1 = await screen();
    const off = id => [b1[id][0] - b0[id][0], b1[id][1] - b0[id][1]];
    for (const id of sel) assert.deepStrictEqual(off(id), off('me-b'), 'same offset for ' + id);
    assert.ok(off('me-b')[0] >= 30, 'block moved');
    // Esc during a block drag restores
    const cb = await center('#wfn-me-a'); await w.mouse.move(cb.x, cb.y); await w.mouse.down(); await w.mouse.move(cb.x + 80, cb.y + 40, { steps: 6 });
    await w.keyboard.press('Escape'); await w.mouse.up(); await H.sleep(250);
    assert.deepStrictEqual(await screen(), b1, 'Esc: positions and arrows as before');
    await w.click('[data-wflay=undo]'); await H.sleep(250); assert.deepStrictEqual(await screen(), b0, 'block move undone in one step');
    // a click on empty space clears the selection
    await w.mouse.click(st[0], st[1]); await H.sleep(200);
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('.wfn.multi').length), 0, 'a click on empty space deselects');
    await H.shot(w, 'types-selection');
  });

  await step('“Move with successors” (off by default) shows what moves before dragging; dependencies are never walls', async () => {
    assert.ok(!(await w.isChecked('[data-wflay-succ]')), 'off by default');
    await w.check('[data-wflay-succ]'); await H.sleep(200);
    await w.mouse.move(5, 5); await w.hover('#wfn-me-a'); await H.sleep(150);
    assert.ok(/mv-sel/.test(await cls('me-a')) && /mv-auto/.test(await cls('me-c')) && !/mv-/.test(await cls('me-b')), 'A (chosen) and C (added) highlighted, B not');
    const s0 = await screen(); await drag('me-a', 50, 0); const s1 = await screen();
    assert.strictEqual(s1['me-c'][0] - s0['me-c'][0], s1['me-a'][0] - s0['me-a'][0], 'C moved with A'); assert.deepStrictEqual(s1['me-b'], s0['me-b'], 'B stays');
    await w.click('[data-wflay=undo]'); await H.sleep(200); await w.uncheck('[data-wflay-succ]'); await H.sleep(150);
    // Mechanical only: C goes left up to the visible Inputs (its requirements A and B do not stop it)
    await specs(['sv-mechanical']);
    const S = await screen(), inRight = await w.evaluate(() => { const zb = parseFloat(document.querySelector('.wfzb[data-zb="1"]').style.left); return Math.max(...[...document.querySelectorAll('.wfd .wfn')].map(n => parseFloat(n.style.left)).filter(x => x < zb).map(x => x + 196)); });
    await drag('me-c', -900, 0); const c1 = await box('me-c');
    assert.ok(c1.x - inRight >= 39 && c1.x - inRight <= 41, `C reached the minimum space after the Inputs (${c1.x - inRight}), left of its requirements`);
    assert.ok(c1.x < S['me-a'][0], 'and to the left of A: the arrow adapts');
    const at = await T.attached('me-a>me-c'); assert.ok(at.a && at.b, 'arrow connected (routed back to the left)');
    await w.click('[data-wflay=undo]'); await H.sleep(200); await specs([]);
  });

  await step('Pan tool and Space + drag move the view; selecting never scrolls the page', async () => {
    const wr = () => w.evaluate(() => { const r = document.querySelector('.wfd-wrap'); return [r.scrollLeft, r.scrollTop]; });
    await w.evaluate(() => { const r = document.querySelector('.wfd-wrap'); r.scrollLeft = 300; }); await H.sleep(100);
    await w.click('[data-wflay=tool-pan]'); await H.sleep(150);
    await w.evaluate(() => document.querySelector('.wfd-wrap').scrollIntoView({ block: 'start' })); await H.sleep(150);
    const freePt = async () => { await w.evaluate(() => document.querySelector('.wfd-wrap').scrollIntoView({ block: 'start' })); await H.sleep(100); const bb = await (await w.$('.wfd-wrap')).boundingBox();
      return w.evaluate(([x0, y0, x1, y1]) => { for (let y = y0 + 40; y < y1 - 20; y += 9) for (let x = x0 + 140; x < x1 - 160; x += 13) { const e = document.elementFromPoint(x, y); if (e && e.closest('.wfd') && !e.closest('.wfn,.wfe-hit,.wfzb,.wfgrp')) return [x, y]; } return [x0 + 200, y0 + 60]; }, [bb.x, Math.max(bb.y, 0), bb.x + bb.width, Math.min(bb.y + bb.height, 860)]); };
    const r0 = await wr();let [px, py] = await freePt();
    await w.mouse.move(px, py); await w.mouse.down(); await w.mouse.move(px - 120, py, { steps: 6 }); await w.mouse.up(); await H.sleep(150);
    const r1 = await wr(); assert.ok(r1[0] - r0[0] >= 100, 'Pan moved the view: ' + [r0, r1]);
    await w.click('[data-wflay=tool-select]'); await H.sleep(150);
    const p0 = await box('el-ac1');
    [px, py] = await freePt(); const r1b = await wr();
    await w.mouse.move(px, py); await w.keyboard.down('Space'); await H.sleep(50); await w.mouse.down(); await w.mouse.move(px + 140, py, { steps: 6 }); await w.mouse.up(); await w.keyboard.up('Space'); await H.sleep(150);
    const r2 = await wr(); assert.ok(r1b[0] - r2[0] >= 80, 'Space + drag panned: ' + [r1b, r2]); assert.deepStrictEqual(await box('el-ac1'), p0, 'nothing moved');
    const m0 = await w.evaluate(() => document.getElementById('main').scrollTop); await clickNode('el-ac1');
    assert.strictEqual(await w.evaluate(() => document.getElementById('main').scrollTop), m0, 'page scroll kept');
  });

  await step('project: answers per project (Pending / Yes / No); the path not chosen neither blocks nor counts; shared activities once', async () => {
    await openStd(); await w.click('[data-act=wf-save]'); await H.saved(w);
    const importAll = async pid => {
      await go('p-' + pid); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
      await w.click('[data-act=wf-import]'); await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'dialog');
      if (!(await w.isChecked('[data-wiph="ph-sd"]'))) { await w.check('[data-wiph="ph-sd"]'); await H.sleep(150); }
      for (let i = 0; i < 12; i++) { const c = await w.$('#modal-root input[data-wisp="ph-sd"]:not(:checked):not(:disabled)'); if (!c) break; await c.click(); await H.sleep(100); }
      await w.click('#wi-ok'); await H.saved(w); await H.sleep(200);
      await w.click(`[data-act=wf-pphase][data-v=ph-sd]`).catch(() => {}); await H.sleep(250);
    };
    await importAll(PID2); await importAll(PID);
    const tDec = taskOf(PID, 'el-dec'); assert.ok(tDec && tDec.wfAnswer == null, 'starts Pending: ' + JSON.stringify(tDec && tDec.wfAnswer));
    assert.ok(/a-blocked/.test(await cls('el-yes')) && /a-blocked/.test(await cls('el-no')), 'both outlets wait for the answer');
    const done0 = await w.evaluate(() => document.querySelector('.wfstats').textContent);
    // a Decision cannot be completed without an answer
    await w.check(`[data-wfdone="${tDec.id}"]`).catch(() => {}); await H.sleep(250);
    assert.notStrictEqual(taskOf(PID, 'el-dec').status, 'Done', 'not completed while Pending');
    assert.ok(/needs an answer/.test(await w.textContent('#toasts')), 'explained');
    // assign someone to the Yes branch first (kept later)
    // answer No
    await w.click(`[data-wfans=no][data-tid="${tDec.id}"]`); await H.saved(w); await H.sleep(250);
    assert.strictEqual(taskOf(PID, 'el-dec').wfAnswer, 'no');
    assert.ok(/a-skip/.test(await cls('el-yes')), 'Yes branch not on the chosen path (dimmed)');
    assert.ok(/a-ready/.test(await cls('el-no')), 'No branch available');
    assert.ok(/b-off/.test(await w.evaluate(() => document.querySelector('path.wfe[data-k="el-dec>el-yes"]').getAttribute('class'))) && /b-on/.test(await w.evaluate(() => document.querySelector('path.wfe[data-k="el-dec>el-no"]').getAttribute('class'))), 'chosen path highlighted, the other faded');
    assert.ok(/not on the chosen path/.test(await w.textContent('.wfstats')), 'counted apart: ' + await w.textContent('.wfstats'));
    const tot = s => +(s.match(/(\d+)\/(\d+) completed/) || [])[2];
    assert.strictEqual(tot(await w.textContent('.wfstats')), tot(done0) - 1, 'one activity less of pending work');
    assert.strictEqual(taskOf(PID, 'el-yes').status, 'To Do', 'the path not chosen is not marked done');
    // the join: one shared activity, it waits only for the chosen path
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('#wfn-el-join').length), 1, 'shared activity once');
    assert.ok(/a-blocked/.test(await cls('el-join')), 'join waits for the chosen path');
    await w.check(`[data-wfdone="${taskOf(PID, 'el-ac1').id}"]`); await H.saved(w);
    await w.check(`[data-wfdone="${taskOf(PID, 'el-no').id}"]`); await H.saved(w); await H.sleep(200);
    assert.ok(/a-ready/.test(await cls('el-join')), 'join available with the No path only');
    await w.check(`[data-wfdone="${tDec.id}"]`); await H.saved(w); await H.sleep(200);
    assert.strictEqual(taskOf(PID, 'el-dec').status, 'Done', 'completed with its answer');
    // change the answer: what changes is shown; work and history kept
    await w.click(`[data-wfans=yes][data-tid="${tDec.id}"]`);
    await H.until(() => w.evaluate(() => /Change the answer\?/.test(document.getElementById('modal-root').textContent)), 3000, 'confirm');
    const msg = await w.textContent('#modal-root'); assert.ok(/Continue with normal supply/.test(msg) && /Size emergency power supply/.test(msg), 'affected activities listed');
    await w.click('#modal-root [data-act=cf-yes]'); await H.saved(w); await H.sleep(200);
    assert.strictEqual(taskOf(PID, 'el-no').status, 'Done', 'work on the other path kept');
    assert.ok(/a-skip/.test(await cls('el-no')) && !/a-skip/.test(await cls('el-yes')), 'paths swapped');
    assert.strictEqual(taskOf(PID, 'el-dec').wfAnswerLog.length, 2, 'answer history');
    // QA records its own result
    const tQa = taskOf(PID, 'co-qa'); assert.ok(await w.$(`.wfans.qa [data-tid="${tQa.id}"]`), 'QA answered on the QA itself');
    await w.click(`[data-wfans=no][data-tid="${tQa.id}"]`); await H.saved(w); await H.sleep(200);
    assert.ok(/a-skip/.test(await cls('co-issue')) && !/a-skip/.test(await cls('co-fix')), 'QA No → corrections');
    // the other project and the standard are untouched
    assert.strictEqual(taskOf(PID2, 'el-dec').wfAnswer, null, 'other project still Pending');
    const stdDec = rec(records(dbFile), 'workflow').steps.find(s => s.id === 'el-dec');
    assert.ok(!('wfAnswer' in stdDec) && stdDec.branches.yes === 'el-yes', 'the standard keeps only the definition');
    await H.shot(w, 'types-project');
  });

  await step('restart: types, outlets, answers, selections’ results and views are kept', async () => {
    await openStd(); const s0 = await screen(); await H.sleep(1200);
    await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w);
    await openStd(); assert.deepStrictEqual(await screen(), s0, 'layout kept');
    assert.ok(/sh-diamond/.test(await cls('co-qa')) && /sh-doc/.test(await cls('el-ac2')), 'shapes kept');
    assert.strictEqual(taskOf(PID, 'el-dec').wfAnswer, 'yes'); assert.strictEqual(taskOf(PID, 'co-qa').wfAnswer, 'no');
    const rs = records(dbFile), Tk = new Map(rs.filter(r => r.coll === 'tasks').map(r => [r.id, r.data]));
    for (const t of FX.data.tasks) { const x = Tk.get(t.id); assert.ok(x, t.id); for (const f of ['projectId', 'status', 'due', 'assignedToId']) assert.deepStrictEqual(x[f] ?? null, t[f] ?? null, `${t.id}.${f}`); }
    assert.ok(rs.filter(r => r.coll === 'roles').length >= 7, 'roles kept');
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('workflow types');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
