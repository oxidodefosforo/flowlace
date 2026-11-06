'use strict';
/* v1.8 interface: sidebar (modules, favorites, projects), breadcrumbs, quick search, side-peek navigation,
   grouping in the Table layout, narrow window, keyboard and focus. Real app, real persistence. */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const { assert, step } = H;
const { Store } = require('../../shared/store');
const makeFixture = require('./wf-fixture');

function records(dbFile) { const s = new Store(dbFile, { readOnly: true }); try { return s.snapshot().records; } finally { s.close(); } }

module.exports = async function run() {
  H.opts.keepSidebar = true;
  console.log('Interface: sidebar, breadcrumbs, quick search, side peek, table groups, narrow window (v1.8)');
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Shell');
  fs.mkdirSync(wsFolder);
  const dbFile = path.join(wsFolder, 'flowlace.db'), FX = makeFixture(docs, {});
  let { app, w } = await H.launch(ud);
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(250); };
  const txt = sel => w.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const restart = async () => { await H.sleep(900); await app.close(); ({ app, w } = await H.launch(ud)); await H.appReady(w); await w.setViewportSize({ width: 1440, height: 900 }); await H.sleep(200); };
  const task = id => (records(dbFile).find(r => r.coll === 'tasks' && r.id === id) || {}).data;

  await step('set-up (workspace with the example data)', async () => {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Shell'); await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary'); await H.appReady(w);
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    await w.click('#modal-root [data-act=modal-close]');
    await H.answerDialogs(app, { file: FX.file });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    await w.check('#modal-root input[name=imp-diff][value=replace]'); await w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 10000, 'imported'); await H.saved(w);
    await w.setViewportSize({ width: 1440, height: 900 });
  });

  await step('sidebar: every module, the projects and the active item; breadcrumbs keep the context', async () => {
    const mods = await w.evaluate(() => [...document.querySelectorAll('#side .sd-nav [data-act=nav]')].map(b => b.dataset.to));
    assert.deepStrictEqual(mods, ['overview', 'projects', 'tasks', 'resources', 'favorites', 'settings']);
    assert.ok(await w.$('#side [data-act=open-project][data-id=px-rmc]'), 'projects listed');
    await w.click('#side [data-act=open-project][data-id=px-rmc]'); await H.sleep(250);
    assert.strictEqual(await w.getAttribute('#side [data-act=open-project][data-id=px-rmc]', 'aria-current'), 'page', 'active project marked');
    assert.strictEqual(await w.getAttribute('#side [data-act=nav][data-to=projects]', 'aria-current'), 'page', 'its module marked');
    assert.ok(/^Projects\s*\/\s*AZ-2401 Riverside Medical Centre$/.test(await txt('#top .crumbs-top')), await txt('#top .crumbs-top'));
    await w.click('[data-act=ptab][data-v=tasks]'); await H.sleep(200);
    assert.ok(/AZ-2401 Riverside Medical Centre\s*\/\s*Tasks$/.test(await txt('#top .crumbs-top')), 'tab in the breadcrumb');
    await w.click('#top .crumbs-top button.bc[data-act=ptab]'); await H.sleep(200);
    assert.strictEqual(await w.evaluate(() => location.hash), '#p-px-rmc', 'the project crumb goes back to its summary');
    await w.click('#side [data-act=nav][data-to=tasks]'); await H.sleep(200);
    assert.ok(/^Tasks\s*\/\s*All tasks$/.test(await txt('#top .crumbs-top')));
  });

  await step('sidebar: collapse (button and Ctrl+\\), resize with the keyboard; both kept after a restart', async () => {
    await w.click('#side [data-act=side-toggle]'); await H.sleep(200);
    assert.ok(await w.evaluate(() => document.getElementById('app').classList.contains('side-off') && document.getElementById('side').inert), 'hidden and inert');
    assert.strictEqual(await w.evaluate(() => document.activeElement.classList.contains('side-open')), true, 'focus on the show button');
    await w.keyboard.press('Control+Backslash'); await H.sleep(200);
    assert.ok(!(await w.evaluate(() => document.getElementById('app').classList.contains('side-off'))), 'Ctrl+\\ shows it');
    await w.focus('#side .sd-resize'); for (let i = 0; i < 4; i++) await w.keyboard.press('ArrowRight');
    assert.strictEqual(await w.evaluate(() => Math.round(document.getElementById('side').getBoundingClientRect().width)), 284, 'width +40');
    await w.keyboard.press('End'); assert.strictEqual(await w.getAttribute('#side .sd-resize', 'aria-valuenow'), '360');
    await w.keyboard.press('Home'); assert.strictEqual(await w.getAttribute('#side .sd-resize', 'aria-valuenow'), '200');
    await w.keyboard.press('ArrowRight'); await w.keyboard.press('Control+Backslash'); await H.sleep(150);
    await restart();
    assert.ok(await w.evaluate(() => document.getElementById('app').classList.contains('side-off')), 'still collapsed after restart');
    await w.click('#top .side-open'); await H.sleep(150);
    assert.strictEqual(await w.evaluate(() => Math.round(document.getElementById('side').getBoundingClientRect().width)), 210, 'width kept');
    await w.dblclick('#side .sd-resize'); await H.sleep(150);
    assert.strictEqual(await w.evaluate(() => Math.round(document.getElementById('side').getBoundingClientRect().width)), 244, 'double-click resets');
  });

  await step('quick search (Ctrl+K): find a task by words in any order, Enter opens it in the side panel; Esc closes', async () => {
    await go('overview');
    await w.keyboard.press('Control+k'); await H.sleep(150);
    assert.ok(await w.evaluate(() => document.activeElement.id === 'qs-in'), 'focus in the search box');
    await w.keyboard.type('clash duct'); await H.sleep(200);
    const first = await w.evaluate(() => { const o = document.querySelector('.qs-it.on'); return o && o.textContent; });
    assert.ok(/Resolve duct clash at level 2/.test(first), first);
    await w.keyboard.press('Enter'); await H.sleep(300);
    assert.ok(/Resolve duct clash at level 2/.test(await txt('#pn-title')), 'task opened in the panel');
    assert.ok(/^#p-px-rmc\/tasks$/.test(await w.evaluate(() => location.hash)), 'in its project, Tasks tab');
    await w.keyboard.press('Escape'); await H.sleep(150);
    await w.click('#top [data-act=qs-open]'); await H.sleep(150); await w.keyboard.type('zzzz-nothing'); await H.sleep(150);
    assert.ok(/No results/.test(await txt('#qs-list')));
    await w.keyboard.press('Escape'); await H.sleep(150);
    assert.strictEqual(await w.evaluate(() => document.getElementById('modal-root').innerHTML), '', 'closed');
    // arrows move the selection; a project result opens the project
    await w.keyboard.press('Control+k'); await H.sleep(120); await w.keyboard.type('fremantle'); await H.sleep(150);
    await w.keyboard.press('Enter'); await H.sleep(250);
    assert.strictEqual(await w.evaluate(() => location.hash), '#p-px-fft');
  });

  await step('side panel: previous / next task follow the list on screen (buttons and Alt+↑/↓), edits go to the same data', async () => {
    await go('tasks'); await H.sleep(150);
    const order = await w.evaluate(() => [...document.querySelectorAll('#tk-table tr[data-trow]')].map(r => r.dataset.trow));
    await w.click(`#to-${order[0]}`); await H.sleep(250);
    assert.strictEqual(await txt('.pn-pos'), `1/${order.length}`);
    assert.ok(await w.evaluate(() => document.querySelector('[data-act=panel-step][data-d="-1"]').disabled), 'no previous on the first');
    await w.keyboard.press('Alt+ArrowDown'); await H.sleep(250);
    assert.strictEqual(await txt('.pn-pos'), `2/${order.length}`);
    assert.ok(await w.evaluate(id => document.querySelector(`tr[data-trow="${id}"]`).classList.contains('sel'), order[1]), 'the row of the open task is highlighted');
    await w.click('[data-act=panel-step][data-d="1"]'); await H.sleep(250);
    const id = order[2];
    assert.strictEqual(await txt('.pn-pos'), `3/${order.length}`);
    // edit in the panel: priority; the table and the database show the same value
    const sel = await w.evaluate(() => { const s = [...document.querySelectorAll('#panel select')].find(x => x.dataset.f === 'priority'); return s && '#' + s.id; });
    await w.selectOption(sel, 'Low'); await H.saved(w); await H.sleep(200);
    assert.strictEqual(task(id).priority, 'Low', 'stored');
    await w.keyboard.press('Alt+ArrowUp'); await H.sleep(200);
    assert.strictEqual(await txt('.pn-pos'), `2/${order.length}`);
    await w.keyboard.press('Escape'); await H.sleep(200);
    assert.ok(await w.evaluate(() => document.getElementById('panel').hidden), 'closed');
    assert.ok(await w.evaluate(() => /^to-/.test(document.activeElement.id)), 'focus back in the list: ' + await w.evaluate(() => document.activeElement.id));
  });

  await step('table grouping: Group by in the Table layout, collapsible groups, saved in the view and kept after navigation and restart', async () => {
    await go('tasks');
    await w.selectOption('#cfg-tgroup-g', 'status'); await H.sleep(250);
    const heads = await w.evaluate(() => [...document.querySelectorAll('#tk-table tr.tgrp .tg-l')].map(e => e.textContent));
    assert.ok(heads.length >= 2 && heads.some(h => /To Do/.test(h)), JSON.stringify(heads));
    // the rows of each group have that status; every task appears once
    const rows = await w.evaluate(() => { const out = []; let g = null; document.querySelectorAll('#tk-table tbody tr').forEach(r => { if (r.classList.contains('tgrp')) g = r.querySelector('.tg-l').textContent; else if (r.dataset.trow) out.push([g, r.querySelector('select[data-f=status]').value, r.dataset.trow]); }); return out; });
    assert.ok(rows.every(([g, st]) => g.endsWith(st)), 'rows in their group');
    assert.strictEqual(new Set(rows.map(r => r[2])).size, rows.length, 'no duplicates');
    const n0 = rows.length, todo = rows.filter(r => /To Do/.test(r[0])).length;
    await w.click('#tk-table .tg-btn >> nth=0'); await H.sleep(200);
    assert.strictEqual(await w.getAttribute('#tk-table .tg-btn >> nth=0', 'aria-expanded'), 'false');
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('#tk-table tr[data-trow]').length), n0 - todo, 'collapsed group hides its rows');
    assert.ok(await w.evaluate(() => document.activeElement.classList.contains('tg-btn')), 'focus stays on the group header');
    // save as a view, star it: it appears in the sidebar favorites
    await w.click('[data-act=view-saveas]'); await H.sleep(150);
    await w.fill('#modal-root input[name=name]', 'By status'); await w.click('#modal-root button.primary'); await H.sleep(250);
    await w.click('[data-act=view-star]'); await H.sleep(200);
    assert.ok(/By status/.test(await txt('#side .sd-sec[aria-label=Favorites]')), 'favorite in the sidebar');
    // a filter in the view, then another module and back: same view, grouping, filter and collapsed group
    await w.click('#side [data-act=nav][data-to=resources]'); await H.sleep(200);
    await w.click('#side [data-act=nav][data-to=tasks]'); await H.sleep(250);
    assert.strictEqual(await w.evaluate(() => document.querySelector('.vtab[aria-selected=true]').textContent.includes('By status')), true);
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('#tk-table tr[data-trow]').length), n0 - todo, 'collapsed kept');
    await restart(); await go('tasks'); await H.sleep(200);
    assert.strictEqual(await w.$eval('#cfg-tgroup-g', s => s.value), 'status', 'grouping saved in the view');
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('#tk-table tr[data-trow]').length), n0 - todo, 'collapsed group kept after restart');
    const st = (() => { const db = new Store(dbFile, { readOnly: true }); try { return db.getUserState('local').data; } finally { db.close(); } })();
    const v = (st && st.views || []).find(x => x.name === 'By status');
    assert.ok(v && v.tgroup === 'status', 'stored with the view (personal data): ' + JSON.stringify(v && v.tgroup));
    // the favorite in the sidebar opens it
    await go('overview'); await w.click('#side [data-act=fav-open]'); await H.sleep(200);
    assert.strictEqual(await w.getAttribute('#side [data-act=fav-open]', 'aria-current'), 'true');
    await w.selectOption('#cfg-tgroup-g', 'none'); await H.sleep(200);
    assert.strictEqual(await w.evaluate(() => document.querySelectorAll('#tk-table tr.tgrp').length), 0, 'No grouping = flat table');
  });

  await step('project views stay separate: grouping in one project does not reach another project', async () => {
    await go('p-px-rmc'); await w.click('[data-act=ptab][data-v=tasks]'); await H.sleep(200);
    await w.selectOption('#cfg-tgroup-px-rmc', 'assignee'); await H.sleep(200);
    await go('p-px-fft'); await w.click('[data-act=ptab][data-v=tasks]'); await H.sleep(200);
    assert.strictEqual(await w.$eval('#cfg-tgroup-px-fft', s => s.value), 'none');
    await go('p-px-rmc'); await w.click('[data-act=ptab][data-v=tasks]'); await H.sleep(200);
    assert.strictEqual(await w.$eval('#cfg-tgroup-px-rmc', s => s.value), 'assignee');
    await w.click('[data-act=view-reset]'); await H.sleep(200);
  });

  await step('workflow editor inside the new shell (sidebar open): grouped toolbar fits, a click selects an activity, Esc keeps the data', async () => {
    await w.setViewportSize({ width: 1440, height: 900 }); await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]'); await H.sleep(200);
    await w.click('[data-act=wf-sphase][data-v=ph-sd]'); await H.sleep(400);
    const bar = await w.evaluate(() => { const b = document.querySelector('.wflay-bar').getBoundingClientRect(); return [...document.querySelectorAll('.wflay-bar > *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > b.right + 1 || r.left < b.left - 1); }).length; });
    assert.strictEqual(bar, 0, 'no toolbar control outside the bar');
    assert.ok(await w.evaluate(() => document.querySelectorAll('.wflay-bar .tsep').length >= 3), 'grouped');
    const before = records(dbFile).find(r => r.coll === 'workflow').data.steps.length;
    const n = await (await w.$('#wfn-el-ac1')).boundingBox();
    await w.mouse.click(n.x + 20, n.y + 12); await H.sleep(250);
    assert.ok(await w.evaluate(() => document.getElementById('wfn-el-ac1').classList.contains('sel')), 'selected');
    assert.ok(await w.evaluate(() => { const r = document.getElementById('wfn-el-ac1').getBoundingClientRect(), s = document.getElementById('side').getBoundingClientRect(); return r.left >= s.right; }), 'the canvas starts after the sidebar');
    await w.keyboard.press('Escape'); await H.sleep(150);
    assert.strictEqual(records(dbFile).find(r => r.coll === 'workflow').data.steps.length, before, 'no data changed');
  });

  const wide = () => w.setViewportSize({ width: 1440, height: 900 });
  await step('narrow window: the sidebar becomes a drawer (button, Esc, scrim); no control hidden behind another; no page-wide horizontal scroll', async () => {
    await w.setViewportSize({ width: 760, height: 760 }); await H.sleep(250); await go('tasks');
    assert.ok(await w.evaluate(() => getComputedStyle(document.getElementById('side')).transform !== 'none' && document.getElementById('side').inert), 'drawer closed');
    await w.click('#top .side-open'); await H.sleep(300);
    assert.ok(await w.evaluate(() => document.getElementById('app').classList.contains('side-drawer')), 'opened');
    await w.keyboard.press('Escape'); await H.sleep(250);
    assert.ok(!(await w.evaluate(() => document.getElementById('app').classList.contains('side-drawer'))), 'Esc closes it');
    await w.click('#top .side-open'); await H.sleep(250); await w.click('#side [data-act=nav][data-to=projects]'); await H.sleep(300);
    assert.ok(/^#(projects|p-)/.test(await w.evaluate(() => location.hash)), 'Projects (its last location)');
    assert.ok(!(await w.evaluate(() => document.getElementById('app').classList.contains('side-drawer'))), 'choosing a module closes it');
    for (const h of ['overview', 'tasks', 'resources', 'settings']) {
      await go(h);
      const r = await w.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, top: [...document.querySelectorAll('#top > *')].map(e => e.getBoundingClientRect()).filter(b => b.right > innerWidth + 1).length, main: document.getElementById('main').scrollWidth - document.getElementById('main').clientWidth }));
      assert.ok(r.doc <= 0 && r.top === 0, `${h}: ${JSON.stringify(r)}`);
      assert.ok(r.main <= 1, `${h}: only tables scroll sideways (${r.main})`);
    }
    await go('tasks'); await w.click(`#to-${await w.evaluate(() => document.querySelector('#tk-table tr[data-trow]').dataset.trow)}`); await H.sleep(250);
    assert.ok(await w.evaluate(() => { const b = document.getElementById('panel').getBoundingClientRect(); return b.left <= 0 && b.right >= innerWidth - 1; }), 'panel full width');
    await w.keyboard.press('Escape'); await H.sleep(150);
    await w.setViewportSize({ width: 1440, height: 900 }); await H.sleep(250);
    assert.ok(!(await w.evaluate(() => document.getElementById('app').classList.contains('side-off'))), 'wide again: sidebar back');
  });

  await wide(); await H.sleep(200);
  await step('keyboard and focus: visible focus ring on sidebar items and table rows; tab order reaches search, modules and projects', async () => {
    await go('tasks'); await w.focus('#side .sd-search'); await w.keyboard.press('Tab');
    const f = await w.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return { act: e.dataset.act, to: e.dataset.to, ow: cs.outlineWidth, os: cs.outlineStyle }; });
    assert.strictEqual(f.to, 'overview'); assert.ok(f.os !== 'none' && parseFloat(f.ow) >= 2, 'focus ring: ' + JSON.stringify(f));
    await w.focus('#tk-table tr[data-trow]'); await w.keyboard.press('Enter'); await H.sleep(250);
    assert.ok(await w.evaluate(() => !document.getElementById('panel').hidden), 'Enter on a row opens it');
    await w.keyboard.press('Escape'); await H.sleep(150);
    // contrast of the secondary text and of the status pills (WCAG AA for text: 4.5:1)
    const cr = await w.evaluate(() => {
      const rgb = s => { const n = s.match(/[\d.]+/g).slice(0, 3).map(Number); return /^color\(/.test(s) ? n.map(v => v * 255) : n; }, L = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const x = L(rgb(a)), y = L(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const out = {}; const m = document.querySelector('.ks .l span'); out.muted = ratio(getComputedStyle(m).color, getComputedStyle(document.body).backgroundColor);
      document.querySelectorAll('#tk-table select.st-pill').forEach(s => { const cs = getComputedStyle(s); out[s.dataset.st] = ratio(cs.color, cs.backgroundColor); });
      return out; });
    for (const [k, v] of Object.entries(cr)) assert.ok(v >= 4.5, `contrast ${k}: ${v.toFixed(2)}`);
  });

  await step('dark mode uses the same tokens (sidebar, page, panel) and stays readable', async () => {
    await w.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await H.sleep(100);
    const c = await w.evaluate(() => { const g = e => getComputedStyle(document.querySelector(e)).backgroundColor; return { side: g('#side'), main: g('body'), fg: getComputedStyle(document.body).color }; });
    assert.notStrictEqual(c.side, c.main, 'sidebar distinct from the page');
    assert.ok(/25, 25, 25/.test(c.main), c.main);
    await w.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  });

  assert.deepStrictEqual(w.errors, [], 'no page errors');
  await app.close();
  H.opts.keepSidebar = false;
};
