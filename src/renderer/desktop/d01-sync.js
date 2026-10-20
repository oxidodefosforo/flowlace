/* ---------- desktop: persistence by record (versions, conflicts, live updates) ----------
   Replaces the browser's localStorage. The application keeps working on the in-memory state S exactly as before;
   save() no longer writes the whole state. Instead it compares S with the last version confirmed by the workspace
   and sends only the records that changed, each with the version it started from:
     put  = a record created or changed      del = a record removed      move = a record's order changed
   The workspace applies one batch in one transaction. A record changed meanwhile by someone else comes back as a
   conflict and the local change is kept for review. Committed changes made by others arrive as live updates and are
   merged into S in place, without closing panels, resetting filters or interrupting a form being edited.
   View settings, filters, column widths, saved views and Favorites are personal (saved per user, never shared). */
const MS = window.FlowlaceShared, API = window.flowlace;
const SY = {
  base: new Map(),      // "coll␁id" -> { v: version, j: canonical JSON (null = deleted), pos }
  seq: 0, epoch: null,
  inflight: null,       // the batch being saved: { opId, ops, sent: Map(key -> json) }
  timer: null, dirty: false,
  state: 'saved',       // saved | saving | offline | failed | conflict | auth | maintenance
  conn: { state: 'local' },
  error: null, conflicts: null, rejected: null,
  ws: null, user: null, isAdmin: true, mode: 'local', info: null,
  pendingRender: false, lastRemote: null, started: false
};
const SKEY = (c, id) => c + '\u0001' + id;
const emptyStd = () => ({ version: 0, appliedAt: null, demo: false, schema: 2, demoV2: false, steps: [] });

/* ----- loading ----- */
function snapshotToData(snap) {
  const d = { version: snap.dataVersion || MS.DATA_VERSION };
  MS.COLLECTIONS.forEach(c => { d[c] = []; });
  for (const r of snap.records) {
    if (MS.isColl(r.coll)) d[r.coll].push(r.data);
    else if (MS.isSingleton(r.coll)) d[r.coll] = r.data;
  }
  return d;
}
function applyPersonalPrefs(p) {
  if (!p || typeof p !== 'object') return;
  try {
    prefs = { ...prefs, ...p, filters: { ...prefs.filters, ...(p.filters || {}) }, sort: { ...prefs.sort, ...(p.sort || {}) }, tf: { ...TF0(), ...(p.tf || {}) }, ptf: { ...PTF0(), ...(p.ptf || {}) }, tvG: { ...prefs.tvG, ...(p.tvG || {}) }, tvP: { ...prefs.tvP, ...(p.tvP || {}) }, expanded: { ...(p.expanded || {}) }, activeView: { ...(p.activeView && typeof p.activeView === 'object' ? p.activeView : {}) }, drafts: { ...(p.drafts && typeof p.drafts === 'object' ? p.drafts : {}) }, resF: { ...prefs.resF, ...(p.resF || {}) }, resCollapsed: { ...(p.resCollapsed || {}) } };
    if (prefs.sortV !== 2) { prefs.sort = { k: '', dir: 1 }; prefs.sortV = 2; }
    if (!RANGES[prefs.range]) prefs.range = '3w';
    if (!['timeline', 'table', 'calendar'].includes(prefs.ovMode)) prefs.ovMode = 'timeline';
  } catch (e) { /* keep defaults */ }
}
/* Builds S from the workspace. A new, empty workspace starts with the standard configuration (phases, disciplines,
   defaults) and an empty workflow standard — never with example projects: those load only from Settings. */
function loadFromSnapshot(snap, personal) {
  const d = snapshotToData(snap);
  const empty = !snap.records.length;
  if (empty) { d.workflow = emptyStd(); d.workflowDraft = null; }
  d.views = Array.isArray(personal && personal.views) ? personal.views : [];
  d.favorites = Array.isArray(personal && personal.favorites) ? personal.favorites : [];
  S = normalize(d);
  if (!S.workflow) S.workflow = emptyStd();
  applyPersonalPrefs(personal && personal.prefs);
  rebase(snap);
  SY.seq = snap.seq || 0; SY.epoch = snap.epoch; SY.started = true;
  return empty;
}
/* What the workspace has confirmed: versions from the snapshot, content as normalised here. Records the
   normalisation added are not in the workspace yet and are saved with the next change. */
function rebase(snap) {
  SY.base.clear();
  const meta = new Map(snap.records.map(r => [SKEY(r.coll, r.id), r]));
  MS.COLLECTIONS.forEach(c => (S[c] || []).forEach(it => { const r = it && meta.get(SKEY(c, it.id)); if (r) SY.base.set(SKEY(c, it.id), { v: r.v, j: MS.canon(it), pos: r.pos }); }));
  MS.SINGLETONS.forEach(c => { const r = meta.get(SKEY(c, MS.SINGLETON_ID)); if (r) SY.base.set(SKEY(c, MS.SINGLETON_ID), { v: r.v, j: MS.canon(S[c] === undefined ? null : S[c]) }); });
}

/* ----- what changed ----- */
function buildOps() {
  const ops = [], sent = new Map(), seen = new Set();
  for (const c of MS.COLLECTIONS) {
    const list = Array.isArray(S[c]) ? S[c] : [], ids = [], putAt = new Map();
    for (const it of list) {
      if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !MS.ID_RE.test(it.id)) continue;
      const k = SKEY(c, it.id); if (seen.has(k)) continue; seen.add(k); ids.push(it.id);
      const j = MS.canon(it), b = SY.base.get(k);
      if (!b || b.j === null || b.j !== j) { putAt.set(it.id, ops.length); ops.push({ type: 'put', coll: c, id: it.id, base: b ? b.v : 0, data: it }); sent.set(k, j); }
    }
    positions(c, ids, ops, putAt);
  }
  for (const c of MS.SINGLETONS) {
    const k = SKEY(c, MS.SINGLETON_ID), v = S[c] === undefined ? null : S[c], j = MS.canon(v), b = SY.base.get(k);
    if (!b ? v !== null : b.j !== j) { ops.push({ type: 'put', coll: c, id: MS.SINGLETON_ID, base: b ? b.v : 0, data: v }); sent.set(k, j); }
  }
  for (const [k, b] of SY.base) {
    if (b.j === null || seen.has(k)) continue;
    const [c, id] = k.split('\u0001');
    if (!MS.isColl(c)) continue;
    ops.push({ type: 'del', coll: c, id, base: b.v }); sent.set(k, null);
  }
  return { ops, sent };
}
/* Keeps the order of a list with as few position changes as possible (longest run already in order stays). */
function positions(c, ids, ops, putAt) {
  const n = ids.length; if (!n) return;
  const pos = ids.map(id => { const b = SY.base.get(SKEY(c, id)); return b && b.j !== null && typeof b.pos === 'number' ? b.pos : null; });
  const idx = []; for (let i = 0; i < n; i++) if (pos[i] !== null) idx.push(i);
  // longest strictly increasing subsequence of pos over idx
  const tails = [], prev = new Array(idx.length).fill(-1), tailIdx = [];
  idx.forEach((ii, k) => {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tails[m] < pos[ii]) lo = m + 1; else hi = m; }
    tails[lo] = pos[ii]; tailIdx[lo] = k; prev[k] = lo > 0 ? tailIdx[lo - 1] : -1;
  });
  const keep = new Set(); let k = tails.length ? tailIdx[tails.length - 1] : -1;
  while (k >= 0) { keep.add(idx[k]); k = prev[k]; }
  const np = pos.slice();
  let i = 0;
  while (i < n) {
    if (keep.has(i)) { i++; continue; }
    let j = i; while (j < n && !keep.has(j)) j++;
    const lo = i > 0 ? np[i - 1] : null, hi = j < n ? np[j] : null, cnt = j - i;
    for (let t = 0; t < cnt; t++) np[i + t] = lo === null && hi === null ? (t + 1) * 1024 : lo === null ? hi - (cnt - t) * 1024 : hi === null ? lo + (t + 1) * 1024 : lo + (hi - lo) * (t + 1) / (cnt + 1);
    i = j;
  }
  let ok = true; for (let t = 1; t < n; t++) if (!(np[t] - np[t - 1] > 1e-7)) { ok = false; break; }
  if (!ok) for (let t = 0; t < n; t++) np[t] = (t + 1) * 1024;      // renumber when the gaps get too small
  for (let t = 0; t < n; t++) {
    if (np[t] === pos[t]) continue;
    const at = putAt.get(ids[t]);
    if (at !== undefined) ops[at].pos = np[t];
    else if (pos[t] !== null) ops.push({ type: 'move', coll: c, id: ids[t], pos: np[t] });
  }
}

/* ----- saving ----- */
function save() { SY.dirty = true; schedulePersonal(); if (!SY.timer) SY.timer = setTimeout(flush, 150); setSaveInd(); }
let bannerTimer = null;
const bannerSoon = () => { clearTimeout(bannerTimer); bannerTimer = setTimeout(updateBanner, 250); };
function savePrefs() { schedulePersonal(); }
const canWrite = () => !SY.inflight && !['offline', 'auth', 'maintenance', 'conflict'].includes(SY.state) && !SY.conflicts && !SY.rejected && SY.started;
function newOpId() { const a = new Uint8Array(12); crypto.getRandomValues(a); return 'op' + Date.now().toString(36) + Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); }

async function flush() {
  SY.timer = null;
  if (!canWrite()) { setSaveInd(); bannerSoon(); if (SY.started && SY.state !== 'saving') savePendingFile(); return; }
  SY.dirty = false;
  let { ops, sent } = buildOps();
  if (!SY.isAdmin) {
    // company configuration is read-only for members: such changes are not sent and the confirmed version is put back
    // records that exist only because this version adds defaults (e.g. the roles catalogue) wait for an administrator
    const fresh = ops.filter(o => MS.isAdminOnly(o.coll) && !SY.base.has(SKEY(o.coll, o.id)) && o.type !== 'del');
    if (fresh.length) { ops = ops.filter(o => !fresh.includes(o)); fresh.forEach(o => sent.delete(SKEY(o.coll, o.id))); }
    const bad = ops.filter(o => MS.isAdminOnly(o.coll));
    if (bad.length) {
      bad.forEach(o => revertKey(SKEY(o.coll, o.id)));
      ops = ops.filter(o => !MS.isAdminOnly(o.coll)); bad.forEach(o => sent.delete(SKEY(o.coll, o.id)));
      if (bad.some(o => !['workflowDraft'].includes(o.coll))) toast('Only administrators can change company settings. That change was not saved.', 'err');
      ui.wsNeedsRender = true;
    }
  }
  if (!ops.length) { setState(SY.state === 'saving' ? 'saved' : SY.state === 'failed' ? 'saved' : SY.state); savePendingFile(); if (ui.wsNeedsRender) { ui.wsNeedsRender = false; render(); } return; }
  SY.inflight = { opId: newOpId(), ops, sent };
  await sendInflight();
}

async function sendInflight() {
  const f = SY.inflight; if (!f) return;
  setState('saving');
  let r;
  try { r = await API.data.commit({ opId: f.opId, ops: f.ops }); } catch (e) { r = { ok: false, kind: 'error', message: String(e && e.message || e) }; }
  if (SY.inflight !== f) return;
  if (r.ok) {
    applyAck(f, r); SY.inflight = null; lastSaved = new Date(); storageOK = true; SY.error = null;
    setState('saved');
    if (SY.dirty) flush(); else savePendingFile();
    return;
  }
  if (r.kind === 'offline' || r.kind === 'unavailable' || r.kind === 'maintenance') {
    setState(r.kind === 'maintenance' ? 'maintenance' : 'offline', r.message); savePendingFile();   // the same batch (same id) is sent again when the connection returns
    if (r.kind !== 'offline') setTimeout(() => { if (SY.inflight === f && SY.state !== 'saved') sendInflight(); }, 5000);
    return;
  }
  if (r.kind === 'auth') { setState('auth', r.message); savePendingFile(); askSignIn(); return; }
  SY.inflight = null;
  if (r.kind === 'conflict') { SY.conflicts = r.conflicts || []; setState('conflict'); savePendingFile(); openConflicts(); return; }
  if (r.kind === 'forbidden' || r.kind === 'missing-parent' || r.kind === 'invalid') { SY.rejected = { kind: r.kind, message: r.message, keys: r.keys || [] }; setState('failed', r.message); savePendingFile(); openRejected(); return; }
  SY.error = r.message || 'The change could not be saved.'; setState('failed', SY.error); savePendingFile();
}

function applyAck(f, r) {
  for (const x of r.results || []) {
    const k = SKEY(x.coll, x.id), b = SY.base.get(k);
    if (x.deleted) { SY.base.set(k, { v: x.v, j: null }); continue; }
    if (f.sent.has(k)) SY.base.set(k, { v: x.v, j: f.sent.get(k), pos: x.pos != null ? x.pos : (b && b.pos) });
    else if (b && x.pos != null) b.pos = x.pos;
  }
  if (r.seq > SY.seq) SY.seq = r.seq;
}

function retrySave() {
  if (SY.conflicts) { openConflicts(); return; }
  if (SY.rejected) { openRejected(); return; }
  if (['offline', 'auth', 'maintenance'].includes(SY.state) && SY.mode === 'company') { API.workspace.testConnection().then(() => { if (SY.inflight) sendInflight(); else flush(); }); return; }
  SY.error = null; setState('saved');
  if (SY.inflight) sendInflight(); else flush();
}

/* ----- local records ----- */
function localGet(c, id) {
  if (MS.isSingleton(c)) return S[c] === undefined ? null : S[c];
  return (S[c] || []).find(x => x && x.id === id) || null;
}
function localPut(c, id, data) {
  if (MS.isSingleton(c)) {
    if (S[c] && data && typeof S[c] === 'object') { Object.keys(S[c]).forEach(k => delete S[c][k]); Object.assign(S[c], data); } else S[c] = data;
    return;
  }
  if (!Array.isArray(S[c])) S[c] = [];
  const cur = S[c].find(x => x && x.id === id);
  if (cur) { Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, data); } else S[c].push(data);
}
function localDel(c, id) { if (MS.isColl(c) && Array.isArray(S[c])) { const i = S[c].findIndex(x => x && x.id === id); if (i >= 0) S[c].splice(i, 1); } }
function resort(c) {
  const list = S[c]; if (!Array.isArray(list)) return;
  const o = list.map((x, i) => [x, i, (() => { const b = x && SY.base.get(SKEY(c, x.id)); return b && typeof b.pos === 'number' ? b.pos : Infinity; })()]);
  o.sort((a, b) => a[2] === b[2] ? a[1] - b[1] : a[2] - b[2]);
  o.forEach((x, i) => { list[i] = x[0]; });
}
/* Puts back the last confirmed version of one record (or removes it if it was never confirmed). */
function revertKey(k) {
  const [c, id] = k.split('\u0001'), b = SY.base.get(k);
  if (!b || b.j === null) { if (MS.isSingleton(c)) S[c] = b ? null : S[c]; else localDel(c, id); return; }
  localPut(c, id, JSON.parse(b.j));
  if (MS.isColl(c)) resort(c);
}
/* Discards every change not confirmed by the workspace. */
function revertAll() {
  const { ops } = buildOps();
  const keys = new Set(ops.filter(o => o.type !== 'move').map(o => SKEY(o.coll, o.id)));
  keys.forEach(revertKey);
  MS.COLLECTIONS.forEach(resort);
  SY.inflight = null; SY.conflicts = null; SY.rejected = null; SY.dirty = false; SY.error = null;
  savePendingFile(true);
  return keys.size;
}
function unsavedCount() { try { return buildOps().ops.filter(o => o.type !== 'move').length; } catch (e) { return 0; } }

/* ----- live updates from other users ----- */
function applyRemote(records, by) {
  const touched = new Set(); let n = 0;
  for (const r of records || []) {
    if (!MS.isColl(r.coll) && !MS.isSingleton(r.coll)) continue;
    const k = SKEY(r.coll, r.id), b = SY.base.get(k);
    if (b && r.v < b.v) continue;
    if (b && r.v === b.v) {           // same version: at most the order changed
      if (!r.deleted && typeof r.pos === 'number' && b.j !== null && r.pos !== b.pos) { b.pos = r.pos; touched.add(r.coll); n++; }
      continue;
    }
    if (SY.inflight && SY.inflight.sent.has(k)) continue;              // our own pending save decides (it will report a conflict)
    const local = localGet(r.coll, r.id);
    const localJ = local == null ? null : MS.canon(local);
    const clean = b ? b.j === localJ : localJ === null;
    if (!clean) continue;                                             // keep the local edit; saving it reports the conflict
    if (r.deleted) { if (MS.isColl(r.coll)) localDel(r.coll, r.id); SY.base.set(k, { v: r.v, j: null }); }
    else { localPut(r.coll, r.id, r.data); SY.base.set(k, { v: r.v, j: MS.canon(r.data), pos: r.pos }); }
    if (MS.isColl(r.coll)) touched.add(r.coll);
    n++;
  }
  touched.forEach(resort);
  if (n) { SY.lastRemote = { by: by && by.name, at: new Date() }; scheduleRemoteRender(); }
  return n;
}
function userIsBusy() {
  const ae = document.activeElement;
  const typing = ae && ae !== document.body && (ae.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !/^(checkbox|radio|button|submit|color|file)$/.test(ae.type || '')));
  return !!(typing || modalRoot.innerHTML || drag || dragTask || document.querySelector('.menu:not([hidden])') || document.querySelector('#ms-start:not([hidden])'));
}
let remoteRenderTimer = null;
function scheduleRemoteRender() {
  SY.pendingRender = true; updateBanner();
  clearTimeout(remoteRenderTimer);
  const tryNow = () => {
    if (!SY.pendingRender) return;
    if (userIsBusy()) { remoteRenderTimer = setTimeout(tryNow, 500); return; }
    SY.pendingRender = false; updateBanner(); render();
  };
  remoteRenderTimer = setTimeout(tryNow, 60);
}

/* ----- personal settings (this user only) ----- */
const PS = { timer: null, last: null, retry: null };
function schedulePersonal() {
  if (!SY.started) return;
  clearTimeout(PS.timer);
  PS.timer = setTimeout(async () => {
    const d = { v: 1, prefs, views: S.views || [], favorites: S.favorites || [] };
    const j = JSON.stringify(d); if (j === PS.last) return;
    const r = await API.data.setUserState(d).catch(() => ({ ok: false }));
    if (r.ok) PS.last = j; else { clearTimeout(PS.retry); PS.retry = setTimeout(schedulePersonal, 8000); }
  }, 700);
}

/* ----- unsaved changes kept on this computer (survive closing Flowlace) ----- */
let pendTimer = null;
function savePendingFile(now) {
  clearTimeout(pendTimer);
  const go = () => {
    const { ops } = SY.started ? buildOps() : { ops: [] };
    const recs = ops.filter(o => o.type !== 'move').map(o => o.type === 'del' ? { coll: o.coll, id: o.id, base: o.base, deleted: true } : { coll: o.coll, id: o.id, base: o.base, data: o.data });
    const inflight = SY.inflight && ['offline', 'auth', 'maintenance', 'failed'].includes(SY.state) ? { opId: SY.inflight.opId, ops: SY.inflight.ops } : null;
    API.data.savePending(recs.length || inflight ? { savedAt: new Date().toISOString(), workspace: SY.ws && SY.ws.id, records: recs, inflight } : null);
  };
  if (now) go(); else pendTimer = setTimeout(go, 400);
}
window.addEventListener('beforeunload', () => { if (SY.started && SY.state !== 'saved') savePendingFile(true); });

/* ----- status ----- */
function setState(s, err) {
  SY.state = s; if (err !== undefined) SY.error = err || null;
  storageOK = true;
  setSaveInd(); updateBanner();
}
const SAVE_TEXT = { saving: 'Saving…', offline: 'Disconnected', failed: 'Save failed', conflict: 'Conflict — review', auth: 'Sign in to save', maintenance: 'Server busy' };
function saveText() {
  if (SY.state === 'saved') return SY.dirty || SY.timer ? 'Saving…' : (lastSaved ? `Saved ${hhmm(lastSaved)}` : 'All changes saved');
  return SAVE_TEXT[SY.state] || 'Saved';
}
function saveIndHTML(id) {
  const cls = SY.state === 'saved' ? (SY.dirty || SY.timer ? ' saving' : '') : SY.state === 'saving' ? ' saving' : ' bad';
  const where = SY.mode === 'company' ? `Company workspace “${SY.ws ? SY.ws.name : ''}” on ${SY.ws ? SY.ws.url : 'the server'}` : `Local workspace “${SY.ws ? SY.ws.name : ''}” in ${SY.ws ? SY.ws.folder : 'a folder on this computer'}`;
  const tip = SY.state === 'saved' ? `Saved only after the ${SY.mode === 'company' ? 'server' : 'workspace database'} confirms it. ${where}` : (SY.error || SAVE_TEXT[SY.state] || '') + ' · ' + where;
  return `<button type="button" class="save-ind${cls}" id="${id || 'save-ind'}" data-dact="save-status" title="${esc(tip)}"><span>${esc(saveText())}${id ? '' : ` · ${SY.mode === 'company' ? 'Company' : 'Local'}`}</span></button>`;
}
function setSaveInd() {
  ['save-ind', 'pn-save'].forEach(id => { const el = document.getElementById(id); if (el) el.outerHTML = saveIndHTML(id === 'pn-save' ? 'pn-save' : ''); });
}
function resSaved() { save(); setResStatus('Saving…', ''); const t = setInterval(() => { if (SY.state === 'saved' && !SY.dirty && !SY.timer && !SY.inflight) { clearInterval(t); setResStatus(`Saved ${hhmm(lastSaved || new Date())}`, 'ok'); } else if (SY.state !== 'saving' && SY.state !== 'saved') { clearInterval(t); setResStatus(SAVE_TEXT[SY.state] || 'Not saved', 'bad'); } }, 200); }

function updateBanner() {
  const el = document.getElementById('ms-banner'); if (!el) return;
  let h = '', cls = 'warn';
  const n = SY.started ? unsavedCount() : 0;
  if (SY.state === 'offline' || (SY.conn && SY.conn.state === 'offline')) {
    cls = 'bad';
    h = `<b>Disconnected from Flowlace Server${SY.conn && SY.conn.since ? ` since ${hhmm(new Date(SY.conn.since))}` : ''}.</b> The information shown may be out of date. Nothing is saved until the connection returns${n ? ` — ${plural(n, 'unsaved change')} kept on this computer` : ''}. <button class="btn sm" data-dact="retry">Try again</button>${n ? ' <button class="btn sm ghost" data-dact="discard-unsaved">Discard unsaved changes…</button>' : ''}`;
  } else if (SY.state === 'auth' || (SY.conn && SY.conn.state === 'auth')) {
    cls = 'bad'; h = `<b>Your session on the server has ended.</b> ${n ? `${plural(n, 'change')} waiting to be saved. ` : ''}<button class="btn sm primary" data-dact="sign-in">Sign in</button>`;
  } else if (SY.state === 'maintenance') {
    h = '<b>The workspace is being restored from a backup on the server.</b> Saving resumes automatically.';
  } else if (SY.state === 'conflict') {
    h = `<b>Someone else changed the same ${SY.conflicts && SY.conflicts.length > 1 ? 'items' : 'item'}.</b> Your change is kept and has not been saved. <button class="btn sm primary" data-dact="conflicts">Review</button>`;
  } else if (SY.state === 'failed') {
    cls = 'bad'; h = `<b>Save failed.</b> ${esc(SY.error || '')} ${SY.rejected ? '<button class="btn sm primary" data-dact="rejected">Review</button>' : '<button class="btn sm primary" data-dact="retry">Try again</button>'}`;
  } else if (SY.pendingRender) {
    cls = 'info'; h = `Updates from ${esc(SY.lastRemote && SY.lastRemote.by || 'another user')} will appear when you finish editing.`;
  }
  el.className = 'ms-banner ' + cls; el.hidden = !h; el.innerHTML = h;
}

/* ----- events from the main process ----- */
function listenWorkspace() {
  API.on('connection', c => {
    const was = SY.conn && SY.conn.state; SY.conn = c;
    if (c.state === 'connected') {
      if (['offline', 'auth', 'maintenance'].includes(SY.state)) setState('saved');
      if (SY.inflight) sendInflight(); else if (SY.dirty || unsavedCount()) flush();
      if (was === 'offline') toast('Connection to the server restored');
    } else if (c.state === 'offline' && SY.state !== 'conflict') { if (SY.state !== 'failed') setState('offline', c.error); }
    else if (c.state === 'auth') { setState('auth', c.error); askSignIn(); }
    updateBanner(); setSaveInd();
  });
  API.on('remote', p => { if (!SY.started) return; applyRemote(p.records, p.by); if (p.seq > SY.seq) SY.seq = p.seq; });
  API.on('reset', p => {
    if (!SY.started) return;
    savePendingFile(true);
    openModal(`<div class="m-head"><div><div class="eyebrow">Workspace restored</div><h2>The data was restored from a backup</h2></div></div><p>${esc(p.by || 'An administrator')} restored this workspace${p.from ? ` from <span class="mono">${esc(p.from)}</span>` : ''}. Flowlace reloads it now.${unsavedCount() ? ' Your unsaved changes are kept and offered again after reloading.' : ''}</p><div class="m-actions"><button class="btn primary" data-dact="reload">Reload</button></div>`);
  });
  API.on('maintenance', p => { if (p.on) setState('maintenance'); else if (SY.state === 'maintenance') { setState('saved'); if (SY.inflight) sendInflight(); } });
  API.on('info', p => { if (p.name && SY.ws) { SY.ws.name = p.name; render(); } });
  API.on('backup', r => { if (r && r.ok) { if (SY.info) SY.info.lastBackupAt = r.at; } else if (r) toast('Automatic backup failed: ' + r.message, 'err'); });
  API.on('menu', m => desktopMenu(m && m.action));
}
