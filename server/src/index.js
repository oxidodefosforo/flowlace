#!/usr/bin/env node
'use strict';
/* Flowlace Server — command line.
     flowlace-server init --data D:\FlowlaceData [--port 8443] [--admin admin] [--workspace "Alphazeta"] [--allow-http]
     flowlace-server serve                         (what the Windows service runs)
     flowlace-server create-user --username laura --name "Laura Chen" [--role admin|member]
     flowlace-server reset-password --username laura
     flowlace-server list-users | list-workspaces | create-workspace --name "…" | check
   Options valid everywhere: --config <file>  (default %ProgramData%\Flowlace Server\flowlace-server.json)
   Passwords are asked for interactively, or read from --password-file / FLOWLACE_PASSWORD for scripted installs. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { loadConfig, defaultConfigPath } = require('./config');
const { Accounts, passwordProblem } = require('./accounts');
const { Hub } = require('./hub');
const { makeHandler } = require('./http');

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) o[k] = true; else { o[k] = nx; i++; } }
    else o._.push(a);
  }
  return o;
}
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = msg => console.log(`[${stamp()}] ${msg}`);

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) { let buf = ''; stdin.setEncoding('utf8'); stdin.on('data', d => { buf += d; }); stdin.on('end', () => resolve(buf.split(/\r?\n/)[0])); return; }
    process.stdout.write(question);
    let pw = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onData = ch => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); resolve(pw); }
      else if (ch === '\u0003') { stdin.setRawMode(false); reject(new Error('Cancelled.')); }
      else if (ch === '\u0008' || ch === '\u007f') pw = pw.slice(0, -1);
      else pw += ch;
    };
    stdin.on('data', onData);
  });
}
async function newPassword(o, who) {
  if (o['password-file']) return fs.readFileSync(o['password-file'], 'utf8').trim();
  if (process.env.FLOWLACE_PASSWORD) return process.env.FLOWLACE_PASSWORD;
  for (;;) {
    const a = await askHidden(`Password for ${who} (min. 10 characters): `);
    const pp = passwordProblem(a); if (pp) { console.log(pp); continue; }
    const b = await askHidden('Repeat the password: ');
    if (a !== b) { console.log('The passwords are different. Try again.'); continue; }
    return a;
  }
}

function openAccounts(cfg) {
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  return new Accounts(path.join(cfg.dataDir, 'server.db'));
}

async function main() {
  const o = args(process.argv.slice(2));
  const cmd = o._[0] || 'help';
  const cfgFile = o.config || defaultConfigPath();

  if (cmd === 'init') {
    if (!o.data) throw new Error('Use --data <folder on a local disk of this server> to choose where Flowlace Server stores its databases.');
    let cfg;
    if (fs.existsSync(cfgFile)) { console.log(`Using the existing configuration ${cfgFile}`); }
    else {
      const c = { dataDir: path.resolve(o.data), host: o.host || '0.0.0.0', port: parseInt(o.port, 10) || 8443, serverName: o.name || 'Flowlace Server', sessionHours: 12,
        tls: o.pfx ? { pfxFile: path.resolve(o.pfx), passphraseFile: o['pfx-pass-file'] ? path.resolve(o['pfx-pass-file']) : undefined } : (o.cert ? { certFile: path.resolve(o.cert), keyFile: path.resolve(o.key) } : null),
        allowHttp: !!o['allow-http'] && !o.pfx && !o.cert, backupDir: o.backups ? path.resolve(o.backups) : null };
      fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
      fs.writeFileSync(cfgFile, JSON.stringify(c, null, 2));
      console.log(`Configuration written to ${cfgFile}`);
    }
    cfg = loadConfig(cfgFile);
    const acc = openAccounts(cfg);
    try {
      if (!acc.countAdmins()) {
        const un = (o.admin && o.admin !== true ? o.admin : 'admin').toLowerCase();
        const pw = await newPassword(o, un);
        const u = acc.createUser({ username: un, name: o['admin-name'] || 'Administrator', role: 'admin', password: pw });
        acc.log(null, 'user created', `${u.username} (admin) by init`);
        console.log(`Administrator “${u.username}” created.`);
      } else console.log('An administrator already exists.');
      if (o.workspace && o.workspace !== true && !acc.listWorkspaces().some(w => w.name === o.workspace)) {
        const hub = new Hub(cfg, acc, log); const w = hub.createWorkspace(o.workspace, null); hub.closeAll(); console.log(`Workspace “${o.workspace}” created (${w.id}).`);
      }
    } finally { acc.close(); }
    console.log(`Data folder: ${cfg.dataDir}\nBackups:     ${cfg.backupDir}\nNext: install the Windows service (install-service.ps1, see docs/SERVIDOR.md) or run "flowlace-server serve".`);
    return;
  }

  const cfg = loadConfig(cfgFile);

  if (cmd === 'serve') {
    const acc = openAccounts(cfg);
    const hub = new Hub(cfg, acc, log);
    hub.openAll();
    const handler = makeHandler({ cfg, accounts: acc, hub, log });
    const srv = cfg.tlsOptions ? https.createServer(cfg.tlsOptions, handler) : http.createServer(handler);
    srv.keepAliveTimeout = 65e3; srv.headersTimeout = 70e3; srv.requestTimeout = 0;  // SSE streams stay open
    await new Promise((res, rej) => { srv.once('error', rej); srv.listen(cfg.port, cfg.host, res); });
    log(`Flowlace Server ${require('../package.json').version} listening on ${cfg.tlsOptions ? 'https' : 'http'}://${cfg.host}:${cfg.port}  (data: ${cfg.dataDir})`);
    if (!cfg.tlsOptions) log('WARNING: HTTPS is off ("allowHttp": true). Use it only for a first test on a trusted network.');
    let stopping = false;
    const stop = sig => {
      if (stopping) return; stopping = true;
      log(`stopping (${sig})…`);
      srv.close(); hub.closeAll(); acc.close();
      setTimeout(() => process.exit(0), 300).unref();
    };
    ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'].forEach(s => { try { process.on(s, () => stop(s)); } catch (_) { /* not on this platform */ } });
    process.on('message', m => { if (m === 'shutdown') stop('message'); });
    return;
  }

  const acc = openAccounts(cfg);
  try {
    if (cmd === 'create-user') {
      if (!o.username) throw new Error('Use --username <name>.');
      const pw = await newPassword(o, o.username);
      const u = acc.createUser({ username: o.username, name: o.name, role: o.role === 'admin' ? 'admin' : 'member', password: pw, mustChange: !!o['must-change'] });
      acc.log(null, 'user created', `${u.username} (${u.role}) from the command line`);
      console.log(`User “${u.username}” (${u.role}) created.`);
    } else if (cmd === 'reset-password') {
      const u = acc.userByName(o.username); if (!u) throw new Error('User not found.');
      const pw = await newPassword(o, u.username);
      acc.updateUser(u.id, { password: pw, active: true }); acc.dropSessions(u.id); acc.log(null, 'password reset', `${u.username} from the command line`);
      console.log('Password changed; the user’s open sessions were closed.');
    } else if (cmd === 'list-users') {
      for (const u of acc.listUsers()) console.log(`${u.username.padEnd(24)} ${u.role.padEnd(7)} ${u.active ? 'active  ' : 'inactive'} ${u.name}`);
    } else if (cmd === 'list-workspaces') {
      for (const w of acc.listWorkspaces()) console.log(`${w.id}  ${w.name}  ${w.folder}`);
    } else if (cmd === 'create-workspace') {
      if (!o.name) throw new Error('Use --name "<workspace name>".');
      const hub = new Hub(cfg, acc, log); const w = hub.createWorkspace(o.name, null); hub.closeAll(); console.log(`Workspace “${o.name}” created (${w.id}).`);
    } else if (cmd === 'check') {
      console.log(`Configuration OK: ${cfg.file}\nData folder: ${cfg.dataDir}\nHTTPS: ${cfg.tlsOptions ? 'yes' : 'NO'}\nPort: ${cfg.port}\nUsers: ${acc.listUsers().length}\nWorkspaces: ${acc.listWorkspaces().length}`);
    } else {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 11).map(l => l.replace(/^\/\* ?| ?\*\/$/g, '').replace(/^ {3}/, '')).join('\n'));
    }
  } finally { acc.close(); }
}

main().catch(e => { console.error(e.message || e); process.exitCode = 1; });
