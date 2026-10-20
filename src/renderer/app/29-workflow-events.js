/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- events ---------- */
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.wfs){const dr=wfDraft(),s=wfStep(el.dataset.wfs,dr);if(!s)return;const f=el.dataset.f;
    if(f==='name'){const v=el.value.trim();if(!v){fieldError(el,'A step needs a name.');el.value=s.name;return}clearFieldError(el);if(v===s.name)return;wfMutate(()=>{s.name=v.slice(0,160)});return}
    if(f==='desc'){s.desc=el.value;save(true);setSaveInd();
      /* the floating editor and the matrix card show the same activity: keep both in step without re-rendering (focus and scroll stay) */
      const card=document.getElementById('wfc-'+s.id),cd=card&&card.querySelector('.wfc-desc');if(cd){if(s.desc)cd.textContent=s.desc;else cd.remove()}else if(card&&s.desc&&!card.classList.contains('open')){const h=card.querySelector('.wfc-h');h&&h.insertAdjacentHTML('afterend',`<div class="wfc-desc">${esc(s.desc)}</div>`)}
      document.querySelectorAll(`[data-wfs="${CSS.escape(s.id)}"][data-f=desc]`).forEach(x=>{if(x!==el)x.value=s.desc});return}
    if(f==='serviceId'){if(!service(el.value))return;wfMutate(()=>{s.serviceId=el.value});const c=document.getElementById(`wfs-${s.id}-s`);c&&c.focus({preventScroll:true});return}
    if(f==='cat'){wfMutate(d=>{const col=wfColSteps(d,s.phaseId,el.value);s.cat=el.value;s.order=col.length?Math.max(...col.map(x=>x.order))+1:0;
      /* a new category means a new zone: its manual place (if any) is recalculated there */
      if(d.layout&&d.layout[s.phaseId]&&d.layout[s.phaseId].n){delete d.layout[s.phaseId].n[s.id];wfInsertInLayout(d,s)}});return}}
  if(el.dataset.wfdep){const dr=wfDraft(),s=wfStep(el.dataset.wfdep,dr),dep=el.value;if(!s)return;
    if(el.checked){const why=wfLinkProblem(dr,dep,s.id);if(why){el.checked=false;toast(why,'err');return}wfHistDeps(s.phaseId);wfMutate(d=>{s.deps.push(dep);wfFixOrder(d,s.phaseId)})}
    else{wfHistDeps(s.phaseId);wfMutate(()=>{s.deps=s.deps.filter(x=>x!==dep)})}
    wfPrereqRefresh();
    const c=document.querySelector(`#wffloat [data-wfdep="${s.id}"][value="${dep}"]`)||document.querySelector(`[data-wfdep="${s.id}"][value="${dep}"]`);c&&c.focus({preventScroll:true});return}
  if(el.dataset.wfdone){const t=S.tasks.find(x=>x.id===el.dataset.wfdone);if(!t)return;ui.focusAfter=null;moveTask(t,'status',el.checked?'Done':'To Do');const c=document.querySelector(`[data-wfdone="${t.id}"]`);c&&c.focus({preventScroll:true});return}
  if(el.dataset.wfcons){const t=S.tasks.find(x=>x.id===el.dataset.wfcons);if(!t)return;t.wfConsultant=el.value.trim().slice(0,120);t.updatedAt=new Date().toISOString();save();setSaveInd();return}
  if(el.dataset.dreq){const d=deliv(el.dataset.dreq),t=S.tasks.find(x=>x.id===el.value);if(!d||!t||t.projectId!==d.projectId)return;
    const set=new Set(d.reqTaskIds||[]);el.checked?set.add(t.id):set.delete(t.id);d.reqTaskIds=[...set];save();render();const c=document.querySelector(`[data-dreq="${d.id}"][value="${t.id}"]`);c&&c.focus({preventScroll:true});return}
},true);
/* workflow tasks: name, project, deliverable link and phase come from the standard */
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset||el.dataset.ent!=='t')return;const f=el.dataset.f;if(!['name','projectId','deliverableId','phaseId'].includes(f))return;
  const t=S.tasks.find(x=>x.id===el.dataset.id);if(!t||!t.wfStepId)return;e.stopImmediatePropagation();
  el.value=f==='name'?t.name:(t[f]||'');toast(f==='name'?'Workflow task names come from Settings → Company workflow.':f==='deliverableId'?'Link workflow tasks to deliverables as requirements (in the deliverable panel), so one task can serve several deliveries.':'Workflow tasks stay in their project and phase.','err')},true);
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form!=='wf-add')return;e.preventDefault();e.stopImmediatePropagation();
  const v=f.elements.name.value.trim();if(!v){fieldError(f.elements.name,'Type a name first.');return}ui.focusAfter=f.elements.name.id;const ph=f.dataset.ph||(f.elements.ph&&f.elements.ph.value);if(!phase(ph))return;wfAddStep(f.dataset.cat,ph,v.slice(0,160),f.elements.spec.value)},true);
document.addEventListener('click',e=>{const c=e.target.closest&&e.target.closest('[data-wfc]');if(!c||e.target.closest('input,select,textarea,[data-act]:not([data-wfsel])'))return;
  const id=c.dataset.wfc;if(ui.wfSel===id&&!e.target.closest('[data-wfsel]'))return;wfSelect(id)});
function wfSelect(id){ui.wfSel=id;
  document.querySelectorAll('.wfn.sel,.wfc.sel').forEach(x=>x.classList.remove('sel'));document.querySelectorAll('.wfn[aria-pressed="true"]').forEach(x=>x.setAttribute('aria-pressed','false'));
  const n=document.getElementById('wfn-'+id),c=document.getElementById('wfc-'+id);if(n){n.classList.add('sel');n.setAttribute('aria-pressed','true')}if(c)c.classList.add('sel');
  document.querySelectorAll('.wfe.hot').forEach(p=>p.classList.remove('hot'));
  const wrap=document.querySelector('.wfd-wrap');if(wrap){const sl=wrap.scrollLeft,st=wrap.scrollTop,m=document.getElementById('main'),ms=m&&m.scrollTop;render();const w2=document.querySelector('.wfd-wrap');if(w2){w2.scrollLeft=sl;w2.scrollTop=st}if(m)m.scrollTop=ms}
}
function wfAct(act,a){
  const id=a.dataset.id;
  switch(act){
    case 'wf-sphase':prefs.wfSetPhase=a.dataset.v;ui.wfSel=null;savePrefs();render();return true;
    case 'wf-sspec':prefs.wfSetSpecs=wfToggleSpec(prefs.wfSetSpecs,a.dataset.v,wfSpecs());savePrefs();render();{const b=document.querySelector(`[data-act=wf-sspec][data-v="${a.dataset.v}"]`);b&&b.focus({preventScroll:true})}return true;
    case 'wf-pphase':prefs.wfPhase={...(prefs.wfPhase||{}),[a.dataset.pid]:a.dataset.v};ui.wfSel=null;savePrefs();render();return true;
    case 'wf-pspec':prefs.wfSpecs={...(prefs.wfSpecs||{}),[a.dataset.pid]:wfToggleSpec((prefs.wfSpecs||{})[a.dataset.pid],a.dataset.v,wfSpecs())};savePrefs();render();{const b=document.querySelector(`[data-act=wf-pspec][data-v="${a.dataset.v}"]`);b&&b.focus({preventScroll:true})}return true;
    case 'wf-node':{if(ui.view==='project'&&a.dataset.tid){ui.wfSel=id;openPanel('task',a.dataset.tid);return true}if(ui.view==='project'){toast('This requirement has no record in the project yet. Use Import activities to bring it in or mark it as an external input.');return true}wfSelect(id);return true}   // selecting never scrolls to the matrix
    case 'wf-sel':{const s=wfStep(id,wfEdit());if(s&&ui.view==='settings'&&prefs.wfSetPhase!=='_all'&&s.phaseId!==prefs.wfSetPhase){prefs.wfSetPhase=s.phaseId;savePrefs()}wfSelect(id);return true}
    case 'wf-exp':ui.wfExp=ui.wfExp||new Set();ui.wfExp.has(id)?ui.wfExp.delete(id):ui.wfExp.add(id);ui.wfSel=id;render();{const b=document.querySelector(`[data-act=wf-exp][data-id="${id}"]`);b&&b.focus({preventScroll:true})}return true;
    case 'wf-move':{const dr=wfDraft(),s=wfStep(id,dr);if(!s)return true;const col=wfColSteps(dr,s.phaseId,s.cat),i=col.indexOf(s),j=i+(+a.dataset.d);if(j<0||j>=col.length)return true;
      col.splice(i,1);col.splice(j,0,s);col.forEach((x,k)=>x.order=k);save(true);setSaveInd();render();const b=document.querySelector(`[data-act=wf-move][data-id="${id}"][data-d="${a.dataset.d}"]:not([disabled])`)||document.querySelector(`[data-act=wf-move][data-id="${id}"]:not([disabled])`);b&&b.focus({preventScroll:true});return true}
    case 'wf-retire':wfRetire(id);return true;
    case 'wf-restore':wfMutate(dr=>{const s=wfStep(id,dr);if(s){s.retired=false;const col=wfColSteps(dr,s.phaseId,s.cat).filter(x=>x!==s);s.order=col.length?Math.max(...col.map(x=>x.order))+1:0}});toast('Step restored. Publish, then projects can import it again (their existing tasks are reused).');return true;
    case 'wf-save':wfApply();return true;
    case 'wf-discard':S.workflowDraft=null;ui.wfSel=null;save();render();toast('Changes discarded');return true;
    case 'wf-goto-settings':ui.stab='workflow';prefs.stab='workflow';savePrefs();go('settings');return true;
    case 'wf-req-edit':ui.reqEdit=ui.reqEdit===id?null:id;render();{const b=document.querySelector(`[data-act=wf-req-edit][data-id="${id}"]`);b&&b.focus({preventScroll:true})}return true;
    case 'wf-import':openWfImport(a.dataset.pid,a.dataset.ph||((prefs.wfPhase||{})[a.dataset.pid]!=='_all'?(prefs.wfPhase||{})[a.dataset.pid]:null));return true;
    case 'wf-reviewed':{const t=S.tasks.find(x=>x.id===id);if(t){t.wfReview=false;save();render();toast('Marked as reviewed. The change stays in the task history.')}return true}
  }
  return false;
}

