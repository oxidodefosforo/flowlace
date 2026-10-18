'use strict';
/* The limited API the interface can use (window.flowlace). No Node.js, no file system: each function asks the main
   process to do one specific thing. Paths chosen in Windows dialogs stay in the main process (the page gets a reference). */
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch, arg) => ipcRenderer.invoke(ch, arg);
const EVENTS = ['connection', 'remote', 'reset', 'maintenance', 'info', 'backup', 'menu'];

contextBridge.exposeInMainWorld('flowlace', Object.freeze({
  desktop: true,
  workspace: Object.freeze({
    status: () => call('ws:status'),
    pickFolder: purpose => call('ws:pick-folder', { purpose }),
    targetFor: (ref, name) => call('ws:target-for', { ref, name }),
    createLocal: (ref, name) => call('ws:create-local', { ref, name }),
    openLocal: (ref, force) => call('ws:open-local', { ref, force }),
    openRecent: (key, force) => call('ws:open-recent', { key, force }),
    openMoved: key => call('ws:open-moved', { key }),
    forget: key => call('ws:forget', { key }),
    moveLocal: ref => call('ws:move-local', { ref }),
    testServer: url => call('ws:test-server', { url }),
    signIn: (url, username, password) => call('ws:sign-in', { url, username, password }),
    serverWorkspaces: (url, username) => call('ws:server-workspaces', { url, username }),
    createServerWorkspace: (url, username, name) => call('ws:create-server-workspace', { url, username, name }),
    connectCompany: (url, username, workspaceId) => call('ws:connect-company', { url, username, workspaceId }),
    retry: () => call('ws:retry'),
    reload: () => call('ws:reload'),
    info: () => call('ws:info'),
    rename: name => call('ws:rename', { name }),
    showFolder: () => call('ws:show-folder'),
    testConnection: () => call('ws:test-connection')
  }),
  data: Object.freeze({
    snapshot: () => call('data:snapshot'),
    commit: batch => call('data:commit', batch),
    changes: since => call('data:changes', { since }),
    getUserState: () => call('data:get-state'),
    setUserState: data => call('data:set-state', { data }),
    activity: (limit, coll, id) => call('data:activity', { limit, coll, id }),
    savePending: data => call('data:pending-save', { data }),
    loadPending: () => call('data:pending-load')
  }),
  backup: Object.freeze({
    now: () => call('bk:now'),
    list: () => call('bk:list'),
    pickFile: () => call('bk:pick-file'),
    inspect: ref => call('bk:inspect', ref),
    restore: ref => call('bk:restore', ref),
    settings: s => call('bk:set', s),
    pickDir: () => call('bk:pick-dir'),
    resetDir: () => call('bk:reset-dir')
  }),
  files: Object.freeze({
    openJSON: () => call('file:open-json'),
    saveText: (suggestedName, text) => call('file:save-text', { suggestedName, text })
  }),
  admin: Object.freeze({
    users: () => call('adm:users'),
    createUser: u => call('adm:create-user', u),
    updateUser: (id, patch) => call('adm:update-user', { id, patch }),
    log: () => call('adm:log')
  }),
  account: Object.freeze({
    changePassword: (current, password) => call('acc:change-password', { current, password }),
    signOut: () => call('acc:sign-out')
  }),
  openExternal: url => call('app:open-external', { url }),
  on(event, cb) {
    if (!EVENTS.includes(event) || typeof cb !== 'function') return () => {};
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('ev:' + event, h);
    return () => ipcRenderer.removeListener('ev:' + event, h);
  }
}));
