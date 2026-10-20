/* Flowlace data model as stored in a workspace: which parts of the application state are shared records,
   which are personal, who may change them, and how a write operation is validated.
   Same file in the server, the Electron main process and the renderer (window.FlowlaceShared). */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlowlaceShared = Object.assign(root.FlowlaceShared || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* Shape version of the application data (S.version in the web build). Stored in the workspace. */
  const DATA_VERSION = 4;
  /* Lists of records with a stable id. One stored record per item. */
  const COLLECTIONS = ['people', 'roles', 'phases', 'services', 'projects', 'deliverables', 'tasks', 'projectPhases', 'projectTeams', 'assignments', 'capacityOverrides'];
  /* Single objects (one record each, id "_"). */
  const SINGLETONS = ['branding', 'company', 'defaults', 'resMeeting', 'workflow', 'workflowDraft'];
  const SINGLETON_ID = '_';
  /* Per-user state: never stored as shared records and never visible to other users. */
  const PERSONAL = ['views', 'favorites'];
  /* Company configuration: in a Company workspace only administrators may change it. */
  const ADMIN_ONLY = ['roles', 'phases', 'services', 'projectTeams', 'branding', 'company', 'defaults', 'workflow', 'workflowDraft'];
  /* Records that must point to an existing project. */
  const PROJECT_CHILDREN = ['deliverables', 'tasks', 'projectPhases', 'assignments'];
  const REQUIRED = {
    people: { name: 'string' }, roles: { name: 'string' }, phases: { name: 'string' }, services: { name: 'string' }, projects: { name: 'string' },
    deliverables: { projectId: 'string' }, tasks: { projectId: 'string', name: 'string' },
    projectPhases: { projectId: 'string', phaseId: 'string' }, projectTeams: { name: 'string' },
    assignments: { projectId: 'string', personId: 'string' }, capacityOverrides: { personId: 'string' }
  };
  const ID_RE = /^[A-Za-z0-9_.:-]{1,120}$/;
  const MAX_RECORD = 2 * 1024 * 1024;           // 2 MB per record
  const MAX_SINGLETON = 12 * 1024 * 1024;       // company / branding may hold logo images
  const MAX_OPS = 50000;

  const isColl = c => COLLECTIONS.includes(c);
  const isSingleton = c => SINGLETONS.includes(c);
  const isAdminOnly = c => ADMIN_ONLY.includes(c);
  const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  /* Validates the form of one operation. Returns an error message or null. Content rules that need the database
     (versions, existing parents) are checked by the store inside the transaction. */
  function checkOp(op, sizeOf) {
    if (!plain(op)) return 'Each operation must be an object.';
    const { type, coll, id } = op;
    if (!['put', 'del', 'move'].includes(type)) return `Unknown operation type "${type}".`;
    if (!isColl(coll) && !isSingleton(coll)) return `Unknown collection "${coll}".`;
    if (isSingleton(coll) ? id !== SINGLETON_ID : !(typeof id === 'string' && ID_RE.test(id))) return `Invalid id for ${coll}.`;
    if (type !== 'move' && !(Number.isInteger(op.base) && op.base >= 0)) return `Missing base version for ${coll}/${id}.`;
    if (type === 'move') {
      if (!isColl(coll)) return 'Only list records have a position.';
      if (typeof op.pos !== 'number' || !isFinite(op.pos)) return `Invalid position for ${coll}/${id}.`;
      return null;
    }
    if (op.pos !== undefined && (typeof op.pos !== 'number' || !isFinite(op.pos))) return `Invalid position for ${coll}/${id}.`;
    if (type === 'del') return isSingleton(coll) ? 'Singleton records are replaced, not deleted.' : null;
    const d = op.data;
    if (isSingleton(coll)) {
      if (!(d === null || plain(d))) return `${coll} must be an object.`;
    } else {
      if (!plain(d)) return `${coll}/${id}: data must be an object.`;
      if (d.id !== id) return `${coll}/${id}: the id inside the record doesn't match.`;
      const req = REQUIRED[coll] || {};
      for (const k of Object.keys(req)) if (typeof d[k] !== req[k]) return `${coll}/${id}: "${k}" is missing or has the wrong type.`;
    }
    const size = sizeOf ? sizeOf(d) : 0;
    if (size > (isSingleton(coll) ? MAX_SINGLETON : MAX_RECORD)) return `${coll}/${id} is too large (${Math.round(size / 1024)} KB).`;
    return null;
  }

  function checkBatch(b) {
    if (!plain(b)) return 'The request must be an object.';
    if (typeof b.opId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(b.opId)) return 'Missing or invalid operation id.';
    if (!Array.isArray(b.ops) || !b.ops.length) return 'No operations to apply.';
    if (b.ops.length > MAX_OPS) return 'Too many operations in one request.';
    const seen = new Set();
    for (const op of b.ops) {
      const e = checkOp(op, d => JSON.stringify(d === undefined ? null : d).length);
      if (e) return e;
      const k = op.type + '\u0000' + op.coll + '\u0000' + op.id;
      if (op.type !== 'move' && seen.has(k)) return `${op.coll}/${op.id} appears twice in the same request.`;
      seen.add(k);
    }
    return null;
  }

  /* Human-readable label for a record (conflict dialogs, activity log). */
  function recordLabel(coll, data) {
    const names = { people: 'Person', roles: 'Role', phases: 'Phase', services: 'Discipline', projects: 'Project', deliverables: 'Deliverable', tasks: 'Task',
      projectPhases: 'Project phase', projectTeams: 'Project team', assignments: 'Planned hours', capacityOverrides: 'Capacity',
      branding: 'Appearance', company: 'Company details', defaults: 'Project defaults', resMeeting: 'Resources meeting', workflow: 'Company workflow', workflowDraft: 'Workflow draft' };
    const n = data && (data.name || data.code || data.weekStart) ? String(data.code && data.name ? data.code + ' ' + data.name : (data.name || data.code || data.weekStart)) : '';
    return (names[coll] || coll) + (n ? ' · ' + n : '');
  }

  return { DATA_VERSION, COLLECTIONS, SINGLETONS, SINGLETON_ID, PERSONAL, ADMIN_ONLY, PROJECT_CHILDREN, ID_RE,
    isColl, isSingleton, isAdminOnly, checkOp, checkBatch, recordLabel };
});
