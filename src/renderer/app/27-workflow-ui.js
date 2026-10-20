/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* the diagram itself (geometry, layout and editing) is in 27a-workflow-layout.js */
/* Settings: nodes of the standard for a phase and some specialties, plus references to what they need outside the view */
function wfStdNodes(ed,ph,specs){
  const inView=s=>s.phaseId===ph&&!s.retired&&(!specs||specs.includes(wfSpecOf(s)));
  const vis=ed.steps.filter(inView),ids=new Set(vis.map(s=>s.id)),out=[],extL=new Set();
  vis.forEach(s=>{const rl=(s.roleIds||[]).filter(r=>role(r)).map(roleName);out.push({id:s.id,cat:s.cat,lane:wfSpecOf(s),name:s.name,kind:`${WF_CAT[s.cat]} · ${wfSpecName(wfSpecOf(s))}`,sub:rl.length?'Role: '+rl.join(' or '):'No responsible role',deps:s.deps,cls:s.serviceId?'':'unclassified'})});
  vis.forEach(s=>s.deps.forEach(d=>{if(ids.has(d))return;const x=wfStep(d,ed);if(!x||x.retired)return;ids.add(d);const other=x.phaseId!==ph,lane=other?'_ref':wfSpecOf(x);if(!other)extL.add(lane);
    out.push({id:x.id,cat:x.cat,lane,name:x.name,kind:`${other?'From '+phName(x.phaseId)+' · ':'Reference · '}${wfSpecName(wfSpecOf(x))}`,deps:[],ref:true,cls:'ref'})}));
  return {nodes:out,extL};
}
/* All phases: every activity once, in its phase; what it needs outside the specialty filter is drawn in its own phase */
function wfStdNodesAll(ed,phs,specs){
  const inPh=new Set(phs),inView=s=>!s.retired&&inPh.has(s.phaseId)&&(!specs||specs.includes(wfSpecOf(s)));
  const vis=ed.steps.filter(inView),ids=new Set(vis.map(s=>s.id)),out=[],extL=new Set();
  vis.forEach(s=>{const rl=(s.roleIds||[]).filter(r=>role(r)).map(roleName);out.push({id:s.id,ph:s.phaseId,cat:s.cat,lane:wfSpecOf(s),name:s.name,kind:`${WF_CAT[s.cat]} · ${wfSpecName(wfSpecOf(s))}`,sub:rl.length?'Role: '+rl.join(' or '):'No responsible role',deps:s.deps,cls:s.serviceId?'':'unclassified'})});
  vis.forEach(s=>s.deps.forEach(d=>{if(ids.has(d))return;const x=wfStep(d,ed);if(!x||x.retired||!inPh.has(x.phaseId))return;ids.add(d);const lane=wfSpecOf(x);extL.add(lane);
    out.push({id:x.id,ph:x.phaseId,cat:x.cat,lane,name:x.name,kind:`Reference · ${wfSpecName(lane)}`,deps:[],ref:true,cls:'ref'})}));
  return {nodes:out,extL};
}
/* phases in the company's order that have something to show */
const wfPhOrder=ids=>{const set=new Set(ids);return S.phases.map(g=>g.id).filter(id=>set.has(id))};
function wfPhaseTabs(cur,list,act,label,pid){return `<div class="wfph" role="tablist" aria-label="${label}">${list.map(([id,extra,lab])=>`<button role="tab" data-act="${act}" data-v="${id}"${pid?` data-pid="${pid}"`:''} aria-selected="${cur===id}">${id==='_all'?'':`<span class="sw" style="--c:${phColor(id)}"></span>`}${esc(lab||phName(id))}${extra||''}</button>`).join('')}</div>`}
function wfSpecChips(act,cur,list,pid){const all=!cur||!cur.length;
  return `<div class="wfspec" role="group" aria-label="Specialties"><span class="muted">Specialties</span><button class="chip wfsc" data-act="${act}" data-v="_all"${pid?` data-pid="${pid}"`:''} aria-pressed="${all}">All</button>${list.map(id=>`<button class="chip wfsc" data-act="${act}" data-v="${id}"${pid?` data-pid="${pid}"`:''} aria-pressed="${!all&&cur.includes(id)}">${esc(wfSpecName(id))}</button>`).join('')}</div>`}
function wfToggleSpec(cur,v,list){if(v==='_all')return [];const c=new Set(cur&&cur.length?cur:[]);c.has(v)?c.delete(v):c.add(v);const out=list.filter(x=>c.has(x));return out.length===list.length?[]:out}

/* ---------- Settings → Company workflow ---------- */
function settingsWorkflow(){
  const std=wfStd(),ed=wfEdit(),dirty=wfDirty();
  const phases=S.phases.filter(g=>g.active||ed.steps.some(s=>s.phaseId===g.id&&!s.retired));
  let ph=prefs.wfSetPhase==='_all'||(prefs.wfSetPhase&&phase(prefs.wfSetPhase))?prefs.wfSetPhase:(phases.find(g=>ed.steps.some(s=>s.phaseId===g.id&&!s.retired))||phases[0]||{}).id;
  if(!ph)return '<p class="muted">Add a phase first.</p>';
  const all=ph==='_all',allPh=wfPhOrder(ed.steps.filter(s=>!s.retired).map(s=>s.phaseId)),viewPh=all?allPh:[ph];
  const specList=wfSpecs(ed),specs=(prefs.wfSetSpecs||[]).filter(x=>specList.includes(x)),flt=specs.length?specs:null;
  const retired=viewPh.flatMap(x=>wfPhaseSteps(ed,x,true)),unc=ed.steps.filter(s=>!s.retired&&!s.serviceId).length;
  let h=`<div class="wfhead"><div><h2 style="margin:0">Company workflow ${std.demo?'<span class="chip c-w" title="Example steps to try the tool. Not Alphazeta’s real procedure.">Demo</span>':''}</h2>
    <p class="note" style="margin:4px 0 0">The global standard, by phase and specialty. Projects <b>import</b> the activities they need (Workflow tab → Import activities) and execute them; nothing is created automatically. Its structure is edited only here.</p></div>
    <div class="wfapply"><span class="muted">${std.version?`Published: v${std.version}${std.appliedAt?' · '+fmt(std.appliedAt.slice(0,10)):''}`:'Not published yet'}</span>${dirty?'<span class="chip c-w">Unsaved changes</span><button class="btn sm ghost" data-act="wf-discard">Discard</button>':''}<button class="btn sm primary" data-act="wf-save" title="Publish the standard. Projects are not changed: they review and import what they need.">Save and publish</button></div></div>`;
  if(unc)h+=`<div class="pn-warn" role="status" style="margin-bottom:8px"><span><b>${plural(unc,'step')} to classify.</b> Steps from the first version have no specialty. Choose one in each step (▾ → Specialty); projects keep their tasks.</span></div>`;
  const head=wfPhaseTabs(ph,[['_all',`<span class="cnt">${ed.steps.filter(s=>!s.retired&&allPh.includes(s.phaseId)).length}</span>`,'All phases'],...phases.map(g=>[g.id,`<span class="cnt">${ed.steps.filter(s=>s.phaseId===g.id&&!s.retired).length}</span>`])],'wf-sphase','Phase')
    +wfSpecChips('wf-sspec',specs,specList.filter(id=>ed.steps.some(s=>viewPh.includes(s.phaseId)&&!s.retired&&wfSpecOf(s)===id)||id!=='_none'));
  h+=head;
  if(ui.wfSel&&!wfStep(ui.wfSel,ed))ui.wfSel=null;
  const g=all?wfStdNodesAll(ed,allPh,flt):wfStdNodes(ed,ph,flt);
  h+=wfDiagram(g.nodes,{mode:'std',std:ed,extLanes:g.extL,phases:all?wfPhOrder(g.nodes.map(n=>n.ph)):null,fsHead:head,ctx:{scope:'std',key:all?'_global':ph},empty:all?'No steps in the Company workflow yet.':'No steps for this phase and specialty yet. Add inputs, actions and outputs in the matrix below.'});
  h+=`<p class="hint" style="margin:4px 0 10px">Arrows come from “Depends on”, also between specialties and phases. Requirements outside the selected specialties or phase are drawn as dashed reference nodes. Columns are independent lists: the same row is not a connection.</p>`;
  const addSpec=flt&&flt.length===1?flt[0]:'';
  /* All phases: the cards of each column grouped by phase (↑ ↓ order inside the phase); a new step asks for its phase */
  const addPh=all?(phases.find(g=>g.active)||phases[0]||{}).id:ph;
  h+=`<div class="wfm">${WF_COLS.map(([cat,lab])=>{const groups=viewPh.map(x=>[x,wfColSteps(ed,x,cat,flt)]),n=groups.reduce((a,[,c])=>a+c.length,0);return `<section class="wfcol c-${cat}" aria-label="${lab}"><h3>${lab} <span class="muted">${n}</span></h3>
    ${groups.map(([x,col])=>(all&&col.length?`<div class="wfcol-ph"><span class="sw" style="--c:${phColor(x)}"></span>${esc(phName(x))}</div>`:'')+col.map((s,i)=>wfStdCard(s,ed,i,col.length,col)).join('')).join('')}
    <form class="wfadd" data-form="wf-add" data-cat="${cat}" data-ph="${all?'':ph}">${all?`<select class="in" name="ph" id="wf-add-${cat}-ph" aria-label="Phase of the new ${WF_CAT[cat].toLowerCase()}">${phases.map(g=>`<option value="${g.id}"${g.id===addPh?' selected':''}>${esc(g.name)}</option>`).join('')}</select>`:''}<input class="in" name="name" id="wf-add-${cat}" placeholder="+ Add ${WF_CAT[cat].toLowerCase()}: name, then Enter" maxlength="160" autocomplete="off" aria-label="New ${WF_CAT[cat].toLowerCase()} name"><select class="in" name="spec" id="wf-add-${cat}-sp" aria-label="Specialty of the new ${WF_CAT[cat].toLowerCase()}">${wfSpecs(ed).filter(x=>x!=='_none').map(id=>`<option value="${id}"${id===addSpec?' selected':''}>${esc(wfSpecName(id))}</option>`).join('')}</select></form></section>`}).join('')}</div>`;
  if(retired.length)h+=`<details class="wfret"><summary>Retired steps (${retired.length}) · kept as history in projects</summary>${retired.map(s=>`<div class="wfret-r"><span class="chip">${WF_CAT[s.cat]}</span> ${esc(s.name)} <span class="muted">${esc(wfSpecName(wfSpecOf(s)))}</span> <button class="btn sm ghost" data-act="wf-restore" data-id="${s.id}">Restore</button></div>`).join('')}</details>`;
  return h;
}
function wfStdCard(s,ed,i,n){
  /* compact by default: name and description; specialty, roles, dependencies and the rest under "Show details" */
  const open=ui.wfExp&&ui.wfExp.has(s.id),sel=ui.wfSel===s.id,used=wfStd().steps.some(x=>x.id===s.id);
  return `<div class="wfc${sel?' sel':''}${open?' open':''}" id="wfc-${s.id}" data-wfc="${s.id}">
    <div class="wfc-h"><input class="in wfc-n" id="wfs-${s.id}-n" data-wfs="${s.id}" data-f="name" value="${esc(s.name)}" maxlength="160" aria-label="Step name"><span class="wfc-ord" aria-label="Order"><button class="iconbtn" data-act="wf-move" data-id="${s.id}" data-d="-1" aria-label="Move up"${i?'':' disabled'}>↑</button><button class="iconbtn" data-act="wf-move" data-id="${s.id}" data-d="1" aria-label="Move down"${i<n-1?'':' disabled'}>↓</button></span></div>
    ${s.desc&&!open?`<div class="wfc-desc">${esc(s.desc)}</div>`:''}
    <div class="wfc-tg"><button type="button" class="linkbtn wfc-more" data-act="wf-exp" data-id="${s.id}" aria-expanded="${!!open}" aria-controls="wfc-x-${s.id}">${open?'Hide details':'Show details'}</button></div>
    ${open?`<div class="wfc-x" id="wfc-x-${s.id}">${wfStepFields(s,ed,'wfs')}</div>`:''}</div>`;
}
/* the editable fields of a step: used by the matrix card and by the floating editor of the diagram */
function wfStepFields(s,ed,pf){const used=wfStd().steps.some(x=>x.id===s.id);
  return `<label class="cp-in"><span>Description / instructions</span><textarea class="in" rows="2" id="${pf}-${s.id}-d" data-wfs="${s.id}" data-f="desc">${esc(s.desc)}</textarea></label>
      <div class="wfc-2"><label class="cp-in"><span>Specialty</span><select class="in" id="${pf}-${s.id}-s" data-wfs="${s.id}" data-f="serviceId">${s.serviceId?'':'<option value="" selected>To classify</option>'}${wfSpecs(ed).filter(x=>x!=='_none').map(id=>`<option value="${id}"${id===s.serviceId?' selected':''}>${esc(wfSpecName(id))}</option>`).join('')}</select></label>
      <label class="cp-in"><span>Category</span><select class="in" id="${pf}-${s.id}-c" data-wfs="${s.id}" data-f="cat">${WF_COLS.map(([k])=>`<option value="${k}"${k===s.cat?' selected':''}>${WF_CAT[k]}</option>`).join('')}</select></label></div>
      <div class="cp-in"><span>Responsible role(s)</span>${rolePicker('data-wfrole',s.id,s.roleIds,'Responsible roles of '+esc(s.name))}<small class="hint">Expected role; the person is resolved in each project (mapping or people with this specialty and role).</small></div>
      ${wfDepPicker(s,ed)}
      <div class="row"><span class="muted" style="font-size:11.5px">Step id: ${esc(s.id)}</span><span class="spacer"></span><button class="btn sm ghost danger-t" data-act="wf-retire" data-id="${s.id}">${used?'Retire step…':'Remove step'}</button></div>`}
function wfMutate(fn){const dr=wfDraft();fn(dr);save(true);setSaveInd();wfRerender()}   // the view keeps its scroll
function wfAddStep(cat,ph,name,spec){wfMutate(dr=>{const col=wfColSteps(dr,ph,cat),st={id:uid('ws'),phaseId:ph,serviceId:service(spec)?spec:null,cat,name,desc:'',deps:[],order:0,retired:false,createdAt:new Date().toISOString(),roleIds:[]};
  /* in the diagram a new activity goes at the start of its zone (cards of new activities start collapsed) */
  st.order=col.length?Math.max(...col.map(x=>x.order))+1:0;dr.steps.push(st);wfInsertInLayout(dr,st)})}
async function wfRetire(id){
  const dr=wfDraft(),s=wfStep(id,dr);if(!s)return;const used=wfStd().steps.some(x=>x.id===id);
  const ts=S.tasks.filter(t=>t.wfStepId===id),done=ts.filter(t=>t.status==='Done').length,dependents=dr.steps.filter(x=>x.deps.includes(id));
  if(used&&!await confirmBox('Retire step?',`“${esc(s.name)}” leaves the active standard when you publish. ${ts.length?`Its ${plural(ts.length,'project task')} (${done} done) are kept as history, with their assignees, dates and notes.`:''}${dependents.length?` ${plural(dependents.length,'step')} that depend on it lose that link.`:''}`,'Retire'))return;
  wfMutate(d=>{if(used){wfStep(id,d).retired=true}else d.steps=d.steps.filter(x=>x.id!==id);d.steps.forEach(x=>{x.deps=x.deps.filter(z=>z!==id)})});
  if(ui.wfSel===id)ui.wfSel=null;toast(used?`“${s.name}” will be retired when you publish`:`“${s.name}” removed`);
}

/* ---------- Project → Workflow tab ---------- */
function wfProjNodes(p,ph,specs){
  const tasks=S.tasks.filter(t=>t.projectId===p.id&&t.wfStepId&&wfLive(t)),inPh=s=>ph==='_all'||s.phaseId===ph,inSp=s=>!specs||specs.includes(wfSpecOf(s));
  const intV=tasks.filter(t=>wfIsInt(t)&&inPh(wfStep(t.wfStepId))&&inSp(wfStep(t.wfStepId)));
  const out=[],ids=new Set(),extL=new Set(),who=t=>t.assignedToId?shortName(pname(t.assignedToId)):'Unassigned';
  const node=(s,t,ref)=>{const a=t?wfAvail(t):null,ext=t&&!wfIsInt(t);
    return {id:s.id,ph:s.phaseId,tid:t&&t.id,cat:ext?'input':s.cat,lane:wfSpecOf(s),name:s.name,deps:ext||ref?[]:s.deps,
      kind:ext?`External input · ${wfSpecName(wfSpecOf(s))}`:`${WF_CAT[s.cat]} · ${a?a.k==='done'?'✓ Done':a.k==='doing'?t.status:a.k==='ready'?'Available':'Waiting':''}`,
      sub:ext?`${t.wfConsultant||'Consultant not set'} · ${t.status==='Done'?'✓ received':'follow-up '+who(t)}`:`${who(t)}${t.due?' · '+fmt(t.due):''}`,
      cls:`${ext?'ext':''} ${a?'a-'+a.k:''} ${ref?'ref':''}`.trim(),title:s.name+(ext?' — information from '+wfSpecName(wfSpecOf(s)):'')}};
  intV.forEach(t=>{const s=wfStep(t.wfStepId);ids.add(s.id);out.push(node(s,t,false))});
  /* everything those activities need is drawn, also when it is outside the filter: the filter never hides a constraint */
  intV.forEach(t=>wfStep(t.wfStepId).deps.forEach(d=>{if(ids.has(d))return;const ds=wfStep(d);if(!ds||ds.retired)return;ids.add(d);const st=wfDepState(p.id,ds),other=ph!=='_all'&&ds.phaseId!==ph;
    if(st.t){const n=node(ds,st.t,!wfIsInt(st.t)?false:true);if(other){n.lane='_ref';n.kind=`From ${phName(ds.phaseId)} · `+n.kind}if(wfIsInt(st.t))n.cls+=' ref';out.push(n)}
    else out.push({id:ds.id,ph:ds.phaseId,cat:ds.cat,lane:other?'_ref':wfSpecOf(ds),name:ds.name,deps:[],kind:st.kind==='notImported'?'Internal · not imported':st.kind==='unresolved'?'Source to resolve':'External · not set up',sub:`${wfSpecName(wfSpecOf(ds))}${ds.phaseId!==ph?' · '+phName(ds.phaseId):''}`,cls:'ref '+(st.kind==='notImported'?'notimp':st.kind==='unresolved'?'unres':'extmiss')});
    if(!other&&!(specs||[]).includes(wfSpecOf(ds))&&specs)extL.add(wfSpecOf(ds))}));
  return {nodes:out,extL,intV};
}
function projectWorkflow(p){
  const r=wfSyncProject(p);if(r.updated)save(true);   // refresh names only: opening Workflow never creates tasks
  const phs=wfStdPhases(p.id),sc=p.wfScope||{};
  let h=`<div class="wfbar-top"><div><b>Workflow</b> <span class="muted">${wfStd().demo?'<span class="chip c-w">Demo standard</span> ':''}v${wfStd().version}${p.wfVersion?` · imported with v${p.wfVersion}`:''}</span></div><span class="spacer"></span><button class="btn" data-wfabr="${p.id}" title="Propose responsibles for imported activities that are still unassigned">Assign by role…</button><button class="btn primary" data-act="wf-import" data-pid="${p.id}">Import activities…</button></div>`;
  if(!phs.length)return h+`<div class="empty"><h2>No workflow for this project’s phases</h2><p>The Company workflow defines activities per phase and specialty. ${wfStd().steps.some(s=>!s.retired)?'None of its phases is used by this project.':'It has no steps yet.'}</p><div class="row"><button class="btn" data-act="wf-goto-settings">Open Company workflow</button></div></div>`;
  const ch=Object.keys(sc).length?wfChanges(p):null;
  if(ch&&(ch.newInt.length||ch.newExt.length||ch.toInt.length||ch.toExt.length))h+=`<div class="pn-warn" role="status"><span><b>The standard has changes for this project:</b> ${[ch.newInt.length&&plural(ch.newInt.length,'new activity','new activities'),ch.newExt.length&&plural(ch.newExt.length,'new external input'),(ch.toInt.length+ch.toExt.length)&&plural(ch.toInt.length+ch.toExt.length,'change of source')].filter(Boolean).join(', ')}. Nothing was added automatically.</span><button class="btn sm" data-act="wf-import" data-pid="${p.id}">Review and import…</button></div>`;
  if(ch&&ch.unres.length)h+=`<div class="pn-warn" role="status"><span><b>${plural(ch.unres.length,'requirement')} pending resolution:</b> ${ch.unres.map(u=>`${esc(u.s.name)} <small>(${esc(phName(u.s.phaseId))} · ${esc(wfSpecName(wfSpecOf(u.s)))})</small>`).join(', ')}. Decide whether each is done internally or received externally.</span><button class="btn sm" data-act="wf-import" data-pid="${p.id}">Resolve…</button></div>`;
  prefs.wfPhase=prefs.wfPhase||{};prefs.wfSpecs=prefs.wfSpecs||{};
  const ph=prefs.wfPhase[p.id]==='_all'||phs.includes(prefs.wfPhase[p.id])?prefs.wfPhase[p.id]:(phs.find(x=>sc[x])||phs[0]);
  const specList=wfSpecs(),specs=(prefs.wfSpecs[p.id]||[]).filter(x=>specList.includes(x)),flt=specs.length?specs:null;
  /* summary: internal production and external inputs, separately */
  h+=`<div class="wfsum"><div class="wfph" role="tablist" aria-label="Phase"><button role="tab" data-act="wf-pphase" data-pid="${p.id}" data-v="_all" aria-selected="${ph==='_all'}">All phases</button>${phs.map(id=>{if(!sc[id])return `<button role="tab" data-act="wf-pphase" data-pid="${p.id}" data-v="${id}" aria-selected="${ph===id}" class="notimp"><span class="sw" style="--c:${phColor(id)}"></span>${esc(phName(id))} <span class="chip">Not imported</span></button>`;
    const g=wfProgress(p.id,id),xp=wfExtTasks(p.id,id).filter(t=>t.status!=='Done').length;return `<button role="tab" data-act="wf-pphase" data-pid="${p.id}" data-v="${id}" aria-selected="${ph===id}"><span class="sw" style="--c:${phColor(id)}"></span>${esc(phName(id))} <span class="num" title="Internal activities completed">${g.done}/${g.total}</span>${wfBar(g.done,g.total)}${xp?`<span class="chip c-w" title="External inputs not yet received">⇢ ${xp}</span>`:''}</button>`}).join('')}</div>
    ${wfSpecChips('wf-pspec',specs,specList.filter(x=>x!=='_none'||wfStd().steps.some(s=>!s.retired&&!s.serviceId)),p.id)}</div>`;
  if(ph!=='_all'&&!sc[ph]){
    const n=wfStd().steps.filter(s=>!s.retired&&s.phaseId===ph).length;
    return h+`<div class="empty"><h2>${esc(phName(ph))}: not imported</h2><p>The standard has ${plural(n,'activity','activities')} for this phase. Import only the specialties you do internally; the rest become external inputs where needed.</p><div class="row"><button class="btn primary" data-act="wf-import" data-pid="${p.id}" data-ph="${ph}">Import activities for ${esc(phName(ph))}…</button></div></div>`;
  }
  if(ph!=='_all')h+=`<p class="muted wfscope">Internal in ${esc(phName(ph))}: ${sc[ph].specs.map(x=>`<span class="chip">${esc(wfSpecName(x))}</span>`).join(' ')||'none'} · other specialties are external</p>`;
  const G=wfProjNodes(p,ph,flt),xs=[...new Set(G.intV.flatMap(t=>wfStep(t.wfStepId).deps))].map(d=>wfTask(p.id,d)).filter(t=>t&&!wfIsInt(t));
  const intT=G.intV,dn=intT.filter(t=>t.status==='Done').length,xpend=xs.filter(t=>t.status!=='Done').length;
  h+=`<div class="wfstats"><span><b>Internal activities</b> ${dn}/${intT.length} completed ${wfBar(dn,intT.length)}</span><span><b>External inputs</b> ${xs.length-xpend}/${xs.length} received${xpend?` · <span class="warnt">${xpend} pending</span>`:''}</span><span class="muted">External consultants’ design is not counted as our production.</span></div>`;
  h+=`<div class="wflegend" aria-label="Legend"><span class="wfa wfa-done">✓ Completed</span><span class="wfa wfa-doing">◐ In progress</span><span class="wfa wfa-ready">▶ Available</span><span class="wfa wfa-blocked">⏸ Waiting for requirements</span><span class="wfa wfa-awaiting">⇢ External input</span><span class="wfa wfa-notimp">○ Internal requirement not imported</span><span class="muted">Requirements warn; they never block editing or change a status.</span></div>`;
  h+=wfRoleMapHTML(p);
  const fsHead=`<div class="wfph" role="tablist" aria-label="Phase"><button role="tab" data-act="wf-pphase" data-pid="${p.id}" data-v="_all" aria-selected="${ph==='_all'}">All phases</button>${phs.map(id=>`<button role="tab" data-act="wf-pphase" data-pid="${p.id}" data-v="${id}" aria-selected="${ph===id}"${sc[id]?'':' class="notimp"'}><span class="sw" style="--c:${phColor(id)}"></span>${esc(phName(id))}</button>`).join('')}</div>${wfSpecChips('wf-pspec',specs,specList.filter(x=>x!=='_none'||wfStd().steps.some(s=>!s.retired&&!s.serviceId)),p.id)}`;
  h+=wfDiagram(G.nodes,{mode:'proj',extLanes:G.extL,phases:ph==='_all'?wfPhOrder(G.nodes.map(n=>n.ph)):null,fsHead,ctx:{scope:'proj',pid:p.id,key:ph==='_all'?'_global':ph},empty:'No imported activities for this selection.'});
  const shown=[...intT,...xs];
  h+=`<div class="wfm">${WF_COLS.map(([cat,lab])=>{const col=shown.filter(t=>wfIsInt(t)?wfStep(t.wfStepId).cat===cat:cat==='input').sort((a,b)=>(wfIsInt(a)?0:1)-(wfIsInt(b)?0:1)||wfSpecs().indexOf(wfSpecOf(wfStep(a.wfStepId)))-wfSpecs().indexOf(wfSpecOf(wfStep(b.wfStepId)))||wfStep(a.wfStepId).order-wfStep(b.wfStepId).order);
    return `<section class="wfcol c-${cat}" aria-label="${lab}"><h3>${lab} <span class="muted">${col.filter(t=>t.status==='Done').length}/${col.length}</span></h3>${col.map(t=>wfExecCard(t,p)).join('')||'<p class="muted" style="margin:6px 2px">None</p>'}</section>`}).join('')}</div>`;
  /* deliverables of this phase: requirement compliance is separate from progress and from delivery status */
  const ds=sortDelivs(delivsOf(p.id).filter(d=>ph==='_all'||d.phaseId===ph));
  if(ds.length)h+=`<section class="wfdl"><h3>Deliverables${ph==='_all'?'':' of '+esc(phName(ph))}</h3><p class="hint" style="margin:0 0 6px">Requirements = the workflow tasks and external inputs a delivery needs. Meeting them never sets the deliverable to Delivered.</p>${ds.map(d=>{const m=wfReqMet(d),x=m.ts.filter(t=>!wfIsInt(t)&&t.status!=='Done').length;return `<div class="wfdl-r"><button class="plainbtn" data-act="panel-deliv" data-id="${d.id}"><span class="dia-sw" style="--c:${phColor(d.phaseId)}"></span> <b>${esc(d.name)}</b></button><span class="muted">${d.due?fmt(d.due):'No date'}</span><span>${m.total?`Requirements ${m.done}/${m.total} met ${wfBar(m.done,m.total)}${x?` <span class="chip c-w">⇢ ${x} external pending</span>`:''}`:'<span class="muted">No requirements linked</span>'}</span>${dlStatusChip(d)}<button class="btn sm ghost" data-act="panel-deliv" data-id="${d.id}">Requirements…</button></div>`}).join('')}</section>`;
  const mine=tasksOf(p.id),inPh=t=>ph==='_all'||taskPhaseId(t)===ph;
  const extra=mine.filter(t=>!t.wfStepId&&inPh(t)).length,hist=mine.filter(t=>t.wfStepId&&!wfLive(t)&&inPh(t)),rev=mine.filter(t=>t.wfReview);
  if(rev.length)h+=`<section class="wfdl"><h3>Changes of source to review</h3>${rev.map(t=>{const l=(t.wfModeLog||[]).slice(-1)[0];return `<div class="wfdl-r"><button class="plainbtn" data-act="panel-task" data-id="${t.id}"><b>${esc(t.name)}</b></button><span class="muted">${l?`${l.from==='externalInput'?'External input':'Internal'} → ${l.to==='externalInput'?'External input':'Internal'} · ${fmt(l.at.slice(0,10))}`:''}</span><span class="muted">Status, notes, links and evidence kept</span><button class="btn sm ghost" data-act="wf-reviewed" data-id="${t.id}">Mark reviewed</button></div>`}).join('')}</section>`;
  h+=`<p class="hint" style="margin-top:10px">${extra?`${plural(extra,'additional project task')} ${extra===1?'is':'are'} not part of the standard and not counted. `:''}${hist.length?`History (out of scope or retired, not counted): ${hist.map(t=>`<button class="linkbtn" data-act="panel-task" data-id="${t.id}">${esc(t.name)}</button>`).join(', ')}.`:''}</p>`;
  return h;
}
function wfExecCard(t,p){
  const s=wfStep(t.wfStepId),a=wfAvail(t),req=wfReqOf(t),ext=!wfIsInt(t),sel=ui.wfSel===s.id,cons=ext?wfConsumers(t):[],open=ui.wfExpT&&ui.wfExpT.has(t.id);
  return `<div class="wfc wfx a-${a.k}${ext?' ext':''}${sel?' sel':''}${open?' open':''}" id="wfc-${s.id}" data-wfc="${s.id}">
    <div class="wfx-h"><input type="checkbox" data-wfdone="${t.id}"${t.status==='Done'?' checked':''} aria-label="${ext?'Received and validated':'Completed'}: ${esc(t.name)}"><button class="plainbtn wfx-n" data-act="panel-task" data-id="${t.id}" data-wfsel="${s.id}">${ext?`<span class="wfx-ext">External input</span> ${esc(s.name)}`:esc(t.name)}</button></div>
    ${s.desc?`<div class="wfc-desc">${esc(s.desc)}</div>`:''}
    <div class="wfx-m">${ext?'<span class="muted">Follow-up</span>':''}${personPicker('wfa-'+t.id,t.assignedToId,`data-ent="t" data-id="${t.id}" data-f="assignedToId" aria-label="${ext?'Internal follow-up':'Assignee'} of ${esc(t.name)}"`)}<span class="wfx-st">${TGLYPH[t.status]} ${esc(t.status)}</span></div>
    <div class="wfc-tg"><button type="button" class="linkbtn wfc-more" data-wfexpt="${t.id}" aria-expanded="${!!open}">${open?'Hide details':'Show details'}</button></div>
    ${open?`<div class="wfc-x"><div class="wfx-a"><span class="chip wfspec-c">${esc(wfSpecName(wfSpecOf(s)))}</span>${!ext&&(s.roleIds||[]).length?roleChips(s.roleIds):''} ${wfAvailChip(a)}${a.k==='blocked'?`<span class="muted"> · needs ${esc(wfMissText(a.miss))}</span>`:a.warn?`<span class="warnt"> · ${esc(a.warn)}</span>`:''}${t.due?`<span class="muted"> · ${ext?'required':'due'} ${fmt(t.due)}</span>`:''}${ext?`<span class="muted"> · ${t.wfConsultant?esc(t.wfConsultant):'consultant not set'} · needed by ${cons.length?cons.map(c=>esc(wfStep(c.wfStepId).name)).join(', '):'no current activity'}</span>`:''}</div>
    ${req.length?`<div class="wfx-r">${req.map(d=>`<button class="chip" data-act="panel-deliv" data-id="${d.id}" title="Required by ${esc(d.name)}">${esc(d.name)}</button>`).join('')}</div>`:''}<div class="row"><button class="btn sm ghost" data-wfgoto="${s.id}">Edit in Company workflow</button></div></div>`:''}</div>`;
}

/* ---------- Import activities (explicit, incremental) ---------- */
function openWfImport(pid,ph){
  const p=project(pid);if(!p)return;const phs=wfStdPhases(pid),sv=new Set(p.serviceIds||[]);
  const sel={};phs.forEach(id=>{const avail=wfSpecs().filter(x=>wfStd().steps.some(s=>!s.retired&&s.phaseId===id&&wfSpecOf(s)===x)),sc=(p.wfScope||{})[id];
    sel[id]={on:id===ph,specs:new Set(sc?sc.specs:avail.filter(x=>sv.has(x))),avail,suggested:!sc&&avail.some(x=>sv.has(x))}});
  ui.wi={pid,sel,dec:{},as:{}};
  openModal(`<form data-form="wf-import" data-pid="${pid}" id="wi" novalidate><div class="m-head"><div><div class="eyebrow"><span class="mono">${esc(p.code)}</span> · ${esc(p.name)}</div><h2>Import activities</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div><div id="wi-body">${wfImportBody()}</div></form>`,{wide:true,focus:'#wi-body input'});
}
function wfImportSel(){const w=ui.wi,o={};Object.entries(w.sel).forEach(([ph,v])=>{if(v.on)o[ph]=[...v.specs]});return o}
function wfImportBody(){
  const w=ui.wi,p=project(w.pid),R=wfPlan(p,wfImportSel(),w.dec),sc=p.wfScope||{};
  const row=(x,tag)=>`<li><span class="chip wfspec-c">${esc(wfSpecName(wfSpecOf(x.s||x)))}</span> <span>${esc((x.s||x).name)}</span> <small class="muted">${esc(phName((x.s||x).phaseId))} · ${WF_CAT[(x.s||x).cat]}</small>${tag||''}${x.consumers?` <small class="muted">· needed by ${x.consumers.map(c=>esc(c.name)).join(', ')}</small>`:''}</li>`;
  let h=`<p class="hint" style="margin-top:0">Choose the phases to import or update and, for each one, the specialties you do <b>internally</b>. Each phase is configured on its own. Requirements from specialties you don’t do become external inputs (one per piece of information, shared by every activity that needs it). Nothing existing is deleted or reset.</p>
  <div class="wi-ph">${Object.entries(w.sel).map(([ph,v])=>`<div class="wi-row${v.on?' on':''}"><label class="chk wi-pn"><input type="checkbox" data-wiph="${ph}"${v.on?' checked':''}><span><span class="sw" style="--c:${phColor(ph)}"></span> <b>${esc(phName(ph))}</b> <small class="muted">${sc[ph]?`imported · internal: ${sc[ph].specs.map(wfSpecName).join(', ')||'none'}`:'not imported'}</small></span></label>
    <div class="wi-sp" role="group" aria-label="Internal specialties for ${esc(phName(ph))}">${v.avail.map(x=>`<label class="chk"><input type="checkbox" data-wisp="${ph}" value="${x}"${v.specs.has(x)?' checked':''}${v.on?'':' disabled'}><span>${esc(wfSpecName(x))}</span></label>`).join('')}${v.suggested&&!sc[ph]?'<small class="muted">pre-selected from the project’s Services</small>':''}</div></div>`).join('')}</div>`;
  const any=Object.values(w.sel).some(v=>v.on)||Object.keys(w.dec).length||R.unres.length;
  h+=`<div class="wi-prev" aria-live="polite"><h3>Preview</h3>`;
  if(!any)h+=`<p class="muted">Select a phase to see what will be imported.</p>`;
  else{
    const sec=(title,list,cls,fn,note)=>list.length?`<section class="wi-s ${cls}"><h4>${title} <span class="muted">${list.length}</span></h4>${note?`<p class="hint" style="margin:0 0 4px">${note}</p>`:''}<ul>${list.map(fn).join('')}</ul></section>`:'';
    h+=sec('New internal activities',R.newInt,'new',x=>{const pr=wfPropose(p,x,'internal'),cur=w.as[x.id]!==undefined?w.as[x.id]:(pr.pid||'');
      return row(x).slice(0,-5)+`<span class="wi-resp">${(x.roleIds||[]).length?roleChips(x.roleIds):'<span class="muted">no role</span>'} → ${wfProposeSelect('data-wias',x.id,pr,cur)} ${wfProposeNote(pr,cur)}</span></li>`},'Responsible proposed from this project’s role mapping, then from active people with the activity’s specialty and role. You can change it or leave it unassigned.');
    h+=sec('External inputs required',[...R.newExt.map(x=>({...x,tag:' <span class="chip c-w">new</span>'})),...R.keepExt.map(x=>({...x,tag:' <span class="chip">existing, kept</span>'}))],'ext',x=>row(x,x.tag),'Information from specialties outside your internal scope. Their design activities are not imported.');
    h+=sec('Change of source (kept: status, notes, links, evidence)',[...R.toInt.map(x=>({...x,tag:' <span class="chip c-a">external → internal</span>'})),...R.toExt.map(x=>({...x,tag:' <span class="chip c-w">internal → external input</span>'}))],'chg',x=>row(x,x.tag),'The same record is reused and flagged for review.');
    h+=sec('Back in scope',R.backInt,'keep',x=>row(x));
    h+=sec('Leaving the internal scope (kept as history)',R.leaving,'leave',x=>row(x,` <span class="muted">· ${esc(x.t.status)}</span>`));
    h+=sec('Already imported (unchanged)',R.keepInt,'keep',x=>row(x),'Assignees, dates, statuses and evidence stay as they are.');
    /* requirements from phases that are not configured: pending ones and the ones already decided can always be (re)decided here */
    const decided=Object.keys(R.decide).map(id=>wfStep(id)).filter(s=>s&&!s.retired&&!R.scope[s.phaseId]),ext=new Map([...R.newExt,...R.keepExt,...R.toExt].map(x=>[x.s.id,x.consumers]));
    const rows=[...R.unres.map(u=>({s:u.s,consumers:u.consumers,v:'later'})),...decided.filter(s=>!R.unres.some(u=>u.s.id===s.id)).map(s=>({s,consumers:ext.get(s.id),v:R.decide[s.id]}))];
    h+=rows.length?`<section class="wi-s unres"><h4>Requirements from phases not configured <span class="muted">${R.unres.length?`${R.unres.length} pending resolution`:'all decided'}</span></h4><p class="hint" style="margin:0 0 4px">Required from a phase that isn’t configured for this project. Choose where each comes from; nothing is decided silently. “Pending resolution” stays visible in the project until you decide.</p><ul>${rows.map(u=>`<li>${row({s:u.s,consumers:u.consumers}).slice(4,-5)}${u.v==='later'?' <span class="chip c-d">Pending resolution</span>':''}<span class="wi-dec">${[['internal','Import internal activity'],['external','External input'],['later','Decide later']].map(([k,l])=>`<label class="chk"><input type="radio" name="dec-${u.s.id}" data-widec="${u.s.id}" value="${k}"${(w.dec[u.s.id]||u.v)===k?' checked':''}><span>${l}</span></label>`).join('')}</span></li>`).join('')}</ul></section>`:'';
  }
  const n=R.newInt.length+R.newExt.length,c=R.toInt.length+R.toExt.length+R.backInt.length+R.leaving.length;
  h+=`</div><div class="m-actions"><span class="muted" style="margin-right:auto">${n?`${plural(R.newInt.length,'activity','activities')} and ${plural(R.newExt.length,'external input')} will be created`:'No new records'}${c?` · ${plural(c,'change')}`:''}</span><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" id="wi-ok"${any?'':' disabled'}>Import</button></div>`;
  return h;
}
function wfImportRefresh(focusSel){const b=document.getElementById('wi-body');if(!b)return;const sc=b.scrollTop;b.innerHTML=wfImportBody();b.scrollTop=sc;const f=focusSel&&document.querySelector(focusSel);f&&f.focus({preventScroll:true})}
document.addEventListener('change',e=>{const el=e.target;if(!el.closest||!el.closest('#wi')||!ui.wi)return;const w=ui.wi;
  if(el.dataset.wiph){w.sel[el.dataset.wiph].on=el.checked;wfImportRefresh(`[data-wiph="${el.dataset.wiph}"]`);return}
  if(el.dataset.wisp){const v=w.sel[el.dataset.wisp];el.checked?v.specs.add(el.value):v.specs.delete(el.value);v.suggested=false;wfImportRefresh(`[data-wisp="${el.dataset.wisp}"][value="${el.value}"]`);return}
  if(el.dataset.wias){w.as[el.dataset.wias]=el.value;wfImportRefresh(`[data-wias="${el.dataset.wias}"]`);return}
  if(el.dataset.widec){w.dec[el.dataset.widec]=el.value;wfImportRefresh(`[data-widec="${el.dataset.widec}"][value="${el.value}"]`);return}
},true);
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form!=='wf-import')return;e.preventDefault();e.stopImmediatePropagation();
  const w=ui.wi,p=project(w.pid);if(!p)return;const sel=wfImportSel(),R=wfPlan(p,sel,w.dec);
  const asg={};R.newInt.forEach(s=>{const pr=wfPropose(p,s,'internal'),v=w.as[s.id]!==undefined?w.as[s.id]:(pr.pid||'');if(v&&person(v))asg[s.id]=v});
  wfApplyPlan(p,R,Object.keys(sel));
  R.newInt.forEach(s=>{const t=wfTask(p.id,s.id);if(t&&!t.assignedToId&&asg[s.id])t.assignedToId=asg[s.id]});
  save();closeModal(true);
  if(Object.keys(sel).length===1){prefs.wfPhase={...(prefs.wfPhase||{}),[p.id]:Object.keys(sel)[0]};savePrefs()}
  render();toast(`Imported: ${plural(R.newInt.length,'activity','activities')}, ${plural(R.newExt.length,'external input')}${R.toInt.length+R.toExt.length?`, ${plural(R.toInt.length+R.toExt.length,'change of source')} to review`:''}${R.leaving.length?`, ${R.leaving.length} kept as history`:''}. Existing work was kept.`)},true);

