'use strict';
/* v1.10 regression: editing prerequisites keeps the drawing (blocks, lanes, zones, routes, anchors, viewport);
   arrow ends snap (straight connection, bend removed); line context menu; ends on the wavy bottom of a document card;
   Undo / Redo / restart; Auto layout still recalculates when asked. Real app, real data. */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');
const makeFixture = require('./wf-fixture');
const wfTools = require('./wf-tools');

function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }
const rec = (rs, c, id) => (rs.find(r => r.coll === c && r.id === (id || '_')) || {}).data;
const norm = P => { const q = []; P.forEach(p => { const l = q[q.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) q.push(p); });
  for (let i = 1; i < q.length - 1;) { const [a, b, c] = [q[i - 1], q[i], q[i + 1]]; if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) q.splice(i, 1); else i++; } return q; };

module.exports = async function run() {
  console.log('Workflow: prerequisites keep the layout; arrow ends snap; line menu; document ends (regression v1.10)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Keep');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, { fine: true });
  /* “Prepare preliminary drawings”-style card as a Document (wavy bottom) */
  { const j = JSON.parse(fs.readFileSync(FX.file, 'utf8')); j.data.workflow.steps.find(s => s.id === 'el-ac1').type = 'document'; fs.writeFileSync(FX.file, JSON.stringify(j)); }
  let { app, w } = await H.launch(ud);
  const T = wfTools(() => w), { pts, allD, allPos, center, dragFrom, noToasts, selectEdge, zoom, picked } = T;
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const deps = id => draft().steps.find(s => s.id === id).deps.slice().sort();
  const openStd = async () => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click('[data-act=wf-sphase][data-v=ph-sd]'); await H.sleep(350); };
  const restart = async () => { await H.sleep(900); await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w); };
  /* everything the drawing shows, except the arrows given */
  const snap = async () => ({ n: await allPos(), e: await allD(),
    z: await w.evaluate(() => [...document.querySelectorAll('.wfzb')].map(x => x.style.left).join()),
    l: await w.evaluate(() => [...document.querySelectorAll('.wfl')].map(x => x.dataset.lane + ':' + x.style.top + '/' + x.style.height).join()),
    v: await w.evaluate(() => { const r = document.querySelector('.wfd-wrap'); return [r.scrollLeft, r.scrollTop, document.querySelector('.wfd').style.transform].join(); }) });
  const same = (a, b, skip = [], why = '') => {
    assert.deepStrictEqual(b.n, a.n, why + 'every block in place');
    for (const k of Object.keys(a.e)) if (!skip.includes(k)) assert.strictEqual(b.e[k], a.e[k], why + 'route unchanged: ' + k);
    assert.strictEqual(b.z, a.z, why + 'zones'); assert.strictEqual(b.l, a.l, why + 'lanes'); assert.strictEqual(b.v, a.v, why + 'viewport (scroll and zoom)'); };
  const addPre = async (sid, dep, allPh) => { await noToasts(); await w.click('#wfn-' + sid, { position: { x: 40, y: 22 } }); await H.sleep(200);
    await w.click('[data-wflay=prereq]'); await H.sleep(200); if (allPh) { await w.click('#wffloat [data-wfdf=phases][data-v=_all]'); await H.sleep(120); }
    await w.check(`#wffloat [data-wfdep="${sid}"][value="${dep}"]`); await H.saved(w); await H.sleep(250); };
  const rmPre = async (sid, dep) => { await w.uncheck(`#wffloat [data-wfdep="${sid}"][value="${dep}"]`); await H.saved(w); await H.sleep(250); };
  const closeFloat = async () => { await w.click('[data-wff-close]').catch(() => {}); await H.sleep(150); };
  let other;

  await step('set-up (Schematic standard, an automatic view; one activity is a Document)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Keep'); await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary'); await H.appReady(w);
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    await w.click('#modal-root [data-act=modal-close]');
    await H.answerDialogs(app, { file: FX.file });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    await w.check('#modal-root input[name=imp-diff][value=replace]'); await w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 10000, 'imported'); await H.saved(w);
    await openStd();
    assert.ok(/sh-doc|doc/.test(await w.evaluate(() => document.getElementById('wfn-el-ac1').className)), 'document card');
    other = draft().steps.find(s => s.phaseId !== 'ph-sd' && !s.retired);
    assert.ok(other, 'an activity of another phase');
  });

  await step('1 · Add prerequisites (the prerequisite is further right, in another discipline): nothing moves, only the new arrow appears', async () => {
    const a = await snap();
    assert.ok((await T.box('me-ac2')).x > (await T.box('el-ac1')).x, 'prerequisite on the right of the activity (it used to push it right)');
    await addPre('el-ac1', 'me-ac2');
    assert.ok(deps('el-ac1').includes('me-ac2'), 'dependency stored');
    const b = await snap();
    same(a, b, [], 'automatic view: ');
    assert.ok(b.e['me-ac2>el-ac1'] && !a.e['me-ac2>el-ac1'], 'the new arrow is drawn');
    assert.ok(await w.evaluate(() => document.getElementById('wffloat') && document.getElementById('wfn-el-ac1').classList.contains('sel')), 'the activity stays selected, the editor open');
    const [x, y] = (await T.attached('me-ac2>el-ac1')).P[0]; void x; void y;
    const at = await T.attached('me-ac2>el-ac1'); assert.ok(at.a && at.b, 'connected to both cards');
  });

  await step('2 · more prerequisites in a row, one from another phase (shown as a reference), then one removed: the rest stays', async () => {
    let a = await snap();
    await addPre('el-ac1', 'hy-ac1');
    let b = await snap(); same(a, b, [], 'second prerequisite: ');
    a = b; await addPre('el-ac1', other.id, true);
    b = await snap();
    for (const [id, p] of Object.entries(a.n)) assert.deepStrictEqual(b.n[id], p, 'cross-phase: block in place ' + id);
    for (const k of Object.keys(a.e)) assert.strictEqual(b.e[k], a.e[k], 'cross-phase: route unchanged ' + k);
    assert.ok(b.n[other.id], 'the activity of the other phase shown once, as a reference');
    assert.strictEqual(await w.evaluate(id => document.querySelectorAll('#wfn-' + id).length, other.id), 1, 'not duplicated');
    a = b; await rmPre('el-ac1', 'hy-ac1');
    b = await snap(); same(a, b, ['hy-ac1>el-ac1'], 'removal: ');
    assert.ok(!b.e['hy-ac1>el-ac1'], 'only that arrow removed');
    await closeFloat();
  });

  await step('7 · Undo / Redo restore the dependency and the drawing; a restart keeps both', async () => {
    const a = await snap();
    await w.click('[data-wflay=undo]'); await H.saved(w); await H.sleep(200);
    assert.ok(deps('el-ac1').includes('hy-ac1'), 'undo: the removed prerequisite is back');
    const u = await snap(); assert.deepStrictEqual(u.n, a.n, 'undo: blocks in place');
    await w.click('[data-wflay=redo]'); await H.saved(w); await H.sleep(200);
    assert.ok(!deps('el-ac1').includes('hy-ac1'), 'redo: removed again');
    same(a, await snap(), [], 'redo: ');
    await restart(); await openStd();
    const r = await snap();
    assert.deepStrictEqual(r.n, a.n, 'restart: blocks'); for (const k of Object.keys(a.e)) assert.strictEqual(r.e[k], a.e[k], 'restart: route ' + k);
    assert.deepStrictEqual(deps('el-ac1'), ['co-in1', 'me-ac2', other.id].filter(x => draft().steps.find(s => s.id === 'el-ac1').deps.includes(x)).sort(), 'dependencies kept');
  });

  await step('2 · in a filtered view (Electrical) the same: its own layout stays, the full view too', async () => {
    const full = await snap();
    await w.click('[data-act=wf-sspec][data-v=sv-electrical]'); await H.sleep(300);
    const a = await snap();
    await addPre('el-ac3', 'el-ac2'); await closeFloat();
    const b = await snap(); same(a, b, [], 'filtered view: ');
    assert.ok(Object.keys(draft().layout).some(k => k === 'ph-sd~sv-electrical'), 'stored as the filtered view');
    await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(300);
    const f2 = await snap(); assert.deepStrictEqual(f2.n, full.n, 'the full view keeps its blocks');
    for (const k of Object.keys(full.e)) assert.strictEqual(f2.e[k], full.e[k], 'full view route ' + k);
  });

  await step('3 · arrow ends snap to the other end: one straight line at exactly the same height (also at another zoom); guide; same dependency', async () => {
    const K = 'me-out1>me-ac2';
    await selectEdge(K);
    const P = norm(await pts(K)), E = P[P.length - 1], d0 = JSON.stringify(deps('me-ac2'));
    assert.ok(P[0][1] !== E[1], 'the ends start at different heights: ' + JSON.stringify(P));
    /* drag the start along the right side of its card to 3 screen px from the end's height */
    const s = await center('.wfend[data-wfend=a]'), z = await zoom(), dy = (E[1] - P[0][1]) * z + 3;
    let guide = false;
    await dragFrom(s, 0, dy, async () => { guide = await w.evaluate(() => !!document.querySelector('.wfg.seg')); }); await H.saved(w); await H.sleep(200);
    const Q = norm(await pts(K));
    assert.ok(guide, 'a guide shows the alignment');
    assert.strictEqual(Q.length, 2, 'one straight horizontal line: ' + JSON.stringify(Q));
    assert.strictEqual(Q[0][1], Q[1][1], 'exactly the same height (no micro step)');
    assert.strictEqual(JSON.stringify(deps('me-ac2')), d0, 'dependency unchanged');
    const at = await T.attached(K); assert.strictEqual(at.a, 'r'); assert.strictEqual(at.b, 'l');
    /* at another zoom: the start moved away, then back within 3 screen px of the line → straight again */
    await w.click('[data-wflay=undo]'); await H.saved(w); await H.sleep(200);
    await w.click('[data-wflay=zoom-out]'); await w.click('[data-wflay=zoom-out]'); await H.sleep(200); const z2 = await zoom();
    await selectEdge(K); const s2 = await center('.wfend[data-wfend=a]'), P2 = norm(await pts(K)), E2 = P2[P2.length - 1];
    await dragFrom(s2, 0, (E2[1] - P2[0][1]) * z2 - 3); await H.saved(w); await H.sleep(200);
    assert.strictEqual(norm(await pts(K)).length, 2, `zoom ${z2}: straight`);
    await w.click('[data-wflay=zoom-in]'); await w.click('[data-wflay=zoom-in]'); await H.sleep(200);
  });

  await step('4 · line context menu: Add bend (several, around blocks) and Remove bend keep the ends on their cards', async () => {
    /* the arrow with the longest horizontal line between its cards */
    const all = await allD(); let K = null, P = null, H0 = null;
    for (const k of Object.keys(all)) { const Q = norm(await pts(k)); for (let i = 1; i < Q.length - 2; i++) { const [a, b] = [Q[i], Q[i + 1]]; if (a[1] === b[1] && Math.abs(a[0] - b[0]) >= 220 && (!H0 || Math.abs(a[0] - b[0]) > Math.abs(H0[0][0] - H0[1][0]))) { K = k; P = Q; H0 = [a, b]; } } }
    assert.ok(K, 'an arrow with a long horizontal line'); await w.keyboard.press('Escape'); await H.sleep(100); await selectEdge(K);
    const lo = Math.min(H0[0][0], H0[1][0]), hi = Math.max(H0[0][0], H0[1][0]), yH = H0[0][1], n0 = P.length, mid = null;
    const sc = async ([x, y]) => w.evaluate(([x, y]) => { const d = document.querySelector('.wfd'), r = d.getBoundingClientRect(), z = r.width / d.offsetWidth; return { x: r.left + x * z, y: r.top + y * z }; }, [x, y]);
    let c = await sc([lo + 70, yH]); await noToasts(); await w.mouse.click(c.x, c.y, { button: 'right' }); await H.sleep(200);
    assert.ok(await w.$('.wfline-menu'), 'menu on the line');
    assert.ok(await w.evaluate(() => document.activeElement && document.activeElement.dataset.wflay === 'bend-add'), 'focus on Add bend');
    await w.click('.wfline-menu [data-wflay=bend-add]'); await H.saved(w); await H.sleep(200);
    assert.strictEqual(norm(await pts(K)).length, n0 + 4, 'one detour');
    c = await sc([hi - 70, yH]); await w.mouse.click(c.x, c.y, { button: 'right' }); await H.sleep(150);
    await w.keyboard.press('Enter'); await H.saved(w); await H.sleep(200);
    const Q = norm(await pts(K)); assert.strictEqual(Q.length, n0 + 8, 'two detours (keyboard: Enter on Add bend)');
    const at = await T.attached(K); assert.ok(at.a && at.b, 'ends on their cards');
    const cards = await w.evaluate(() => [...document.querySelectorAll('.wfd .wfn')].map(n => ({ id: n.dataset.id, x: parseFloat(n.style.left), y: parseFloat(n.style.top), w: n.offsetWidth, h: n.offsetHeight })));
    const [ka, kb] = K.split('>'), segs = Q.slice(1, -2).map((p, i) => [p, Q[i + 2]]);
    for (const [a, b] of segs) for (const r of cards) if (r.id !== ka && r.id !== kb) assert.ok(!(Math.max(a[0], b[0]) > r.x + 2 && Math.min(a[0], b[0]) < r.x + r.w - 2 && Math.max(a[1], b[1]) > r.y + 2 && Math.min(a[1], b[1]) < r.y + r.h - 2), `the detours go around the cards (${r.id})`);
    /* Remove bend from the menu on a detour's parallel line */
    const par = Q.slice(0, -1).map((p, i) => [p, Q[i + 1]]).filter(([a, b]) => a[1] === b[1] && [32, 56, 88].includes(Math.abs(a[1] - yH)) && Math.min(a[0], b[0]) >= lo && Math.max(a[0], b[0]) <= hi && Math.abs(a[0] - b[0]) <= 80)[0];
    assert.ok(par, 'the parallel line of a detour: ' + JSON.stringify(Q));
    for (const f of [0.3, 0.7, 0.2, 0.8, 0.45]) { c = await sc([par[0][0] + (par[1][0] - par[0][0]) * f, par[0][1]]); if (await w.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest && e.closest('.wfe-hit,.wfh')); }, c)) break; }
    await noToasts(); await w.mouse.click(c.x, c.y, { button: 'right' }); await H.sleep(150);
    assert.ok(await w.$('.wfline-menu'), 'menu on the detour: ' + await w.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && e.outerHTML.slice(0, 120); }, c));
    assert.strictEqual(await w.evaluate(() => !document.querySelector('.wfline-menu [data-wflay=bend-rm]').disabled), true, 'Remove bend available there');
    await w.click('.wfline-menu [data-wflay=bend-rm]'); await H.saved(w); await H.sleep(200);
    assert.strictEqual(norm(await pts(K)).length, n0 + 4, 'one detour left');
    await w.keyboard.press('Escape'); void mid;
  });

  await step('5 · ends on the wavy bottom of a Document card: selectable and draggable at 60 %, 100 % and 150 %; the card itself still selects', async () => {
    const K = 'el-ac1>el-ac3';
    for (const step of [0, -4, 5]) {
      for (let i = 0; i < Math.abs(step); i++) await w.click(`[data-wflay=${step > 0 ? 'zoom-in' : 'zoom-out'}]`);
      await H.sleep(200); await selectEdge(K);
      /* put the start on the bottom of the document (drag it there), then grab it again */
      const s = await center('.wfend[data-wfend=a]'), b = await (await w.$('#wfn-el-ac1')).boundingBox();
      await dragFrom(s, b.x + b.width * 0.35 - s.x, b.y + b.height - 4 - s.y); await H.saved(w); await H.sleep(200);
      assert.strictEqual((await T.attached(K)).a, 'b', 'start on the bottom');
      const e1 = await center('.wfend[data-wfend=a]');
      const top = await w.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el && el.closest('.wfend') ? 'end' : el && el.closest('.wfn') ? 'card' : el && el.tagName; }, e1);
      assert.strictEqual(top, 'end', `zoom ${await zoom()}: the end is on top of the card`);
      const wave = await w.evaluate(() => { const n = document.getElementById('wfn-el-ac1'), c = document.querySelector('.wfend[data-wfend=a] .wfend-dot'); return { y: +c.getAttribute('cy') - parseFloat(n.style.top), x: +c.getAttribute('cx') - parseFloat(n.style.left) }; });
      assert.ok(wave.y > 58 && wave.y < 80, 'on the wavy outline: ' + JSON.stringify(wave));
      /* drag it along the bottom by 30 screen px: it follows (selected and draggable on the curve) */
      await dragFrom(e1, 30, 0); await H.saved(w); await H.sleep(200);
      const e2 = await center('.wfend[data-wfend=a]');
      assert.ok(Math.abs(e2.x - e1.x - 30) <= 3 && (await T.attached(K)).a === 'b', `zoom ${await zoom()}: dragged along the curve (${e1.x} → ${e2.x})`);
      assert.strictEqual(await picked(), K, 'the arrow stays selected');
    }
    await w.click('[data-wflay=zoom-out]'); await H.sleep(200);   // back to 100 %
    /* the body of the card: the card is selected (its menu), not the arrow end */
    await w.keyboard.press('Escape'); await noToasts();
    await w.click('#wfn-el-ac1', { position: { x: 60, y: 20 } }); await H.sleep(200);
    assert.ok(await w.evaluate(() => document.getElementById('wfn-el-ac1').classList.contains('sel')), 'clicking the card body selects the card');
    await w.keyboard.press('Escape');
  });

  await step('8 · Auto layout still recalculates when asked; Undo brings the arrangement back', async () => {
    await w.click('[data-wflay=edit]').catch(() => {}); await H.sleep(150);
    const a = await allPos();
    await w.click('[data-wflay=auto]'); await H.saved(w); await H.sleep(300);
    const b = await allPos();
    assert.ok(Object.keys(a).some(id => b[id] && (a[id].x !== b[id].x || a[id].y !== b[id].y)), 'Auto layout moved blocks');
    await w.click('[data-wflay=undo]'); await H.saved(w); await H.sleep(300);
    assert.deepStrictEqual(await allPos(), a, 'Undo: arrangement back');
    assert.deepStrictEqual(w.errors, [], 'no page errors');
  });

  await app.close();
};
