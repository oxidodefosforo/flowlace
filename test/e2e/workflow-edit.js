'use strict';
/* Workflow editing — acceptance checks:
    1 People settings work before and after editing the diagram (also after a press that never ended in it)
    2 a new Output without dependencies appears in the Outputs zone   3 new Inputs / Actions go to the start of their zone
    4 references from other phases sit in the shared Inputs zone        5 moving an Action down grows its lane in real time
    6 widening Actions moves the Outputs separator and the Outputs      7 moves keep the sequence and the dependencies
    8 filters in “Depends on” never drop hidden selections              9 each card expands on its own
   10 guides align blocks without changing their specialty             11 the start of an arrow can go to the top side
   12 anchors and routes survive moving the blocks                     13 Connect A → B updates “Depends on” of B
   14 duplicates and loops are refused with an explanation             15 Undo / Redo restore whole operations
   16 restarting keeps the layout                                      17 existing data keeps its information */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');
const makeFixture = require('./wf-fixture');

const W = 196, HB = 84, GAP = 24, ZG = 84;
function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }
const rec = (rs, c, id) => (rs.find(r => r.coll === c && r.id === (id || '_')) || {}).data;

module.exports = async function run() {
  console.log('Workflow editing (acceptance)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Edit');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs);
  let { app, w } = await H.launch(ud);
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const box = id => w.evaluate(i => { const el = document.getElementById('wfn-' + i); return el ? { x: parseFloat(el.style.left), y: parseFloat(el.style.top) } : null; }, id);
  const lane = l => w.evaluate(k => { const el = document.querySelector(`.wfl[data-lane="${k}"]`); return el ? { y: parseFloat(el.style.top), h: parseFloat(el.style.height) } : null; }, l);
  const sepX = () => w.evaluate(() => { const s = document.querySelector('.wfzsep'); return s ? parseFloat(s.style.left) : null; });
  const ids = () => w.evaluate(() => [...document.querySelectorAll('.wfd .wfn')].map(n => n.dataset.id));
  const allPos = async () => { const l = await ids(), o = {}; for (const id of l) o[id] = await box(id); return o; };
  const edgeD = k => w.evaluate(x => { const p = document.querySelector(`path.wfe[data-k="${x}"]`); return p && p.getAttribute('d'); }, k);
  const draft = () => rec(records(dbFile), 'workflowDraft') || rec(records(dbFile), 'workflow');
  const cats = async () => Object.fromEntries(draft().steps.map(s => [s.id, s.cat]));
  async function center(sel) { const el = await w.$(sel); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; }
  async function drag(id, dx, dy, mid) {
    const c = await center('#wfn-' + id);
    await w.mouse.move(c.x, c.y); await w.mouse.down(); await w.mouse.move(c.x + dx / 3, c.y + dy / 3, { steps: 4 }); await w.mouse.move(c.x + dx, c.y + dy, { steps: 10 });
    if (mid) await mid();
    await w.mouse.up(); await H.sleep(250);
  }
  const openStd = async (ph = 'ph-sd') => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200); await w.click(`[data-act=wf-sphase][data-v=${ph}]`); await H.sleep(250); };
  const people = async () => { await go('settings'); await w.click('[role=tab][data-act=stab][data-v=people]'); await H.sleep(250); };
  const edges = () => w.evaluate(() => [...document.querySelectorAll('path.wfe[data-k]')].map(p => p.dataset.k));
  async function checkOrder(tag) {
    const P = await allPos(), cs = await cats(), zone = id => (P[id] && document) ? null : null; void zone;
    for (const k of await edges()) { const [a, b] = k.split('>'); if (!P[a] || !P[b]) continue; const za = a.startsWith('fee') ? 0 : { input: 0, action: 1, output: 2 }[cs[a]], zb = { input: 0, action: 1, output: 2 }[cs[b]]; if (za > zb) continue;
      assert.ok(P[b].x >= P[a].x + W + GAP - 1, `${tag}: ${a} → ${b} keeps its order (${P[a].x} → ${P[b].x})`); }
  }
  async function peopleWork(tag) {
    await people();
    assert.ok(await w.evaluate(() => !!document.querySelector('table.ppl')), tag + ': People table shown');
    const name = 'table.ppl tbody tr:nth-child(2) input[data-f=name]', id = await w.getAttribute(name, 'data-id');
    await w.click(name); await w.keyboard.press('End'); await w.keyboard.type(' ' + tag);
    assert.ok(await w.evaluate(s => document.activeElement === document.querySelector(s), name), tag + ': focus stays in the field');
    await w.press(name, 'Tab'); await H.saved(w);
    await w.selectOption(`#pe-${id}-d`, 'sv-coordination'); await H.saved(w);
    await w.evaluate(i => { document.querySelector(`[data-perole="${i}"]`).closest('details').open = true; }, id);
    const r = tag === 'before' ? 'ro-bimc' : 'ro-qa';
    await w.check(`[data-perole="${id}"][value="${r}"]`); await H.saved(w);
    assert.ok(await w.evaluate(i => document.querySelector(`[data-perole="${i}"]`).closest('details').open, id), tag + ': role list stays open after ticking');
    assert.ok(/BIM Coordinator|Reviewer/.test(await w.evaluate(i => document.querySelector(`[data-perole="${i}"]`).closest('details').querySelector('summary').textContent, id)), tag + ': summary updated');
    const pe = rec(records(dbFile), 'people', id);
    assert.ok(pe.name.endsWith(tag) && pe.disciplineId === 'sv-coordination' && pe.roleIds.includes(r), tag + ': saved ' + JSON.stringify(pe));
    await w.click('#top [data-act=nav][data-to=overview]').catch(async () => { await go('overview'); });
    await H.sleep(200);
    assert.ok(/Overview/.test(await w.textContent('#main')), tag + ': navigating to another section works');
  }

  await step('set-up (workspace with the HTML data and the Schematic standard)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Edit'); await w.click('[data-sact=pick-create]');
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

  await step('1a · People: enter, select, edit name, discipline and roles, save, navigate (before the diagram)', () => peopleWork('before'));

  await step('4 · references from other phases sit in the Inputs zone, before the Input they feed', async () => {
    await openStd();
    const ref = await box('fee-co-out'), inp = await box('co-in1'), firstAction = Math.min(...(await Promise.all(['el-ac1', 'me-out1', 'hy-ac1'].map(box))).map(p => p.x));
    assert.ok(ref && inp, 'shown');
    assert.ok(ref.x + W <= inp.x - 1, 'sub-column: reference left of the Input it feeds');
    assert.ok(inp.x + W + ZG <= firstAction, 'both in the Inputs zone, before the Actions');
    const t = await w.textContent('#wfn-fee-co-out');
    assert.ok(/From Sketch|From Fee/.test(t) && /Output/i.test(t) === false || /From Fee/.test(t), 'identified as a reference with its phase: ' + t);
    assert.ok(/Other phases/.test(await w.textContent('.wfl[data-lane="_ref"]')), 'band “Other phases”');
    const sx = await sepX(), outs = await Promise.all(['el-out1', 'me-out2', 'hy-out1', 'co-ac1'].map(box)), acts = await Promise.all(['el-ac1', 'el-ac2', 'me-out1', 'me-ac2', 'hy-ac1'].map(box));
    assert.ok(sx > Math.max(...acts.map(p => p.x + W)) && sx < Math.min(...outs.map(p => p.x)), 'Outputs separator between Actions and Outputs');
    assert.ok(/Outputs — Sketch/.test(await w.textContent('.wfzsep')), 'separator title with the phase');
    await H.shot(w, 'edit-zones');
  });

  let before5 = null;
  await step('5 · moving an Action down grows Electrical in real time and pushes the lanes below (and Other phases)', async () => {
    before5 = await allPos();
    const E0 = await lane('sv-electrical'), R0 = await lane('_ref');
    let mid = null;
    await drag('el-ac1', 0, 220, async () => { mid = { E: await lane('sv-electrical'), R: await lane('_ref') }; });
    const E1 = await lane('sv-electrical'), R1 = await lane('_ref'), p = await box('el-ac1');
    assert.ok(mid.E.h > E0.h + 150, 'grows while dragging: ' + JSON.stringify([E0, mid.E]));
    assert.ok(mid.R.y > R0.y + 150, 'the separator with Other phases moves while dragging');
    assert.ok(p.y + HB + 10 <= E1.y + E1.h, 'margin below the block');
    assert.strictEqual(R1.y - R0.y, E1.h - E0.h, 'Other phases pushed by the growth');
    assert.strictEqual((await box('fee-co-out')).y - before5['fee-co-out'].y, E1.h - E0.h, 'its blocks move with it');
    await checkOrder('after moving down');
  });

  await step('6 · widening Actions to the right moves the Outputs separator and the Outputs that need room', async () => {
    const s0 = await sepX(), m0 = await box('me-ac2');
    await drag('me-ac2', 320, 0);
    const s1 = await sepX(), m1 = await box('me-ac2'), outs = await Promise.all(['el-out1', 'me-out2', 'hy-out1', 'co-ac1'].map(box)), acts = await Promise.all(['el-ac1', 'el-ac2', 'me-out1', 'me-ac2', 'hy-ac1'].map(box));
    assert.strictEqual(m1.x - m0.x, 320, 'the Action moved as dragged');
    assert.ok(s1 > s0 + 200, 'separator moved right: ' + s0 + ' → ' + s1);
    assert.ok(Math.min(...outs.map(p => p.x)) >= Math.max(...acts.map(p => p.x + W)) + ZG - 1, 'Outputs keep the margin after the Actions');
    await checkOrder('after widening');
    await H.shot(w, 'edit-separator');
  });

  await step('7 · sequence and dependencies are kept after the moves', () => checkOrder('final'));

  await step('15 · Undo / Redo restore whole operations (blocks, lanes, separator)', async () => {
    const now = await allPos(), s = await sepX();
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    const u = await allPos();
    assert.ok(u['me-ac2'].x < now['me-ac2'].x && (await sepX()) < s, 'last move undone, separator back');
    await w.click('[data-wflay=undo]'); await H.sleep(200);
    const u2 = await allPos();
    for (const id of Object.keys(before5)) assert.deepStrictEqual(u2[id], before5[id], id + ' back to before both moves');
    await w.click('[data-wflay=redo]'); await H.sleep(150); await w.click('[data-wflay=redo]'); await H.sleep(200);
    const r = await allPos();
    for (const id of Object.keys(now)) assert.deepStrictEqual(r[id], now[id], id + ' redone');
    assert.strictEqual(await sepX(), s);
  });

  await step('2/3 · new Output (no dependencies) in the Outputs zone; new Input and Action at the start of their zones', async () => {
    const P0 = await allPos(), cs = await cats();
    const firstOf = c => Math.min(...Object.keys(P0).filter(id => cs[id] === c && !id.startsWith('fee')).map(id => P0[id].x));
    const add = async (cat, name, spec) => { await w.selectOption(`#wf-add-${cat}-sp`, spec); await w.fill(`#wf-add-${cat}`, name); await w.press(`#wf-add-${cat}`, 'Enter'); await H.sleep(300);
      return w.evaluate(n => { const b = [...document.querySelectorAll('.wfd .wfn')].find(x => x.querySelector('.wfn-n').textContent === n); return b && b.dataset.id; }, name); };
    const o = await add('output', 'Lighting concept note', 'sv-electrical');
    const po = await box(o), sx = await sepX();
    assert.ok(po.x > sx, 'Output after the separator (Outputs zone): ' + po.x + ' > ' + sx);
    assert.ok(po.x <= firstOf('output'), 'at the start of the Outputs zone');
    const i = await add('input', 'Client lighting standards', 'sv-electrical');
    const pi = await box(i), P1 = await allPos();
    assert.ok(pi.x <= firstOf('input') && pi.x < Math.min(...Object.keys(P1).filter(id => cs[id] === 'action').map(id => P1[id].x)) - W, 'Input at the start of the Inputs zone');
    const a = await add('action', 'Lighting calculations', 'sv-electrical');
    const pa = await box(a), P2 = await allPos(), inputsEnd = Math.max(...Object.keys(P2).filter(id => ['input'].includes(cs[id]) || id === i || id.startsWith('fee')).map(id => P2[id].x + W));
    assert.ok(pa.x >= inputsEnd + ZG - 1, 'Action after the Inputs zone');
    assert.ok(pa.x <= Math.min(...Object.keys(P2).filter(id => cs[id] === 'action').map(id => P2[id].x)), 'Action at the start of the Actions zone');
    for (const [x, y] of [[o, 'output'], [i, 'input'], [a, 'action']]) assert.strictEqual(rec(records(dbFile), 'workflowDraft').steps.find(s => s.id === x).cat, y);
    for (const id of [o, i, a]) assert.ok(await w.evaluate(x => document.querySelector(`.wfl[data-lane="sv-electrical"]`) && (() => { const n = document.getElementById('wfn-' + x), l = document.querySelector('.wfl[data-lane="sv-electrical"]'); const t = parseFloat(n.style.top), lt = parseFloat(l.style.top); return t >= lt && t + 84 <= lt + parseFloat(l.style.height); })(), id), 'in the Electrical lane');
    // no overlaps anywhere
    const P = await allPos(), L = Object.keys(P);
    for (const p of L) for (const q of L) if (p < q) assert.ok(!(Math.abs(P[p].x - P[q].x) < W && Math.abs(P[p].y - P[q].y) < HB), `overlap ${p}/${q}`);
    // Auto layout keeps the zones too
    await w.click('[data-wflay=auto]'); await H.sleep(250);
    assert.ok((await box(o)).x > await sepX(), 'Auto layout: Output in the Outputs zone');
    await w.click('[data-wflay=undo]'); await H.sleep(250);
    await checkOrder('after adding');
  });

  await step('9 · each card expands on its own; compact by default (name + description)', async () => {
    const card = id => w.evaluate(x => { const c = document.getElementById('wfc-' + x); return c && { open: c.classList.contains('open'), dp: !!c.querySelector('.wfdp'), spec: !!c.querySelector('.wfspec-c'), desc: c.querySelector('.wfc-desc') ? c.querySelector('.wfc-desc').textContent : null, btn: c.querySelector('.wfc-more').textContent }; }, id);
    const c0 = await card('co-in1');
    assert.ok(!c0.open && !c0.dp && !c0.spec && /Background drawings/.test(c0.desc) && c0.btn === 'Show details', 'compact: ' + JSON.stringify(c0));
    assert.strictEqual((await card('el-ac1')).desc, null, 'no space reserved when there is no description');
    await w.click('#wfc-co-in1 .wfc-more'); await H.sleep(150); await w.click('#wfc-me-in1 .wfc-more'); await H.sleep(150);
    const a = await card('co-in1'), b = await card('me-in1'), c = await card('el-ac1');
    assert.ok(a.open && b.open && !c.open, 'opening another does not close the first nor open others');
    assert.ok(a.dp && a.btn === 'Hide details', 'details show the configuration');
    await w.click('[data-act=wf-sspec][data-v=sv-coordination]'); await H.sleep(200); await w.click('[data-act=wf-sspec][data-v=_all]'); await H.sleep(200);
    assert.ok((await card('co-in1')).open && (await card('me-in1')).open, 'kept across renders');
    await w.click('#wfc-me-in1 .wfc-more'); await H.sleep(150);
    assert.ok(!(await card('me-in1')).open && (await card('co-in1')).open);
  });

  await step('8 · “Depends on” filters (search, Type, Service, Phase) never drop selections that are hidden', async () => {
    await w.click('#wfc-el-ac2 .wfc-more'); await H.sleep(150);
    const sel = () => w.evaluate(() => [...document.querySelectorAll('#wfdp-el-ac2 .wfdp-s')].map(x => x.textContent));
    const listed = () => w.evaluate(() => [...document.querySelectorAll('#wfdp-el-ac2 .wfdp-r input')].map(x => x.value));
    assert.strictEqual((await sel()).length, 2, 'selected zone shows both');
    await w.click('#wfdp-el-ac2 [data-wfdf=types][data-v=output]'); await H.sleep(150);
    assert.ok(!(await listed()).includes('el-ac1') && !(await listed()).includes('me-out1'), 'filtered out of the list');
    assert.strictEqual((await sel()).length, 2, 'still selected (shown apart)');
    assert.deepStrictEqual(rec(records(dbFile), 'workflowDraft').steps.find(s => s.id === 'el-ac2').deps.sort(), ['el-ac1', 'me-out1'], 'data unchanged');
    await w.click('#wfdp-el-ac2 [data-wfdf=svcs][data-v=sv-mechanical]'); await H.sleep(150);
    const both = await listed();
    assert.ok(both.every(id => ['me-out2'].includes(id)), 'Type AND Service: ' + both);
    await w.click('#wfdp-el-ac2 [data-wfdf=types][data-v=input]'); await H.sleep(150);
    assert.deepStrictEqual((await listed()).sort(), ['me-in1', 'me-out2'], 'options of one filter combine with OR');
    await w.fill('#wfdp-el-ac2 [data-wfdq]', 'zzz'); await H.sleep(150);
    assert.ok(/No activities match/.test(await w.textContent('#wfdp-el-ac2')) && /0 results/.test(await w.textContent('#wfdp-el-ac2')));
    await w.click('#wfdp-el-ac2 [data-wfdclr]'); await H.sleep(150);
    const all = await listed();
    assert.ok(all.includes('fee-co-out'), 'cleared: every phase listed');
    const why = await w.evaluate(() => { const i = document.querySelector('#wfdp-el-ac2 input[value="el-out1"]'); return i && i.disabled && i.closest('label').textContent; });
    assert.ok(why && /loop/.test(why), 'a loop is disabled with the reason: ' + why);
    const metaOk = await w.evaluate(() => /Output · Coordination · Fee/.test(document.querySelector('#wfdp-el-ac2 input[value="fee-co-out"]').closest('label').textContent));
    assert.ok(metaOk, 'each result shows type, specialty and phase');
    await w.click('#wfc-el-ac2 .wfc-more'); await w.click('#wfc-co-in1 .wfc-more'); await H.sleep(150);
  });

  await step('10 · guides align a block with another one; its specialty does not change', async () => {
    await drag('hy-out1', 140, 0);                                    // first away from the others…
    const h0 = await box('hy-out1'), hl = await lane('sv-hydraulics'), ha = await box('hy-ac1');
    const cand = [await box('el-out1'), await box('me-out2')].filter(p => p.x < h0.x - 40 && p.x >= ha.x + W + GAP), t = cand.sort((a, b) => b.x - a.x)[0];
    assert.ok(t, 'another Output within reach to align with');
    let guide = 0;
    await drag('hy-out1', t.x - h0.x + 4, 0, async () => { guide = await w.evaluate(() => document.querySelectorAll('.wfguides .wfg').length); });
    const h1 = await box('hy-out1'), hl1 = await lane('sv-hydraulics');
    assert.ok(guide > 0, 'a guide is shown while dragging');
    assert.strictEqual(h1.x, t.x, 'snapped to the same x as the other Output (4 px away when released)');
    assert.ok(h1.y >= hl1.y && h1.y + HB <= hl1.y + hl1.h, 'still in Hydraulics'); void hl;
    // several blocks: the first one selected is the fixed reference
    await w.click('[data-wflay=edit]');
    await w.click('#wfn-me-out2', { modifiers: ['Shift'] }); await w.click('#wfn-co-ac1', { modifiers: ['Shift'] }); await H.sleep(150);
    assert.ok(/reference/.test(await w.textContent('.wflay-bar')), 'reference identified: ' + await w.textContent('.wflay-bar') + ' | ' + await w.evaluate(() => [...document.querySelectorAll('.wfn.multi')].map(n => n.id).join(',')));
    const ref = await box('me-out2');
    await w.click('[data-wflay=align-x]'); await H.sleep(250);
    const c = await box('co-ac1');
    assert.ok(c.x === ref.x || /Not moved/.test(await w.textContent('#toasts')), 'aligned (or refused with the reason when a dependency forbids it)');
    assert.deepStrictEqual(await box('me-out2'), ref, 'the reference stays fixed');
    await w.click('[data-wflay=multi-clear]'); await w.click('[data-wflay=edit]'); await H.sleep(150);
    await checkOrder('after aligning');
  });

  let route0 = null;
  await step('11 · the start of the arrow from “Send architectural layouts and lighting brief…” moves to its top side', async () => {
    const k = 'fee-co-out>co-in1';
    await w.click('[data-wflay=edit]');
    await w.dispatchEvent(`path.wfe-hit[data-wfe="${k}"]`, 'pointerdown', { button: 0 });
    await H.until(() => w.evaluate(() => !!document.querySelector('.wfend[data-wfend=a]')), 3000, 'end handles');
    const s = await center('.wfend[data-wfend=a]'), b = await w.$('#wfn-fee-co-out'), bb = await b.boundingBox();
    await w.mouse.move(s.x, s.y); await w.mouse.down(); await w.mouse.move(bb.x + bb.width * 0.6, bb.y + 10, { steps: 6 });
    assert.ok(await w.evaluate(() => !!document.querySelector('.wfside')), 'the side is highlighted');
    await w.mouse.move(bb.x + bb.width * 0.6, bb.y + 1, { steps: 3 }); await w.mouse.up(); await H.sleep(250);
    const e = rec(records(dbFile), 'workflowDraft').layout['ph-sd'].e[k];
    assert.strictEqual(e.a.side, 't', 'anchored on the top side: ' + JSON.stringify(e));
    assert.ok(e.a.t > 0.4 && e.a.t < 0.8, 'relative position along the side');
    const d = await edgeD(k), first = d.slice(1).split(' L')[0].split(',').map(Number), p = await box('fee-co-out');
    assert.strictEqual(first[1], p.y, 'arrow starts on the top edge');
    assert.ok(rec(records(dbFile), 'workflowDraft').steps.find(x => x.id === 'co-in1').deps.includes('fee-co-out'), 'same dependency');
    // a segment of the new route, then cancel an end drag with Escape
    const hd = await w.$('.wfh'); if (hd) { const hb = await hd.boundingBox(); await w.mouse.move(hb.x + 5, hb.y + 5); await w.mouse.down(); await w.mouse.move(hb.x + 5, hb.y - 25, { steps: 4 }); await w.mouse.move(hb.x - 15, hb.y - 25, { steps: 4 }); await w.mouse.up(); await H.sleep(250); }
    const before = await edgeD(k), e2 = await center('.wfend[data-wfend=b]');
    await w.mouse.move(e2.x, e2.y); await w.mouse.down(); await w.mouse.move(e2.x + 40, e2.y + 30, { steps: 5 }); await w.keyboard.press('Escape'); await w.mouse.up(); await H.sleep(200);
    assert.strictEqual(await edgeD(k), before, 'Escape cancels an end drag (previous position kept)');
    route0 = before;
    await w.click('[data-wflay=edit]');
  });

  await step('12 · anchors and routes survive moving their blocks', async () => {
    const k = 'fee-co-out>co-in1';
    await drag('fee-co-out', -0, 60);
    const p = await box('fee-co-out'), d = await edgeD(k), first = d.slice(1).split(' L')[0].split(',').map(Number);
    assert.strictEqual(first[1], p.y, 'still starts on the top side after moving');
    assert.ok(Math.abs(first[0] - (p.x + 0.6 * W)) < 25, 'same relative point on the side');
    const e = rec(records(dbFile), 'workflowDraft').layout['ph-sd'].e[k];
    assert.strictEqual(e.a.side, 't'); assert.ok(Array.isArray(e.s), 'manual route kept');
    route0 = d;
  });

  await step('13/14 · Connect A → B adds the dependency to B; duplicates and loops are refused with a reason', async () => {
    await w.click('[data-wflay=conn]'); await H.sleep(150);
    assert.ok(/provides/.test(await w.textContent('.wflay-bar')), 'mode explains A → B');
    await w.click('#wfn-me-in1'); await H.sleep(150);
    assert.ok(/depends on it/.test(await w.textContent('.wflay-bar')));
    await w.click('#wfn-hy-ac1');
    await H.until(() => w.evaluate(() => /will <b>depend on<\/b>|will depend on/.test(document.getElementById('modal-root').innerHTML)), 3000, 'confirm');
    await w.click('#modal-root [data-act=cf-yes]'); await H.saved(w);
    const st = rec(records(dbFile), 'workflowDraft').steps.find(s => s.id === 'hy-ac1');
    assert.ok(st.deps.includes('me-in1'), 'Depends on of B updated');
    assert.ok(await edgeD('me-in1>hy-ac1'), 'arrow drawn');
    await w.click('#wfc-hy-ac1 .wfc-more'); await H.sleep(150);
    assert.ok(/Mechanical brief/.test(await w.textContent('#wfdp-hy-ac1 .wfdp-sel')), 'shown in “Depends on” of the card (same data)');
    await w.click('#wfc-hy-ac1 .wfc-more');
    // duplicate
    await w.click('[data-wflay=conn]'); await w.click('#wfn-me-in1'); await w.click('#wfn-hy-ac1'); await H.sleep(250);
    assert.ok(/already depends/.test(await w.textContent('#toasts')), 'duplicate refused');
    // loop
    await w.click('[data-wflay=conn]'); await w.click('#wfn-el-out1'); await w.click('#wfn-el-ac1'); await H.sleep(250);
    assert.ok(/loop/.test(await w.textContent('#toasts')), 'loop refused with an explanation');
    assert.ok(!rec(records(dbFile), 'workflowDraft').steps.find(s => s.id === 'el-ac1').deps.includes('el-out1'));
    // drag from the connection point of a block, then cancel the confirmation
    await w.click('[data-wflay=edit]');
    const n = await center('#wfn-co-in1'), t = await center('#wfn-me-ac2');
    await w.hover('#wfn-co-in1'); const dot = await center('#wfn-co-in1 .wfconn'); void n;
    await w.mouse.move(dot.x, dot.y); await w.mouse.down(); await w.mouse.move(t.x, t.y, { steps: 10 }); await w.mouse.up();
    await H.until(() => w.evaluate(() => /Add this dependency\?/.test(document.getElementById('modal-root').textContent)), 3000, 'confirm after drag');
    await w.click('#modal-root [data-act=cf-no]'); await H.sleep(200);
    assert.ok(!rec(records(dbFile), 'workflowDraft').steps.find(s => s.id === 'me-ac2').deps.includes('co-in1'), 'cancelled: nothing added');
    await w.click('[data-wflay=edit]');
  });

  await step('8 · “Add prerequisite…” from the diagram uses the same picker, including other phases', async () => {
    await w.click('#wfn-me-in1'); await H.sleep(200);
    await w.click('[data-wflay=prereq]');
    await H.until(() => w.evaluate(() => !!document.querySelector('#wfpre .wfdp')), 3000, 'dialog');
    await w.click('#wfpre [data-wfdf=phases][data-v=_all]'); await H.sleep(150);
    await w.check('#wfpre input[data-wfdep="me-in1"][value="fee-co-out"]'); await H.saved(w);
    assert.ok(rec(records(dbFile), 'workflowDraft').steps.find(s => s.id === 'me-in1').deps.includes('fee-co-out'));
    assert.ok(/Send architectural layouts/.test(await w.textContent('#wfpre .wfdp-sel')));
    await w.click('#modal-root [data-act=modal-close]');
    await checkOrder('after adding dependencies');
  });

  await step('1b · People still works after dragging, editing arrows and a press that never ended in the diagram', async () => {
    await openStd();
    // a press on a block whose release happened outside the window
    await w.evaluate(() => { const n = document.querySelector('.wfd .wfn'), r = n.getBoundingClientRect(); n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX: r.x + 10, clientY: r.y + 10, pointerId: 7 })); });
    await peopleWork('after');
  });

  await step('publish, then 16 · restarting keeps positions, anchors and routes', async () => {
    await openStd(); await w.click('[data-act=wf-save]'); await H.saved(w);
    const P0 = await allPos(), d0 = await edgeD('fee-co-out>co-in1'), s0 = await sepX();
    await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w); await openStd();
    const P1 = await allPos();
    for (const id of Object.keys(P0)) assert.deepStrictEqual(P1[id], P0[id], id + ' same place');
    assert.strictEqual(await edgeD('fee-co-out>co-in1'), d0, 'same route and anchor');
    assert.strictEqual(await sepX(), s0, 'same separator');
    assert.strictEqual(d0, route0, 'as left after editing');
    await H.shot(w, 'edit-final');
  });

  await step('project: “Edit in Company workflow” opens the activity in the standard', async () => {
    await go('p-px-nof'); await w.click('[role=tab][data-act=ptab][data-v=workflow]'); await H.sleep(200);
    await w.click('[data-act=wf-import]'); await H.until(() => w.evaluate(() => !!document.getElementById('wi-ok')), 4000, 'dialog');
    if (!(await w.isChecked('[data-wiph="ph-sd"]'))) await w.check('[data-wiph="ph-sd"]');
    for (let i = 0; i < 6; i++) { const c = await w.$('#modal-root input[data-wisp="ph-sd"]:not(:checked)'); if (!c) break; await c.click(); await H.sleep(120); }
    await w.click('#wi-ok'); await H.saved(w);
    await w.click('[data-act=wf-pphase][data-v=ph-sd]').catch(() => {}); await H.sleep(200);
    await w.click('#wfc-el-ac1 .wfc-more'); await H.sleep(150);
    await w.click('#wfc-el-ac1 [data-wfgoto]'); await H.sleep(400);
    assert.ok(/#settings/.test(await w.evaluate(() => location.hash)) && await w.evaluate(() => document.getElementById('wfc-el-ac1').classList.contains('open')), 'standard opened on that activity');
  });

  await step('17 · existing data keeps its information (projects, tasks, statuses, dates, hours, links, roles)', async () => {
    const rs = records(dbFile), d = FX.data, by = c => new Map(rs.filter(r => r.coll === c).map(r => [r.id, r.data]));
    const P = by('projects'), T = by('tasks'), D = by('deliverables'), A = by('assignments');
    assert.strictEqual(P.size, d.projects.length); assert.strictEqual(D.size, d.deliverables.length); assert.strictEqual(A.size, (d.assignments || []).length);
    for (const t of d.tasks) { const x = T.get(t.id); assert.ok(x, t.id); for (const f of ['projectId', 'status', 'due', 'start', 'assignedToId', 'deliverableId', 'phaseId']) assert.deepStrictEqual(x[f] ?? null, t[f] ?? null, `${t.id}.${f}`); }
    for (const [, x] of D) for (const r of x.reqTaskIds || []) assert.ok(T.has(r));
    assert.ok(rs.filter(r => r.coll === 'roles').length >= 7, 'roles catalogue');
    const steps = new Map(rec(rs, 'workflow').steps.map(s => [s.id, s]));
    for (const s of steps.values()) for (const dep of s.deps) assert.ok(steps.has(dep), 'dependency kept');
  });

  await step('no page errors', async () => { assert.deepStrictEqual(w.errors, []); });
  await app.close();
  if (require.main === module) return H.summary('workflow editing');
};

if (require.main === module) module.exports().then(f => process.exit(f ? 1 : 0));
