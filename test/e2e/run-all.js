'use strict';
/* Runs every end-to-end scenario with the real Electron app (on Linux: xvfb-run -a node test/e2e/run-all.js).
   The pass/fail counters are shared, so the last line is the total. */
const H = require('./helpers');
(async () => {
  for (const s of ['local', 'features', 'company']) { await require('./' + s)(); console.log(''); }
  process.exit(H.summary('ALL SCENARIOS') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
