/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- shell: sidebar (modules, favorites, projects), header with breadcrumbs, quick search ----------
   Behaviour studied (not copied) from: notion-clone app/(main)/_components/navigation.tsx (collapse, width clamp,
   reset on double click), Plane apps/web/components/sidebar/resizable-sidebar.tsx (keyboard resize with arrows /
   Home / End, role="separator"), Notion help "Navigate with the sidebar" (Ctrl+\ toggles, Ctrl+K search). */
const SIDE_MIN=200,SIDE_MAX=360,SIDE_DEF=244,SIDE_KEY='flowlace-sidebar';
const SIDE_NARROW=900;   // below this width the sidebar is an overlay drawer
let sideSt=(()=>{try{const o=JSON.parse(localStorage.getItem(SIDE_KEY)||'{}');return {w:+o.w||SIDE_DEF,open:o.open!==false,fav:o.fav!==false,proj:o.proj!==false}}catch(e){return {w:SIDE_DEF,open:true,fav:true,proj:true}}})();
let sideDrawer=false;   // narrow window: drawer shown over the content
function saveSide(){try{localStorage.setItem(SIDE_KEY,JSON.stringify(sideSt))}catch(e){}}
const isNarrow=()=>window.innerWidth<SIDE_NARROW;
const clampW=w=>Math.max(SIDE_MIN,Math.min(SIDE_MAX,Math.round(w)));
const SICON={
  search:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.5 10.5 3.2 3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  overview:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M6 6.5v7" stroke="currentColor" stroke-width="1.4"/></svg>',
  projects:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5c0-.8.6-1.5 1.5-1.5h3l1.5 1.6h4.5c.8 0 1.5.7 1.5 1.5v6.4c0 .8-.7 1.5-1.5 1.5h-9c-.9 0-1.5-.7-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  tasks:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m5 8.2 2 2 4-4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  resources:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="6" cy="5.5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.8 13.5c.4-2.4 2.1-3.8 4.2-3.8s3.8 1.4 4.2 3.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M10.6 3.3a2.3 2.3 0 0 1 0 4.4M12 9.9c1.2.5 2 1.7 2.2 3.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  favorites:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m8 2.3 1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 11.1 4.5 13l.8-3.9-2.9-2.7 3.9-.5z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/></svg>',
  settings:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M3.6 12.4l1.3-1.3M11.1 4.9l1.3-1.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  side:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.2 2.5v11" stroke="currentColor" stroke-width="1.4"/></svg>',
  collapse:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.5 4 4.5 8l4 4M12.5 4l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus:'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  caret:'<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 2l4 3-4 3z" fill="currentColor"/></svg>',
  view:'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1.8" y="2.5" width="10.4" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 5.5h10.4M5.3 5.5v6" stroke="currentColor" stroke-width="1.3"/></svg>',
  deliv:'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2 12 7 7 12 2 7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>'};
const MODS=[['overview','Overview'],['projects','Projects'],['tasks','Tasks'],['resources','Resources'],['favorites','Favorites'],['settings','Settings']];
const PTAB_L={summary:'Summary',phases:'Phases',deliverables:'Deliverables',tasks:'Tasks',workflow:'Workflow'};
const STAB_L={phases:'Phases & milestones',defaults:'Project defaults',people:'People',workflow:'Company workflow',brand:'Company & appearance',data:'Data & backup'};
const kbd=k=>`<kbd>${/Mac/.test(navigator.platform||'')?k.replace('Ctrl+','⌘'):k}</kbd>`;

function sideHTML(){
  const v=secOf(ui.view||'overview');
  const it=(id,l)=>`<button class="sd-item" data-act="nav" data-to="${id}"${v===id?' aria-current="page"':''}>${SICON[id]}<span>${l}</span></button>`;
  const favs=S.favorites.map(f=>viewById(f.viewId)).filter(Boolean);
  const curView=ui.view==='tasks'?ctxOf(null).vid:ui.view==='project'&&ui.ptab==='tasks'?ctxOf(ui.pid).vid:null;
  const projs=S.projects.filter(p=>!p.archived||p.id===ui.pid).slice().sort(codeSort);
  const sec=(key,label,open,body,extra='')=>`<section class="sd-sec" aria-label="${label}"><div class="sd-sh"><button class="sd-sh-t" data-act="side-sec" data-v="${key}" aria-expanded="${open}"><span class="car">${SICON.caret}</span>${label}</button>${extra}</div>${open?body:''}</section>`;
  return `<div class="sd-top">${brandHTML()}<button class="iconbtn sd-collapse" data-act="side-toggle" aria-label="Hide sidebar (Ctrl+\\)" title="Hide sidebar · Ctrl+\\">${SICON.collapse}</button></div>
  <button class="sd-item sd-search" data-act="qs-open" aria-keyshortcuts="Control+K">${SICON.search}<span>Search</span>${kbd('Ctrl+K')}</button>
  <nav class="nav sd-nav" aria-label="Main">${MODS.map(([id,l])=>it(id,l)).join('')}</nav>
  <div class="sd-scroll">
  ${sec('fav','Favorites',sideSt.fav,favs.length?`<ul class="sd-list">${favs.map(x=>{const p=x.projectId?project(x.projectId):null;return `<li><button class="sd-item sm" data-act="fav-open" data-id="${x.id}"${curView===x.id?' aria-current="true"':''} title="${esc(x.name)}${p?` · ${esc(p.code)}`:''}">${SICON.view}<span>${esc(x.name)}</span>${p?`<small class="mono">${esc(p.code)}</small>`:''}</button></li>`}).join('')}</ul>`:'<p class="sd-empty">Star a saved task view to pin it here.</p>')}
  ${sec('proj','Projects',sideSt.proj,projs.length?`<ul class="sd-list">${projs.map(p=>`<li><button class="sd-item sm" data-act="open-project" data-id="${p.id}"${ui.view==='project'&&ui.pid===p.id?' aria-current="page"':''} title="${esc(p.code)} · ${esc(p.name)}"><span class="sd-dot" style="--c:${p.status==='In progress'?'var(--ok)':p.status==='On hold'?'var(--warn)':'var(--line-2)'}" aria-hidden="true"></span><small class="mono">${esc(p.code)}</small><span>${esc(p.name)}</span></button></li>`).join('')}</ul>`:'<p class="sd-empty">No projects yet.</p>',`<button class="iconbtn sd-add" data-act="side-new-project" aria-label="New project" title="New project">${SICON.plus}</button>`)}
  </div>
  <div class="sd-foot">${saveIndHTML()}${themeBtn()}</div>
  <div class="sd-resize" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar" aria-valuemin="${SIDE_MIN}" aria-valuemax="${SIDE_MAX}" aria-valuenow="${sideSt.w}" title="Drag to resize · double-click to reset"></div>`;
}
function crumbsHTML(){
  const b=(l,attrs)=>`<button class="bc" ${attrs}>${l}</button>`,sep='<span class="bc-sep" aria-hidden="true">/</span>',cur=l=>`<span class="bc cur" aria-current="page">${l}</span>`;
  const parts=[];
  if(ui.view==='project'){const p=project(ui.pid);parts.push(b(`${SICON.projects}Projects`,'data-act="nav" data-to="projects"'));
    if(p){parts.push(ui.ptab&&ui.ptab!=='summary'?b(`<span class="mono">${esc(p.code)}</span> ${esc(p.name)}`,`data-act="ptab" data-v="summary"`):cur(`<span class="mono">${esc(p.code)}</span> ${esc(p.name)}`));
      if(ui.ptab&&ui.ptab!=='summary')parts.push(cur(PTAB_L[ui.ptab]||ui.ptab))}}
  else{const v=ui.view||'overview',l=(MODS.find(m=>m[0]===v)||MODS[0])[1];
    const sub=v==='tasks'?(c=>c.view?esc(c.view.name):'All tasks')(ctxOf(null)):v==='settings'?STAB_L[ui.stab||'phases']:'';
    parts.push(sub?b(`${SICON[v]}${l}`,`data-act="nav" data-to="${v}"`):cur(`${SICON[v]}${l}`));if(sub)parts.push(cur(sub))}
  return `<nav class="crumbs-top" aria-label="Breadcrumb">${parts.join(sep)}</nav>`;
}
function renderShell(){
  const side=document.getElementById('side'),top=document.getElementById('top');
  const narrow=isNarrow(),shown=narrow?sideDrawer:sideSt.open;
  app.classList.toggle('side-off',!shown);app.classList.toggle('side-drawer',narrow&&sideDrawer);
  app.style.setProperty('--sidew',sideSt.w+'px');
  side.innerHTML=sideHTML();side.toggleAttribute('inert',!shown);
  top.innerHTML=`${shown&&!narrow?'':`<button class="iconbtn side-open" data-act="side-toggle" aria-label="Show sidebar (Ctrl+\\)" title="Show sidebar · Ctrl+\\" aria-expanded="false">${SICON.side}</button>`}${crumbsHTML()}<span class="spacer"></span><button class="btn sm ghost top-search" data-act="qs-open" title="Search · Ctrl+K">${SICON.search}<span>Search</span></button>`;
}
function setSide(open){
  if(isNarrow()){sideDrawer=open}else{sideSt.open=open;saveSide()}
  renderShell();
  const f=open?document.querySelector('#side .sd-search'):document.querySelector('#top .side-open');if(f)f.focus({preventScroll:true});
}
window.addEventListener('resize',()=>{if(!S)return;const n=isNarrow();if(n!==app.classList.contains('was-narrow')){app.classList.toggle('was-narrow',n);sideDrawer=false;renderShell()}});

/* resize: pointer drag, keyboard (arrows ±10, Home / End) and double click to reset */
let sideDrag=null;
document.addEventListener('pointerdown',e=>{const h=e.target.closest&&e.target.closest('.sd-resize');if(!h||e.button!==0)return;e.preventDefault();sideDrag={x:e.clientX,w:sideSt.w};h.setPointerCapture(e.pointerId);app.classList.add('side-resizing')});
document.addEventListener('pointermove',e=>{if(!sideDrag)return;sideSt.w=clampW(sideDrag.w+e.clientX-sideDrag.x);app.style.setProperty('--sidew',sideSt.w+'px');const h=document.querySelector('.sd-resize');if(h)h.setAttribute('aria-valuenow',sideSt.w)});
document.addEventListener('pointerup',()=>{if(!sideDrag)return;sideDrag=null;app.classList.remove('side-resizing');saveSide()});
document.addEventListener('dblclick',e=>{if(e.target.closest&&e.target.closest('.sd-resize')){sideSt.w=SIDE_DEF;saveSide();renderShell()}});
document.addEventListener('keydown',e=>{
  const h=e.target.classList&&e.target.classList.contains('sd-resize');
  if(h&&!e.altKey&&!e.ctrlKey&&!e.metaKey){const m={ArrowLeft:-10,ArrowRight:10}[e.key];
    if(m!=null||e.key==='Home'||e.key==='End'){e.preventDefault();sideSt.w=e.key==='Home'?SIDE_MIN:e.key==='End'?SIDE_MAX:clampW(sideSt.w+m);saveSide();app.style.setProperty('--sidew',sideSt.w+'px');e.target.setAttribute('aria-valuenow',sideSt.w)}return}
  if(!S||document.body.classList.contains('ms-start-open'))return;
  if(e.key==='Escape'&&isNarrow()&&sideDrawer&&!modalRoot.innerHTML){e.preventDefault();e.stopPropagation();setSide(false);return}
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&e.key==='\\'){e.preventDefault();setSide(!(isNarrow()?sideDrawer:sideSt.open));return}
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&(e.key==='k'||e.key==='K')){e.preventDefault();if(document.getElementById('qs-in'))closeModal();else openQS();return}
},true);

/* ---------- quick search (Ctrl+K): modules, projects, saved views, deliverables and tasks ---------- */
let qsSel=0,qsItems=[];
const qsNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function qsResults(q){
  const n=qsNorm(q).trim(),words=n.split(/\s+/).filter(Boolean),hit=s=>words.every(w=>qsNorm(s).includes(w));
  const out=[],add=(group,items,max)=>{items.slice(0,max).forEach(x=>out.push({group,...x}))};
  add('Go to',MODS.filter(m=>!n||hit(m[1])).map(([id,l])=>({icon:SICON[id],label:l,act:{a:'nav',to:id}})),n?6:6);
  if(!n){const recent=S.projects.filter(p=>!p.archived).sort(codeSort).slice(0,6);add('Projects',recent.map(p=>({icon:SICON.projects,label:`${p.code} · ${p.name}`,sub:p.client||'',act:{a:'project',id:p.id}})),6);return out}
  add('Projects',S.projects.filter(p=>hit(`${p.code} ${p.name} ${p.client||''}`)).sort(codeSort).map(p=>({icon:SICON.projects,label:`${p.code} · ${p.name}`,sub:[p.client,p.archived?'Archived':''].filter(Boolean).join(' · '),act:{a:'project',id:p.id}})),8);
  add('Saved views',S.views.filter(v=>hit(v.name)).map(v=>{const p=v.projectId?project(v.projectId):null;return {icon:SICON.view,label:v.name,sub:p?`${p.code} · Tasks`:'All projects · Tasks',act:{a:'view',id:v.id}}}),5);
  add('Deliverables',S.deliverables.filter(d=>{const p=project(d.projectId);return p&&hit(`${d.name} ${p.code} ${p.name}`)}).map(d=>{const p=project(d.projectId);return {icon:SICON.deliv,label:d.name,sub:`${p.code} · ${phName(d.phaseId)}${d.due?' · due '+fmt(d.due):''}`,act:{a:'deliv',id:d.id}}}),6);
  add('Tasks',S.tasks.filter(t=>{const p=project(t.projectId);return p&&hit(`${t.name} ${p.code} ${p.name}`)}).sort((a,b)=>(a.status==='Done')-(b.status==='Done')||String(a.due||'9').localeCompare(String(b.due||'9'))).map(t=>{const p=project(t.projectId);return {icon:SICON.tasks,label:t.name,sub:`${p.code} · ${TGLYPH[t.status]} ${t.status}${t.assignedToId?' · '+shortName(pname(t.assignedToId)):''}`,act:{a:'task',id:t.id},done:t.status==='Done'}}),12);
  return out;
}
function qsListHTML(){
  if(!qsItems.length)return `<p class="qs-none">No results. Try a project code, a task or a deliverable name.</p>`;
  let g='',h='';qsItems.forEach((x,i)=>{if(x.group!==g){g=x.group;h+=`<div class="qs-g" role="presentation">${esc(g)}</div>`}
    h+=`<div class="qs-it${i===qsSel?' on':''}${x.done?' done':''}" role="option" id="qs-o${i}" data-qi="${i}" aria-selected="${i===qsSel}">${x.icon}<span class="qs-l">${esc(x.label)}</span>${x.sub?`<span class="qs-s">${esc(x.sub)}</span>`:''}</div>`});
  return h;
}
function qsUpdate(){const inp=document.getElementById('qs-in');if(!inp)return;qsItems=qsResults(inp.value);qsSel=Math.min(qsSel,Math.max(0,qsItems.length-1));const l=document.getElementById('qs-list');l.innerHTML=qsListHTML();inp.setAttribute('aria-activedescendant',qsItems.length?'qs-o'+qsSel:'');const o=document.getElementById('qs-o'+qsSel);if(o)o.scrollIntoView({block:'nearest'})}
function openQS(){
  closeFloats();qsSel=0;qsItems=qsResults('');
  openModal(`<div class="qs"><div class="qs-bar">${SICON.search}<input id="qs-in" class="qs-input" type="text" placeholder="Search projects, tasks, deliverables and views…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="qs-list" aria-autocomplete="list" aria-label="Search"><kbd>Esc</kbd></div><div class="qs-list" id="qs-list" role="listbox" aria-label="Results">${qsListHTML()}</div><div class="qs-foot"><span>${kbd('↑')}${kbd('↓')} move</span><span>${kbd('Enter')} open</span><span>${kbd('Ctrl+K')} close</span></div></div>`,{focus:'#qs-in'});
  modalRoot.querySelector('.modal').classList.add('qs-modal');
}
function qsGo(i){
  const x=qsItems[i];if(!x)return;closeModal(true);const a=x.act;
  if(a.a==='nav')navSection(a.to);
  else if(a.a==='project')go('p-'+a.id);
  else if(a.a==='view')openView(a.id);
  else if(a.a==='deliv'){const d=deliv(a.id);if(d){go('p-'+d.projectId,{tab:'deliverables'});openPanel('deliv',d.id)}}
  else if(a.a==='task'){const t=S.tasks.find(x=>x.id===a.id);if(t){if(ui.view!=='tasks'&&!(ui.view==='project'&&ui.pid===t.projectId))go('p-'+t.projectId,{tab:'tasks'});openPanel('task',t.id)}}
  if(isNarrow()&&sideDrawer){sideDrawer=false;renderShell()}
}
document.addEventListener('input',e=>{if(e.target.id==='qs-in'){qsSel=0;qsUpdate()}});
document.addEventListener('keydown',e=>{
  if(e.target.id!=='qs-in')return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!qsItems.length)return;qsSel=(qsSel+(e.key==='ArrowDown'?1:-1)+qsItems.length)%qsItems.length;qsUpdate()}
  else if(e.key==='Enter'){e.preventDefault();qsGo(qsSel)}
});
document.addEventListener('click',e=>{const o=e.target.closest&&e.target.closest('[data-qi]');if(o){e.preventDefault();e.stopPropagation();qsGo(+o.dataset.qi)}},true);
document.addEventListener('mousemove',e=>{const o=e.target.closest&&e.target.closest('[data-qi]');if(o&&+o.dataset.qi!==qsSel){qsSel=+o.dataset.qi;document.querySelectorAll('.qs-it').forEach(x=>{const on=+x.dataset.qi===qsSel;x.classList.toggle('on',on);x.setAttribute('aria-selected',on)});const i=document.getElementById('qs-in');if(i)i.setAttribute('aria-activedescendant','qs-o'+qsSel)}});

/* ---------- task panel: previous / next task of the list on screen (Notion side peek keeps the list) ---------- */
function panelSeq(){const P=ui.panel;if(!P||P.type!=='task')return null;const ids=(ui.visible||[]).filter(id=>S.tasks.some(t=>t.id===id));const i=ids.indexOf(P.id);return i<0?null:{ids,i}}
function panelStepHTML(){const q=panelSeq();if(!q||q.ids.length<2)return '';
  return `<div class="pn-step" role="group" aria-label="Move through the list"><button class="iconbtn" data-act="panel-step" data-d="-1" aria-label="Previous task (Alt+↑)" title="Previous task · Alt+↑"${q.i?'':' disabled'}>${ICON.up}</button><span class="pn-pos num">${q.i+1}/${q.ids.length}</span><button class="iconbtn" data-act="panel-step" data-d="1" aria-label="Next task (Alt+↓)" title="Next task · Alt+↓"${q.i<q.ids.length-1?'':' disabled'}>${ICON.down}</button></div>`}
function panelStep(d){const q=panelSeq();if(!q)return;const j=q.i+d;if(j<0||j>=q.ids.length)return;openPanel('task',q.ids[j]);
  const r=document.querySelector(`[data-trow="${q.ids[j]}"],[data-tid="${q.ids[j]}"]`);if(r&&r.scrollIntoView)r.scrollIntoView({block:'nearest'})}
document.addEventListener('keydown',e=>{if(!e.altKey||e.ctrlKey||e.metaKey||(e.key!=='ArrowUp'&&e.key!=='ArrowDown'))return;if(!ui.panel||ui.panel.type!=='task'||modalRoot.innerHTML)return;
  const tg=e.target;if(tg&&tg.tagName==='SELECT')return;e.preventDefault();panelStep(e.key==='ArrowUp'?-1:1)});
