/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- side panel ---------- */
function panelKey(){return ui.panel?`${ui.panel.type}:${ui.panel.id||ui.panel.kpi||ui.panel.title}`:''}
function openPanel(type,id,o={}){
  const pn=document.getElementById('panel');
  if(ui.panel&&pn){const ae=document.activeElement;if(pn.contains(ae)&&ae.blur)ae.blur();if(pn.querySelector('[aria-invalid="true"]'))toast('A field in the previous item had an invalid value and was not saved.','err')}
  if(!ui.panel){const ae=document.activeElement;ui.panelOpener=ae&&ae.id?ae.id:null}
  if(o.push&&ui.panel)ui.panelStack.push(ui.panel);else if(!o.push)ui.panelStack=[];
  ui.panel={type,id,...(o.extra||{})};ui.panelNote='';
  render();
  const t=document.getElementById('pn-title');if(t&&!o.keepFocus)t.focus({preventScroll:true});
}
function closePanel(force){
  if(!ui.panel)return;const pn=document.getElementById('panel');
  if(!force&&pn){const ae=document.activeElement;if(pn.contains(ae)&&ae.blur)ae.blur();
    if(document.getElementById('panel').querySelector('[aria-invalid="true"]')){
      const body=document.getElementById('pn-body');if(body&&!document.getElementById('pn-warn'))body.insertAdjacentHTML('afterbegin',`<div class="pn-warn" id="pn-warn" role="alert"><span>A field has an invalid value and wasn’t saved. Everything else is saved.</span><button class="btn sm" data-act="panel-keep">Keep editing</button><button class="btn sm ghost" data-act="panel-force-close">Close without it</button></div>`);
      const w=document.querySelector('#pn-warn button');if(w)w.focus();return}}
  ui.panel=null;ui.panelStack=[];ui.panelNote='';render();
  const o=ui.panelOpener&&document.getElementById(ui.panelOpener);if(o)try{o.focus({preventScroll:true})}catch(e){}
}
function renderPanel(){
  const P=ui.panel;if(!P)return '';
  let kind='',title='',crumbs='',body='',menu='',ok=true;
  if(P.type==='project'){const p=project(P.id);if(!p)ok=false;else{kind='Project';title=`<span class="mono muted" style="font-size:14px">${esc(p.code)}</span> ${esc(p.name)}`;body=panelProject(p);
      menu=menuHTML('pn',[{act:'dup-project',id:p.id,label:'Duplicate project…'},p.archived?{act:'restore-project',id:p.id,label:'Restore project'}:{act:'archive-project',id:p.id,label:'Archive project'},{act:'delete-project',id:p.id,label:'Delete project…',cls:'danger-t'}])}}
  else if(P.type==='deliv'){const d=deliv(P.id);if(!d)ok=false;else{const p=project(d.projectId);kind=`<span class="dia-sw" style="--c:${phColor(d.phaseId)}"></span> Deliverable · ${esc(phName(d.phaseId))}`;title=esc(d.name);
      crumbs=`<button data-act="panel-project" data-id="${p.id}" data-push="1" title="Open project details">${esc(p.code)} · ${esc(p.name)}</button>`;body=panelDeliv(d)+wfDelivReqHTML(d);menu=menuHTML('pn',[{act:'del-deliv',id:d.id,label:'Delete deliverable…',cls:'danger-t'}])}}
  else if(P.type==='task'){const t=S.tasks.find(x=>x.id===P.id);if(!t)ok=false;else{const p=project(t.projectId),d=t.deliverableId?deliv(t.deliverableId):null;kind=`Task · ${TGLYPH[t.status]} ${esc(t.status)}`;title=esc(t.name);
      crumbs=`<button data-act="panel-project" data-id="${p.id}" data-push="1">${esc(p.code)} · ${esc(p.name)}</button>${d?`<span class="sepc">›</span><button data-act="panel-deliv" data-id="${d.id}" data-push="1">${esc(d.name)}</button>`:'<span class="sepc">›</span><span>General task</span>'}`;body=wfTaskInfoHTML(t)+panelTask(t);menu=menuHTML('pn',[{act:'del-task',id:t.id,label:'Delete task…',cls:'danger-t'}])}}
  else if(P.type==='pphase'){const pp=pphase(P.id);if(!pp)ok=false;else{const p=project(pp.projectId),g=phase(pp.phaseId);kind=`<span class="sw" style="--c:${g.color}"></span> Project phase · ${PPGLYPH[pp.status]} ${esc(pp.status)}`;title=esc(g.name);
      crumbs=`<button data-act="panel-project" data-id="${p.id}" data-push="1">${esc(p.code)} · ${esc(p.name)}</button>`;body=panelPPhase(pp);menu=menuHTML('pn',[{act:'pp-remove',id:pp.id,label:'Remove phase from project…',cls:'danger-t'}])}}
  else if(P.type==='list'){kind=P.kindLabel||'List';title=esc(P.title);body=panelList(P)}
  if(!ok){ui.panel=null;return ''}
  return `<div class="pn-head"><div class="pn-bar">${ui.panelStack.length?'<button class="btn sm ghost" data-act="panel-back">‹ Back</button>':''}<div class="crumbs">${crumbs}</div>${P.type!=='list'?saveIndHTML('pn-save'):''}${menu}<button class="pn-close" data-act="panel-close" aria-label="Close details panel (Escape)">✕ Close</button></div><div class="pn-kind">${kind}</div><h2 class="pn-title" id="pn-title" tabindex="-1">${title}</h2></div><div class="pn-body" id="pn-body">${ui.panelNote?`<div class="pn-warn" role="status">${esc(ui.panelNote)}</div>`:''}${body}</div>`;
}
function fld(label,inner,o={}){return `<div class="fld${o.span?' span2':''}"><span class="lb">${label}</span>${inner}</div>`}
function panelProject(p){
  const ds=delivsOf(p.id),up=ds.filter(d=>d.due&&d.status!=='Delivered').sort((a,b)=>a.due<b.due?-1:1).slice(0,5),ts=tasksOf(p.id),open=ts.filter(taskOpen);
  const att=sortTasks(open.filter(x=>isTaskOverdue(x)||x.status==='Waiting information')).slice(0,5);
  return `<div class="fgrid">
    ${fld('Project name',`<input class="in" id="pp-name" data-ent="p" data-id="${p.id}" data-f="name" value="${esc(p.name)}" maxlength="120">`,{span:1})}
    ${fld('Code',`<input class="in mono" id="pp-code" data-ent="p" data-id="${p.id}" data-f="code" value="${esc(p.code)}" maxlength="30">`)}
    ${fld('Status',`<select class="in" id="pp-status" data-ent="p" data-id="${p.id}" data-f="status">${opts(P_STAT,p.status)}</select>`)}
    ${fld('Project team <i>optional</i>',`<select class="in" id="pp-team" data-ent="p" data-id="${p.id}" data-f="teamId"><option value="">Not set</option>${S.projectTeams.map(t=>`<option value="${t.id}"${t.id===p.teamId?' selected':''}>${esc(t.name)}</option>`).join('')}</select>`)}
    ${fld('Client <i>optional</i>',`<input class="in" id="pp-client" data-ent="p" data-id="${p.id}" data-f="client" value="${esc(p.client)}" maxlength="120">`)}
    ${fld('PM / responsible',personPicker('pp-pm',p.pmId,`data-ent="p" data-id="${p.id}" data-f="pmId"`,undefined,'in'))}
    ${fld('Scope <i>optional</i>',`<textarea class="in" id="pp-desc" data-ent="p" data-id="${p.id}" data-f="description" rows="2" placeholder="Short description of the scope">${esc(p.description)}</textarea>`,{span:1})}
  </div>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Upcoming deliverables</h3>${ds.length>5?`<button class="linkbtn" data-act="rs-delivs" data-id="${p.id}">All ${plural(ds.filter(d=>d.status!=='Delivered').length,'pending deliverable')}</button>`:`<span class="muted">${plural(ds.length,'deliverable')} in total</span>`}</div>
    ${up.length?`<ul class="mini-list">${up.map(d=>`<li><span class="dia-sw" style="--c:${phColor(d.phaseId)}"></span><button class="plainbtn grow" data-act="panel-deliv" data-id="${d.id}" data-push="1">${esc(d.name)}</button><span class="num">${fmt(d.due)}</span>${dlStatusChip(d)}<span class="meta">Task completion: ${taskCompletion(d)}</span></li>`).join('')}</ul>`:'<p class="muted">Nothing pending with a due date.</p>'}</section>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Tasks</h3><span class="tcomp"><span>${open.length} open</span><span class="${open.some(isTaskOverdue)?'od':''}">${open.filter(isTaskOverdue).length} overdue</span><span>${open.filter(x=>x.status==='Waiting information').length} waiting</span></span></div>
    ${att.length?`<ul class="mini-list">${att.map(x=>`<li><span>${TGLYPH[x.status]}</span><button class="plainbtn grow" data-act="panel-task" data-id="${x.id}" data-push="1">${esc(x.name)}</button><span class="meta">${esc(x.assignedToId?shortName(pname(x.assignedToId)):'Unassigned')}</span>${x.due?`<span class="${isTaskOverdue(x)?'od':'meta'}">${isTaskOverdue(x)?'! ':''}${fmt(x.due)}</span>`:''}</li>`).join('')}</ul>`:`<p class="muted">${open.length?'Nothing overdue or waiting for information.':'No open tasks.'}</p>`}</section>
  ${projResourcesHTML(p,true)}
  <section class="pn-sec"><div class="pn-sec-h"><h3>Notes</h3></div><textarea class="in" id="pp-notes" data-ent="p" data-id="${p.id}" data-f="notes" rows="4" placeholder="Meeting outcomes, contacts, constraints…">${esc(p.notes)}</textarea></section>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Links</h3></div>${linksEditor(p)}</section>
  <div class="pn-actions"><button class="btn primary" data-act="open-full" data-id="${p.id}">Open full project</button><button class="btn" data-act="open-full" data-id="${p.id}" data-tab="tasks">Open its tasks</button></div>`;
}
function panelDeliv(d){
  const p=project(d.projectId),pm=person(p.pmId),ts=sortTasks(delivTasks(d.id)),done=ts.filter(t=>t.status==='Done').length,warn=openWarnText(d,d.status);
  return `<div class="fgrid">
    ${fld('Name',`<input class="in" id="pd-name" data-ent="d" data-id="${d.id}" data-f="name" value="${esc(d.name)}" maxlength="120">`,{span:1})}
    ${fld('Phase',`<select class="in" id="pd-phase" data-ent="d" data-id="${d.id}" data-f="phaseId">${ppPhaseOpts(p.id,d.phaseId)}</select>`)}
    ${fld('Standard milestone',`<select class="in" id="pd-ms" data-ent="d" data-id="${d.id}" data-f="milestoneId"><option value="">Additional deliverable (not standard)</option>${msOpts(d.phaseId,d.milestoneId)}</select>`)}
    ${fld('Status',`<select class="in" id="pd-status" data-ent="d" data-id="${d.id}" data-f="status">${statusOpts(D_STAT,d.status,DGLYPH)}</select>`)}
    ${fld('Start date <i>optional</i>',dateField('pd-start',d.start,`data-ent="d" data-id="${d.id}" data-f="start"${d.due?` max="${d.due}"`:''}`,true))}
    ${fld('Due date',dateField('pd-due',d.due,`data-ent="d" data-id="${d.id}" data-f="due"${d.start?` min="${d.start}"`:''}`,true)+(isOverdue(d)?`<span class="od" style="font-size:12px">! Overdue · ${rel(d.due)}</span>`:''))}
    ${fld('Responsible',personPicker('pd-owner',d.ownerId,`data-ent="d" data-id="${d.id}" data-f="ownerId"`,pm?.name||'','in'),{span:1})}
    ${fld('Notes <i>optional</i>',`<textarea class="in" id="pd-notes" data-ent="d" data-id="${d.id}" data-f="notes" rows="2">${esc(d.notes)}</textarea>`,{span:1})}
  </div>
  ${warn?`<p class="warnt" style="font-size:12.5px">${esc(warn)}</p>`:''}
  ${outOfPhase(d)?(pp=>`<div class="pn-warn" role="status"><span>Due ${fmt(d.due)}${d.start?` (from ${fmt(d.start)})`:''} is outside the ${esc(ppName(pp))} dates (${fmt(pp.start)} – ${fmt(pp.end)}). Change the dates above, or extend the phase.</span><button class="btn sm" data-act="extend-phase" data-id="${d.id}">Extend phase to include it</button></div>`)(ppFor(d.projectId,d.phaseId)):''}
  ${delivRefHTML(d)}
  <p class="hint">Due date only → diamond. Start and due → bar in Periods view. No due date → listed as without a due date.</p>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Tasks</h3><span class="tcomp">${ts.length?`<span>Task completion: ${done} of ${plural(ts.length,'task')} done</span><span class="tdots" aria-hidden="true">${ts.slice(0,30).map(t=>`<i class="${t.status==='Done'?'d':''}"></i>`).join('')}</span>`:'<span class="muted">No tasks</span>'}</span></div>
    ${ts.length?`<ul class="mini-list">${ts.map(t=>{const o=isTaskOverdue(t);return `<li class="${t.status==='Done'?'done':''}"><select class="st-sel" id="pdt-${t.id}" data-ent="t" data-id="${t.id}" data-f="status" aria-label="Status of ${esc(t.name)}">${statusOpts(T_STAT,t.status,TGLYPH)}</select><button class="plainbtn grow" data-act="panel-task" data-id="${t.id}" data-push="1">${esc(t.name)}</button><span class="meta">${esc(t.assignedToId?shortName(pname(t.assignedToId)):'Unassigned')}</span>${t.due?`<span class="${o?'od':'meta'}">${o?'! ':''}${fmt(t.due)}</span>`:''}</li>`}).join('')}</ul>`:''}
    <div class="quick"><input class="in" id="dq-name" data-did="${d.id}" placeholder="New task for this deliverable, then Enter" maxlength="160" autocomplete="off" aria-label="New task name"><button class="btn" data-act="dq-add" data-did="${d.id}">+ Add task</button></div>
    <p class="hint">New tasks go to ${esc(pname(ownerId(d)))} (responsible for this deliverable). Completing tasks never changes the deliverable status.</p></section>
  <div class="pn-actions"><button class="btn" data-act="panel-project" data-id="${p.id}" data-push="1">Project details</button><button class="btn" data-act="open-full" data-id="${p.id}">Open full project</button></div>`;
}
function panelTask(t){
  const p=project(t.projectId),d=t.deliverableId?deliv(t.deliverableId):null,ph=taskPhaseId(t),late=taskLate(t);
  const stamp=s=>s?new Date(s).toLocaleString('en-AU',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  return `<div class="fgrid">
    ${fld('Task',`<input class="in" id="pt-name" data-ent="t" data-id="${t.id}" data-f="name" value="${esc(t.name)}" maxlength="160"${t.wfStepId?' readonly title="From the Company workflow"':''}>`,{span:1})}
    ${fld('Status',`<select class="in" id="pt-status" data-ent="t" data-id="${t.id}" data-f="status">${statusOpts(T_STAT,t.status,TGLYPH)}</select>`)}
    ${fld('Assignee',personPicker('pt-assign',t.assignedToId,`data-ent="t" data-id="${t.id}" data-f="assignedToId"`,undefined,'in'))}
    ${fld('Due date <i>optional</i>',dateField('pt-due',t.due,`data-ent="t" data-id="${t.id}" data-f="due"`,true)+(isTaskOverdue(t)?`<span class="od" style="font-size:12px">! Overdue · ${rel(t.due)}</span>`:'')+(late?`<span class="warnt" style="font-size:12px">Later than the deliverable’s due date (${fmt(d.due)}). Saved anyway.</span>`:''))}
    ${fld('Priority',`<select class="in" id="pt-prio" data-ent="t" data-id="${t.id}" data-f="priority">${opts(PRIOS,t.priority)}</select>`)}
    ${fld('Project',`<select class="in" id="pt-proj" data-ent="t" data-id="${t.id}" data-f="projectId"${t.wfStepId?' disabled':''}>${projOpts(t.projectId,S.projects.filter(x=>!x.archived||x.id===t.projectId).sort(codeSort))}</select>`)}
    ${fld('Deliverable <i>optional</i>',`<select class="in" id="pt-deliv" data-ent="t" data-id="${t.id}" data-f="deliverableId"${t.wfStepId?' disabled title="Workflow tasks link to deliverables as requirements"':''}><option value="">General project task</option>${delivOpts(t.projectId,t.deliverableId)}</select>`)}
    ${fld(d?'Phase <i>(from deliverable)</i>':'Phase <i>optional</i>',`<select class="in" id="pt-phase" data-ent="t" data-id="${t.id}" data-f="phaseId"${d||t.wfStepId?' disabled':''}><option value="">General (no phase)</option>${ppPhaseOpts(t.projectId,ph)}</select>`)}
    ${fld('Discipline <i>optional</i>',`<select class="in" id="pt-svc" data-ent="t" data-id="${t.id}" data-f="serviceId"><option value="">—</option>${S.services.map(s=>`<option value="${s.id}"${s.id===t.serviceId?' selected':''}>${esc(s.name)}</option>`).join('')}</select>`)}
    ${fld('Source',`<select class="in" id="pt-src" data-ent="t" data-id="${t.id}" data-f="source">${opts(SOURCES,t.source)}</select>`)}
    ${fld('Notes <i>optional</i>',`<textarea class="in" id="pt-notes" data-ent="t" data-id="${t.id}" data-f="notes" rows="3">${esc(t.notes)}</textarea>`,{span:1})}
  </div>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Links</h3></div><div class="links">${t.links.map((l,i)=>`<div class="link-row"><input class="in lbl-in" id="tl-${t.id}-${i}-l" data-ent="tlink" data-id="${t.id}" data-i="${i}" data-f="label" value="${esc(l.label)}" placeholder="Label" aria-label="Link label"><input class="in" id="tl-${t.id}-${i}-u" data-ent="tlink" data-id="${t.id}" data-i="${i}" data-f="url" value="${esc(l.url)}" placeholder="https:// or folder path" aria-label="Link address">${/^https?:/i.test(l.url)?`<a class="iconbtn" href="${esc(l.url)}" target="_blank" rel="noopener" title="Open link" aria-label="Open link">${ICON.open}</a>`:'<span class="iconbtn" aria-hidden="true"></span>'}<button class="iconbtn del" data-act="tlink-del" data-id="${t.id}" data-i="${i}" aria-label="Remove link">${ICON.del}</button></div>`).join('')}<button class="btn sm" data-act="tlink-add" data-id="${t.id}" style="align-self:flex-start">+ Add link</button></div></section>
  <p class="tmeta-line">Created ${stamp(t.createdAt)} · Updated ${stamp(t.updatedAt)}${t.completedAt?` · Completed ${stamp(t.completedAt)}`:''}</p>
  <div class="pn-actions">${d?`<button class="btn" data-act="panel-deliv" data-id="${d.id}" data-push="1">Deliverable details</button>`:''}<button class="btn" data-act="panel-project" data-id="${p.id}" data-push="1">Project details</button><button class="btn" data-act="open-full" data-id="${p.id}" data-tab="tasks">Open full project</button></div>`;
}
function panelList(P){
  if(P.listType==='phases'){const ps=P.ids.map(pphase).filter(Boolean);
    return `${P.note?`<p class="hint">${esc(P.note)}</p>`:''}${ps.length?`<ul class="mini-list">${ps.map(pp=>{const p=project(pp.projectId);return `<li><span class="sw" style="--c:${phColor(pp.phaseId)}"></span><button class="plainbtn grow" data-act="panel-pphase" data-id="${pp.id}" data-push="1">${esc(ppName(pp))}</button><button class="plainbtn meta" data-act="panel-project" data-id="${p.id}" data-push="1"><span class="mono">${esc(p.code)}</span> ${esc(p.name)}</button><span class="num">${ppScheduled(pp)?`${fmt(pp.start)} – ${fmt(pp.end)}`:'No dates'}</span>${ppLate(pp)?'<span class="chip c-d">! Late</span>':''}<span class="meta">${esc(pp.status)}</span></li>`}).join('')}</ul>`:'<p class="muted">Nothing to show.</p>'}`}
  if(P.listType==='projects'){const ps=P.ids.map(project).filter(Boolean);
    return `${P.note?`<p class="hint">${esc(P.note)}</p>`:''}${ps.length?`<ul class="mini-list">${ps.map(p=>{const np=nextPending(delivsOf(p.id));return `<li><button class="plainbtn grow" data-act="panel-project" data-id="${p.id}" data-push="1"><span class="mono muted">${esc(p.code)}</span> ${esc(p.name)}</button><span class="meta">${esc(pname(p.pmId))}</span><span class="meta">${np?`Next ${esc(np.name)} · ${fmt(np.due)}`:'Nothing pending'}</span></li>`}).join('')}</ul>`:'<p class="muted">Nothing to show.</p>'}`}
  const ds=P.ids.map(deliv).filter(Boolean).sort((a,b)=>(a.due||'9999')<(b.due||'9999')?-1:1);
  return `${P.note?`<p class="hint">${esc(P.note)}</p>`:''}${ds.length?`<ul class="mini-list">${ds.map(d=>{const p=project(d.projectId),w=delivTasks(d.id).filter(t=>t.status==='Waiting information').length;return `<li><span class="dia-sw" style="--c:${phColor(d.phaseId)}"></span><button class="plainbtn grow" data-act="panel-deliv" data-id="${d.id}" data-push="1">${esc(d.name)}</button><button class="plainbtn meta" data-act="panel-project" data-id="${p.id}" data-push="1"><span class="mono">${esc(p.code)}</span> ${esc(p.name)}</button><span class="num">${d.due?fmt(d.due):'No due date'}</span>${dlStatusChip(d)}${w?`<span class="chip c-w">◷ ${plural(w,'task')} waiting</span>`:''}</li>`}).join('')}</ul>`:'<p class="muted">Nothing to show for the current filters.</p>'}`;
}
function openList(title,ids,o={}){openPanel('list',null,{push:o.push,extra:{title,ids,note:o.note||'',kpi:o.kpi||null,listType:o.listType||'deliverables',kindLabel:o.kind||'Deliverables'}})}

/* ---------- other pages (adapted) ---------- */
function addDeliverable(pid,phaseId,openIt){
  const ds=sortDelivs(delivsOf(pid)),last=ds[ds.length-1],pps=ppOf(pid).filter(pp=>pp.status!=='Not applicable');
  const ph=phaseId||last?.phaseId||pps[0]?.phaseId||ppOf(pid)[0]?.phaseId||S.phases[0].id;ensurePP(pid,ph);
  const d={id:uid('d'),projectId:pid,name:'New deliverable',phaseId:ph,milestoneId:null,milestoneRev:null,checks:{},start:null,due:null,ownerId:null,status:'Planned',notes:'',seq:nextSeq()};
  S.deliverables.push(d);save();
  if(openIt){openPanel('deliv',d.id,{push:true});const n=document.getElementById('pd-name');if(n){n.focus();n.select()}toast('Deliverable added to '+phName(ph));return}
  if(ui.view!=='project'||ui.pid!==pid){ui.view='project';ui.pid=pid;try{history.pushState(null,'','#p-'+pid)}catch(e){}}
  ui.ptab='deliverables';ui.focusAfter=`d-${d.id}-name`;ui.selectFocus=true;render();toast('Deliverable added. Name it and set its due date.');
}
function addFromDeliv(did){
  const inp=document.getElementById('dq-name'),d=deliv(did);if(!inp||!d)return;const name=inp.value.trim();
  if(!name){fieldError(inp,'Type a task name first.');inp.focus();return}
  S.tasks.push(newTask({projectId:d.projectId,deliverableId:d.id,name,assignedToId:ownerId(d)}));save();ui.focusAfter='dq-name';render();toast(`Task added to ${d.name}`);
}
async function deleteTask(id){
  const t=S.tasks.find(x=>x.id===id);if(!t)return;
  if(!await confirmBox('Delete task?',`“${esc(t.name)}” will be removed. This can't be undone.`))return;
  S.tasks=S.tasks.filter(x=>x.id!==id);ui.sel.delete(id);if(ui.panel&&ui.panel.type==='task'&&ui.panel.id===id){ui.panel=ui.panelStack.pop()||null}save();render();toast('Task deleted');
}
function moveTask(t,field,val){
  const undo=snapshot([t]);let note='';
  if(field==='projectId'){if(val===t.projectId)return;const had=!!t.deliverableId;setTaskField(t,'projectId',val);note=`Moved to ${project(val).code}${had?'. Its deliverable link was cleared; choose a deliverable from the new project if it applies':''}`;
    if(ui.panel&&ui.panel.type==='task'&&ui.panel.id===t.id&&had)ui.panelNote='Project changed, so the deliverable link was cleared. Choose a deliverable from this project if it applies.'}
  else if(field==='assignedToId'){val=val||null;if(val===(t.assignedToId||null))return;setTaskField(t,'assignedToId',val);note=`${t.name} → ${val?pname(val):'Unassigned'}`}
  else{if(val===t.status)return;setTaskField(t,'status',val);note=`${t.name}: ${TGLYPH[val]} ${val}`}
  save();render();toast(note,'',undo);
}

