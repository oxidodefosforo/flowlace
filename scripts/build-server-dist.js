'use strict';
/* Builds the Flowlace Server package for Windows x64:
     out/server/FlowlaceServer-<version>-win-x64/      ready-to-copy folder
     out/server/FlowlaceServer-<version>-win-x64.zip
   Contents: node\node.exe (pinned, checksum verified), app\server + app\shared, WinSW service wrapper,
   PowerShell install/control scripts, command-line wrapper and the guides.

   Binaries are taken from FLOWLACE_WIN_CACHE (default .cache/win) or downloaded:
     node.exe    npm package node-win-x64@24.21.0  (or FLOWLACE_NODE_EXE=<official node.exe>)
     WinSW-x64   https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERSION = require(path.join(ROOT, 'server', 'package.json')).version;
const NODE_VERSION = '24.21.0';
const PINS = {
  node: 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32',
  winsw: '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da'
};
const CACHE = process.env.FLOWLACE_WIN_CACHE || path.join(ROOT, '.cache', 'win');
const OUT = path.join(ROOT, 'out', 'server');
const NAME = `FlowlaceServer-${VERSION}-win-x64`;
const DIST = path.join(OUT, NAME);

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function copyDir(src, dst, filter = () => true) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (!filter(s, e)) continue;
    if (e.isDirectory()) copyDir(s, d, filter); else fs.copyFileSync(s, d);
  }
}

function nodeExe() {
  if (process.env.FLOWLACE_NODE_EXE) return { file: process.env.FLOWLACE_NODE_EXE, pinned: false };
  const f = path.join(CACHE, 'package', 'bin', 'node.exe');
  if (!fs.existsSync(f)) {
    fs.mkdirSync(CACHE, { recursive: true });
    execFileSync('npm', ['pack', `node-win-x64@${NODE_VERSION}`], { cwd: CACHE, stdio: 'inherit', shell: process.platform === 'win32' });
    execFileSync('tar', ['xzf', `node-win-x64-${NODE_VERSION}.tgz`], { cwd: CACHE, stdio: 'inherit' });
  }
  return { file: f, pinned: true };
}
function winsw() {
  const f = path.join(CACHE, 'WinSW-x64.exe');
  if (!fs.existsSync(f)) {
    fs.mkdirSync(CACHE, { recursive: true });
    execFileSync('curl', ['-sSL', '--fail', '-o', f, 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'], { stdio: 'inherit' });
  }
  return f;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const ne = nodeExe();
if (ne.pinned && sha(ne.file) !== PINS.node) throw new Error('node.exe checksum mismatch: ' + ne.file);
fs.mkdirSync(path.join(DIST, 'node'));
fs.copyFileSync(ne.file, path.join(DIST, 'node', 'node.exe'));
const ws = winsw();
if (sha(ws) !== PINS.winsw) throw new Error('WinSW checksum mismatch: ' + ws);
fs.copyFileSync(ws, path.join(DIST, 'FlowlaceServer.exe'));

const noTests = s => !/[\\/](test|tests|node_modules)([\\/]|$)/.test(s);
copyDir(path.join(ROOT, 'server', 'src'), path.join(DIST, 'app', 'server', 'src'), noTests);
fs.copyFileSync(path.join(ROOT, 'server', 'package.json'), path.join(DIST, 'app', 'server', 'package.json'));
copyDir(path.join(ROOT, 'shared'), path.join(DIST, 'app', 'shared'), noTests);
for (const f of fs.readdirSync(path.join(ROOT, 'server', 'windows'))) {
  const src = path.join(ROOT, 'server', 'windows', f);
  let txt = fs.readFileSync(src);
  // Windows line endings for scripts and text files read by people on Windows
  if (/\.(ps1|txt|xml|cmd)$/i.test(f)) txt = Buffer.from(txt.toString('utf8').replace(/\r?\n/g, '\r\n'), 'utf8');
  // PowerShell 5.1 reads UTF-8 scripts correctly only with a BOM
  if (/\.ps1$/i.test(f) && !(txt[0] === 0xEF && txt[1] === 0xBB)) txt = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), txt]);
  fs.writeFileSync(path.join(DIST, f), txt);
}
fs.mkdirSync(path.join(DIST, 'docs'));
for (const f of ['SERVIDOR.md', 'GUIA.md']) {
  const src = path.join(ROOT, 'docs', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, 'docs', f));
}

const zip = path.join(OUT, NAME + '.zip');
fs.rmSync(zip, { force: true });
if (process.platform === 'win32') execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${NAME}' -DestinationPath '${zip}' -Force`], { cwd: OUT, stdio: 'inherit' });
else execFileSync('zip', ['-qr', zip, NAME], { cwd: OUT, stdio: 'inherit' });
console.log(`Flowlace Server ${VERSION} → ${path.relative(ROOT, zip)} (${Math.round(fs.statSync(zip).size / 1048576)} MB)`);
