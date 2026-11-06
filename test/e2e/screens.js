'use strict';
/* Screenshots of the main screens (not a test): node test/e2e/screens.js <prefix>
   Uses the workflow fixture so every module has data. Writes to FLOWLACE_SHOTS. */
const path = require('path');
const fs = require('fs');
const H = require('./helpers');
const makeFixture = require('./wf-fixture');
H.opts.keepSidebar = true;

(async () => {
  const pre = process.argv[2] || 'screen';
  const ud = H.tmp('ms-ud-'), docs = H.tmp('ms-docs-'), wsFolder = path.join(docs, 'Screens');
  fs.mkdirSync(wsFolder);
  const FX = makeFixture(docs, { fine: true, types: true, phases: true });
  const { app, w } = await H.launch(ud);
  const go = async h => { await w.evaluate(x => { location.hash = x; }, h); await H.sleep(400); };
  try {
    await H.answerDialogs(app, { folder: wsFolder });
    await w.click('[data-sact=create]'); await w.fill('#ms-start input[name=name]', 'Screens'); await w.click('[data-sact=pick-create]');
    await H.until(() => w.evaluate(() => /will be created in/.test(document.getElementById('ms-start').textContent)), 5000, 'target');
    await w.click('#ms-start form[data-sform=create] button.primary'); await H.appReady(w);
    await H.until(() => w.evaluate(() => /Your workspace is ready/.test(document.getElementById('modal-root').textContent)), 5000, 'welcome');
    await w.click('#modal-root [data-act=modal-close]');
    await H.answerDialogs(app, { file: FX.file });
    await go('settings'); await w.click('[data-act=stab][data-v=data]'); await w.click('[data-dact=import-json]');
    await H.until(() => w.evaluate(() => /Import this file\?/.test(document.getElementById('modal-root').textContent)), 5000, 'summary');
    await w.check('#modal-root input[name=imp-diff][value=replace]'); await w.click('#modal-root [data-act=cf-choice][data-v=go]');
    await H.until(() => w.evaluate(() => /Imported:/.test(document.getElementById('toasts').textContent)), 10000, 'imported'); await H.saved(w);
    const sizes = [['desk', 1440, 900], ['narrow', 800, 820]];
    for (const [tag, width, height] of sizes) {
      await w.setViewportSize({ width, height }); await H.sleep(300);
      const s = n => H.shot(w, `${pre}-${tag}-${n}`);
      await go('overview'); await s('01-overview');
      await go('projects'); await s('02-projects');
      await go('p-px-rmc'); await s('03-project');
      await w.click('[data-act=ptab][data-v=tasks]').catch(() => {}); await H.sleep(300); await s('04-project-tasks');
      await go('tasks'); await s('05-tasks');
      const row = await w.$('#main [data-act=panel-task]');
      if (row) { await row.click(); await H.sleep(400); await s('06-task-panel'); await w.keyboard.press('Escape'); await H.sleep(200); }
      await go('resources'); await s('07-resources');
      await go('p-px-nof'); await w.click('[data-act=ptab][data-v=workflow]').catch(() => {}); await H.sleep(500); await s('08-project-workflow');
      await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]').catch(() => {}); await H.sleep(300);
      await w.click('[data-act=wf-sphase][data-v=ph-sd]').catch(() => {}); await H.sleep(500); await s('09-workflow-editor');
      await go('tasks'); await w.evaluate(() => { const b = document.querySelector('[data-act=cfg-layout][data-v=calendar]'); if (b) b.click(); }); await H.sleep(400); await s('10-calendar');
      await w.evaluate(() => { const b = document.querySelector('[data-act=cfg-layout][data-v=table]'); if (b) b.click(); }); await H.sleep(200);
    }
    // extras (after the redesign only): drawer, quick search, grouped table, dark mode
    if (await w.$('#side')) {
      await w.setViewportSize({ width: 800, height: 820 }); await go('tasks');
      await w.click('#top .side-open').catch(() => {}); await H.sleep(350); await H.shot(w, `${pre}-narrow-11-drawer`);
      await w.keyboard.press('Escape'); await w.click('.side-scrim').catch(() => {}); await H.sleep(200);
      await w.setViewportSize({ width: 1440, height: 900 }); await go('tasks');
      await w.keyboard.press('Control+k'); await H.sleep(200); await w.keyboard.type('riv'); await H.sleep(250); await H.shot(w, `${pre}-desk-12-search`);
      await w.keyboard.press('Escape'); await H.sleep(150);
      await w.selectOption('#cfg-tgroup-g', 'status').catch(() => {}); await H.sleep(300); await H.shot(w, `${pre}-desk-13-grouped`);
      await w.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await H.sleep(200); await H.shot(w, `${pre}-desk-14-dark-tasks`);
      await go('settings'); await w.click('[role=tab][data-act=stab][data-v=workflow]').catch(() => {}); await H.sleep(500); await H.shot(w, `${pre}-desk-15-dark-workflow`);
      await w.evaluate(() => document.documentElement.removeAttribute('data-theme'));
      await go('tasks'); await w.selectOption('#cfg-tgroup-g', 'none').catch(() => {});
    }
    if (w.errors.length) console.log('page errors:', w.errors);
  } catch (e) { console.log(e); await H.shot(w, pre + '-ERROR'); }
  await app.close();
})();
