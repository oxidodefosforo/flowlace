/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- Demo standards (example steps, clearly marked) ---------- */
function wfDemo(){
  const now=new Date().toISOString(),st=(id,phaseId,cat,name,desc,deps,order)=>({id,phaseId,serviceId:null,cat,name,desc,deps,order,retired:false,createdAt:now});
  return {version:1,appliedAt:now,demo:true,steps:[
    st('ws-dd-in-a','ph-dd','input','Input A','Example input: information received before design work starts (e.g. client brief).',[],0),
    st('ws-dd-in-b','ph-dd','input','Input B','Example input: a second input that Action A also needs (e.g. architectural model).',[],1),
    st('ws-dd-ac-a','ph-dd','action','Action A','Example action that needs both inputs.',['ws-dd-in-a','ws-dd-in-b'],0),
    st('ws-dd-ac-b','ph-dd','action','Action B','Example action enabled by Action A. Runs in parallel with Action C.',['ws-dd-ac-a'],1),
    st('ws-dd-ac-c','ph-dd','action','Action C','Example action enabled by Action A. Runs in parallel with Action B.',['ws-dd-ac-a'],2),
    st('ws-dd-out-a','ph-dd','output','Output A','Example output that needs Action B and Action C.',['ws-dd-ac-b','ws-dd-ac-c'],0),
    st('ws-ti-in-a','ph-ti','input','Tender input','Example input for the tender phase.',[],0),
    st('ws-ti-ac-a','ph-ti','action','Tender action','Example action of the tender phase.',['ws-ti-in-a'],0),
    st('ws-ti-out-a','ph-ti','output','Tender output','Example output of the tender phase.',['ws-ti-ac-a'],0)]};
}
/* v2 demo: Fee and Schematic by specialty, with links between specialties and one between phases */
function wfDemo2(){
  const sv=n=>(S.services.find(s=>s.name.toLowerCase()===n.toLowerCase())||{}).id||null,E=sv('Electrical'),M=sv('Mechanical'),Hy=sv('Hydraulics'),C=sv('Coordination'),F=sv('Fire'),now=new Date().toISOString();
  let o=0;const st=(id,phaseId,serviceId,cat,name,desc,deps)=>({id,phaseId,serviceId,cat,name,desc:'Demo: '+desc,deps,order:o++,retired:false,createdAt:now});
  return [
    st('wd-fee-co-in','ph-fee',C,'input','Client brief and scope request','the request for proposal from the client.',[]),
    st('wd-fee-el-out','ph-fee',E,'output','Electrical scope and fee estimate','electrical hours and scope for the proposal.',['wd-fee-co-in']),
    st('wd-fee-me-out','ph-fee',M,'output','Mechanical scope and fee estimate','mechanical hours and scope for the proposal.',['wd-fee-co-in']),
    st('wd-fee-hy-out','ph-fee',Hy,'output','Hydraulics scope and fee estimate','hydraulic hours and scope for the proposal.',['wd-fee-co-in']),
    st('wd-fee-fi-out','ph-fee',F,'output','Fire scope and fee estimate','fire services hours and scope for the proposal.',['wd-fee-co-in']),
    st('wd-fee-co-ac','ph-fee',C,'action','Assemble fee proposal','combine the estimates of every specialty.',['wd-fee-el-out','wd-fee-me-out','wd-fee-hy-out','wd-fee-fi-out']),
    st('wd-fee-co-out','ph-fee',C,'output','Fee proposal issued','proposal sent to the client.',['wd-fee-co-ac']),
    st('wd-sd-co-in','ph-sd',C,'input','Architect schematic layouts','layouts received from the architect.',[]),
    st('wd-sd-me-ac','ph-sd',M,'action','Mechanical schematic design','plant strategy and system sizing.',['wd-sd-co-in']),
    st('wd-sd-me-out','ph-sd',M,'output','Mechanical equipment loads','electrical loads of the mechanical plant (needed by Electrical).',['wd-sd-me-ac']),
    st('wd-sd-el-ac1','ph-sd',E,'action','Electrical load estimate','maximum demand, using the mechanical loads.',['wd-sd-co-in','wd-sd-me-out','wd-fee-el-out']),
    st('wd-sd-el-ac2','ph-sd',E,'action','Switchboard and riser schematic','board locations and risers, also using the mechanical loads.',['wd-sd-me-out','wd-sd-el-ac1']),
    st('wd-sd-el-out','ph-sd',E,'output','Electrical schematic report','electrical schematic design report.',['wd-sd-el-ac2']),
    st('wd-sd-hy-ac','ph-sd',Hy,'action','Hydraulic schematic design','water, sewer and storm strategy.',['wd-sd-co-in']),
    st('wd-sd-hy-out','ph-sd',Hy,'output','Hydraulic services schematic','hydraulic schematic (needed by Fire for water supply).',['wd-sd-hy-ac']),
    st('wd-sd-fi-ac','ph-sd',F,'action','Fire services strategy','fire water and detection strategy, from the hydraulic schematic.',['wd-sd-hy-out']),
    st('wd-sd-fi-out','ph-sd',F,'output','Fire schematic report','fire services schematic report.',['wd-sd-fi-ac']),
    st('wd-sd-co-ac','ph-sd',C,'action','Schematic services coordination','coordinate the electrical and mechanical outputs.',['wd-sd-el-out','wd-sd-me-out']),
    st('wd-sd-co-out','ph-sd',C,'output','Schematic design report issued','combined services report.',['wd-sd-co-ac'])];
}
function wfBoot(){
  let ch=false;
  if(!S.workflow&&phase('ph-dd')){
    /* first version (kept so earlier data looks the same): demo applied to the two example projects */
    S.workflow=wfDemo();S.workflowDraft=null;const demo=['px-rmc','px-fft'].map(project).filter(p=>p&&!p.archived);
    demo.forEach(p=>{ensurePP(p.id,'ph-dd');wfStd().steps.forEach(s=>{if(!ppFor(p.id,s.phaseId)||wfTask(p.id,s.id))return;const t=newTask({projectId:p.id,name:s.name,phaseId:s.phaseId,status:'To Do',source:'Planned'});t.assignedToId=null;t.wfStepId=s.id;t.wfExecutionMode='internal';S.tasks.push(t)});
      p.wfScope={};[...new Set(wfStd().steps.map(s=>s.phaseId))].filter(ph=>ppFor(p.id,ph)).forEach(ph=>p.wfScope[ph]={specs:['_none'],importedAt:null,v:1,migrated:true})});
    const exec={'px-rmc':{'ws-dd-in-a':['pe-sm','Done'],'ws-dd-in-b':['pe-jo','Done'],'ws-dd-ac-a':['pe-lc','In progress'],'ws-dd-ac-b':['pe-lc','To Do']},'px-fft':{'ws-dd-in-a':['pe-jo','Done'],'ws-dd-in-b':['pe-dr','Waiting information'],'ws-dd-ac-a':['pe-jo','To Do']}};
    demo.forEach(p=>{Object.entries(exec[p.id]||{}).forEach(([sid,[pe,st]])=>{const t=wfTask(p.id,sid);if(!t)return;if(person(pe))t.assignedToId=pe;setTaskField(t,'status',st);t.status=st});
      const dd=delivsOf(p.id).filter(d=>d.phaseId==='ph-dd'),mk=(name,off)=>{let d=dd.find(x=>x.name===name);if(!d){const base=dd.map(x=>x.due).filter(Boolean).sort().pop();d={id:uid('d'),projectId:p.id,name,phaseId:'ph-dd',milestoneId:null,milestoneRev:null,checks:{},start:null,due:base?dn2iso(iso2dn(base)+off):null,ownerId:null,status:'Planned',notes:'Demo deliverable for the workflow example.',seq:nextSeq(),reqTaskIds:[]};S.deliverables.push(d)}return d};
      const d70=mk('70% DD',-14),d100=mk('100% DD',21),T=sid=>wfTask(p.id,sid)?.id;
      d70.reqTaskIds=['ws-dd-in-a','ws-dd-in-b','ws-dd-ac-a'].map(T).filter(Boolean);d100.reqTaskIds=['ws-dd-in-a','ws-dd-in-b','ws-dd-ac-a','ws-dd-ac-b','ws-dd-ac-c','ws-dd-out-a'].map(T).filter(Boolean)});
    ch=true;
  }
  /* v2: specialties. Earlier tasks were already migrated by normWF (internal, previously imported, steps “to classify”). Add the specialty demo once. */
  if(S.workflow&&S.workflow.demo&&!S.workflow.demoV2&&phase('ph-fee')&&phase('ph-sd')){
    const have=new Set(S.workflow.steps.map(s=>s.id)),add=wfDemo2().filter(s=>!have.has(s.id));
    S.workflow.steps.push(...add);S.workflow.demoV2=true;S.workflow.version=(S.workflow.version||0)+1;S.workflow.appliedAt=new Date().toISOString();
    if(S.workflowDraft){S.workflowDraft.steps.push(...wfClone(add).filter(s=>!S.workflowDraft.steps.some(x=>x.id===s.id)));S.workflowDraft.demoV2=true}
    /* demo execution on the Joondalup example: Fee with the five specialties internal, Schematic with Electrical and Hydraulics internal */
    const p=project('px-jps');
    if(p&&!p.archived&&!Object.keys(p.wfScope||{}).length){
      ensurePP(p.id,'ph-fee');ensurePP(p.id,'ph-sd');
      const all=wfSpecs(S.workflow).filter(x=>x!=='_none'&&S.workflow.steps.some(s=>s.phaseId==='ph-fee'&&s.serviceId===x)),sv=n=>(S.services.find(s=>s.name===n)||{}).id;
      let R=wfPlan(p,{'ph-fee':all},{});wfApplyPlan(p,R,['ph-fee']);
      R=wfPlan(p,{'ph-sd':[sv('Electrical'),sv('Hydraulics')]},{});wfApplyPlan(p,R,['ph-sd']);
      const set=(sid,pe,stt,extra)=>{const t=wfTask(p.id,sid);if(!t)return;if(pe&&person(pe))t.assignedToId=pe;setTaskField(t,'status',stt);t.status=stt;Object.assign(t,extra||{})};
      set('wd-fee-co-in','pe-lc','Done');set('wd-fee-el-out','pe-jo','Done');set('wd-fee-me-out','pe-sm','Done');set('wd-fee-hy-out','pe-lc','In progress');
      set('wd-sd-me-out','pe-jo','In progress',{wfConsultant:'Example Mechanical Consultants (demo)',due:dn2iso(todayDN()+7),notes:'Demo: requested by email; waiting for the equipment schedule.'});
      set('wd-sd-co-in','pe-lc','Done',{wfConsultant:'Example Architects (demo)'});
      set('wd-sd-hy-ac','pe-lc','In progress');
    }
    ch=true;
  }
  if(ch)save(true);
}
/* duplicating a project: its imported scope is copied only with its tasks; requirements never point to the source project's tasks */
function wfAfterDup(p,src,copied){
  p.wfScope={};p.wfDecide={};p.wfVersion=0;
  if(copied){p.wfScope=wfClone(src.wfScope||{});p.wfDecide=wfClone(src.wfDecide||{});p.wfVersion=src.wfVersion||0;
    const mine=S.tasks.filter(t=>t.projectId===p.id);
    tasksOf(src.id).filter(t=>t.wfStepId).forEach(st=>{const c=mine.find(t=>!t.wfStepId&&t.name===st.name);if(c){c.wfStepId=st.wfStepId;c.wfExecutionMode=st.wfExecutionMode;c.wfConsultant=st.wfConsultant||'';c.wfOutOfScope=!!st.wfOutOfScope;c.wfReview=false;c.wfModeLog=[]}})}
  delivsOf(p.id).forEach(d=>{d.reqTaskIds=(d.reqTaskIds||[]).map(id=>{const st=S.tasks.find(t=>t.id===id);return copied&&st&&st.wfStepId?(wfTask(p.id,st.wfStepId)||{}).id:null}).filter(Boolean)});
}

