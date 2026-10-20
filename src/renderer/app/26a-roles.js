/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- roles: what kind of work a person does (assignment only — never access permissions) ----------
   S.roles = [{id, name, active, createdAt}]        global catalogue, editable in Settings → People
   person.roleIds = [roleId…]                         several roles per person; the specialty stays person.disciplineId
   step.roleIds = [roleId…]                           responsible role(s) expected by the company standard
   project.wfRoleMap = {"<specialtyId>|<roleId>": personId}   who fills that role in this project */
const DEF_ROLES=()=>[['ro-pm','Project Manager'],['ro-eng','Engineer'],['ro-seng','Senior Engineer'],['ro-bimc','BIM Coordinator'],['ro-bimm','BIM Modeler'],['ro-dft','Drafter'],['ro-qa','Reviewer / QA']].map(([id,name])=>({id,name,active:true,createdAt:null}));
function normRoles(o,d){
  const seen=new Set();
  /* a workspace stores the catalogue as records: an empty list only means it was never saved → defaults */
  o.roles=Array.isArray(d.roles)&&d.roles.length?d.roles.filter(r=>r&&r.id&&String(r.name||'').trim()&&!seen.has(r.id)&&seen.add(r.id)).map(r=>({id:String(r.id),name:String(r.name).trim().slice(0,60),active:r.active!==false,createdAt:r.createdAt||null})):DEF_ROLES();
  const ids=new Set(o.roles.map(r=>r.id));
  /* references to a deactivated role are kept (history); only unknown ids are dropped */
  o.people.forEach(pe=>{pe.roleIds=[...new Set(arr(pe.roleIds).map(String))].filter(id=>ids.has(id))});
}
const role=id=>S.roles.find(r=>r.id===id)||null;
const roleName=id=>(role(id)||{}).name||'Unknown role';
const activeRoles=()=>S.roles.filter(r=>r.active);
const rolesSorted=list=>[...list].sort((a,b)=>S.roles.findIndex(r=>r.id===a)-S.roles.findIndex(r=>r.id===b));
function roleChips(ids,cls){return rolesSorted(ids||[]).map(id=>`<span class="chip rolec${role(id)&&!role(id).active?' inact':''}${cls?' '+cls:''}" title="${role(id)&&!role(id).active?'Inactive role':'Role'}">${esc(roleName(id))}</span>`).join(' ')}
/* a checkbox list as a compact drop-down (people table, workflow step) */
function rolePicker(attr,owner,sel,label){
  const set=new Set(sel||[]),list=S.roles.filter(r=>r.active||set.has(r.id));
  return `<details class="rolepick"><summary aria-label="${esc(label)}">${set.size?roleChips([...set]):'<span class="muted">No role</span>'}</summary><div class="rolepick-m" role="group" aria-label="${esc(label)}">${list.map(r=>`<label class="chk"><input type="checkbox" ${attr}="${owner}" value="${r.id}"${set.has(r.id)?' checked':''}><span>${esc(r.name)}${r.active?'':' <small class="muted">(inactive)</small>'}</span></label>`).join('')||'<span class="muted">No roles in the catalogue.</span>'}</div></details>`;
}

/* ---------- Settings → People: roles catalogue ---------- */
function settingsRoles(){
  const used=id=>S.people.filter(pe=>(pe.roleIds||[]).includes(id)).length,inStd=id=>wfEdit().steps.filter(s=>!s.retired&&(s.roleIds||[]).includes(id)).length;
  return `<section class="panelbox"><h2>Roles</h2><p class="note" style="margin:0 0 8px">Roles describe the kind of work a person does (for example Electrical + Engineer). The Company workflow uses them to propose responsibles; the person is chosen in each project. They are not access permissions. A deactivated role keeps its references and history but can’t be chosen for new assignments.</p>
    <div class="twrap"><table class="tbl edit roles"><thead><tr><th>Role</th><th>Active</th><th>Used by</th></tr></thead><tbody>${S.roles.map(r=>`<tr class="${r.active?'':'inact'}"><td style="min-width:200px"><input id="ro-${r.id}" data-role="${r.id}" data-f="name" value="${esc(r.name)}" maxlength="60" aria-label="Role name"></td>
      <td><label class="chk"><input type="checkbox" id="ro-${r.id}-a" data-role="${r.id}" data-f="active"${r.active?' checked':''}> ${r.active?'Active':'Inactive'}</label></td>
      <td class="meta">${[used(r.id)&&plural(used(r.id),'person','people'),inStd(r.id)&&plural(inStd(r.id),'workflow step')].filter(Boolean).join(' · ')||'—'}</td></tr>`).join('')}</tbody></table></div>
    <form class="addrow" data-form="role-add"><input class="in" name="name" id="ro-new" placeholder="New role, e.g. Graduate Engineer" maxlength="60" aria-label="New role"><button class="btn">Add role</button></form></section>`;
}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.role){const r=role(el.dataset.role);if(!r)return;
    if(el.dataset.f==='name'){const v=el.value.trim().slice(0,60);if(!v){fieldError(el,'A role needs a name.');el.value=r.name;return}
      if(S.roles.some(x=>x!==r&&x.name.toLowerCase()===v.toLowerCase())){fieldError(el,'That role already exists.');el.value=r.name;return}clearFieldError(el);if(v===r.name)return;r.name=v;save();render();return}
    if(el.dataset.f==='active'){r.active=el.checked;save();render();toast(r.active?`“${r.name}” is active again`:`“${r.name}” deactivated. People and workflow steps keep it; it can’t be chosen for new assignments.`);return}}
  if(el.dataset.perole){const pe=person(el.dataset.perole);if(!pe)return;const set=new Set(pe.roleIds||[]);el.checked?set.add(el.value):set.delete(el.value);pe.roleIds=rolesSorted([...set]);save();setSaveInd();
    /* update only this picker's summary: the page is not redrawn, so focus, the open list and other fields stay as they are */
    const d=el.closest('details.rolepick'),sm=d&&d.querySelector('summary');if(sm)sm.innerHTML=pe.roleIds.length?roleChips(pe.roleIds):'<span class="muted">No role</span>';
    document.querySelectorAll('table.roles tr').forEach(tr=>{const i=tr.querySelector('[data-role][data-f=name]');if(!i)return;const id=i.dataset.role,c=tr.querySelector('td.meta');if(c){const u=S.people.filter(x=>(x.roleIds||[]).includes(id)).length,w=wfEdit().steps.filter(x=>!x.retired&&(x.roleIds||[]).includes(id)).length;c.textContent=[u&&plural(u,'person','people'),w&&plural(w,'workflow step')].filter(Boolean).join(' · ')||'—'}});return}
  if(el.dataset.wfrole){const dr=wfDraft(),s=wfStep(el.dataset.wfrole,dr);if(!s)return;const set=new Set(s.roleIds||[]);el.checked?set.add(el.value):set.delete(el.value);s.roleIds=rolesSorted([...set]);save(true);setSaveInd();render();
    const c=document.querySelector(`[data-wfrole="${s.id}"][value="${el.value}"]`);if(c){c.closest('details').open=true;c.focus()}return}
  if(el.dataset.wfmap){const p=project(el.dataset.pid);if(!p)return;p.wfRoleMap={...(p.wfRoleMap||{})};if(el.value)p.wfRoleMap[el.dataset.wfmap]=el.value;else delete p.wfRoleMap[el.dataset.wfmap];p.updatedAt=new Date().toISOString();save();render();
    const c=document.querySelector(`[data-wfmap="${el.dataset.wfmap}"]`);if(c){const d=c.closest('details');if(d)d.open=true;c.focus()}return}
},true);
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form!=='role-add')return;e.preventDefault();e.stopImmediatePropagation();
  const v=f.elements.name.value.trim().slice(0,60);if(!v){fieldError(f.elements.name,'Type a name first.');return}
  if(S.roles.some(r=>r.name.toLowerCase()===v.toLowerCase())){fieldError(f.elements.name,'That role already exists.');return}
  S.roles.push({id:uid('ro'),name:v,active:true,createdAt:new Date().toISOString()});ui.focusAfter='ro-new';save();render();toast(`Role “${v}” added`)},true);

/* ---------- who should do a workflow activity in a project ----------
   1. the project's mapping for (specialty, role), in the order of the step's roles;
   2. otherwise active people of that specialty with one of the roles: one → proposed, several → choose, none → unassigned + reason.
   External inputs are never proposed: their design belongs to a consultant (the follow-up person is chosen by hand). */
function wfPropose(p,s,mode){
  const roles=(s.roleIds||[]).filter(id=>role(id)),spec=s.serviceId,specN=spec?wfSpecName(spec):'this specialty';
  const people=S.people.filter(pe=>pe.active!==false);
  if(mode==='externalInput')return {pid:null,cands:[],via:'external',reason:'External input: designed by a consultant; choose the internal follow-up by hand'};
  if(!roles.length)return {pid:null,cands:[],via:'norole',reason:'No responsible role in the standard'};
  const map=p.wfRoleMap||{};
  for(const r of roles){const id=map[(spec||'_none')+'|'+r],pe=id&&person(id);if(pe&&pe.active!==false)return {pid:pe.id,cands:[pe],via:'map',role:r,reason:`Project mapping: ${specN} / ${roleName(r)}`}}
  const act=roles.filter(r=>role(r).active),cands=people.filter(pe=>pe.disciplineId===spec&&(pe.roleIds||[]).some(r=>act.includes(r)));
  const rl=act.map(roleName).join(' or ')||roles.map(roleName).join(' or ');
  if(cands.length===1)return {pid:cands[0].id,cands,via:'unique',reason:`Only active ${specN} person with role ${rl}`};
  if(cands.length>1)return {pid:null,cands,via:'choose',reason:`${cands.length} active ${specN} people with role ${rl}: choose one`};
  return {pid:null,cands:[],via:'none',reason:!act.length?`The role${roles.length>1?'s':''} ${roles.map(roleName).join(', ')} ${roles.length>1?'are':'is'} inactive`:`No active ${specN} person with role ${rl}`};
}
/* person selector for a proposal: matching people first, then everyone else (explicit manual choice) */
function wfProposeSelect(attr,key,pr,cur){
  const others=S.people.filter(pe=>pe.active!==false&&!pr.cands.includes(pe)).sort((a,b)=>a.name.localeCompare(b.name));
  const o=pe=>`<option value="${pe.id}"${cur===pe.id?' selected':''}>${esc(pe.name)}</option>`;
  return `<select class="in sm wi-as" ${attr}="${key}" aria-label="Responsible">${`<option value=""${!cur?' selected':''}>${pr.via==='choose'?'Choose…':'Unassigned'}</option>`}${pr.cands.length?`<optgroup label="Matching specialty and role">${pr.cands.map(o).join('')}</optgroup>`:''}${others.length?`<optgroup label="Other people (manual)">${others.map(o).join('')}</optgroup>`:''}</select>`;
}
function wfProposeNote(pr,cur){
  const cls=pr.via==='map'||pr.via==='unique'?'ok':pr.via==='choose'?'warnt':'muted';
  const manual=cur&&cur!==pr.pid&&!(pr.via==='choose'&&pr.cands.some(c=>c.id===cur));
  return `<small class="${manual?'muted':cls} wi-why">${manual?'Manual choice':esc(pr.reason)}</small>`;
}
/* project mapping editor: specialty × role pairs the imported activities need */
function wfRoleMapHTML(p){
  const ts=S.tasks.filter(t=>t.projectId===p.id&&t.wfStepId&&wfIsInt(t)&&wfLive(t)),pairs=new Map();
  ts.forEach(t=>{const s=wfStep(t.wfStepId);(s.roleIds||[]).filter(r=>role(r)).forEach(r=>{const k=(s.serviceId||'_none')+'|'+r;if(!pairs.has(k))pairs.set(k,{spec:s.serviceId||'_none',r})})});
  const order=wfSpecs(),list=[...pairs.entries()].sort((a,b)=>order.indexOf(a[1].spec)-order.indexOf(b[1].spec)||S.roles.findIndex(r=>r.id===a[1].r)-S.roles.findIndex(r=>r.id===b[1].r));
  const map=p.wfRoleMap||{},open=ui.wfMapOpen===p.id;
  if(!list.length)return `<details class="wfmap"${open?' open':''} data-wfmapd="${p.id}"><summary><b>Responsibles by role</b> <span class="muted">— no imported activity has a responsible role yet (Settings → Company workflow → step → Responsible role(s))</span></summary></details>`;
  const set=list.filter(([k])=>map[k]).length;
  return `<details class="wfmap"${open?' open':''} data-wfmapd="${p.id}"><summary><b>Responsibles by role</b> <span class="muted">${set}/${list.length} mapped · used by Import activities and Assign by role</span></summary>
    <table class="tbl wfmap-t"><thead><tr><th>Specialty</th><th>Role</th><th>Person in this project</th><th>Candidates</th></tr></thead><tbody>${list.map(([k,x])=>{const c=S.people.filter(pe=>pe.active!==false&&pe.disciplineId===(x.spec==='_none'?null:x.spec)&&(pe.roleIds||[]).includes(x.r));
      return `<tr><td>${esc(wfSpecName(x.spec))}</td><td>${roleChips([x.r])}</td><td><select class="in sm" data-wfmap="${k}" data-pid="${p.id}" aria-label="${esc(wfSpecName(x.spec)+' / '+roleName(x.r))}"><option value="">By role (automatic)</option>${S.people.filter(pe=>pe.active!==false||map[k]===pe.id).sort((a,b)=>(c.includes(b)-c.includes(a))||a.name.localeCompare(b.name)).map(pe=>`<option value="${pe.id}"${map[k]===pe.id?' selected':''}>${esc(pe.name)}${c.includes(pe)?' ★':''}</option>`).join('')}</select></td><td class="muted">${c.length?c.map(pe=>esc(pe.name)).join(', '):'none'}</td></tr>`}).join('')}</tbody></table>
    <p class="hint" style="margin:6px 0 0">★ = active person of that specialty with that role. The mapping only proposes; existing assignments are never changed.</p></details>`;
}
document.addEventListener('toggle',e=>{const d=e.target;if(d.dataset&&d.dataset.wfmapd){ui.wfMapOpen=d.open?d.dataset.wfmapd:null}},true);

/* ---------- Assign by role: fills only activities that are still unassigned, after a preview ---------- */
function openAssignByRole(pid){
  const p=project(pid);if(!p)return;
  const ts=S.tasks.filter(t=>t.projectId===pid&&t.wfStepId&&wfIsInt(t)&&wfLive(t)&&!t.assignedToId&&t.status!=='Done');
  ui.abr={pid,sel:{}};ts.forEach(t=>{const pr=wfPropose(p,wfStep(t.wfStepId),'internal');ui.abr.sel[t.id]=pr.pid||''});
  openModal(`<form data-form="wf-abr" id="abr"><div class="m-head"><div><div class="eyebrow"><span class="mono">${esc(p.code)}</span> · ${esc(p.name)}</div><h2>Assign by role</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div><div id="abr-body">${abrBody()}</div></form>`,{wide:true,focus:'#abr-body select'});
}
function abrBody(){
  const a=ui.abr,p=project(a.pid),ids=Object.keys(a.sel),ts=ids.map(id=>S.tasks.find(t=>t.id===id)).filter(Boolean);
  if(!ts.length)return `<p>Every imported internal activity that is not done already has a responsible. Nothing to assign.</p><div class="m-actions"><button type="button" class="btn primary" data-act="modal-close">Close</button></div>`;
  const n=ids.filter(id=>a.sel[id]).length;
  return `<p class="hint" style="margin-top:0">Only activities <b>without a responsible</b> are listed; assigned ones are never changed. Proposals use this project’s role mapping first, then active people of the activity’s specialty with one of its roles.</p>
    <table class="tbl wi-as-t"><thead><tr><th>Activity</th><th>Specialty</th><th>Role(s)</th><th>Responsible</th></tr></thead><tbody>${ts.map(t=>{const s=wfStep(t.wfStepId),pr=wfPropose(p,s,'internal');
      return `<tr><td><b>${esc(s.name)}</b> <small class="muted">${esc(phName(s.phaseId))}</small></td><td>${esc(wfSpecName(wfSpecOf(s)))}</td><td>${roleChips(s.roleIds)||'<span class="muted">—</span>'}</td><td>${wfProposeSelect('data-abr',t.id,pr,a.sel[t.id])} ${wfProposeNote(pr,a.sel[t.id])}</td></tr>`}).join('')}</tbody></table>
    <div class="m-actions"><span class="muted" style="margin-right:auto">${plural(n,'activity','activities')} will be assigned${ts.length-n?` · ${ts.length-n} stay unassigned`:''}</span><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" id="abr-ok"${n?'':' disabled'}>Assign</button></div>`;
}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset||!el.dataset.abr||!ui.abr)return;ui.abr.sel[el.dataset.abr]=el.value;const b=document.getElementById('abr-body');if(b){const sc=b.scrollTop;b.innerHTML=abrBody();b.scrollTop=sc;const f=document.querySelector(`[data-abr="${el.dataset.abr}"]`);f&&f.focus()}},true);
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form!=='wf-abr')return;e.preventDefault();e.stopImmediatePropagation();
  const a=ui.abr,now=new Date().toISOString();let n=0;
  Object.entries(a.sel).forEach(([id,pe])=>{const t=S.tasks.find(x=>x.id===id);if(!t||!pe||t.assignedToId||!person(pe))return;t.assignedToId=pe;t.updatedAt=now;n++});
  save();closeModal(true);render();toast(n?`${plural(n,'activity','activities')} assigned. Existing assignments were not changed.`:'Nothing was assigned')},true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-wfabr]');if(!b)return;e.preventDefault();openAssignByRole(b.dataset.wfabr)});
