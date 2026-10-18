/* ---------- desktop: start (replaces the web version's boot, which read localStorage) ---------- */
ui.view = 'starting';   // nothing renders (resize, theme change…) until a workspace is loaded
ui.winStart = todayDN(); ui.phOpen = new Set(); ui.suggest = {}; ui.stab = 'phases';
setInterval(() => { const t = todayDN(); if (t !== window.__azDay) { window.__azDay = t; if (SY.started && !userIsBusy()) render(); } }, 60000);
window.__azDay = todayDN();
document.addEventListener('toggle', e => { const d = e.target; if (d.classList && d.classList.contains('phcard')) { d.open ? ui.phOpen.add(d.dataset.ph) : ui.phOpen.delete(d.dataset.ph); } }, true);
listenWorkspace();

function welcomeEmpty() {
  openModal(`<div class="m-head"><div><div class="eyebrow">${esc(SY.ws.name)}</div><h2>Your workspace is ready</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <p>It is empty and saved in <span class="mono">${esc(SY.mode === 'company' ? SY.ws.url : SY.ws.folder)}</span>. To continue with the projects you had in the HTML version, export them there (Settings → Data &amp; backup → Export backup) and import the file here.</p>
    <div class="m-actions"><button class="btn ghost" data-act="modal-close">Start empty</button><button class="btn" data-act="load-examples">Load example data</button><button class="btn primary" data-dact="import-json">Import from the HTML version…</button></div>`);
}

(async function bootDesktop() {
  if (!API || !API.desktop) { document.body.innerHTML = '<p style="padding:24px">This page runs inside the Flowlace desktop application.</p>'; return; }
  const st = await API.workspace.status();
  if (!st.open) { showStart(st); return; }
  const snap = await API.data.snapshot();
  if (!snap.ok) { showStart(Object.assign(st, { open: false, error: { code: snap.kind === 'auth' ? 'AUTH' : snap.kind === 'offline' ? 'OFFLINE' : 'ERROR', message: snap.message } })); return; }
  const ps = await API.data.getUserState();
  SY.ws = Object.assign({}, st.workspace, st.entry && st.entry.username ? { username: st.entry.username } : {});
  SY.mode = st.workspace.mode; SY.user = st.workspace.user; SY.conn = st.connection || { state: 'local' };
  SY.isAdmin = SY.mode !== 'company' || !!(SY.user && SY.user.role === 'admin');
  if (SY.mode === 'company') { const i = await API.workspace.info(); if (i.ok) { WSD.info = i; SY.user = i.user; SY.isAdmin = i.user.role === 'admin'; SY.ws.name = i.info.name; } }
  const empty = loadFromSnapshot(snap, ps && ps.ok ? ps.data : null);
  PS.last = JSON.stringify({ v: 1, prefs, views: S.views || [], favorites: S.favorites || [] });
  wfBoot(); applyTheme();
  ui.stab = prefs.stab || 'phases'; ui.phOpen = new Set(Array.isArray(prefs.phOpen) ? prefs.phOpen : []);
  hideStart();
  setState('saved');
  route();
  if (empty && SY.isAdmin) save();       // the standard configuration of a new workspace is saved once
  const t = sessionStorageSafe('ms-toast'); if (t) { toast(t); sessionStorageSafe('ms-toast', null); }
  if (sessionStorageSafe('ms-new-workspace')) { sessionStorageSafe('ms-new-workspace', null); if (!S.projects.length) welcomeEmpty(); }
  offerPending();
})();
