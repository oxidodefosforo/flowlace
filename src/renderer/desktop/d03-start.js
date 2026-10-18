/* ---------- desktop: start screen — choose, create, open or connect a workspace ----------
   Shown on first use, when the remembered workspace is not available (nothing is created in its place), and from
   “Switch workspace…”. Opening another location never copies, replaces or merges data. */
const START = { step: 'home', st: null, folder: null, target: null, server: null, url: '', username: '', workspaces: null, busy: false, msg: '', err: '', overlay: false };
const startRoot = () => document.getElementById('ms-start');

function showStart(st, { overlay = false, step } = {}) {
  START.st = st; START.overlay = overlay; START.step = step || (st && st.error ? 'error' : 'home'); START.err = ''; START.msg = '';
  const cur = st && st.entry;
  if (cur && cur.mode === 'company') { START.url = cur.url; START.username = cur.username || ''; }
  if (START.step === 'error' && st.error && st.error.code === 'AUTH' && cur && cur.mode === 'company') START.step = 'signin';
  document.body.classList.add('ms-start-open');
  startRoot().hidden = false;
  renderStart();
}
function hideStart() { startRoot().hidden = true; document.body.classList.remove('ms-start-open'); }

function renderStart() {
  const st = START.st || {}, s = START.step;
  const recent = (st.recent || []).filter(r => r);
  const head = `<div class="st-brand"><img class="logo lg-light" src="${LOGO_LIGHT}" alt=""><img class="logo lg-dark" src="${LOGO_DARK}" alt=""><div><div class="st-name">Flowlace</div><div class="st-sub">Projects, deliverables, tasks and resources</div></div></div>`;
  let body = '';
  const err = START.err ? `<p class="st-err" role="alert">${esc(START.err)}</p>` : '';
  const msg = START.msg ? `<p class="st-msg" role="status">${esc(START.msg)}</p>` : '';
  const back = `<button class="btn ghost" data-sact="home">‹ Back</button>`;
  if (s === 'home') {
    body = `<h1>Choose where your data lives</h1>
      <div class="st-cards">
        <section class="st-card"><div class="st-kind">Local workspace</div><h2>Work on your own</h2>
          <p>Saved in a folder on this computer, in a SQLite database. No server and no internet needed. Choose a folder outside the program folder — updating or reinstalling Flowlace never touches it.</p>
          <div class="st-actions"><button class="btn primary" data-sact="create">Create a workspace…</button><button class="btn" data-sact="open">Open an existing one…</button></div></section>
        <section class="st-card"><div class="st-kind">Company workspace</div><h2>Share it with your team</h2>
          <p>Several people use the same information from their computers. It needs <b>Flowlace Server</b> running on a company server or a computer that stays on. A shared folder or a NAS that only stores files is not enough.</p>
          <div class="st-actions"><button class="btn primary" data-sact="connect">Connect to Flowlace Server…</button></div></section>
      </div>
      ${recent.length ? `<h3 class="st-h3">Recent</h3><ul class="st-recent">${recent.map(r => { const k = recentKey(r); return `<li><button class="plainbtn grow" data-sact="recent" data-key="${esc(k)}"><span class="chip ${r.mode === 'company' ? 'c-a' : 'c-n'}">${r.mode === 'company' ? 'Company' : 'Local'}</span> <b>${esc(r.mode === 'company' ? (r.workspaceName || r.workspaceId) : r.name)}</b> <span class="muted mono">${esc(r.mode === 'company' ? `${r.url} · ${r.username}` : r.folder)}</span></button><button class="iconbtn" data-sact="forget" data-key="${esc(k)}" aria-label="Remove from the list" title="Remove from the list (nothing is deleted)">×</button></li>`; }).join('')}</ul>` : ''}
      ${START.overlay ? '<div class="st-actions" style="margin-top:18px"><button class="btn ghost" data-sact="cancel">Cancel — keep the current workspace</button></div>' : ''}`;
  } else if (s === 'create') {
    body = `${back}<h1>Create a local workspace</h1>
      <form data-sform="create" class="st-form">
        <label class="st-l">Workspace name<input class="in" name="name" maxlength="120" value="${esc(START.name || '')}" placeholder="e.g. Alphazeta projects" required></label>
        <div class="st-l">Folder<div class="st-row"><span class="st-path mono">${START.folder ? esc(START.folder.path) : '<span class="muted">No folder chosen</span>'}</span><button type="button" class="btn" data-sact="pick-create">Choose folder…</button></div></div>
        ${START.target ? `<p class="note">The workspace will be created in <span class="mono">${esc(START.target)}</span>. It starts empty: you can import your data from the HTML version or load example data afterwards.</p>` : '<p class="note">Choose a folder on this computer’s disk (for example in Documents). If the folder isn’t empty, a subfolder with the workspace name is created.</p>'}
        ${err}${msg}<div class="st-actions"><button class="btn primary"${START.folder ? '' : ' disabled'}>Create workspace</button></div></form>`;
  } else if (s === 'connect') {
    const h = START.server;
    body = `${back}<h1>Connect to Flowlace Server</h1>
      <form data-sform="test" class="st-form">
        <label class="st-l">Server address<input class="in mono" name="url" value="${esc(START.url || '')}" placeholder="https://flowlace.company.local:8443" required></label>
        <p class="note">Ask your administrator for the address. The connection is checked with the certificate installed on this computer.</p>
        <div class="st-actions"><button class="btn">Test connection</button></div></form>
      ${h ? `<div class="st-ok">${h.ok ? `<b>✓ ${esc(h.server.serverName || 'Flowlace Server')}</b> · version ${esc(h.server.version)} · ${h.https ? 'HTTPS' : '<span class="od">not encrypted (HTTP)</span>'} · ${h.ms} ms` : `<span class="od">${esc(h.message)}</span>`}</div>` : ''}
      ${h && h.ok ? `<form data-sform="signin" class="st-form"><h2>Sign in</h2>
        <label class="st-l">User name<input class="in" name="username" value="${esc(START.username || '')}" autocomplete="username" required></label>
        <label class="st-l">Password<input class="in" type="password" name="password" autocomplete="current-password" required></label>
        <div class="st-actions"><button class="btn primary">Sign in</button></div></form>` : ''}
      ${START.workspaces ? workspacesHTML() : ''}${err}${msg}`;
  } else if (s === 'signin') {
    const cur = st.entry || {};
    body = `<h1>Sign in to open “${esc(cur.workspaceName || 'the workspace')}”</h1><p class="note">Company workspace on <span class="mono">${esc(cur.url)}</span>.</p>
      <form data-sform="signin" class="st-form">
        <label class="st-l">User name<input class="in" name="username" value="${esc(START.username || cur.username || '')}" autocomplete="username" required></label>
        <label class="st-l">Password<input class="in" type="password" name="password" autocomplete="current-password" required></label>
        ${err}${msg}<div class="st-actions"><button class="btn primary">Sign in</button><button type="button" class="btn ghost" data-sact="home">Use another workspace</button></div></form>
      ${START.workspaces ? workspacesHTML() : ''}`;
  } else if (s === 'error') {
    const e = st.error || {}, cur = st.entry || {};
    const where = cur.mode === 'company' ? `${esc(cur.workspaceName || '')} on ${esc(cur.url)}` : esc(cur.folder || '');
    body = `<h1>The workspace can’t be opened</h1>
      <div class="st-problem"><p><b>${cur.mode === 'company' ? 'Company workspace' : 'Local workspace'}:</b> <span class="mono">${where}</span></p><p>${esc(e.message || 'Unknown problem.')}</p>
      <p class="note">Nothing was created or changed. ${cur.mode === 'company' ? 'Your data stays on the server; Flowlace does not switch to a local copy.' : 'Flowlace does not create an empty database in its place.'}</p></div>
      ${err}${msg}
      <div class="st-actions"><button class="btn primary" data-sact="retry">Try again</button>
        ${e.code === 'MOVED' ? `<button class="btn" data-sact="open-moved">Open the new location</button><button class="btn ghost" data-sact="open-old">Open this older copy anyway</button>` : ''}
        ${e.code === 'DB_MISSING' ? '<button class="btn" data-sact="open">Open another folder…</button>' : ''}
        <button class="btn" data-sact="home">Choose another workspace</button></div>`;
  }
  startRoot().innerHTML = `<div class="st-wrap">${head}<div class="st-body${START.busy ? ' busy' : ''}">${body}</div><p class="st-foot">Flowlace ${esc(st.app ? st.app.version : '')} · Settings are kept in your Windows profile; workspaces stay where you put them.</p></div>`;
  const f = startRoot().querySelector('input[name=name],input[name=url]:not([value=""]) ~ x, input[name=password], input[name=url]');
  if (f && !START.focused) { START.focused = true; try { f.focus(); } catch (_) { /* ignore */ } }
}
function workspacesHTML() {
  const list = START.workspaces || [], admin = START.user && START.user.role === 'admin';
  return `<div class="st-form"><h2>Workspaces on this server</h2>${START.user ? `<p class="note">Signed in as <b>${esc(START.user.name)}</b> (${START.user.role === 'admin' ? 'administrator' : 'member'}).</p>` : ''}
    ${list.length ? `<ul class="st-recent">${list.map(w => `<li><button class="plainbtn grow" data-sact="join" data-id="${esc(w.id)}"><b>${esc(w.name)}</b> <span class="muted mono">${esc(w.id)}</span></button><button class="btn sm primary" data-sact="join" data-id="${esc(w.id)}">Connect</button></li>`).join('')}</ul>` : '<p class="muted">There are no workspaces on this server yet.</p>'}
    ${admin ? `<form data-sform="newws" class="st-row" style="margin-top:8px"><input class="in" name="name" placeholder="New workspace name" maxlength="120" required><button class="btn">Create on the server</button></form>` : (list.length ? '' : '<p class="note">An administrator creates the workspaces.</p>')}</div>`;
}
function recentKey(r) { return r.mode === 'company' ? `company|${String(r.url || '').replace(/\/+$/, '').toLowerCase()}|${r.workspaceId}` : `local|${String(r.folder || '').toLowerCase()}`; }

async function startOpened(r) {
  START.busy = false;
  if (!r || !r.ok || !r.open) { START.err = (r && r.message) || 'The workspace could not be opened.'; if (r && r.code === 'MOVED') { START.st = Object.assign({}, START.st, { error: { code: 'MOVED', message: r.message, movedTo: r.movedTo } }); } renderStart(); return; }
  START.msg = 'Opening…'; renderStart();
  await API.workspace.reload();   // the interface restarts with the chosen workspace
}
async function startAct(a) {
  const act = a.dataset.sact; START.err = ''; START.msg = '';
  if (act === 'home' || act === 'create' || act === 'connect') { START.step = act; START.focused = false; if (act === 'create') { START.folder = null; START.target = null; } if (act === 'connect') { START.server = null; START.workspaces = null; } renderStart(); return; }
  if (act === 'cancel') { hideStart(); return; }
  if (act === 'retry') { START.busy = true; renderStart(); const st = await API.workspace.retry(); START.busy = false; if (st.open) { await API.workspace.reload(); return; } START.st = Object.assign(st, { app: START.st.app }); START.err = st.error ? st.error.message : ''; START.step = st.error && st.error.code === 'AUTH' ? 'signin' : 'error'; renderStart(); return; }
  if (act === 'open') { const p = await API.workspace.pickFolder('open'); if (!p.ok) return; START.busy = true; renderStart(); startOpened(await API.workspace.openLocal(p.ref)); return; }
  if (act === 'pick-create') {
    const p = await API.workspace.pickFolder('create'); if (!p.ok) return;
    const nameEl = startRoot().querySelector('input[name=name]'); START.name = nameEl ? nameEl.value : START.name;
    START.folder = p; const t = await API.workspace.targetFor(p.ref, START.name || 'Flowlace workspace'); START.target = t.ok ? t.path : null; renderStart(); return;
  }
  if (act === 'recent') { START.busy = true; renderStart(); const r = await API.workspace.openRecent(a.dataset.key); if (!r.ok && r.kind === 'auth') { START.busy = false; const rec = (START.st.recent || []).find(x => recentKey(x) === a.dataset.key); START.step = 'connect'; START.url = rec.url; START.username = rec.username; START.server = await API.workspace.testServer(rec.url); START.err = 'Sign in to open this workspace.'; renderStart(); return; } startOpened(r); return; }
  if (act === 'forget') { START.st = Object.assign(await API.workspace.forget(a.dataset.key), { app: START.st.app }); renderStart(); return; }
  if (act === 'open-moved') { START.busy = true; renderStart(); startOpened(await API.workspace.openMoved(recentKey(START.st.entry || {}))); return; }
  if (act === 'open-old') { const cur = START.st.entry; START.busy = true; renderStart(); startOpened(await API.workspace.openRecent(recentKey(cur), true)); return; }
  if (act === 'join') { START.busy = true; renderStart(); startOpened(await API.workspace.connectCompany(START.url, START.username, a.dataset.id)); return; }
}
async function startForm(form) {
  const kind = form.dataset.sform, F = form.elements; START.err = ''; START.msg = '';
  if (kind === 'create') {
    const name = F.name.value.trim(); START.name = name;
    if (!name) { START.err = 'Enter a name for the workspace.'; renderStart(); return; }
    if (!START.folder) { START.err = 'Choose a folder.'; renderStart(); return; }
    START.busy = true; renderStart();
    const r = await API.workspace.createLocal(START.folder.ref, name);
    if (r.ok) sessionStorageSafe('ms-new-workspace', '1');
    startOpened(r); return;
  }
  if (kind === 'test') {
    START.url = F.url.value.trim(); START.busy = true; START.workspaces = null; renderStart();
    START.server = await API.workspace.testServer(START.url); START.busy = false; START.focused = false; renderStart(); return;
  }
  if (kind === 'signin') {
    const url = START.step === 'signin' ? START.st.entry.url : START.url;
    START.username = F.username.value.trim(); START.busy = true; renderStart();
    const r = await API.workspace.signIn(url, START.username, F.password.value);
    START.busy = false;
    if (!r.ok) { START.err = r.message || 'Sign-in failed.'; renderStart(); return; }
    START.url = url; START.user = r.user; START.workspaces = r.workspaces || [];
    if (START.step === 'signin') { const st = await API.workspace.retry(); if (st.open) { await API.workspace.reload(); return; } START.err = st.error ? st.error.message : ''; }
    renderStart(); return;
  }
  if (kind === 'newws') {
    START.busy = true; renderStart();
    const r = await API.workspace.createServerWorkspace(START.url, START.username, F.name.value.trim());
    START.busy = false;
    if (!r.ok) { START.err = r.message; renderStart(); return; }
    const l = await API.workspace.serverWorkspaces(START.url, START.username); START.workspaces = l.ok ? l.workspaces : START.workspaces;
    START.msg = `Workspace “${r.workspace.name}” created on the server. Connect to it below.`; renderStart();
  }
}
function sessionStorageSafe(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (_) { return null; } return null; }

document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('#ms-start [data-sact]'); if (a && !START.busy) { e.preventDefault(); startAct(a); } });
document.addEventListener('submit', e => { const f = e.target.closest && e.target.closest('#ms-start form[data-sform]'); if (f) { e.preventDefault(); e.stopPropagation(); if (!START.busy) startForm(f); } }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && START.overlay && !startRoot().hidden) hideStart(); });
