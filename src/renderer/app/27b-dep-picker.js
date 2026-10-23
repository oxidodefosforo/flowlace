/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- "Depends on" picker: search + Type / Service / Phase filters, selected ones kept apart ----------
   Used in the step details (Company workflow matrix) and in "Add prerequisite…" from the diagram. Filters combine
   with AND; the options of one filter with OR. Filters only change what is listed: they never remove a selection.
   The selection is the step's deps array in the draft — the same data the diagram and the matrix show. */
function wfDPState(id,ph){ui.wfDF=ui.wfDF||{};return ui.wfDF[id]||(ui.wfDF[id]={q:'',types:[],atypes:[],svcs:[],phases:[ph]})}
function wfDPResults(s,ed){
  const st=wfDPState(s.id,s.phaseId),q=st.q.trim().toLowerCase(),order=wfSpecs(ed);
  return ed.steps.filter(x=>!x.retired&&(!q||(x.name+' '+(x.desc||'')).toLowerCase().includes(q))&&(!st.types.length||st.types.includes(x.cat))&&(!(st.atypes||[]).length||st.atypes.includes(wfType(x)))&&(!st.svcs.length||st.svcs.includes(wfSpecOf(x)))&&(!st.phases.length||st.phases.includes(x.phaseId)))
    .sort((a,b)=>S.phases.findIndex(p=>p.id===a.phaseId)-S.phases.findIndex(p=>p.id===b.phaseId)||order.indexOf(wfSpecOf(a))-order.indexOf(wfSpecOf(b))||WF_COLS.findIndex(c=>c[0]===a.cat)-WF_COLS.findIndex(c=>c[0]===b.cat)||a.order-b.order);
}
function wfDPWhy(s,x,ed){if(x.id===s.id)return 'An activity can’t depend on itself';if(!s.deps.includes(x.id)&&wfCycle(ed,s.id,x.id))return `Not possible: “${x.name}” already depends on “${s.name}” (a circular requirement, a loop — to send work back for review, use Connect: review return)`;return ''}
const wfDPMeta=x=>`${WF_CAT[x.cat]}${wfType(x)!=='normal'?' · '+WF_TYPE[wfType(x)]:''} · ${esc(wfSpecName(wfSpecOf(x)))} · ${esc(phName(x.phaseId))}`;
function wfDPList(s,ed){
  const res=wfDPResults(s,ed);
  return `<p class="wfdp-n muted" aria-live="polite">${plural(res.length,'result')}</p><div class="wfdp-list" role="group" aria-label="Activities ${esc(s.name)} can depend on">${res.length?res.map(x=>{const on=s.deps.includes(x.id),why=wfDPWhy(s,x,ed);
    return `<label class="chk wfdp-r${why?' dis':''}" title="${esc(why)}"><input type="checkbox" data-wfdep="${s.id}" value="${x.id}"${on?' checked':''}${why?' disabled':''}><span><b>${esc(x.name)}</b> <small>${wfDPMeta(x)}</small>${why?`<small class="wfdp-why">${esc(why)}</small>`:''}</span></label>`}).join(''):'<p class="muted wfdp-none">No activities match these filters.</p>'}</div>`;
}
function wfDepPicker(s,ed){
  const st=wfDPState(s.id,s.phaseId),sel=s.deps.map(d=>wfStep(d,ed)).filter(Boolean);
  const chip=(k,v,l,on)=>`<button type="button" class="chip wfdp-c" data-wfdf="${k}" data-sid="${s.id}" data-v="${v}" aria-pressed="${on}">${esc(l)}</button>`;
  const phs=S.phases.filter(g=>g.active||ed.steps.some(x=>x.phaseId===g.id&&!x.retired));
  return `<div class="wfdp" id="wfdp-${s.id}">
    <div class="wfdp-sel"><span class="wfdp-l">Depends on <span class="muted">${sel.length}</span></span>${sel.length?sel.map(d=>`<span class="chip wfdp-s${d.phaseId!==s.phaseId?' other':''}" title="${wfDPMeta(d)}">${esc(d.name)} <small>${WF_CAT[d.cat]} · ${esc(wfSpecName(wfSpecOf(d)))}${d.phaseId!==s.phaseId?' · '+esc(phName(d.phaseId)):''}</small><button type="button" class="x" data-wfdrm="${s.id}" data-v="${d.id}" aria-label="Remove ${esc(d.name)}">×</button></span>`).join(''):'<span class="muted">No dependencies</span>'}</div>
    <div class="wfdp-f"><input class="in sm" type="search" data-wfdq="${s.id}" value="${esc(st.q)}" placeholder="Search name or description" aria-label="Search activities">
      <div class="wfdp-g" role="group" aria-label="Category"><span>Category</span>${WF_COLS.map(([k])=>chip('types',k,WF_CAT[k],st.types.includes(k))).join('')}</div>
      <div class="wfdp-g" role="group" aria-label="Activity type"><span>Activity type</span>${WF_TYPES.map(([k,l])=>chip('atypes',k,l,(st.atypes||[]).includes(k))).join('')}</div>
      <div class="wfdp-g" role="group" aria-label="Service"><span>Service</span>${wfSpecs(ed).map(id=>chip('svcs',id,wfSpecName(id),st.svcs.includes(id))).join('')}</div>
      <div class="wfdp-g" role="group" aria-label="Phase"><span>Phase</span>${chip('phases','_all','All phases',!st.phases.length)}${phs.map(g=>chip('phases',g.id,g.name,st.phases.includes(g.id))).join('')}</div>
      <button type="button" class="btn sm ghost" data-wfdclr="${s.id}">Clear filters</button></div>
    <div class="wfdp-res">${wfDPList(s,ed)}</div></div>`;
}
function wfDPRefresh(id,focus){const ed=wfEdit(),s=wfStep(id,ed);if(!s)return;document.querySelectorAll(`#wfdp-${CSS.escape(id)}`).forEach(el=>{el.outerHTML=wfDepPicker(s,ed)});if(focus){const f=document.querySelector(focus);f&&f.focus({preventScroll:true})}}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.wfdq)return;const s=wfStep(el.dataset.wfdq,wfEdit());if(!s)return;
  wfDPState(s.id,s.phaseId).q=el.value;const box=el.closest('.wfdp');if(box){const r=box.querySelector('.wfdp-res');if(r)r.innerHTML=wfDPList(s,wfEdit())}},true);
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-wfdf],[data-wfdclr],[data-wfdrm]');if(!t)return;e.preventDefault();e.stopPropagation();
  if(t.dataset.wfdrm){const dr=wfDraft(),s=wfStep(t.dataset.wfdrm,dr);if(!s)return;const v=t.dataset.v;wfHistDeps(s.phaseId);wfMutate(d=>{s.deps=s.deps.filter(x=>x!==v);wfUnbranch(d,v,s.id)});wfPrereqRefresh();return}
  const id=t.dataset.wfdclr||t.dataset.sid,s=wfStep(id,wfEdit());if(!s)return;const st=wfDPState(id,s.phaseId);
  if(t.dataset.wfdclr){st.q='';st.types=[];st.atypes=[];st.svcs=[];st.phases=[];wfDPRefresh(id,`[data-wfdq="${id}"]`);return}
  const k=t.dataset.wfdf,v=t.dataset.v;
  if(k==='phases'&&v==='_all')st.phases=[];else{const a=new Set(st[k]||[]);a.has(v)?a.delete(v):a.add(v);st[k]=[...a]}
  wfDPRefresh(id,`[data-wfdf="${k}"][data-sid="${id}"][data-v="${v}"]`)},true);

/* ---------- floating editor next to a block: "Add prerequisites" and "Show details" ----------
   Fixed on the screen beside the block, with its own scroll. Opening, editing and closing it never scrolls the
   page or the diagram; changes go through the same handlers as the matrix, so both stay in sync. */
function openWfPrereq(id){wfFloatOpen('pre',id)}
function wfPrereqRefresh(){wfFloatRefresh()}
function wfFloatInner(){const f=ui.wfFloat,ed=wfEdit(),s=f&&wfStep(f.id,ed);if(!s)return '';
  if(f.kind==='pre')return `<p class="hint" style="margin:0 0 6px">Tick what this activity needs first, also from other phases. A → B means B depends on A. Changes go to the Company workflow draft.</p>${wfDepPicker(s,ed)}`;
  return `<label class="cp-in"><span>Name</span><input class="in" id="wff-${s.id}-n" data-wfs="${s.id}" data-f="name" value="${esc(s.name)}" maxlength="160"></label>${wfStepFields(s,ed,'wff')}`}
function wfFloatOpen(kind,id){
  const ed=wfEdit(),s=wfStep(id,ed);if(!s)return;wfFloatClose(true);ui.wfFloat={kind,id};ui.wfSel=id;
  const el=document.createElement('div');el.id='wffloat';el.className='wffloat';el.setAttribute('role','dialog');el.setAttribute('aria-label',kind==='pre'?'Prerequisites':'Activity details');
  el.innerHTML=`<div class="wff-h"><div><div class="eyebrow">${esc(phName(s.phaseId))} · ${esc(wfSpecName(wfSpecOf(s)))} · ${WF_CAT[s.cat]}</div><b>${kind==='pre'?'Prerequisites of “'+esc(s.name)+'”':esc(s.name)}</b></div><button type="button" class="x" data-wff-close aria-label="Close">×</button></div><div class="wff-b">${wfFloatInner()}</div><div class="wff-f"><button type="button" class="btn sm primary" data-wff-close>Done</button></div>`;
  document.body.appendChild(el);wfFloatPlace();setTimeout(wfFloatPlace,0);
  const f=el.querySelector(kind==='pre'?'[data-wfdq]':'input[data-f=name]');f&&f.focus({preventScroll:true});
}
function wfFloatPlace(){const el=document.getElementById('wffloat');if(!el||!ui.wfFloat)return;const n=document.getElementById('wfn-'+ui.wfFloat.id);let W=Math.min(460,innerWidth-24);
  /* beside the block (never over it): the side with room, narrower if needed, else below or above it */
  const r=n?n.getBoundingClientRect():{left:innerWidth/2,right:innerWidth/2,top:120,bottom:120},roomR=innerWidth-8-(r.right+12),roomL=r.left-20;let left,top;
  const fitH=()=>Math.min(el.offsetHeight||560,innerHeight-80);
  if(roomR>=W||roomL>=W||Math.max(roomR,roomL)>=320){el.style.maxHeight='';if(roomR<W&&roomL<W)W=Math.max(roomR,roomL);el.style.width=W+'px';left=roomR>=W?r.right+12:r.left-12-W;
    const h=fitH();top=Math.max(64,Math.min(r.top,innerHeight-h-12))}
  else{el.style.width=W+'px';const h=fitH();left=Math.max(8,Math.min(r.left,innerWidth-W-8));top=innerHeight-(r.bottom+12)>=Math.min(h,320)||r.top-12<h?r.bottom+12:r.top-12-h;
    el.style.maxHeight=Math.max(200,top>=r.bottom?innerHeight-top-12:r.top-12-Math.max(64,top))+'px';top=Math.max(64,top)}
  el.style.left=Math.round(left)+'px';el.style.top=Math.round(top)+'px'}
/* the editor stays beside its block while the page or the diagram scrolls */
let wfFloatRaf=0;document.addEventListener('scroll',()=>{if(!ui.wfFloat||wfFloatRaf)return;wfFloatRaf=requestAnimationFrame(()=>{wfFloatRaf=0;wfFloatPlace()})},true);
window.addEventListener('resize',()=>{if(ui.wfFloat)wfFloatPlace()});
function wfFloatRefresh(){const el=document.getElementById('wffloat');if(!el||!ui.wfFloat)return;if(!wfStep(ui.wfFloat.id,wfEdit())){wfFloatClose(true);return}wfFloatPlace();
  const a=document.activeElement,aid=a&&el.contains(a)&&a.id?a.id:null,sel=a&&typeof a.selectionStart==='number'?[a.selectionStart,a.selectionEnd]:null,b=el.querySelector('.wff-b'),st=b.scrollTop,lst=el.querySelector('.wfdp-list'),ls=lst&&lst.scrollTop;
  b.innerHTML=wfFloatInner();b.scrollTop=st;const l2=el.querySelector('.wfdp-list');if(l2&&ls)l2.scrollTop=ls;
  if(aid){const f=document.getElementById(aid);if(f){f.focus({preventScroll:true});try{if(sel)f.setSelectionRange(sel[0],sel[1])}catch(_){}}}}
function wfFloatClose(silent){const el=document.getElementById('wffloat');const id=ui.wfFloat&&ui.wfFloat.id;ui.wfFloat=null;if(el)el.remove();
  if(!silent&&id){const n=document.getElementById('wfn-'+id);n&&n.focus({preventScroll:true})}}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-wff-close]')){e.preventDefault();wfFloatClose()}},true);

/* project cards: details per card; "Edit in Company workflow" opens the activity in the standard */
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-wfexpt],[data-wfgoto]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();
  if(t.dataset.wfexpt){const id=t.dataset.wfexpt;ui.wfExpT=ui.wfExpT||new Set();ui.wfExpT.has(id)?ui.wfExpT.delete(id):ui.wfExpT.add(id);render();const b=document.querySelector(`[data-wfexpt="${id}"]`);b&&b.focus({preventScroll:true});return}
  const s=wfStep(t.dataset.wfgoto);if(!s)return;prefs.wfSetPhase=s.phaseId;prefs.wfSetSpecs=[];ui.stab='workflow';prefs.stab='workflow';ui.wfSel=s.id;ui.wfExp=ui.wfExp||new Set();ui.wfExp.add(s.id);savePrefs();go('settings');
  setTimeout(()=>{const c=document.getElementById('wfc-'+s.id);c&&c.scrollIntoView({block:'center'})},60)},true);
