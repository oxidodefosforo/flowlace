'use strict';
/* Electron Forge configuration — Flowlace desktop client for Windows 10/11 x64.
   npm run make:win   → out/make/squirrel.windows/x64/FlowlaceSetup.exe  (installer)
                        out/make/zip/win32/x64/Flowlace-win32-x64-<version>.zip  (portable copy)
   The interface is rebuilt before packaging (hook below), so the package never contains stale UI code.
   Offline builds: set FLOWLACE_ELECTRON_ZIP_DIR to a folder holding electron-v<version>-win32-x64.zip. */
const path = require('path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// Only what the app needs at run time goes into the package (Forge also prunes devDependencies).
const KEEP = [/^\/package\.json$/, /^\/src\/main(\/|$)/, /^\/src\/preload(\/|$)/, /^\/src\/renderer\/dist(\/|$)/, /^\/shared(\/|$)/, /^\/assets(\/|$)/, /^\/node_modules(\/|$)/];
const PARENTS = ['/src', '/src/renderer'];

module.exports = {
  packagerConfig: {
    name: 'Flowlace',
    executableName: 'Flowlace',
    appBundleId: 'com.alphazeta.flowlace',
    appCopyright: 'Alphazeta Group',
    icon: path.join(__dirname, 'assets', 'icon'),          // icon.ico on Windows
    asar: true,
    prune: true,
    ignore: file => !!file && !PARENTS.includes(file) && !KEEP.some(r => r.test(file)),
    win32metadata: { CompanyName: 'Alphazeta Group', FileDescription: 'Flowlace', ProductName: 'Flowlace', InternalName: 'Flowlace', OriginalFilename: 'Flowlace.exe' },
    ...(process.env.FLOWLACE_ELECTRON_ZIP_DIR ? { download: { cacheRoot: process.env.FLOWLACE_ELECTRON_ZIP_DIR }, electronZipDir: process.env.FLOWLACE_ELECTRON_ZIP_DIR } : {})
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'Flowlace',                     // per-user install in %LocalAppData%\Flowlace; shortcuts in the Start menu and on the desktop
        authors: 'Alphazeta Group',
        description: 'Flowlace — projects, deliverables, tasks and resources',
        exe: 'Flowlace.exe',
        setupExe: 'FlowlaceSetup.exe',
        setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
        noMsi: true
        // To sign the installer: certificateFile + certificatePassword (or windowsSign). See docs/GUIA.md.
      }
    },
    { name: '@electron-forge/maker-zip', platforms: ['win32', 'linux', 'darwin'] }
  ],
  hooks: {
    generateAssets: async () => { require('./scripts/build-renderer.js'); }
  },
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,                         // Flowlace.exe can't be used as a general Node.js
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
