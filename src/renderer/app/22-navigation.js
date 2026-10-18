/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- navigation memory per main section ----------
   Hash = location (#overview, #tasks, #p-<id>/<tab>…). Each section remembers its last location, scroll positions and
   detail panel in prefs.nav, so a main-menu click goes back to where you were. Explicit links keep their own destination. */
const VIEWS=['overview','projects','tasks','resources','favorites','settings'],PTABS=['summary','phases','deliverables','tasks','workflow'];
const secOf=v=>v==='project'?'projects':v;
function curHash(){return ui.view==='project'?`p-${ui.pid}${ui.ptab&&ui.ptab!=='summary'?'/'+ui.ptab:''}`:ui.view}
function parseHash(h){h=String(h||'');if(h.startsWith('p-')){const [id,tab]=h.slice(2).split('/');return {view:'project',pid:id,tab:PTABS.includes(tab)?tab:'summary'}}return {view:VIEWS.includes(h)?h:'overview'}}
function validLoc(L){if(L.view==='project'&&!project(L.pid))return {view:'projects'};return L}
function panelOk(p){if(!p)return null;const ok={project:project,deliv:deliv,task:id=>S.tasks.find(t=>t.id===id),pphase:pphase}[p.type];return ok&&ok(p.id)?{type:p.type,id:p.id}:null}
function snapNav(){
  if(!ui.view)return;const m=document.getElementById('main'),rw=document.getElementById('rs-wrap'),tl=document.querySelector('#main .tlx'),tw=document.querySelector('#main .twrap');
  const n={hash:curHash(),main:m?m.scrollTop:0,rs:rw?[rw.scrollLeft,rw.scrollTop]:null,tlx:tl?tl.scrollLeft:0,tw:tw?tw.scrollLeft:0,panel:ui.panel&&ui.panel.type!=='list'?{type:ui.panel.type,id:ui.panel.id}:null};
  prefs.nav={...(prefs.nav||{}),[secOf(ui.view)]:n};prefs.navLast=secOf(ui.view);savePrefs();
}
function setLoc(L){L=validLoc(L);if(L.view==='project'){ui.view='project';ui.pid=L.pid;ui.ptab=L.tab||'summary'}else ui.view=L.view;return L}
function restoreScroll(n){if(!n)return;const m=document.getElementById('main');if(m)m.scrollTop=n.main||0;
  const rw=document.getElementById('rs-wrap');if(rw&&n.rs){rw.scrollLeft=n.rs[0];rw.scrollTop=n.rs[1]}
  const tl=document.querySelector('#main .tlx');if(tl&&n.tlx)tl.scrollLeft=n.tlx;const tw=document.querySelector('#main .twrap');if(tw&&n.tw)tw.scrollLeft=n.tw}
function closeFloats(){[closeCtx,closeCapPop,closeTS,closeCalPop,closeQT,closeRowMenu,closePJ,closeTK].forEach(f=>{try{f()}catch(e){}})}
function finishNav(restore){
  closeModal(true);hideTip();ui.legendOpen=false;ui.cfgOpen=null;ui.navFocus=ui.view==='project'?'proj-h1':'main';
  if(restore){ui.resetScroll=false;const m=document.getElementById('main');render();restoreScroll(restore);requestAnimationFrame(()=>restoreScroll(restore))}
  else{ui.resetScroll=true;render()}
}
/* explicit destination (links, project rows, tabs given by the caller) */
function go(h,o={}){
  snapNav();closeFloats();ui.sel.clear();ui.colAdd=null;
  const L=parseHash(h);if(L.view==='project'){if(o.tab)L.tab=o.tab;else if(o.keepTab&&ui.view==='project'&&ui.pid===L.pid)L.tab=ui.ptab;else if(!h.includes('/'))L.tab='summary'}
  setLoc(L);try{history.pushState(null,'','#'+curHash())}catch(e){}
  finishNav(null);
}
/* main menu: back to the section's last location (clicking the section you are already in goes to its start) */
function navSection(sec){
  const here=secOf(ui.view);snapNav();closeFloats();ui.sel.clear();ui.colAdd=null;
  const n=(prefs.nav||{})[sec];
  if(here===sec||!n){setLoc({view:sec});if(here!==sec||ui.view!==sec){ui.panel=null;ui.panelStack=[]}try{history.pushState(null,'','#'+curHash())}catch(e){}finishNav(null);return}
  const L=setLoc(parseHash(n.hash));const restoredPanel=L.view===parseHash(n.hash).view?panelOk(n.panel):null;
  ui.panel=restoredPanel;ui.panelStack=[];try{history.pushState(null,'','#'+curHash())}catch(e){}
  finishNav(L.view===parseHash(n.hash).view?n:null);
}
/* back / forward and first load */
function route(){
  const raw=decodeURIComponent((location.hash||'').slice(1));closeFloats();
  const first=!ui.booted;ui.booted=true;
  if(!raw&&first){const sec=prefs.navLast,n=sec&&(prefs.nav||{})[sec];
    if(n){const L=setLoc(parseHash(n.hash));ui.panel=panelOk(n.panel);ui.panelStack=[];try{history.replaceState(null,'','#'+curHash())}catch(e){}finishNav(L.view===parseHash(n.hash).view?n:null);return}}
  if(!first)snapNav();
  const L=setLoc(parseHash(raw)),n=(prefs.nav||{})[secOf(ui.view)];
  if(first&&n&&n.hash===curHash()){ui.panel=panelOk(n.panel);ui.panelStack=[];finishNav(n);return}
  finishNav(null);
}
window.addEventListener('pagehide',()=>{try{snapNav()}catch(e){}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){try{snapNav()}catch(e){}}});
function setPtab(v){ui.ptab=v;ui.legendOpen=false;ui.cfgOpen=null;ui.colAdd=null;try{history.pushState(null,'','#'+curHash())}catch(e){}snapNav();ui.resetScroll=true;render()}

