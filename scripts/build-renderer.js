'use strict';
/* Builds the interface into src/renderer/dist (what the app loads):
     index.html  — page skeleton (no inline script; strict Content-Security-Policy)
     app.css     — src/renderer/styles/*.css
     shared.js   — shared/canonical.js + shared/schema.js (same rules as the server)
     app.js      — src/renderer/app/*.js (the Flowlace UI) + src/renderer/desktop/*.js, inside one function scope
     fonts/      — bundled fonts (no network)
   app/*-boot.js is the web version's start-up (browser storage); the desktop start-up in desktop/d09-boot.js replaces it.
   Run: node scripts/build-renderer.js  (also run automatically before packaging). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = path.join(ROOT, 'src', 'renderer');
const OUT = path.join(R, 'dist');
const pkg = require(path.join(ROOT, 'package.json'));
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";

const list = (dir, ext, skip) => fs.readdirSync(dir).filter(f => f.endsWith(ext) && !(skip && skip.test(f))).sort();
const read = f => fs.readFileSync(f, 'utf8');

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

  const css = list(path.join(R, 'styles'), '.css').map(f => `/* ${f} */\n` + read(path.join(R, 'styles', f))).join('\n');
  fs.writeFileSync(path.join(OUT, 'app.css'), css);

  const shared = ['canonical.js', 'schema.js'].map(f => read(path.join(ROOT, 'shared', f))).join('\n');
  fs.writeFileSync(path.join(OUT, 'shared.js'), shared);

  const appFiles = list(path.join(R, 'app'), '.js', /-boot\.js$/);
  const deskFiles = list(path.join(R, 'desktop'), '.js');
  const js = "(function(){\n'use strict';\n" +
    appFiles.map(f => `/* ===== app/${f} ===== */\n` + read(path.join(R, 'app', f))).join('\n') +
    deskFiles.map(f => `/* ===== desktop/${f} ===== */\n` + read(path.join(R, 'desktop', f))).join('\n') +
    '\n})();\n';
  try { new vm.Script(js, { filename: 'app.js' }); }            // syntax check (also catches duplicate declarations)
  catch (e) { console.error('app.js does not compile:\n' + (e.stack || e.message)); process.exit(1); }
  fs.writeFileSync(path.join(OUT, 'app.js'), js);

  for (const f of fs.readdirSync(path.join(R, 'fonts'))) fs.copyFileSync(path.join(R, 'fonts', f), path.join(OUT, 'fonts', f));

  const body = read(path.join(R, 'body.html'));
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP.replace(" frame-ancestors 'none';", '')}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Flowlace</title>
<link rel="stylesheet" href="fonts/fonts.css">
<link rel="stylesheet" href="app.css">
</head>
<body data-version="${pkg.version}">
${body}<script src="shared.js"></script>
<script src="app.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`renderer built: ${appFiles.length} UI modules + ${deskFiles.length} desktop modules, ${Math.round(js.length / 1024)} KB → ${path.relative(ROOT, OUT)}`);
}

build();
module.exports = { build };
