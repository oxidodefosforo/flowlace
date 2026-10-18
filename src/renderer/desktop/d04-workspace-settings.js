/* ---------- desktop: Settings → Workspace & Storage, backups, migration from the HTML version, users ---------- */
const WSD = { info: null, backups: null, activity: null, users: null, at: 0, loading: false, test: null };
const isCompany = () => SY.mode === 'company';
const canAdmin = () => !isCompany() || SY.isAdmin;

async function refreshWSD(force) {
  if (WSD.loading || (!force && Date.now() - WSD.at < 2500)) return;
  WSD.loading = true;
  try {
    const [i, b, a, u] = await Promise.all([
      API.workspace.info(), canAdmin() ? API.backup.list() : Promise.resolve(null), API.data.activity(30),
      isCompany() && SY.isAdmin ? API.admin.users() : Promise.resolve(null)]);
    if (i && i.ok) { WSD.info = i; if (i.user) { SY.user = i.user; SY.isAdmin = !isCompany() || i.user.role === 'admin'; } if (i.info && SY.ws) SY.ws.name = i.info.name; }
    WSD.backups = b && b.ok ? b : null; WSD.activity = a && a.ok ? a.activity : WSD.activity; WSD.users = u && u.ok ? u.users : null;
  } finally { WSD.loading = false; WSD.at = Date.now(); }
  if (ui.view === 'settings' && ui.stab === 'data' && !userIsBusy()) render();
}

/* Settings tabs: same as the web version, “Data & backup” becomes “Workspace & Storage”. In a Company workspace,
   company settings are shown read-only to members (the server refuses those changes anyway). */
function renderSettings() {
  const tab = ui.stab || 'phases';
  let h = `<div class="pagehead"><h1>Settings</h1></div><div class="tabs" role="tablist">${[['phases', 'Phases & milestones'], ['defaults', 'Project defaults'], ['people', 'People'], ['workflow', 'Company workflow'], ['brand', 'Company & appearance'], ['data', 'Workspace & Storage']].map(([v, l]) => `<button role="tab" data-act="stab" data-v="${v}" aria-selected="${tab === v}">${esc(l)}</button>`).join('')}</div>`;
  if (tab === 'data') return h + settingsData();
  const ro = !SY.isAdmin && ['phases', 'defaults', 'workflow', 'brand'].includes(tab);
  const note = ro ? `<p class="notice ro-note">Only administrators of this Company workspace can change ${tab === 'brand' ? 'the company details and logo (your appearance choice below is personal)' : 'these company settings'}. You can view them here.</p>` : '';
  if (tab === 'brand') { let b = settingsBrand(); if (ro) b = b.replace('<section class="panelbox"><h2>Company</h2>', '<section class="panelbox ro-box" inert><h2>Company</h2>').replace('<section class="panelbox"><h2>Company logo</h2>', '<section class="panelbox ro-box" inert><h2>Company logo</h2>'); return h + note + b; }
  const inner = tab === 'defaults' ? settingsDefaults() : tab === 'people' ? settingsPeople() : tab === 'workflow' ? settingsWorkflow() : settingsPhases();
  return h + note + (ro ? `<div class="ro-box" inert>${inner}</div>` : inner);
}

function settingsData() {
  setTimeout(() => refreshWSD(), 0);
  const ws = SY.ws || {}, I = WSD.info && WSD.info.info, company = isCompany();
  const conn = company ? ({ connected: '<span class="ok-t">● Connected</span>', connecting: 'Connecting…', offline: '<span class="od">● Disconnected</span>', auth: '<span class="od">Signed out — sign in to save</span>' }[SY.conn && SY.conn.state] || '—') : '<span class="ok-t">● Open on this computer</span>';
  const last = I && I.backup && I.backup.lastAt;
  const counts = I ? `${I.counts.projects || 0} projects · ${I.counts.deliverables || 0} deliverables · ${I.counts.tasks || 0} tasks · ${I.counts.people || 0} people` : '';
  const userLine = company && SY.user ? `${esc(SY.user.name)} <span class="muted">(${esc(SY.user.username || '')} · ${SY.user.role === 'admin' ? 'administrator' : 'member'})</span>` : `${esc(SY.user ? SY.user.name : '')} <span class="muted">(this computer)</span>`;
  let h = `<div class="sgrid ws-grid"><section class="panelbox"><h2>Workspace</h2>
    <dl class="defl ws-dl">
      <dt>Name</dt><dd><b>${esc(ws.name || '')}</b> ${canAdmin() ? '<button class="btn sm ghost" data-dact="ws-rename">Rename…</button>' : ''}</dd>
      <dt>Identifier</dt><dd class="mono">${esc(ws.id || '')}</dd>
      <dt>Mode</dt><dd>${company ? '<span class="chip c-a">Company</span> shared through Flowlace Server' : '<span class="chip c-n">Local</span> only on this computer'}</dd>
      ${company ? `<dt>Server</dt><dd class="mono">${esc(ws.url || '')}${ws.url && !/^https:/i.test(ws.url) ? ' <span class="od">(not encrypted)</span>' : ''}</dd>` : `<dt>Folder</dt><dd class="mono">${esc(ws.folder || '')} <button class="btn sm ghost" data-dact="ws-show">Show in Explorer</button></dd><dt>Database</dt><dd class="mono">${esc(ws.dbFile || '')}</dd>`}
      <dt>User</dt><dd>${userLine}</dd>
      <dt>Connection</dt><dd>${conn}${SY.conn && SY.conn.error && SY.conn.state !== 'connected' && company ? `<div class="hint">${esc(SY.conn.error)}</div>` : ''}</dd>
      <dt>Saving</dt><dd>${esc(saveText())}${SY.error && SY.state !== 'saved' ? `<div class="hint od">${esc(SY.error)}</div>` : ''}${unsavedCount() ? `<div class="hint">${plural(unsavedCount(), 'change')} not saved yet</div>` : ''}</dd>
      <dt>Last backup</dt><dd>${last ? esc(fmtStamp(last)) : '<span class="od">Never</span>'}</dd>
      ${counts ? `<dt>Contents</dt><dd>${counts}</dd>` : ''}
    </dl>
    ${WSD.test ? `<p class="${WSD.test.ok ? 'note' : 'od'}" role="status">${esc(WSD.test.text)}</p>` : ''}
    <div class="data-actions"><button class="btn" data-dact="ws-switch">Create or open another workspace…</button><button class="btn ghost" data-dact="ws-test">Test connection</button>${company ? '<button class="btn ghost" data-dact="pw-change">Change my password…</button><button class="btn ghost" data-dact="sign-out">Sign out</button>' : '<button class="btn ghost" data-dact="ws-move">Move this workspace to another folder…</button>'}</div>
    <p class="hint" style="margin-top:8px"><b>Opening</b> another workspace only changes which one Flowlace shows; nothing is copied, replaced or merged. <b>Moving</b>${company ? ' a Company workspace is done by the server administrator.' : ' copies this workspace to a new folder, checks the copy and switches to it; the old folder is left as it was.'}</p></section>`;

  /* backups */
  const B = I && I.backup;
  h += `<section class="panelbox"><h2>Backups</h2>`;
  if (!canAdmin()) h += `<p class="note">Backups of this Company workspace are made on the server and managed by its administrators.</p><p>Last backup: <b>${last ? esc(fmtStamp(last)) : 'never'}</b></p>`;
  else {
    const every = B ? B.everyHours : 24;
    h += `<p class="note" style="margin:0 0 8px">A backup is a consistent copy of the whole workspace database taken while it is in use. ${company ? 'It is made by the server, in its backup folder.' : 'Keep it on another disk or a network folder to protect against losing this computer.'}</p>
      <dl class="defl ws-dl"><dt>Backup folder</dt><dd class="mono">${esc(B ? (B.dir || '') : '')}${company ? ' <span class="muted">(on the server)</span>' : ''}</dd>
        ${!company ? `<dt>Workspace data</dt><dd class="mono">${esc(ws.folder || '')} <span class="muted">(the active database — different from the backup folder)</span></dd>` : ''}</dl>
      ${!company ? `<div class="data-actions"><button class="btn sm" data-dact="bk-dir">Change backup folder…</button>${B && B.dir && B.defaultDir && B.dir !== B.defaultDir ? '<button class="btn sm ghost" data-dact="bk-dir-reset">Use the default folder</button>' : ''}</div>` : ''}
      <div class="fgrid" style="margin-top:10px">${fld('Automatic backup', `<select class="in" data-dchg="bk-every">${[[0, 'Off'], [6, 'Every 6 hours'], [12, 'Every 12 hours'], [24, 'Every day'], [168, 'Every week']].map(([v, l]) => `<option value="${v}"${+every === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}${fld('Keep the last', `<div style="display:flex;gap:6px;align-items:center"><input class="in" type="number" min="1" max="1000" value="${B ? B.keep : 14}" data-dchg="bk-keep" style="max-width:90px"> backups</div>`)}</div>
      ${!company ? '<p class="hint">Automatic backups run while Flowlace is open.</p>' : ''}
      ${B && B.lastError ? `<p class="od" style="font-size:12.5px">Last automatic backup failed: ${esc(B.lastError)}</p>` : ''}
      <div class="data-actions" style="margin-top:8px"><button class="btn primary" data-dact="bk-now">Back up now</button>${!company ? '<button class="btn" data-dact="bk-restore-file">Restore from a file…</button>' : ''}</div>`;
    const list = WSD.backups && WSD.backups.backups || [];
    h += list.length ? `<div class="twrap" style="margin-top:10px"><table class="tbl bk-tbl"><thead><tr><th>Backup</th><th>Type</th><th>Size</th><th class="act"><span class="sr">Actions</span></th></tr></thead><tbody>${list.slice(0, 12).map(b => `<tr><td><b>${esc(fmtStamp(b.at))}</b><div class="hint mono">${esc(b.name)}</div></td><td>${{ manual: 'Manual', automatic: 'Automatic', 'before-restore': 'Copy before a restore' }[b.kind] || ''}</td><td class="num">${fmtSize(b.size)}</td><td class="act"><button class="btn sm" data-dact="bk-restore" data-name="${esc(b.name)}">Restore…</button></td></tr>`).join('')}</tbody></table></div>${list.length > 12 ? `<p class="hint">${list.length - 12} older backups not shown.</p>` : ''}` : '<p class="hint" style="margin-top:8px">No backups in the backup folder yet.</p>';
  }
  h += `</section>`;

  /* migration + export */
  h += `<section class="panelbox"><h2>Data from the HTML version</h2>
    <p class="note">The HTML version kept its data in the browser, where Flowlace can’t read it. In the HTML version open <b>Settings → Data &amp; backup → Export backup</b> and save the <span class="mono">.json</span> file. Then import it here: the file is checked first, you see a summary, and nothing is duplicated — records already in this workspace are recognised by their identifiers. The file itself is not changed or deleted.</p>
    <div class="data-actions">${canAdmin() ? '<button class="btn primary" data-dact="import-json">Import a JSON export…</button>' : '<span class="hint">Importing into a Company workspace is done by an administrator.</span>'}<button class="btn ghost" data-dact="export-json">Export a JSON copy…</button></div>
    <p class="hint" style="margin-top:6px">A JSON copy is useful to move data between workspaces. For backups use <b>Back up now</b>.</p></section>`;

  /* example data (explicit only) */
  const ex = S.projects.filter(p => p.example).length, exNoDates = S.projects.filter(p => p.example).some(p => ppOf(p.id).every(pp => !pp.start && !pp.end));
  h += `<section class="panelbox"><h2>Example data</h2>${ex ? `<p class="note">${plural(ex, 'example project')} loaded, marked <span class="ex">Example</span>. Removing them also removes their phases, deliverables, tasks, and example people who aren’t used elsewhere.</p><div class="data-actions"><button class="btn" data-act="remove-examples">Remove example data</button>${missingExampleTasks().length ? '<button class="btn ghost" data-act="add-example-tasks">Add example tasks</button>' : ''}${exNoDates ? '<button class="btn ghost" data-act="ex-phases">Add example phase dates</button>' : ''}</div>` : `<p class="note">Example projects are only added when you ask for them, and are marked <span class="ex">Example</span> so they never mix with real data unnoticed.${company ? ' Everyone in this workspace will see them.' : ''}</p><div class="data-actions">${canAdmin() ? '<button class="btn" data-act="load-examples">Load example data</button>' : '<span class="hint">Only administrators can load example data into a Company workspace.</span>'}</div>`}</section>`;

  /* activity */
  const act = WSD.activity || [];
  h += `<section class="panelbox"><h2>Recent changes</h2><p class="note" style="margin:0 0 8px">Who changed what and when, as recorded by the ${company ? 'server' : 'workspace'}.</p>${act.length ? `<ul class="act-list">${act.map(a => `<li><span class="num">${esc(fmtStamp(a.at))}</span> <b>${esc(a.userName || 'Someone')}</b> ${({ create: 'added', update: 'changed', delete: 'deleted', restore: 'restored' })[a.action] || esc(a.action)} <span>${esc(a.label || a.coll)}</span></li>`).join('')}</ul>` : '<p class="muted">No changes recorded yet.</p>'}<div class="data-actions"><button class="btn sm ghost" data-dact="refresh">Refresh</button></div></section>`;

  /* users (Company administrators) */
  if (company && SY.isAdmin) {
    const us = WSD.users || [];
    h += `<section class="panelbox span2"><h2>Users of this server</h2><p class="note" style="margin:0 0 8px"><b>Administrators</b> manage users, company settings, imports, backups and restores. <b>Members</b> work on projects, tasks, deliverables and resources. The server checks these permissions on every change.</p>
      <div class="twrap"><table class="tbl"><thead><tr><th>Name</th><th>User name</th><th>Role</th><th>Active</th><th>Last sign-in</th><th class="act"><span class="sr">Actions</span></th></tr></thead><tbody>${us.map(u => `<tr><td>${esc(u.name)}</td><td class="mono">${esc(u.username)}</td><td><select class="in" data-dchg="user-role" data-id="${esc(u.id)}" aria-label="Role of ${esc(u.name)}"><option value="member"${u.role === 'member' ? ' selected' : ''}>Member</option><option value="admin"${u.role === 'admin' ? ' selected' : ''}>Administrator</option></select></td><td><label class="chk"><input type="checkbox" data-dchg="user-active" data-id="${esc(u.id)}"${u.active ? ' checked' : ''}> ${u.active ? 'Active' : 'Inactive'}</label></td><td class="num">${u.lastLoginAt ? esc(fmtStamp(u.lastLoginAt)) : '—'}</td><td class="act"><button class="btn sm ghost" data-dact="user-reset" data-id="${esc(u.id)}" data-name="${esc(u.name)}">Set password…</button></td></tr>`).join('')}</tbody></table></div>
      <form class="addrow" data-dform="user-add" style="flex-wrap:wrap;gap:6px"><input class="in" name="name" placeholder="Full name" maxlength="80" required style="max-width:200px"><input class="in mono" name="username" placeholder="user name" maxlength="64" required style="max-width:160px"><select class="in" name="role" style="max-width:150px"><option value="member">Member</option><option value="admin">Administrator</option></select><input class="in" type="password" name="password" placeholder="Initial password (10+ characters)" minlength="10" required style="max-width:240px" autocomplete="new-password"><button class="btn">Add user</button></form></section>`;
  }

  /* delete everything */
  if (canAdmin()) h += `<section class="panelbox"><h2>Delete all data</h2><p class="note">Removes every project, deliverable, task and person from this workspace${company ? ' for everyone' : ''}. Back up first if you might need it.</p><div class="data-actions"><button class="btn ghost danger-t" data-act="reset-all">Delete all data…</button></div></section>`;
  return h + '</div>';
}
function infoBox(title, html) { return new Promise(res => { if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(false); } openModal(`<div class="m-head"><div><h2>${title}</h2></div></div><div class="cmsg">${html}</div><div class="m-actions"><button class="btn primary" data-act="cf-no">Close</button></div>`, { focus: '[data-act=cf-no]' }); confirmResolve = res; }); }
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

/* ----- actions ----- */
async function beforeLeaving(what) {
  if (SY.inflight || SY.timer) { await waitIdle(4000); }
  const n = unsavedCount();
  if (!n) return true;
  const ok = await confirmBox('Some changes are not saved', `${plural(n, 'change')} ${n === 1 ? 'has' : 'have'} not been saved in this workspace yet (${esc(saveText())}). If you continue to ${what}, they are kept on this computer and offered again when you reopen this workspace.`, 'Continue');
  if (ok) savePendingFile(true);
  return ok;
}
function waitIdle(ms = 8000) { return new Promise(res => { const t0 = Date.now(); const k = setInterval(() => { if ((!SY.inflight && !SY.timer && !SY.dirty) || Date.now() - t0 > ms) { clearInterval(k); res(!SY.inflight && !SY.timer); } }, 60); }); }
function busyModal(title, text) { openModal(`<div class="m-head"><div><h2>${esc(title)}</h2></div></div><p class="busy-p"><span class="spin" aria-hidden="true"></span> ${esc(text)}</p>`); }

async function wsAct(a) {
  const act = a.dataset.dact;
  switch (act) {
    case 'save-status': if (['saved', 'saving'].includes(SY.state)) { go('settings'); ui.stab = 'data'; prefs.stab = 'data'; render(); } else retrySave(); return;
    case 'retry': retrySave(); return;
    case 'discard-unsaved': discardUnsaved(); return;
    case 'sign-in': askSignIn(); return;
    case 'resign-later': signInOpen = false; closeModal(true); return;
    case 'conflicts': openConflicts(); return;
    case 'conflicts-apply': applyConflictChoices(); return;
    case 'conflicts-later': closeModal(true); updateBanner(); return;
    case 'rejected': openRejected(); return;
    case 'rejected-discard': discardRejected(); return;
    case 'modal-close': closeModal(); return;
    case 'reload': API.workspace.reload(); return;
    case 'refresh': refreshWSD(true); return;
    case 'ws-switch': { if (!await beforeLeaving('open another workspace')) return; const st = await API.workspace.status(); showStart(st, { overlay: true, step: 'home' }); return; }
    case 'ws-show': API.workspace.showFolder(); return;
    case 'ws-test': {
      WSD.test = { ok: true, text: 'Testing…' }; render();
      const r = await API.workspace.testConnection();
      WSD.test = r.ok ? { ok: true, text: r.mode === 'local' ? r.message : `Connected to ${r.server.serverName} (version ${r.server.version}) in ${r.ms} ms${r.https ? ' over HTTPS' : ' — not encrypted (HTTP)'}; signed in as ${r.user ? r.user.name : '—'}.` } : { ok: false, text: r.message || 'The test failed.' };
      render(); return;
    }
    case 'ws-rename': {
      const cur = SY.ws ? SY.ws.name : '';
      openModal(`<form data-dform="ws-rename"><div class="m-head"><div><h2>Rename workspace</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>${fld('Name', `<input class="in" name="name" value="${esc(cur)}" maxlength="120" required>`)}<p class="hint">Only the name changes; the identifier, the data and its location stay the same.</p><div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Rename</button></div></form>`, { focus: 'input[name=name]' });
      return;
    }
    case 'ws-move': {
      if (!await confirmBox('Move this workspace?', `Flowlace copies the workspace (a consistent copy, like a backup) to the folder you choose, checks the copy and then uses it. The current folder <span class="mono">${esc(SY.ws.folder)}</span> is <b>not deleted</b>: it is marked as moved, so it isn’t opened by mistake. Choose an empty folder on this computer.`, 'Choose the new folder…')) return;
      if (!await beforeLeaving('move the workspace')) return;
      const p = await API.workspace.pickFolder('move'); if (!p.ok) return;
      busyModal('Moving the workspace', 'Copying and checking…');
      const r = await API.workspace.moveLocal(p.ref);
      if (!r.ok) { closeModal(true); toast(r.message || 'The workspace could not be moved.', 'err'); return; }
      sessionStorageSafe('ms-toast', `Workspace moved to ${r.to}. The old folder was left as it was.`);
      API.workspace.reload(); return;
    }
    case 'pw-change':
      openModal(`<form data-dform="pw"><div class="m-head"><div><h2>Change my password</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div><div class="fgrid">${fld('Current password', '<input class="in" type="password" name="current" autocomplete="current-password" required>')}${fld('New password', '<input class="in" type="password" name="password" minlength="10" autocomplete="new-password" required>')}${fld('Repeat the new password', '<input class="in" type="password" name="password2" minlength="10" autocomplete="new-password" required>')}</div><p class="err" id="pw-err" role="alert"></p><div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Change password</button></div></form>`, { focus: 'input[name=current]' });
      return;
    case 'sign-out': {
      if (!await beforeLeaving('sign out')) return;
      if (!await confirmBox('Sign out?', 'You will need your password to open this Company workspace again on this computer.', 'Sign out')) return;
      await API.account.signOut(); API.workspace.reload(); return;
    }
    case 'bk-now': {
      busyModal('Backing up', 'Making a consistent copy of the workspace…');
      const r = await API.backup.now(); closeModal(true);
      if (r.ok) toast(`Backup saved: ${r.name}`); else toast(r.message || 'The backup failed.', 'err');
      refreshWSD(true); return;
    }
    case 'bk-dir': { const r = await API.backup.pickDir(); if (r.ok) { toast('Backup folder changed'); refreshWSD(true); } else if (r.kind !== 'cancelled') toast(r.message, 'err'); return; }
    case 'bk-dir-reset': { const r = await API.backup.resetDir(); if (r.ok) refreshWSD(true); return; }
    case 'bk-restore': restoreFlow({ name: a.dataset.name }); return;
    case 'bk-restore-file': { const f = await API.backup.pickFile(); if (f.ok) restoreFlow({ ref: f.ref, label: f.name }); else if (f.kind !== 'cancelled') toast(f.message, 'err'); return; }
    case 'import-json': importFromFile(); return;
    case 'export-json': exportData(); return;
    case 'user-reset':
      openModal(`<form data-dform="user-pw" data-id="${esc(a.dataset.id)}"><div class="m-head"><div><h2>Set a password for ${esc(a.dataset.name)}</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>${fld('New password', '<input class="in" type="password" name="password" minlength="10" autocomplete="new-password" required>')}<p class="hint">Their open sessions are closed; tell them the new password in person.</p><p class="err" id="upw-err" role="alert"></p><div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Set password</button></div></form>`, { focus: 'input[name=password]' });
      return;
  }
}

async function wsForm(form) {
  const k = form.dataset.dform, F = form.elements;
  if (k === 'resign') return submitResign(form);
  if (k === 'ws-rename') { const r = await API.workspace.rename(F.name.value.trim()); if (!r.ok) { toast(r.message, 'err'); return; } if (SY.ws) SY.ws.name = r.name; closeModal(true); toast('Workspace renamed'); refreshWSD(true); render(); return; }
  if (k === 'pw') {
    const err = document.getElementById('pw-err');
    if (F.password.value !== F.password2.value) { err.textContent = 'The new passwords are different.'; return; }
    const r = await API.account.changePassword(F.current.value, F.password.value);
    if (!r.ok) { err.textContent = r.message; return; }
    closeModal(true); toast('Password changed'); return;
  }
  if (k === 'user-add') {
    const r = await API.admin.createUser({ name: F.name.value.trim(), username: F.username.value.trim(), role: F.role.value, password: F.password.value });
    if (!r.ok) { toast(r.message, 'err'); return; }
    toast(`User ${r.user.username} added`); refreshWSD(true); return;
  }
  if (k === 'user-pw') {
    const r = await API.admin.updateUser(form.dataset.id, { password: F.password.value });
    if (!r.ok) { document.getElementById('upw-err').textContent = r.message; return; }
    closeModal(true); toast('Password set'); return;
  }
}

const IMP = { replace: false };
/* the hidden creation number (seq) is renumbered by the workspace when two records share it: not a real difference */
function sameButSeq(j, it) { if (!('seq' in it)) return false; const a = JSON.parse(j); delete a.seq; const b = Object.assign({}, it); delete b.seq; return MS.canon(a) === MS.canon(b); }
async function wsChange(el) {
  const k = el.dataset.dchg;
  if (k === 'imp-diff') { IMP.replace = el.value === 'replace' && el.checked; return; }
  if (k === 'bk-every' || k === 'bk-keep') {
    const s = k === 'bk-every' ? { everyHours: +el.value } : { keep: parseInt(el.value, 10) };
    const r = await API.backup.settings(s);
    if (!r.ok) { toast(r.message, 'err'); refreshWSD(true); return; }
    toast('Backup settings saved'); refreshWSD(true); return;
  }
  if (k === 'user-role' || k === 'user-active') {
    const patch = k === 'user-role' ? { role: el.value } : { active: el.checked };
    const r = await API.admin.updateUser(el.dataset.id, patch);
    if (!r.ok) toast(r.message, 'err'); else toast('User updated');
    refreshWSD(true);
  }
}

async function restoreFlow(ref) {
  busyModal('Checking the backup', 'Verifying the file…');
  const c = await API.backup.inspect(ref.ref ? { ref: ref.ref } : { name: ref.name });
  closeModal(true);
  if (!c.ok) { await infoBox('This backup can’t be used', `<p>${esc(c.message || 'The file could not be checked.')}</p><p>Nothing was changed.</p>`); return; }
  const cnt = c.counts || {};
  const ok = await confirmBox('Restore this backup?', `<b>${esc(c.workspaceName || '')}</b>${c.takenAt ? `, taken ${esc(fmtStamp(c.takenAt))}` : ''}: ${cnt.projects || 0} projects, ${cnt.deliverables || 0} deliverables, ${cnt.tasks || 0} tasks, ${cnt.people || 0} people.<br><br>All current data in this workspace is replaced by the backup. A copy of the current data is saved first in the backup folder, so this can be undone by restoring that copy.${isCompany() ? ' Everyone connected is reloaded.' : ''}`, 'Replace with this backup');
  if (!ok) return;
  if (!await beforeLeaving('restore the backup')) return;
  busyModal('Restoring', 'Saving a copy of the current data and restoring the backup…');
  const r = await API.backup.restore(ref.ref ? { ref: ref.ref } : { name: ref.name });
  if (!r.ok) { closeModal(true); toast(r.message || 'The restore failed. Nothing was changed.', 'err'); return; }
  sessionStorageSafe('ms-toast', `Backup restored. The previous data was saved as ${r.preRestore}.`);
  API.workspace.reload();
}

/* JSON copy of the current data, in the format of the HTML version's backups. */
function exportData() {
  const json = JSON.stringify({ app: 'alphazeta-project-planner', version: 4, exportedAt: new Date().toISOString(), workspace: SY.ws ? { id: SY.ws.id, name: SY.ws.name } : null, data: S }, null, 2);
  const name = `${(String(SY.ws && SY.ws.name || 'flowlace').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flowlace')}-export-${dn2iso(todayDN())}.json`;
  API.files.saveText(name, json).then(r => { if (r.ok) toast(`Saved ${r.name}`); else if (r.kind !== 'cancelled') toast(r.message || 'The file could not be saved.', 'err'); });
}

async function importFromFile() {
  const f = await API.files.openJSON();
  if (!f.ok) { if (f.kind !== 'cancelled') toast(f.message, 'err'); return; }
  importText(f.text, f);
}

/* Imports a JSON export (HTML version or another workspace) into this workspace: validated, summarised, applied in
   one transaction, without duplicates (same identifier = same record) and without deleting anything. */
async function importText(text, src) {
  if (!canAdmin()) { toast('Only administrators can import into a Company workspace.', 'err'); return false; }
  let obj; try { obj = JSON.parse(text); } catch (e) { await infoBox('This file can’t be imported', '<p>It is not valid JSON. Export the backup again from the HTML version (Settings → Data &amp; backup → Export backup).</p>'); return false; }
  const d = obj && obj.data ? obj.data : obj;
  const problem = !d || typeof d !== 'object' ? 'It is empty.' : !Array.isArray(d.projects) || !Array.isArray(d.deliverables) || !Array.isArray(d.phases) ? 'Projects, deliverables or phases are missing: it doesn’t look like a Flowlace export.' : d.tasks != null && !Array.isArray(d.tasks) ? 'The task list is damaged.' : null;
  if (problem) { await infoBox('This file can’t be imported', `<p>${problem}</p><p>Nothing was changed.</p>`); return false; }
  if (SY.inflight || SY.timer || unsavedCount()) { await waitIdle(5000); if (unsavedCount()) { toast('Wait until your current changes are saved, then import.', 'err'); return false; } }
  const iss = relIssues(d);
  const nd = normalize(JSON.parse(JSON.stringify(d)));
  const rows = [], plan = [];
  const LBL = { people: 'People', phases: 'Phases', services: 'Disciplines', projects: 'Projects', deliverables: 'Deliverables', tasks: 'Tasks', projectPhases: 'Project phases', projectTeams: 'Project teams', assignments: 'Planned hours', capacityOverrides: 'Capacity changes' };
  let nNew = 0, nSame = 0, nDiff = 0;
  for (const c of MS.COLLECTIONS) {
    let a = 0, s = 0, df = 0;
    for (const it of nd[c] || []) {
      const b = SY.base.get(SKEY(c, it.id));
      if (!b || b.j === null) { a++; plan.push({ c, it, kind: 'new' }); }
      else if (b.j === MS.canon(it) || sameButSeq(b.j, it)) s++;
      else { df++; plan.push({ c, it, kind: 'diff' }); }
    }
    if (a + s + df) rows.push(`<tr><td>${LBL[c] || c}</td><td class="num">${a}</td><td class="num">${s}</td><td class="num">${df}</td></tr>`);
    nNew += a; nSame += s; nDiff += df;
  }
  const singles = MS.SINGLETONS.filter(c => d[c] != null && nd[c] != null);
  const singlePlan = [];
  // an empty workflow standard (a new workspace has one) is simply filled from the file
  const blank = (c, v) => v == null || (c === 'workflow' && !(v.steps || []).length) || (c === 'workflowDraft' && !(v.steps || []).length);
  for (const c of singles) { const b = SY.base.get(SKEY(c, MS.SINGLETON_ID)); const j = MS.canon(nd[c]); if (!b || b.j === null || blank(c, JSON.parse(b.j))) { if (!b || b.j !== j) singlePlan.push({ c, kind: 'new' }); } else if (b.j !== j) singlePlan.push({ c, kind: 'diff' }); }
  // a workspace without projects only has the standard configuration: the file's version is suggested
  const fresh = !S.projects.some(p => SY.base.has(SKEY('projects', p.id)));
  const pv = (Array.isArray(d.views) ? d.views : []).filter(v => v && v.id && !(S.views || []).some(x => x.id === v.id));
  const pf = (Array.isArray(d.favorites) ? d.favorites : []).filter(v => v && v.id && !(S.favorites || []).some(x => x.id === v.id));
  if (!nNew && !nDiff && !singlePlan.length && !pv.length && !pf.length) {
    await infoBox('Nothing to import', `<p>Everything in <span class="mono">${esc(src && src.name || 'the file')}</span> is already in this workspace (${plural(nSame, 'record')} with the same identifiers and content). Nothing was changed.</p>`);
    return false;
  }
  const html = `<p><span class="mono">${esc(src && src.name || 'Pasted text')}</span>${obj.exportedAt ? `, exported ${esc(fmtStamp(obj.exportedAt))}` : ''}${obj.app ? ` from ${obj.app === 'alphazeta-project-planner' ? 'Flowlace' : esc(obj.app)}` : ''}.</p>
    <div class="twrap"><table class="tbl imp-tbl"><thead><tr><th></th><th class="num">New</th><th class="num">Already here</th><th class="num">Different here</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    ${singlePlan.length ? `<p class="note">Settings in the file: ${singlePlan.map(s => `${MS.recordLabel(s.c, null)}${s.kind === 'diff' ? ' (different here)' : ''}`).join(', ')}.</p>` : ''}
    ${pv.length || pf.length ? `<p class="note">${plural(pv.length, 'saved view')} and ${plural(pf.length, 'favorite')} are added to <b>your</b> personal views.</p>` : ''}
    ${iss.length ? `<p class="warnt"><b>${plural(iss.length, 'broken link')} in the file</b> (repaired while importing): ${iss.slice(0, 4).map(esc).join('; ')}${iss.length > 4 ? '…' : ''}</p>` : ''}
    ${nDiff || singlePlan.some(s => s.kind === 'diff') ? `<fieldset class="imp-opt"><legend>Records that exist here with different content</legend><label class="chk block"><input type="radio" name="imp-diff" value="keep" data-dchg="imp-diff"${fresh ? '' : ' checked'}> Keep the version in this workspace${fresh ? '' : ' (recommended)'}</label><label class="chk block"><input type="radio" name="imp-diff" value="replace" data-dchg="imp-diff"${fresh ? ' checked' : ''}> Replace it with the version in the file${fresh ? ' (recommended: this workspace has no projects yet, only the standard phases and disciplines)' : ''}</label></fieldset>` : ''}
    <p class="hint">Records that are only in this workspace are never deleted. Everything is saved in one step: if any part fails, nothing is imported.${isCompany() ? ' Everyone connected sees the result.' : ''}</p>`;
  IMP.replace = fresh;
  const ok = await choiceBox('Import this file?', html, [{ v: 'go', l: 'Import', c: 'primary' }]);
  if (ok !== 'go') return false;
  const replace = IMP.replace;
  const before = JSON.stringify(S);
  let added = 0, replaced = 0;
  for (const p of plan) { if (p.kind === 'new' || replace) { localPut(p.c, p.it.id, p.it); p.kind === 'new' ? added++ : replaced++; } }
  for (const s of singlePlan) if (s.kind === 'new' || replace) S[s.c] = nd[s.c];
  if (pv.length) S.views.push(...pv); if (pf.length) S.favorites.push(...pf);
  // make the merged data consistent the same way the application does on load
  S = normalize(JSON.parse(JSON.stringify(S)));
  if (!S.workflow) S.workflow = emptyStd();
  busyModal('Importing', 'Saving in the workspace…');
  const { ops, sent } = buildOps();
  SY.inflight = { opId: newOpId(), ops, sent }; SY.dirty = false; clearTimeout(SY.timer); SY.timer = null;
  await sendInflight();
  closeModal(true);
  if (SY.state === 'saved') {
    schedulePersonal(); render();
    toast(`Imported: ${plural(added, 'new record')}${replaced ? `, ${replaced} replaced` : ''}${nSame ? `, ${nSame} already here` : ''}`);
    return true;
  }
  if (SY.state === 'failed') {
    // nothing was applied in the workspace (one transaction): go back to what was there before
    S = JSON.parse(before); SY.rejected = null; SY.inflight = null; setState('saved'); render();
    toast('The import failed and nothing was changed: ' + (SY.error || ''), 'err');
  }
  render(); return false;
}

/* Menu bar commands */
function desktopMenu(action) {
  if (!SY.started && action !== 'switch-workspace' && action !== 'about') return;
  if (action === 'switch-workspace') { wsAct({ dataset: { dact: 'ws-switch' } }); return; }
  if (action === 'workspace-settings') { go('settings'); ui.stab = 'data'; prefs.stab = 'data'; render(); return; }
  if (action === 'backup-now') { if (canAdmin()) wsAct({ dataset: { dact: 'bk-now' } }); else toast('Backups of this workspace are managed by the server administrators.'); return; }
  if (action === 'import-json') { importFromFile(); return; }
  if (action === 'export-json') { exportData(); return; }
  if (action === 'about') { API.workspace.status().then(st => openModal(`<div class="m-head"><div><div class="eyebrow">About</div><h2>Flowlace ${esc(st.app ? st.app.version : '')}</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div><p>Projects, deliverables, tasks and resources for Alphazeta Group.</p><p class="note">Settings: <span class="mono">${esc(st.app ? st.app.userData : '')}</span></p><div class="m-actions"><button class="btn primary" data-act="modal-close">Close</button></div>`)); }
}

document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-dact]'); if (a && !a.closest('#ms-start')) { e.preventDefault(); wsAct(a); } });
document.addEventListener('submit', e => { const f = e.target.closest && e.target.closest('form[data-dform]'); if (f) { e.preventDefault(); e.stopPropagation(); wsForm(f); } }, true);
document.addEventListener('change', e => { const el = e.target.closest && e.target.closest('[data-dchg]'); if (el) wsChange(el); });
