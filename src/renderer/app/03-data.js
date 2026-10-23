/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- data ---------- */
const person=id=>S.people.find(p=>p.id===id);
const pname=id=>person(id)?.name||'Unassigned';
const phase=id=>S.phases.find(p=>p.id===id);
const phColor=id=>phase(id)?.color||'#8A93A3';
const phName=id=>phase(id)?.name||'No phase';
const project=id=>S.projects.find(p=>p.id===id);
const delivsOf=pid=>S.deliverables.filter(d=>d.projectId===pid);
const ownerId=d=>d.ownerId||project(d.projectId)?.pmId||null;
const isOverdue=d=>!!d.due&&d.status!=='Delivered'&&iso2dn(d.due)<todayDN();
const phIdx=d=>{const i=S.phases.findIndex(p=>p.id===d.phaseId);return i<0?99:i};
function sortDelivs(arr){const k=d=>d.due?iso2dn(d.start||d.due):Infinity;return arr.slice().sort((a,b)=>(k(a)-k(b))||((iso2dn(a.due)??Infinity)-(iso2dn(b.due)??Infinity))||(phIdx(a)-phIdx(b))||((a.seq||0)-(b.seq||0)))}
function nextPending(ds){let best=null;for(const d of ds){if(!d.due||d.status==='Delivered')continue;if(!best||d.due<best.due)best=d}return best}
const codeTaken=(code,exceptId)=>S.projects.find(p=>p.id!==exceptId&&p.code.trim().toLowerCase()===code.trim().toLowerCase());
const deliv=id=>S.deliverables.find(d=>d.id===id);
const service=id=>S.services.find(s=>s.id===id);
const tasksOf=pid=>S.tasks.filter(t=>t.projectId===pid);
const delivTasks=did=>S.tasks.filter(t=>t.deliverableId===did);
const taskPhaseId=t=>t.deliverableId?(deliv(t.deliverableId)?.phaseId||null):(t.phaseId||null);
const taskOpen=t=>t.status!=='Done';
const isTaskOverdue=t=>!!t.due&&t.status!=='Done'&&iso2dn(t.due)<todayDN();
const taskLate=t=>{if(!t.due||!t.deliverableId)return false;const d=deliv(t.deliverableId);return !!(d&&d.due&&t.due>d.due)};
function sortTasks(arr){const pr={High:0,Normal:1,Low:2};return arr.slice().sort((a,b)=>((a.status==='Done')-(b.status==='Done'))||((iso2dn(a.due)??Infinity)-(iso2dn(b.due)??Infinity))||((pr[a.priority]??1)-(pr[b.priority]??1))||((a.seq||0)-(b.seq||0)))}
function newTask(o){const now=new Date().toISOString();return {id:uid('tk'),projectId:o.projectId,deliverableId:o.deliverableId||null,name:o.name,assignedToId:o.assignedToId||null,status:o.status||'To Do',priority:o.priority||'Normal',due:o.due||null,phaseId:o.deliverableId?null:(o.phaseId||null),serviceId:o.serviceId||null,source:o.source||'Planned',notes:o.notes||'',links:o.links||[],createdAt:now,updatedAt:now,completedAt:o.status==='Done'?now:null,seq:nextSeq()}}
// One place for task changes: keeps completedAt and the deliverable/phase link consistent.
function setTaskField(t,f,v){
  /* a Decision / QA is completed with its answer */
  if(f==='status'&&v==='Done'&&t.status!=='Done'&&typeof wfStep==='function'&&t.wfStepId){const s=wfStep(t.wfStepId);if(s&&wfIsDec(s)&&!t.wfAnswer&&wfIsInt(t)){toast(`“${s.name}” needs an answer (Yes or No) before it can be completed.`,'err');return false}}
  if(f==='status'){if(v==='Done'&&t.status!=='Done')t.completedAt=new Date().toISOString();else if(v!=='Done')t.completedAt=null}
  if(f==='status'&&v==='Done'&&t.status!=='Done'&&typeof wfOnDone==='function'&&t.wfStepId)setTimeout(()=>wfOnDone(t),0);   // rework with a review return: asked once
  if(f==='deliverableId'){v=v||null;if(v){const d=deliv(v);if(!d||d.projectId!==t.projectId)return false;t.phaseId=null}else if(t.deliverableId){t.phaseId=deliv(t.deliverableId)?.phaseId||null}}
  if(f==='projectId'&&v!==t.projectId){if(t.deliverableId)t.phaseId=deliv(t.deliverableId)?.phaseId||null;t.deliverableId=null}
  t[f]=v;t.updatedAt=new Date().toISOString();return true;
}
let seqN=Date.now();
const nextSeq=()=>++seqN;

function defaultPhases(){return [
  {id:'ph-fee',name:'Fee',color:COLORS[0]},
  {id:'ph-sd',name:'Sketch / Schematic Design',color:COLORS[1]},
  {id:'ph-dd',name:'Design Development',color:COLORS[2]},
  {id:'ph-ti',name:'Tender Issue',color:COLORS[3]},
  {id:'ph-ci',name:'Construction Issue',color:COLORS[4]}]}
function defaultTemplate(){return [
  {id:'t1',name:'Sketch',phaseId:'ph-sd'},{id:'t2',name:'50% DD',phaseId:'ph-dd'},{id:'t3',name:'100% DD',phaseId:'ph-dd'},
  {id:'t4',name:'Tender Issue',phaseId:'ph-ti'},{id:'t5',name:'Construction Issue',phaseId:'ph-ci'}]}
function exampleData(){
  const t=todayDN(),D=n=>dn2iso(t+n);
  const people=[{id:'pe-sm',name:'Sarah Mitchell',example:true},{id:'pe-jo',name:'James Okafor',example:true},{id:'pe-lc',name:'Laura Chen',example:true},{id:'pe-dr',name:'Daniel Ruiz',example:true}];
  const P=(id,code,name,client,pm,status,extra={})=>({id,code,name,client,pmId:pm,status,description:'',notes:'',links:[],archived:false,example:true,createdAt:new Date().toISOString(),...extra});
  const projects=[
    P('px-rmc','AZ-2401','Riverside Medical Centre','Swan Valley Health Trust','pe-sm','In progress',{description:'Structural and civil design for a three-storey outpatient building with basement car park.',notes:'Client review meetings every second Tuesday. Hydraulic consultant still to confirm stormwater connection point.',links:[{label:'Project folder',url:'https://example.com/projects/AZ-2401'},{label:'Revizto project',url:'https://example.com/revizto/AZ-2401'}]}),
    P('px-fft','AZ-2407','Fremantle Ferry Terminal Upgrade','Port Coast Authority','pe-jo','In progress',{description:'Wharf strengthening and new passenger canopy.'}),
    P('px-jps','AZ-2412','Joondalup Primary School Extension','Northern Schools Authority','pe-lc','In progress'),
    P('px-klw','AZ-2415','Kwinana Logistics Warehouse','Cockburn Freight Co.','pe-dr','On hold',{notes:'On hold pending land title transfer.'}),
    P('px-nof','AZ-2420','Northbridge Office Fitout','','pe-sm','Not started')];
  let dxi=0;const d=(projectId,name,phaseId,start,due,status,notes='')=>({id:'dx'+(++dxi),projectId,name,phaseId,start:start==null?null:D(start),due:due==null?null:D(due),ownerId:null,status,notes,seq:nextSeq()});
  const deliverables=[
    d('px-rmc','Fee proposal','ph-fee',null,-95,'Delivered'),
    d('px-rmc','Schematic Design','ph-sd',-80,-40,'Delivered'),
    d('px-rmc','50% DD','ph-dd',-35,-3,'In progress','Waiting on architect background update.'),
    d('px-rmc','100% DD','ph-dd',-2,26,'Planned'),
    d('px-rmc','Revised DD','ph-dd',null,40,'Planned'),
    d('px-rmc','Tender Issue','ph-ti',45,75,'Planned'),
    d('px-rmc','Construction Issue','ph-ci',null,120,'Planned'),
    d('px-fft','Fee proposal','ph-fee',null,-60,'Delivered'),
    d('px-fft','Sketch','ph-sd',-50,-20,'Delivered'),
    d('px-fft','50% DD','ph-dd',-18,5,'In progress'),
    d('px-fft','100% DD','ph-dd',null,34,'Waiting information','Geotech report outstanding.'),
    d('px-fft','Tender Issue','ph-ti',null,70,'Planned'),
    d('px-jps','Fee proposal','ph-fee',null,-30,'Delivered'),
    d('px-jps','Sketch','ph-sd',-10,12,'In progress'),
    d('px-jps','Design Development','ph-dd',14,60,'Planned'),
    d('px-jps','Tender Issue','ph-ti',null,null,'Planned'),
    d('px-klw','Fee proposal','ph-fee',null,-45,'Delivered'),
    d('px-klw','Sketch','ph-sd',null,-12,'Waiting information'),
    d('px-nof','Fee proposal','ph-fee',null,9,'Planned'),
    d('px-nof','Sketch','ph-sd',null,null,'Planned')];
  // Laura owns one deliverable on another project, to show per-deliverable responsibility
  deliverables[13].ownerId='pe-lc';
  return {people,projects,deliverables};
}
function seed(){const ex=exampleData();const st={version:2,people:ex.people,phases:defaultPhases(),template:defaultTemplate(),services:defaultServices(),projects:ex.projects,deliverables:ex.deliverables,tasks:[]};st.tasks=exampleTasks(st);return st}
function arr(x){return Array.isArray(x)?x:[]}
function normalize(d){
  const o={version:2,people:arr(d.people).filter(p=>p&&p.id&&p.name),phases:arr(d.phases).filter(p=>p&&p.id),template:arr(d.template).filter(t=>t&&t.id),projects:arr(d.projects).filter(p=>p&&p.id),deliverables:arr(d.deliverables).filter(x=>x&&x.id),services:Array.isArray(d.services)?d.services.filter(x=>x&&x.id&&x.name).map(x=>({id:x.id,name:String(x.name)})):defaultServices(),tasks:arr(d.tasks).filter(t=>t&&t.id)};
  if(!o.phases.length)o.phases=defaultPhases();
  o.phases.forEach((p,i)=>{p.name=String(p.name||'Phase');if(!/^#[0-9a-f]{6}$/i.test(p.color||''))p.color=COLORS[i%COLORS.length]});
  o.projects.forEach(p=>{p.name=String(p.name||'Untitled');p.code=String(p.code||'—');p.client=p.client||'';p.description=p.description||'';p.notes=p.notes||'';p.links=arr(p.links);if(!P_STAT.includes(p.status))p.status='Not started';p.archived=!!p.archived;p.example=!!p.example});
  const pids=new Set(o.projects.map(p=>p.id));
  o.deliverables=o.deliverables.filter(x=>pids.has(x.projectId));
  o.deliverables.forEach(x=>{x.name=String(x.name||'Deliverable');if(!D_STAT.includes(x.status))x.status='Planned';x.start=x.start||null;x.due=x.due||null;x.ownerId=x.ownerId||null;x.notes=x.notes||'';x.seq=x.seq||0;if(x.start&&x.due&&x.start>x.due)x.start=null});
  const dmap=new Map(o.deliverables.map(x=>[x.id,x])),pe=new Set(o.people.map(p=>p.id)),phs=new Set(o.phases.map(p=>p.id)),svs=new Set(o.services.map(x=>x.id)),now=new Date().toISOString();
  o.tasks=o.tasks.filter(t=>pids.has(t.projectId));
  o.tasks.forEach(t=>{
    t.name=String(t.name||'Untitled task');const dv=t.deliverableId&&dmap.get(t.deliverableId);t.deliverableId=dv&&dv.projectId===t.projectId?dv.id:null;
    t.phaseId=t.deliverableId?null:(phs.has(t.phaseId)?t.phaseId:null);t.assignedToId=pe.has(t.assignedToId)?t.assignedToId:null;t.serviceId=svs.has(t.serviceId)?t.serviceId:null;
    if(!T_STAT.includes(t.status))t.status='To Do';if(!PRIOS.includes(t.priority))t.priority='Normal';if(!SOURCES.includes(t.source))t.source='Planned';
    t.due=typeof t.due==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.due)?t.due:null;t.notes=String(t.notes||'');
    t.links=arr(t.links).filter(l=>l&&typeof l==='object').map(l=>({label:String(l.label||''),url:String(l.url||'')}));
    t.createdAt=t.createdAt||now;t.updatedAt=t.updatedAt||t.createdAt;t.completedAt=t.status==='Done'?(t.completedAt||t.updatedAt):null;t.seq=t.seq||0;
  });
  return o;
}
function load(){
  let migrated=false;
  try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);const noSeq=arr(parsed.projects).some(p=>!p||!p.seq);S=normalize(parsed);migrated=noSeq||parsed.version!==4||!parsed.branding||parsed.branding.logo!==undefined||!Array.isArray(parsed.assignments)}}catch(e){storageOK=false}
  if(!S){S=seed();save(true)}else if(migrated)save(true);
  try{const p=JSON.parse(localStorage.getItem(PKEY)||'null');if(p){prefs={...prefs,...p,filters:{...prefs.filters,...(p.filters||{})},sort:{...prefs.sort,...(p.sort||{})},tf:{...TF0(),...(p.tf||{})},ptf:{...PTF0(),...(p.ptf||{})},tvG:{...prefs.tvG,...(p.tvG||{})},tvP:{...prefs.tvP,...(p.tvP||{})},expanded:{...(p.expanded||{})},activeView:{...(p.activeView&&typeof p.activeView==='object'?p.activeView:{})},drafts:{...(p.drafts&&typeof p.drafts==='object'?p.drafts:{})},resF:{...prefs.resF,...(p.resF||{})},resCollapsed:{...(p.resCollapsed||{})}};if(prefs.sortV!==2){prefs.sort={k:'',dir:1};prefs.sortV=2}if(!RANGES[prefs.range])prefs.range='3w';if(!['timeline','table','calendar'].includes(prefs.ovMode))prefs.ovMode='timeline'}}catch(e){}
}
function save(quiet){
  try{localStorage.setItem(KEY,JSON.stringify(S));storageOK=true;lastSaved=new Date();}
  catch(e){storageOK=false;if(!quiet)toast('Could not save in this browser. Export a backup to keep your changes.','err')}
  setSaveInd();
}
function savePrefs(){try{localStorage.setItem(PKEY,JSON.stringify(prefs))}catch(e){}}


