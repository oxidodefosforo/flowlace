/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- Overview ---------- */
function filtered(){
  const f=prefs.filters,q=f.q.trim().toLowerCase(),from=f.from?iso2dn(f.from):null,to=f.to?iso2dn(f.to):null,dFilter=!!(f.phase||f.from||f.to);
  const rows=[];
  for(const p of S.projects){
    if(p.archived)continue;
    if(q&&!(p.name.toLowerCase().includes(q)||p.code.toLowerCase().includes(q)))continue;
    if(f.pm&&p.pmId!==f.pm)continue;
    if(f.status&&p.status!==f.status)continue;
    const ds=delivsOf(p.id).filter(d=>{
      if(f.phase&&d.phaseId!==f.phase)return false;
      if(from!=null||to!=null){if(!d.due)return false;const e=iso2dn(d.due),s=d.start?iso2dn(d.start):e;if(from!=null&&e<from)return false;if(to!=null&&s>to)return false}
      return true});
    const ps=ppOf(p.id).filter(pp=>{
      if(f.phase&&pp.phaseId!==f.phase)return false;
      if(from!=null||to!=null){if(!ppScheduled(pp))return false;if(from!=null&&iso2dn(pp.end)<from)return false;if(to!=null&&iso2dn(pp.start)>to)return false}
      return true});
    if(dFilter&&!ds.length&&!ps.length)continue;
    rows.push({p,ds,ps});
  }
  rows.sort((a,b)=>codeSort(a.p,b.p));
  return rows;
}
function overviewSets(rows){
  const t=todayDN(),all=rows.flatMap(r=>r.ds);
  return {
    inprog:rows.filter(r=>r.p.status==='In progress').map(r=>r.p),
    due21:all.filter(d=>d.due&&d.status!=='Delivered'&&iso2dn(d.due)>=t&&iso2dn(d.due)<=t+21),
    over:all.filter(isOverdue),
    late:rows.flatMap(r=>r.ps).filter(ppLate),
    wait:all.filter(d=>d.status!=='Delivered'&&delivTasks(d.id).some(x=>x.status==='Waiting information')),
    all};
}
function overviewFilters(){
  const f=prefs.filters,nf=activeFilterCount(),on=v=>v?' on':'';
  return `<div class="filters" role="search" aria-label="Project filters">
    <input class="in q${on(f.q.trim())}" type="search" id="f-q" data-filter="q" placeholder="Search project name or code" aria-label="Search projects" value="${esc(f.q)}" autocomplete="off">
    <select class="in${on(f.pm)}" id="f-pm" data-filter="pm" aria-label="Project PM"><option value="">All PMs</option>${peopleOpts(f.pm)}</select>
    <select class="in${on(f.status)}" id="f-status" data-filter="status" aria-label="Project status"><option value="">All project statuses</option>${opts(P_STAT,f.status)}</select>
    <select class="in${on(f.phase)}" id="f-phase" data-filter="phase" aria-label="Phase"><option value="">All phases</option>${phaseOpts(f.phase)}</select>
    <span class="flabel${f.from?' fon':''}">From ${dateField('f-from',f.from,'data-filter="from" aria-label="From date"',true)}</span>
    <span class="flabel${f.to?' fon':''}">To ${dateField('f-to',f.to,'data-filter="to" aria-label="To date"',true)}</span>
    ${f.from&&f.to&&f.from>f.to?'<p class="warnline">The From date is after the To date, so nothing can match.</p>':''}
  </div>`;
}
function renderOverview(){
  const rows=filtered(),nf=activeFilterCount(),k=overviewSets(rows),t=todayDN(),act=S.projects.filter(p=>!p.archived);
  let h=`<div class="pagehead"><h1>Overview</h1><span class="eyebrow">${fmtDN(t)}</span><span class="spacer"></span><div class="seg" role="group" aria-label="Overview layout"><button data-act="ov-mode" data-v="timeline" aria-pressed="${prefs.ovMode!=='table'&&prefs.ovMode!=='calendar'}">Timeline</button><button data-act="ov-mode" data-v="table" aria-pressed="${prefs.ovMode==='table'}">Table</button><button data-act="ov-mode" data-v="calendar" aria-pressed="${prefs.ovMode==='calendar'}">Calendar</button></div></div>`;
  const ks=(key,n,label,sub,alert)=>`<button class="ks${alert&&n?' alert':''}" data-act="kpi" data-k="${key}" aria-pressed="${!!(ui.panel&&ui.panel.type==='list'&&ui.panel.kpi===key)}"><span class="n">${n}</span><span class="l"><b>${label}</b><span>${sub}</span></span></button>`;
  h+=`<div class="kstrip" aria-label="Summary">${ks('inprog',k.inprog.length,'Projects in progress',nf?'matching filters':'active projects')}${ks('due21',k.due21.length,'Due in next 21 days',`to ${fmtDN(t+21)}`)}${ks('over',k.over.length,'Overdue deliverables','past due, not delivered',true)}${ks('late',k.late.length,'Late phases','end date passed, not Completed',true)}</div>`;
  if(S.projects.some(p=>p.example))h+=`<p class="notice"><span class="ex">Example</span> Sample projects are loaded so you can try the planner. <button class="linkbtn" data-act="remove-examples">Remove example data</button></p>`;
  if(!act.length){h+=`<div class="empty"><h2>No projects yet</h2><p>Create a project; its default phases are added automatically and it appears here.</p><div class="row"><button class="btn primary" data-act="new-project">+ New project</button>${S.projects.length?'':'<button class="btn" data-act="load-examples">Load example projects</button>'}</div></div>`;return h}
  // shared header for Timeline and Table: time controls first, then the Filters toggle
  const tl=prefs.ovMode!=='table'&&prefs.ovMode!=='calendar',cal=prefs.ovMode==='calendar',fo=fOpen('overview');
  h+=`<div class="toolbar ovbar">${cal?'':winControls(!tl)}${filtersToggle('overview',nf,'clear-filters')}${ovSortCtl()}<span class="spacer"></span>${tl&&rows.length?'<button class="btn sm ghost" data-act="expand-all">Show all phases</button><button class="btn sm ghost" data-act="collapse-all">Collapse all</button>':''}</div>`;
  if(fo)h+=`<div id="fp-overview" class="ovfilters">${overviewFilters()}</div>`;
  if(!rows.length){h+=`<div class="empty"><h2>No results for these filters</h2><p>${plural(act.length,'active project')} exist, but none match. Try another PM, status or phase.</p><div class="row"><button class="btn" data-act="clear-filters">Clear filters</button></div></div>`;return h}
  if(cal)return h+overviewCalendar(rows);
  if(prefs.ovMode!=='table')h+=timelineHTML(ovSortRows(rows));else return h+overviewTable(rows);
  return h;
}
function overviewTable(rows){
  const data=rows.map(({p,ds,ps})=>{const np=nextPending(ds),ts=tasksOf(p.id).filter(taskOpen),t=todayDN();
    const now=ps.filter(pp=>pp.status==='In progress'||(ppScheduled(pp)&&pp.status!=='Completed'&&pp.status!=='Not applicable'&&iso2dn(pp.start)<=t&&iso2dn(pp.end)>=t));
    return{p,ds,ps,np,now,lateP:ps.filter(ppLate).length,over:ds.filter(isOverdue).length,open:ts.length,late:ts.filter(isTaskOverdue).length,wait:ts.filter(x=>x.status==='Waiting information').length}});
  const{k,dir}=prefs.sort;const order=new Map(ovSortRows(rows).map((r,i)=>[r.p.id,i]));data.sort((a,b)=>order.get(a.p.id)-order.get(b.p.id));
  const th=(key,l,cls='')=>`<th class="${cls}" aria-sort="${k===key?(dir>0?'ascending':'descending'):'none'}"><button data-act="sort" data-k="${key}">${l}${k===key?(dir>0?' ↑':' ↓'):''}</button></th>`;
  return `<div class="twrap"><table class="tbl"><thead><tr>${th('code','Project')}${th('pm','PM')}${th('status','Status')}<th>Current phase</th><th>Next pending deliverable</th>${th('due','Due')}${th('over','Overdue','num')}${th('tasks','Open tasks','num')}<th class="num">Waiting info</th></tr></thead><tbody>${data.map(r=>`<tr class="${ui.panel&&ui.panel.type==='project'&&ui.panel.id===r.p.id?'sel':''}">
    <td><div class="pcell"><span class="code">${esc(r.p.code)}${r.p.example?' · example':''}</span><button class="plainbtn" data-act="panel-project" data-id="${r.p.id}"><b>${esc(r.p.name)}</b></button></div></td>
    <td class="nowrap">${esc(pname(r.p.pmId))}</td><td>${pChip(r.p.status)}</td>
    <td>${r.now.length?r.now.map(pp=>`<button class="plainbtn nowrap" data-act="panel-pphase" data-id="${pp.id}"><span class="sw" style="--c:${phColor(pp.phaseId)}"></span> ${esc(ppName(pp))}</button>${ppLate(pp)?' <span class="chip c-d">! late</span>':''}`).join('<br>'):'<span class="muted">—</span>'}${!r.now.length&&r.lateP?` <span class="chip c-d">! ${plural(r.lateP,'late phase')}</span>`:''}</td>
    <td>${r.np?`<span class="dia-sw" style="--c:${phColor(r.np.phaseId)}"></span> <button class="plainbtn" data-act="panel-deliv" data-id="${r.np.id}">${esc(r.np.name)}</button> <span class="muted">· ${esc(taskCompletion(r.np))}</span>`:`<span class="muted">${r.ds.length?'Nothing pending with a date':'No deliverables'}</span>`}</td>
    <td class="nowrap">${r.np?`${fmt(r.np.due)}${isOverdue(r.np)?` <span class="chip c-d">! ${rel(r.np.due)}</span>`:` <span class="muted">${rel(r.np.due)}</span>`}`:'—'}</td>
    <td class="num">${r.over?`<span class="chip c-d">! ${r.over}</span>`:'0'}</td>
    <td class="num nowrap">${r.open?`<button class="linkbtn" data-act="project-tasks" data-id="${r.p.id}">${r.open}</button>${r.late?` <span class="od">(${r.late} late)</span>`:''}`:'0'}</td>
    <td class="num">${r.wait?`<span class="chip c-w">◷ ${r.wait}</span>`:'0'}</td></tr>`).join('')}</tbody></table></div>`;
}

