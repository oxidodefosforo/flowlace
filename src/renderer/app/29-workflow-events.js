/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- events ---------- */
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.wfs){const dr=wfDraft(),s=wfStep(el.dataset.wfs,dr);if(!s)return;const f=el.dataset.f;
    if(f==='name'){const v=el.value.trim();if(!v){fieldError(el,'A step needs a name.');el.value=s.name;return}clearFieldError(el);if(v===s.name)return;wfMutate(()=>{s.name=v.slice(0,160)});return}
    if(f==='question'){s.question=el.value.trim().slice(0,300);save(true);setSaveInd();wfRerender();return}
    if(f==='type'){wfChangeType(s.id,el.value,el);return}
    if(f==='desc'){s.desc=el.value;save(true);setSaveInd();
      /* the floating editor and the matrix card show the same activity: keep both in step without re-rendering (focus and scroll stay) */
      const card=document.getElementById('wfc-'+s.id),cd=card&&card.querySelector('.wfc-desc');if(cd){if(s.desc)cd.textContent=s.desc;else cd.remove()}else if(card&&s.desc&&!card.classList.contains('open')){const h=card.querySelector('.wfc-h');h&&h.insertAdjacentHTML('afterend',`<div class="wfc-desc">${esc(s.desc)}</div>`)}
      document.querySelectorAll(`[data-wfs="${CSS.escape(s.id)}"][data-f=desc]`).forEach(x=>{if(x!==el)x.value=s.desc});return}
    if(f==='serviceId'){if(!service(el.value))return;wfMutate(d=>{s.serviceId=el.value;wfForget(d,s.id,true);wfPlaceInViews(d,s)});const c=document.getElementById(`wfs-${s.id}-s`);c&&c.focus({preventScroll:true});return}
    if(f==='cat'){wfMutate(d=>{const col=wfColSteps(d,s.phaseId,el.value);s.cat=el.value;s.order=col.length?Math.max(...col.map(x=>x.order))+1:0;
      /* a new category means a new zone: its manual place (if any) is recalculated there */
      wfForget(d,s.id,true);wfPlaceInViews(d,s)});return}}
  if(el.dataset.wfbr){const dr=wfDraft(),d=wfStep(el.dataset.id,dr),b=el.dataset.wfbr,v=el.value;if(!d)return;
    if(v==='_new'){el.value=(d.branches||{})[b]||'';wfNewBranchTarget(d.id,b);return}
    if(!v){wfHistDeps(d.phaseId);let note='';wfMutate(x=>{note=wfSetBranch(x,d.id,b,null)});toast(`${b==='yes'?'Yes':'No'} outlet of “${d.name}” is not set. ${note}`);return}
    wfPickBranch(d.id,b,v);return}
  if(el.dataset.wfdep){const dr=wfDraft(),s=wfStep(el.dataset.wfdep,dr),dep=el.value;if(!s)return;
    if(el.checked){const why=wfLinkProblem(dr,dep,s.id);if(why){el.checked=false;toast(why,'err');return}wfHistDeps(s.phaseId);wfMutate(d=>{s.deps.push(dep);wfFixOrder(d,s.phaseId)})}
    else{wfHistDeps(s.phaseId);wfMutate(d=>{s.deps=s.deps.filter(x=>x!==dep);wfUnbranch(d,dep,s.id)})}
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
  const v=f.elements.name.value.trim();if(!v){fieldError(f.elements.name,'Type a name first.');return}ui.focusAfter=f.elements.name.id;const ph=f.dataset.ph||(f.elements.ph&&f.elements.ph.value);if(!phase(ph))return;wfAddStep(f.dataset.cat,ph,v.slice(0,160),f.elements.spec.value,f.elements.type?f.elements.type.value:'normal')},true);
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
    case 'wf-sphase':prefs.wfSetPhase=a.dataset.v;ui.wfSel=null;ui.wfLocate=null;savePrefs();render();return true;
    case 'wf-sspec':prefs.wfSetSpecs=wfToggleSpec(prefs.wfSetSpecs,a.dataset.v,wfSpecs());savePrefs();render();{const b=document.querySelector(`[data-act=wf-sspec][data-v="${a.dataset.v}"]`);b&&b.focus({preventScroll:true})}return true;
    case 'wf-pphase':prefs.wfPhase={...(prefs.wfPhase||{}),[a.dataset.pid]:a.dataset.v};ui.wfSel=null;savePrefs();render();return true;
    case 'wf-stype':prefs.wfSetTypes=wfToggleSpec(prefs.wfSetTypes,a.dataset.v,WF_TYPES.map(x=>x[0]));savePrefs();render();{const b=document.querySelector(`[data-act=wf-stype][data-v="${a.dataset.v}"]`);b&&b.focus({preventScroll:true})}return true;
    case 'wf-ptype':prefs.wfTypes={...(prefs.wfTypes||{}),[a.dataset.pid]:wfToggleSpec((prefs.wfTypes||{})[a.dataset.pid],a.dataset.v,WF_TYPES.map(x=>x[0]))};savePrefs();render();{const b=document.querySelector(`[data-act=wf-ptype][data-v="${a.dataset.v}"]`);b&&b.focus({preventScroll:true})}return true;
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


/* ---------- Activity type, outlets and answers ---------- */
/* removing a dependency that was a Decision / QA outlet also clears that outlet (said, never silent) */
function wfUnbranch(dr,decId,tid){const d=wfStep(decId,dr);if(!d||!d.branches)return;WF_BR.forEach(([k,l])=>{if(d.branches[k]===tid){d.branches[k]=null;toast(`The ${l} outlet of “${d.name}” is not set any more.`)}})}
/* a new type keeps id, name, description, category, phase, specialty, dependencies, roles, tasks and layout; leaving
   Decision / QA with outlets set asks what to do with those links before saving */
async function wfChangeType(id,v,el){const dr=wfDraft(),s=wfStep(id,dr);if(!s||!WF_TYPE[v]||v===wfType(s))return;
  const was=wfIsDec(s),will=v==='decision'||v==='qa',b=s.branches||{},tg=[b.yes,b.no].filter(Boolean).map(x=>wfStep(x,dr)).filter(Boolean);
  let mode='keep';
  if(was&&!will&&tg.length){mode=await choiceBox('Change the activity type?',`“${esc(s.name)}” has outlets: ${tg.map(x=>`<b>${esc(x.name)}</b> (${b.yes===x.id?'Yes':'No'})`).join(', ')}.<br>A ${esc(WF_TYPE[v])} has no Yes / No. Keep those activities as normal dependencies (they will always be needed), or remove the links?`,[{v:'keep',l:'Keep as dependencies',c:'primary'},{v:'drop',l:'Remove the links'}]);
    if(!mode){if(el)el.value=wfType(s);return}}
  wfHistDeps(s.phaseId);
  wfMutate(d=>{const x=wfStep(id,d);if(mode==='drop')tg.forEach(t=>{const y=wfStep(t.id,d);if(y)y.deps=y.deps.filter(z=>z!==id)});if(!will)x.branches={yes:null,no:null};else x.branches=x.branches||{yes:null,no:null};x.type=v});
  toast(`“${s.name}” is now ${WF_TYPE[v]}.${was&&!will&&tg.length?(mode==='keep'?' Its outlets are now normal dependencies.':' Its outlet links were removed.'):''}${will&&!was?' Set its Yes and No outlets.':''}`);
  const f=document.getElementById(el&&el.id);f&&f.focus({preventScroll:true})}
/* an outlet to a new activity: asked explicitly (nothing empty is created) */
function wfNewBranchTarget(decId,b){const d=wfStep(decId,wfEdit());if(!d)return;
  openModal(`<form data-form="wf-newbr" data-dec="${d.id}" data-b="${b}"><div class="m-head"><div><div class="eyebrow">${esc(d.name)}</div><h2>New activity for “${b==='yes'?'Yes':'No'}”</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <label class="cp-in"><span>Name</span><input class="in" name="name" maxlength="160" required placeholder="${b==='yes'?'e.g. Size emergency power supply':'e.g. Continue with normal supply'}"></label>
    <div class="wfc-2"><label class="cp-in"><span>Category</span><select class="in" name="cat">${WF_COLS.map(([k])=>`<option value="${k}"${k==='action'?' selected':''}>${WF_CAT[k]}</option>`).join('')}</select></label>
    <label class="cp-in"><span>Activity type</span><select class="in" name="type">${WF_TYPES.map(([k,l])=>`<option value="${k}">${esc(l)}</option>`).join('')}</select></label></div>
    <label class="cp-in"><span>Specialty</span><select class="in" name="spec">${wfSpecs(wfEdit()).filter(x=>x!=='_none').map(x=>`<option value="${x}"${x===d.serviceId?' selected':''}>${esc(wfSpecName(x))}</option>`).join('')}</select></label>
    <p class="hint">It goes in ${esc(phName(d.phaseId))}, after “${esc(d.name)}”, and follows its ${b==='yes'?'Yes':'No'} answer.</p>
    <div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Create and connect</button></div></form>`,{focus:'input[name=name]'})}
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form!=='wf-newbr')return;e.preventDefault();e.stopImmediatePropagation();
  const name=f.elements.name.value.trim();if(!name){fieldError(f.elements.name,'Type a name first.');return}const decId=f.dataset.dec,b=f.dataset.b,dr=wfEdit(),d=wfStep(decId,dr);if(!d)return;
  closeModal(true);const hint=wfViewHint(),cx=wfCurCtx();wfHistDeps(d.phaseId);let id=null;
  wfMutate(x=>{const cat=f.elements.cat.value,col=wfColSteps(x,d.phaseId,cat),st={id:uid('ws'),phaseId:d.phaseId,serviceId:service(f.elements.spec.value)?f.elements.spec.value:null,cat,name:name.slice(0,160),desc:'',deps:[],order:col.length?Math.max(...col.map(y=>y.order))+1:0,retired:false,createdAt:new Date().toISOString(),roleIds:[],type:WF_TYPE[f.elements.type.value]?f.elements.type.value:'normal',question:'',branches:{yes:null,no:null}};
    id=st.id;x.steps.push(st);if(cx&&cx.scope==='std'&&cx.derived&&cx.own){x.layout={...(x.layout||{}),[cx.key]:wfClone(cx.own)}}wfSetBranch(x,decId,b,st.id);wfInsertInLayout(x,st,hint)});
  toast(`“${name}” created: ${b==='yes'?'Yes':'No'} of “${d.name}”.`);if(id&&document.getElementById('wfn-'+id)&&!wfInView(id)){ui.wfLocate=id;wfRerender()}},true);
/* a project answer: Pending / Yes / No. Changing it shows what changes path; nothing done, assigned or logged is lost */
function wfOffSet(pid){const memo={};return new Set(S.tasks.filter(t=>t.projectId===pid&&t.wfStepId&&wfLive(t)&&wfOffTask(t,memo)).map(t=>t.id))}
async function wfSetAnswer(tid,v){const t=S.tasks.find(x=>x.id===tid);if(!t)return;const s=wfStep(t.wfStepId);if(!s||!wfIsDec(s))return;const nv=v==='yes'||v==='no'?v:null;if((t.wfAnswer||null)===nv)return;
  const before=wfOffSet(t.projectId),old=t.wfAnswer;t.wfAnswer=nv;const after=wfOffSet(t.projectId);t.wfAnswer=old;
  const leave=[...after].filter(x=>!before.has(x)).map(x=>S.tasks.find(y=>y.id===x)),back=[...before].filter(x=>!after.has(x)).map(x=>S.tasks.find(y=>y.id===x));
  const nm=x=>`<li>${esc(x.name)}${x.status!=='To Do'?` <span class="muted">(${esc(x.status)}${x.assignedToId?' · '+esc(pname(x.assignedToId)):''})</span>`:''}</li>`;
  if(old&&(leave.length||back.length)){const ok=await confirmBox('Change the answer?',`“${esc(s.name)}”: ${old==='yes'?'Yes':'No'} → ${nv==='yes'?'Yes':nv==='no'?'No':'Pending'}.${leave.length?`<br><b>Leave the chosen path</b> (kept as they are, not counted as pending):<ul class="mini-list">${leave.map(nm).join('')}</ul>`:''}${back.length?`<b>Back on the path</b>:<ul class="mini-list">${back.map(nm).join('')}</ul>`:''}Work done, responsibles and history are kept.`,'Change answer');if(!ok)return}
  const now=new Date().toISOString();t.wfAnswerLog=[...(t.wfAnswerLog||[]),{at:now,from:old||null,to:nv,by:typeof SY!=='undefined'&&SY.user?SY.user.id||null:null}];t.wfAnswer=nv;t.updatedAt=now;
  if(!nv&&t.status==='Done'){t.status='In progress';t.completedAt=null;toast(`“${s.name}” is back in progress: a Decision / QA is completed with its answer.`)}
  save();render();toast(`${s.name}: ${nv==='yes'?'Yes':nv==='no'?'No':'Pending'}${leave.length?` · ${plural(leave.length,'activity','activities')} not on the chosen path`:''}`)}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-wfans]');if(!b)return;e.preventDefault();e.stopPropagation();wfSetAnswer(b.dataset.tid,b.dataset.wfans)},true);
