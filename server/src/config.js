'use strict';
/* Flowlace Server settings (flowlace-server.json). Example:
   {
     "dataDir": "D:\\FlowlaceData",           // local disk of the server machine; databases live here
     "host": "0.0.0.0", "port": 8443,
     "tls": { "pfxFile": "D:\\FlowlaceData\\certs\\flowlace.pfx", "passphraseFile": "D:\\FlowlaceData\\certs\\pfx-pass.txt" },
       // or { "certFile": "...crt/pem (full chain)", "keyFile": "...key" }
     "serverName": "Alphazeta Flowlace",
     "sessionHours": 12,
     "backupDir": null                            // default: <dataDir>\backups ; may be a network folder (\\nas\backups\flowlace)
   }  */
const fs = require('fs');
const path = require('path');
const { isUncPath } = require('../../shared/workspace-folder');

const DEFAULTS = { host: '0.0.0.0', port: 8443, tls: null, serverName: 'Flowlace Server', sessionHours: 12, backupDir: null, allowHttp: false, maxBodyMB: 64 };

function defaultConfigPath() {
  return process.env.FLOWLACE_SERVER_CONFIG || path.join(process.env.ProgramData || (process.platform === 'win32' ? 'C:\\ProgramData' : '/etc'), 'Flowlace Server', 'flowlace-server.json');
}

function loadConfig(file) {
  const f = file || defaultConfigPath();
  if (!fs.existsSync(f)) throw new Error(`Configuration file not found: ${f}\nRun "flowlace-server init" first (see docs/SERVIDOR.md).`);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { throw new Error(`${f} is not valid JSON: ${e.message}`); }
  const c = Object.assign({}, DEFAULTS, raw, { file: f });
  if (!c.dataDir) throw new Error('"dataDir" is required in the configuration.');
  c.dataDir = path.resolve(path.dirname(f), c.dataDir);
  if (isUncPath(c.dataDir)) throw new Error('"dataDir" must be a folder on a local disk of this server, not a network share. Backups can go to a network folder ("backupDir").');
  c.backupDir = c.backupDir ? path.resolve(path.dirname(f), c.backupDir) : path.join(c.dataDir, 'backups');
  c.port = parseInt(c.port, 10) || DEFAULTS.port;
  if (c.tls) {
    const t = c.tls, rel = p => p && path.resolve(path.dirname(f), p);
    c.tlsOptions = {};
    if (t.pfxFile) {
      c.tlsOptions.pfx = fs.readFileSync(rel(t.pfxFile));
      const pass = t.passphraseFile ? fs.readFileSync(rel(t.passphraseFile), 'utf8').trim() : (t.passphrase || process.env.FLOWLACE_PFX_PASSPHRASE || undefined);
      if (pass) c.tlsOptions.passphrase = pass;
    } else if (t.certFile && t.keyFile) {
      c.tlsOptions.cert = fs.readFileSync(rel(t.certFile)); c.tlsOptions.key = fs.readFileSync(rel(t.keyFile));
    } else throw new Error('"tls" needs either "pfxFile" or "certFile" + "keyFile".');
    c.tlsOptions.minVersion = 'TLSv1.2';
  } else if (!c.allowHttp) {
    throw new Error('HTTPS is not configured. Add a "tls" section with the server certificate (docs/SERVIDOR.md). For a first test on a trusted network only, set "allowHttp": true.');
  }
  return c;
}

module.exports = { loadConfig, defaultConfigPath, DEFAULTS };
