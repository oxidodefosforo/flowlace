'use strict';
/* All phases, full screen and canvas size — acceptance checks of v1.4:
    1 All phases shows the whole flow in the company's phase order      2 arrows between phases join the real activities (no duplicates)
    3 back to one phase keeps its own layout (and zoom)                  4 full screen uses the window and keeps the controls
    5 Add prerequisites and Show details work in full screen            6 entering / leaving keeps selection, changes and position
    7 no white strip next to the drawing                                8 changing the zoom resizes the scrollable area (Fit to view, 100 %)
    9 arrows and bends stay visible and selectable                     10 existing data keeps its information (also the project view) */
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
  console.log('Workflow: All phases, full screen and canvas (acceptance v1.4)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Global');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, { fine: true, phases: true });
  let { app, w } = await H.launch(ud);
  const T = wfTools(() => w), { box, allPos, pts, allD, vert, picked, zoom, view, center, dragFrom, drag, selectEdge, noToasts } = T;
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const layOf = k => ((draft().layout || {})[k]) || {};
  const deps = id => draft().steps.find(s => s.id === id).deps.slice().sort();
  const openStd = async (ph = 'ph-sd') => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click(`[data-act=wf-sphase][data-v=${ph}]`); await H.sleep(300); };
  const phaseHeads = () => w.evaluate(() => [...document.querySelectorAll('.wfphz')].map(x => ({ id: x.dataset.ph, l: parseFloat(x.style.left), r: parseFloat(x.style.left) + parseFloat(x.style.width), t: x.textContent.trim() })));
  const canvas = () => w.evaluate(() => { const wr = document.querySelector('.wfd-wrap'), d = document.querySelector('.wfd'), z = d.getBoundingClientRect().width / d.offsetWidth, dr = d.getBoundingClientRect(), wb = wr.getBoundingClientRect();
    const right = Math.max(...[...d.querySelectorAll('.wfn')].map(n => parseFloat(n.style.left) + n.offsetWidth)), bottom = Math.max(...[...d.querySelectorAll('.wfn')].map(n => parseFloat(n.style.top) + n.offsetHeight));
    const lanes = [...d.querySelectorAll('.wfl')].map(l => parseFloat(l.style.width) * z), zr = [...d.querySelectorAll('.wfz')].map(x => (parseFloat(x.style.left) + parseFloat(x.style.width)) * z);
    return { cw: wr.clientWidth, ch: wr.clientHeight, sw: wr.scrollWidth, sh: wr.scrollHeight, z, dw: dr.width, dh: dr.height, right, bottom, lanes: Math.min(...lanes), zonesRight: Math.max(...zr), wbw: wb.width, wbh: wb.height }; });
  const setZoom = async z => { for (let i = 0; i < 30 && Math.abs((await zoom()) - z) > 0.01; i++) { await w.click(`[data-wflay=${(await zoom()) < z ? 'zoom-in' : 'zoom-out'}]`); await H.sleep(80); } };
  const inside = r => w.evaluate(r => { const R = r; return R.left >= -1 && R.top >= -1 && R.right <= innerWidth + 1 && R.bottom <= innerHeight + 1; }, r);
  const rectOf = sel => w.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, sel);
  const onTop = sel => w.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(20, r.height / 2)); return !!t && (e === t || e.contains(t)); }, sel);
  const PH = ['ph-fee', 'ph-sd', 'ph-dd', 'ph-ti'];
  let tasks0 = 0, P_sd = null, P_all = null;

  await step('set-up (Fee → Sketch → Design Development → Tender Issue)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Global'); await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary'); await H.appReady(w);
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    await w.click('#modal-root [data-act=modal-close]');
    await H.answerDialogs(app, { file: FX.file });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    await w.check('#modal-root input[name=imp-diff][value=replace]'); await w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 10000, 'imported'); await H.saved(w);
    tasks0 = records(dbFile).filter(r => r.coll === 'tasks').length;
  });

  await step('1 · All phases: one diagram in the company’s phase order; Inputs → Actions → Outputs inside each phase; lanes aligned', async () => {
    await openStd('_all');
    assert.ok(await w.evaluate(() => document.querySelector('[data-act=wf-sphase][data-v=_all]').getAttribute('aria-selected') === 'true'), '“All phases” selected next to the phases');
    const heads = await phaseHeads();
    assert.deepStrictEqual(heads.map(h => h.id), PH, 'phases left to right in the configured order');
    assert.ok(/Fee/.test(heads[0].t) && /Design Development/.test(heads[2].t), 'each header shows its phase name');
    assert.ok(await w.evaluate(() => [...document.querySelectorAll('.wfphz')].every(x => getComputedStyle(x).getPropertyValue('--c').trim())), 'and its colour');
    assert.ok(await w.evaluate(() => document.querySelectorAll('.wfzb.ph').length === 3), 'a boundary between consecutive phases');
    for (let i = 1; i < heads.length; i++) assert.ok(heads[i].l >= heads[i - 1].r - 1, 'phase columns do not overlap');
    const P = await allPos(), st = draft().steps.filter(s => !s.retired), byPh = id => heads.find(h => h.id === id);
    for (const s of st) { const p = P[s.id], h = byPh(s.phaseId); assert.ok(p, 'shown: ' + s.id); assert.ok(p.x >= h.l && p.x + W <= h.r + 1, `${s.id} inside ${s.phaseId}`); }
    const zoneOf = s => ({ input: 0, action: 1, output: 2 })[s.cat];
    for (const a of st) for (const b of st) if (a.phaseId === b.phaseId && zoneOf(a) < zoneOf(b)) assert.ok(P[a.id].x < P[b.id].x, `${a.id} (${a.cat}) left of ${b.id} (${b.cat})`);
    const lanes = await w.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wfl[data-lane]')].map(l => [l.dataset.lane, [parseFloat(l.style.top), parseFloat(l.style.top) + parseFloat(l.style.height)]])));
    assert.ok(!lanes._ref, 'no “Other phases” band: every phase is in the view');
    for (const s of st) { const L = lanes[s.serviceId]; assert.ok(L && P[s.id].y >= L[0] && P[s.id].y + HB <= L[1], s.id + ' in its specialty lane, the same lane across phases'); }
    // compact: no big empty gap between phases
    for (let i = 1; i < heads.length; i++) { const prev = st.filter(s => s.phaseId === heads[i - 1].id), cur = st.filter(s => s.phaseId === heads[i].id);
      const gap = Math.min(...cur.map(s => P[s.id].x)) - Math.max(...prev.map(s => P[s.id].x + W)); assert.ok(gap > 40 && gap <= 160, `space between ${heads[i - 1].id} and ${heads[i].id}: ${gap}`); }
    await H.shot(w, 'global-all');
  });

  await step('2 · arrows between phases join the real activities; each activity once; references only for what filters hide', async () => {
    const ids = await T.ids(); assert.strictEqual(new Set(ids).size, ids.length, 'no duplicated blocks');
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('.wfn.ref').length), 0, 'no reference cards');
    for (const k of ['fee-co-out>co-in1', 'co-ac1>co-dd-in1', 'el-out1>el-dd-ac1', 'me-out2>me-dd-ac1', 'co-dd-out1>co-ti-out1']) {
      const at = await T.attached(k); assert.ok(at.a && at.b, 'arrow between phases joins both blocks: ' + k); }
    assert.ok(/Send architectural layouts/.test(await w.textContent('#wfn-fee-co-out')) && !/From Fee/.test(await w.textContent('#wfn-fee-co-out')), 'the Fee output is its own block, not a “From Fee” card');
    assert.deepStrictEqual(deps('co-in1'), ['fee-co-out'], 'dependencies unchanged');
    // Electrical only: what Electrical needs from Coordination stays, once, as a reference in its own phase
    await w.click('[data-act=wf-sspec][data-v=sv-electrical]'); await H.sleep(250);
    const refs = await w.evaluate(() => [...document.querySelectorAll('.wfn.ref')].map(n => n.dataset.id));
    assert.ok(refs.includes('co-dd-in1') && refs.includes('co-in1'), 'requirements outside the filter kept as references: ' + refs);
    const ids2 = await T.ids(); assert.strictEqual(new Set(ids2).size, ids2.length, 'still once each');
    const heads = await phaseHeads(), dd = heads.find(h => h.id === 'ph-dd'), p = await box('co-dd-in1');
    assert.ok(p.x >= dd.l && p.x <= dd.r, 'the reference sits in its own phase');
    assert.ok(await T.attached('co-dd-in1>el-dd-ac1'), 'and keeps its connection');
    await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(250);
  });

  await step('3 · each view keeps its own layout and zoom: a phase and All phases do not overwrite each other', async () => {
    await openStd('ph-sd');
    await drag('hy-ac1', 0, 60); P_sd = await allPos();
    const sd0 = JSON.stringify(layOf('ph-sd'));
    await openStd('_all');
    const ti0 = await box('co-ti-out1'); await drag('co-ti-out1', 0, 90); P_all = await allPos();
    assert.ok(P_all['co-ti-out1'].y - ti0.y >= 80, 'moved in All phases');
    await setZoom(0.8);
    assert.ok(layOf('_global').n && layOf('_global').n['co-ti-out1'], 'All phases has its own stored layout');
    assert.strictEqual(JSON.stringify(layOf('ph-sd')), sd0, 'the phase layout is not touched by All phases');
    await openStd('ph-sd');
    const back = await allPos(); for (const id of Object.keys(P_sd)) assert.deepStrictEqual(back[id], P_sd[id], 'phase layout kept: ' + id);
    assert.ok(Math.abs((await zoom()) - 1) < 0.01, 'the phase keeps its own zoom (100 %)');
    await openStd('_all');
    const again = await allPos(); for (const id of Object.keys(P_all)) assert.deepStrictEqual(again[id], P_all[id], 'All phases layout kept: ' + id);
    assert.ok(Math.abs((await zoom()) - 0.8) < 0.01, 'All phases keeps 80 %');
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    assert.strictEqual((await box('co-ti-out1')).y, ti0.y, 'Undo in All phases');
    await w.click('[data-wflay=redo]'); await H.sleep(200);
  });

  let v0 = null;
  await step('4 · Full screen covers the window and keeps phase / filters / zoom / edit / Undo / exit controls', async () => {
    await setZoom(1);
    // selection and position before entering
    const nb = await (await w.$('#wfn-el-dd-ac1')).boundingBox(); await w.mouse.click(nb.x + 40, nb.y + 30); await H.sleep(200);
    await w.keyboard.press('Escape'); await H.sleep(100);   // close its menu, keep the selection
    await w.evaluate(() => { const r = document.querySelector('.wfd-wrap'); r.scrollLeft = 900; }); await H.sleep(500);
    v0 = await view(); const main0 = await w.evaluate(() => document.getElementById('main').scrollTop);
    await w.click('[data-wflay=fs]'); await H.sleep(300);
    const r = await rectOf('.wfdia.fs'), vp = await w.evaluate(() => [innerWidth, innerHeight]);
    assert.ok(r && r.left <= 0.5 && r.top <= 0.5 && Math.abs(r.width - vp[0]) <= 1 && Math.abs(r.height - vp[1]) <= 1, 'covers the window: ' + JSON.stringify([r, vp]));
    assert.ok(await w.evaluate(() => getComputedStyle(document.querySelector('.top')).display === 'none'), 'general navigation hidden');
    const wr = await rectOf('.wfd-wrap'); assert.ok(wr.height > vp[1] * 0.7 && wr.width > vp[0] * 0.95, 'the canvas takes the remaining space: ' + JSON.stringify(wr));
    for (const s of ['.wfdia.fs [data-act=wf-sphase][data-v=_all]', '.wfdia.fs [data-act=wf-sphase][data-v=ph-sd]', '.wfdia.fs [data-act=wf-sspec]', '[data-wflay=zoom-in]', '[data-wflay=fit-view]', '[data-wflay=edit]', '[data-wflay=undo]', '[data-wflay=redo]', '[data-wflay=auto]', '[data-wflay=fs]'])
      assert.ok(await onTop(s), 'control visible and usable: ' + s);
    assert.ok(/Exit full screen/.test(await w.textContent('[data-wflay=fs]')), 'exit button');
    assert.ok(await w.evaluate(() => document.getElementById('wfn-el-dd-ac1').classList.contains('sel')), 'selection kept');
    const v1 = await view(); assert.ok(Math.abs(v1.wl - v0.wl) <= 1 && v1.z === v0.z, 'same zoom and horizontal position: ' + JSON.stringify([v0, v1]));
    assert.ok(!(await onTop('.wfm')), 'the matrix is not shown');
    void main0;
    await H.shot(w, 'global-fullscreen');
  });

  await step('5 · in full screen: move, align, segments, anchors, boundaries, Add prerequisites, Show details, Auto layout', async () => {
    // move a block
    const p0 = await box('me-dd-ac1'); await drag('me-dd-ac1', 0, 50);
    assert.ok(Math.abs((await box('me-dd-ac1')).y - p0.y - 50) <= 8, 'block moved (alignment guides may snap it a few px)');
    // an arrow between phases: select it by clicking the line, then move a segment
    const k = 'el-out1>el-dd-ac1'; await selectEdge(k);
    const hv = await w.$('.wfh.v'); if (hv) { const hx = +(await hv.getAttribute('x')) + 6; await dragFrom(await center('.wfh.v'), 30 * (await zoom()), 0);
      assert.ok(vert(await pts(k)).some(s => Math.abs(s.x - (hx + 30)) <= 7), 'segment moved in full screen'); }
    const at = await T.attached(k); assert.ok(at.a && at.b, 'still attached');
    // an anchor to the top side
    const e2 = await center('.wfend[data-wfend=b]'), tb = await (await w.$('#wfn-el-dd-ac1')).boundingBox();
    await dragFrom(e2, tb.x + tb.width * 0.4 - e2.x, tb.y + 1 - e2.y);
    assert.strictEqual((await T.attached(k)).b, 't', 'anchor moved to the top side');
    await w.keyboard.press('Escape'); await H.sleep(100);
    assert.ok(await w.$('.wfdia.fs'), 'the first Esc only cleared the arrow selection');
    // a zone boundary (Edit layout)
    await w.click('[data-wflay=edit]'); const o1 = await box('co-ti-out1');
    await dragFrom(await center('.wfzb.ph[data-zb="11"], .wfzb[data-zb="11"]'), 40 * (await zoom()), 0);
    assert.strictEqual((await box('co-ti-out1')).x - o1.x, 40, 'phase boundary moved Tender Issue');
    await w.click('[data-wflay=edit]');
    // the block menu and the floating editors inside full screen
    const nb = await (await w.$('#wfn-co-ti-out1')).boundingBox(); await w.mouse.click(nb.x + 40, nb.y + 30); await H.sleep(200);
    assert.ok(await onTop('.wfmenu'), 'menu visible in full screen');
    await w.click('.wfmenu [data-wflay=menu-prereq]');
    await H.until(() => w.evaluate(() => !!document.querySelector('#wffloat .wfdp')), 3000, 'picker');
    assert.ok(await inside(await rectOf('#wffloat')) && await onTop('#wffloat'), 'the picker is inside and above the full screen surface');
    await w.click('#wffloat [data-wfdf=phases][data-v=_all]'); await H.sleep(120);
    await w.check('#wffloat input[data-wfdep="co-ti-out1"][value="el-dd-out1"]'); await H.saved(w);
    assert.deepStrictEqual(deps('co-ti-out1'), ['co-dd-out1', 'el-dd-out1'], 'prerequisite added');
    assert.ok(await pts('el-dd-out1>co-ti-out1'), 'arrow drawn');
    await w.keyboard.press('Escape'); await H.sleep(150);
    assert.ok(!(await w.$('#wffloat')) && await w.$('.wfdia.fs'), 'Esc closes the picker first; still in full screen');
    await w.mouse.click(nb.x + 40, nb.y + 30); await H.sleep(200);
    await w.click('.wfmenu [data-wflay=menu-details]');
    await H.until(() => w.evaluate(() => !!document.querySelector('#wffloat textarea')), 3000, 'details');
    assert.ok(await inside(await rectOf('#wffloat')) && await onTop('#wffloat'), 'details inside the full screen surface');
    await w.click('#wffloat textarea'); await w.keyboard.type('Issued for tender.'); await w.keyboard.press('Tab'); await H.saved(w);
    assert.strictEqual(draft().steps.find(s => s.id === 'co-ti-out1').desc, 'Issued for tender.', 'details saved');
    await w.click('#wffloat .wff-f [data-wff-close]'); await H.sleep(150);
    // Auto layout and back
    await w.click('[data-wflay=auto]'); await H.saved(w); await H.sleep(200);
    assert.ok(await w.$('.wfdia.fs'), 'Auto layout in full screen');
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    assert.ok(!(await w.$('.wfmenu')), 'no menu left open');
    await H.shot(w, 'global-fs-edit');
  });

  await step('6 · Esc leaves full screen keeping selection, changes and position; nothing is published', async () => {
    const pub0 = rec(records(dbFile), 'workflow').version, P0 = await allPos();
    const nb = await (await w.$('#wfn-el-dd-ac1')).boundingBox(); await w.mouse.click(nb.x + 40, nb.y + 30); await H.sleep(200);
    const vfs = await view();
    await w.keyboard.press('Escape'); await H.sleep(150);
    assert.ok(await w.$('.wfdia.fs') && !(await w.$('.wfmenu')), 'first Esc closes the menu');
    await w.keyboard.press('Escape'); await H.sleep(300);
    assert.ok(!(await w.$('.wfdia.fs')), 'second Esc leaves full screen');
    assert.ok(await w.evaluate(() => getComputedStyle(document.querySelector('.top')).display !== 'none'), 'navigation back');
    assert.ok(await w.evaluate(() => document.getElementById('wfn-el-dd-ac1').classList.contains('sel')), 'selection kept');
    const v2 = await view(); assert.ok(Math.abs(v2.wl - vfs.wl) <= 2 && v2.z === vfs.z, 'same horizontal position and zoom: ' + JSON.stringify([vfs, v2]));
    assert.deepStrictEqual(await allPos(), P0, 'changes kept');
    assert.strictEqual(rec(records(dbFile), 'workflow').version, pub0, 'the standard was not published');
    assert.ok(rec(records(dbFile), 'workflowDraft'), 'changes stay in the draft');
    // the button too
    await w.click('[data-wflay=fs]'); await H.sleep(250); await w.click('[data-wflay=fs]'); await H.sleep(250);
    assert.ok(!(await w.$('.wfdia.fs')), 'the same button leaves full screen');
    // a single phase in full screen
    await openStd('ph-sd'); await w.click('[data-wflay=fs]'); await H.sleep(250);
    assert.ok(await w.$('.wfdia.fs') && await onTop('.wfdia.fs [data-act=wf-sphase][data-v=ph-dd]'), 'full screen with one phase, phases selectable');
    await w.click('.wfdia.fs [data-act=wf-sphase][data-v=_all]'); await H.sleep(300);
    assert.ok(await w.$('.wfdia.fs') && (await phaseHeads()).length === 4, 'switching to All phases stays in full screen');
    await w.keyboard.press('Escape'); await H.sleep(200); await w.keyboard.press('Escape'); await H.sleep(250);
    assert.ok(!(await w.$('.wfdia.fs')), 'left');
  });

  await step('7 · no white strip: the canvas covers the visible area at any zoom; scrolling stops at the content', async () => {
    await openStd('ph-sd');
    for (const z of [1, 0.6, 0.4]) {
      await setZoom(z); const c = await canvas();
      assert.ok(c.dw >= c.cw - 1, `${z * 100} %: canvas as wide as the view (${c.dw} / ${c.cw})`);
      assert.ok(c.lanes >= c.cw - 1 && c.zonesRight >= c.cw - 1, `${z * 100} %: lanes and zone background reach the right edge`);
      const contentW = Math.ceil((c.right + 56) * z);
      assert.ok(c.sw <= Math.max(c.cw, contentW) + 2, `${z * 100} %: no scrolling into empty space (${c.sw} vs ${Math.max(c.cw, contentW)})`);
      await H.shot(w, 'global-canvas-' + Math.round(z * 100));
    }
    await setZoom(1);
    const c = await canvas();
    assert.ok(c.sw - Math.ceil(c.right) <= 56 + 2, 'right margin moderate: ' + (c.sw - c.right));
  });

  await step('8 · zoom, Fit to view and window size update the scrollable area; positions unchanged', async () => {
    await openStd('_all');
    const lay0 = JSON.stringify(layOf('_global')), P0 = await allPos();
    await setZoom(1); const a = await canvas();
    await setZoom(0.5); const b = await canvas();
    assert.ok(b.sw < a.sw * 0.7, 'zooming out shrinks the scroll width: ' + [a.sw, b.sw]);
    assert.ok(b.sw <= Math.max(b.cw, Math.ceil(a.sw * 0.5)) + 2, 'no leftover size from 100 %');
    await setZoom(1); const c = await canvas(); assert.ok(Math.abs(c.sw - a.sw) <= 2, 'back at 100 %: same size again');
    await w.click('[data-wflay=fit-view]'); await H.sleep(300);
    const f = await canvas();
    assert.ok(f.sw <= f.cw + 1, 'Fit to view: the whole width fits (' + f.sw + ' / ' + f.cw + ')');
    assert.ok(f.z < 1 && f.z >= 0.25, 'zoom adjusted: ' + f.z);
    assert.strictEqual(JSON.stringify(layOf('_global')), lay0, 'Fit to view does not change positions');
    assert.deepStrictEqual(await allPos(), P0, 'blocks in the same places');
    await w.click('[data-wflay=zoom-reset]'); await H.sleep(200);
    assert.ok(Math.abs((await zoom()) - 1) < 0.01 && /100%/.test(await w.textContent('[data-wflay=zoom-reset]')), '100 % button');
    // window size
    const size0 = w.viewportSize ? w.viewportSize() : null;
    await w.setViewportSize({ width: 1000, height: 760 }); await H.sleep(300);
    let r = await canvas(); assert.ok(r.dw >= r.cw - 1, 'after shrinking the window the canvas still fills it');
    await w.setViewportSize({ width: 1500, height: 900 }); await H.sleep(300);
    await setZoom(0.4); r = await canvas(); assert.ok(r.dw >= r.cw - 1 && r.sw <= r.cw + 1, 'after enlarging the window: filled, no extra scroll');
    if (size0) await w.setViewportSize(size0); else await w.setViewportSize({ width: 1280, height: 873 });
    await H.sleep(200); await setZoom(1);
    // full screen and back resize the canvas too
    await w.click('[data-wflay=fs]'); await H.sleep(300); r = await canvas(); assert.ok(r.dh >= r.ch - 1, 'full screen: the canvas covers the height');
    await w.click('[data-wflay=fs]'); await H.sleep(300); r = await canvas(); assert.ok(r.dw >= r.cw - 1, 'back: still fills the width');
  });

  await step('9 · arrows and bends stay visible and selectable (at 70 %); a bend below the last lane is not cut', async () => {
    await openStd('_all'); await setZoom(0.7);
    const k = 'co-ac1>co-dd-in1'; await selectEdge(k);
    const hs = await w.$$('.wfh'); assert.ok(hs.length >= 1, 'handles shown at 70 %');
    const hh = await w.$('.wfh.h') || hs[0], hy = +(await hh.getAttribute('y')) + 6, hb = await hh.boundingBox(), z = await zoom();
    const lastLane = await w.evaluate(() => { const l = [...document.querySelectorAll('.wfl')].pop(); return parseFloat(l.style.top) + parseFloat(l.style.height); });
    const dy = lastLane + 60 - hy; await dragFrom({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 0, dy * z);
    const P = await pts(k), maxY = Math.max(...P.map(p => p[1]));
    assert.ok(maxY > lastLane + 30, 'the bend went below the lanes: ' + maxY);
    const ht = await w.evaluate(() => parseFloat(document.querySelector('.wfd').style.height));
    assert.ok(ht >= maxY + 8, 'the canvas includes it (' + ht + ' ≥ ' + maxY + ')');
    const sh = await w.evaluate(() => document.querySelector('.wfd-wrap').scrollHeight);
    assert.ok(sh >= Math.floor(maxY * z), 'and the scroll reaches it');
    assert.strictEqual(await picked(), k, 'still selected');
    await w.keyboard.press('Escape'); await selectEdge(k);   // selectable again by clicking
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    const all = await allD(); assert.ok(Object.keys(all).length >= 20, 'every arrow drawn with a hit area');
    await setZoom(1);
  });

  await step('10 · project: All phases with real states and external inputs; opening it creates nothing; full screen works there', async () => {
    await openStd(); await w.click('[data-act=wf-save]'); await H.saved(w);
    await go('p-px-nof'); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
    const t0 = records(dbFile).filter(r => r.coll === 'tasks').length;
    await w.click('[data-act=wf-pphase][data-v=_all]').catch(() => {}); await H.sleep(300);
    assert.strictEqual(records(dbFile).filter(r => r.coll === 'tasks').length, t0, 'opening All phases creates no tasks');
    await w.click('[data-act=wf-import]'); await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'dialog');
    for (const ph of ['ph-sd', 'ph-dd']) { const sel = `[data-wiph="${ph}"]`; if (await w.$(sel) && !(await w.isChecked(sel))) { await w.check(sel); await H.sleep(150); } }
    for (let i = 0; i < 20; i++) { const c = await w.$('#modal-root input[data-wisp="ph-sd"]:not(:checked):not(:disabled), #modal-root input[data-wisp="ph-dd"]:not(:checked):not(:disabled)'); if (!c) break; await c.click(); await H.sleep(100); }
    await w.click('#wi-ok'); await H.saved(w); await H.sleep(300);
    await w.click('[data-act=wf-pphase][data-v=_all]').catch(() => {}); await H.sleep(300);
    const heads = await phaseHeads(); assert.ok(heads.length >= 2 && heads.every((h, i) => i === 0 || PH.indexOf(h.id) > PH.indexOf(heads[i - 1].id)), 'project phases in order: ' + heads.map(h => h.id));
    const ids = await T.ids(); assert.strictEqual(new Set(ids).size, ids.length, 'each activity once');
    assert.ok(await w.evaluate(() => [...document.querySelectorAll('.wfn')].some(n => /a-(ready|blocked|doing|done)/.test(n.className))), 'real states shown');
    assert.ok(await T.attached('el-out1>el-dd-ac1'), 'arrow between phases of the project');
    await w.click('[data-wflay=fs]'); await H.sleep(250);
    assert.ok(await w.$('.wfdia.fs') && await onTop('.wfdia.fs [data-act=wf-pphase][data-v=ph-sd]'), 'project full screen with its phase selector');
    await w.keyboard.press('Escape'); await H.sleep(250); assert.ok(!(await w.$('.wfdia.fs')), 'Esc leaves');
    await H.shot(w, 'global-project');
  });

  await step('10 · restart: All phases layout, phase layout and zoom per view kept; existing data intact', async () => {
    await openStd('_all'); await setZoom(0.9); const Pa = await allPos();
    await openStd('ph-sd'); const Ps = await allPos();
    await H.sleep(1500);   // personal view settings are saved a moment after the last change
    await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w);
    await openStd('_all'); assert.deepStrictEqual(await allPos(), Pa, 'All phases layout after restart'); assert.ok(Math.abs((await zoom()) - 0.9) < 0.01, 'its zoom too');
    await openStd('ph-sd'); assert.deepStrictEqual(await allPos(), Ps, 'phase layout after restart'); assert.ok(Math.abs((await zoom()) - 1) < 0.01, 'and its own zoom');
    const rs = records(dbFile), d = FX.data, by = c => new Map(rs.filter(r => r.coll === c).map(r => [r.id, r.data]));
    const P = by('projects'), Tk = by('tasks');
    assert.strictEqual(P.size, d.projects.length, 'projects');
    for (const t of d.tasks) { const x = Tk.get(t.id); assert.ok(x, t.id); for (const f of ['projectId', 'status', 'due', 'start', 'assignedToId', 'deliverableId', 'phaseId']) assert.deepStrictEqual(x[f] ?? null, t[f] ?? null, `${t.id}.${f}`); }
    assert.ok(rs.filter(r => r.coll === 'roles').length >= 7, 'roles');
    const steps = new Map(rec(rs, 'workflow').steps.map(s => [s.id, s]));
    for (const s of FX.data.workflow.steps) { const x = steps.get(s.id); assert.ok(x, s.id); assert.strictEqual(x.serviceId, s.serviceId); for (const dp of s.deps) assert.ok(x.deps.includes(dp), `${s.id} keeps ${dp}`); }
    assert.ok(rec(rs, 'workflow').layout['ph-sd'] && rec(rs, 'workflow').layout._global, 'phase and All phases layouts both published');
    void tasks0; void noToasts;
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('workflow all phases');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
