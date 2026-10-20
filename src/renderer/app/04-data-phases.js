/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- v3 data: global phase definitions, standard milestones, project phases ---------- */
const PP_STAT=['Not started','In progress','On hold','Completed','Not applicable'];
const PPGLYPH={'Not started':'○','In progress':'→','On hold':'‖','Completed':'✓','Not applicable':'–'};
const isoOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const phIdxId=id=>{const i=S.phases.findIndex(p=>p.id===id);return i<0?99:i};
const pphase=id=>S.projectPhases.find(x=>x.id===id);
// global phase order (Settings) always decides the vertical order, never dates or the order phases were added
const ppOf=pid=>S.projectPhases.filter(x=>x.projectId===pid).sort((a,b)=>(phIdxId(a.phaseId)-phIdxId(b.phaseId))||((a.order||0)-(b.order||0)));
const ppFor=(pid,phaseId)=>S.projectPhases.find(x=>x.projectId===pid&&x.phaseId===phaseId);
const ppDelivs=pp=>S.deliverables.filter(d=>d.projectId===pp.projectId&&d.phaseId===pp.phaseId);
const ppTasks=pp=>S.tasks.filter(t=>t.projectId===pp.projectId&&!t.deliverableId&&t.phaseId===pp.phaseId);
const ppScheduled=pp=>!!(pp.start&&pp.end);
const ppLate=pp=>ppScheduled(pp)&&!['Completed','Not applicable'].includes(pp.status)&&iso2dn(pp.end)<todayDN();
const ppName=pp=>phase(pp.phaseId)?.name||'Phase';
function findMs(msId){if(!msId)return null;for(const p of S.phases){const m=p.milestones.find(x=>x.id===msId);if(m)return {phase:p,ms:m}}return null}
function outOfPhase(d){const pp=ppFor(d.projectId,d.phaseId);if(!pp||!ppScheduled(pp)||!d.due)return false;return d.due>pp.end||(d.start||d.due)<pp.start}
function msChanged(d){const f=findMs(d.milestoneId);return !!(f&&d.milestoneRev&&f.ms.updatedAt>d.milestoneRev)}
function newPP(pid,phaseId,order){return {id:uid('pp'),projectId:pid,phaseId,start:null,end:null,status:'Not started',notes:'',order}}
function ensurePP(pid,phaseId,st){st=st||S;if(!phaseId)return null;let pp=st.projectPhases.find(x=>x.projectId===pid&&x.phaseId===phaseId);if(!pp){pp=newPP(pid,phaseId,st.projectPhases.filter(x=>x.projectId===pid).length);st.projectPhases.push(pp)}return pp}
function suggestDates(pp){const ds=ppDelivs(pp).filter(d=>d.due);if(!ds.length)return null;let s=Infinity,e=-Infinity;ds.forEach(d=>{s=Math.min(s,iso2dn(d.start||d.due));e=Math.max(e,iso2dn(d.due))});return {start:dn2iso(s),end:dn2iso(e),n:ds.length}}
function msOpts(phaseId,sel){const p=phase(phaseId);return (p?p.milestones:[]).map(m=>`<option value="${m.id}"${m.id===sel?' selected':''}>${esc(m.name)}${m.target!=null?` · ${m.target}% target`:''}</option>`).join('')}
function ppPhaseOpts(pid,sel){return ppOf(pid).map(pp=>`<option value="${pp.phaseId}"${pp.phaseId===sel?' selected':''}>${esc(ppName(pp))}${pp.status==='Not applicable'?' (not applicable)':''}</option>`).join('')}
function pctFromName(n){const m=String(n||'').match(/(\d{1,3})\s*%/);return m?Math.min(100,+m[1]):null}
function mkMs(name,target){return {id:uid('ms'),name,target:target==null?null:target,description:'',outputs:'',checklist:[],updatedAt:new Date().toISOString()}}
function defaultPhases(){
  const base=[['ph-fee','Fee',COLORS[0],[]],['ph-sd','Sketch / Schematic Design',COLORS[1],[['Sketch',null]]],['ph-dd','Design Development',COLORS[2],[['50% DD',50],['100% DD',100]]],['ph-ti','Tender Issue',COLORS[3],[['70% Tender',70],['100% Tender',100]]],['ph-ci','Construction Issue',COLORS[4],[['Construction Issue',null]]]];
  return base.map(([id,name,color,ms])=>({id,name,color,description:'',completion:'',active:true,milestones:ms.map(([n,t])=>mkMs(n,t))}));
}
function examplePhaseRows(){return {
  'px-rmc':[['ph-fee',-110,-90,'Completed'],['ph-sd',-85,-38,'Completed'],['ph-dd',-36,42,'In progress'],['ph-ti',36,80,'Not started'],['ph-ci',85,140,'Not started']],
  'px-fft':[['ph-fee',-70,-55,'Completed'],['ph-sd',-55,-18,'Completed'],['ph-dd',-20,38,'In progress'],['ph-ti',45,75,'Not started'],['ph-ci',null,null,'Not started']],
  'px-jps':[['ph-fee',-40,-28,'Completed'],['ph-sd',-12,14,'In progress'],['ph-dd',10,62,'Not started'],['ph-ti',null,null,'Not started'],['ph-ci',null,null,'Not applicable']],
  'px-klw':[['ph-fee',-60,-40,'Completed'],['ph-sd',-30,-8,'On hold'],['ph-dd',null,null,'Not started'],['ph-ti',null,null,'Not started'],['ph-ci',null,null,'Not started']],
  'px-nof':[['ph-fee',0,12,'In progress'],['ph-sd',null,null,'Not started'],['ph-dd',null,null,'Not started'],['ph-ti',null,null,'Not started'],['ph-ci',null,null,'Not started']]}}
/* Fills example dates only on example projects whose phases have no dates yet. Returns the number of phases changed. */
function applyExamplePhases(st){
  const t=todayDN(),rows=examplePhaseRows();let n=0;
  Object.entries(rows).forEach(([pid,list])=>{const p=st.projects.find(x=>x.id===pid&&x.example);if(!p)return;
    list.forEach(([phId,a,b,status])=>{if(!st.phases.some(x=>x.id===phId))return;const pp=ensurePP(pid,phId,st);if(pp.start||pp.end)return;if(a!=null){pp.start=dn2iso(t+a);pp.end=dn2iso(t+b)}pp.status=status;n++})});
  st.deliverables.forEach(d=>{const p=st.projects.find(x=>x.id===d.projectId);if(!p||!p.example||d.milestoneId)return;const ph=st.phases.find(x=>x.id===d.phaseId);const m=ph&&ph.milestones.find(x=>x.name.toLowerCase()===d.name.toLowerCase());if(m){d.milestoneId=m.id;d.milestoneRev=m.updatedAt}});
  return n;
}
function seed(){
  const ex=exampleData();const phases=defaultPhases();
  const st={version:4,branding:defaultBranding(),company:defaultCompany(),views:[],favorites:[],people:ex.people,phases,services:defaultServices(),projects:ex.projects,deliverables:ex.deliverables.map(d=>({...d,milestoneId:null,milestoneRev:null,checks:{}})),tasks:[],projectPhases:[],defaults:{phaseIds:phases.map(p=>p.id)}};
  st.tasks=exampleTasks(st);
  st.projects.forEach(p=>st.defaults.phaseIds.forEach((id,i)=>ensurePP(p.id,id,st)));
  applyExamplePhases(st);normRes(st,{});ensureProjSeq(st);
  return st;
}
function normalize(d){
  const now=new Date().toISOString(),hadPP=Array.isArray(d.projectPhases);
  const o={version:4,views:[],favorites:[],people:arr(d.people).filter(p=>p&&p.id&&p.name),phases:arr(d.phases).filter(p=>p&&p.id),projects:arr(d.projects).filter(p=>p&&p.id),deliverables:arr(d.deliverables).filter(x=>x&&x.id),
    services:Array.isArray(d.services)?d.services.filter(x=>x&&x.id&&x.name).map(x=>({id:x.id,name:String(x.name)})):defaultServices(),tasks:arr(d.tasks).filter(t=>t&&t.id),projectPhases:arr(d.projectPhases).filter(x=>x&&x.id),defaults:{phaseIds:[]}};
  if(!o.phases.length)o.phases=defaultPhases();
  o.phases.forEach((p,i)=>{p.name=String(p.name||'Phase');if(!/^#[0-9a-f]{6}$/i.test(p.color||''))p.color=COLORS[i%COLORS.length];p.description=String(p.description||'');p.completion=String(p.completion||'');p.active=p.active!==false;
    p.milestones=arr(p.milestones).filter(m=>m&&m.id).map(m=>({id:m.id,name:String(m.name||'Milestone'),target:(m.target===''||m.target==null||isNaN(+m.target))?null:Math.max(0,Math.min(100,Math.round(+m.target))),description:String(m.description||''),outputs:String(m.outputs||''),checklist:arr(m.checklist).filter(c=>c&&c.id).map(c=>({id:c.id,text:String(c.text||'')})),updatedAt:m.updatedAt||now}))});
  if(!hadPP){ // migration from v1/v2: old deliverable template becomes standard milestones; add the agreed examples if missing
    arr(d.template).forEach(t=>{const p=o.phases.find(x=>x.id===t.phaseId);if(p&&t.name&&!p.milestones.some(m=>m.name.toLowerCase()===String(t.name).toLowerCase()))p.milestones.push(mkMs(String(t.name),pctFromName(t.name)))});
    [['ph-dd','50% DD',50],['ph-dd','100% DD',100],['ph-ti','70% Tender',70],['ph-ti','100% Tender',100]].forEach(([id,n,tg])=>{const p=o.phases.find(x=>x.id===id);if(p&&!p.milestones.some(m=>m.name.toLowerCase()===n.toLowerCase()))p.milestones.push(mkMs(n,tg))});
  }
  const phs=new Set(o.phases.map(p=>p.id));
  o.projects.forEach(p=>{p.name=String(p.name||'Untitled');p.code=String(p.code||'—');p.client=p.client||'';p.description=p.description||'';p.notes=p.notes||'';p.links=arr(p.links);if(!P_STAT.includes(p.status))p.status='Not started';p.archived=!!p.archived;p.example=!!p.example;{const sv=new Set(o.services.map(x=>x.id));p.serviceIds=[...new Set(arr(p.serviceIds).filter(id=>sv.has(id)))]}});
  const pids=new Set(o.projects.map(p=>p.id));
  o.deliverables=o.deliverables.filter(x=>pids.has(x.projectId));
  o.deliverables.forEach(x=>{x.name=String(x.name||'Deliverable');if(!D_STAT.includes(x.status))x.status='Planned';x.start=isoOK(x.start)?x.start:null;x.due=isoOK(x.due)?x.due:null;x.ownerId=x.ownerId||null;x.notes=x.notes||'';x.seq=x.seq||0;if(x.start&&x.due&&x.start>x.due)x.start=null;
    if(!phs.has(x.phaseId))x.phaseId=o.phases[0].id;
    const ph=o.phases.find(p=>p.id===x.phaseId);x.milestoneId=ph.milestones.some(m=>m.id===x.milestoneId)?x.milestoneId:null;x.milestoneRev=x.milestoneId?(x.milestoneRev||ph.milestones.find(m=>m.id===x.milestoneId).updatedAt):null;
    const c={};if(x.checks&&typeof x.checks==='object')Object.keys(x.checks).forEach(k=>{if(x.checks[k]===true)c[k]=true});x.checks=c});
  const dmap=new Map(o.deliverables.map(x=>[x.id,x])),pe=new Set(o.people.map(p=>p.id)),svs=new Set(o.services.map(x=>x.id));
  o.tasks=o.tasks.filter(t=>pids.has(t.projectId));
  o.tasks.forEach(t=>{
    t.name=String(t.name||'Untitled task');const dv=t.deliverableId&&dmap.get(t.deliverableId);t.deliverableId=dv&&dv.projectId===t.projectId?dv.id:null;
    t.phaseId=t.deliverableId?null:(phs.has(t.phaseId)?t.phaseId:null);t.assignedToId=pe.has(t.assignedToId)?t.assignedToId:null;t.serviceId=svs.has(t.serviceId)?t.serviceId:null;
    if(!T_STAT.includes(t.status))t.status='To Do';if(!PRIOS.includes(t.priority))t.priority='Normal';if(!SOURCES.includes(t.source))t.source='Planned';
    t.due=isoOK(t.due)?t.due:null;t.notes=String(t.notes||'');t.links=arr(t.links).filter(l=>l&&typeof l==='object').map(l=>({label:String(l.label||''),url:String(l.url||'')}));
    t.createdAt=t.createdAt||now;t.updatedAt=t.updatedAt||t.createdAt;t.completedAt=t.status==='Done'?(t.completedAt||t.updatedAt):null;t.seq=t.seq||0});
  o.defaults.phaseIds=d.defaults&&Array.isArray(d.defaults.phaseIds)?d.defaults.phaseIds.filter((id,i,a)=>phs.has(id)&&a.indexOf(id)===i):o.phases.filter(p=>p.active).map(p=>p.id);
  const seen=new Set();
  o.projectPhases=o.projectPhases.filter(x=>{const k=x.projectId+'|'+x.phaseId;if(!pids.has(x.projectId)||!phs.has(x.phaseId)||seen.has(k))return false;seen.add(k);return true});
  o.projectPhases.forEach((x,i)=>{x.start=isoOK(x.start)?x.start:null;x.end=isoOK(x.end)?x.end:null;if(x.start&&x.end&&x.start>x.end)x.end=null;if(!PP_STAT.includes(x.status))x.status='Not started';x.notes=String(x.notes||'');x.order=typeof x.order==='number'?x.order:i});
  if(!hadPP)o.projects.forEach(p=>o.defaults.phaseIds.forEach(id=>ensurePP(p.id,id,o)));
  // every deliverable and phase-linked task needs its project phase instance (created without dates)
  o.deliverables.forEach(x=>ensurePP(x.projectId,x.phaseId,o));
  o.tasks.forEach(t=>{if(t.phaseId)ensurePP(t.projectId,t.phaseId,o)});
  ensureProjSeq(o);normViews(o,d);normBrand(o,d);normRes(o,d);normRoles(o,d);normWF(o,d);
  return o;
}
function relIssues(d){
  const out=[],P=new Map(arr(d.projects).filter(p=>p&&p.id).map(p=>[p.id,p])),D=new Map(arr(d.deliverables).filter(x=>x&&x.id).map(x=>[x.id,x]));
  const pe=new Set(arr(d.people).map(p=>p&&p.id)),ph=new Set(arr(d.phases).map(p=>p&&p.id)),sv=new Set((Array.isArray(d.services)?d.services:defaultServices()).map(s=>s&&s.id));
  const nm=x=>`“${String(x.name||x.id||'unnamed').slice(0,60)}”`;
  arr(d.deliverables).forEach(x=>{if(!x)return;if(!P.has(x.projectId))out.push(`Deliverable ${nm(x)} belongs to a project that isn't in the backup. It will be skipped.`);else if(x.phaseId&&!ph.has(x.phaseId))out.push(`Deliverable ${nm(x)} uses a phase that isn't in the backup. It will move to the first phase.`)});
  arr(d.projectPhases).forEach(x=>{if(!x)return;if(!P.has(x.projectId))out.push('A project phase belongs to a project that isn’t in the backup. It will be skipped.');else if(!ph.has(x.phaseId))out.push(`A phase of project ${P.get(x.projectId).code||''} uses a phase definition that isn’t in the backup. It will be skipped.`)});
  arr(d.tasks).forEach(t=>{
    if(!t||!t.id){out.push('A task without an id will be skipped.');return}
    if(!P.has(t.projectId)){out.push(`Task ${nm(t)} belongs to a project that isn't in the backup. It will be skipped.`);return}
    if(t.deliverableId){const x=D.get(t.deliverableId);if(!x||x.projectId!==t.projectId)out.push(`Task ${nm(t)} links to a deliverable that isn't in its project. It will become a general task.`)}
    if(t.assignedToId&&!pe.has(t.assignedToId))out.push(`Task ${nm(t)} is assigned to a person who isn't in the backup. It will be unassigned.`);
    if(t.phaseId&&!t.deliverableId&&!ph.has(t.phaseId))out.push(`Task ${nm(t)} uses a phase that isn't in the backup. Its phase will be cleared.`);
    if(t.serviceId&&!sv.has(t.serviceId))out.push(`Task ${nm(t)} uses a discipline that isn't in the backup. It will be cleared.`);
  });
  const V=new Set();arr(d.views).forEach(v=>{if(!v||!v.id){out.push('A saved view without an id will be skipped.');return}V.add(v.id);if(v.projectId&&!P.has(v.projectId)){V.delete(v.id);out.push(`Saved view ${nm(v)} belongs to a project that isn't in the backup. It will be skipped.`)}});
  arr(d.favorites).forEach(f=>{if(!f||!V.has(f.viewId))out.push('A favorite points to a saved view that isn’t in the backup. It will be removed from Favorites.')});
  const pe2=new Set(arr(d.people).map(p=>p&&p.id));const badA=arr(d.assignments).filter(a=>!a||!P.has(a.projectId)||!pe2.has(a.personId)).length;
  if(badA)out.push(`${plural(badA,'resource assignment')} refer${badA===1?'s':''} to a project or person that isn’t in the backup and will be skipped.`);
  const badH=arr(d.assignments).filter(a=>a&&!(+a.hours>=0&&+a.hours<=168)).length;if(badH)out.push(`${plural(badH,'resource assignment')} with invalid hours will be skipped.`);
  return out;
}
// One place for task changes: keeps completedAt and the deliverable / phase links consistent.
function setTaskField(t,f,v){
  if(f==='status'){if(v==='Done'&&t.status!=='Done')t.completedAt=new Date().toISOString();else if(v!=='Done')t.completedAt=null}
  if(f==='deliverableId'){v=v||null;if(v){const d=deliv(v);if(!d||d.projectId!==t.projectId)return false;t.phaseId=null}else if(t.deliverableId){t.phaseId=deliv(t.deliverableId)?.phaseId||null}}
  if(f==='phaseId'&&v&&(t.deliverableId||!ppFor(t.projectId,v)))return false;
  if(f==='projectId'&&v!==t.projectId){if(t.deliverableId)t.phaseId=deliv(t.deliverableId)?.phaseId||null;t.deliverableId=null;if(t.phaseId&&!ppFor(v,t.phaseId))t.phaseId=null}
  t[f]=v;t.updatedAt=new Date().toISOString();return true;
}

