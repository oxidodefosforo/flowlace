/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- normalisation (load / import / migration) ---------- */
function wfNormStd(w,phaseIds,svIds){
  if(!w||typeof w!=='object'||!Array.isArray(w.steps))return null;
  const ids=new Set(),steps=[];
  w.steps.forEach((s,i)=>{if(!s||!s.id||ids.has(s.id)||!phaseIds.has(s.phaseId))return;ids.add(s.id);
    steps.push({id:String(s.id),phaseId:s.phaseId,serviceId:svIds.has(s.serviceId)?s.serviceId:null,cat:WF_CAT[s.cat]?s.cat:'action',name:String(s.name||'Untitled step').slice(0,160),desc:String(s.desc||''),deps:Array.isArray(s.deps)?s.deps.map(String):[],order:typeof s.order==='number'?s.order:i,retired:!!s.retired,createdAt:s.createdAt||null,roleIds:[...new Set(arr(s.roleIds).map(String))],
      ret:[...new Set(arr(s.ret).map(String))],type:WF_TYPE[s.type]?s.type:'normal',question:String(s.question||'').slice(0,300),branches:s.branches&&typeof s.branches==='object'?{yes:s.branches.yes?String(s.branches.yes):null,no:s.branches.no?String(s.branches.no):null}:{yes:null,no:null}})});
  const byId=new Map(steps.map(s=>[s.id,s]));
  /* links across phases and specialties are kept; only self links, duplicates, missing or retired steps go */
  steps.forEach(s=>{s.deps=[...new Set(s.deps)].filter(d=>d!==s.id&&byId.has(d)&&!byId.get(d).retired)});
  const legacy=(parseInt(w.schema)||0)<3;
  const std={version:Math.max(0,parseInt(w.version)||0),appliedAt:w.appliedAt||null,demo:!!w.demo,schema:3,demoV2:!!w.demoV2,steps,layout:wfLayoutsNorm(w.layout)};
  steps.forEach(s=>{s.deps=s.deps.filter(d=>!wfReaches({steps},d,s.id))}); // break any loop in a hand-edited backup
  wfBranchNorm(steps,legacy);
  return std;
}
function normWF(o,d){
  /* the five workflow specialties come from the disciplines catalogue; add the missing ones once (no duplicates by name) */
  WF_SPEC_NAMES.forEach(n=>{if(!o.services.some(s=>s.name.trim().toLowerCase()===n.toLowerCase())){let id='sv-'+n.toLowerCase();if(o.services.some(s=>s.id===id))id=uid('sv');o.services.push({id,name:n})}});
  const phs=new Set(o.phases.map(p=>p.id)),svs=new Set(o.services.map(s=>s.id));
  o.workflow=wfNormStd(d.workflow,phs,svs);o.workflowDraft=o.workflow?wfNormStd(d.workflowDraft,phs,svs):null;
  const tasksBy=new Map(o.tasks.map(t=>[t.id,t]));
  const seen=new Set();
  o.tasks.forEach(t=>{t.wfStepId=t.wfStepId?String(t.wfStepId):null;if(!t.wfStepId){delete t.wfExecutionMode;return}
    const k=t.projectId+'|'+t.wfStepId;if(seen.has(k)){t.wfStepId=null;delete t.wfExecutionMode;return}seen.add(k);
    t.wfExecutionMode=t.wfExecutionMode==='externalInput'?'externalInput':'internal';   // tasks generated before v2 are previously imported internal activities
    t.wfConsultant=String(t.wfConsultant||'');t.wfOutOfScope=!!t.wfOutOfScope;t.wfReview=!!t.wfReview;t.wfModeLog=arr(t.wfModeLog).filter(x=>x&&x.to);
    /* answer of a Decision / QA in this project (Pending = null) and its history */
    t.wfAnswer=t.wfAnswer==='yes'||t.wfAnswer==='no'?t.wfAnswer:null;t.wfAnswerLog=arr(t.wfAnswerLog).filter(x=>x&&x.at);
    /* review rounds: one task per activity; earlier completions and rounds are kept here */
    t.wfRound=Math.max(1,parseInt(t.wfRound)||1);t.wfAttempts=arr(t.wfAttempts).filter(x=>x&&x.at);t.wfRetFor=t.wfRetFor||null});
  o.deliverables.forEach(x=>{x.reqTaskIds=[...new Set(arr(x.reqTaskIds))].filter(id=>{const t=tasksBy.get(id);return t&&t.projectId===x.projectId})});
  const steps=new Map(((o.workflow||{}).steps||[]).map(s=>[s.id,s]));
  o.projects.forEach(p=>{p.wfVersion=parseInt(p.wfVersion)||0;
    const sc={};if(p.wfScope&&typeof p.wfScope==='object')Object.entries(p.wfScope).forEach(([ph,v])=>{if(phs.has(ph)&&v&&Array.isArray(v.specs))sc[ph]={specs:[...new Set(v.specs.filter(x=>x==='_none'||svs.has(x)))],importedAt:v.importedAt||null,v:parseInt(v.v)||0,migrated:!!v.migrated}});
    /* migration: phases whose tasks were generated automatically count as imported, with the specialties of those steps */
    o.tasks.filter(t=>t.projectId===p.id&&t.wfStepId&&t.wfExecutionMode==='internal'&&steps.has(t.wfStepId)).forEach(t=>{const s=steps.get(t.wfStepId);
      if(!sc[s.phaseId]||sc[s.phaseId].migrated){sc[s.phaseId]=sc[s.phaseId]||{specs:[],importedAt:null,v:p.wfVersion,migrated:true};const sp=s.serviceId||'_none';if(!sc[s.phaseId].specs.includes(sp))sc[s.phaseId].specs.push(sp)}});
    p.wfScope=sc;
    const dc={};if(p.wfDecide&&typeof p.wfDecide==='object')Object.entries(p.wfDecide).forEach(([k,v])=>{if(v==='internal'||v==='external')dc[k]=v});p.wfDecide=dc;
    p.wfLayout=wfLayoutsNorm(p.wfLayout);   // visual adjustments of this project (never change the standard)
    const pes=new Set(o.people.map(x=>x.id)),rm={};if(p.wfRoleMap&&typeof p.wfRoleMap==='object')Object.entries(p.wfRoleMap).forEach(([k,v])=>{if(/^[^|]+\|[^|]+$/.test(k)&&pes.has(v))rm[k]=v});p.wfRoleMap=rm});
}

/* Decision / QA outlets: { yes: stepId | null, no: stepId | null } (stable ids; labels are display only), and review
   returns: ret = [stepId] (after this rework, the earlier activity is done again). Outlets are NOT dependencies: the
   target's "Depends on" keeps only its real requirements. Data from 1.6 (schema < 3) mirrored each outlet in the target's
   deps; that copy is removed once, the outlet stays. Nothing valid is dropped: loops through a decision are kept. */
function wfBranchNorm(steps,legacy){const by=new Map(steps.map(s=>[s.id,s]));
  steps.forEach(s=>{const b=s.branches||{},out={yes:null,no:null};
    if(wfIsDec(s))WF_BR.forEach(([k])=>{const t=b[k]&&by.get(b[k]);if(!t||t.id===s.id||t.retired)return;if(k==='no'&&out.yes===t.id)return;out[k]=t.id;
      if(legacy)t.deps=t.deps.filter(x=>x!==s.id)});
    s.branches=out;s.ret=(s.ret||[]).filter(id=>{const t=by.get(id);return t&&t.id!==s.id&&!t.retired})})}
/* conditional transitions that lead FORWARD to a step: [{d: decision step, b: 'yes'|'no'}] (returns excluded) */
function wfCondIn(stepId,std){std=std||wfStd();return std.steps.filter(d=>!d.retired&&wfIsDec(d)&&d.branches&&(d.branches.yes===stepId||d.branches.no===stepId)).map(d=>({d,b:d.branches.yes===stepId?'yes':'no'})).filter(x=>!wfIsBack(std,x.d.id,stepId))}
/* every conditional / return link INTO a step, for drawing: [{from, b: 'yes'|'no'|'ret', back}] */
function wfLinksIn(stepId,std){std=std||wfStd();const out=[];
  std.steps.forEach(d=>{if(d.retired)return;if(wfIsDec(d)&&d.branches)WF_BR.forEach(([b])=>{if(d.branches[b]===stepId)out.push({from:d.id,b,back:wfIsBack(std,d.id,stepId)})});
    if((d.ret||[]).includes(stepId))out.push({from:d.id,b:'ret',back:true})});return out}
/* does an answer lead back into a new review round (its outlet goes back, or its path reaches a review return to work
   before the decision)? Then the decision is asked again and the other outlet is still pending, not discarded. */
function wfBranchLoops(std,d,b){std=std||wfStd();const t=d&&d.branches&&d.branches[b];if(!t)return false;if(wfIsBack(std,d.id,t))return true;
  return std.steps.some(r=>!r.retired&&(r.ret||[]).length&&(r.id===t||wfReqReaches(std,r.id,t))&&r.ret.some(x=>x===d.id||wfReqReaches(std,d.id,x)))}
/* the work repeated by a return to `target` decided at `point` (a QA / Decision, or the rework that returns):
   what needs `target` and is needed by `point` — never earlier work, other branches or unrelated activities */
function wfLoopScope(std,target,point,inclPoint){std=std||wfStd();return std.steps.filter(x=>!x.retired&&(x.id===target||wfReqReaches(std,x.id,target))&&((inclPoint&&x.id===point)||(x.id!==point&&wfReqReaches(std,point,x.id)))).map(x=>x.id)}
const wfBranchOf=(d,stepId)=>d&&d.branches?(d.branches.yes===stepId?'yes':d.branches.no===stepId?'no':null):null;

/* ---------- refresh (never creates anything): definitions of the standard flow into the existing records ---------- */
function wfTaskName(s,mode){return mode==='externalInput'?'External input: '+s.name:s.name}
function wfSyncProject(p){
  const std=S.workflow;if(!std||!p)return {added:0,updated:0};const now=new Date().toISOString();let updated=0;
  S.tasks.forEach(t=>{if(t.projectId!==p.id||!t.wfStepId)return;const s=wfStep(t.wfStepId);if(!s||s.retired)return;
    const nm=wfTaskName(s,t.wfExecutionMode);if(t.name!==nm){t.name=nm;t.updatedAt=now;updated++}});
  return {added:0,updated};
}
function wfApply(){
  const dr=wfDraft(),ids=new Map(dr.steps.map(s=>[s.id,s]));
  dr.steps.forEach(s=>{s.deps=[...new Set(s.deps)].filter(d=>d!==s.id&&ids.has(d)&&!ids.get(d).retired)});
  for(const s of dr.steps)for(const d of wfReqPreds(dr,s))if(wfReqReaches(dr,d,s.id)){toast(`“${s.name}” is part of a circular requirement. Remove one “Depends on” link first (loops through a Decision / QA or a review return are fine).`,'err');return}
  const std={...wfClone(dr),version:(wfStd().version||0)+1,appliedAt:new Date().toISOString(),schema:3};
  S.workflow=std;S.workflowDraft=null;let u=0,n=0;
  S.projects.filter(p=>!p.archived).forEach(p=>{u+=wfSyncProject(p).updated;if(Object.keys(p.wfScope||{}).length&&wfChanges(p).total)n++});
  save();render();toast(`Standard v${std.version} published. No activities were imported${u?`; ${plural(u,'existing task')} renamed`:''}.${n?` ${plural(n,'project')} can review and import the changes from their Workflow tab.`:''}`);
}

/* ---------- import plan: what a selection of phases + internal specialties means for a project ---------- */
function wfPlan(p,sel,dec){
  const act=wfStd().steps.filter(s=>!s.retired),by=new Map(act.map(s=>[s.id,s]));
  const scope=wfClone(p.wfScope||{});Object.entries(sel||{}).forEach(([ph,specs])=>{scope[ph]={...(scope[ph]||{}),specs:[...specs]}});
  const decide={...(p.wfDecide||{})};Object.entries(dec||{}).forEach(([k,v])=>{if(v==='internal'||v==='external')decide[k]=v;else delete decide[k]});
  const mode=s=>scope[s.phaseId]?(scope[s.phaseId].specs.includes(wfSpecOf(s))?'internal':'external'):(decide[s.id]||'unresolved');
  const internal=new Set(act.filter(s=>mode(s)==='internal').map(s=>s.id));
  const ext=new Map(),unres=new Map(),add=(m,k,c)=>{if(!m.has(k))m.set(k,[]);m.get(k).push(c)};
  internal.forEach(id=>by.get(id).deps.forEach(d=>{const ds=by.get(d);if(!ds||internal.has(d))return;add(mode(ds)==='unresolved'?unres:ext,d,id)}));
  const tk=new Map(S.tasks.filter(t=>t.projectId===p.id&&t.wfStepId).map(t=>[t.wfStepId,t]));
  const R={scope,decide,newInt:[],keepInt:[],backInt:[],toInt:[],newExt:[],keepExt:[],toExt:[],leaving:[],unres:[...unres].map(([id,c])=>({s:by.get(id),consumers:c.map(x=>by.get(x))}))};
  internal.forEach(id=>{const t=tk.get(id),s=by.get(id);if(!t)R.newInt.push(s);else if(t.wfExecutionMode==='externalInput')R.toInt.push({s,t});else if(t.wfOutOfScope)R.backInt.push({s,t});else R.keepInt.push({s,t})});
  ext.forEach((c,id)=>{const t=tk.get(id),s=by.get(id),consumers=c.map(x=>by.get(x));if(!t)R.newExt.push({s,consumers});else if(t.wfExecutionMode==='internal')R.toExt.push({s,t,consumers});else R.keepExt.push({s,t,consumers})});
  tk.forEach((t,id)=>{const s=by.get(id);if(!s||t.wfExecutionMode!=='internal'||t.wfOutOfScope||internal.has(id)||ext.has(id))return;R.leaving.push({s,t})});
  R.total=R.newInt.length+R.newExt.length+R.toInt.length+R.toExt.length+R.backInt.length+R.leaving.length;
  return R;
}
/* changes the published standard brings to a project's current scope (nothing is created until it is imported) */
function wfChanges(p){const R=wfPlan(p,{},{});return {...R,total:R.newInt.length+R.newExt.length+R.toInt.length+R.toExt.length+R.backInt.length+R.leaving.length}}
function wfApplyPlan(p,R,selPhases){
  const now=new Date().toISOString(),log=(t,from,to)=>{t.wfModeLog=[...(t.wfModeLog||[]),{at:now,from,to}];t.wfReview=true};
  const phaseFor=(s,consumers)=>ppFor(p.id,s.phaseId)?s.phaseId:((consumers||[]).map(c=>c.phaseId).find(ph=>ppFor(p.id,ph))||null);
  const mk=(s,mode,consumers)=>{const t=newTask({projectId:p.id,name:wfTaskName(s,mode),phaseId:phaseFor(s,consumers),status:'To Do',priority:'Normal',source:'Planned'});
    t.assignedToId=null;t.due=null;t.wfStepId=s.id;t.wfExecutionMode=mode;t.wfConsultant='';t.wfOutOfScope=false;t.wfReview=false;t.wfModeLog=[];t.wfAnswer=null;t.wfAnswerLog=[];t.wfRound=1;t.wfAttempts=[];S.tasks.push(t);return t};
  R.newInt.forEach(s=>mk(s,'internal'));
  R.newExt.forEach(x=>mk(x.s,'externalInput',x.consumers));
  R.toInt.forEach(({s,t})=>{log(t,'externalInput','internal');t.wfExecutionMode='internal';t.wfOutOfScope=false;t.name=wfTaskName(s,'internal');t.updatedAt=now});
  R.toExt.forEach(({s,t})=>{log(t,'internal','externalInput');t.wfExecutionMode='externalInput';t.wfOutOfScope=false;t.name=wfTaskName(s,'externalInput');t.updatedAt=now});
  R.backInt.forEach(({t})=>{t.wfOutOfScope=false;t.updatedAt=now});
  R.leaving.forEach(({t})=>{t.wfOutOfScope=true;t.updatedAt=now});
  const v=wfStd().version;p.wfScope=R.scope;(selPhases||[]).forEach(ph=>{if(p.wfScope[ph])p.wfScope[ph]={...p.wfScope[ph],importedAt:now,v,migrated:false}});
  p.wfDecide=R.decide;p.wfVersion=v;
}

/* ---------- execution helpers (always read from the real tasks) ---------- */
function wfTask(pid,stepId){return S.tasks.find(t=>t.projectId===pid&&t.wfStepId===stepId)||null}
const wfIsInt=t=>t&&t.wfExecutionMode!=='externalInput';
const wfLive=t=>{const s=t&&wfStep(t.wfStepId);return !!s&&!s.retired&&!t.wfOutOfScope};
function wfModeFor(p,s){const sc=(p.wfScope||{})[s.phaseId];return sc?(sc.specs.includes(wfSpecOf(s))?'internal':'external'):((p.wfDecide||{})[s.id]||'unresolved')}
/* state of one requirement of a project activity */
function wfDepState(pid,ds){
  const t=wfTask(pid,ds.id),p=project(pid);
  if(t)return {s:ds,t,kind:wfIsInt(t)?'internal':'external',ok:t.status==='Done'};
  const m=wfModeFor(p,ds);return {s:ds,t:null,kind:m==='internal'?'notImported':m==='external'?'externalMissing':'unresolved',ok:false};
}
/* paths of a project after its answers: a step is OFF the chosen path when every conditional link that leads to it was
   answered the other way (or comes from a step that is off the path), or when everything it depends on is off the path.
   Off-path steps never block, are not counted as pending work and are not marked done; their data is kept. */
function wfOffPath(pid,stepId,memo){memo=memo||{};if(stepId in memo)return memo[stepId];memo[stepId]=false;
  const s=wfStep(stepId);if(!s||s.retired)return false;const cin=wfCondIn(stepId);let off=false;
  if(cin.length)off=cin.every(({d,b})=>{if(wfOffPath(pid,d.id,memo))return true;const a=wfAnswer(pid,d.id);return !!a&&a!==b&&!wfBranchLoops(null,d,a)});
  else{const ds=s.deps.map(d=>wfStep(d)).filter(x=>x&&!x.retired);off=ds.length>0&&ds.every(x=>wfOffPath(pid,x.id,memo))}
  return memo[stepId]=off}
function wfAnswer(pid,stepId){const t=wfTask(pid,stepId);return t?t.wfAnswer||null:null}
const wfOffTask=(t,memo)=>!!(t&&t.wfStepId&&wfOffPath(t.projectId,t.wfStepId,memo));
function wfAvail(t){
  const s=t&&t.wfStepId&&wfStep(t.wfStepId);if(!s)return null;const memo={};
  if(wfOffTask(t,memo))return {k:'skip',label:'Not on the chosen path',miss:[]};
  if(!wfIsInt(t))return t.status==='Done'?{k:'received',label:'Received & validated',miss:[]}:{k:'awaiting',label:t.status==='To Do'?'Not requested yet':'Awaiting external input',miss:[]};
  /* requirements: what is off the path does not count; a conditional link is met by the answer that leads here */
  const miss=s.retired?[]:[...s.deps.map(d=>wfStep(d)).filter(x=>x&&!x.retired&&!wfOffPath(t.projectId,x.id,memo)).map(x=>wfDepState(t.projectId,x)),
    ...wfCondIn(s.id).filter(({d})=>!wfOffPath(t.projectId,d.id,memo)).map(({d,b})=>wfAnswer(t.projectId,d.id)===b?{s:d,ok:true}:{s:d,t:wfTask(t.projectId,d.id),kind:'decision',ok:false})].filter(x=>!x.ok);
  if(t.status==='Done')return {k:'done',label:'Completed',miss,warn:miss.length?`Completed while requirements are pending: ${wfMissText(miss)}`:''};
  if(t.status!=='To Do')return {k:'doing',label:'In progress',miss,warn:miss.length?`Started before ${miss.map(x=>x.s.name).join(', ')}`:''};
  return miss.length?{k:'blocked',label:'Waiting for requirements',miss}:{k:'ready',label:'Available to start',miss};
}
const WF_MISS={decision:'answer pending',internal:'internal, not done',external:'external input not received',notImported:'internal requirement not imported',externalMissing:'external input not set up',unresolved:'source pending resolution'};
function wfMissText(m){return m.map(x=>`${x.s.name} (${WF_MISS[x.kind]})`).join(', ')}
function wfAvailChip(a){if(!a)return '';const ic={done:'✓',doing:'◐',ready:'▶',blocked:'⏸',received:'✓',awaiting:'⇢',skip:'⤳'}[a.k];
  return `<span class="wfa wfa-${a.k}" title="${esc(a.k==='blocked'?'Waiting for '+wfMissText(a.miss):a.warn||a.label)}">${ic} ${a.label}</span>`}
function wfReqOf(t){return S.deliverables.filter(d=>(d.reqTaskIds||[]).includes(t.id))}
function wfReqMet(d){const memo={},all=(d.reqTaskIds||[]).map(id=>S.tasks.find(t=>t.id===id)).filter(Boolean),ts=all.filter(t=>!wfOffTask(t,memo));return {done:ts.filter(t=>t.status==='Done').length,total:ts.length,ts,off:all.length-ts.length}}
function wfBar(done,total){const pc=total?Math.round(done/total*100):0;return `<span class="wfbar" role="img" aria-label="${done} of ${total} done"><i style="width:${pc}%"></i></span>`}
function wfConsumers(t){const s=wfStep(t.wfStepId);if(!s)return [];return S.tasks.filter(x=>x.projectId===t.projectId&&x.wfStepId&&wfIsInt(x)&&wfLive(x)&&(wfStep(x.wfStepId)?.deps||[]).includes(s.id))}
/* internal production of a phase (external consultants' design is never counted as ours) */
function wfIntTasks(pid,ph,specs){return S.tasks.filter(t=>t.projectId===pid&&t.wfStepId&&wfIsInt(t)&&wfLive(t)&&wfStep(t.wfStepId).phaseId===ph&&(!specs||specs.includes(wfSpecOf(wfStep(t.wfStepId)))))}
function wfExtTasks(pid,ph){const ints=wfIntTasks(pid,ph),need=new Set(ints.flatMap(t=>wfStep(t.wfStepId).deps));return S.tasks.filter(t=>t.projectId===pid&&t.wfStepId&&!wfIsInt(t)&&need.has(t.wfStepId))}
function wfProgress(pid,ph,specs){const memo={},ts=wfIntTasks(pid,ph,specs).filter(t=>!wfOffTask(t,memo));return {done:ts.filter(t=>t.status==='Done').length,total:ts.length}}
function wfStdPhases(pid){const used=new Set(wfStd().steps.filter(s=>!s.retired).map(s=>s.phaseId));return ppOf(pid).filter(pp=>pp.status!=='Not applicable'&&used.has(pp.phaseId)).map(pp=>pp.phaseId)}
function wfProjPhases(pid){const p=project(pid);return wfStdPhases(pid).filter(ph=>(p.wfScope||{})[ph])}

