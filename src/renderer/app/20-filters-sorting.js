/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- collapsible filter panels (Overview, Resources, Tasks, Projects) ---------- */
const FOPEN0={overview:false,resources:true,tasks:true,projects:true};
const fOpen=k=>{const o=prefs.fOpen||{};return k in o?!!o[k]:FOPEN0[k]};
function setFOpen(k,v){prefs.fOpen={...(prefs.fOpen||{}),[k]:!!v};savePrefs()}
function filtersToggle(sec,n,clearAct,extra=''){const o=fOpen(sec);
  return `<button class="btn sm ftog${n?' fon':''}" id="ft-${sec}" data-act="f-toggle" data-sec="${sec}" aria-expanded="${o}" aria-controls="fp-${sec}" title="${o?'Hide':'Show'} filters${n?` (${n} active)`:''}">Filters${n?` <span class="fcnt">${n}</span>`:''} <span aria-hidden="true">${o?'▴':'▾'}</span></button>${n?`<button class="btn sm ghost" data-act="${clearAct}">Clear filters</button>`:''}${extra}`}
/* generic comparator helpers: empty values last in both directions */
function cmpVals(x,y,dir){if(x===y)return 0;const ex=x==null||x==='',ey=y==null||y==='';if(ex&&ey)return 0;if(ex)return 1;if(ey)return -1;
  const c=typeof x==='string'&&typeof y==='string'?x.localeCompare(y,undefined,{numeric:true,sensitivity:'base'}):(x<y?-1:x>y?1:0);return dir<0?-c:c}
const natCode=(a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true,sensitivity:'base'});
/* three-state header cycle: first click = default direction, second = reverse, third = off (creation order) */
function cycleSort(cur,k,firstDir=1){cur=cur||{};return cur.k!==k?{k,dir:firstDir}:cur.dir===firstDir?{k,dir:-firstDir}:{k:'',dir:1}}
function sortTh(act,k,label,cur,opts={}){const on=cur&&cur.k===k,d=on?(cur.dir<0?'descending':'ascending'):'none';
  return `<th class="${opts.cls||''}" aria-sort="${d}"><button class="thsort${on?' on':''}" id="${act}-${k}" data-act="${act}" data-k="${k}" title="Sort by ${esc(opts.full||label)}">${label}<span class="sar" aria-hidden="true">${on?(cur.dir<0?'↓':'↑'):'↕'}</span></button>${opts.after||''}</th>`}

/* ---------- Overview: one sort shared by Timeline and Table ---------- */
const OV_SORTS={'':'Creation order',code:'Project number',name:'Project name',due:'Next deadline',pm:'PM',status:'Status',over:'Overdue deliverables',tasks:'Open tasks'};
function ovSortRows(rows){
  const {k,dir}=prefs.sort||{};if(!k||!OV_SORTS[k])return rows.slice().sort((a,b)=>codeSort(a.p,b.p));
  const val=r=>{const p=r.p;switch(k){
    case 'code':return null;case 'name':return p.name.toLowerCase();
    case 'due':{const np=nextPending(delivsOf(p.id));return np?np.due:null}
    case 'pm':return p.pmId?pname(p.pmId).toLowerCase():null;case 'status':return P_STAT.indexOf(p.status);
    case 'over':return -delivsOf(p.id).filter(isOverdue).length;case 'tasks':return -tasksOf(p.id).filter(taskOpen).length}return 0};
  return rows.slice().sort((a,b)=>(k==='code'?(dir<0?-natCode(a.p,b.p):natCode(a.p,b.p)):cmpVals(val(a),val(b),dir))||codeSort(a.p,b.p));
}
function ovSortCtl(){const {k,dir}=prefs.sort||{};
  return `<label class="flabel ovsort">Sort <select class="in" id="ov-sort" aria-label="Sort projects" style="width:auto">${Object.entries(OV_SORTS).map(([v,l])=>`<option value="${v}"${(k||'')===v?' selected':''}>${l}</option>`).join('')}</select></label>${k?`<button class="btn sm ghost" id="ov-sort-dir" data-act="ov-sort-dir" aria-label="Sort direction: ${dir<0?'descending':'ascending'}" title="Reverse the order">${dir<0?'↓':'↑'}</button>`:''}`}

/* ---------- Projects page: filters + header sorting ---------- */
const PF0=()=>({pm:'',status:'',team:'',phase:''});
function projCurPhases(p){const t=todayDN();return ppOf(p.id).filter(pp=>pp.status!=='Not applicable'&&pp.status!=='Completed'&&(pp.status==='In progress'||(ppScheduled(pp)&&iso2dn(pp.start)<=t&&iso2dn(pp.end)>=t)))}
function projDelivered(p){const ds=delivsOf(p.id);return ds.length?ds.filter(d=>d.status==='Delivered').length/ds.length:null}
function renderProjects(){
  const tab=prefs.projTab,q=prefs.projQ.trim().toLowerCase(),F={...PF0(),...(prefs.projF||{})},sort=prefs.projSort&&prefs.projSort.k==='client'?{k:'services',dir:prefs.projSort.dir}:(prefs.projSort||{k:'',dir:1});
  const act=S.projects.filter(p=>!p.archived),arc=S.projects.filter(p=>p.archived);
  let list=(tab==='archived'?arc:act).filter(p=>(!q||p.name.toLowerCase().includes(q)||p.code.toLowerCase().includes(q)||(p.client||'').toLowerCase().includes(q)||svcText(p).toLowerCase().includes(q))
    &&(!F.pm||(F.pm==='__none'?!p.pmId:p.pmId===F.pm))&&(!F.status||p.status===F.status)&&(!F.team||(F.team==='__none'?!p.teamId:p.teamId===F.team))&&(!F.phase||projCurPhases(p).some(pp=>pp.phaseId===F.phase)));
  const val=p=>{switch(sort.k){case 'name':return p.name.toLowerCase();case 'services':return svcText(p).toLowerCase()||null;case 'pm':return p.pmId?pname(p.pmId).toLowerCase():null;
    case 'status':return P_STAT.indexOf(p.status);case 'delivered':return projDelivered(p);case 'tasks':return tasksOf(p.id).filter(taskOpen).length;case 'due':{const np=nextPending(delivsOf(p.id));return np?np.due:null}}return 0};
  list.sort((a,b)=>(sort.k==='code'?(sort.dir<0?-natCode(a,b):natCode(a,b)):sort.k?cmpVals(val(a),val(b),sort.dir):0)||codeSort(a,b));
  const n=[q,F.pm,F.status,F.team,F.phase].filter(Boolean).length,fo=fOpen('projects');
  let h=`<div class="pagehead"><h1>Projects</h1><span class="spacer"></span><button class="btn primary" data-act="new-project">+ New project</button></div>`;
  h+=`<div class="tabs" role="tablist"><button role="tab" data-act="proj-tab" data-v="active" aria-selected="${tab!=='archived'}">Active (${act.length})</button><button role="tab" data-act="proj-tab" data-v="archived" aria-selected="${tab==='archived'}">Archived (${arc.length})</button></div>`;
  h+=`<div class="toolbar tb-meta">${filtersToggle('projects',n,'pf-clear')}${tableMeta('pj',`${plural(list.length,'project')}${sort.k?` · sorted by ${{code:'number',name:'name',services:'services',pm:'PM',status:'status',delivered:'delivered',tasks:'open tasks',due:'next due'}[sort.k]}`:' · creation order'}`,true)}</div>`;
  if(fo){const on=v=>v?' on':'';
    h+=`<div class="filters" id="fp-projects" role="search" aria-label="Project filters"><input class="in q${on(q)}" type="search" id="proj-q" placeholder="Search name, code, client or service" aria-label="Search projects" value="${esc(prefs.projQ)}" autocomplete="off">
      <select class="in${on(F.pm)}" id="pf-pm" data-pf2="pm" aria-label="PM"><option value="">Any PM</option><option value="__none"${F.pm==='__none'?' selected':''}>No PM</option>${peopleOpts(F.pm)}</select>
      <select class="in${on(F.status)}" id="pf-status" data-pf2="status" aria-label="Status"><option value="">Any status</option>${opts(P_STAT,F.status)}</select>
      <select class="in${on(F.team)}" id="pf-team" data-pf2="team" aria-label="Project team"><option value="">Any project team</option>${S.projectTeams.map(t=>`<option value="${t.id}"${t.id===F.team?' selected':''}>${esc(t.name)}</option>`).join('')}<option value="__none"${F.team==='__none'?' selected':''}>No team set</option></select>
      <select class="in${on(F.phase)}" id="pf-phase" data-pf2="phase" aria-label="Current phase"><option value="">Any current phase</option>${S.phases.map(g=>`<option value="${g.id}"${g.id===F.phase?' selected':''}>${esc(g.name)}</option>`).join('')}</select>
      <span class="hint">Current phase = a phase in progress today (by its status or dates).</span></div>`}
  if(!list.length){
    h+=n?`<div class="empty"><h2>No projects match these filters</h2><div class="row"><button class="btn" data-act="pf-clear">Clear filters</button></div></div>`
      :tab==='archived'?`<div class="empty"><h2>No archived projects</h2><p>Archive a finished project to keep it out of the Overview without deleting it.</p></div>`
      :`<div class="empty"><h2>No projects yet</h2><p>Only a name and a code are needed to start.</p><div class="row"><button class="btn primary" data-act="new-project">+ New project</button></div></div>`;
    return h;
  }
  const th=(k,l,o)=>sortTh('psort',k,l,sort,o);
  const projTh=`<th class="c-proj" aria-sort="${sort.k==='code'||sort.k==='name'?(sort.dir<0?'descending':'ascending'):'none'}"><span class="thlab">Project</span> <span class="thpair" role="group" aria-label="Sort projects by"><button class="thsort${sort.k==='code'?' on':''}" id="psort-code" data-act="psort" data-k="code" title="Sort by project number (natural order: AZ-2 before AZ-10)">No.<span class="sar" aria-hidden="true">${sort.k==='code'?(sort.dir<0?'↓':'↑'):'↕'}</span></button><button class="thsort${sort.k==='name'?' on':''}" id="psort-name" data-act="psort" data-k="name" title="Sort by project name">Name<span class="sar" aria-hidden="true">${sort.k==='name'?(sort.dir<0?'↓':'↑'):'↕'}</span></button></span></th>`;
  h+=`<div class="twrap pj-shell" id="pj-shell" style="${projShellStyle()}"><table class="tbl edit pj${projWrapCls()}" id="pj-table"><colgroup>${PJCOLS.map(([k])=>`<col class="pk-${k}">`).join('')}</colgroup><thead><tr>${projTh}${th('services','Services',{cls:'c-svc',full:'services of the project; projects without services last'})}${th('pm','PM',{cls:'c-pm'})}${th('status','Status',{cls:'c-status'})}${th('delivered','Delivered',{cls:'num c-deliv',full:'share of deliverables delivered (delivered ÷ total); projects without deliverables last'})}${th('tasks','Open tasks',{cls:'num c-tasks'})}${th('due','Next due',{cls:'c-due',full:'next pending deliverable date; none last'})}<th class="act c-act"><span class="sr">Actions</span></th></tr></thead><tbody>`;
  list.forEach(p=>{const ds=delivsOf(p.id),np=nextPending(ds),over=ds.filter(isOverdue).length;
    const sel=ui.panel&&ui.panel.type==='project'&&ui.panel.id===p.id,st=svcText(p);
    h+=`<tr data-prow="${p.id}" class="prow${sel?' sel':''}" tabindex="0"${sel?' aria-current="true"':''}><td class="c-proj"><div class="tblname"><button class="plainbtn pcell popen" id="pn-open-${p.id}" data-act="panel-project" data-id="${p.id}" title="Open ${esc(p.code)} in the side panel"><span class="code">${esc(p.code)}</span><span class="pnm">${esc(p.name)}</span></button>${p.example?'<span class="ex">Example</span>':''}</div></td>
      <td class="c-svc"><span class="svc-t" id="ps-${p.id}"${st?` title="${esc(st)}"`:''}>${st?esc(st):'<span class="muted">—</span>'}</span></td>
      <td class="c-pm">${personPicker('pl-'+p.id+'-pm',p.pmId,`data-ent="p" data-id="${p.id}" data-f="pmId" aria-label="PM"`)}</td>
      <td class="c-status"><select id="pl-${p.id}-st" data-ent="p" data-id="${p.id}" data-f="status" aria-label="Status">${opts(P_STAT,p.status)}</select></td>
      <td class="num c-deliv">${ds.filter(d=>d.status==='Delivered').length} / ${ds.length}${over?` <span class="chip c-d">! ${over}</span>`:''}</td>
      <td class="num c-tasks">${taskCountCell(p.id)}</td>
      <td class="c-due">${np?`${fmt(np.due)} <span class="muted">· ${esc(np.name)}</span>`:'<span class="muted">—</span>'}</td>
      <td class="act c-act"><button class="iconbtn rowmore" id="pm-${p.id}" data-act="prow-menu" data-id="${p.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(p.code)} ${esc(p.name)}" title="Actions">⋯</button></td></tr>`});
  return h+`</tbody></table></div><p class="hint" style="margin-top:6px">Delivered sorts by the share of deliverables delivered (delivered ÷ total). Projects without deliverables, services, PM or due date go last in both directions. Click a project to open it in the side panel; ⋯ has more actions.</p>`;
}

/* ---------- Resources: Table settings for the four descriptive columns ---------- */
const RCOLS=[['T','Team',90],['P','Project',200],['H','Phase this week',136],['D','Next delivery',104]];
function resColCfg(){const c=prefs.resCols||{},o={};RCOLS.forEach(([k,,w])=>{const x=c[k]||{};o[k]={w:Number.isFinite(+x.w)&&x.w>=50&&x.w<=480?Math.round(+x.w):w,wrap:x.wrap!==false}});return o}
function resShellStyle(){const c=resColCfg();return RCOLS.map(([k])=>`--w${k}:${c[k].w}px`).join(';')}
function resWrapCls(){const c=resColCfg();return RCOLS.filter(([k])=>!c[k].wrap).map(([k])=>' nw'+k).join('')}
function applyResCols(){const sh=document.getElementById('rs-shell'),t=document.querySelector('.rs');if(sh)sh.setAttribute('style',resShellStyle());if(t){RCOLS.forEach(([k])=>t.classList.remove('nw'+k));resWrapCls().trim().split(/\s+/).filter(Boolean).forEach(c=>t.classList.add(c))}}
let tsFrom=null;
function closeTS(back){const m=document.getElementById('rs-tset');if(!m||m.hidden)return false;m.hidden=true;const b=document.getElementById('rs-tset-btn');if(b)b.setAttribute('aria-expanded','false');if(back&&tsFrom&&document.contains(tsFrom))tsFrom.focus();return true}
function openTS(btn){
  tsFrom=btn;const c=resColCfg();let m=document.getElementById('rs-tset');
  if(!m){m=document.createElement('div');m.id='rs-tset';m.className='cappop tset';m.setAttribute('role','dialog');m.setAttribute('aria-label','Table settings');document.body.appendChild(m)}
  m.innerHTML=`<div class="cp-h"><b>Table settings</b><button type="button" class="iconbtn" data-act="rs-tset-close" aria-label="Close">✕</button></div>
    <p class="hint" style="margin:0 0 4px">Fixed columns. People, collapsed groups and Total keep their compact widths.</p>
    <div class="tsgrid"><span class="tsh">Column</span><span class="tsh">Width (px)</span><span class="tsh">Wrap text</span>
    ${RCOLS.map(([k,l,d])=>`<label for="ts-w-${k}">${l}</label><input class="in" type="number" id="ts-w-${k}" data-tsw="${k}" min="50" max="480" step="2" value="${c[k].w}" aria-label="${l} width in pixels (default ${d})"><label class="chk"><input type="checkbox" id="ts-r-${k}" data-tsr="${k}"${c[k].wrap?' checked':''} aria-label="${l}: wrap text"></label>`).join('')}</div>
    <div class="cp-act"><button type="button" class="btn sm ghost" data-act="rs-tset-reset">Reset defaults</button><span class="spacer"></span><button type="button" class="btn sm primary" data-act="rs-tset-close">Done</button></div>`;
  m.hidden=false;btn.setAttribute('aria-expanded','true');placePop(m,btn);
  m.querySelector('input').focus();
}
function setResCol(k,patch){const c=resColCfg();c[k]={...c[k],...patch};prefs.resCols=c;savePrefs();applyResCols()}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.tsw){const v=+el.value;if(Number.isFinite(v)&&v>=50&&v<=480){el.removeAttribute('aria-invalid');setResCol(el.dataset.tsw,{w:Math.round(v)})}else el.setAttribute('aria-invalid','true')}});
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.tsw){const v=Math.max(50,Math.min(480,Math.round(+el.value||resColCfg()[el.dataset.tsw].w)));el.value=v;el.removeAttribute('aria-invalid');setResCol(el.dataset.tsw,{w:v});return}
  if(el.dataset.tsr){setResCol(el.dataset.tsr,{wrap:el.checked});return}
  if(el.dataset.pf2){prefs.projF={...PF0(),...(prefs.projF||{}),[el.dataset.pf2]:el.value};savePrefs();render();return}
  if(el.id==='ov-sort'){const k=el.value;prefs.sort={k,dir:k==='over'||k==='tasks'?1:1};savePrefs();render();return}
});
document.addEventListener('mousedown',e=>{const m=document.getElementById('rs-tset');if(m&&!m.hidden&&!m.contains(e.target)&&!e.target.closest('#rs-tset-btn'))closeTS()},true);
document.addEventListener('keydown',e=>{const m=document.getElementById('rs-tset');if(e.key==='Escape'&&m&&!m.hidden){e.preventDefault();e.stopImmediatePropagation();closeTS(true)}},true);

