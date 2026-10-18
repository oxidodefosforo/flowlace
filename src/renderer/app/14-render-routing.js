/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- render ---------- */
function shellTop(){
  const v=ui.view==='project'?'projects':ui.view;const nb=(id,l)=>`<button data-act="nav" data-to="${id}"${v===id?' aria-current="page"':''}>${l}</button>`;
  return `${brandHTML()}<nav class="nav" aria-label="Main">${nb('overview','Overview')}${nb('projects','Projects')}${nb('tasks','Tasks')}${nb('resources','Resources')}${nb('favorites','Favorites')}${nb('settings','Settings')}</nav><span class="spacer"></span>${themeBtn()}${saveIndHTML()}<button class="btn primary sm newp" data-act="new-project">+ New project</button>`;
}
function render(){
  if(!S)return;   // desktop: nothing to draw until a workspace is loaded
  const ae=document.activeElement,fid=ae&&ae.id&&app.contains(ae)?ae.id:null;let sel=null;
  try{if(fid&&typeof ae.selectionStart==='number')sel=[ae.selectionStart,ae.selectionEnd]}catch(e){}
  const main=document.getElementById('main'),pb=document.getElementById('pn-body');
  const ms=main.scrollTop,ps=pb?pb.scrollTop:0,pk=ui._pk,rw0=document.getElementById('rs-wrap'),rwS=rw0?[rw0.scrollLeft,rw0.scrollTop]:null;
  hideTip();ui.visible=[];ui.phOpen=ui.phOpen||new Set();for(const i of [...ui.sel])if(!S.tasks.some(t=>t.id===i))ui.sel.delete(i);
  const panelHTML=renderPanel();
  document.getElementById('ws').classList.toggle('has-panel',!!ui.panel);
  const pn=document.getElementById('panel');pn.hidden=!ui.panel;pn.innerHTML=panelHTML;
  document.getElementById('top').innerHTML=shellTop();
  let inner;
  if(ui.view==='project')inner=renderProject();else if(ui.view==='projects')inner=renderProjects();else if(ui.view==='tasks')inner=renderTasksPage();else if(ui.view==='favorites')inner=renderFavorites();else if(ui.view==='resources')inner=renderResources();else if(ui.view==='settings')inner=renderSettings();else inner=renderOverview();
  main.innerHTML=(storageOK?'':`<div class="banner bad"><b>Browser storage is unavailable.</b> Changes will be lost when this page closes. Use Settings → Export backup to keep a copy.</div>`)+inner;
  if(ui.resetScroll){main.scrollTop=0;ui.resetScroll=false}else{main.scrollTop=ms;const rw=document.getElementById('rs-wrap');if(rw&&rwS){rw.scrollLeft=rwS[0];rw.scrollTop=rwS[1]}}
  ui._pk=panelKey();const pb2=document.getElementById('pn-body');if(pb2&&pk===ui._pk)pb2.scrollTop=ps;
  const navTo=ui.navFocus;ui.navFocus=null;const target=ui.focusAfter||(navTo?null:fid);ui.focusAfter=null;
  if(navTo&&!target){const h=document.getElementById(navTo)||main;try{h.focus({preventScroll:true})}catch(e){}}
  if(target){const el=document.getElementById(target);if(el){try{el.focus({preventScroll:target===fid})}catch(e){el.focus()}if(sel&&target===fid){try{el.setSelectionRange(sel[0],sel[1])}catch(e){}}else if(el.select&&ui.selectFocus)el.select()}}
  ui.selectFocus=false;
  document.title=ui.view==='project'&&project(ui.pid)?`${project(ui.pid).code} · ${appName()}`:`${{overview:'Overview',projects:'Projects',tasks:'Tasks',favorites:'Favorites',resources:'Resources',settings:'Settings'}[ui.view]||'Overview'} · ${appName()}`;
}
/* ---------- routing ---------- */
function route(){
  const h=decodeURIComponent((location.hash||'').slice(1));
  if(h.startsWith('p-')){if(ui.pid!==h.slice(2))ui.ptab='summary';ui.view='project';ui.pid=h.slice(2)}
  else if(['projects','settings','tasks','favorites','resources'].includes(h))ui.view=h;else ui.view='overview';
  ui.legendOpen=false;ui.cfgOpen=null;ui.resetScroll=true;ui.navFocus=ui.view==='project'?'proj-h1':'main';render();
}
function go(h,o={}){
  ui.sel.clear();ui.colAdd=null;ui.legendOpen=false;ui.cfgOpen=null;
  if(h.startsWith('p-')){const id=h.slice(2);if(ui.pid!==id||!o.keepTab)ui.ptab=o.tab||'summary';ui.view='project';ui.pid=id}else ui.view=h;
  try{history.pushState(null,'','#'+h)}catch(e){}
  closeModal(true);hideTip();ui.resetScroll=true;ui.navFocus=ui.view==='project'?'proj-h1':'main';render();
}
window.addEventListener('popstate',route);

