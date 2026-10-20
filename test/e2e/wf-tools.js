'use strict';
/* Shared helpers for the workflow diagram scenarios (the window is read through w(), so they survive a restart). */
const H = require('./helpers');
const { assert } = H;
const W = 196, HB = 84;
module.exports = function wfTools(getW) {
  const w = new Proxy({}, { get: (_, k) => { const x = getW()[k]; return typeof x === 'function' ? x.bind(getW()) : x; } });
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
  return { box, ids, allPos, pts, allD, vert, horz, sideOf, attached, picked, zoom, view, nodeScreen, noToasts, center, dragFrom, drag, selectEdge };
};
