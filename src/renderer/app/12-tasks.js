/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- Tasks (rendered from the active view) ---------- */
function renderTasksPage(){
  const c=ctxOf(null),list=evalView(c.cfg,null),open=list.filter(taskOpen),adv=advShown(c);
  let h=`<div class="pagehead"><h1>Tasks</h1><span class="eyebrow">${c.cfg.includeArchived?'Active and archived projects':'All active projects'}</span><span class="spacer"></span><button class="btn primary" data-act="new-task">+ New task</button></div>`;
  const sv=f=>simpleValue(c.cfg,f);
  const ks=(key,n,label,sub,pressed,alert)=>`<button class="ks${alert&&n?' alert':''}" ${adv||!key?'data-act="noop" aria-disabled="true"':`data-act="tchip" data-k="${key}" aria-pressed="${pressed}"`}><span class="n">${n}</span><span class="l"><b>${label}</b><span>${sub}</span></span></button>`;
  h+=`<div class="kstrip" aria-label="Summary of this view">${ks('',open.length,'Open tasks','in this view')}${ks('over',open.filter(isTaskOverdue).length,'Overdue','past due, not done',sv('due')==='overdue',true)}${ks('wait',open.filter(t=>t.status==='Waiting information').length,'Waiting information','blocked by input',sv('status')==='Waiting information')}${ks('unas',open.filter(t=>!t.assignedToId).length,'Unassigned','open, nobody assigned',sv('assignee')==='__empty')}</div>`;
  return h+tasksSection(null);
}
function viewTabs(c){
  const vs=viewsFor(c.pid),fav=id=>S.favorites.some(f=>f.viewId===id);
  let h=`<div class="vtabs" role="tablist" aria-label="Saved views"><button role="tab" class="vtab" data-act="view-select" data-id="all" aria-selected="${c.vid==='all'}">All tasks</button>`;
  vs.forEach(v=>{const iss=viewIssuesById(v).length;h+=`<button role="tab" class="vtab" data-act="view-select" data-id="${v.id}" aria-selected="${c.vid===v.id}" title="${esc(cfgSummary(cfgOf(v)))} · Right-click (or press Delete) for options" aria-keyshortcuts="Delete">${fav(v.id)?'<span class="favmark" aria-label="Favorite">★</span>':''}${esc(v.name)}<span class="lt">${LAYOUTS[v.layout]}</span>${iss?'<span class="chip c-w">Review</span>':''}</button>`});
  h+=`<button class="vtab add" data-act="view-new" data-pid="${c.pid||''}">+ New view</button><span class="spacer"></span>`;
  if(c.view){const f=fav(c.view.id);h+=`<button class="btn sm ghost star" data-act="view-star" data-id="${c.view.id}" aria-pressed="${f}" aria-label="${f?'Remove from Favorites':'Add to Favorites'}" title="${f?'Remove from Favorites':'Add to Favorites'}">${f?'★':'☆'} ${f?'Favorite':'Add to Favorites'}</button>${menuHTML('view',[{act:'view-rename',id:c.view.id,label:'Rename…'},{act:'view-dup',id:c.view.id,label:'Duplicate…'},{act:'view-del',id:c.view.id,label:'Delete view…',cls:'danger-t'}])}`}
  return h+'</div>';
}
function tasksSection(sc){
  const pid=sc&&sc.pid||null,c=ctxOf(pid),cfg=c.cfg,list=evalView(cfg,pid);ui.visible=list.map(t=>t.id);
  const scopeAll=pid?tasksOf(pid):S.tasks.filter(t=>{const p=project(t.projectId);return p&&(cfg.includeArchived||!p.archived)});
  let h=viewTabs(c);
  if(c.dirty)h+=`<div class="dirty" role="status"><span class="chip c-w">Unsaved changes</span><span class="muted">${c.view?`to “${esc(c.view.name)}”`:'to All tasks'}</span>${c.view?'<button class="btn sm primary" data-act="view-save">Save view</button>':''}<button class="btn sm" data-act="view-saveas" data-pid="${pid||''}">Save as new view</button><button class="btn sm ghost" data-act="view-reset">Reset changes</button></div>`;
  const grpOpts=Object.entries(GROUPS).filter(([k])=>!(pid&&k==='project')&&!(cfg.layout==='board'&&k==='none'));
  const grp=cfg.layout==='board'&&cfg.group==='none'?'status':cfg.group;
  h+=`<div class="toolbar tb-meta"><div class="seg" role="group" aria-label="Layout">${Object.entries(LAYOUTS).map(([k,l])=>`<button data-act="cfg-layout" data-v="${k}" aria-pressed="${cfg.layout===k}">${l}</button>`).join('')}</div>
   ${cfg.layout==='board'||cfg.layout==='list'?`<label class="flabel">Group by <select class="in" id="cfg-group-${pid||'g'}" data-cfg="group" style="width:auto">${grpOpts.map(([k,l])=>`<option value="${k}"${grp===k?' selected':''}>${l}</option>`).join('')}</select></label>`:''}
   <button class="btn sm" data-act="cfg-open" data-v="sort" aria-expanded="${ui.cfgOpen==='sort'}">Sort${cfg.sort.length?` · ${cfg.sort.map(s=>SORTF[s.field]).join(', ')}`:''}</button>
   <button class="btn sm" data-act="cfg-open" data-v="fields" aria-expanded="${ui.cfgOpen==='fields'}">Fields (${cfg.columns.length})</button>
   <label class="chk"><input type="checkbox" id="cfg-done-${pid||'g'}" data-cfg="showDone"${cfg.showDone?' checked':''}> Show done</label>
   ${pid?'':`<label class="chk"><input type="checkbox" id="cfg-arch" data-cfg="includeArchived"${cfg.includeArchived?' checked':''}> Include archived projects</label>`}
   ${filtersToggle('tasks',allRules(cfg).length,'cfg-clear-filters')}${tableMeta('tk',plural(list.length,'task'),cfg.layout==='table')}</div>`;
  if(fOpen('tasks'))h+=`<div id="fp-tasks">${filterBar(c)}</div>`;
  if(ui.cfgOpen==='sort')h+=sortPanel(c);
  if(ui.cfgOpen==='fields')h+=fieldsPanel(c);
  const iss=cfgIssues(cfg,pid);
  if(iss.length)h+=`<div class="pn-warn" role="status" style="margin-bottom:8px"><span><b>This view needs review.</b> ${esc([...new Set(iss)].join('; '))}. The filter is kept as it was, so results may be empty until you change it.</span><button class="btn sm" data-act="cfg-edit-filters">Edit filters</button></div>`;
  if(cfg.layout==='table')h+=bulkBarHTML(ui.visible);
  if(cfg.layout==='calendar')return h+`<div class="lgroup"><div class="lh">${newTaskForm(c,'tnew-name')}</div></div>`+(list.length||!scopeAll.length?'':`<p class="hint" style="margin:4px 0 8px">No tasks match this view. <button class="linkbtn" data-act="cfg-edit-filters">Edit filters</button></p>`)+tasksCalendar(list,c);
  if(!list.length){
    const none=!scopeAll.length;
    const body=none?`<div class="empty" style="margin-top:8px"><h2>No tasks yet</h2><p>Type a task name in the row above and press Enter. You can add several in a row.</p></div>`
      :`<div class="empty" style="margin-top:8px"><h2>No tasks match this view</h2><p>Filters: ${esc(cfgSummary(cfg))}</p><div class="row"><button class="btn" data-act="cfg-edit-filters">Edit filters</button>${c.dirty?'<button class="btn ghost" data-act="view-reset">Reset changes</button>':''}</div></div>`;
    if(cfg.layout==='board')return h+taskBoard([],c)+body;
    return h+(cfg.layout==='table'?taskTable([],c):taskList([],c))+body;
  }
  if(cfg.layout==='board')return h+taskBoard(list,c);
  if(cfg.layout==='list')return h+taskList(list,c);
  return h+taskTable(list,c);
}
function filterBar(c){
  const cfg=c.cfg,pid=c.pid,sid=f=>`sf-${f}-${pid||'g'}`;
  if(advShown(c)){
    if(ui.advOpen&&ui.advOpen[c.key])return advEditor(c);
    const n=allRules(cfg).length;
    return `<div class="filters advsum" role="search" aria-label="Filters"><span class="pill-on">Advanced filters</span><span class="advtxt" title="${esc(cfgSummary(cfg))}">${esc(cfgSummary(cfg))}</span>${impossibleGroup(cfg)?'<span class="chip c-w" title="A group requires one field to have several values at once (AND). Edit filters to switch it to OR.">Matches nothing</span>':''}<button class="btn sm" data-act="adv-edit" aria-expanded="false">Edit filters</button>${n?'<button class="btn sm ghost" data-act="cfg-clear-filters">Clear filters</button>':''}${simpleCompatible(cfg)&&!cfgIssues(cfg,pid).length?'<button class="btn sm ghost" data-act="adv-off">Use simple filters</button>':''}</div>`}
  const v=f=>simpleValue(cfg,f),on=f=>v(f)?' on':'';
  const n=allRules(cfg).length,moreN=['pm','priority','phase','deliverable','service','source'].filter(f=>v(f)).length;
  const delivList=pid?sortDelivs(delivsOf(pid)):(v('project')?sortDelivs(delivsOf(v('project'))):[]);
  let h=`<div class="filters" role="search" aria-label="Filters">
    <input class="in q${on('text')}" type="search" id="${sid('text')}" data-sf="text" placeholder="Search task${pid?'':', project name or code'}" aria-label="Search" value="${esc(v('text'))}" autocomplete="off">
    ${pid?'':`<select class="in${on('project')}" id="${sid('project')}" data-sf="project" aria-label="Project"><option value="">All projects</option>${projOpts(v('project'),S.projects.slice().sort(codeSort))}</select>`}
    <select class="in${on('assignee')}" id="${sid('assignee')}" data-sf="assignee" aria-label="Assignee"><option value="">Any assignee</option><option value="__set"${v('assignee')==='__set'?' selected':''}>Assigned</option><option value="__empty"${v('assignee')==='__empty'?' selected':''}>Unassigned</option>${peopleOpts(v('assignee'))}</select>
    <select class="in${on('status')}" id="${sid('status')}" data-sf="status" aria-label="Status"><option value="">Any status</option><option value="__open"${v('status')==='__open'?' selected':''}>Not done</option>${statusOpts(T_STAT,v('status'),TGLYPH)}</select>
    <select class="in${on('due')}" id="${sid('due')}" data-sf="due" aria-label="Due date"><option value="">Any due date</option>${[['overdue','Overdue'],['today','Due today'],['this_week','Due this week (Mon–Sun)'],['next_7','Next 7 days'],['next_30','Next 30 days'],['empty','No due date'],['set','Has a due date']].map(([k,l])=>`<option value="${k}"${v('due')===k?' selected':''}>${l}</option>`).join('')}</select>
    <button class="btn sm" data-act="more-sf" aria-expanded="${!!ui.moreSF}">More filters${moreN?` (${moreN})`:''}</button>
    <button class="btn sm ghost" data-act="adv-on">Advanced (AND / OR)</button>
    ${n?`<span class="pill-on">${plural(n,'filter')}</span><button class="btn sm" data-act="cfg-clear-filters">Clear filters</button>`:''}</div>`;
  if(ui.moreSF)h+=`<div class="filters" aria-label="More filters">
    <select class="in${on('pm')}" id="${sid('pm')}" data-sf="pm" aria-label="Project PM"><option value="">Any project PM</option>${peopleOpts(v('pm'))}</select>
    <select class="in${on('priority')}" id="${sid('priority')}" data-sf="priority" aria-label="Priority"><option value="">Any priority</option>${opts(PRIOS,v('priority'))}</select>
    <select class="in${on('phase')}" id="${sid('phase')}" data-sf="phase" aria-label="Phase"><option value="">Any phase</option>${pid?ppPhaseOpts(pid,v('phase')):phaseOpts(v('phase'))}</select>
    ${delivList.length?`<select class="in${on('deliverable')}" id="${sid('deliverable')}" data-sf="deliverable" aria-label="Deliverable"><option value="">Any deliverable</option><option value="__empty"${v('deliverable')==='__empty'?' selected':''}>General (no deliverable)</option>${delivList.map(d=>`<option value="${d.id}"${d.id===v('deliverable')?' selected':''}>${esc(d.name)}</option>`).join('')}</select>`:`<select class="in${on('deliverable')}" id="${sid('deliverable')}" data-sf="deliverable" aria-label="Deliverable"><option value="">Any deliverable</option><option value="__set"${v('deliverable')==='__set'?' selected':''}>Linked to a deliverable</option><option value="__empty"${v('deliverable')==='__empty'?' selected':''}>General (no deliverable)</option></select>`}
    <select class="in${on('service')}" id="${sid('service')}" data-sf="service" aria-label="Discipline"><option value="">Any discipline</option><option value="__empty"${v('service')==='__empty'?' selected':''}>No discipline</option>${S.services.map(s=>`<option value="${s.id}"${s.id===v('service')?' selected':''}>${esc(s.name)}</option>`).join('')}</select>
    <select class="in${on('source')}" id="${sid('source')}" data-sf="source" aria-label="Source"><option value="">Any source</option>${opts(SOURCES,v('source'))}</select>
    ${pid||v('project')?'':'<span class="hint">Choose a project to filter by a specific deliverable.</span>'}</div>`;
  return h;
}
function valueControl(r,c,gi,ri){
  const k=FIELDS[r.field].val,id=`ar-${c.pid||'g'}-${gi}-${ri}`,at=`id="${id}-v" class="in" data-rule="value" data-g="${gi}" data-r="${ri}" aria-label="Value"`;
  if(NOVAL.includes(r.op))return '';
  const sel=(inner)=>`<select ${at}><option value="">Choose…</option>${inner}</select>`;
  switch(k){
    case 'text':return `<input ${at} value="${esc(r.value)}" placeholder="Text">`;
    case 'person':return sel(peopleOpts(r.value)+(r.value&&!person(r.value)?`<option value="${esc(r.value)}" selected>(deleted person)</option>`:''));
    case 'project':return sel(projOpts(r.value,S.projects.slice().sort(codeSort))+(r.value&&!project(r.value)?`<option value="${esc(r.value)}" selected>(deleted project)</option>`:''));
    case 'status':return sel(statusOpts(T_STAT,r.value,TGLYPH));
    case 'priority':return sel(opts(PRIOS,r.value));
    case 'source':return sel(opts(SOURCES,r.value));
    case 'phase':return sel(phaseOpts(r.value)+(r.value&&!phase(r.value)?`<option value="${esc(r.value)}" selected>(deleted phase)</option>`:''));
    case 'service':return sel(S.services.map(s=>`<option value="${s.id}"${s.id===r.value?' selected':''}>${esc(s.name)}</option>`).join('')+(r.value&&!service(r.value)?`<option value="${esc(r.value)}" selected>(deleted discipline)</option>`:''));
    case 'deliverable':{const ds=c.pid?sortDelivs(delivsOf(c.pid)):S.deliverables.slice().sort((a,b)=>codeSort(project(a.projectId),project(b.projectId))||sortDelivs([a,b])[0]===a?-1:1);
      return sel(ds.map(d=>`<option value="${d.id}"${d.id===r.value?' selected':''}>${c.pid?'':esc(project(d.projectId).code)+' · '}${esc(d.name)}</option>`).join('')+(r.value&&!deliv(r.value)?`<option value="${esc(r.value)}" selected>(deleted deliverable)</option>`:''))}
    case 'date':return dateField(id+'-v',r.value,`data-rule="value" data-g="${gi}" data-r="${ri}" aria-label="Date"`,false);
  }
  return '';
}
function advEditor(c){
  const cfg=c.cfg,f=cfg.filters,ok=simpleCompatible(cfg),flds=Object.entries(FIELDS).filter(([k,x])=>!(c.pid&&x.globalOnly));
  let h=`<div class="adv" aria-label="Advanced filters"><div class="adv-h">Show tasks that match <select class="in" id="adv-join-${c.pid||'g'}" data-adv="join" aria-label="Combine groups" style="width:auto"><option value="and"${f.join==='and'?' selected':''}>all groups (AND)</option><option value="or"${f.join==='or'?' selected':''}>any group (OR)</option></select><span class="spacer"></span>${ok?'<button class="btn sm ghost" data-act="adv-off">Use simple filters</button>':''}<button class="btn sm primary" data-act="adv-close" aria-label="Close the filter editor (filters stay applied)">Done</button></div>`;
  f.groups.forEach((g,gi)=>{
    h+=`<div class="agroup"><div class="ag-h"><b>Group ${gi+1}</b> match <select class="in" id="adv-gj-${c.pid||'g'}-${gi}" data-adv="gjoin" data-g="${gi}" aria-label="Combine rules in group ${gi+1}" style="width:auto"><option value="and"${g.join==='and'?' selected':''}>all rules (AND)</option><option value="or"${g.join==='or'?' selected':''}>any rule (OR)</option></select><span class="spacer"></span>${f.groups.length>1?`<button class="btn sm ghost danger-t" data-act="group-del" data-g="${gi}">Remove group</button>`:''}</div>`;
    g.rules.forEach((r,ri)=>{const id=`ar-${c.pid||'g'}-${gi}-${ri}`;
      h+=`<div class="arule"><select class="in" id="${id}-f" data-rule="field" data-g="${gi}" data-r="${ri}" aria-label="Field">${flds.map(([k,x])=>`<option value="${k}"${k===r.field?' selected':''}>${x.label}</option>`).join('')}</select><select class="in" id="${id}-o" data-rule="op" data-g="${gi}" data-r="${ri}" aria-label="Condition">${FIELDS[r.field].ops.map(o=>`<option value="${o}"${o===r.op?' selected':''}>${opLabel(r.field,o)}</option>`).join('')}</select>${valueControl(r,c,gi,ri)}<button class="iconbtn del" data-act="rule-del" data-g="${gi}" data-r="${ri}" aria-label="Remove rule">${ICON.del}</button></div>`});
    if(!g.rules.length)h+='<p class="hint">No rules yet: this group matches every task.</p>';
    {const isF=g.rules.filter(r=>r.op==='is'&&!incomplete(r)).map(r=>r.field),dup=isF.find((f,i)=>isF.indexOf(f)!==i);
     if(g.join==='and'&&dup)h+=`<div class="pn-warn" role="status"><span>A task has only one ${esc(FIELDS[dup].label.toLowerCase())}, so “${esc(FIELDS[dup].label)} is …” rules joined with AND can never all be true and this group matches nothing.</span><button class="btn sm" data-act="gjoin-or" data-g="${gi}">Match any rule (OR)</button></div>`}
    h+=`<button class="btn sm" data-act="rule-add" data-g="${gi}">+ Add rule</button></div>`});
  return h+`<button class="btn sm" data-act="group-add">+ Add group</button><p class="hint">Relative dates such as “this week” are recalculated every time the view opens. “Done” closes the editor; the filters stay applied.</p></div>`;
}
function sortPanel(c){
  const cfg=c.cfg,fl=Object.entries(SORTF).filter(([k])=>!(c.pid&&k==='project'));
  return `<div class="cfgbox" aria-label="Sort"><b>Sort by</b>${cfg.sort.map((s,i)=>`<div class="arule"><span class="muted" style="min-width:52px">${i?'then by':'first'}</span><select class="in" id="srt-${c.pid||'g'}-${i}" data-sort="field" data-i="${i}" aria-label="Sort field ${i+1}" style="width:auto">${fl.map(([k,l])=>`<option value="${k}"${k===s.field?' selected':''}>${l}</option>`).join('')}</select><button class="btn sm" data-act="sort-dir" data-i="${i}" aria-label="Direction">${s.dir==='asc'?'↑ Ascending':'↓ Descending'}</button><button class="iconbtn" data-act="sort-move" data-i="${i}" data-d="-1"${i?'':' disabled'} aria-label="Move up">${ICON.up}</button><button class="iconbtn del" data-act="sort-del" data-i="${i}" aria-label="Remove sort level">${ICON.del}</button></div>`).join('')||'<p class="hint">No sort levels: tasks keep the order they were created in.</p>'}<button class="btn sm" data-act="sort-add">+ Add sort level</button></div>`;
}
function fieldsPanel(c){
  const cfg=c.cfg,avail=Object.keys(TCOLS).filter(k=>!(c.pid&&k==='project')),shown=cfg.columns,hidden=avail.filter(k=>!shown.includes(k));
  return `<div class="cfgbox" aria-label="Fields"><b>Fields shown</b> <span class="hint">Task name is always first. The same fields appear in Table columns, Board cards and List rows.</span>
    <div class="slist">${shown.map((k,i)=>`<div class="srow"><label class="chk grow"><input type="checkbox" id="col-${c.pid||'g'}-${k}" data-col="${k}" checked> ${TCOLS[k]}</label><button class="iconbtn" data-act="col-move" data-id="${k}" data-d="-1"${i?'':' disabled'} aria-label="Move ${TCOLS[k]} left">${ICON.up}</button><button class="iconbtn" data-act="col-move" data-id="${k}" data-d="1"${i<shown.length-1?'':' disabled'} aria-label="Move ${TCOLS[k]} right">${ICON.down}</button></div>`).join('')}
    ${hidden.map(k=>`<div class="srow"><label class="chk grow muted"><input type="checkbox" id="col-${c.pid||'g'}-${k}" data-col="${k}"> ${TCOLS[k]}</label></div>`).join('')}</div></div>`;
}
function defaultNewProject(){
  // prefer a project the current view can show (project / PM filters), then the last one used
  const c=ctxOf(null),list=[...new Set([ui.addProj,...allRules(c.cfg).filter(r=>r.field==='project'&&r.op==='is').map(r=>r.value),...activeProjects().map(p=>p.id)])].filter(id=>project(id)&&!project(id).archived);
  const ok=id=>{const b={id:'_new',name:'',projectId:id,deliverableId:null,status:'To Do',priority:'Normal',source:'Planned',serviceId:null,phaseId:null,due:null,assignedToId:project(id).pmId};return fitsCfg(b,c.cfg)||!!viewDefaults(b,new Set(),c.cfg)};
  return list.find(ok)||list[0]||'';
}
function newTaskForm(c,id){
  const pid=c.pid||defaultNewProject();
  if(!c.pid&&!pid)return `<span class="muted">Create a project first to add tasks.</span>`;
  return `<form class="nr" data-form="tnew" data-pid="${c.pid||''}"><input class="in nm" name="name" id="${id}" placeholder="+ New task: type a name and press Enter" maxlength="160" autocomplete="off" aria-label="New task name">${!c.pid?`<select class="in" name="projectId" id="${id}-proj" aria-label="Project for the new task" style="max-width:240px">${projOpts(pid)}</select>`:`<select class="in" name="deliverableId" id="${id}-deliv" aria-label="Deliverable for the new task" style="max-width:220px"><option value="">General project task</option>${delivOpts(pid,ui.qaDeliv&&deliv(ui.qaDeliv)?.projectId===pid?ui.qaDeliv:'')}</select>`}<button class="btn sm">Add</button></form>`;
}
function cellHTML(t,k,c){
  const p=project(t.projectId),d=t.deliverableId?deliv(t.deliverableId):null,over=isTaskOverdue(t),late=taskLate(t),ph=taskPhaseId(t);
  switch(k){
    case 'project':return `<td style="min-width:150px"><div class="pcell"><span class="code">${esc(p.code)}${p.archived?' · archived':''}</span><button class="plainbtn" data-act="panel-project" data-id="${p.id}">${esc(p.name)}</button></div></td>`;
    case 'deliverable':return `<td style="min-width:130px">${c.pid?`<select id="t-${t.id}-d" data-ent="t" data-id="${t.id}" data-f="deliverableId" aria-label="Deliverable"><option value="">General</option>${delivOpts(t.projectId,t.deliverableId)}</select>`:(d?`<button class="plainbtn" data-act="panel-deliv" data-id="${d.id}"><span class="dia-sw" style="--c:${phColor(d.phaseId)}"></span> ${esc(d.name)}</button>`:'<span class="muted">General</span>')}</td>`;
    case 'assignee':return `<td style="min-width:150px">${personPicker('t-'+t.id+'-a',t.assignedToId,`data-ent="t" data-id="${t.id}" data-f="assignedToId" aria-label="Assignee"`)}</td>`;
    case 'status':return `<td style="min-width:160px"><select id="t-${t.id}-st" data-ent="t" data-id="${t.id}" data-f="status" aria-label="Status">${statusOpts(T_STAT,t.status,TGLYPH)}</select></td>`;
    case 'due':return `<td><div style="display:flex;flex-wrap:wrap;align-items:center;gap:3px">${dateField('t-'+t.id+'-due',t.due,`data-ent="t" data-id="${t.id}" data-f="due" aria-label="Due date"`,true)}${over?'<span class="chip c-d">! Overdue</span>':''}${late?`<span class="chip c-w" title="Later than the deliverable due date (${fmt(d.due)})">After deliverable</span>`:''}</div></td>`;
    case 'priority':return `<td><select id="t-${t.id}-pr" data-ent="t" data-id="${t.id}" data-f="priority" aria-label="Priority" style="min-width:90px">${opts(PRIOS,t.priority)}</select></td>`;
    case 'phase':return `<td style="min-width:150px">${t.deliverableId?`<span class="muted" title="From the deliverable">${ph?`<span class="sw" style="--c:${phColor(ph)}"></span> `:''}${esc(phName(ph))}</span>`:`<select id="t-${t.id}-ph" data-ent="t" data-id="${t.id}" data-f="phaseId" aria-label="Phase"><option value="">General (no phase)</option>${ppPhaseOpts(t.projectId,t.phaseId)}</select>`}</td>`;
    case 'service':return `<td style="min-width:120px"><select id="t-${t.id}-sv" data-ent="t" data-id="${t.id}" data-f="serviceId" aria-label="Discipline"><option value="">—</option>${S.services.map(s=>`<option value="${s.id}"${s.id===t.serviceId?' selected':''}>${esc(s.name)}</option>`).join('')}</select></td>`;
    case 'source':return `<td style="min-width:140px"><select id="t-${t.id}-so" data-ent="t" data-id="${t.id}" data-f="source" aria-label="Source">${opts(SOURCES,t.source)}</select></td>`;
    case 'updated':return `<td class="nowrap muted">${fmt((t.updatedAt||'').slice(0,10))}</td>`;
    case 'created':return `<td class="nowrap muted">${fmt((t.createdAt||'').slice(0,10))}</td>`;
  }
  return '<td></td>';
}
function metaText(t,k){
  const p=project(t.projectId),d=t.deliverableId?deliv(t.deliverableId):null,over=isTaskOverdue(t),ph=taskPhaseId(t);
  switch(k){
    case 'project':return `<span><span class="mono">${esc(p.code)}</span> ${esc(p.name)}</span>`;
    case 'deliverable':return d?`<span><span class="dia-sw" style="--c:${phColor(d.phaseId)}"></span> ${esc(d.name)}</span>`:'<span>General</span>';
    case 'assignee':return `<span class="${t.assignedToId?'':'muted'}">${esc(t.assignedToId?shortName(pname(t.assignedToId)):'Unassigned')}</span>`;
    case 'status':return `<span>${TGLYPH[t.status]} ${esc(t.status)}</span>`;
    case 'due':return t.due?`<span class="${over?'od':''}">${over?'! ':''}${fmt(t.due)}</span>`:'';
    case 'priority':return t.priority!=='Normal'?`<span class="${t.priority==='High'?'od':''}">${t.priority==='High'?'▲ ':''}${esc(t.priority)}</span>`:'';
    case 'phase':return ph?`<span><span class="sw" style="--c:${phColor(ph)}"></span> ${esc(phName(ph))}</span>`:'';
    case 'service':return service(t.serviceId)?`<span>${esc(service(t.serviceId).name)}</span>`:'';
    case 'source':return t.source!=='Planned'?`<span>${esc(t.source)}</span>`:'';
    case 'updated':return `<span>Updated ${fmt((t.updatedAt||'').slice(0,10))}</span>`;
    case 'created':return `<span>Created ${fmt((t.createdAt||'').slice(0,10))}</span>`;
  }
  return '';
}
function taskTable(list,c){
  const cols=c.cfg.columns,ids=list.map(t=>t.id),all=ids.length&&ids.every(i=>ui.sel.has(i));
  const srt=c.cfg.sort,hs=(f,l,cl)=>{const i=srt.findIndex(s=>s.field===f),s=srt[i];return `<th class="${cl||''}" aria-sort="${i===0?(s.dir==='desc'?'descending':'ascending'):'none'}"><button class="thsort${i===0?' on':''}" id="tsort-${f}" data-act="tsort" data-f="${f}" title="Sort by ${esc(l)}${i===0?' (click to reverse)':''}">${l}<span class="sar" aria-hidden="true">${i===0?(s.dir==='desc'?'↓':'↑'):i>0?`<sup>${i+1}</sup>`:'↕'}</span></button></th>`};
  const tw=tsCfg('tk').name.wrap;if(tw)setTimeout(tkGrowAll,0);
  return `<div class="twrap tk-shell" id="tk-shell" style="${tsShellStyle('tk')}"><table class="tbl edit tt${tsWrapCls('tk')}" id="tk-table"><colgroup><col class="tk-ck"><col class="tk-name">${cols.map(k=>`<col class="tk-${k}">`).join('')}<col class="tk-open"></colgroup><thead><tr><th class="ck"><input type="checkbox" id="tsel-all" data-ids="${ids.join(',')}"${all?' checked':''} aria-label="Select all shown tasks"${ids.length?'':' disabled'}></th>${hs('name','Task','c-name')}${cols.map(k=>COL2SORT[k]?hs(COL2SORT[k],TCOLS[k],'c-'+k):`<th class="c-${k}">${TCOLS[k]}</th>`).join('')}<th class="act c-open"><span class="sr">Open</span></th></tr></thead>
  <tbody><tr class="newrow"><td></td><td colspan="${cols.length+2}">${newTaskForm(c,'tnew-name')}</td></tr>${list.map(t=>{const sel=ui.panel&&ui.panel.type==='task'&&ui.panel.id===t.id;
    return `<tr data-trow="${t.id}" tabindex="0" class="trow${isTaskOverdue(t)?' r-over':''}${t.status==='Done'?' tr-done':''}${sel?' sel':''}"><td class="ck"><input type="checkbox" data-tsel="${t.id}"${ui.sel.has(t.id)?' checked':''} aria-label="Select ${esc(t.name)}"></td>
    <td class="tname c-name"><div class="nmrow">${t.priority==='High'?'<span class="prio-hi" title="High priority" aria-label="High priority">▲</span>':''}${tw?`<textarea class="tnm-wrap" rows="1" id="t-${t.id}-name" data-ent="t" data-id="${t.id}" data-f="name" maxlength="160" aria-label="Task name"${t.wfStepId?' readonly title="Workflow task: its name comes from Settings → Company workflow"':''}>${esc(t.name)}</textarea>`:`<input id="t-${t.id}-name" data-ent="t" data-id="${t.id}" data-f="name" value="${esc(t.name)}" aria-label="Task name"${t.wfStepId?' readonly title="Workflow task: its name comes from Settings → Company workflow"':''}>`}</div></td>${cols.map(k=>cellHTML(t,k,c).replace(/^<td( class="([^"]*)")?/,(m,a,cl)=>`<td class="${cl?cl+' ':''}c-${k}"`)).join('')}
    <td class="act c-open"><button class="openb" id="to-${t.id}" data-act="panel-task" data-id="${t.id}" aria-label="Open ${esc(t.name)}">${ICON.open} Open</button></td></tr>`}).join('')}</tbody></table></div>`;
}
const GFIELD={status:'status',assignee:'assignedToId',project:'projectId',phase:'phaseId',deliverable:'deliverableId'};
function groupVal(t,g){return g==='status'?t.status:g==='assignee'?(t.assignedToId||''):g==='project'?t.projectId:g==='phase'?(taskPhaseId(t)||''):g==='deliverable'?(t.deliverableId||''):''}
function groupDefs(list,c,board){
  const g=c.cfg.group==='none'&&board?'status':c.cfg.group,pid=c.pid,has=v=>list.some(t=>groupVal(t,g)===v);
  if(g==='status')return T_STAT.filter(s=>s!=='Done'||c.cfg.showDone||has('Done')||!board).filter(s=>board||has(s)).map(s=>({v:s,label:`${TGLYPH[s]} ${s}`}));
  if(g==='assignee'){const ps=peopleSorted().filter(p=>board||has(p.id));return [...(board||has('')?[{v:'',label:'Unassigned'}]:[]),...ps.map(p=>({v:p.id,label:p.name,person:true}))]}
  if(g==='project'){const ids=new Set(list.map(t=>t.projectId));return S.projects.filter(p=>ids.has(p.id)).sort(codeSort).map(p=>({v:p.id,label:`${p.code} · ${p.name}`,proj:true}))}
  if(g==='phase'){const phs=pid?ppOf(pid).map(pp=>pp.phaseId):S.phases.filter(ph=>has(ph.id)||(board&&ph.active)).map(ph=>ph.id);return [...phs.filter(id=>board||has(id)).map(id=>({v:id,label:phName(id),color:phColor(id)})),...(has('')||board?[{v:'',label:'General (no phase)'}]:[])]}
  if(g==='deliverable'){const ds=pid?sortDelivs(delivsOf(pid)):sortDelivs(S.deliverables.filter(d=>has(d.id)));return [...ds.filter(d=>board||has(d.id)).map(d=>({v:d.id,label:pid?d.name:`${project(d.projectId).code} · ${d.name}`,color:phColor(d.phaseId),deliv:true})),...(has('')||board?[{v:'',label:'General (no deliverable)'}]:[])]}
  return [{v:'',label:'All tasks'}];
}
function taskBoard(list,c){
  const g=c.cfg.group==='none'?'status':c.cfg.group,cols=groupDefs(list,c,true),field=GFIELD[g];
  if(!cols.length)return `<div class="empty"><h2>No columns to show</h2></div>`;
  return `<div class="board-wrap"><div class="board">${cols.map(col=>{
    const ts=list.filter(t=>groupVal(t,g)===col.v),key=`${field}:${col.v}`,adding=ui.colAdd===key;
    const head=col.person?`<button class="plainbtn" data-act="person-filter" data-id="${col.v}" title="Show only ${esc(col.label)}">${esc(col.label)}</button>`:col.proj?`<button class="plainbtn" data-act="panel-project" data-id="${col.v}">${esc(col.label)}</button>`:col.deliv?`<button class="plainbtn" data-act="panel-deliv" data-id="${col.v}"><span class="dia-sw" style="--c:${col.color}"></span> ${esc(col.label)}</button>`:`${col.color?`<span class="sw" style="--c:${col.color}"></span>`:''}${esc(col.label)}`;
    const needProj=!c.pid&&!['projectId','deliverableId'].includes(field),dp=c.pid||(field==='projectId'?col.v:defaultNewProject());
    return `<section class="bcol" data-gfield="${field}" data-gval="${esc(col.v)}" aria-label="${esc(col.label)}"><div class="bh">${head}<span class="n">${ts.length}</span></div>${ts.map(t=>cardHTML(t,c,g)).join('')||'<p class="bempty">No tasks</p>'}
     ${adding?`<form class="badd" data-form="tcol" data-field="${field}" data-val="${esc(col.v)}" data-pid="${c.pid||''}"><input class="in" name="name" id="badd-name" placeholder="Task name, then Enter" maxlength="160" autocomplete="off" aria-label="New task name">${needProj?`<select class="in" name="projectId" aria-label="Project">${projOpts(dp)}</select>`:''}<div style="display:flex;gap:6px"><button class="btn sm primary">Add</button><button type="button" class="btn sm ghost" data-act="badd-cancel">Done</button></div></form>`:(!c.pid&&!activeProjects().length?'':`<button class="bplus" data-act="badd" data-k="${esc(key)}">+ Add task</button>`)}</section>`}).join('')}</div></div>`;
}
function moveSelect(t,g){
  const id=`cm-${t.id}`,lab=`aria-label="${GROUPS[g]} of ${esc(t.name)}"`;
  if(g==='assignee')return `<select class="csel" id="${id}" data-ent="t" data-id="${t.id}" data-f="assignedToId" ${lab}><option value="">Unassigned</option>${peopleOpts(t.assignedToId)}</select>`;
  if(g==='project')return `<select class="csel" id="${id}" data-ent="t" data-id="${t.id}" data-f="projectId" ${lab}>${projOpts(t.projectId,S.projects.filter(x=>!x.archived||x.id===t.projectId).sort(codeSort))}</select>`;
  if(g==='phase')return t.deliverableId?'':`<select class="csel" id="${id}" data-ent="t" data-id="${t.id}" data-f="phaseId" ${lab}><option value="">General (no phase)</option>${ppPhaseOpts(t.projectId,t.phaseId)}</select>`;
  if(g==='deliverable')return `<select class="csel" id="${id}" data-ent="t" data-id="${t.id}" data-f="deliverableId" ${lab}><option value="">General</option>${delivOpts(t.projectId,t.deliverableId)}</select>`;
  return `<select class="csel" id="${id}" data-ent="t" data-id="${t.id}" data-f="status" ${lab}>${statusOpts(T_STAT,t.status,TGLYPH)}</select>`;
}
function cardHTML(t,c,g){
  const over=isTaskOverdue(t),sel=ui.panel&&ui.panel.type==='task'&&ui.panel.id===t.id,skip={status:'status',assignee:'assignee',project:'project',phase:'phase',deliverable:'deliverable'}[g];
  const meta=c.cfg.columns.filter(k=>k!==skip).map(k=>metaText(t,k)).filter(Boolean).join('');
  return `<article class="card${over?' over':''}${t.status==='Done'?' done':''}${sel?' sel':''}" draggable="true" data-tid="${t.id}" tabindex="0" aria-label="${esc(t.name)}"><button class="cn" data-act="panel-task" data-id="${t.id}">${t.priority==='High'?'<span class="prio-hi" aria-label="High priority">▲</span> ':''}${esc(t.name)}</button>${meta?`<div class="cf">${meta}</div>`:''}${moveSelect(t,g)}</article>`;
}
function taskList(list,c){
  const g=c.cfg.group,defs=g==='none'?[{v:'',label:'All tasks'}]:groupDefs(list,c,false);
  let h=`<div class="lgroup"><div class="lh">${newTaskForm(c,'tnew-name')}</div></div>`;
  defs.forEach(d=>{const ts=g==='none'?list:list.filter(t=>groupVal(t,g)===d.v);if(!ts.length)return;
    const title=d.person?`<button class="plainbtn" data-act="person-filter" data-id="${d.v}" title="Show only ${esc(d.label)}">${esc(d.label)}</button>`:d.proj?`<button class="plainbtn" data-act="panel-project" data-id="${d.v}">${esc(d.label)}</button>`:d.deliv?`<button class="plainbtn" data-act="panel-deliv" data-id="${d.v}"><span class="dia-sw" style="--c:${d.color}"></span> ${esc(d.label)}</button>`:`${d.color?`<span class="sw" style="--c:${d.color}"></span>`:''}${esc(d.label)}`;
    h+=`<section class="lgroup"><div class="lh">${title}<span class="n">${ts.length}</span></div>${ts.map(t=>{const sel=ui.panel&&ui.panel.type==='task'&&ui.panel.id===t.id;
      const meta=c.cfg.columns.filter(k=>k!=='status'&&k!==g).map(k=>metaText(t,k)).filter(Boolean).join('');
      return `<div class="lrow${t.status==='Done'?' done':''}${sel?' sel':''}"><select class="st-sel" id="ls-${t.id}" data-ent="t" data-id="${t.id}" data-f="status" aria-label="Status of ${esc(t.name)}">${statusOpts(T_STAT,t.status,TGLYPH)}</select><div class="lname">${t.priority==='High'?'<span class="prio-hi" aria-label="High priority">▲</span>':''}<button class="plainbtn" data-act="panel-task" data-id="${t.id}">${esc(t.name)}</button></div><div class="lmeta">${meta}</div></div>`}).join('')}</section>`});
  return h;
}
function bulkBarHTML(vis){
  const n=vis.filter(i=>ui.sel.has(i)).length;if(!n)return '';
  return `<div class="bulk" role="region" aria-label="Bulk actions"><b>${plural(n,'task')} selected</b><select class="in" id="bulk-status" aria-label="Set status for selected tasks"><option value="">Set status…</option>${statusOpts(T_STAT,'',TGLYPH)}</select><select class="in" id="bulk-assign" aria-label="Assign selected tasks"><option value="">Assign to…</option><option value="__none">Unassigned</option>${peopleOpts('')}</select><button class="btn sm ghost danger-t" data-act="bulk-del">Delete…</button><button class="btn sm ghost" data-act="bulk-clear">Clear selection</button></div>`;
}
/* board moves keep project / phase / deliverable relations valid */
function moveTask(t,field,val){
  const undo=snapshot([t]);let note='';
  if(field==='projectId'){if(val===t.projectId)return;const had=!!t.deliverableId;setTaskField(t,'projectId',val);note=`Moved to ${project(val).code}${had?'. Its deliverable link was cleared; choose a deliverable from the new project if it applies':''}`;
    if(ui.panel&&ui.panel.type==='task'&&ui.panel.id===t.id&&had)ui.panelNote='Project changed, so the deliverable link was cleared. Choose a deliverable from this project if it applies.'}
  else if(field==='assignedToId'){val=val||null;if(val===(t.assignedToId||null))return;setTaskField(t,'assignedToId',val);note=`${t.name} → ${val?pname(val):'Unassigned'}`}
  else if(field==='phaseId'){val=val||null;if(val===(taskPhaseId(t)||null))return;
    if(t.deliverableId){toast(`“${t.name}” takes its phase from its deliverable (${deliv(t.deliverableId).name}). Change the deliverable instead.`,'err');render();return}
    if(val&&!ppFor(t.projectId,val)){toast(`${project(t.projectId).code} doesn’t use ${phName(val)}. Add the phase to the project first.`,'err');render();return}
    setTaskField(t,'phaseId',val);note=`${t.name} → ${val?phName(val):'General (no phase)'}`}
  else if(field==='deliverableId'){val=val||null;if(val===(t.deliverableId||null))return;
    if(val&&deliv(val).projectId!==t.projectId){toast(`That deliverable belongs to ${project(deliv(val).projectId).code}. Move the task to that project first.`,'err');render();return}
    setTaskField(t,'deliverableId',val);note=`${t.name} → ${val?deliv(val).name:'General'}`}
  else{if(val===t.status)return;setTaskField(t,'status',val);note=`${t.name}: ${TGLYPH[val]} ${val}`}
  save();render();toast(note,'',undo);
}

/* ---------- view dialogs ---------- */
function openViewDialog(mode,pid,vid){
  const v=vid?viewById(vid):null,c=ctxOf(pid||null);
  const title={new:'New view',saveas:'Save as new view',rename:'Rename view',dup:'Duplicate view'}[mode];
  const name=mode==='rename'?v.name:mode==='dup'?`${v.name} (copy)`:'';
  const p=pid?project(pid):null;
  openModal(`<form data-form="view-name" data-mode="${mode}" data-pid="${pid||''}" data-id="${vid||''}" novalidate><div class="m-head"><div><div class="eyebrow">${p?`<span class="mono">${esc(p.code)}</span> · ${esc(p.name)}`:'All projects'}</div><h2>${title}</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <div class="fgrid"><label class="fld span2"><span class="lb">Name</span><input class="in" name="name" value="${esc(name)}" maxlength="80" placeholder="e.g. Ready to review" autocomplete="off"><em class="err"></em></label>
    ${mode==='new'||mode==='saveas'?`<label class="fld"><span class="lb">Layout</span><select class="in" name="layout">${Object.entries(LAYOUTS).map(([k,l])=>`<option value="${k}"${k===c.cfg.layout?' selected':''}>${l}</option>`).join('')}</select></label>`:''}
    ${mode==='new'?`<div class="fld"><span class="lb">Start from</span><label class="chk"><input type="radio" name="start" value="current" checked> Current filters, sort and fields</label><label class="chk"><input type="radio" name="start" value="blank"> A blank view</label></div>`:''}</div>
    ${mode==='saveas'||mode==='new'?`<p class="hint">Current filters: ${esc(cfgSummary(c.cfg))}.</p>`:''}
    <p class="hint">${p?'This view always shows only this project’s tasks.':'This view covers all projects.'} Views are personal: they are saved for you in this workspace and other users don’t see them.</p>
    <div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">${mode==='rename'?'Rename':'Save view'}</button></div></form>`);
}

/* ---------- Favorites ---------- */
function renderFavorites(){
  let h=`<div class="pagehead"><h1>Favorites</h1><span class="spacer"></span></div><p class="note" style="margin-bottom:12px">Shortcuts to saved task views. Star a view in Tasks or in a project’s Tasks tab to add it here. Favorites are personal: they are saved for you in this workspace and other users don’t see them.</p>`;
  const favs=S.favorites.map(f=>({f,v:viewById(f.viewId)})).filter(x=>x.v);
  if(!favs.length)return h+`<div class="empty"><h2>No favorites yet</h2><p>Open Tasks, save a view, then select “Add to Favorites”.</p><div class="row"><button class="btn" data-act="nav" data-to="tasks">Open Tasks</button></div></div>`;
  h+=`<ol class="favlist">${favs.map(({f,v},i)=>{const p=v.projectId?project(v.projectId):null,iss=viewIssuesById(v),n=evalView(cfgOf(v),v.projectId||null).length;
    return `<li class="favrow"><span class="favstar" aria-hidden="true">★</span><div class="favmain"><button class="plainbtn favname" data-act="fav-open" data-id="${v.id}">${esc(v.name)}</button>
      <div class="favmeta"><span class="chip c-n">${LAYOUTS[v.layout]}</span><span>${p?`<span class="mono">${esc(p.code)}</span> ${esc(p.name)}${p.archived?' <span class="chip c-w">Archived project</span>':''}`:'All projects'}</span><span class="muted">${plural(n,'task')}</span>${iss.length?'<span class="chip c-w">Needs review</span>':''}</div>
      <div class="favsum">${esc(cfgSummary(cfgOf(v)))}</div></div>
      <div class="favacts"><button class="iconbtn" data-act="fav-move" data-id="${f.id}" data-d="-1"${i?'':' disabled'} aria-label="Move ${esc(v.name)} up">${ICON.up}</button><button class="iconbtn" data-act="fav-move" data-id="${f.id}" data-d="1"${i<favs.length-1?'':' disabled'} aria-label="Move ${esc(v.name)} down">${ICON.down}</button><button class="btn sm ghost" data-act="view-star" data-id="${v.id}" aria-label="Remove ${esc(v.name)} from Favorites">Remove</button></div></li>`}).join('')}</ol>`;
  return h;
}
function openView(vid){
  const v=viewById(vid);if(!v)return;
  if(v.projectId){prefs.activeView[v.projectId]=v.id;savePrefs();ui.panel=null;ui.panelStack=[];go('p-'+v.projectId,{tab:'tasks'})}
  else{prefs.activeView.global=v.id;savePrefs();go('tasks')}
}
/* legend popover (hidden by default; same content and colours as Settings) */
function legendCtl(){
  const items=S.phases.filter(p=>p.active||S.projectPhases.some(x=>x.phaseId===p.id));
  return `<div class="legend-wrap"><button class="btn sm" id="legend-btn" data-act="legend" aria-expanded="${!!ui.legendOpen}" aria-controls="legend-pop" aria-label="Legend: phase colours and status symbols">${ICON.info} Legend</button>
  <div class="legend-pop" id="legend-pop" role="dialog" aria-label="Timeline legend" tabindex="-1"${ui.legendOpen?'':' hidden'}><div class="lp-h"><b>Legend</b><button class="iconbtn" data-act="legend" aria-label="Close legend">✕</button></div>
   <h3>Phases</h3><ul>${items.map(p=>`<li><i class="lg-bar" style="--c:${p.color}"></i>${esc(p.name)}</li>`).join('')}</ul>
   <h3>Phase status</h3><ul><li><i class="lg-bar done" style="--c:var(--muted)"></i>✓ Completed</li><li><i class="lg-bar hold" style="--c:var(--muted)"></i>‖ On hold</li><li><i class="lg-ic over">!</i> Late: end date passed, not Completed</li><li><span class="mono">‹ ›</span> Continues outside the window</li></ul>
   <h3>Deliverables</h3><ul><li><i class="dia-sw" style="--c:var(--muted)"></i> Due date (colour of its phase)</li><li><i class="lg-ic done">✓</i> Delivered</li><li><i class="lg-ic over">!</i> Overdue</li><li><span class="cl" style="position:static;margin:0;display:inline-flex">4</span> Several deliverables close together</li></ul>
   <p class="hint">Drag a bar to move a phase, its ends to change dates; drag a diamond to change a due date. Or select one and use ← →.</p></div></div>`;
}
function setLegend(open){ui.legendOpen=open;document.querySelectorAll('.legend-pop').forEach(p=>{p.hidden=!open});document.querySelectorAll('[data-act=legend]#legend-btn').forEach(b=>b.setAttribute('aria-expanded',String(open)));if(open){const p=document.getElementById('legend-pop');if(p)p.focus()}}
function newTaskFocus(){
  const i=document.getElementById('tnew-name');if(i){i.focus();i.scrollIntoView({block:'center'});return}
  const c=document.querySelector('.bcol');if(c){ui.colAdd=`${c.dataset.gfield}:${c.dataset.gval}`;ui.focusAfter='badd-name';render()}
}
/* right-click (or the context-menu key / Shift+F10) on a saved view tab: rename, duplicate, favorite, delete */
let ctxFrom=null;
function ctxMenuEl(){let m=document.getElementById('ctxmenu');if(!m){m=document.createElement('div');m.id='ctxmenu';m.className='ctxm';m.setAttribute('role','menu');m.hidden=true;document.body.appendChild(m)}return m}
function closeCtx(focusBack){const m=document.getElementById('ctxmenu');if(!m||m.hidden)return false;m.hidden=true;if(focusBack&&ctxFrom&&document.contains(ctxFrom))ctxFrom.focus();return true}
function openCtx(t,x,y){
  const v=viewById(t.dataset.id);if(!v)return;hideMenus();ctxFrom=t;
  const fav=S.favorites.some(f=>f.viewId===v.id),m=ctxMenuEl();
  m.setAttribute('aria-label',`Actions for view ${v.name}`);
  m.innerHTML=`<div class="ctx-h">${esc(v.name)}</div><button role="menuitem" data-act="view-rename" data-id="${v.id}">Rename…</button><button role="menuitem" data-act="view-dup" data-id="${v.id}">Duplicate…</button><button role="menuitem" data-act="view-star" data-id="${v.id}">${fav?'Remove from Favorites':'Add to Favorites'}</button><button role="menuitem" class="danger-t" data-act="view-del" data-id="${v.id}">Delete view…</button>`;
  m.hidden=false;
  if(x==null){const r=t.getBoundingClientRect();x=r.left;y=r.bottom+4}
  const r=m.getBoundingClientRect();m.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';m.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';
  m.querySelector('button').focus();
}
document.addEventListener('contextmenu',e=>{
  const t=e.target.closest&&e.target.closest('.vtab[data-act=view-select]');
  if(!t||t.dataset.id==='all'||!viewById(t.dataset.id)){closeCtx();return}
  e.preventDefault();const kb=!e.clientX&&!e.clientY;openCtx(t,kb?null:e.clientX,kb?null:e.clientY);
});
document.addEventListener('keydown',e=>{
  const m=document.getElementById('ctxmenu');
  if(m&&!m.hidden&&m.contains(e.target)){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const bs=[...m.querySelectorAll('button')],i=bs.indexOf(e.target);bs[(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length].focus()}
    else if(e.key==='Tab'){e.preventDefault();closeCtx(true)}
    return}
  const t=e.target.closest&&e.target.closest('.vtab[data-act=view-select]');
  if(t&&t.dataset.id!=='all'&&e.key==='Delete'){e.preventDefault();const b=document.createElement('button');b.dataset.act='view-del';b.dataset.id=t.dataset.id;b.hidden=true;document.body.appendChild(b);b.click();b.remove()}
});
document.addEventListener('scroll',()=>closeCtx(),true);
window.addEventListener('blur',()=>closeCtx());
/* New tasks created inside a filtered view get values that keep them visible in it.
   Fields the person chose explicitly (board column, deliverable picked in the form) are kept.
   Status: the least advanced status the view allows (To Do → In progress → Waiting → QA → Done). */
function fitsCfg(t,cfg){const doneAsked=allRules(cfg).some(r=>r.field==='status'&&r.op==='is'&&r.value==='Done');return (cfg.showDone||doneAsked||t.status!=='Done')&&cfgMatch(t,cfg)}
function viewDefaults(base,fixed,cfg){
  const rules=allRules(cfg).filter(r=>!incomplete(r));if(!rules.length)return null;
  const used=new Set(rules.map(r=>r.field)),is=f=>rules.filter(r=>r.field===f&&r.op==='is').map(r=>r.value);
  const cand={},add=(k,v)=>{(cand[k]=cand[k]||[]);if(!cand[k].includes(v))cand[k].push(v)};
  const today=todayDN();
  if(used.has('status')&&!fixed.has('status'))T_STAT.forEach(s=>add('status',s));
  if(used.has('assignee')&&!fixed.has('assignedToId')){is('assignee').filter(person).forEach(v=>add('assignedToId',v));add('assignedToId',base.assignedToId||null);peopleSorted().forEach(p=>add('assignedToId',p.id));add('assignedToId',null)}
  if(used.has('priority')&&!fixed.has('priority')){is('priority').forEach(v=>add('priority',v));['Normal','High','Low'].forEach(v=>add('priority',v))}
  if(used.has('source')&&!fixed.has('source')){is('source').forEach(v=>add('source',v));SOURCES.forEach(v=>add('source',v))}
  if(used.has('service')&&!fixed.has('serviceId')){is('service').filter(service).forEach(v=>add('serviceId',v));add('serviceId',null);S.services.forEach(s=>add('serviceId',s.id))}
  if(used.has('deliverable')&&!fixed.has('deliverableId')){const own=delivsOf(base.projectId);is('deliverable').filter(v=>own.some(d=>d.id===v)).forEach(v=>add('deliverableId',v));add('deliverableId',null);sortDelivs(own).forEach(d=>add('deliverableId',d.id))}
  if(used.has('phase')&&!fixed.has('phaseId')&&!base.deliverableId){const pps=ppOf(base.projectId).map(pp=>pp.phaseId);is('phase').filter(v=>pps.includes(v)).forEach(v=>add('phaseId',v));add('phaseId',null);pps.forEach(v=>add('phaseId',v))}
  if(used.has('due')&&!fixed.has('due')){rules.filter(r=>r.field==='due').forEach(r=>{const v=r.value?iso2dn(r.value):null;
      const x={overdue:today-1,today,this_week:today,next_7:today,next_30:today,set:today,before:v!=null?v-1:null,after:v!=null?v+1:null,on:v}[r.op];if(x!=null)add('due',dn2iso(x))});add('due',base.due||null)}
  const keys=Object.keys(cand);let tries=0,found=null;
  const walk=(i,t)=>{if(found||tries>4000)return;if(i===keys.length){tries++;if(fitsCfg(t,cfg))found=t;return}
    for(const v of cand[keys[i]]){walk(i+1,{...t,[keys[i]]:v});if(found)return}};
  walk(0,{...base});
  return found;
}
function impossibleGroup(cfg){return cfg.filters.groups.some(g=>{if(g.join!=='and')return false;const f=g.rules.filter(r=>r.op==='is'&&!incomplete(r)).map(r=>r.field);return f.some((x,i)=>f.indexOf(x)!==i)})}

