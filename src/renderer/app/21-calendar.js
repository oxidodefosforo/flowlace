/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- Calendar (Overview deliverables, Tasks): day-based events, weeks start on Monday ----------
   Dates are day numbers (iso2dn / dn2iso, UTC-based), so no time-zone shifts. Separate state per key:
   'overview', 'tasks' (global) and 'p:<projectId>' (a project's Tasks tab). */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function calState(key){const c=(prefs.cal||{})[key]||{};return {mode:c.mode==='week'?'week':'month',date:isoOK(c.date)?c.date:dn2iso(todayDN())}}
function setCal(key,patch){prefs.cal={...(prefs.cal||{}),[key]:{...calState(key),...patch}};savePrefs()}
const calYmd=iso=>iso.split('-').map(Number);
const firstOfMonth=(y,m)=>iso2dn(`${y}-${String(m).padStart(2,'0')}-01`);
function calRange(st){
  const d=iso2dn(st.date);
  if(st.mode==='week'){const s=d-dowMon(d),e=s+6,a=calYmd(dn2iso(s)),b=calYmd(dn2iso(e));
    const t=a[1]===b[1]?`${a[2]} – ${b[2]} ${MON[b[1]-1]} ${b[0]}`:a[0]===b[0]?`${a[2]} ${MON[a[1]-1]} – ${b[2]} ${MON[b[1]-1]} ${b[0]}`:`${a[2]} ${MON[a[1]-1]} ${a[0]} – ${b[2]} ${MON[b[1]-1]} ${b[0]}`;
    return {s,e,gs:s,ge:e,title:`Week ${isoWeekNo(dn2iso(s))} · ${t}`,cur:null}}
  const [y,m]=calYmd(st.date),f=firstOfMonth(y,m),n=m===12?firstOfMonth(y+1,1):firstOfMonth(y,m+1),l=n-1;
  return {s:f,e:l,gs:f-dowMon(f),ge:l+(6-dowMon(l)),title:`${MONTHS[m-1]} ${y}`,cur:m};
}
function calShift(key,dir){const st=calState(key);
  if(st.mode==='week'){setCal(key,{date:dn2iso(iso2dn(st.date)+7*dir)});return}
  let [y,m]=calYmd(st.date);m+=dir;if(m<1){m=12;y--}if(m>12){m=1;y++}setCal(key,{date:`${y}-${String(m).padStart(2,'0')}-01`});
}
function calNav(key,label){const st=calState(key),r=calRange(st);
  return `<div class="calbar" role="group" aria-label="${esc(label)} calendar"><div class="seg" role="group" aria-label="Calendar range"><button data-act="cal-mode" data-key="${key}" data-v="week" aria-pressed="${st.mode==='week'}">Weekly</button><button data-act="cal-mode" data-key="${key}" data-v="month" aria-pressed="${st.mode==='month'}">Monthly</button></div>
    <button class="btn sm" id="cal-prev-${key.replace(':','-')}" data-act="cal-nav" data-key="${key}" data-d="-1" aria-label="Previous ${st.mode}">‹</button><button class="btn sm" data-act="cal-today" data-key="${key}">Today</button><button class="btn sm" id="cal-next-${key.replace(':','-')}" data-act="cal-nav" data-key="${key}" data-d="1" aria-label="Next ${st.mode}">›</button>
    <h2 class="caltitle" id="cal-title-${key.replace(':','-')}" aria-live="polite">${esc(r.title)}</h2></div>`}
/* events: [{date:'YYYY-MM-DD', html}] already in the wanted order for a day (stable) */
function calGrid(key,events){
  const st=calState(key),r=calRange(st),t=todayDN(),by=new Map(),LIM=st.mode==='week'?8:3;
  events.forEach(e=>{const d=iso2dn(e.date);if(d<r.gs||d>r.ge)return;if(!by.has(d))by.set(d,[]);by.get(d).push(e)});
  ui.calDays=ui.calDays||{};ui.calDays[key]=by;
  let h=`<div class="cal ${st.mode}" role="grid" aria-label="${esc(r.title)}"><div class="cal-hd" role="row">${DOW.map((d,i)=>`<div role="columnheader" class="${i>4?'we':''}">${d}</div>`).join('')}</div><div class="cal-body">`;
  for(let w=r.gs;w<=r.ge;w+=7){h+=`<div class="cal-wk" role="row">`;
    for(let d=w;d<w+7;d++){const iso=dn2iso(d),[y,m,dd]=calYmd(iso),evs=by.get(d)||[],out=st.mode==='month'&&m!==r.cur,more=evs.length-LIM;
      h+=`<div class="cal-day${out?' out':''}${d===t?' today':''}${dowMon(d)>4?' we':''}" role="gridcell" data-d="${iso}" aria-label="${DOW[dowMon(d)]} ${dd} ${MON[m-1]} ${y}: ${plural(evs.length,'item')}"><div class="cal-dn">${st.mode==='week'?`${DOW[dowMon(d)]} `:''}<b>${dd}</b>${dd===1||st.mode==='week'?` ${MON[m-1]}`:''}${d===t?' <span class="tday">Today</span>':''}</div>
        ${evs.slice(0,more>0?LIM-1:LIM).map(e=>e.html).join('')}${more>0?`<button class="cal-more" data-act="cal-more" data-key="${key}" data-d="${iso}" aria-haspopup="dialog">+ ${more+1} more</button>`:''}</div>`}
    h+='</div>'}
  return h+'</div></div>';
}
function calUndated(title,items,emptyMsg){
  return `<section class="cal-nd" aria-label="${esc(title)}"><h3>${esc(title)} <span class="muted">${items.length}</span></h3>${items.length?`<div class="cal-nd-list">${items.join('')}</div>`:`<p class="hint">${esc(emptyMsg)}</p>`}</section>`}
/* compact project summary: number + full name, status, PM, next delivery and days left */
function projStrip(p){const np=nextPending(delivsOf(p.id));
  return `<div class="pstrip"><button class="plainbtn pstrip-n" data-act="open-project" data-id="${p.id}"><span class="mono">${esc(p.code)}</span> <b>${esc(p.name)}</b></button>${pChip(p.status)}<span><span class="k">PM</span> ${p.pmId?esc(pname(p.pmId)):'<span class="muted">Not set</span>'}</span><span class="pstrip-next"><span class="k">Next</span> ${np?`<button class="plainbtn" data-act="panel-deliv" data-id="${np.id}">${esc(np.name)}</button> · ${fmt(np.due)} · ${rowSub(p)}`:'<span class="muted">No upcoming deadline</span>'}</span></div>`}
/* event chips */
function delivEvent(d){const p=project(d.projectId),o=isOverdue(d),done=d.status==='Delivered';
  return `<button class="cev${o?' over':''}${done?' done':''}" data-act="panel-deliv" data-id="${d.id}" style="--c:${phColor(d.phaseId)}" aria-label="${esc(p.code)} ${esc(p.name)}: ${esc(d.name)}, due ${fmt(d.due)}${o?', overdue':''}${done?', delivered':''}"><span class="cev-p"><span class="mono">${esc(p.code)}</span> ${esc(p.name)}</span><span class="cev-t">${o?'<i class="cev-ov" aria-hidden="true">!</i>':''}${done?'<i aria-hidden="true">✓ </i>':''}${esc(d.name)}</span></button>`}
function taskEvent(t,single){const p=project(t.projectId),o=isTaskOverdue(t),ph=taskPhaseId(t);
  return `<button class="cev tev${o?' over':''}${t.status==='Done'?' done':''}" data-act="panel-task" data-id="${t.id}" style="--c:${ph?phColor(ph):'var(--line-2)'}" aria-label="${single?'':`${esc(p.code)} ${esc(p.name)}: `}${esc(t.name)}${t.due?`, due ${fmt(t.due)}`:''}, ${esc(t.assignedToId?pname(t.assignedToId):'unassigned')}, ${esc(t.status)}${o?', overdue':''}">${single?'':`<span class="cev-p"><span class="mono">${esc(p.code)}</span> ${esc(p.name)}</span>`}<span class="cev-t">${o?'<i class="cev-ov" aria-hidden="true">!</i>':''}${esc(t.name)}</span><span class="cev-s">${esc(t.assignedToId?shortName(pname(t.assignedToId)):'Unassigned')} · ${TGLYPH[t.status]} ${esc(t.status)}</span></button>`}
/* Overview calendar: deliverables of the filtered projects; sort decides order inside a day */
function overviewCalendar(rows){
  const sorted=ovSortRows(rows),ev=[],nd=[];
  sorted.forEach(r=>sortDelivs(r.ds).forEach(d=>{if(d.due)ev.push({date:d.due,html:delivEvent(d)});else nd.push(delivEvent(d))}));
  let h=calNav('overview','Deliverables');
  if(sorted.length===1)h+=projStrip(sorted[0].p);
  return h+calGrid('overview',ev)+calUndated('Deliverables without a due date',nd,'Every deliverable shown has a due date.');
}
/* Tasks calendar: tasks of the active view (its filters and sort) */
function tasksCalendar(list,c){
  const key=c.pid?'p:'+c.pid:'tasks',pr=simpleRule(c.cfg,'project'),single=!!c.pid||(pr&&pr.op==='is'&&project(pr.value)&&!allRules(c.cfg).some(r=>r.field==='project'&&r!==pr));
  let h=calNav(key,'Tasks');
  if(!c.pid&&single)h+=projStrip(project(pr.value));
  const ev=[],nd=[];list.forEach(t=>{if(t.due)ev.push({date:t.due,html:taskEvent(t,single)});else nd.push(taskEvent(t,single))});
  return h+calGrid(key,ev)+calUndated('No due date',nd,'Every task in this view has a due date.');
}
/* "+ N more": list every item of that day in a popover */
let calFrom=null;
function closeCalPop(back){const m=document.getElementById('cal-pop');if(!m||m.hidden)return false;m.hidden=true;if(back&&calFrom&&document.contains(calFrom))calFrom.focus();return true}
function openCalPop(btn){
  calFrom=btn;const key=btn.dataset.key,iso=btn.dataset.d,evs=(ui.calDays&&ui.calDays[key]&&ui.calDays[key].get(iso2dn(iso)))||[],[y,m,d]=calYmd(iso);
  let p=document.getElementById('cal-pop');if(!p){p=document.createElement('div');p.id='cal-pop';p.className='cappop calpop';p.setAttribute('role','dialog');document.body.appendChild(p)}
  p.setAttribute('aria-label',`All items on ${d} ${MON[m-1]} ${y}`);
  p.innerHTML=`<div class="cp-h"><b>${DOW[dowMon(iso2dn(iso))]} ${d} ${MONTHS[m-1]} ${y}</b><button type="button" class="iconbtn" data-act="cal-pop-close" aria-label="Close">✕</button></div><div class="calpop-list">${evs.map(e=>e.html).join('')}</div>`;
  p.hidden=false;const r=btn.getBoundingClientRect(),pr=p.getBoundingClientRect();
  p.style.left=Math.max(8,Math.min(r.left,innerWidth-pr.width-8))+'px';p.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-pr.height-8))+'px';
  const f=p.querySelector('.cev');f&&f.focus();
}
document.addEventListener('mousedown',e=>{const m=document.getElementById('cal-pop');if(m&&!m.hidden&&!m.contains(e.target)&&!e.target.closest('[data-act=cal-more]'))closeCalPop()},true);
document.addEventListener('keydown',e=>{const m=document.getElementById('cal-pop');if(e.key==='Escape'&&m&&!m.hidden){e.preventDefault();e.stopImmediatePropagation();closeCalPop(true)}},true);

