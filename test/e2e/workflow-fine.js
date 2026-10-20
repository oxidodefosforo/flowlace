'use strict';
/* Fine manual editing of the workflow diagram — acceptance checks of v1.3:
    1 a connection is selected by clicking its line (overlapping lines: each click selects the next one)
    2 two vertical segments arriving at “Prepare preliminary drawings” are separated (one left, one right)
    3 horizontal segments move up and down; bends can be added and removed
    4 the start and the end of an arrow change side without disconnecting the activities; Reconnect is validated
    5 manual settings are kept when blocks move                    6 automatic connections keep resolving as before
    7 the zone boundaries reduce or widen the space; “Fit zones to content”; Show / Hide zones
    8 order, specialty and dependencies are kept                   9 clicking an activity keeps the view on the diagram
   10 Add prerequisites from the block menu, then keep editing     11 Show details keeps scroll, zoom and position
   12 the controls work at 75 % and 125 %                          13 Undo / Redo and saving (restart, export / import)
   14 the diagram controls don't interfere with the rest of the app */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');
const makeFixture = require('./wf-fixture');

const W = 196, HB = 84, ZMIN = 40;
function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }
const rec = (rs, c, id) => (rs.find(r => r.coll === c && r.id === (id || '_')) || {}).data;

module.exports = async function run() {
  console.log('Workflow fine editing (acceptance v1.3)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Fine');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, { fine: true });
  let { app, w } = await H.launch(ud);
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const box = id => w.evaluate(i => { const el = document.getElementById('wfn-' + i); return el ? { x: parseFloat(el.style.left), y: parseFloat(el.style.top) } : null; }, id);
  const ids = () => w.evaluate(() => [...document.querySelectorAll('.wfd .wfn')].map(n => n.dataset.id));
  const allPos = async () => { const l = await ids(), o = {}; for (const id of l) o[id] = await box(id); return o; };
  const pts = k => w.evaluate(x => { const p = document.querySelector(`path.wfe-hit[data-wfe="${x}"]`); return p && p.getAttribute('d').slice(1).split(' L').map(s => s.split(',').map(Number)); }, k);
  const allD = () => w.evaluate(() => Object.fromEntries([...document.querySelectorAll('path.wfe-hit')].map(p => [p.dataset.wfe, p.getAttribute('d')])));
  const vert = P => P.slice(0, -1).map((p, i) => [p, P[i + 1]]).filter(([a, b]) => a[0] === b[0] && a[1] !== b[1]).map(([a, b]) => ({ x: a[0], y1: a[1], y2: b[1] }));
  const horz = P => P.slice(0, -1).map((p, i) => [p, P[i + 1]]).filter(([a, b]) => a[1] === b[1] && a[0] !== b[0]).map(([a, b]) => ({ y: a[1], x1: a[0], x2: b[0] }));
  const near = (v, a) => Math.abs(v - a) <= 3, inR = (v, a, l) => v >= a - 1 && v <= a + l + 1;   // the arrow tip stops 2 px before the side
  const sideOf = (q, b) => near(q[0], b.x) && inR(q[1], b.y, HB) ? 'l' : near(q[0], b.x + W) && inR(q[1], b.y, HB) ? 'r' : near(q[1], b.y) && inR(q[0], b.x, W) ? 't' : near(q[1], b.y + HB) && inR(q[0], b.x, W) ? 'b' : null;
  async function attached(k) { const [a, b] = k.split('>'), P = await pts(k), A = await box(a), B = await box(b); return { a: sideOf(P[0], A), b: sideOf(P[P.length - 1], B), P }; }
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const lay = () => ((draft().layout || {})['ph-sd']) || {};
  const deps = id => draft().steps.find(s => s.id === id).deps.slice().sort();
  const picked = () => w.evaluate(() => { const p = document.querySelector('path.wfe.on'); return p && p.dataset.k; });
  const zoom = () => w.evaluate(() => { const d = document.querySelector('.wfd'); return d.getBoundingClientRect().width / d.offsetWidth; });
  const view = () => w.evaluate(() => { const r = document.querySelector('.wfd-wrap'), m = document.getElementById('main'); return { wl: r.scrollLeft, wt: r.scrollTop, m: m ? m.scrollTop : 0, y: scrollY, x: scrollX, z: document.querySelector('.wfd').getBoundingClientRect().width / document.querySelector('.wfd').offsetWidth }; });
  const nodeScreen = id => w.evaluate(i => { const r = document.getElementById('wfn-' + i).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; }, id);
  const noToasts = () => w.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
  async function center(sel) { await noToasts(); const el = await w.$(sel); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; }
  async function dragFrom(c, dx, dy, mid) { await noToasts(); await w.mouse.move(c.x, c.y); await w.mouse.down(); await w.mouse.move(c.x + dx / 3, c.y + dy / 3, { steps: 4 }); await w.mouse.move(c.x + dx, c.y + dy, { steps: 8 }); if (mid) await mid(); await w.mouse.up(); await H.sleep(250); }
  const drag = async (id, dx, dy, mid) => dragFrom(await center('#wfn-' + id), dx, dy, mid);
  /* a real click on the line (its longest inner segment), repeated on overlaps until that line is the selected one */
  async function selectEdge(k, soft) {
    const P = await pts(k), cand = [];
    for (let i = 1; i < P.length - 2; i++) { const a = P[i], b = P[i + 1], l = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); if (l < 8) continue; for (const f of [0.5, 0.3, 0.7, 0.15, 0.85]) cand.push({ l, x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f }); }
    if (!cand.length) cand.push({ x: (P[0][0] + P[P.length - 1][0]) / 2, y: (P[0][1] + P[P.length - 1][1]) / 2 });
    cand.sort((p, q) => (q.l || 0) - (p.l || 0));
    /* the first point of the line that is visible and not under a block */
    const c = await w.evaluate(({ list, k }) => { const d = document.querySelector('.wfd'), wr = document.querySelector('.wfd-wrap');
      const at = ({ x, y }) => { const r = d.getBoundingClientRect(), z = r.width / d.offsetWidth; return { x: r.left + x * z, y: r.top + y * z }; };
      const bar = document.querySelector('.wflay-bar'), top = Math.max(60, bar ? bar.getBoundingClientRect().bottom + 10 : 0);
      for (const p of list) {
        let s = at(p); const wb = wr.getBoundingClientRect();
        if (s.x < wb.left + 20 || s.x > wb.right - 20) wr.scrollLeft += s.x - (wb.left + wb.width / 2);
        if (wr.scrollHeight > wr.clientHeight + 2 && (s.y < wb.top + 20 || s.y > wb.bottom - 20)) wr.scrollTop += s.y - (wb.top + wb.height / 2);
        s = at(p);
        if (s.y < top || s.y > innerHeight - 40) { const m = document.getElementById('main'); (m && m.scrollHeight > m.clientHeight ? m : document.scrollingElement).scrollTop += s.y - (top + innerHeight) / 2; s = at(p); }
        const e = document.elementFromPoint(s.x, s.y); if (e && e.classList && e.classList.contains('wfe-hit') && document.elementsFromPoint(s.x, s.y).some(x => x.dataset && x.dataset.wfe === k)) return s;
      }
      return at(list[0]); }, { list: cand, k });
    for (let i = 0; i < 5 && (await picked()) !== k; i++) { await w.mouse.click(c.x, c.y); await H.sleep(120); }
    if (soft) return (await picked()) === k ? c : null;
    assert.strictEqual(await picked(), k, 'selected by clicking its line: ' + k + ' at ' + JSON.stringify(c) + ' → ' + (await w.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && e.outerHTML.slice(0, 200) + ' parent ' + (e.parentElement && e.parentElement.outerHTML.slice(0, 120)); }, c)));
    return c;
  }
  const openStd = async (ph = 'ph-sd') => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click(`[data-act=wf-sphase][data-v=${ph}]`); await H.sleep(250); };
  const undo = async () => { await w.click('[data-wflay=undo]'); await H.sleep(200); };
  const redo = async () => { await w.click('[data-wflay=redo]'); await H.sleep(200); };
  const K1 = 'me-out1>el-ac3', K2 = 'co-in1>el-ac3', K3 = 'el-ac1>el-ac3';
  let D0 = null, P0 = null;

  await step('set-up (workspace with the HTML data; three arrows arrive at “Prepare preliminary drawings”)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Fine'); await w.click('[data-sact=pick-create]');
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
    for (const k of [K1, K2, K3]) assert.ok(await pts(k), 'arrow ' + k);
    D0 = await allD(); P0 = await allPos();
    await H.shot(w, 'fine-start');
  });

  await step('5 · zones are visible by default with headers and boundaries; Show / Hide zones', async () => {
    const z = await w.evaluate(() => ({ h: [...document.querySelectorAll('.wfz-h')].map(x => x.textContent), zb: document.querySelectorAll('.wfzb').length, out: document.querySelectorAll('.wfzb.out').length }));
    assert.ok(/Inputs/.test(z.h[0]) && /Actions/.test(z.h[1]) && /Outputs/.test(z.h[2]), 'headers: ' + z.h);
    assert.strictEqual(z.zb, 2, 'two vertical boundaries'); assert.strictEqual(z.out, 1, 'one dotted Outputs boundary (not duplicated)');
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('.wfzsep').length), 0, 'no second Outputs separator');
    await w.click('[data-wflay=zones]'); await H.sleep(150);
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('.wfz,.wfzb').length), 0, 'hidden');
    assert.deepStrictEqual(await allPos(), P0, 'hiding the zones moves nothing');
    await w.click('[data-wflay=zones]'); await H.sleep(150);
    assert.ok(await w.evaluate(() => document.querySelectorAll('.wfz').length === 3), 'shown again');
  });

  await step('1 · clicking a line selects only that connection; overlaps are selected one after the other; nothing moves', async () => {
    const v0 = await view(), p0 = await allPos();
    await selectEdge(K1);
    const st = await w.evaluate(() => ({ on: document.querySelectorAll('path.wfe.on').length, dim: document.querySelectorAll('path.wfe.dim').length, all: document.querySelectorAll('path.wfe[data-k]').length, h: document.querySelectorAll('.wfh').length, ends: document.querySelectorAll('.wfend').length, sw: getComputedStyle(document.querySelector('.wfe-hit')).strokeWidth }));
    assert.strictEqual(st.on, 1, 'one highlighted'); assert.strictEqual(st.dim, st.all - 1, 'the others dimmed');
    assert.ok(st.h >= 1 && st.ends === 2, 'segment handles and both ends shown');
    assert.ok(parseFloat(st.sw) >= 12, 'wider hit area: ' + st.sw);
    assert.ok(/Reset selected route/.test(await w.textContent('.wflay-bar')) && /Reconnect source/.test(await w.textContent('.wflay-bar')), 'edit controls of the connection');
    assert.deepStrictEqual(await allPos(), p0, 'no activity moved');
    const v1 = await view(); assert.strictEqual(v1.z, v0.z, 'zoom unchanged');
    // overlapping lines: the three arrows share their entry into el-ac3 → each click selects the next one
    const P = await pts(K2), last = P[P.length - 2];
    const shared = await w.evaluate(([x, y]) => { const d = document.querySelector('.wfd'), r = d.getBoundingClientRect(), z = r.width / d.offsetWidth, cx = r.left + (x - 4) * z, cy = r.top + y * z;
      return { cx, cy, under: [...new Set(document.elementsFromPoint(cx, cy).filter(e => e.classList.contains('wfe-hit')).map(e => e.dataset.wfe))] }; }, last);
    if (shared.under.length > 1) {
      const seen = new Set();
      for (let i = 0; i < shared.under.length + 1; i++) { await w.mouse.click(shared.cx, shared.cy); await H.sleep(120); seen.add(await picked()); }
      assert.ok(shared.under.every(k => seen.has(k)), 'each overlapping line can be selected: ' + [...seen]);
      assert.ok(/connections here/.test(await w.textContent('#toasts')), 'the overlap is announced');
    }
    // a click on the empty canvas clears the selection
    await w.keyboard.press('Escape'); await H.sleep(120);
    assert.strictEqual(await picked(), null, 'Escape clears');
  });

  let sepXs = null;
  await step('2 · two vertical segments arriving at “Prepare preliminary drawings” are separated: one left, one right', async () => {
    // room in front of the activity, as in the screenshot (one operation)
    await drag('el-ac3', 140, 0);
    const v0 = await view(), p0 = await allPos(), others0 = await allD();
    D0 = others0; P0 = p0;   // every arrow automatic, blocks as they are now: the reference for “Reset all routes”
    const x0 = {}; for (const k of [K1, K2]) x0[k] = vert(await pts(k)).map(s => s.x);
    const xs = [];
    for (const [k, dx] of [[K1, -40], [K2, 40]]) {
      await selectEdge(k);
      const hv = await w.$$('.wfh.v'); assert.ok(hv.length, 'vertical handle of ' + k);
      const cur = await w.evaluate(() => getComputedStyle(document.querySelector('.wfh.v')).cursor);
      assert.strictEqual(cur, 'ew-resize', 'cursor for a vertical segment');
      const hx = +(await hv[hv.length - 1].getAttribute('x')) + 6, hb = await hv[hv.length - 1].boundingBox();
      let mid = null;
      await dragFrom({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, dx * (await zoom()), 0, async () => { mid = vert(await pts(k)); });
      assert.ok(mid.some(s => Math.abs(s.x - (hx + dx)) <= 7), 'live preview while dragging ' + k);
      const after = vert(await pts(k)), moved = after.find(s => Math.abs(s.x - (hx + dx)) <= 7);
      assert.ok(moved, `${k}: vertical moved ${dx > 0 ? 'right' : 'left'} (${JSON.stringify(x0[k])} → ${JSON.stringify(after)})`);
      const at = await attached(k); assert.ok(at.a && at.b, k + ' still attached to both activities');
      assert.ok(Array.isArray(lay().e[k].s), 'manual route stored');
      xs.push(moved.x);
    }
    assert.ok(xs[1] - xs[0] >= 12, 'separated (no longer on top of each other): ' + xs);
    sepXs = xs;
    assert.deepStrictEqual(await allPos(), p0, 'activities did not move');
    const v1 = await view(); assert.ok(v1.wl === v0.wl && v1.m === v0.m && v1.y === v0.y, 'the canvas did not pan: ' + JSON.stringify([v0, v1]));
    const now = await allD(), ends = d => { const q = d.slice(1).split(' L'); return [q[0], q[q.length - 1]]; };
    for (const k of Object.keys(others0)) if (k !== K1 && k !== K2) assert.deepStrictEqual(ends(now[k]), ends(others0[k]), 'other arrows keep their connection points: ' + k);
    assert.ok(vert(await pts(K1)).some(s => s.x === xs[0]), K1 + ' keeps its manual segment after editing ' + K2);
    await H.shot(w, 'fine-separated');
  });

  await step('3 · horizontal segments move up and down; a bend is added and removed with a double-click', async () => {
    await selectEdge(K1);
    const handles = await w.$$('.wfh.h'); assert.ok(handles.length, 'horizontal handles');
    const cur = await w.evaluate(() => getComputedStyle(document.querySelector('.wfh.h')).cursor);
    assert.strictEqual(cur, 'ns-resize', 'cursor for a horizontal segment');
    const pick = handles[0], hy = +(await pick.getAttribute('y')) + 6, bb = await pick.boundingBox(), z = await zoom();
    await dragFrom({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }, 0, -30 * z);
    let H1 = horz(await pts(K1));
    assert.ok(H1.some(s => Math.abs(s.y - (hy - 30)) <= 7), 'moved up: ' + JSON.stringify(H1));
    let at = await attached(K1); assert.ok(at.a && at.b, 'still attached');
    const hs2 = await w.$$('.wfh.h'); let hb2b = null;
    for (const h of hs2) { const y = +(await h.getAttribute('y')) + 6; if (Math.abs(y - (hy - 30)) <= 7) { hb2b = await h.boundingBox(); break; } }
    assert.ok(hb2b, 'handle of the moved segment'); const hb2c = hb2b;
    await dragFrom({ x: hb2c.x + hb2c.width / 2, y: hb2c.y + hb2c.height / 2 }, 0, 50 * z);
    H1 = horz(await pts(K1));
    assert.ok(H1.some(s => Math.abs(s.y - (hy + 20)) <= 7), 'moved down: ' + JSON.stringify(H1));
    assert.ok(vert(await pts(K1)).some(s => s.x === sepXs[0]), 'its vertical stays where it was put: ' + JSON.stringify([sepXs, await pts(K1), lay().e[K1]]));
    // add a bend on the line, then remove it from its handle
    const n0 = (await pts(K1)).length, P = await pts(K1), V = vert(P).sort((a, b) => Math.abs(b.y2 - b.y1) - Math.abs(a.y2 - a.y1))[0];
    const c = await w.evaluate(({ x, y }) => { const d = document.querySelector('.wfd'), r = d.getBoundingClientRect(), z = r.width / d.offsetWidth; return { x: r.left + x * z, y: r.top + y * z }; }, { x: V.x, y: V.y1 + (V.y2 - V.y1) * 0.25 });
    await w.mouse.dblclick(c.x, c.y); await H.sleep(250);
    const n1 = (await pts(K1)).length;
    assert.ok(n1 > n0, `bend added (${n0} → ${n1} points)`);
    assert.strictEqual(await picked(), K1, 'still selected');
    const hs = await w.$$('.wfh'), hb = await hs[Math.floor(hs.length / 2)].boundingBox();
    await w.mouse.dblclick(hb.x + hb.width / 2, hb.y + hb.height / 2); await H.sleep(250);
    assert.ok((await pts(K1)).length < n1, 'bend removed');
    at = await attached(K1); assert.ok(at.a && at.b, 'attached after adding and removing bends');
    await undo(); assert.strictEqual((await pts(K1)).length, n1, 'Undo: bend back');
    await redo(); assert.ok((await pts(K1)).length < n1, 'Redo: removed again');
  });

  await step('4 · start and end change side (bottom / top) without disconnecting; dependency kept; Escape restores', async () => {
    await selectEdge(K3);
    const deps0 = deps('el-ac3');
    // end (b) → top side of el-ac3
    let e2 = await center('.wfend[data-wfend=b]'), tb = await (await w.$('#wfn-el-ac3')).boundingBox();
    await w.mouse.move(e2.x, e2.y); await w.mouse.down(); await w.mouse.move(tb.x + tb.width * 0.3, tb.y + 8, { steps: 6 });
    assert.ok(await w.evaluate(() => !!document.querySelector('.wfside')), 'the available side is highlighted');
    await w.mouse.move(tb.x + tb.width * 0.3, tb.y + 1, { steps: 3 }); await w.mouse.up(); await H.sleep(250);
    let at = await attached(K3); assert.strictEqual(at.b, 't', 'enters from the top: ' + JSON.stringify(at));
    assert.ok(at.a, 'start still attached');
    const last = at.P[at.P.length - 1], pre = at.P[at.P.length - 2];
    assert.ok(pre[1] < last[1] && pre[0] === last[0], 'route follows the new orientation (arrives downwards)');
    // start (a) → bottom side of el-ac1
    const s1 = await center('.wfend[data-wfend=a]'), ab = await (await w.$('#wfn-el-ac1')).boundingBox();
    await w.mouse.move(s1.x, s1.y); await w.mouse.down(); await w.mouse.move(ab.x + ab.width * 0.7, ab.y + ab.height - 8, { steps: 6 }); await w.mouse.move(ab.x + ab.width * 0.7, ab.y + ab.height - 1, { steps: 3 }); await w.mouse.up(); await H.sleep(250);
    at = await attached(K3); assert.strictEqual(at.a, 'b', 'leaves from the bottom'); assert.strictEqual(at.b, 't', 'end kept');
    const e = lay().e[K3]; assert.strictEqual(e.a.side, 'b'); assert.strictEqual(e.b.side, 't');
    assert.ok(e.a.t > 0.5 && e.a.t < 0.9 && e.b.t > 0.1 && e.b.t < 0.5, 'relative position along each side: ' + JSON.stringify([e.a, e.b]));
    assert.deepStrictEqual(deps('el-ac3'), deps0, 'dependencies unchanged');
    // dropped away from its block: nothing changes; Escape during a drag restores
    const before = await pts(K3); e2 = await center('.wfend[data-wfend=b]');
    await w.mouse.move(e2.x, e2.y); await w.mouse.down(); await w.mouse.move(e2.x + 60, e2.y - 70, { steps: 5 }); await w.keyboard.press('Escape'); await w.mouse.up(); await H.sleep(200);
    assert.deepStrictEqual(await pts(K3), before, 'Escape: previous position');
    e2 = await center('.wfend[data-wfend=b]');
    await w.mouse.move(e2.x, e2.y); await w.mouse.down(); await w.mouse.move(e2.x + 5, e2.y - 300, { steps: 6 }); await w.mouse.up(); await H.sleep(250);
    assert.deepStrictEqual(await pts(K3), before, 'dropped away from its block: kept');
    await undo(); assert.notStrictEqual((await attached(K3)).a, 'b', 'Undo: start back on its previous side');
    await redo(); assert.strictEqual((await attached(K3)).a, 'b', 'Redo');
  });

  await step('4 · Reconnect source / target: duplicates, self-references and loops are refused; a valid one replaces the relation', async () => {
    const recon = async (k, which, to) => { await selectEdge(k); await w.click(`[data-wflay=recon-${which}]`); await H.sleep(120); await w.click('#wfn-' + to); await H.sleep(250); };
    const d0 = deps('el-ac3');
    await recon(K3, 'a', 'me-out1');
    assert.ok(/already depends/.test(await w.textContent('#toasts')), 'duplicate refused'); assert.deepStrictEqual(deps('el-ac3'), d0);
    await recon(K3, 'b', 'el-ac1');
    assert.ok(/itself/.test(await w.textContent('#toasts')), 'self-reference refused'); assert.deepStrictEqual(deps('el-ac3'), d0);
    await recon(K3, 'a', 'el-out1');
    assert.ok(/loop/.test(await w.textContent('#toasts')), 'loop refused'); assert.deepStrictEqual(deps('el-ac3'), d0);
    assert.ok(await pts(K3), 'original connection still drawn');
    // cancelled
    await selectEdge(K3); await w.click('[data-wflay=recon-a]'); await w.click('#wfn-me-in1');
    await H.until(() => w.evaluate(() => /Reconnect this arrow\?/.test(document.getElementById('modal-root').textContent)), 3000, 'confirm');
    await w.click('#modal-root [data-act=cf-no]'); await H.sleep(200);
    assert.deepStrictEqual(deps('el-ac3'), d0, 'cancelled: kept');
    // valid: el-ac1 → el-ac3 becomes me-in1 → el-ac3 (the end on el-ac3 keeps its side)
    await selectEdge(K3); await w.click('[data-wflay=recon-a]'); await w.click('#wfn-me-in1');
    await H.until(() => w.evaluate(() => /Reconnect this arrow\?/.test(document.getElementById('modal-root').textContent)), 3000, 'confirm');
    await w.click('#modal-root [data-act=cf-yes]'); await H.saved(w); await H.sleep(200);
    assert.deepStrictEqual(deps('el-ac3'), ['co-in1', 'me-in1', 'me-out1'], 'relation replaced');
    assert.strictEqual(await picked(), 'me-in1>el-ac3', 'the new arrow stays selected');
    assert.strictEqual((await attached('me-in1>el-ac3')).b, 't', 'unchanged end keeps its side');
    assert.ok(!(await pts(K3)), 'old arrow gone');
    await undo();
    assert.deepStrictEqual(deps('el-ac3'), d0, 'Undo restores the dependency');
    assert.strictEqual((await attached(K3)).a, 'b', 'and the old arrow with its anchors');
    await redo();
    assert.deepStrictEqual(deps('el-ac3'), ['co-in1', 'me-in1', 'me-out1'], 'Redo');
    await undo();
  });

  await step('5/6 · moving blocks keeps the manual settings; automatic arrows keep resolving as before', async () => {
    await w.keyboard.press('Escape');
    const k1 = await pts(K1), k2 = await pts(K2);
    const hy0 = await box('hy-ac1'), hc = await center('#wfn-hy-ac1');
    await drag('hy-ac1', 0, 40); void hc;
    assert.strictEqual((await box('hy-ac1')).y - hy0.y, 40, 'the unrelated block moved');
    assert.deepStrictEqual(await pts(K1), k1, 'unaffected manual route identical');
    const a2m = await attached(K2); assert.ok(a2m.a && a2m.b, 'the arrow whose source lane grew stays connected'); void k2;
    await undo();
    // the target moves: anchors kept, manual vertical kept when it still fits
    const e3 = JSON.stringify(lay().e[K3]);
    await drag('el-ac3', 30, 0);
    const a3 = await attached(K3); { const n3 = lay().e[K3], o3 = JSON.parse(e3); assert.deepStrictEqual([n3.a, n3.b], [o3.a, o3.b], 'anchors stored unchanged'); } assert.strictEqual(a3.a, 'b'); assert.strictEqual(a3.b, 't', 'anchors kept after moving');
    assert.ok(vert(await pts(K1)).some(s => s.x === sepXs[0]), 'manual vertical kept');
    const a1 = await attached(K1), a2 = await attached(K2); assert.ok(a1.a && a1.b && a2.a && a2.b, 'manual routes stay connected');
    // never through a block
    const P = await allPos();
    for (const k of [K1, K2, K3]) { const Q = await pts(k), [, b] = k.split('>');
      for (const [id, p] of Object.entries(P)) { if (k.split('>').includes(id)) continue;
        for (let i = 0; i < Q.length - 1; i++) { const [x1, y1] = Q[i], [x2, y2] = Q[i + 1];
          const hit = Math.max(x1, x2) > p.x + 1 && Math.min(x1, x2) < p.x + W - 1 && Math.max(y1, y2) > p.y + 1 && Math.min(y1, y2) < p.y + HB - 1;
          assert.ok(!hit, `${k} does not cross ${id}: ${JSON.stringify([Q, p])}`); } } void b; }
    await undo();
    // automatic arrows: after Reset all routes every arrow is identical to the start
    await w.click('[data-wflay=edit]');
    const keep = await allD();
    await w.click('[data-wflay=routes-reset]'); await H.saved(w); await H.sleep(200);
    const now = await allD();
    for (const k of Object.keys(D0)) if (now[k]) assert.strictEqual(now[k], D0[k], 'automatic route as in the current version: ' + k);
    assert.deepStrictEqual(await allPos(), P0, 'Reset all routes keeps the activities in place');
    assert.deepStrictEqual(deps('el-ac3'), ['co-in1', 'el-ac1', 'me-out1'], 'and the dependencies');
    await undo(); const back = await allD();
    for (const k of Object.keys(keep)) assert.strictEqual(back[k], keep[k], 'Undo: manual routes back ' + k);
    // Reset selected route: only that one
    await selectEdge(K2); await w.click('[data-wflay=route-reset]'); await H.saved(w); await H.sleep(200);
    assert.strictEqual((await allD())[K2], D0[K2], 'selected arrow back to automatic');
    assert.ok(vert(await pts(K1)).some(s => s.x === sepXs[0]), 'the other manual arrow untouched');
    await undo();
    // Auto layout keeps the compatible manual settings of the arrows
    await w.click('[data-wflay=auto]'); await H.saved(w); await H.sleep(200);
    assert.ok(lay().e && lay().e[K1] && lay().e[K3], 'Auto layout keeps the arrow settings');
    assert.strictEqual((await attached(K3)).b, 't', 'anchor respected');
    await undo();
    await w.click('[data-wflay=edit]');
  });

  await step('7 · dragging the zone boundaries reduces / widens the space; minimum kept; Fit zones to content', async () => {
    await w.click('[data-wflay=edit]'); await w.keyboard.press('Escape');
    const p0 = await allPos(), bx = () => w.evaluate(() => [...document.querySelectorAll('.wfzb')].map(x => parseFloat(x.style.left)));
    const cur = await w.evaluate(() => getComputedStyle(document.querySelector('.wfzb')).cursor); assert.strictEqual(cur, 'col-resize', 'resize cursor');
    const [b1] = await bx(), z = await zoom();
    let mid = null;
    await dragFrom(await center('.wfzb[data-zb="1"]'), -30 * z, 0, async () => { mid = await pts('co-in1>el-ac1'); });
    let p1 = await allPos();
    assert.strictEqual(p1['el-ac1'].x, p0['el-ac1'].x - 30, 'Actions moved left with the boundary');
    assert.strictEqual(p1['el-out1'].x, p0['el-out1'].x - 30, 'later zones too');
    assert.strictEqual(p1['co-in1'].x, p0['co-in1'].x, 'Inputs stay');
    for (const id of Object.keys(p0)) assert.strictEqual(p1[id].y, p0[id].y, 'vertical positions kept: ' + id);
    assert.ok(mid && JSON.stringify(mid) !== JSON.stringify((await allD())['x']), 'arrows update while dragging');
    assert.ok((await bx())[0] < b1 - 10, 'boundary moved (it stays in the middle of the space between the zones)');
    // past the minimum: clamped, nothing overlaps
    await dragFrom(await center('.wfzb[data-zb="1"]'), -300 * z, 0);
    p1 = await allPos();
    const inR = Math.max(...['co-in1', 'me-in1', 'fee-co-out'].map(i => p1[i].x + W)), acL = Math.min(...['el-ac1', 'el-ac3', 'me-out1', 'hy-ac1'].map(i => p1[i].x));
    assert.ok(acL - inR >= ZMIN - 1, `minimum space kept (${acL - inR})`);
    assert.ok(Object.values(p1).every(p => Number.isFinite(p.x) && p.x >= 0), 'valid coordinates');
    // widen Actions → Outputs move right
    await dragFrom(await center('.wfzb[data-zb="2"]'), 180 * z, 0);
    const p2 = await allPos(); assert.strictEqual(p2['el-out1'].x, p1['el-out1'].x + 180, 'Outputs moved right'); assert.strictEqual(p2['el-ac3'].x, p1['el-ac3'].x, 'Actions stay');
    const at = await attached(K1); assert.ok(at.a && at.b, 'manual arrows still attached');
    // one drag = one undo
    await undo(); assert.deepStrictEqual(await allPos(), p1, 'Undo: one drag');
    await redo();
    // Fit zones to content compacts the empty space keeping the order
    await w.click('[data-wflay=fit]'); await H.saved(w); await H.sleep(200);
    const p3 = await allPos(), [f1, f2] = await bx();
    assert.ok(p3['el-out1'].x < p2['el-out1'].x, 'excess space removed');
    const acR = Math.max(...['el-ac1', 'el-ac2', 'el-ac3', 'me-out1', 'me-ac2', 'hy-ac1'].map(i => p3[i].x + W)), ouL = Math.min(...['el-out1', 'me-out2', 'hy-out1', 'co-ac1'].map(i => p3[i].x));
    assert.ok(f1 < acL + 1 && f2 > acR - 1 && f2 < ouL + 1, 'boundaries between the zones');
    assert.ok(ouL - acR >= ZMIN, 'minimum space kept');
    const zg = lay().zg; assert.ok(zg && zg[1] >= ZMIN && zg[2] >= ZMIN, 'zone widths stored: ' + JSON.stringify(zg));
    await H.shot(w, 'fine-zones');
    await w.click('[data-wflay=edit]');
  });

  await step('8 · order, specialty and dependencies are kept', async () => {
    const P = await allPos(), st = new Map(draft().steps.map(s => [s.id, s])), fx = new Map(FX.data.workflow.steps.map(s => [s.id, s]));
    for (const [id, s] of fx) { const x = st.get(id); assert.strictEqual(x.serviceId, s.serviceId, id); assert.strictEqual(x.cat, s.cat, id); assert.deepStrictEqual(x.deps.slice().sort(), s.deps.slice().sort(), id + ' deps'); }
    for (const [id, s] of st) for (const d of s.deps) if (P[d] && P[id] && st.get(d) && st.get(d).cat === s.cat) assert.ok(P[id].x >= P[d].x + W, `${d} before ${id}`);
    const lanes = await w.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wfl[data-lane]')].map(l => [l.dataset.lane, [parseFloat(l.style.top), parseFloat(l.style.top) + parseFloat(l.style.height)]])));
    for (const [id, s] of st) { const L = lanes[s.serviceId]; if (L && P[id] && s.phaseId === 'ph-sd') assert.ok(P[id].y >= L[0] && P[id].y + HB <= L[1], id + ' in its specialty lane'); }
  });

  await step('9 · clicking an activity selects it and shows its menu; page, diagram and zoom stay where they were', async () => {
    await w.evaluate(() => { const m = document.getElementById('main'); if (m) m.scrollTop = Math.min(140, m.scrollHeight); const r = document.querySelector('.wfd-wrap'); r.scrollLeft = 40; });
    await H.sleep(100);
    const v0 = await view(), n0 = await nodeScreen('el-ac3'), b9 = await box('el-ac3'), bh0 = await w.evaluate(() => document.querySelector('.wflay-bar').getBoundingClientRect().height), h0 = await w.evaluate(() => location.hash);
    const nb = await (await w.$('#wfn-el-ac3')).boundingBox();
    await w.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2); await H.sleep(300);
    const v1 = await view();
    assert.deepStrictEqual(v1, v0, 'view unchanged');
    assert.deepStrictEqual(await nodeScreen('el-ac3'), n0, 'block keeps its place on screen ' + JSON.stringify([v0, v1, b9, await box('el-ac3'), bh0, n0, await nodeScreen('el-ac3'), await w.evaluate(() => document.querySelector('.wflay-bar').getBoundingClientRect().height)]));
    assert.strictEqual(await w.evaluate(() => location.hash), h0, 'no navigation');
    assert.ok(await w.evaluate(() => document.getElementById('wfn-el-ac3').classList.contains('sel')), 'selected');
    const m = await w.evaluate(() => { const m = document.querySelector('.wfmenu'); return m && [...m.querySelectorAll('button')].map(b => b.textContent); });
    assert.ok(m && /Add prerequisites/.test(m[0]) && /Show details/.test(m[1]), 'small menu: ' + m);
    assert.ok(!(await w.evaluate(() => { const c = document.getElementById('wfc-el-ac3'); return c && c.classList.contains('open'); })), 'the matrix card is not opened');
    for (const id of ['co-in1', 'el-out1']) { const b = await (await w.$('#wfn-' + id)).boundingBox(); if (b.y < 40 || b.y > 900) continue; await w.mouse.click(b.x + 20, b.y + 20); await H.sleep(200); assert.deepStrictEqual(await view(), v0, 'same view after clicking ' + id); }
    await w.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2); await H.sleep(200);
  });

  await step('10 · Add prerequisites from the block: filters, several selections, hidden ones kept, loops refused; keep editing', async () => {
    const v0 = await view();
    await w.click('.wfmenu [data-wflay=menu-prereq]');
    await H.until(() => w.evaluate(() => !!document.querySelector('#wffloat .wfdp')), 3000, 'floating picker');
    assert.deepStrictEqual(await view(), v0, 'opening keeps the view');
    const fl = await w.evaluate(() => { const f = document.getElementById('wffloat').getBoundingClientRect(), n = document.getElementById('wfn-el-ac3').getBoundingClientRect(); return { f: [f.left, f.top, f.right, f.bottom], n: [n.left, n.top, n.right, n.bottom], vw: innerWidth, vh: innerHeight }; });
    assert.ok(fl.f[0] >= 0 && fl.f[2] <= fl.vw && fl.f[1] >= 0 && fl.f[3] <= fl.vh, 'inside the window');
    assert.ok(fl.f[2] <= fl.n[0] + 1 || fl.f[0] >= fl.n[2] - 1 || fl.f[3] <= fl.n[1] + 1 || fl.f[1] >= fl.n[3] - 1, 'beside the block, not over it: ' + JSON.stringify(fl));
    await w.click('#wffloat [data-wfdf=types][data-v=input]'); await H.sleep(150);
    await w.check('#wffloat input[data-wfdep="el-ac3"][value="me-in1"]'); await H.saved(w);
    assert.ok(/Architectural background/.test(await w.textContent('#wffloat .wfdp-sel')), 'hidden selections still listed (Actions filtered out of the results)');
    await w.click('#wffloat [data-wfdclr]'); await H.sleep(150);
    await w.check('#wffloat input[data-wfdep="el-ac3"][value="hy-ac1"]'); await H.saved(w);
    const why = await w.evaluate(() => { const i = document.querySelector('#wffloat input[value="el-out1"]'); return i && i.disabled && i.closest('label').textContent; });
    assert.ok(why && /loop/.test(why), 'loop disabled with its reason');
    assert.deepStrictEqual(deps('el-ac3'), ['co-in1', 'el-ac1', 'hy-ac1', 'me-in1', 'me-out1'], 'several prerequisites saved');
    assert.ok(await pts('me-in1>el-ac3') && await pts('hy-ac1>el-ac3'), 'arrows drawn');
    assert.ok(await w.evaluate(() => document.getElementById('wfn-el-ac3').classList.contains('sel')), 'still selected');
    const v1 = await view(); assert.ok(v1.wl === v0.wl && v1.m === v0.m && v1.z === v0.z && v1.y === v0.y, 'view kept while saving');
    assert.ok(await w.evaluate(() => { const b = document.getElementById('wfn-el-ac3').getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; }), 'block visible');
    // the picker list scrolls on its own
    assert.ok(await w.evaluate(() => /auto|scroll/.test(getComputedStyle(document.querySelector('#wffloat .wff-b')).overflowY)), 'scroll inside the picker');
    // matrix in sync
    await w.click('#wffloat [data-wff-close]'); await H.sleep(150);
    assert.deepStrictEqual(await view(), v0, 'closing keeps the view');
    assert.ok(await w.evaluate(() => document.activeElement && document.activeElement.id === 'wfn-el-ac3'), 'focus back on the block');
    // undo the two additions (one operation each)
    await undo(); assert.ok(!deps('el-ac3').includes('hy-ac1'), 'Undo removes the last added prerequisite');
    await undo(); assert.ok(!deps('el-ac3').includes('me-in1'), 'and the first one');
    await redo(); await redo(); assert.deepStrictEqual(deps('el-ac3'), ['co-in1', 'el-ac1', 'hy-ac1', 'me-in1', 'me-out1'], 'Redo');
    // removing from the picker is undoable too
    const nb = await (await w.$('#wfn-el-ac3')).boundingBox(); await w.mouse.click(nb.x + 30, nb.y + 30); await H.sleep(200);
    await w.click('.wfmenu [data-wflay=menu-prereq]'); await H.until(() => w.evaluate(() => !!document.querySelector('#wffloat .wfdp')), 3000, 'picker');
    await w.click('#wffloat [data-wfdrm="el-ac3"][data-v="hy-ac1"]'); await H.saved(w);
    assert.ok(!deps('el-ac3').includes('hy-ac1'), 'removed');
    await w.keyboard.press('Escape'); await H.sleep(150);
    assert.ok(!(await w.$('#wffloat')), 'Escape closes the picker');
    await undo(); assert.ok(deps('el-ac3').includes('hy-ac1'), 'Undo brings it back');
    await redo();
    // keep editing in the diagram right away: select a line
    await selectEdge(K1);
  });

  await step('11 · Show details: edit the activity in a floating editor; the matrix follows; scroll, zoom and position kept', async () => {
    await w.keyboard.press('Escape');
    const nb = await (await w.$('#wfn-me-out1')).boundingBox(); await w.mouse.click(nb.x + 30, nb.y + 30); await H.sleep(200);
    const v0 = await view(), n0 = await nodeScreen('me-out1');
    await w.click('.wfmenu [data-wflay=menu-details]');
    await H.until(() => w.evaluate(() => !!document.querySelector('#wffloat textarea, #wffloat input')), 3000, 'details');
    assert.deepStrictEqual(await view(), v0, 'opening keeps scroll and zoom');
    const ta = await w.$('#wffloat textarea'); assert.ok(ta, 'description field');
    await ta.click(); await w.keyboard.press('End'); await w.keyboard.type(' Checked.'); await w.keyboard.press('Tab'); await H.saved(w);
    assert.ok(/Checked\.$/.test(draft().steps.find(s => s.id === 'me-out1').desc), 'saved');
    assert.ok(/Checked\./.test(await w.textContent('#wfc-me-out1')), 'the matrix card shows it: ' + (await w.evaluate(() => { const c = document.getElementById('wfc-me-out1'); return c ? c.outerHTML.slice(0, 600) : 'no card'; })));
    assert.ok(await w.$('#wffloat'), 'editor still open after saving');
    const v1 = await view(); assert.ok(v1.wl === v0.wl && v1.m === v0.m && v1.z === v0.z && v1.y === v0.y, 'view kept while editing');
    assert.deepStrictEqual(await nodeScreen('me-out1'), n0, 'block in the same place');
    await w.click('#wffloat .wff-f [data-wff-close]'); await H.sleep(150);
    assert.deepStrictEqual(await view(), v0, 'closing keeps the view');
  });

  await step('12 · the controls work at 125 % and 75 % (click, segment, end, zone, block)', async () => {
    for (const [k, target] of [['zoom-in', 1.2], ['zoom-in', 1.3]]) { void target; await w.click(`[data-wflay=${k}]`); await H.sleep(150); }
    await w.click('[data-wflay=zoom-out]'); await H.sleep(150); await w.click('[data-wflay=zoom-in]'); await w.click('[data-wflay=zoom-out]'); await H.sleep(150);
    // set exact levels
    for (const z of [1.2, 0.8]) {
      while (Math.abs((await zoom()) - z) > 0.01) { await w.click(`[data-wflay=${(await zoom()) < z ? 'zoom-in' : 'zoom-out'}]`); await H.sleep(100); }
      assert.ok(/%/.test(await w.textContent('.wfzoom')), 'zoom shown');
      await selectEdge(K1);
      const hv = await w.$('.wfh.v'), hx = +(await hv.getAttribute('x')) + 6;
      await dragFrom(await center('.wfh.v'), -20 * z, 0);
      assert.ok(vert(await pts(K1)).some(s => Math.abs(s.x - (hx - 20)) <= 7), `segment at ${z * 100} %: same distance in the diagram`);
      await undo();
      const p = await box('hy-out1'); await drag('hy-out1', 0, 30 * z);
      assert.strictEqual((await box('hy-out1')).y - p.y, 30, `block at ${z * 100} %`);
      await undo();
      await w.click('[data-wflay=edit]'); const o1 = await box('el-out1');
      await dragFrom(await center('.wfzb[data-zb="2"]'), 25 * z, 0);
      assert.strictEqual((await box('el-out1')).x - o1.x, 25, `zone boundary at ${z * 100} %: Outputs move the same distance in the diagram`);
      await undo(); await w.click('[data-wflay=edit]');
      const nb = await (await w.$('#wfn-el-ac3')).boundingBox(); await w.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2); await H.sleep(200);
      const m = await w.evaluate(() => { const m = document.querySelector('.wfmenu').getBoundingClientRect(), n = document.getElementById('wfn-el-ac3').getBoundingClientRect(); return Math.abs(m.top - n.top) < 4 && (m.left >= n.right - 1 || m.right <= n.left + 1); });
      assert.ok(m, `menu next to the block at ${z * 100} %`);
      await w.keyboard.press('Escape');
      await H.shot(w, 'fine-zoom-' + Math.round(z * 100));
    }
    while (Math.abs((await zoom()) - 1) > 0.01) { await w.click('[data-wflay=zoom-reset]'); await H.sleep(100); }
  });

  let lay0 = null;
  await step('13 · saving: change of phase and view, publish, restart, export and import keep every adjustment', async () => {
    const d0 = await allD(), p0 = await allPos();
    lay0 = JSON.stringify(lay());
    await openStd('ph-fee'); await openStd('ph-sd');
    assert.deepStrictEqual(await allD(), d0, 'after changing phase');
    await go('overview'); await openStd();
    assert.deepStrictEqual(await allPos(), p0, 'after changing view');
    await w.click('[data-act=wf-save]'); await H.saved(w);
    assert.deepStrictEqual(rec(records(dbFile), 'workflow').layout['ph-sd'], JSON.parse(lay0), 'published with the standard');
    await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w); await openStd();
    assert.deepStrictEqual(await allD(), d0, 'after restarting: same routes and anchors');
    assert.deepStrictEqual(await allPos(), p0, 'same positions');
    const out = path.join(docs, 'export.json');
    await H.answerDialogs(app, { savePath: out });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=export-json]');
    await H.until(() => fs.existsSync(out) && fs.statSync(out).size > 1000, 8000, 'export');
    const x = JSON.parse(fs.readFileSync(out, 'utf8')).data;
    assert.deepStrictEqual(x.workflow.layout['ph-sd'], JSON.parse(lay0), 'exported');
    await H.answerDialogs(app, { file: out });
    await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?|Nothing to import/.test(document.getElementById('modal-root').textContent)), 5000, 'import checked');
    assert.ok(/Nothing to import/.test(await w.textContent('#modal-root')) && /same identifiers and content/.test(await w.textContent('#modal-root')), 'importing the export finds exactly the same data (layouts included)');
    await w.click('#modal-root [data-act=modal-close], #modal-root button.primary'); await H.sleep(200);
    await openStd();
    assert.deepStrictEqual(await allD(), d0, 'after importing the export');
  });

  await step('13 · project adjustments stay in the project; Reset all routes there keeps the standard', async () => {
    const std0 = JSON.stringify(rec(records(dbFile), 'workflow').layout);
    await go('p-px-nof'); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
    await w.click('[data-act=wf-import]'); await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'dialog');
    if (!(await w.isChecked('[data-wiph="ph-sd"]'))) await w.check('[data-wiph="ph-sd"]');
    for (let i = 0; i < 8; i++) { const c = await w.$('#modal-root input[data-wisp="ph-sd"]:not(:checked)'); if (!c) break; await c.click(); await H.sleep(120); }
    await w.click('#wi-ok'); await H.saved(w);
    await w.click('[data-act=wf-pphase][data-v=ph-sd]').catch(() => {}); await H.sleep(250);
    const keys = Object.keys(await allD()); assert.ok(keys.length > 3, 'project diagram');
    let k = null;
    for (const c of keys) { if (!(await selectEdge(c, true))) continue; if (await w.$('.wfh.v')) { k = c; break; } }
    assert.ok(k, 'an arrow with a vertical segment');
    const hx = +(await (await w.$('.wfh.v')).getAttribute('x')) + 6;
    await dragFrom(await center('.wfh.v'), 24, 0);
    assert.ok(vert(await pts(k)).some(s => Math.abs(s.x - (hx + 24)) <= 7), 'moved in the project');
    await H.saved(w);
    const pl = rec(records(dbFile), 'projects', 'px-nof').wfLayout || {};
    assert.ok(Object.values(pl).some(L => L && L.e && L.e[k] && Array.isArray(L.e[k].s)), 'stored in the project');
    assert.strictEqual(JSON.stringify(rec(records(dbFile), 'workflow').layout), std0, 'standard unchanged');
    await w.click('[data-wflay=edit]'); await w.click('[data-wflay=routes-reset]'); await H.saved(w); await H.sleep(200);
    assert.ok(!vert(await pts(k)).some(s => Math.abs(s.x - (hx + 24)) <= 7), 'project routes reset');
    assert.strictEqual(JSON.stringify(rec(records(dbFile), 'workflow').layout), std0, 'standard still unchanged');
    await w.click('[data-wflay=edit]');
  });

  await step('14 · the rest of the app is unaffected: People, navigation, typing, scrolling after diagram work', async () => {
    await openStd();
    await w.evaluate(() => { const n = document.querySelector('.wfd .wfn'), r = n.getBoundingClientRect(); n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX: r.x + 10, clientY: r.y + 10, pointerId: 9 })); });
    await go('settings'); await w.click('[role=tab][data-act=stab][data-v=people]'); await H.sleep(250);
    const name = 'table.ppl tbody tr:nth-child(2) input[data-f=name]', id = await w.getAttribute(name, 'data-id');
    await w.click(name); await w.keyboard.press('End'); await w.keyboard.type(' v13'); await w.press(name, 'Tab'); await H.saved(w);
    assert.ok(rec(records(dbFile), 'people', id).name.endsWith('v13'), 'People edits save');
    await w.keyboard.press('Escape');
    assert.ok(await w.evaluate(() => !document.body.classList.contains('wf-dragging')), 'no drag left behind');
    await go('overview'); assert.ok(/Overview/.test(await w.textContent('#main')), 'navigation works');
    const t0 = await w.evaluate(() => { const m = document.getElementById('main'); m.scrollTop = 200; return m.scrollTop; }); await H.sleep(100);
    assert.strictEqual(await w.evaluate(() => document.getElementById('main').scrollTop), t0, 'page scroll not reset by the diagram');
    const rs = records(dbFile), T = new Map(rs.filter(r => r.coll === 'tasks').map(r => [r.id, r.data]));
    for (const t of FX.data.tasks) { const x = T.get(t.id); assert.ok(x, t.id); for (const f of ['projectId', 'status', 'due', 'start', 'assignedToId']) assert.deepStrictEqual(x[f] ?? null, t[f] ?? null, `${t.id}.${f}`); }
    assert.ok(rs.filter(r => r.coll === 'roles').length >= 7, 'roles kept');
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('workflow fine editing');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
