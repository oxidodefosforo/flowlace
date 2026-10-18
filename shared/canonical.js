/* Canonical JSON: object keys sorted, so two records with the same content always serialise identically.
   Used by the client (to detect what changed) and by the store (to recognise identical concurrent writes).
   Loaded with require() in Node/Electron main, and as a plain script in the renderer (window.FlowlaceShared). */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlowlaceShared = Object.assign(root.FlowlaceShared || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function canon(v) {
    if (v === undefined || typeof v === 'function') return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    const keys = Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  function sameData(a, b) { return canon(a) === canon(b); }
  return { canon, sameData };
});
