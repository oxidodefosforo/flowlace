/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- v15: project services, Projects row menu (⋯), project side panel, Resources cell “+” ---------- */
/* Services of a project = several ids of the disciplines catalogue (S.services), kept in catalogue order.
   Separate from each task's discipline (t.serviceId) and each person's primary discipline. */
function svcIds(p){const ids=new Set((p&&p.serviceIds)||[]);return S.services.filter(s=>ids.has(s.id)).map(s=>s.id)}
function svcNames(ids){const set=new Set(ids||[]);return S.services.filter(s=>set.has(s.id)).map(s=>s.name)}
function svcText(p){return svcNames((p&&p.serviceIds)||[]).join(', ')}
function svcPicker(id,sel,o={}){
  const ids=new Set(sel||[]),txt=svcNames(sel).join(', ');
  return `<div class="svc-dd" id="${id}"><button type="button" class="in svc-btn" id="${id}-b" data-act="svc-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="${id}-l"${o.labelledby?` aria-labelledby="${o.labelledby} ${id}-b"`:' aria-label="Services"'}><span class="svc-v"${txt?` title="${esc(txt)}"`:''}>${txt?esc(txt):'—'}</span><span class="svc-c" aria-hidden="true">▾</span></button>
    ${o.form?`<input type="hidden" name="serviceIds" value="${[...ids].join(',')}">`:''}
    <div class="svc-list" id="${id}-l" role="group" aria-label="Services" hidden>${S.services.length?S.services.map(s=>`<label class="chk"><input type="checkbox" value="${s.id}" ${o.form?'data-svcf="1"':`data-svcp="${o.pid}"`}${ids.has(s.id)?' checked':''}><span>${esc(s.name)}</span></label>`).join(''):'<p class="hint">No disciplines yet. Add them in Settings → Disciplines.</p>'}
    <p class="hint svc-h">Choose any number. Esc or click outside to close.</p></div></div>`}
function svcFormVal(form){const h=form&&form.querySelector('input[name=serviceIds]');if(!h)return [];const set=new Set(h.value.split(',').filter(Boolean));return S.services.filter(s=>set.has(s.id)).map(s=>s.id)}
function svcClose(dd,back){if(!dd)return;const l=dd.querySelector('.svc-list'),b=dd.querySelector('.svc-btn');if(l&&!l.hidden){l.hidden=true;b&&b.setAttribute('aria-expanded','false');if(back&&b)b.focus()}}
function svcToggle(btn){const dd=btn.closest('.svc-dd'),l=dd.querySelector('.svc-list'),open=l.hidden;
  document.querySelectorAll('.svc-dd').forEach(x=>{if(x!==dd)svcClose(x)});
  l.hidden=!open;btn.setAttribute('aria-expanded',String(open));if(open){const c=l.querySelector('input');c&&c.focus()}}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset||!(el.dataset.svcf||el.dataset.svcp))return;
  const dd=el.closest('.svc-dd'),vals=[...dd.querySelectorAll('.svc-list input:checked')].map(x=>x.value),ids=S.services.filter(s=>vals.includes(s.id)).map(s=>s.id),txt=svcNames(ids).join(', ');
  const v=dd.querySelector('.svc-v');v.textContent=txt||'—';if(txt)v.title=txt;else v.removeAttribute('title');
  if(el.dataset.svcf){const h=dd.querySelector('input[name=serviceIds]');if(h)h.value=ids.join(',');return}
  const p=project(el.dataset.svcp);if(!p)return;p.serviceIds=ids;save(true);setSaveInd();
  const c=document.getElementById('ps-'+p.id);if(c){c.innerHTML=txt?esc(txt):'<span class="muted">—</span>';if(txt)c.title=txt;else c.removeAttribute('title')}
  const hs=document.querySelector('.phd-svc');if(hs&&ui.view==='project'&&ui.pid===p.id)hs.innerHTML=`<span class="k">Services</span> ${esc(txt)}`;
  const sv=document.getElementById('pp-sum-svc');if(sv)sv.innerHTML=txt?esc(txt):'<span class="muted">—</span>';
},true);
document.addEventListener('mousedown',e=>{document.querySelectorAll('.svc-dd').forEach(dd=>{if(!dd.contains(e.target))svcClose(dd)})},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const dd=e.target.closest&&e.target.closest('.svc-dd');if(dd&&!dd.querySelector('.svc-list').hidden){e.preventDefault();e.stopImmediatePropagation();svcClose(dd,true)}},true);

/* ---------- Projects list: one ⋯ button per row, actions in a floating menu ---------- */
let rmFrom=null,rmAt=0;
function rowMenuItems(p){return p.archived?[['panel-project','Open'],['panel-project-details','Details'],['restore-project','Restore'],['delete-project','Delete…','danger-t']]
  :[['panel-project','Open'],['panel-project-details','Details'],['dup-project','Duplicate…'],['archive-project','Archive']]}
function closeRowMenu(back){const m=document.getElementById('rowmenu');if(!m||m.hidden)return false;m.hidden=true;
  const b=rmFrom&&document.getElementById(rmFrom);if(b){b.setAttribute('aria-expanded','false');if(back)b.focus()}return true}
function openRowMenu(btn){
  const p=project(btn.dataset.id);if(!p)return;let m=document.getElementById('rowmenu');
  if(m&&!m.hidden&&rmFrom===btn.id){closeRowMenu(true);return}closeRowMenu();
  if(!m){m=document.createElement('div');m.id='rowmenu';m.className='menu rowmenu';m.setAttribute('role','menu');document.body.appendChild(m)}
  rmFrom=btn.id;m.setAttribute('aria-label',`Actions for ${p.code}`);
  m.innerHTML=rowMenuItems(p).map(([act,l,c])=>`<button role="menuitem" tabindex="-1" class="${c||''}" data-act="${act}" data-id="${p.id}">${l}</button>`).join('');
  m.hidden=false;rmAt=Date.now();btn.setAttribute('aria-expanded','true');
  const r=btn.getBoundingClientRect(),mr=m.getBoundingClientRect();
  m.style.left=Math.max(8,Math.min(r.right-mr.width,innerWidth-mr.width-8))+'px';
  m.style.top=(r.bottom+4+mr.height>innerHeight-8?Math.max(8,r.top-4-mr.height):r.bottom+4)+'px';
  m.querySelector('button').focus();
}
document.addEventListener('click',e=>{const it=e.target.closest&&e.target.closest('#rowmenu [data-act]');if(!it)return;
  const b=rmFrom&&document.getElementById(rmFrom);if(b&&!ui.panel)b.focus({preventScroll:true});closeRowMenu()},true);
document.addEventListener('mousedown',e=>{const m=document.getElementById('rowmenu');if(m&&!m.hidden&&!m.contains(e.target)&&!(e.target.closest&&e.target.closest('[data-act=prow-menu]')))closeRowMenu()},true);
document.addEventListener('keydown',e=>{const m=document.getElementById('rowmenu');if(!m||m.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeRowMenu(true);return}
  if(!m.contains(document.activeElement))return;const bs=[...m.querySelectorAll('button')],i=bs.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();bs[(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length].focus()}
  else if(e.key==='Home'||e.key==='End'){e.preventDefault();bs[e.key==='Home'?0:bs.length-1].focus()}
  else if(e.key==='Tab'){e.preventDefault();closeRowMenu(true)}},true);
document.addEventListener('scroll',e=>{const m=document.getElementById('rowmenu');if(m&&!m.hidden&&!m.contains(e.target)&&Date.now()-rmAt>300)closeRowMenu()},true);

/* ---------- project side panel: main information first, then sections, then editable details ---------- */
function projPanelDetails(id){
  const P=ui.panel;if(!P||P.type!=='project'||P.id!==id)openPanel('project',id,{keepFocus:true});
  const d=document.getElementById('pp-details'),b=document.getElementById('pn-body');
  if(d&&b){b.scrollTop=Math.max(0,d.offsetTop-b.offsetTop-6);const n=document.getElementById('pp-name');n&&n.focus({preventScroll:true})}
}
function panelProject(p){
  const ds=delivsOf(p.id),up=ds.filter(d=>d.due&&d.status!=='Delivered').sort((a,b)=>a.due<b.due?-1:1).slice(0,5),ts=tasksOf(p.id),open=ts.filter(taskOpen),np=nextPending(ds),tm=team(p.teamId),st=svcText(p);
  const att=sortTasks(open.filter(x=>isTaskOverdue(x)||x.status==='Waiting information')).slice(0,5),late=open.filter(isTaskOverdue).length,dl=ds.filter(d=>d.status==='Delivered').length,od=ds.filter(isOverdue).length;
  return `<section class="pp-sum" aria-label="Project summary">
    <div class="pp-meta">${pChip(p.status)}<span><span class="k">PM</span> ${p.pmId?`<b>${esc(pname(p.pmId))}</b>`:'<span class="muted">Not set</span>'}</span>${p.client?`<span><span class="k">Client</span> ${esc(p.client)}</span>`:''}${tm?`<span><span class="k">Team</span> ${esc(tm.name)}</span>`:''}</div>
    <div class="pp-line"><span class="k">Services</span> <span id="pp-sum-svc">${st?esc(st):'<span class="muted">—</span>'}</span></div>
    <div class="pp-line"><span class="k">Next delivery</span> ${np?`<button class="plainbtn" data-act="panel-deliv" data-id="${np.id}" data-push="1"><b>${esc(np.name)}</b></button> · ${fmt(np.due)} · ${rowSub(p)}`:'<span class="muted">No upcoming deadline</span>'}</div>
    <div class="pp-line pp-counts"><span>${dl} / ${plural(ds.length,'deliverable')} delivered${od?` · <span class="od">! ${od} overdue</span>`:''}</span><span>${plural(open.length,'open task')}${late?` · <span class="od">${late} late</span>`:''}</span></div>
    <div class="pp-acts"><button class="btn primary sm" data-act="open-full" data-id="${p.id}" title="Open the full project page">Open full project ↗</button><button class="btn sm" data-act="open-full" data-id="${p.id}" data-tab="phases">Phases</button><button class="btn sm" data-act="open-full" data-id="${p.id}" data-tab="deliverables">Deliverables</button><button class="btn sm" data-act="open-full" data-id="${p.id}" data-tab="tasks">Tasks</button><button class="btn sm ghost" data-act="pp-goto-details" data-id="${p.id}">Edit details ↓</button></div>
  </section>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Upcoming deliverables</h3>${ds.length>5?`<button class="linkbtn" data-act="rs-delivs" data-id="${p.id}">All ${plural(ds.filter(d=>d.status!=='Delivered').length,'pending deliverable')}</button>`:`<span class="muted">${plural(ds.length,'deliverable')} in total</span>`}</div>
    ${up.length?`<ul class="mini-list">${up.map(d=>`<li><span class="dia-sw" style="--c:${phColor(d.phaseId)}"></span><button class="plainbtn grow" data-act="panel-deliv" data-id="${d.id}" data-push="1">${esc(d.name)}</button><span class="num">${fmt(d.due)}</span>${dlStatusChip(d)}<span class="meta">Task completion: ${taskCompletion(d)}</span></li>`).join('')}</ul>`:'<p class="muted">Nothing pending with a due date.</p>'}</section>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Tasks</h3><span class="tcomp"><span>${open.length} open</span><span class="${late?'od':''}">${late} overdue</span><span>${open.filter(x=>x.status==='Waiting information').length} waiting</span></span></div>
    ${att.length?`<ul class="mini-list">${att.map(x=>`<li><span>${TGLYPH[x.status]}</span><button class="plainbtn grow" data-act="panel-task" data-id="${x.id}" data-push="1">${esc(x.name)}</button><span class="meta">${esc(x.assignedToId?shortName(pname(x.assignedToId)):'Unassigned')}</span>${x.due?`<span class="${isTaskOverdue(x)?'od':'meta'}">${isTaskOverdue(x)?'! ':''}${fmt(x.due)}</span>`:''}</li>`).join('')}</ul>`:`<p class="muted">${open.length?'Nothing overdue or waiting for information.':'No open tasks.'}</p>`}</section>
  ${projResourcesHTML(p,true)}
  <section class="pn-sec" id="pp-details" aria-labelledby="pp-details-h"><div class="pn-sec-h"><h3 id="pp-details-h">Details</h3><span class="muted">Changes save as you go</span></div>
  <div class="fgrid">
    ${fld('Project name',`<input class="in" id="pp-name" data-ent="p" data-id="${p.id}" data-f="name" value="${esc(p.name)}" maxlength="120">`,{span:1})}
    ${fld('Code',`<input class="in mono" id="pp-code" data-ent="p" data-id="${p.id}" data-f="code" value="${esc(p.code)}" maxlength="30">`)}
    ${fld('Status',`<select class="in" id="pp-status" data-ent="p" data-id="${p.id}" data-f="status">${opts(P_STAT,p.status)}</select>`)}
    ${fld('Project team <i>optional</i>',`<select class="in" id="pp-team" data-ent="p" data-id="${p.id}" data-f="teamId"><option value="">Not set</option>${S.projectTeams.map(t=>`<option value="${t.id}"${t.id===p.teamId?' selected':''}>${esc(t.name)}</option>`).join('')}</select>`)}
    ${fld('Client <i>optional</i>',`<input class="in" id="pp-client" data-ent="p" data-id="${p.id}" data-f="client" value="${esc(p.client)}" maxlength="120">`)}
    ${fld('PM / responsible',personPicker('pp-pm',p.pmId,`data-ent="p" data-id="${p.id}" data-f="pmId"`,undefined,'in'))}
    <div class="fld span2"><span class="lb" id="pp-svc-lab">Services <i>optional</i></span>${svcPicker('pp-svc',svcIds(p),{pid:p.id,labelledby:'pp-svc-lab'})}</div>
    ${fld('Scope <i>optional</i>',`<textarea class="in" id="pp-desc" data-ent="p" data-id="${p.id}" data-f="description" rows="2" placeholder="Short description of the scope">${esc(p.description)}</textarea>`,{span:1})}
  </div>
  <div class="pn-sec-h" style="margin-top:12px"><h3>Notes</h3></div><textarea class="in" id="pp-notes" data-ent="p" data-id="${p.id}" data-f="notes" rows="4" placeholder="Meeting outcomes, contacts, constraints…">${esc(p.notes)}</textarea>
  <div class="pn-sec-h" style="margin-top:12px"><h3>Links</h3></div>${linksEditor(p)}</section>`;
}

/* ---------- Resources: “+” inside each project × person hours cell ---------- */
function rsCellAdd(btn){
  const pid=btn.dataset.pid,peid=btn.dataset.pe;if(!project(pid)||!person(peid))return;
  ui.rsSel={pid,peid,cell:`rc-${pid}-${peid}`};openQT(btn);
}
/* keep the hours input focused while pressing “+”, so a pending edit is committed once, by openQT */
document.addEventListener('mousedown',e=>{if(e.target.closest&&e.target.closest('.rc-add'))e.preventDefault()},true);

