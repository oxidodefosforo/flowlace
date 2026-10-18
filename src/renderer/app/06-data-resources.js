/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- v6 data: resource planning (planned hours per project, person and week) ---------- */
const DEF_TEAMS=()=>['Facilities','Fitout','Construction'].map(n=>({id:'tm-'+n.toLowerCase(),name:n}));
function perthToday(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Perth',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return dn2iso(todayDN())}}
const weekOf=iso=>{const n=iso2dn(iso);return dn2iso(n-dowMon(n))};
const thisWeek=()=>weekOf(perthToday());
const r2=n=>Math.round(n*100)/100;
const okHours=h=>typeof h==='number'&&isFinite(h)&&h>=0&&h<=168;
function normRes(o,d){
  const now=new Date().toISOString(),hadRes=Array.isArray(d.assignments);
  o.projectTeams=Array.isArray(d.projectTeams)?d.projectTeams.filter(x=>x&&x.id&&x.name).map(x=>({id:String(x.id),name:String(x.name).slice(0,60)})):DEF_TEAMS();
  if(!hadRes&&!o.services.some(s=>s.name.toLowerCase()==='fire'))o.services.push({id:o.services.some(s=>s.id==='sv-fire')?uid('sv'):'sv-fire',name:'Fire'});
  const svs=new Set(o.services.map(s=>s.id)),tms=new Set(o.projectTeams.map(t=>t.id));
  const exD={'pe-sm':['sv-electrical',30],'pe-jo':['sv-electrical',38],'pe-lc':['sv-mechanical',38],'pe-dr':['sv-hydraulics',null]};
  o.people.forEach(pe=>{const fresh=!('active' in pe);
    if(fresh&&pe.example&&exD[pe.id]){pe.disciplineId=exD[pe.id][0];pe.capacity=exD[pe.id][1]}
    pe.disciplineId=svs.has(pe.disciplineId)?pe.disciplineId:null;
    const c=pe.capacity===''||pe.capacity==null?null:+pe.capacity;pe.capacity=okHours(c)?r2(c):null;pe.active=pe.active!==false});
  const exT={'px-rmc':'tm-facilities','px-fft':'tm-construction','px-jps':'tm-facilities','px-klw':'tm-construction','px-nof':'tm-fitout'};
  o.projects.forEach(p=>{if(!hadRes&&p.example&&!p.teamId&&exT[p.id])p.teamId=exT[p.id];p.teamId=tms.has(p.teamId)?p.teamId:null});
  const pids=new Set(o.projects.map(p=>p.id)),pes=new Set(o.people.map(p=>p.id)),byKey=new Map();
  arr(d.assignments).forEach(a=>{if(!a||!pids.has(a.projectId)||!pes.has(a.personId)||!isOK(a.weekStart))return;const h=+a.hours;if(!okHours(h))return;
    const x={id:String(a.id||uid('as')),projectId:a.projectId,personId:a.personId,weekStart:weekOf(a.weekStart),hours:r2(h),note:String(a.note||'').slice(0,500),createdAt:a.createdAt||now,updatedAt:a.updatedAt||a.createdAt||now};
    const k=x.projectId+'|'+x.personId+'|'+x.weekStart,prev=byKey.get(k);if(!prev||String(prev.updatedAt)<=String(x.updatedAt))byKey.set(k,x)});
  o.assignments=[...byKey.values()];
  const byCap=new Map();
  arr(d.capacityOverrides).forEach(c=>{if(!c||!pes.has(c.personId)||!isOK(c.weekStart))return;const h=+c.hours;if(!okHours(h))return;
    const x={id:String(c.id||uid('cw')),personId:c.personId,weekStart:weekOf(c.weekStart),hours:r2(h),note:String(c.note||'').slice(0,200),updatedAt:c.updatedAt||now};byCap.set(x.personId+'|'+x.weekStart,x)});
  o.capacityOverrides=[...byCap.values()];
  const m=d.resMeeting&&typeof d.resMeeting==='object'?d.resMeeting:{};
  o.resMeeting={added:arr(m.added).filter(id=>pids.has(id)),hidden:arr(m.hidden).filter(id=>pids.has(id))};
}
function isOK(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)}

/* hidden project number: creation order, the default order everywhere unless a sort is chosen */
const nextProjSeq=()=>S.projects.reduce((m,p)=>Math.max(m,+p.seq||0),0)+1;
function ensureProjSeq(st){
  const ok=p=>Number.isInteger(p.seq)&&p.seq>0,used=new Set();let max=0;
  st.projects.forEach(p=>{if(ok(p)&&!used.has(p.seq)){used.add(p.seq);max=Math.max(max,p.seq)}else p.seq=null});
  st.projects.map((p,i)=>({p,i})).filter(x=>x.p.seq==null).sort((a,b)=>String(a.p.createdAt||'').localeCompare(String(b.p.createdAt||''))||a.i-b.i).forEach(x=>{x.p.seq=++max});
}

// default project order everywhere: creation order (hidden project number), then code
const codeSort=(a,b)=>((a.seq||0)-(b.seq||0))||String(a.code).localeCompare(String(b.code),undefined,{numeric:true});
const missingExampleTasks=()=>exampleTasks(S).filter(t=>!S.tasks.some(x=>x.id===t.id));
const slug=s=>String(s).toLowerCase().replace(/[^a-z]+/g,'-');
const fmtShort=n=>{const[,m,d]=ymd(n);return `${String(d).padStart(2,'0')} ${MON[m]}`};
const peopleOpts=sel=>S.people.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}"${p.id===sel?' selected':''}>${esc(p.name)}</option>`).join('');
const opts=(list,v)=>list.map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('');
const phaseOpts=v=>S.phases.map(p=>`<option value="${p.id}"${p.id===v?' selected':''}>${esc(p.name)}</option>`).join('');
function activeFilterCount(){const f=prefs.filters;return [f.q.trim(),f.pm,f.status,f.phase,f.from||f.to].filter(Boolean).length}
function renderProjects(){
  const tab=prefs.projTab,q=prefs.projQ.trim().toLowerCase();
  const act=S.projects.filter(p=>!p.archived),arc=S.projects.filter(p=>p.archived);
  let list=(tab==='archived'?arc:act).filter(p=>!q||p.name.toLowerCase().includes(q)||p.code.toLowerCase().includes(q)||(p.client||'').toLowerCase().includes(q));
  list.sort(codeSort);
  let h=`<div class="pagehead"><h1>Projects</h1><span class="spacer"></span><input class="in" type="search" id="proj-q" placeholder="Search name, code or client" aria-label="Search projects" value="${esc(prefs.projQ)}" autocomplete="off" style="max-width:280px"><button class="btn primary" data-act="new-project">+ New project</button></div>`;
  h+=`<div class="tabs" role="tablist"><button role="tab" data-act="proj-tab" data-v="active" aria-selected="${tab!=='archived'}">Active (${act.length})</button><button role="tab" data-act="proj-tab" data-v="archived" aria-selected="${tab==='archived'}">Archived (${arc.length})</button></div>`;
  if(!list.length){
    h+=tab==='archived'?`<div class="empty"><h2>No archived projects</h2><p>Archive a finished project to keep it out of the Overview without deleting it.</p></div>`
      :q?`<div class="empty"><h2>No projects match “${esc(prefs.projQ)}”</h2></div>`
      :`<div class="empty"><h2>No projects yet</h2><p>Only a name and a code are needed to start.</p><div class="row"><button class="btn primary" data-act="new-project">+ New project</button></div></div>`;
    return h;
  }
  h+=`<div class="twrap"><table class="tbl edit"><thead><tr><th>Project</th><th>Client</th><th>PM</th><th>Status</th><th class="num">Delivered</th><th class="num">Open tasks</th><th>Next due</th><th class="act"><span class="sr">Actions</span></th></tr></thead><tbody>`;
  list.forEach(p=>{const ds=delivsOf(p.id),np=nextPending(ds),over=ds.filter(isOverdue).length;
    h+=`<tr><td><div class="tblname" style="padding-left:6px"><div class="pcell"><span class="code">${esc(p.code)}</span><button class="linkbtn" data-act="open-project" data-id="${p.id}">${esc(p.name)}</button></div>${p.example?'<span class="ex">Example</span>':''}</div></td>
      <td><input id="pl-${p.id}-client" data-ent="p" data-id="${p.id}" data-f="client" value="${esc(p.client)}" placeholder="—" aria-label="Client"></td>
      <td>${personPicker('pl-'+p.id+'-pm',p.pmId,`data-ent="p" data-id="${p.id}" data-f="pmId" aria-label="PM"`)}</td>
      <td><select id="pl-${p.id}-st" data-ent="p" data-id="${p.id}" data-f="status" aria-label="Status">${opts(P_STAT,p.status)}</select></td>
      <td class="num">${ds.filter(d=>d.status==='Delivered').length} / ${ds.length}${over?` <span class="chip c-d">! ${over}</span>`:''}</td>
      <td class="num nowrap">${taskCountCell(p.id)}</td>
      <td class="nowrap">${np?`${fmt(np.due)} <span class="muted">· ${esc(np.name)}</span>`:'<span class="muted">—</span>'}</td>
      <td class="act">${tab==='archived'?`<button class="btn sm" data-act="restore-project" data-id="${p.id}">Restore</button> <button class="btn sm ghost danger-t" data-act="delete-project" data-id="${p.id}">Delete</button>`:`<button class="btn sm" data-act="open-project" data-id="${p.id}">Open</button> <button class="btn sm ghost" data-act="panel-project" data-id="${p.id}">Details</button> <button class="btn sm ghost" data-act="dup-project" data-id="${p.id}">Duplicate</button> <button class="btn sm ghost" data-act="archive-project" data-id="${p.id}">Archive</button>`}</td></tr>`});
  h+=`</tbody></table></div>`;
  return h;
}
async function deleteDeliverable(id){
  const d=deliv(id);if(!d)return;const ts=delivTasks(id),code=esc(project(d.projectId)?.code||'');let choice='none';
  if(ts.length){
    choice=await choiceBox('Delete deliverable?',`<p>“${esc(d.name)}” has ${plural(ts.length,'linked task')}. Keep them as general tasks of ${code}, or delete them together with the deliverable? This can't be undone.</p>`,[{v:'keep',l:`Delete, keep ${plural(ts.length,'task')}`,c:'primary'},{v:'all',l:'Delete deliverable and tasks',c:'danger'}]);
    if(!choice)return;
  }else if(!await confirmBox('Delete deliverable?',`“${esc(d.name)}” will be removed from ${code}. This can't be undone.`))return;
  const now=new Date().toISOString();
  if(choice==='keep')ts.forEach(t=>{t.phaseId=d.phaseId||null;t.deliverableId=null;t.updatedAt=now});
  if(choice==='all'){const k=new Set(ts.map(t=>t.id));S.tasks=S.tasks.filter(t=>!k.has(t.id))}
  S.deliverables=S.deliverables.filter(x=>x.id!==id);if(ui.panel&&ui.panel.type==='deliv'&&ui.panel.id===id)ui.panel=ui.panelStack.pop()||null;save();closeModal(true);render();
  toast(choice==='keep'?`Deliverable deleted · ${plural(ts.length,'task')} kept as general tasks`:choice==='all'?`Deliverable and ${plural(ts.length,'task')} deleted`:'Deliverable deleted');
}
async function deleteProject(id){
  const p=project(id);if(!p)return;const n=delivsOf(id).length,nt=tasksOf(id).length;
  const ok=await confirmBox(`Delete ${esc(p.code)}?`,`“${esc(p.name)}” with its ${plural(n,'deliverable')} and ${plural(nt,'task')} will be permanently deleted${(k=>k?`, with ${plural(k,'planned-hours entry','planned-hours entries')} in Resources`:'')(S.assignments.filter(a=>a.projectId===id).length)}${viewsFor(id).length?`, together with its ${plural(viewsFor(id).length,'saved view')}${S.favorites.some(f=>viewsFor(id).some(v=>v.id===f.viewId))?' and their Favorites shortcuts':''}`:''}. To keep it for reference, archive it instead.`,'Delete project');
  if(!ok)return;S.projects=S.projects.filter(x=>x.id!==id);S.deliverables=S.deliverables.filter(d=>d.projectId!==id);S.projectPhases=S.projectPhases.filter(x=>x.projectId!==id);deleteViews(viewsFor(id).map(v=>v.id));delete prefs.activeView[id];S.assignments=S.assignments.filter(a=>a.projectId!==id);S.resMeeting.added=S.resMeeting.added.filter(x=>x!==id);S.resMeeting.hidden=S.resMeeting.hidden.filter(x=>x!==id);if(prefs.resF.project===id)prefs.resF.project='';S.tasks=S.tasks.filter(t=>t.projectId!==id);delete prefs.expanded[id];if(prefs.tf.project===id)prefs.tf.project='';savePrefs();save();toast('Project deleted');if(ui.panel){ui.panel=null;ui.panelStack=[]}
  if(ui.view==='project'&&ui.pid===id)go('projects');else render();
}
async function removeExamples(){
  const ex=S.projects.filter(p=>p.example);if(!ex.length)return;
  const ok=await confirmBox('Remove example data?',`${plural(ex.length,'example project')} and their phases, deliverables, tasks and saved views will be removed. Your own projects are not affected.`,'Remove examples');
  if(!ok)return;
  const ids=new Set(ex.map(p=>p.id));S.projects=S.projects.filter(p=>!ids.has(p.id));S.deliverables=S.deliverables.filter(d=>!ids.has(d.projectId));S.projectPhases=S.projectPhases.filter(x=>!ids.has(x.projectId));deleteViews(S.views.filter(v=>ids.has(v.projectId)).map(v=>v.id));S.assignments=S.assignments.filter(a=>!ids.has(a.projectId));['added','hidden'].forEach(k=>S.resMeeting[k]=S.resMeeting[k].filter(x=>!ids.has(x)));savePrefs();S.tasks=S.tasks.filter(t=>!ids.has(t.projectId));
  S.people=S.people.filter(pe=>!pe.example||S.assignments.some(a=>a.personId===pe.id)||S.projects.some(p=>p.pmId===pe.id)||S.deliverables.some(d=>d.ownerId===pe.id)||S.tasks.some(t=>t.assignedToId===pe.id));
  if(prefs.tf.project&&!project(prefs.tf.project))prefs.tf.project='';['pm','assignee'].forEach(k=>{if(prefs.tf[k]&&prefs.tf[k]!=='__none'&&!person(prefs.tf[k]))prefs.tf[k]=''});
  if(prefs.filters.pm&&!person(prefs.filters.pm)){prefs.filters.pm='';savePrefs()}
  save();render();toast('Example data removed');
}
function loadExamples(){
  const ex=exampleData();
  ex.people.forEach(pe=>{if(!person(pe.id))S.people.push(pe)});
  ex.projects.forEach(p=>{if(!project(p.id)){if(codeTaken(p.code))p.code=p.code+'-EX';S.projects.push(p)}});
  ex.deliverables.forEach(d=>{if(!S.deliverables.some(x=>x.id===d.id))S.deliverables.push(d)});
  S.deliverables.forEach(d=>{if(!('checks' in d)){d.milestoneId=null;d.milestoneRev=null;d.checks={}}});S.projects.filter(p=>p.example).forEach(p=>S.defaults.phaseIds.forEach(id=>{if(phase(id))ensurePP(p.id,id)}));S.deliverables.forEach(d=>{if(!phase(d.phaseId))d.phaseId=S.phases[0].id;ensurePP(d.projectId,d.phaseId)});applyExamplePhases(S);ensureProjSeq(S);
  S.tasks.push(...missingExampleTasks());
  if(!S.workflow||!S.workflow.steps.length){S.workflow=null;S.workflowDraft=null;wfBoot()}   // desktop: the demo workflow is example data too
  save();render();toast('Example projects loaded');
}
function exportData(){
  const json=JSON.stringify({app:'alphazeta-project-planner',version:4,exportedAt:new Date().toISOString(),data:S},null,2);
  const name=`${(appName().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'flowlace')}-backup-${dn2iso(todayDN())}.json`;
  try{const blob=new Blob([json],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}catch(e){}
  openModal(`<div class="m-head"><div><div class="eyebrow">Backup</div><h2>Backup ready</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <p>If your browser downloaded <span class="mono">${name}</span>, you're done. Some embedded views block downloads: in that case copy the text below and save it in a file ending in <span class="mono">.json</span>.</p>
    <textarea class="in code-area" id="exp-txt" readonly rows="10">${esc(json)}</textarea>
    <div class="m-actions"><button class="btn" data-act="copy-export">Copy backup text</button><button class="btn primary" data-act="modal-close">Done</button></div>`,{focus:'[data-act=copy-export]'});
}
async function importText(text){
  let obj;try{obj=JSON.parse(text)}catch(e){toast('That file isn’t a valid backup (it is not JSON).','err');return false}
  const d=obj&&obj.data?obj.data:obj;
  if(!d||!Array.isArray(d.projects)||!Array.isArray(d.deliverables)||!Array.isArray(d.phases)){toast('That file doesn’t look like a planner backup: projects, deliverables or phases are missing.','err');return false}
  if(d.tasks!=null&&!Array.isArray(d.tasks)){toast('That backup has an invalid task list, so it wasn’t imported.','err');return false}
  const nt=arr(d.tasks).length,iss=relIssues(d);
  const summary=`The backup has ${plural(d.projects.length,'project')}, ${plural(d.deliverables.length,'deliverable')} and ${nt?plural(nt,'task'):'no tasks'}${obj.exportedAt?`, exported ${fmt(String(obj.exportedAt).slice(0,10))}`:''}.${d.tasks==null?' It was made before tasks existed, so it loads with an empty task list.':''}${Array.isArray(d.views)?(d.views.length?` It includes ${plural(d.views.length,'saved view')} and ${plural(arr(d.favorites).length,'favorite')}.`:''):' It was made before saved views existed, so it loads with no views or favorites.'} Everything currently in this browser will be replaced.`;
  let ok;
  if(iss.length)ok=await choiceBox('This backup has broken links',`<p>${summary}</p><p style="margin-top:10px"><b>${plural(iss.length,'problem')} found:</b></p><ul class="isslist">${iss.slice(0,12).map(x=>`<li>${esc(x)}</li>`).join('')}${iss.length>12?`<li>…and ${iss.length-12} more</li>`:''}</ul><p>Import with these repairs, or cancel and fix the file first.</p>`,[{v:'yes',l:'Import with repairs',c:'danger'}]);
  else ok=await confirmBox('Replace current data?',summary+' Export a backup first if you might need it.','Replace data');
  if(!ok)return false;
  S=normalize(d);ui.panel=null;ui.panelStack=[];prefs.drafts={};prefs.activeView={};prefs.filters={q:'',pm:'',status:'',phase:'',from:'',to:''};prefs.tf=TF0();prefs.ptf=PTF0();ui.sel.clear();savePrefs();save();render();
  toast(`Backup imported${S.tasks.length?` · ${plural(S.tasks.length,'task')}`:''}`);return true;
}
function rangeText(d){return d.start?`${fmt(d.start)} → ${fmt(d.due)}`:`due ${fmt(d.due)}`}
function confirmBox(title,msg,ok='Delete'){
  return new Promise(res=>{
    if(confirmResolve){const r=confirmResolve;confirmResolve=null;r(false)}
    openModal(`<div class="m-head"><div><h2>${title}</h2></div></div><p>${msg}</p><div class="m-actions"><button class="btn ghost" data-act="cf-no">Cancel</button><button class="btn ${ok==='Delete'||ok.startsWith('Delete')||ok.startsWith('Remove')||ok.startsWith('Replace')?'danger':'primary'}" data-act="cf-yes">${ok}</button></div>`,{focus:'[data-act=cf-no]'});
    confirmResolve=res;
  });
}
function choiceBox(title,msg,buttons){
  return new Promise(res=>{
    if(confirmResolve){const r=confirmResolve;confirmResolve=null;r(false)}
    openModal(`<div class="m-head"><div><h2>${title}</h2></div></div><div class="cmsg">${msg}</div><div class="m-actions"><button class="btn ghost" data-act="cf-no">Cancel</button>${buttons.map(b=>`<button class="btn ${b.c||''}" data-act="cf-choice" data-v="${b.v}">${b.l}</button>`).join('')}</div>`,{focus:'[data-act=cf-no]'});
    confirmResolve=res;
  });
}
function setErr(form,name,msg){
  const el=form.elements[name];const box=(el&&el.closest('.fld,.fl'))?.querySelector('.err');
  if(box)box.textContent=msg||'';if(el&&el.setAttribute)el.setAttribute('aria-invalid',msg?'true':'false');
  if(msg&&el&&el.focus)el.focus();
}
function exampleTasks(st){
  const t=todayDN(),D=n=>n==null?null:dn2iso(t+n);
  const rows=[
   ['px-rmc','100% DD','Update lighting layout','pe-lc','In progress','High',6,'sv-electrical','Planned'],
   ['px-rmc','100% DD','Review circuits','pe-jo','To Do','Normal',12,'sv-electrical','Planned'],
   ['px-rmc','100% DD','Complete QA','pe-sm','To Do','Normal',22,'sv-coordination','Planned'],
   ['px-rmc',null,'Request updated architectural model','pe-sm','Waiting information','High',-2,'sv-coordination','Incoming Info','ph-dd'],
   ['px-rmc','50% DD','Resolve duct clash at level 2','pe-dr','QA','Normal',-1,'sv-mechanical','Coordination Issue'],
   ['px-rmc','Fee proposal','Issue fee proposal','pe-sm','Done','Normal',-96,'sv-other','Planned'],
   ['px-fft','50% DD','Stormwater pipe sizing','','To Do','High',3,'sv-hydraulics','Planned'],
   ['px-fft','100% DD','Update wharf sections after geotech report','pe-jo','Waiting information','Normal',null,'sv-other','Design Change'],
   ['px-fft',null,'Coordinate canopy loads with architect','pe-lc','In progress','Low',9,'sv-coordination','Planned','ph-dd'],
   ['px-jps','Sketch','Revise classroom lighting after client markups','pe-lc','In progress','Normal',5,'sv-electrical','Rework'],
   ['px-jps','Sketch','Fix switchboard schedule error','pe-dr','To Do','High',-4,'sv-electrical','Error'],
   ['px-klw',null,'Confirm land title transfer date','pe-dr','Waiting information','Low',null,'sv-other','Delay','ph-sd']];
  const out=[];
  rows.forEach((r,i)=>{
    const p=st.projects.find(x=>x.id===r[0]&&x.example);if(!p)return;let did=null;
    if(r[1]){const d=st.deliverables.find(x=>x.projectId===p.id&&x.name===r[1]);if(!d)return;did=d.id}
    const tk=newTask({projectId:p.id,deliverableId:did,name:r[2],assignedToId:st.people.some(x=>x.id===r[3])?r[3]:null,status:r[4],priority:r[5],due:D(r[6]),serviceId:st.services.some(x=>x.id===r[7])?r[7]:null,source:r[8],phaseId:r[9]&&st.phases.some(x=>x.id===r[9])?r[9]:null});
    tk.id='tx'+(i+1);if(r[4]==='Done')tk.completedAt=dn2iso(t-95)+'T09:00:00.000Z';out.push(tk);
  });
  return out;
}
function applyBulk(f,v){
  if(!v)return;const ids=[...ui.sel].filter(i=>ui.visible.includes(i));let n=0;
  ids.forEach(i=>{const t=S.tasks.find(x=>x.id===i);if(!t)return;const val=f==='assignedToId'?(v==='__none'?null:v):v;if(t[f]!==val){setTaskField(t,f,val);n++}});
  save();render();toast(n?`${plural(n,'task')} updated`:'No changes needed');
}
async function bulkDelete(){
  const ids=[...ui.sel].filter(i=>ui.visible.includes(i));if(!ids.length)return;
  if(!await confirmBox(`Delete ${plural(ids.length,'task')}?`,`The selected ${plural(ids.length,'task')} will be removed. This can't be undone.`))return;
  const s=new Set(ids);S.tasks=S.tasks.filter(t=>!s.has(t.id));ids.forEach(i=>ui.sel.delete(i));save();render();toast(`${plural(ids.length,'task')} deleted`);
}
function ppClose(pp){const sel=pp.querySelector('select');pp.querySelector('.pp-new').hidden=true;sel.hidden=false;sel.focus()}
function ppAdd(pp){
  const i=pp.querySelector('.pp-new input');const name=i.value.trim().replace(/\s+/g,' ');
  if(!name){i.setAttribute('aria-invalid','true');i.placeholder='Type a name first';i.focus();return}
  let pe=S.people.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!pe){pe={id:uid('pe'),name};S.people.push(pe);save();toast(`${name} added to People`)}
  const sel=pp.querySelector('select');
  if(![...sel.options].some(o=>o.value===pe.id)){const o=document.createElement('option');o.value=pe.id;o.textContent=pe.name;sel.insertBefore(o,sel.querySelector('option[value="__new"]'))}
  sel.value=pe.id;sel.dataset.prev=pe.id;pp.querySelector('.pp-new').hidden=true;sel.hidden=false;sel.focus();
  sel.dispatchEvent(new Event('change',{bubbles:true}));
}
function personPicker(id,value,attrs,inheritName,cls){
  let o=inheritName!==undefined?`<option value="">Project PM${inheritName?` (${esc(inheritName)})`:''}</option>`:`<option value="">Unassigned</option>`;
  o+=S.people.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}"${p.id===value?' selected':''}>${esc(p.name)}</option>`).join('');
  o+=`<option value="__new">+ Add person…</option>`;
  return `<span class="pp"><select id="${id}" class="person-select ${cls||''}" data-prev="${esc(value||'')}" ${attrs||''}>${o}</select><span class="pp-new" hidden><input type="text" placeholder="Full name" aria-label="New person name" maxlength="60"><button type="button" class="btn sm primary" data-act="pp-add">Add</button><button type="button" class="btn sm ghost" data-act="pp-cancel">Cancel</button></span></span>`;
}
function dateField(id,val,attrs,clearable){
  return `<span class="dwrap"><span class="dfield${val?'':' is-empty'}"><span class="dtxt" aria-hidden="true">${val?fmt(val):'Add date'}</span><input type="date" id="${id}" value="${val||''}" ${attrs||''}></span>${clearable&&val?`<button type="button" class="dclr" data-act="dclear" aria-label="Clear date" title="Clear date">×</button>`:''}</span>`;
}
function pChip(s){const c={'Not started':'n','In progress':'a','On hold':'w','Completed':'o'}[s]||'n';return `<span class="chip c-${c}">${esc(s)}</span>`}
function personUse(u){const a=[];if(u.pm)a.push(`PM on ${u.pm}`);if(u.own)a.push(`owns ${plural(u.own,'deliverable')}`);if(u.tk)a.push(plural(u.tk,'task'));return a.length?a.join(' · '):'Not assigned'}
function delivOpts(pid,sel){return sortDelivs(delivsOf(pid)).map(d=>`<option value="${d.id}"${d.id===sel?' selected':''}>${esc(d.name)}${d.status==='Delivered'?' (delivered)':''}</option>`).join('')}
function filteredTasks(o={}){
  const f=prefs.tf,q=f.q.trim().toLowerCase(),t=todayDN(),wk0=t-dowMon(t),wk1=wk0+6;
  const from=f.from?iso2dn(f.from):null,to=f.to?iso2dn(f.to):null;
  return S.tasks.filter(tk=>{
    const p=project(tk.projectId);if(!p)return false;
    if(p.archived&&!f.archived)return false;
    if(q&&!(tk.name+' '+p.name+' '+p.code).toLowerCase().includes(q))return false;
    if(f.project&&tk.projectId!==f.project)return false;
    if(f.pm&&p.pmId!==f.pm)return false;
    if(!o.ignoreAssignee&&f.assignee&&(f.assignee==='__none'?tk.assignedToId:tk.assignedToId!==f.assignee))return false;
    if(f.status){if(tk.status!==f.status)return false}else if(!f.showDone&&tk.status==='Done')return false;
    if(f.priority&&tk.priority!==f.priority)return false;
    if(f.phase&&taskPhaseId(tk)!==f.phase)return false;
    if(f.service&&tk.serviceId!==f.service)return false;
    if(f.source&&tk.source!==f.source)return false;
    const x=tk.due?iso2dn(tk.due):null;
    if(from!=null||to!=null){if(x==null)return false;if(from!=null&&x<from)return false;if(to!=null&&x>to)return false}
    if(f.qOver&&!isTaskOverdue(tk))return false;
    if(f.qWait&&tk.status!=='Waiting information')return false;
    if(f.qWeek&&(x==null||tk.status==='Done'||x<wk0||x>wk1))return false;
    if(f.qUnas&&tk.assignedToId)return false;
    if(f.qNoDue&&x!=null)return false;
    return true});
}
function tfCount(){const f=prefs.tf;return [f.q.trim(),f.project,f.pm,f.assignee,f.status,f.priority,f.phase,f.service,f.source,f.from||f.to,f.qOver,f.qWait,f.qWeek,f.qUnas,f.qNoDue,f.showDone,f.archived].filter(Boolean).length}
function openWarnText(d,status){const open=delivTasks(d.id).filter(taskOpen).length;return status==='Delivered'&&open?`${plural(open,'linked task')} still open. Marking the deliverable Delivered doesn’t close them.`:''}
function taskCountCell(pid){const ts=tasksOf(pid).filter(taskOpen),o=ts.filter(isTaskOverdue).length;return ts.length?`<button class="linkbtn" data-act="project-tasks" data-id="${pid}" title="Open this project’s tasks">${ts.length}</button>${o?` <span class="chip c-d">! ${o}</span>`:''}`:'<span class="muted">0</span>'}
const LOGO_LIGHT='data:image/png;base64,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';
const LOGO_DARK='data:image/png;base64,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';
