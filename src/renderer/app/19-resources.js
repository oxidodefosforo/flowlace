/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- Resources: planned hours per project, person and week ----------
   Columns come from People, cells from S.assignments (one record per project + person + week).
   Phase and Next delivery are read from the existing project phases and deliverables. */
const RF0=()=>({project:'',pm:'',team:'',phase:'',status:'',discipline:'',person:''});
const fmtH=n=>n==null?'':String(r2(n));
const team=id=>S.projectTeams.find(t=>t.id===id);
const resWeek=()=>{if(!ui.resWeek)ui.resWeek=prefs.resWeek&&isOK(prefs.resWeek)?weekOf(prefs.resWeek):thisWeek();return ui.resWeek};
function setResWeek(w){ui.resWeek=weekOf(w);prefs.resWeek=ui.resWeek;savePrefs()}
function weekLabel(w){const s=iso2dn(w),e=s+6,sd=new Date(s*DAY),ed=new Date(e*DAY),M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `Mon ${sd.getUTCDate()} ${M[sd.getUTCMonth()]} – Sun ${ed.getUTCDate()} ${M[ed.getUTCMonth()]} ${ed.getUTCFullYear()}`}
function isoWeekNo(w){const d=new Date(iso2dn(w)*DAY);d.setUTCDate(d.getUTCDate()+3);const y=new Date(Date.UTC(d.getUTCFullYear(),0,4));return 1+Math.round(((d-y)/864e5-3+((y.getUTCDay()+6)%7))/7)}
function asgFind(pid,peid,w){return S.assignments.find(a=>a.projectId===pid&&a.personId===peid&&a.weekStart===w)}
function setAsg(pid,peid,w,hours,note){
  const a=asgFind(pid,peid,w),now=new Date().toISOString();
  if(hours==null){if(a)S.assignments=S.assignments.filter(x=>x!==a);return null}
  if(a){a.hours=r2(hours);if(note!==undefined)a.note=note;a.updatedAt=now;return a}
  const x={id:uid('as'),projectId:pid,personId:peid,weekStart:w,hours:r2(hours),note:note||'',createdAt:now,updatedAt:now};S.assignments.push(x);return x;
}
const weekAsg=w=>S.assignments.filter(a=>a.weekStart===w);
const loadFor=(peid,w)=>r2(S.assignments.filter(a=>a.personId===peid&&a.weekStart===w).reduce((s,a)=>s+a.hours,0));
const projWeekTotal=(pid,w)=>r2(S.assignments.filter(a=>a.projectId===pid&&a.weekStart===w).reduce((s,a)=>s+a.hours,0));
function capFor(peid,w){const o=S.capacityOverrides.find(x=>x.personId===peid&&x.weekStart===w);const pe=person(peid),def=pe&&pe.capacity!=null?pe.capacity:null;
  return o?{h:o.hours,override:true,def,note:o.note}:{h:def,override:false,def}}
function capStatus(load,cap){
  if(cap==null)return {cls:'none',label:'Capacity not set',short:'—'};
  const d=r2(cap-load);if(d<0)return {cls:'over',label:`Overallocated +${fmtH(-d)} h`,short:`+${fmtH(-d)}`};
  if(d>0)return {cls:'rem',label:`Remaining ${fmtH(d)} h`,short:`${fmtH(d)} left`};return {cls:'full',label:'Fully allocated',short:'Full'}}
function parseHours(s){
  s=String(s).trim().replace(',','.');if(s==='')return {empty:true};
  if(/^-/.test(s))return {err:'Hours can’t be negative.'};
  if(!/^(\d+(\.\d*)?|\.\d+)$/.test(s))return {err:`“${s}” isn’t a number of hours.`};
  const n=+s;if(n>168)return {err:'A week has 168 hours; check this value.'};
  return {v:r2(n)};
}
/* phases and deliverables, read from the planning */
function weekPhases(pid,w){const ws=iso2dn(w),we=ws+6;return ppOf(pid).filter(pp=>ppScheduled(pp)&&pp.status!=='Not applicable'&&iso2dn(pp.start)<=we&&iso2dn(pp.end)>=ws)}
function nextDelivery(pid){const pend=delivsOf(pid).filter(d=>d.status!=='Delivered'),dated=pend.filter(d=>d.due).sort((a,b)=>a.due<b.due?-1:a.due>b.due?1:delivCmp(a,b));return {next:dated[0]||null,pend,dated}}
function phaseCell(p,w){
  const ws=weekPhases(p.id,w);
  if(!ppOf(p.id).some(ppScheduled))return '<span class="muted">Phase dates not set</span>';
  if(!ws.length)return '<span class="muted">No phase this week</span>';
  return ws.map(pp=>`<button class="rph" data-act="panel-pphase" data-id="${pp.id}" title="${esc(ppName(pp))} · ${fmt(pp.start)} – ${fmt(pp.end)} · ${esc(pp.status)}"><span class="sw" style="--c:${phColor(pp.phaseId)}"></span>${esc(ppName(pp))}${ppLate(pp)?' <b class="od">!</b>':''}</button>`).join('');
}
function deliveryCell(p){
  const {next}=nextDelivery(p.id);if(!next)return '<span class="muted">—</span>';
  return `<button class="rdl" data-act="panel-deliv" data-id="${next.id}" title="Open ${esc(next.name)}"><span class="nm">${esc(next.name)}</span><span class="dt">${fmt(next.due)}</span></button>`;
}
/* header indicator: planned hours on ALL projects this week / weekly capacity */
function loadInd(peid,w){
  const pe=person(peid),l=loadFor(peid,w),c=capFor(peid,w),over=c.h!=null&&l>c.h;
  return `<button class="rload${over?' over':''}${c.override?' ovr':''}" id="rl-${peid}" data-act="rs-cap" data-id="${peid}" title="Planned hours this week on all projects / weekly capacity${c.override?' (changed for this week)':''}. Select to change this week’s capacity." aria-label="${esc(pe.name)}: ${fmtH(l)} planned hours of ${c.h!=null?fmtH(c.h)+' hours capacity':'capacity not set'}${over?', overallocated':''}. Change capacity for this week" aria-haspopup="dialog">${over?'<span class="ov-ic" aria-hidden="true">▲</span>':''}${fmtH(l)} / ${c.h!=null?fmtH(c.h):'—'} h${c.override?'<span aria-hidden="true">*</span>':''}</button>`;
}
/* which projects and people are in the meeting */
const projActive=p=>!p.archived&&p.status!=='Completed';
function resBaseProjects(w){const has=new Set(weekAsg(w).map(a=>a.projectId)),R=S.resMeeting;
  return S.projects.filter(p=>projActive(p)||has.has(p.id)||R.added.includes(p.id))}
function resRows(w){
  const f=prefs.resF,R=S.resMeeting;
  return resBaseProjects(w).filter(p=>!R.hidden.includes(p.id)).filter(p=>(!f.project||p.id===f.project)&&(!f.pm||p.pmId===f.pm)&&(!f.team||(f.team==='__none'?!p.teamId:p.teamId===f.team))&&(!f.status||p.status===f.status)&&(!f.phase||weekPhases(p.id,w).some(pp=>pp.phaseId===f.phase))).sort(codeSort).sort(resCmp(w));
}
/* column sorting (Team, Project, Phase, Next delivery, each person, Total). No sort = creation order. Empty values always last. */
const RS_NUM=k=>k==='total'||k.startsWith('p:');
function resCmp(w){
  const S_=prefs.resSort;if(!S_||!S_.k)return ()=>0;const k=S_.k,dir=S_.dir<0?-1:1;
  const tIdx=id=>{const i=S.projectTeams.findIndex(t=>t.id===id);return i<0?null:i};
  const val=p=>{switch(k){case 'team':return tIdx(p.teamId);case 'project':return p.code.toLowerCase();
    case 'phase':{const ps=weekPhases(p.id,w);return ps.length?phIdxId(ps[0].phaseId):null}
    case 'delivery':{const n=nextDelivery(p.id).next;return n?n.due:null}
    case 'total':{const t=projWeekTotal(p.id,w);return weekAsg(w).some(a=>a.projectId===p.id)?t:null}
    default:{const a=asgFind(p.id,k.slice(2),w);return a?a.hours:null}}};
  return (a,b)=>{const x=val(a),y=val(b);if(x===y)return 0;if(x==null)return 1;if(y==null)return -1;
    const c=typeof x==='string'?x.localeCompare(y,undefined,{numeric:true}):x-y;return c*dir};
}
function sortBtn(k,label,full){const S_=prefs.resSort||{},on=S_.k===k,d=on?(S_.dir<0?'descending':'ascending'):'none';
  return `<button class="rsort${on?' on':''}" id="rss-${esc(k.replace(':','-'))}" data-act="rs-sort" data-k="${esc(k)}" aria-label="Sort by ${esc(full||label)}${on?`, currently ${d}`:''}" title="Sort by ${esc(full||label)} (click again to reverse, a third time for creation order)">${label}<span class="sar" aria-hidden="true">${on?(S_.dir<0?'↓':'↑'):'↕'}</span></button>`}
function resPeople(w){
  const f=prefs.resF,has=new Set(weekAsg(w).map(a=>a.personId));
  return peopleSorted().filter(pe=>(pe.active!==false||prefs.resShowInactive)&&(!f.discipline||(pe.disciplineId||'__none')===f.discipline)&&(!f.person||pe.id===f.person));
}
function resGroups(people){
  const gs=S.services.map(s=>({id:s.id,name:s.name,people:people.filter(pe=>pe.disciplineId===s.id)})).filter(g=>g.people.length);
  const none=people.filter(pe=>!pe.disciplineId);if(none.length)gs.push({id:'__none',name:'Unassigned discipline',people:none});
  return gs;
}
const resFilterCount=()=>Object.values(prefs.resF).filter(Boolean).length;

function renderResources(){
  const w=resWeek(),mode=prefs.resMode==='person'?'person':'matrix';
  let h=`<div class="pagehead"><h1>Resources</h1><span class="eyebrow">Planned hours per week</span><span class="spacer"></span><div class="seg" role="group" aria-label="Layout"><button data-act="rs-mode" data-v="matrix" aria-pressed="${mode==='matrix'}">Weekly matrix</button><button data-act="rs-mode" data-v="person" aria-pressed="${mode==='person'}">By person</button></div></div>`;
  h+=`<div class="toolbar rs-week"><button class="btn sm" data-act="rs-week" data-d="-7" aria-label="Previous week">‹ Previous week</button><button class="btn sm" data-act="rs-week" data-d="0"${w===thisWeek()?' aria-current="date"':''}>This week</button><button class="btn sm" data-act="rs-week" data-d="7" aria-label="Next week">Next week ›</button>
    <label class="flabel">Week of <input class="in" type="date" id="rs-pick" value="${w}" aria-label="Choose a week (any day; it snaps to Monday)" style="width:auto"></label>
    <span class="rng"><b>W${isoWeekNo(w)}</b> · ${weekLabel(w)}${w===thisWeek()?' · <span class="chip c-n">This week</span>':''}</span>
    <span class="spacer"></span>${mode==='matrix'?`<button class="btn sm" data-act="rs-copy">Copy from previous week…</button>`:''}
    <button class="btn sm ghost" id="rs-undo" data-act="rs-undo"${ui.resUndo?'':' disabled'} title="${ui.resUndo?esc('Undo: '+ui.resUndo.label):'Nothing to undo'}">↶ Undo${ui.resUndo?`: ${esc(ui.resUndo.short)}`:''}</button>
    <span class="rs-status" id="rs-status" role="status" aria-live="polite">${ui.resStatus||''}</span>
    ${mode==='matrix'?'<button class="btn sm ghost" id="rs-tset-btn" data-act="rs-tset" aria-haspopup="dialog" aria-expanded="false" aria-controls="rs-tset">⚙ Table settings</button>':''}</div>`;
  h+=resFilterBar(w,mode);
  const people=resPeople(w);
  if(mode==='person')return h+resByPerson(people,w);
  return h+resMatrix(w,people);
}
function resFilterBar(w,mode){
  const f=prefs.resF,on=k=>f[k]?' on':'',sel=(k,label,inner)=>`<select class="in${on(k)}" id="rf-${k}" data-rf="${k}" aria-label="${label}"><option value="">${label}</option>${inner}</select>`;
  const o=(list,v)=>list.map(([id,n])=>`<option value="${esc(id)}"${id===v?' selected':''}>${esc(n)}</option>`).join('');
  const R=S.resMeeting,base=resBaseProjects(w),hidden=base.filter(p=>R.hidden.includes(p.id)),shown=new Set(resRows(w).map(p=>p.id));
  const hb=mode==='matrix'&&hidden.length?`<button class="btn sm ghost" data-act="rs-unhide-all" title="Projects hidden with × (their hours were kept)">Show ${plural(hidden.length,'hidden project')}</button>`:'';
  const bar=`<div class="toolbar rs-fbar">${filtersToggle('resources',resFilterCount(),'rs-clear',hb)}</div>`;
  if(!fOpen('resources'))return bar;
  return bar+`<div class="filters" id="fp-resources" role="search" aria-label="Resource filters">
    ${mode==='matrix'?sel('project','All projects',o(S.projects.slice().sort(codeSort).map(p=>[p.id,`${p.code} · ${p.name}`]),f.project)):''}
    ${mode==='matrix'?sel('pm','Any PM',o(peopleSorted().map(p=>[p.id,p.name]),f.pm)):''}
    ${mode==='matrix'?sel('team','Any project team',o([...S.projectTeams.map(t=>[t.id,t.name]),['__none','No team set']],f.team)):''}
    ${mode==='matrix'?sel('phase','Any phase this week',o(S.phases.map(g=>[g.id,g.name]),f.phase)):''}
    ${mode==='matrix'?sel('status','Any project status',o(P_STAT.map(s=>[s,s]),f.status)):''}
    ${sel('discipline','All disciplines',o([...S.services.map(s=>[s.id,s.name]),['__none','Unassigned discipline']],f.discipline))}
    ${sel('person','Everyone',o(peopleSorted().filter(p=>p.active!==false||prefs.resShowInactive).map(p=>[p.id,p.name]),f.person))}
    <label class="chk"><input type="checkbox" id="rs-inactive" data-rpref="resShowInactive"${prefs.resShowInactive?' checked':''}> Show inactive people</label></div>`;
}
function resMatrix(w,people){
  const rows=resRows(w),gs=resGroups(people),col=prefs.resCollapsed||{},map=new Map(weekAsg(w).map(a=>[a.projectId+'|'+a.personId,a]));
  const cols=[];gs.forEach(g=>{if(!col[g.id])g.people.forEach(pe=>cols.push(pe.id))});
  ui.resLayout={w,rows:rows.map(p=>p.id),cols,groups:gs.map(g=>({id:g.id,people:g.people.map(p=>p.id),collapsed:!!col[g.id]}))};
  if(!people.length)return `<div class="empty"><h2>No people to show</h2><p>Add people in Settings → People, or change the discipline and person filters.</p></div>`;
  const cg=`<colgroup><col class="kT"><col class="kP"><col class="kH"><col class="kD">${gs.map(g=>col[g.id]?'<col class="kG">':g.people.map(()=>'<col class="kC">').join('')).join('')}<col class="kTot"></colgroup>`;
  let h=`<div class="rs-shell" id="rs-shell" style="${resShellStyle()}"><div class="rs-wrap" id="rs-wrap"><table class="rs${resWrapCls()}" aria-label="Planned hours, week of ${fmt(w)}">${cg}<thead><tr class="r1">
    ${['team','project','phase','delivery'].map((k,i)=>{const L=['Team','Project','Phase this week','Next delivery'][i],c=['cT','cP','cH','cD'][i],S_=prefs.resSort||{};return `<th class="sl ${c}" rowspan="2" scope="col" aria-sort="${S_.k===k?(S_.dir<0?'descending':'ascending'):'none'}">${sortBtn(k,L)}</th>`}).join('')}`;
  gs.forEach(g=>{const c=!!col[g.id];h+=`<th class="gh${c?' col':''}" colspan="${c?1:g.people.length}" style="width:${c?'var(--rs-gcol)':`calc(${g.people.length} * var(--rs-col))`}" scope="colgroup"><button class="ghb" data-act="rs-group" data-id="${g.id}" aria-expanded="${!c}" title="${c?'Show':'Hide'} the ${esc(g.name)} columns (${plural(g.people.length,'person','people')})" aria-label="${c?'Show':'Hide'} the ${esc(g.name)} columns, ${plural(g.people.length,'person','people')}">${c?'▸':'▾'} ${esc(g.name)} <span class="muted">${g.people.length}</span></button></th>`});
  h+=`<th class="tot" rowspan="2" scope="col" aria-sort="${(prefs.resSort||{}).k==='total'?((prefs.resSort.dir<0)?'descending':'ascending'):'none'}">${sortBtn('total','Total','project total hours')}</th></tr><tr class="r2">`;
  gs.forEach(g=>{if(col[g.id])h+=`<th class="ph col" scope="col" title="${esc(g.name)}: ${plural(g.people.length,'person','people')} (sum of their hours)"><span class="muted">Σ ${g.people.length}</span></th>`;
    else g.people.forEach(pe=>{const c=capFor(pe.id,w);h+=`<th class="ph${pe.active===false?' inact':''}" scope="col" aria-sort="${(prefs.resSort||{}).k==='p:'+pe.id?(prefs.resSort.dir<0?'descending':'ascending'):'none'}" title="${esc(pe.name)}${pe.active===false?' (inactive)':''}">${sortBtn('p:'+pe.id,`<span class="pn" aria-hidden="true">${esc(shortName(pe.name))}</span>`,pe.name+' hours')}<span class="sr">${esc(pe.name)}${pe.active===false?' (inactive)':''}</span>${loadInd(pe.id,w)}</th>`})});
  h+=`</tr></thead><tbody>`;
  if(!rows.length)h+=`<tr><td class="sl cT empty-row" colspan="4"><span class="muted">No projects match these filters.</span></td><td colspan="${cols.length+gs.filter(g=>col[g.id]).length+1}"></td></tr>`;
  rows.forEach((p,ri)=>{const tm=team(p.teamId),sel=ui.panel&&ui.panel.type==='project'&&ui.panel.id===p.id;
    h+=`<tr class="${sel?'sel':''}"><td class="sl cT">${tm?esc(tm.name):'<span class="muted">—</span>'}</td><th class="sl cP" scope="row"><div class="rpc"><button class="plainbtn rpn" data-act="panel-project" data-id="${p.id}" title="Open ${esc(p.code)} · ${esc(p.name)}"><span class="code">${esc(p.code)}</span><span class="nm">${esc(p.name)}</span></button><button class="iconbtn rhide" data-act="rs-hide" data-id="${p.id}" aria-label="Hide ${esc(p.code)} from this view" title="Hide from this view (hours are kept)">×</button></div></th>
      <td class="sl cH">${phaseCell(p,w)}</td><td class="sl cD">${deliveryCell(p)}</td>`;
    let ci=0;
    gs.forEach(g=>{if(col[g.id]){const s=r2(g.people.reduce((t,pe)=>t+(map.get(p.id+'|'+pe.id)?.hours||0),0));h+=`<td class="rg num" id="rg-${p.id}-${g.id}">${s?fmtH(s):''}</td>`;return}
      g.people.forEach(pe=>{const a=map.get(p.id+'|'+pe.id);h+=`<td class="rc${a&&a.note?' hasnote':''}"><input class="rci" id="rc-${p.id}-${pe.id}" data-rp="${p.id}" data-rq="${pe.id}" data-r="${ri}" data-c="${ci}" value="${a?fmtH(a.hours):''}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${esc(pe.name)} on ${esc(p.code)}, planned hours" aria-keyshortcuts="Control+Enter"${a&&a.note?` title="Note: ${esc(a.note)}"`:''}><button type="button" class="rc-add" tabindex="-1" data-act="rs-cell-add" data-pid="${p.id}" data-pe="${pe.id}" title="Add task" aria-label="Add task for ${esc(pe.name)} on ${esc(p.code)}">+</button></td>`;ci++})});
    h+=`<td class="tot num" id="rt-${p.id}">${fmtH(projWeekTotal(p.id,w))||''}</td></tr>`});
  h+=`</tbody></table></div></div>`;
  return h;
}
/* after a cell edit: update totals in place so focus and typing flow aren't interrupted */
function resRefresh(){
  const L=ui.resLayout;if(!L||ui.view!=='resources')return;const w=L.w;
  L.groups.filter(g=>!g.collapsed).forEach(g=>g.people.forEach(peid=>{const b=document.getElementById('rl-'+peid);if(b)b.outerHTML=loadInd(peid,w)}));
  L.rows.forEach(pid=>{const c=document.getElementById('rt-'+pid);if(c)c.textContent=fmtH(projWeekTotal(pid,w))||'';
    L.groups.filter(g=>g.collapsed).forEach(g=>{const x=document.getElementById(`rg-${pid}-${g.id}`);if(x){const s=r2(g.people.reduce((t,pe)=>t+(asgFind(pid,pe,w)?.hours||0),0));x.textContent=s?fmtH(s):''}})});
}
function setResStatus(s,cls){ui.resStatus=`<span class="${cls||''}">${s}</span>`;const el=document.getElementById('rs-status');if(el)el.innerHTML=ui.resStatus}
function resSaved(){save(true);if(storageOK)setResStatus(`Saved ${hhmm(new Date())}`,'ok');else setResStatus('Save failed — export a backup','bad')}
function setResUndo(label,short,items){ui.resUndo={label,short,items};const b=document.getElementById('rs-undo');if(b){b.disabled=false;b.title='Undo: '+label;b.textContent='↶ Undo: '+short}}
/* snapshot of assignment / capacity records by key, so undo restores exactly what was there */
function snapCells(keys){return keys.map(k=>{const [pid,peid,w]=k.split('|');const a=asgFind(pid,peid,w);return {pid,peid,w,before:a?{...a}:null}})}
function restoreCells(items){items.forEach(({pid,peid,w,before})=>{S.assignments=S.assignments.filter(a=>!(a.projectId===pid&&a.personId===peid&&a.weekStart===w));if(before)S.assignments.push({...before})})}
function runResUndo(){const u=ui.resUndo;if(!u)return;ui.resUndo=null;
  if(u.items)restoreCells(u.items);if(u.caps)u.caps.forEach(({peid,w,before})=>{S.capacityOverrides=S.capacityOverrides.filter(c=>!(c.personId===peid&&c.weekStart===w));if(before)S.capacityOverrides.push({...before})});
  setResStatus('Saving…');resSaved();render();toast(`Undone: ${u.label}`)}

function commitCell(el){
  const pid=el.dataset.rp,peid=el.dataset.rq,w=ui.resLayout?ui.resLayout.w:resWeek(),r=parseHours(el.value),a=asgFind(pid,peid,w),prev=a?a.hours:null;
  if(r.err){el.classList.add('bad');el.setAttribute('aria-invalid','true');el.title=r.err;setResStatus(`Not saved: ${esc(r.err)}`,'bad');return false}
  el.classList.remove('bad');el.removeAttribute('aria-invalid');
  const nv=r.empty?null:r.v;if(nv===prev){el.value=fmtH(prev);return true}
  const items=snapCells([`${pid}|${peid}|${w}`]);setResStatus('Saving…');
  setAsg(pid,peid,w,nv);resSaved();el.value=fmtH(nv);
  const p=project(pid),pe=person(peid),lbl=`${shortName(pe.name)} · ${p.code}: ${prev==null?'empty':fmtH(prev)+' h'} → ${nv==null?'empty':fmtH(nv)+' h'}`;
  setResUndo(lbl,`${shortName(pe.name)} ${p.code}`,items);resRefresh();return true;
}
function setWeekCap(peid,raw){
  const w=ui.resLayout?ui.resLayout.w:resWeek(),r=parseHours(raw),pe=person(peid),o=S.capacityOverrides.find(c=>c.personId===peid&&c.weekStart===w);
  if(r.err)return r.err;
  const nv=r.empty?null:r.v,target=nv==null||nv===pe.capacity?null:nv,cur=o?o.hours:null;
  if(cur===target)return '';
  const before=o?{...o}:null;S.capacityOverrides=S.capacityOverrides.filter(c=>c!==o);
  if(target!=null)S.capacityOverrides.push({id:uid('cw'),personId:peid,weekStart:w,hours:target,note:'',updatedAt:new Date().toISOString()});
  const after=S.capacityOverrides.find(c=>c.personId===peid&&c.weekStart===w);
  setResStatus('Saving…');resSaved();ui.resUndo={label:`${pe.name} capacity this week`,short:`${shortName(pe.name)} capacity`,caps:[{peid,w,before}]};
  closeCapPop();ui.focusAfter='rl-'+peid;render();
  toast(after?`${pe.name}: ${fmtH(after.hours)} h this week only (usual ${pe.capacity!=null?fmtH(pe.capacity)+' h':'not set'})`:`${pe.name}: back to the usual capacity (${pe.capacity!=null?fmtH(pe.capacity)+' h':'not set'})`,'',runResUndo);
  return '';
}
let capFrom=null;
function closeCapPop(back){const m=document.getElementById('rs-cappop');if(!m||m.hidden)return false;m.hidden=true;if(back&&capFrom&&document.contains(capFrom))capFrom.focus();return true}
function openCapPop(peid,btn){
  const w=ui.resLayout?ui.resLayout.w:resWeek(),pe=person(peid),c=capFor(peid,w),l=loadFor(peid,w),st=capStatus(l,c.h);capFrom=btn;
  let m=document.getElementById('rs-cappop');if(!m){m=document.createElement('div');m.id='rs-cappop';m.className='cappop';m.setAttribute('role','dialog');document.body.appendChild(m)}
  m.setAttribute('aria-label',`${pe.name}: capacity for the week of ${fmt(w)}`);
  m.innerHTML=`<form data-form="rs-cap" data-id="${peid}" novalidate><div class="cp-h"><b>${esc(pe.name)}</b><button type="button" class="iconbtn" data-act="rs-cap-close" aria-label="Close">✕</button></div>
    <div class="cp-row"><span>Planned this week</span><b class="num">${fmtH(l)} h</b></div><p class="hint" style="margin:-2px 0 4px">All projects, including hidden or filtered ones.</p>
    <div class="cp-row"><span>Usual capacity</span><span class="num">${c.def!=null?fmtH(c.def)+' h':'Not set'}</span></div>
    <label class="cp-in"><span>Capacity for the week of ${fmt(w)}</span><input class="in" name="cap" id="cp-in" value="${c.h!=null?fmtH(c.h):''}" inputmode="decimal" autocomplete="off" placeholder="${c.def!=null?fmtH(c.def):'Not set'}"><em class="err"></em></label>
    <div class="cp-row"><span class="rs-st ${st.cls}">${esc(st.label)}</span></div>
    <div class="cp-act">${c.override?'<button type="button" class="btn sm ghost" data-act="rs-cap-reset">Reset to usual</button>':''}<span class="spacer"></span><button type="button" class="btn sm ghost" data-act="rs-cap-close">Cancel</button><button class="btn sm primary">Save for this week</button></div>
    <p class="hint">Changes this week only (for leave or reduced availability). The usual capacity is set in Settings → People.</p></form>`;
  m.hidden=false;const r=btn.getBoundingClientRect(),mr=m.getBoundingClientRect();
  m.style.left=Math.max(8,Math.min(r.left+r.width/2-mr.width/2,innerWidth-mr.width-8))+'px';
  m.style.top=(r.bottom+6+mr.height>innerHeight-8?Math.max(8,r.top-6-mr.height):r.bottom+6)+'px';
  const i=m.querySelector('#cp-in');i.focus();i.select();
}
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form!=='rs-cap')return;e.preventDefault();e.stopImmediatePropagation();
  const err=setWeekCap(f.dataset.id,f.elements.cap.value);if(err){const i=f.elements.cap;i.setAttribute('aria-invalid','true');f.querySelector('.err').textContent=err;i.focus();return}closeCapPop(true)},true);
document.addEventListener('mousedown',e=>{const m=document.getElementById('rs-cappop');if(m&&!m.hidden&&!m.contains(e.target)&&!e.target.closest('[data-act=rs-cap]'))closeCapPop()},true);
document.addEventListener('keydown',e=>{const m=document.getElementById('rs-cappop');if(e.key==='Escape'&&m&&!m.hidden){e.preventDefault();e.stopImmediatePropagation();closeCapPop(true)}},true);
document.addEventListener('scroll',e=>{const m=document.getElementById('rs-cappop');if(m&&!m.hidden&&!m.contains(e.target))closeCapPop()},true);
function moveCell(el,dr){const r=+el.dataset.r+dr,c=el.dataset.c,n=document.querySelector(`.rci[data-r="${r}"][data-c="${c}"]`);if(n){n.focus();n.select()}}
document.addEventListener('focusin',e=>{const el=e.target;if(el.classList&&el.classList.contains('rci')){el.dataset.orig=el.value;try{el.select()}catch(x){}}});
document.addEventListener('keydown',e=>{
  const el=e.target;if(!el.classList||!el.classList.contains('rci'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();el.value=el.dataset.orig??el.value;el.classList.remove('bad');el.select();return}
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();const b=el.parentElement.querySelector('.rc-add');if(b)rsCellAdd(b);return}
  if(e.key==='Enter'){e.preventDefault();if(commitCell(el))moveCell(el,e.shiftKey?-1:1);return}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(commitCell(el))moveCell(el,e.key==='ArrowDown'?1:-1)}
},true);
document.addEventListener('change',e=>{const el=e.target;if(!el.classList)return;
  if(el.classList.contains('rci')){commitCell(el);return}
  if(el.dataset.rf){prefs.resF[el.dataset.rf]=el.value;savePrefs();render();return}
  if(el.dataset.tm){const t=team(el.dataset.tm),v=el.value.trim();if(!t)return;if(!v){fieldError(el,'A project team needs a name.');return}if(S.projectTeams.some(x=>x.id!==t.id&&x.name.toLowerCase()===v.toLowerCase())){fieldError(el,`${v} already exists.`);return}clearFieldError(el);if(t.name===v)return;t.name=v.slice(0,60);save();render();toast('Project team renamed in every project');return}
  if(el.dataset.rpref){prefs[el.dataset.rpref]=el.checked;savePrefs();render();return}
  if(el.id==='rs-pick'&&el.value){setResWeek(el.value);render();return}
  if(el.dataset.anote){const [pid,peid]=el.dataset.anote.split('|'),w=resWeek(),a=asgFind(pid,peid,w);if(!a)return;const v=el.value.trim().slice(0,500);if(a.note===v)return;a.note=v;a.updatedAt=new Date().toISOString();save();setSaveInd();return}
  if(el.dataset.pf){const pe=person(el.dataset.id);if(!pe)return;const k=el.dataset.pf;
    if(k==='capacity'){const r=parseHours(el.value);if(r.err){fieldError(el,r.err);return}clearFieldError(el);pe.capacity=r.empty?null:r.v;save();setSaveInd();toast(`${pe.name}: usual capacity ${pe.capacity!=null?fmtH(pe.capacity)+' h a week':'not set'}`);return}
    if(k==='active'){pe.active=el.checked;save();render();toast(`${pe.name} is ${pe.active?'active':'inactive'}${pe.active?'':'. Their past hours are kept; Resources hides them unless “Show inactive people” is ticked.'}`);return}
    if(k==='disciplineId'){pe.disciplineId=el.value||null;save();render();return}}
});
/* paste a block from Excel: preview first */
document.addEventListener('paste',e=>{
  const el=e.target;if(!el.classList||!el.classList.contains('rci'))return;
  const txt=(e.clipboardData||window.clipboardData).getData('text/plain')||'';const t=txt.replace(/\r/g,'').replace(/\n+$/,'');
  if(!/[\t\n]/.test(t))return; // a single value pastes normally
  e.preventDefault();openPastePreview(t.split('\n').map(l=>l.split('\t')),+el.dataset.r,+el.dataset.c);
});
function openPastePreview(grid,r0,c0){
  const L=ui.resLayout,w=L.w,cells=[],bad=[],outside=[];let blanks=0;
  grid.forEach((row,i)=>row.forEach((raw,j)=>{const r=r0+i,c=c0+j,v=raw.trim();
    if(r>=L.rows.length||c>=L.cols.length){if(v)outside.push(v);return}
    const pid=L.rows[r],peid=L.cols[c],p=parseHours(v),a=asgFind(pid,peid,w);
    if(p.empty){blanks++;cells.push({pid,peid,blank:true,old:a?a.hours:null});return}
    if(p.err){bad.push({pid,peid,raw:v,err:p.err});return}
    cells.push({pid,peid,v:p.v,old:a?a.hours:null})}));
  const rows=[...new Set(cells.concat(bad).map(x=>x.pid))],cols=[...new Set(cells.concat(bad).map(x=>x.peid))];
  ui.paste={w,cells,bad,outside};
  const cell=(pid,peid)=>{const b=bad.find(x=>x.pid===pid&&x.peid===peid);if(b)return `<td class="pv bad" title="${esc(b.err)}">✕ ${esc(b.raw)}</td>`;
    const x=cells.find(x=>x.pid===pid&&x.peid===peid);if(!x)return '<td></td>';
    if(x.blank)return `<td class="pv blank" data-blank="1">${x.old!=null?`${fmtH(x.old)} <span class="muted">(blank: keep)</span>`:'<span class="muted">blank</span>'}</td>`;
    return `<td class="pv${x.old===x.v?' same':x.old!=null?' chg':' new'}">${x.old!=null&&x.old!==x.v?`<s>${fmtH(x.old)}</s> → `:''}<b>${fmtH(x.v)}</b></td>`};
  const n=cells.filter(x=>!x.blank&&x.old!==x.v).length;
  openModal(`<form data-form="rs-paste" novalidate><div class="m-head"><div><div class="eyebrow">Resources · week of ${fmt(w)}</div><h2>Paste ${plural(cells.length+bad.length,'cell')} from Excel</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <div class="twrap pvwrap"><table class="tbl pvt"><thead><tr><th>Project</th>${cols.map(id=>`<th>${esc(shortName(pname(id)))}</th>`).join('')}</tr></thead><tbody>${rows.map(pid=>`<tr><th>${esc(project(pid).code)} <span class="muted">${esc(project(pid).name)}</span></th>${cols.map(peid=>cell(pid,peid)).join('')}</tr>`).join('')}</tbody></table></div>
    ${bad.length?`<div class="pn-warn" role="alert"><span><b>${plural(bad.length,'cell')} can’t be pasted</b> and will be left unchanged: ${bad.slice(0,6).map(b=>`${esc(project(b.pid).code)} / ${esc(shortName(pname(b.peid)))} “${esc(b.raw)}”`).join(', ')}${bad.length>6?'…':''}. Fix them in Excel and paste again, or apply the valid values.</span></div>`:''}
    ${outside.length?`<div class="pn-warn" role="alert"><span><b>${plural(outside.length,'value')} fall outside the table</b> (more rows or columns than shown) and won’t be pasted. Start the paste further up or left, or show more projects or people.</span></div>`:''}
    ${blanks?`<label class="chk"><input type="checkbox" name="clearBlanks"> Blank cells clear existing hours (${plural(cells.filter(x=>x.blank&&x.old!=null).length,'cell')} would be cleared). Unticked: blanks leave the cell as it is.</label>`:''}
    <p class="hint">${plural(n,'cell')} will change. Values replace what’s in the cell; they are never added together.</p>
    <div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary"${n||blanks?'':' disabled'}>Apply ${bad.length?'valid values':'paste'}</button></div></form>`,{wide:true,focus:'button.primary'});
}
function applyPaste(clearBlanks){
  const P=ui.paste;if(!P)return;const w=P.w,ch=P.cells.filter(x=>x.blank?clearBlanks&&x.old!=null:x.old!==x.v);
  if(!ch.length){closeModal();return}
  const items=snapCells(ch.map(x=>`${x.pid}|${x.peid}|${w}`));ch.forEach(x=>setAsg(x.pid,x.peid,w,x.blank?null:x.v));
  setResStatus('Saving…');resSaved();setResUndo(`paste of ${plural(ch.length,'cell')}`,`paste (${ch.length})`,items);ui.paste=null;closeModal(true);render();
  toast(`${plural(ch.length,'cell')} updated${P.bad.length?` · ${plural(P.bad.length,'invalid cell')} left unchanged`:''}`,'',runResUndo);
}
/* copy last week's hours into this week: preview, keep existing values by default */
function openCopyWeek(){
  const w=resWeek(),pw=dn2iso(iso2dn(w)-7),src=weekAsg(pw);
  if(!src.length){toast(`No hours were planned in the week of ${fmt(pw)}, so there is nothing to copy.`,'err');return}
  const ps=[...new Set(src.map(a=>a.projectId))].map(project).sort(codeSort),pes=[...new Set(src.map(a=>a.personId))].map(person).sort((a,b)=>a.name.localeCompare(b.name));
  ui.copyW={w,pw};
  openModal(`<form data-form="rs-copy" novalidate><div class="m-head"><div><div class="eyebrow">Resources</div><h2>Copy hours from the week of ${fmt(pw)}</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <p class="hint">Into the week of ${fmt(w)}. Nothing changes until you apply. Hours are never added together.</p>
    <div class="cw-grid"><fieldset><legend>Projects</legend>${ps.map(p=>`<label class="chk"><input type="checkbox" name="cp" value="${p.id}" checked> ${esc(p.code)} <span class="muted">${esc(p.name)}</span></label>`).join('')}</fieldset>
    <fieldset><legend>People</legend>${pes.map(pe=>`<label class="chk"><input type="checkbox" name="cq" value="${pe.id}" checked> ${esc(pe.name)}${pe.active===false?' <span class="muted">(inactive)</span>':''}</label>`).join('')}</fieldset></div>
    <fieldset class="cw-mode"><legend>When this week already has a value</legend><label class="chk"><input type="radio" name="mode" value="keep" checked> Keep this week’s value</label><label class="chk"><input type="radio" name="mode" value="replace"> Replace it with last week’s value</label></fieldset>
    <div id="cw-prev">${copyPreview(new Set(ps.map(p=>p.id)),new Set(pes.map(p=>p.id)),'keep')}</div>
    <div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Apply</button></div></form>`,{wide:true});
}
function copyPlan(P,Q,mode){const {w,pw}=ui.copyW;return weekAsg(pw).filter(a=>P.has(a.projectId)&&Q.has(a.personId)).map(a=>{const cur=asgFind(a.projectId,a.personId,w);
  const act=!cur?'copy':cur.hours===a.hours?'same':mode==='replace'?'replace':'keep';return {a,cur,act}}).sort((x,y)=>codeSort(project(x.a.projectId),project(y.a.projectId))||pname(x.a.personId).localeCompare(pname(y.a.personId)))}
function copyPreview(P,Q,mode){
  const plan=copyPlan(P,Q,mode),n=plan.filter(x=>x.act==='copy'||x.act==='replace').length,k=plan.filter(x=>x.act==='keep').length;
  const L={copy:'Copy',same:'Already the same',keep:'Keep this week',replace:'Replace'};
  return `<p><b>${plural(n,'cell')}</b> will be set${k?` · ${plural(k,'existing value')} kept`:''}.</p><div class="twrap pvwrap"><table class="tbl pvt"><thead><tr><th>Project</th><th>Person</th><th>Last week</th><th>This week now</th><th>Result</th></tr></thead><tbody>${plan.map(x=>`<tr class="cw-${x.act}"><td>${esc(project(x.a.projectId).code)}</td><td>${esc(pname(x.a.personId))}</td><td class="num">${fmtH(x.a.hours)} h</td><td class="num">${x.cur?fmtH(x.cur.hours)+' h':'<span class="muted">empty</span>'}</td><td>${L[x.act]}${x.act==='replace'?` → ${fmtH(x.a.hours)} h`:x.act==='keep'?` (${fmtH(x.cur.hours)} h)`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Nothing selected.</td></tr>'}</tbody></table></div>`;
}
function copyFormSets(f){return [new Set([...f.querySelectorAll('[name=cp]:checked')].map(x=>x.value)),new Set([...f.querySelectorAll('[name=cq]:checked')].map(x=>x.value)),f.querySelector('[name=mode]:checked').value]}
document.addEventListener('change',e=>{const f=e.target.closest&&e.target.closest('form[data-form=rs-copy]');if(!f)return;const [P,Q,m]=copyFormSets(f);document.getElementById('cw-prev').innerHTML=copyPreview(P,Q,m)});
function applyCopy(f){const [P,Q,m]=copyFormSets(f),{w}=ui.copyW,plan=copyPlan(P,Q,m).filter(x=>x.act==='copy'||x.act==='replace');
  if(!plan.length){closeModal();toast('Nothing to copy with these choices.');return}
  const items=snapCells(plan.map(x=>`${x.a.projectId}|${x.a.personId}|${w}`));plan.forEach(x=>setAsg(x.a.projectId,x.a.personId,w,x.a.hours,x.cur?undefined:x.a.note));
  setResStatus('Saving…');resSaved();setResUndo(`copy of ${plural(plan.length,'cell')} from the previous week`,`copy (${plan.length})`,items);closeModal(true);render();
  toast(`${plural(plan.length,'cell')} copied from the week of ${fmt(ui.copyW.pw)}`,'',runResUndo)}
/* By person: same records, grouped per person */
function resByPerson(people,w){
  const gs=resGroups(people);if(!gs.length)return `<div class="empty"><h2>No people to show</h2><p>Change the filters, or add people in Settings → People.</p></div>`;
  return `<p class="hint" style="margin-bottom:8px">Every project a person is planned on this week, including projects hidden from the matrix. Edit hours in the weekly matrix.</p>`+gs.map(g=>`<section class="rbp-g"><h2 class="rbp-h">${esc(g.name)}</h2><div class="rbp">${g.people.map(pe=>{
    const as=weekAsg(w).filter(a=>a.personId===pe.id).sort((a,b)=>codeSort(project(a.projectId),project(b.projectId))),load=loadFor(pe.id,w),c=capFor(pe.id,w),st=capStatus(load,c.h);
    return `<article class="rbp-c${pe.active===false?' inact':''}"><div class="rbp-t"><span class="av">${initials(pe.name)}</span><div><b>${esc(pe.name)}</b>${pe.active===false?' <span class="chip c-n">Inactive</span>':''}<div class="muted">${c.h!=null?`Capacity ${fmtH(c.h)} h${c.override?' this week':''}`:'Capacity not set'}</div></div><span class="spacer"></span><div class="rbp-load"><b class="num">${fmtH(load)} h</b><span class="rs-st ${st.cls}">${st.label}</span></div></div>
      ${c.h?`<div class="rbar" role="img" aria-label="${fmtH(load)} of ${fmtH(c.h)} hours"><i class="${st.cls}" style="width:${Math.min(100,load/c.h*100)}%"></i></div>`:''}
      ${as.length?`<ul class="mini-list">${as.map(a=>{const p=project(a.projectId),hid=S.resMeeting.hidden.includes(p.id);return `<li><button class="plainbtn grow" data-act="panel-project" data-id="${p.id}"><span class="mono">${esc(p.code)}</span> ${esc(p.name)}</button>${hid?'<span class="chip c-n">Hidden in matrix</span>':''}<span class="meta">${weekPhases(p.id,w).map(pp=>esc(ppName(pp))).join(', ')}</span>${a.note?`<span class="meta" title="${esc(a.note)}">✎</span>`:''}<span class="num"><b>${fmtH(a.hours)} h</b></span></li>`}).join('')}</ul>`:'<p class="muted">No hours planned this week.</p>'}</article>`}).join('')}</div></section>`).join('');
}
/* project page / panel: compact Resources section for the selected week */
function projResourcesHTML(p,inPanel){
  const w=resWeek(),as=weekAsg(w).filter(a=>a.projectId===p.id).sort((a,b)=>pname(a.personId).localeCompare(pname(b.personId))),tot=projWeekTotal(p.id,w);
  return `<section class="${inPanel?'pn-sec':'card-sec'} prs"><div class="${inPanel?'pn-sec-h':'h'}"><h3>Resources</h3><span class="prs-w"><button class="iconbtn" data-act="rs-week" data-d="-7" aria-label="Previous week">‹</button><span class="num">W${isoWeekNo(w)} · ${fmt(w)}</span><button class="iconbtn" data-act="rs-week" data-d="7" aria-label="Next week">›</button>${w!==thisWeek()?'<button class="linkbtn" data-act="rs-week" data-d="0">This week</button>':''}</span></div>
    ${as.length?`<ul class="mini-list">${as.map(a=>{const pe=person(a.personId),sn=S.services.find(s=>s.id===pe.disciplineId);return `<li><span class="grow">${esc(pe.name)}${sn?` <span class="meta">${esc(sn.name)}</span>`:''}</span>${inPanel?`<input class="in prs-note" id="an-${a.id}" data-anote="${p.id}|${pe.id}" value="${esc(a.note)}" placeholder="Note" maxlength="500" aria-label="Note for ${esc(pe.name)}">`:a.note?`<span class="meta" title="${esc(a.note)}">${esc(a.note.slice(0,40))}</span>`:''}<span class="num"><b>${fmtH(a.hours)} h</b></span></li>`}).join('')}<li class="prs-tot"><span class="grow"><b>Total planned</b></span><span class="num"><b>${fmtH(tot)} h</b></span></li></ul>`:`<p class="muted">No hours planned for this week.</p>`}
    <div class="row"><button class="btn sm" data-act="rs-open-project" data-id="${p.id}">Open in Resources</button><span class="hint">Planned hours, not task estimates.</span></div></section>`;
}

