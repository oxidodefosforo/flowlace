/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- "Depends on" picker: search + Type / Service / Phase filters, selected ones kept apart ----------
   Used in the step details (Company workflow matrix) and in "Add prerequisite…" from the diagram. Filters combine
   with AND; the options of one filter with OR. Filters only change what is listed: they never remove a selection.
   The selection is the step's deps array in the draft — the same data the diagram and the matrix show. */
function wfDPState(id,ph){ui.wfDF=ui.wfDF||{};return ui.wfDF[id]||(ui.wfDF[id]={q:'',types:[],svcs:[],phases:[ph]})}
function wfDPResults(s,ed){
  const st=wfDPState(s.id,s.phaseId),q=st.q.trim().toLowerCase(),order=wfSpecs(ed);
  return ed.steps.filter(x=>!x.retired&&(!q||(x.name+' '+(x.desc||'')).toLowerCase().includes(q))&&(!st.types.length||st.types.includes(x.cat))&&(!st.svcs.length||st.svcs.includes(wfSpecOf(x)))&&(!st.phases.length||st.phases.includes(x.phaseId)))
    .sort((a,b)=>S.phases.findIndex(p=>p.id===a.phaseId)-S.phases.findIndex(p=>p.id===b.phaseId)||order.indexOf(wfSpecOf(a))-order.indexOf(wfSpecOf(b))||WF_COLS.findIndex(c=>c[0]===a.cat)-WF_COLS.findIndex(c=>c[0]===b.cat)||a.order-b.order);
}
function wfDPWhy(s,x,ed){if(x.id===s.id)return 'An activity can’t depend on itself';if(!s.deps.includes(x.id)&&wfCycle(ed,s.id,x.id))return `Not possible: “${x.name}” already depends on “${s.name}” (it would create a loop)`;return ''}
const wfDPMeta=x=>`${WF_CAT[x.cat]} · ${esc(wfSpecName(wfSpecOf(x)))} · ${esc(phName(x.phaseId))}`;
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
      <div class="wfdp-g" role="group" aria-label="Type"><span>Type</span>${WF_COLS.map(([k])=>chip('types',k,WF_CAT[k],st.types.includes(k))).join('')}</div>
      <div class="wfdp-g" role="group" aria-label="Service"><span>Service</span>${wfSpecs(ed).map(id=>chip('svcs',id,wfSpecName(id),st.svcs.includes(id))).join('')}</div>
      <div class="wfdp-g" role="group" aria-label="Phase"><span>Phase</span>${chip('phases','_all','All phases',!st.phases.length)}${phs.map(g=>chip('phases',g.id,g.name,st.phases.includes(g.id))).join('')}</div>
      <button type="button" class="btn sm ghost" data-wfdclr="${s.id}">Clear filters</button></div>
    <div class="wfdp-res">${wfDPList(s,ed)}</div></div>`;
}
function wfDPRefresh(id,focus){const ed=wfEdit(),s=wfStep(id,ed);if(!s)return;document.querySelectorAll(`#wfdp-${CSS.escape(id)}`).forEach(el=>{el.outerHTML=wfDepPicker(s,ed)});if(focus){const f=document.querySelector(focus);f&&f.focus()}}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.wfdq)return;const s=wfStep(el.dataset.wfdq,wfEdit());if(!s)return;
  wfDPState(s.id,s.phaseId).q=el.value;const box=el.closest('.wfdp');if(box){const r=box.querySelector('.wfdp-res');if(r)r.innerHTML=wfDPList(s,wfEdit())}},true);
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-wfdf],[data-wfdclr],[data-wfdrm]');if(!t)return;e.preventDefault();e.stopPropagation();
  if(t.dataset.wfdrm){const dr=wfDraft(),s=wfStep(t.dataset.wfdrm,dr);if(!s)return;const v=t.dataset.v;wfMutate(()=>{s.deps=s.deps.filter(x=>x!==v)});wfPrereqRefresh();return}
  const id=t.dataset.wfdclr||t.dataset.sid,s=wfStep(id,wfEdit());if(!s)return;const st=wfDPState(id,s.phaseId);
  if(t.dataset.wfdclr){st.q='';st.types=[];st.svcs=[];st.phases=[];wfDPRefresh(id,`[data-wfdq="${id}"]`);return}
  const k=t.dataset.wfdf,v=t.dataset.v;
  if(k==='phases'&&v==='_all')st.phases=[];else{const a=new Set(st[k]);a.has(v)?a.delete(v):a.add(v);st[k]=[...a]}
  wfDPRefresh(id,`[data-wfdf="${k}"][data-sid="${id}"][data-v="${v}"]`)},true);

/* "Add prerequisite…" from the diagram: the same picker in a dialog, live (it edits the draft directly) */
function openWfPrereq(id){const ed=wfEdit(),s=wfStep(id,ed);if(!s)return;ui.wfPre=id;
  openModal(`<div class="m-head"><div><div class="eyebrow">${esc(phName(s.phaseId))} · ${esc(wfSpecName(wfSpecOf(s)))}</div><h2>Prerequisites of “${esc(s.name)}”</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <p class="hint" style="margin-top:0">Tick what this activity needs first (also from other phases). A → B means B depends on A. Changes go to the Company workflow draft; publish to share them.</p><div id="wfpre">${wfDepPicker(s,ed)}</div>
    <div class="m-actions"><button type="button" class="btn primary" data-act="modal-close">Done</button></div>`,{wide:true,focus:`[data-wfdq="${id}"]`});}
function wfPrereqRefresh(){const b=document.getElementById('wfpre');if(!b||!ui.wfPre)return;const s=wfStep(ui.wfPre,wfEdit());if(s)b.innerHTML=wfDepPicker(s,wfEdit())}

/* project cards: details per card; "Edit in Company workflow" opens the activity in the standard */
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-wfexpt],[data-wfgoto]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();
  if(t.dataset.wfexpt){const id=t.dataset.wfexpt;ui.wfExpT=ui.wfExpT||new Set();ui.wfExpT.has(id)?ui.wfExpT.delete(id):ui.wfExpT.add(id);render();const b=document.querySelector(`[data-wfexpt="${id}"]`);b&&b.focus();return}
  const s=wfStep(t.dataset.wfgoto);if(!s)return;prefs.wfSetPhase=s.phaseId;prefs.wfSetSpecs=[];ui.stab='workflow';prefs.stab='workflow';ui.wfSel=s.id;ui.wfExp=ui.wfExp||new Set();ui.wfExp.add(s.id);savePrefs();go('settings');
  setTimeout(()=>{const c=document.getElementById('wfc-'+s.id);c&&c.scrollIntoView({block:'center'})},60)},true);
