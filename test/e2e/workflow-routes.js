'use strict';
/* v1.9 acceptance: arrows with snapping segments, automatic removal of bends that are no longer needed,
   Add bend / Remove bend (several detours per arrow), Undo / Redo / restart, zoom; and the Responsible filter that
   replaces the activity-type filter (roles in the Company workflow, people in a project). Real app and data. */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');
const makeFixture = require('./wf-fixture');
const wfTools = require('./wf-tools');

function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }
const rec = (rs, c, id) => (rs.find(r => r.coll === c && r.id === (id || '_')) || {}).data;
/* the drawn line without repeated points or points in the middle of a straight line */
const norm = P => { const q = []; P.forEach(p => { const l = q[q.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) q.push(p); });
  for (let i = 1; i < q.length - 1;) { const [a, b, c] = [q[i - 1], q[i], q[i + 1]]; if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) q.splice(i, 1); else i++; } return q; };
const segs = P => P.slice(0, -1).map((a, i) => [a, P[i + 1]]);
const orth = P => segs(P).every(([a, b]) => a[0] === b[0] || a[1] === b[1]);

module.exports = async function run() {
  console.log('Workflow arrows: snapping, simplification, Add / Remove bend; Responsible filter (acceptance v1.9)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Routes');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, { fine: true });
  /* one step without a responsible role, for "Unassigned" */
  { const j = JSON.parse(fs.readFileSync(FX.file, 'utf8')), st = j.data.workflow.steps, x = JSON.parse(JSON.stringify(st.find(s => s.id === 'hy-ac1')));
    Object.assign(x, { id: 'hy-chk', name: 'Check hydraulic loads', deps: ['hy-ac1'], roleIds: [], order: st.length }); st.push(x);
    st.find(s => s.id === 'hy-out1').deps.push('hy-chk'); fs.writeFileSync(FX.file, JSON.stringify(j)); }
  let { app, w } = await H.launch(ud);
  const T = wfTools(() => w), { pts, center, dragFrom, noToasts, selectEdge, zoom } = T;
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const openStd = async () => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click('[data-act=wf-sphase][data-v=ph-sd]'); await H.sleep(300); };
  const restart = async () => { await H.sleep(900); await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w); };
  const scr = (x, y) => w.evaluate(([x, y]) => { const r = document.querySelector('.wfd').getBoundingClientRect(), z = r.width / document.querySelector('.wfd').offsetWidth; return { x: r.left + x * z, y: r.top + y * z }; }, [x, y]);
  const setZoom = async z => { for (let i = 0; i < 30 && Math.abs((await zoom()) - z) > 0.01; i++) { await w.click(`[data-wflay=${(await zoom()) < z ? 'zoom-in' : 'zoom-out'}]`); await H.sleep(120); } assert.ok(Math.abs((await zoom()) - z) < 0.01, 'zoom ' + z); };
  /* the square handle of a segment: the one on that line */
  const handle = (P, a, b) => w.evaluate(([a, b]) => { const v = a[0] === b[0], lo = v ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]), hi = v ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
    const h = [...document.querySelectorAll('.wfh')].find(r => { const x = +r.getAttribute('x') + 6, y = +r.getAttribute('y') + 6; return v ? x === a[0] && y >= lo && y <= hi : y === a[1] && x >= lo && x <= hi; });
    if (!h) return null; h.scrollIntoView({ block: 'center', inline: 'center' }); const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, j: +h.dataset.wfseg }; }, [a, b]);
  const dragSeg = async (a, b, dd, mid) => { const h = await handle(null, a, b); assert.ok(h, 'handle of ' + JSON.stringify([a, b])); const z = await zoom(), v = a[0] === b[0];
    await dragFrom(h, v ? dd * z : 0, v ? 0 : dd * z, mid); await H.saved(w); await H.sleep(150); };
  const clickOn = async (x, y) => { const s = await scr(x, y); await noToasts(); await w.mouse.click(s.x, s.y); await H.sleep(150); };
  const btn = k => w.evaluate(x => { const b = document.querySelector(`[data-wflay=${x}]`); return b ? !b.disabled : null; }, k);
  let K, P0, V;   // the arrow, its original line and the vertical segment used

  await step('set-up (Schematic standard with several arrows; one step without a responsible role)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Routes'); await w.click('[data-sact=pick-create]');
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
    /* an arrow with a long inner vertical segment between two horizontal ones */
    const all = await w.evaluate(() => [...document.querySelectorAll('path.wfe-hit')].map(p => [p.dataset.wfe, p.getAttribute('d').slice(1).split(' L').map(s => s.split(',').map(Number))]));
    for (const [k, P] of all) { const n = norm(P); for (let i = 1; i < n.length - 3; i++) { const a = n[i], b = n[i + 1]; if (a[0] === b[0] && Math.abs(a[1] - b[1]) >= 120 && n[i - 1][1] === a[1] && n[i + 2][1] === b[1] && Math.abs(n[i + 2][0] - b[0]) >= 24) { K = k; P0 = n; V = [a, b]; break; } } if (K) break; }
    assert.ok(K, 'an arrow with an inner vertical segment: ' + all.map(x => x[0]));
  });

  const deps0 = () => draft().steps.map(s => [s.id, s.deps.slice().sort(), JSON.stringify(s.branches || null)]);
  let D0, P1, bump;

  await step('Add bend: click a point of the line, then Add bend → a detour of three new segments with handles; ends and dependencies unchanged', async () => {
    D0 = deps0();
    await selectEdge(K);
    assert.strictEqual(await btn('bend-add'), true, 'clicking the line marks the point for Add bend');
    const [a, b] = V, m = Math.round(a[1] + (b[1] - a[1]) * 0.32);   // not on the square handle (the middle)
    await clickOn(a[0], m);
    assert.ok(await w.$('.wfbp'), 'the point is shown');
    await w.click('[data-wflay=bend-add]'); await H.saved(w); await H.sleep(150);
    P1 = norm(await pts(K));
    assert.strictEqual(P1.length, P0.length + 4, 'four more corners: ' + JSON.stringify(P1));
    assert.ok(orth(P1), 'orthogonal');
    assert.deepStrictEqual([P1[0], P1[P1.length - 1]], [P0[0], P0[P0.length - 1]], 'the ends stay on their blocks');
    /* the detour: a parallel vertical line and two short horizontal ones */
    const i = P1.findIndex((p, j) => j > 0 && p[1] !== P1[j - 1][1] && false) ; void i;
    const vb = segs(P1).find(([p, q]) => p[0] === q[0] && p[0] !== a[0] && Math.min(p[1], q[1]) > Math.min(a[1], b[1]) && Math.max(p[1], q[1]) < Math.max(a[1], b[1]));
    assert.ok(vb, 'parallel segment of the detour');
    const xs = [a[0], vb[0][0]].sort((u, v) => u - v), hs = segs(P1).filter(([p, q]) => p[1] === q[1] && [p[0], q[0]].sort((u, v) => u - v).join() === xs.join());
    assert.strictEqual(hs.length, 2, 'two short horizontal segments: ' + JSON.stringify({ K, P0, V, P1 }));
    bump = { xb: vb[0][0], h1: hs[0], h2: hs[1] };
    assert.ok(await w.$('.wfh.sel'), 'the new segment is selected, ready to move');
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('.wfh').length >= 6), true, 'handles for the new segments');
    assert.deepStrictEqual(deps0(), D0, 'dependencies unchanged');
    assert.strictEqual(await T.picked(), K, 'the arrow stays selected');
  });

  await step('2 · aligning two horizontal segments removes the vertical one between them (stable while dragging, shown with a guide)', async () => {
    const [a, b] = V, down = b[1] > a[1];
    /* the short horizontal nearest the end of the vertical segment goes to the level of the next horizontal one */
    const hb = bump.h2, target = b[1], dd = target - hb[0][1]; void down;   // the detour's horizontal nearest the end of the vertical segment
    let guide = false, mid1 = null;
    await dragSeg(hb[0], hb[1], dd, async () => { guide = await w.evaluate(() => !!document.querySelector('.wfg.seg')); mid1 = norm(await pts(K)); });
    assert.ok(guide, 'a guide shows the alignment');
    const P2 = norm(await pts(K));
    assert.deepStrictEqual(P2, mid1, 'what is seen while dragging is what is kept when dropped');
    assert.strictEqual(P2.length, P1.length - 2, 'one corner pair less: ' + JSON.stringify(P2));
    assert.ok(!segs(P2).some(([p, q]) => p[0] === a[0] && q[0] === a[0] && (p[1] === b[1] || q[1] === b[1])), 'the vertical piece between them is gone: ' + JSON.stringify(P2));
    assert.ok(segs(P2).some(([p, q]) => p[0] === bump.xb && q[0] === bump.xb && (p[1] === b[1] || q[1] === b[1])), 'the detour now reaches the next horizontal line');
    assert.ok(orth(P2) && P2[0][0] === P0[0][0] && P2[P2.length - 1][1] === P0[P0.length - 1][1], 'orthogonal, ends kept');
    bump.P2 = P2;
  });

  await step('1 · aligning two vertical segments removes the horizontal one between them: the line is straight again', async () => {
    const [a] = V, vb = segs(bump.P2).find(([p, q]) => p[0] === bump.xb && q[0] === bump.xb);
    await dragSeg(vb[0], vb[1], a[0] - bump.xb + (a[0] > bump.xb ? -3 : 3));   // dropped 3 px short: it snaps
    const P3 = norm(await pts(K));
    assert.deepStrictEqual(P3, P0, 'the two verticals became one: ' + JSON.stringify(P3));
    assert.deepStrictEqual(deps0(), D0, 'dependencies unchanged');
  });

  await step('5 · Undo / Redo: each complete drag is one step; a restart keeps the route', async () => {
    await w.click('[data-wflay=undo]'); await H.saved(w); await H.sleep(150);
    assert.deepStrictEqual(norm(await pts(K)), bump.P2, 'undo: before the last drag');
    await w.click('[data-wflay=undo]'); await H.saved(w); await H.sleep(150);
    assert.deepStrictEqual(norm(await pts(K)), P1, 'undo: before the first drag');
    await w.click('[data-wflay=undo]'); await H.saved(w); await H.sleep(150);
    assert.deepStrictEqual(norm(await pts(K)), P0, 'undo: before Add bend');
    for (let i = 0; i < 3; i++) { await w.click('[data-wflay=redo]'); await H.saved(w); await H.sleep(150); }
    assert.deepStrictEqual(norm(await pts(K)), P0, 'redo ×3: straight again');
    await w.click('[data-wflay=undo]'); await H.saved(w); await H.sleep(150);   // keep the detour reaching the next line, to check it after a restart
    await restart(); await openStd();
    assert.deepStrictEqual(norm(await pts(K)), bump.P2, 'the edited route after a restart');
    const L = draft().layout['ph-sd'].e[K];
    assert.ok(L && Array.isArray(L.s) && L.s.length <= 8, 'stored with few coordinates: ' + JSON.stringify(L));
    await selectEdge(K); await w.click('[data-wflay=route-reset]'); await H.saved(w); await H.sleep(150);
    assert.deepStrictEqual(norm(await pts(K)), P0, 'Reset selected route');
  });

  await step('3 · several detours on one arrow, around blocks; each stays editable; Remove bend; double-click adds one', async () => {
    await selectEdge(K);
    const [a, b] = V, lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
    await clickOn(a[0], lo + 30); await w.click('[data-wflay=bend-add]'); await H.saved(w); await H.sleep(150);
    await clickOn(a[0], hi - 30); await w.click('[data-wflay=bend-add]'); await H.saved(w); await H.sleep(150);
    const P = norm(await pts(K));
    assert.strictEqual(P.length, P0.length + 8, 'two detours: ' + JSON.stringify(P));
    const rects = await w.evaluate(() => [...document.querySelectorAll('.wfd .wfn')].map(n => ({ id: n.dataset.id, x: parseFloat(n.style.left), y: parseFloat(n.style.top) })));
    const [ka, kb] = K.split('>'), cross = segs(P.slice(1, -1)).some(([p, q]) => rects.some(r => r.id !== ka && r.id !== kb && Math.max(p[0], q[0]) > r.x + 2 && Math.min(p[0], q[0]) < r.x + 194 && Math.max(p[1], q[1]) > r.y + 2 && Math.min(p[1], q[1]) < r.y + 82));
    assert.ok(!cross, 'the detours cross no block');
    /* the second detour's parallel line moves further out; the first one is not touched */
    const par = segs(P).filter(([p, q]) => p[0] === q[0] && p[0] !== a[0] && Math.min(p[1], q[1]) > lo && Math.max(p[1], q[1]) < hi).sort((s, t) => Math.min(s[0][1], s[1][1]) - Math.min(t[0][1], t[1][1]));
    assert.strictEqual(par.length, 2, 'two parallel lines');
    const out = par[1][0][0] > a[0] ? 40 : -40;
    await dragSeg(par[1][0], par[1][1], out);
    const Q = norm(await pts(K));
    assert.ok(segs(Q).some(([p, q]) => p[0] === par[1][0][0] + out && q[0] === p[0]), 'second detour moved');
    assert.ok(segs(Q).some(([p, q]) => p[0] === par[0][0][0] && q[0] === p[0] && p[1] === par[0][0][1]), 'first detour unchanged');
    /* Remove bend: select the moved line (click its handle), then Remove bend */
    const mv = segs(Q).find(([p, q]) => p[0] === par[1][0][0] + out && q[0] === p[0]), h = await handle(null, mv[0], mv[1]);
    await noToasts(); await w.mouse.click(h.x, h.y); await H.sleep(150);
    assert.ok(await w.$('.wfh.sel'), 'segment selected'); assert.strictEqual(await btn('bend-rm'), true);
    await w.click('[data-wflay=bend-rm]'); await H.saved(w); await H.sleep(150);
    const R = norm(await pts(K));
    assert.strictEqual(R.length, P0.length + 4, 'one detour left: ' + JSON.stringify(R));
    assert.ok(orth(R) && R[0][0] === P0[0][0] && R[R.length - 1][0] === P0[P0.length - 1][0]);
    /* double-click on the line adds a bend there too */
    const s = await scr(a[0], hi - 20); await noToasts(); await w.mouse.dblclick(s.x, s.y); await H.saved(w); await H.sleep(150);
    assert.strictEqual(norm(await pts(K)).length, P0.length + 8, 'double-click: another detour');
    assert.deepStrictEqual(deps0(), D0, '4 · dependencies and outlets unchanged');
    await w.click('[data-wflay=route-reset]'); await H.saved(w); await H.sleep(150);
  });

  await step('6 · snapping uses screen pixels: at 50 % and 150 % a segment dropped a few screen px from the line snaps (and merges); at 150 % one 12 screen px away does not', async () => {
    const [a, b] = V, m = Math.round(a[1] + (b[1] - a[1]) * 0.32);
    for (const [z, px, snaps] of [[0.5, 4, true], [1.5, 12, false], [1.5, 3, true]]) {
      await setZoom(z); await selectEdge(K); await clickOn(a[0], m); await w.click('[data-wflay=bend-add]'); await H.saved(w); await H.sleep(150);
      const P = norm(await pts(K)), vb = segs(P).find(([p, q]) => p[0] === q[0] && p[0] !== a[0] && Math.min(p[1], q[1]) > Math.min(a[1], b[1]) && Math.max(p[1], q[1]) < Math.max(a[1], b[1]));
      const sgn = vb[0][0] > a[0] ? 1 : -1, dd = (a[0] - vb[0][0]) + (snaps ? -1 : 1) * sgn * px / z;   // dropped px screen pixels past (snaps) or before (not) the original line
      await dragSeg(vb[0], vb[1], dd);
      const Q = norm(await pts(K));
      if (snaps) assert.deepStrictEqual(Q, P0, `zoom ${z}: snapped and merged ` + JSON.stringify({ P, vb, dd, Q }));
      else { assert.strictEqual(Q.length, P0.length + 4, `zoom ${z}: ${px} screen px is outside the tolerance`); await selectEdge(K); await w.click('[data-wflay=route-reset]'); await H.saved(w); await H.sleep(150); }
    }
    await setZoom(1);
  });

  await step('8 · the type filter is gone; types and shapes are still editable', async () => {
    assert.strictEqual(await w.$('[data-act=wf-stype]'), null, 'no Types row');
    assert.strictEqual(await w.evaluate(() => /\bTypes\b/.test(document.querySelector('.wfspec.wfresp').parentElement.textContent)), false);
    const ty = await w.$('[id$="-ty"]');
    if (!ty) { await w.evaluate(() => { const b = document.querySelector('[data-act=wf-exp]'); b && b.click(); }); await H.sleep(200); }
    assert.ok(await w.$('select[id$="-ty"]'), 'the type selector of a step');
    const opts = await w.evaluate(() => [...document.querySelector('select[id$="-ty"]').options].map(o => o.value));
    assert.deepStrictEqual(opts.sort(), ['decision', 'document', 'info', 'normal', 'qa'].sort());
    assert.ok(await w.$('.wfd .wfn.sh-rect, .wfd .wfn'), 'shapes drawn');
  });

  await step('7 · Responsible (Company workflow = roles): search, several = OR, with specialties = AND, Unassigned, empty state, own layout; data and routes unchanged', async () => {
    const d0 = JSON.stringify(draft().steps), ids = () => T.ids();
    const roleOf = id => (draft().steps.find(s => s.id === id) || {}).roleIds || [];
    const own = list => list.filter(id => !/ref/.test(id));
    const all0 = await ids();
    /* many roles: a compact selector with search */
    assert.ok(await w.$('.wfrp-btn'), 'selector (more than five responsibles)');
    await w.click('.wfrp-btn'); await H.sleep(150);
    assert.ok(await w.evaluate(() => document.activeElement.classList.contains('wfrp-q')), 'focus in the search');
    await w.keyboard.type('engineer'); await H.sleep(100);
    const shown = await w.evaluate(() => [...document.querySelectorAll('.wfrp-o:not([hidden])')].map(o => o.textContent));
    assert.ok(shown.includes('Engineer') && !shown.includes('Drafter') && shown.includes('Unassigned'), 'search: ' + shown);
    await w.click('.wfrp-o[data-v="ro-eng"]'); await H.sleep(250);
    const eng = await ids(), isOwn = id => draft().steps.some(s => s.id === id && s.phaseId === 'ph-sd');
    const cls = id => w.evaluate(i => document.getElementById('wfn-' + i).className, id);
    for (const id of eng) if (!/\bref\b/.test(await cls(id))) assert.ok(roleOf(id).includes('ro-eng'), 'Engineer only (plus what they need, as references): ' + id);
    assert.ok(eng.includes('el-ac1') && !eng.includes('me-ac2') || /\bref\b/.test(await cls('me-ac2').catch(() => 'ref')), 'Mechanical layout (BIM / Drafter) hidden');
    assert.ok(await w.evaluate(() => !document.querySelector('.wfrp-pop').hidden), 'stays open for several choices');
    await w.fill('.wfrp-q', ''); await H.sleep(80);
    await w.click('.wfrp-o[data-v="ro-dft"]'); await H.sleep(250);
    const or = await ids();
    assert.ok(or.includes('el-ac3') && or.includes('el-ac1'), 'Engineer OR Drafter: ' + or);
    await w.keyboard.press('Escape'); await H.sleep(100);
    assert.ok(await w.evaluate(() => document.querySelector('.wfrp-pop').hidden), 'Esc closes the selector');
    assert.ok(/Engineer|Drafter/.test(await w.textContent('.wfrp-btn')), 'the button names the choice');
    /* AND with the specialty */
    await w.click('[data-act=wf-sspec][data-v=sv-electrical]'); await H.sleep(250);
    for (const id of await ids()) if (!/\bref\b/.test(await cls(id))) { const s = draft().steps.find(x => x.id === id); assert.ok(s.serviceId === 'sv-electrical' && (s.roleIds.includes('ro-eng') || s.roleIds.includes('ro-dft')), 'Electrical AND (Engineer OR Drafter): ' + id); }
    /* a filtered view has its own layout: moving a block there does not move it in the full view */
    const k0 = Object.keys(draft().layout || {});
    await T.drag('el-ac1', 0, 40); await H.saved(w);
    const k1 = Object.keys(draft().layout || {}).filter(k => !k0.includes(k));
    assert.ok(k1.some(k => /^ph-sd~sv-electrical@ro-dft\+ro-eng$/.test(k)), 'stored as its own view: ' + Object.keys(draft().layout));
    /* empty: Hydraulics + QA → nothing; the empty state clears the filter */
    await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(200); await w.click('[data-act=wf-sspec][data-v=sv-hydraulics]'); await H.sleep(200);
    await w.click('.wfrp-x'); await H.sleep(200); await w.click('.wfrp-btn'); await w.click('.wfrp-o[data-v="ro-qa"]'); await H.sleep(250); await w.keyboard.press('Escape');
    assert.ok(/No activities for the selected responsible/.test(await w.textContent('.wfd-empty')), 'empty state');
    await w.click('.wfd-empty [data-v=_all]'); await H.sleep(250);
    assert.ok((await ids()).includes('hy-ac1'), 'Clear responsible filter');
    /* Unassigned: the step without a role */
    await w.click('.wfrp-btn'); await w.click('.wfrp-o[data-v="_none"]'); await H.sleep(250); await w.keyboard.press('Escape');
    const un = await ids(), ownUn = []; for (const id of un) if (!/\bref\b/.test(await cls(id))) ownUn.push(id);
    assert.deepStrictEqual(ownUn, ['hy-chk'], 'Unassigned: ' + un);
    /* All: back to everything; nothing was changed by filtering */
    await w.click('.wfrp-x'); await H.sleep(200); await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(250);
    assert.deepStrictEqual((await ids()).sort(), all0.sort(), 'All: every activity again');
    assert.strictEqual(JSON.stringify(draft().steps), d0, 'filtering changed no data');
    assert.deepStrictEqual(norm(await pts(K)), P0, 'routes of the full view unchanged');
    void isOwn; void own;
  });

  await step('7 · Responsible in a project = people: one, several, Unassigned; AND with phase and specialty; changes nothing', async () => {
    await w.click('[data-act=wf-save]'); await H.sleep(300);
    const c = await w.$('#modal-root button.primary'); if (c) { await c.click(); await H.sleep(300); } await H.saved(w);
    await go('p-px-nof'); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(250);
    await w.click('[data-act=wf-import]'); await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'dialog');
    if (!(await w.isChecked('[data-wiph="ph-sd"]'))) await w.check('[data-wiph="ph-sd"]');
    for (let i = 0; i < 6; i++) { const c2 = await w.$('#modal-root input[data-wisp="ph-sd"]:not(:checked)'); if (!c2) break; await c2.click(); await H.sleep(120); }
    await w.selectOption('[data-wias="el-ac1"]', 'pe-dr'); await w.selectOption('[data-wias="me-out1"]', 'pe-lc').catch(() => {}); await w.selectOption('[data-wias="el-ac2"]', 'pe-lc').catch(() => {}); await w.click('#wi-ok'); await H.saved(w); await H.sleep(300);
    await w.click('[data-act=wf-pphase][data-v=ph-sd]').catch(() => {}); await H.sleep(250);
    const tasks = () => records(dbFile).filter(r => r.coll === 'tasks' && r.data.projectId === 'px-nof' && r.data.wfStepId).map(r => r.data);
    const t0 = JSON.stringify(tasks()), people = [...new Set(tasks().map(t => t.assignedToId).filter(Boolean))];
    assert.ok(people.length >= 2, 'at least two people assigned: ' + people);
    const intIds = async () => { const out = []; for (const id of await T.ids()) if (await w.evaluate(i => !/\bref\b|\bext\b/.test(document.getElementById('wfn-' + i).className), id)) out.push(id); return out; };
    const pick = async v => { const sel = await w.$('.wfrp-btn'); if (sel) { await w.click('.wfrp-btn'); await w.click(`.wfrp-o[data-v="${v}"]`); await w.keyboard.press('Escape'); } else await w.click(`[data-act=wf-presp][data-v="${v}"]`); await H.sleep(250); };
    const who = id => (tasks().find(t => t.wfStepId === id) || {}).assignedToId || null;
    await pick(people[0]);
    for (const id of await intIds()) assert.strictEqual(who(id), people[0], 'one person: ' + id);
    await pick(people[1]);
    const two = await intIds(); assert.ok(two.some(id => who(id) === people[0]) && two.some(id => who(id) === people[1]) && two.every(id => people.slice(0, 2).includes(who(id))), 'two people (OR): ' + two);
    await pick('_all'); await pick('_none');
    const un = await intIds(); assert.ok(un.length && un.every(id => !who(id)), 'Unassigned: ' + un);
    await w.click('[data-act=wf-pspec][data-v=sv-hydraulics]'); await H.sleep(250);
    for (const id of await intIds()) { const s = draft().steps.find(x => x.id === id); assert.ok(s.serviceId === 'sv-hydraulics' && !who(id), 'Hydraulics AND Unassigned: ' + id); }
    await w.click('[data-act=wf-pspec][data-v=_all]'); await H.sleep(200); await pick('_all');
    assert.strictEqual(JSON.stringify(tasks()), t0, 'filtering changed no task');
    assert.deepStrictEqual(w.errors, [], 'no page errors');
  });

  await app.close();
};
