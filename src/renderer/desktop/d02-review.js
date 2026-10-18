/* ---------- desktop: reviewing conflicts, rejected changes and changes kept from an earlier session ---------- */
const FIELD_SKIP = new Set(['id']);
const FIELD_LABEL = { name: 'Name', code: 'Code', status: 'Status', priority: 'Priority', due: 'Due date', start: 'Start date', end: 'End date', notes: 'Notes', assignedToId: 'Assignee', ownerId: 'Responsible', pmId: 'Project manager',
  projectId: 'Project', deliverableId: 'Deliverable', phaseId: 'Phase', serviceId: 'Discipline', source: 'Source', links: 'Links', client: 'Client', description: 'Description', updatedAt: 'Last changed', completedAt: 'Completed', hours: 'Hours', capacity: 'Weekly capacity' };
function fieldValue(k, v) {
  if (typeof v === 'string' && v) {
    if (/^(assignedToId|ownerId|pmId|personId)$/.test(k)) { const p = person(v); if (p) return esc(p.name); }
    if (k === 'projectId') { const p = project(v); if (p) return esc(p.code + ' ' + p.name); }
    if (k === 'phaseId') { const g = phase(v); if (g) return esc(g.name); }
    if (k === 'deliverableId') { const d = S.deliverables.find(x => x.id === v); if (d) return esc(d.name); }
    if (k === 'serviceId') { const x = S.services.find(y => y.id === v); if (x) return esc(x.name); }
    if (/At$/.test(k) && !isNaN(Date.parse(v))) return esc(fmtStamp(v));
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return esc(fmt(v));
  }
  return fieldText(v);
}
function fieldText(v) {
  if (v === undefined || v === null || v === '') return '<span class="muted">—</span>';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') { const s = JSON.stringify(v); return `<span class="mono" style="font-size:11.5px">${esc(s.length > 160 ? s.slice(0, 157) + '…' : s)}</span>`; }
  const s = String(v); return esc(s.length > 200 ? s.slice(0, 197) + '…' : s);
}
function recordTitle(coll, data) {
  const lbl = MS.recordLabel(coll, data || {});
  if (data && data.projectId && (coll === 'tasks' || coll === 'deliverables')) { const p = project(data.projectId); if (p) return `${lbl} <span class="muted">(${esc(p.code)})</span>`; }
  return esc(lbl);
}
function diffRows(mine, cur) {
  const keys = [...new Set([...Object.keys(mine || {}), ...Object.keys(cur || {})])].filter(k => !FIELD_SKIP.has(k) && MS.canon(mine ? mine[k] : undefined) !== MS.canon(cur ? cur[k] : undefined));
  if (!keys.length) return '<p class="hint">No field differs.</p>';
  return `<table class="tbl cf-tbl"><thead><tr><th>Field</th><th>Your version</th><th>Current version</th></tr></thead><tbody>${keys.map(k => `<tr><td>${esc(FIELD_LABEL[k] || k)}</td><td>${fieldValue(k, mine ? mine[k] : undefined)}</td><td>${fieldValue(k, cur ? cur[k] : undefined)}</td></tr>`).join('')}</tbody></table>`;
}

function openConflicts() {
  const list = SY.conflicts || []; if (!list.length) { SY.conflicts = null; setState('saved'); flush(); return; }
  const items = list.map((c, i) => {
    const mine = localGet(c.coll, c.id), cur = c.current;
    const what = !cur ? 'It no longer exists in the workspace.' : cur.deleted ? `It was <b>deleted</b>${cur.updatedBy ? ` by ${esc(cur.updatedBy)}` : ''}${cur.updatedAt ? ` at ${esc(fmtStamp(cur.updatedAt))}` : ''}.` : `It was changed${cur.updatedBy ? ` by <b>${esc(cur.updatedBy)}</b>` : ''}${cur.updatedAt ? ` at ${esc(fmtStamp(cur.updatedAt))}` : ''} after you started editing.`;
    const youDeleted = mine == null;
    return `<section class="cf-item"><h3>${recordTitle(c.coll, mine || (cur && cur.data))}</h3><p class="note">${what}${youDeleted ? ' You deleted it.' : ''}</p>
      ${!youDeleted && cur && !cur.deleted ? diffRows(mine, cur.data) : ''}
      <div class="cf-choice" role="radiogroup" aria-label="Which version to keep">
        <label class="chk"><input type="radio" name="cf-${i}" value="mine" checked> ${youDeleted ? 'Delete it anyway' : cur && cur.deleted ? 'Keep it (restore it with my version)' : 'Keep my version (save it on top of the current one)'}</label>
        <label class="chk"><input type="radio" name="cf-${i}" value="theirs"> ${cur && !cur.deleted ? 'Use the current version (discard my change)' : youDeleted ? 'Keep it deleted' : 'Accept the deletion (discard my change)'}</label>
      </div></section>`;
  }).join('');
  openModal(`<div class="m-head"><div><div class="eyebrow">Not saved yet</div><h2>${list.length === 1 ? 'Someone else changed this item' : `${list.length} items were changed by someone else`}</h2></div></div>
    <p>Your change is kept on this computer and nothing has been overwritten. Review the current version and choose what to keep for each item. Your other changes are saved once this is resolved.</p>
    <div class="cf-list">${items}</div>
    <div class="m-actions"><button class="btn ghost" data-dact="conflicts-later">Decide later</button><button class="btn primary" data-dact="conflicts-apply">Apply and save</button></div>`, { wide: true, focus: '[data-dact=conflicts-apply]' });
}
function applyConflictChoices() {
  const list = SY.conflicts || [];
  list.forEach((c, i) => {
    const el = modalRoot.querySelector(`input[name="cf-${i}"]:checked`); const choice = el ? el.value : 'mine';
    const k = SKEY(c.coll, c.id), cur = c.current, b = SY.base.get(k);
    if (choice === 'mine') {
      if (!cur) SY.base.delete(k);
      else SY.base.set(k, { v: cur.v, j: cur.deleted ? null : MS.canon(cur.data), pos: b && b.pos });
    } else {
      if (cur && !cur.deleted) { localPut(c.coll, c.id, cur.data); SY.base.set(k, { v: cur.v, j: MS.canon(cur.data), pos: b && b.pos }); }
      else { if (MS.isColl(c.coll)) localDel(c.coll, c.id); if (cur) SY.base.set(k, { v: cur.v, j: null }); else SY.base.delete(k); }
    }
  });
  MS.COLLECTIONS.forEach(resort);
  SY.conflicts = null; closeModal(true); setState('saved'); render(); save();
}

function openRejected() {
  const r = SY.rejected; if (!r) return;
  const keys = (r.keys || []).filter(k => k && k.coll);
  openModal(`<div class="m-head"><div><div class="eyebrow">Not saved</div><h2>${r.kind === 'forbidden' ? 'You can’t change this' : r.kind === 'missing-parent' ? 'The project no longer exists' : 'This change was refused'}</h2></div></div>
    <p>${esc(r.message || 'The workspace refused the change.')}</p>
    ${keys.length ? `<ul class="isslist">${keys.slice(0, 12).map(k => `<li>${recordTitle(k.coll, localGet(k.coll, k.id) || k.data)}</li>`).join('')}${keys.length > 12 ? `<li>…and ${keys.length - 12} more</li>` : ''}</ul>` : ''}
    <p class="note">Discarding puts back the version last saved in the workspace for ${keys.length ? 'these items' : 'every unsaved change'}. Your other changes are then saved.</p>
    <div class="m-actions"><button class="btn ghost" data-dact="modal-close">Keep for now</button><button class="btn primary" data-dact="rejected-discard">Discard ${keys.length ? 'these changes' : 'unsaved changes'}</button></div>`, { focus: '[data-dact=rejected-discard]' });
}
function discardRejected() {
  const r = SY.rejected || {}; const keys = (r.keys || []).filter(k => k && k.coll);
  if (keys.length) { keys.forEach(k => revertKey(SKEY(k.coll, k.id))); MS.COLLECTIONS.forEach(resort); }
  else revertAll();
  SY.rejected = null; SY.error = null; closeModal(true); setState('saved'); render(); save();
  toast('The refused changes were discarded');
}
async function discardUnsaved() {
  const n = unsavedCount();
  if (!await confirmBox('Discard unsaved changes?', `${plural(n, 'change')} made on this computer and not saved in the workspace will be lost. The information shown goes back to the last version received.`, 'Discard changes')) return;
  revertAll(); render(); setState(SY.conn && SY.conn.state === 'offline' ? 'offline' : 'saved'); toast('Unsaved changes discarded');
}

/* Changes left unsaved when Flowlace closed (disconnection, conflict, error) are offered again, never applied silently. */
async function offerPending() {
  const r = await API.data.loadPending(); const p = r && r.data;
  if (!p || (!p.records || !p.records.length) && !p.inflight) return;
  const recs = p.records || [];
  const ok = await choiceBox('Unsaved changes from your last session', `<p>When Flowlace closed on ${esc(fmtStamp(p.savedAt))}, ${plural(recs.length, 'change')} had not been saved in this workspace${p.inflight ? ' (one save was being sent; it is checked so it is never applied twice)' : ''}.</p>
    ${recs.length ? `<ul class="isslist">${recs.slice(0, 10).map(x => `<li>${x.deleted ? 'Deleted: ' : ''}${recordTitle(x.coll, x.data || localGet(x.coll, x.id))}</li>`).join('')}${recs.length > 10 ? `<li>…and ${recs.length - 10} more</li>` : ''}</ul>` : ''}
    <p>Saving them checks each item against its current version: anything changed by someone else since then is shown for review first.</p>`, [{ v: 'save', l: 'Review and save them', c: 'primary' }]);
  if (ok !== 'save') { if (await confirmBox('Discard the unsaved changes?', 'They will be removed from this computer. The workspace is not changed.', 'Discard')) API.data.savePending(null); else offerLater(); return; }
  if (p.inflight && p.inflight.opId && Array.isArray(p.inflight.ops)) {
    // resend the interrupted save with its original id: the workspace applies it at most once
    const res = await API.data.commit({ opId: p.inflight.opId, ops: p.inflight.ops });
    if (res.ok) { const sent = new Map(); p.inflight.ops.forEach(o => { if (o.type === 'put') { sent.set(SKEY(o.coll, o.id), MS.canon(o.data)); localPut(o.coll, o.id, o.data); } else if (o.type === 'del') localDel(o.coll, o.id); }); applyAck({ sent }, res); }
  }
  for (const x of recs) {
    const k = SKEY(x.coll, x.id), b = SY.base.get(k);
    if (x.deleted) localDel(x.coll, x.id); else localPut(x.coll, x.id, x.data);
    // keep the version the change was made from, so a newer version in the workspace is reported as a conflict
    if (b) b.v = Math.min(b.v, x.base); else if (x.base > 0) SY.base.set(k, { v: x.base, j: null });
  }
  MS.COLLECTIONS.forEach(resort);
  render(); save();
}
function offerLater() { toast('Unsaved changes are kept on this computer and offered again next time.'); }

/* Sign in again (Company) without losing anything on screen. */
let signInOpen = false;
function askSignIn() {
  if (signInOpen || SY.mode !== 'company' || !SY.ws) return;
  signInOpen = true;
  openModal(`<form data-dform="resign"><div class="m-head"><div><div class="eyebrow">${esc(SY.ws.url)}</div><h2>Sign in to continue</h2></div></div>
    <p>Your session ended. Sign in again to keep saving; nothing on screen is lost.</p>
    <div class="fgrid">${fld('User name', `<input class="in" name="username" value="${esc(SY.ws.username || (SY.user && SY.user.username) || '')}" autocomplete="username" required>`)}${fld('Password', `<input class="in" type="password" name="password" autocomplete="current-password" required>`)}</div>
    <p class="err" id="resign-err" role="alert"></p>
    <div class="m-actions"><button type="button" class="btn ghost" data-dact="resign-later">Later</button><button class="btn primary">Sign in</button></div></form>`, { focus: 'input[name=password]' });
}
async function submitResign(form) {
  const F = form.elements, err = document.getElementById('resign-err');
  err.textContent = 'Signing in…';
  const r = await API.workspace.signIn(SY.ws.url, F.username.value.trim(), F.password.value);
  if (!r.ok) { err.textContent = r.message || 'Sign-in failed.'; return; }
  signInOpen = false; closeModal(true); toast('Signed in');
}

function fmtStamp(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return String(iso); const p = n => String(n).padStart(2, '0'); return `${fmt(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} ${hhmm(d)}`; }
