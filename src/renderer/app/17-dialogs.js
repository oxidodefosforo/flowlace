/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- dialogs: new project, standard milestones, duplicate ---------- */
function openNewProject(){
  const def=S.defaults.phaseIds.map(phase).filter(g=>g&&g.active);
  openModal(`<form data-form="new-project" novalidate><div class="m-head"><div><div class="eyebrow">New project</div><h2>Create a project</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <div class="fgrid">
      <label class="fld span2"><span class="lb">Project name</span><input class="in" name="name" maxlength="120" placeholder="e.g. Riverside Medical Centre" autocomplete="off"><em class="err"></em></label>
      <label class="fld"><span class="lb">Code / number</span><input class="in mono" name="code" maxlength="30" placeholder="e.g. AZ-2431" autocomplete="off"><em class="err"></em></label>
      <label class="fld"><span class="lb">Status</span><select class="in" name="status">${opts(P_STAT,'Not started')}</select></label>
      <label class="fld"><span class="lb">Client <i>optional</i></span><input class="in" name="client" maxlength="120"></label>
      <div class="fld"><span class="lb">PM / responsible <i>optional</i></span>${personPicker('np-pm','',`name="pmId"`,undefined,'in')}</div>
      <label class="fld"><span class="lb">Project team <i>optional</i></span><select class="in" name="teamId"><option value="">Not set</option>${S.projectTeams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      <div class="fld span2"><span class="lb" id="np-svc-lab">Services <i>optional</i></span>${svcPicker('np-svc',[],{form:true,labelledby:'np-svc-lab'})}</div>
    </div>
    <p class="hint">Phases added automatically, without dates: ${def.length?def.map(g=>`<span class="nowrap"><span class="sw" style="--c:${g.color}"></span> ${esc(g.name)}</span>`).join(', '):'none'}. Change this in Settings → Project defaults.</p>
    <div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Create project</button></div></form>`);
}
function openTemplate(pid){
  const p=project(pid),pps=ppOf(pid).filter(pp=>pp.status!=='Not applicable'),existing=new Set(delivsOf(pid).filter(d=>d.milestoneId).map(d=>d.milestoneId));
  const rows=pps.flatMap(pp=>phase(pp.phaseId).milestones.map(m=>({pp,m})));
  if(!rows.length){openModal(`<div class="m-head"><div><h2>No standard milestones to add</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div><p>None of this project’s phases has standard milestones yet. Define them in Settings → Phases &amp; milestones, or add deliverables one by one.</p><div class="m-actions"><button class="btn" data-act="modal-close">Close</button><button class="btn primary" data-act="nav" data-to="settings">Open Settings</button></div>`);return}
  let i=0;
  openModal(`<form data-form="tpl-apply" data-pid="${pid}" novalidate><div class="m-head"><div><div class="eyebrow"><span class="mono">${esc(p.code)}</span> · ${esc(p.name)}</div><h2>Add standard milestones</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <p class="hint">Tick the milestones this project needs. Nothing is added unless you select it. Rename them if needed and enter the dates you know; leave the due date empty to keep one without a date.</p>
    <div class="twrap"><table class="tbl tpl-tbl"><thead><tr><th>Use</th><th>Deliverable name</th><th>Phase</th><th>Start</th><th>Due</th></tr></thead><tbody>
    ${rows.map(({pp,m})=>{const k=i++,dup=existing.has(m.id);return `<tr class="off" data-row="${k}"><td><input type="checkbox" name="use-${k}" aria-label="Use ${esc(m.name)}"><input type="hidden" name="ms-${k}" value="${m.id}"><input type="hidden" name="ph-${k}" value="${pp.phaseId}"></td><td><input class="in" name="name-${k}" value="${esc(m.name)}" maxlength="120" aria-label="Name">${dup?'<div class="hint">Already used in this project</div>':''}${m.target!=null?`<div class="hint">${m.target}% target level</div>`:''}</td><td class="nowrap"><span class="sw" style="--c:${phColor(pp.phaseId)}"></span> ${esc(ppName(pp))}</td><td>${dateField('tp-s-'+k,'',`name="s-${k}" aria-label="Start date"`)}</td><td>${dateField('tp-e-'+k,'',`name="e-${k}" aria-label="Due date"`)}</td></tr>`}).join('')}
    </tbody></table></div><p class="err" id="tpl-err" style="color:var(--danger)" hidden></p>
    <div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" id="tpl-submit">Add selected</button></div></form>`,{wide:true,focus:'input[type=checkbox]'});
  updateTplCount();
}
function updateTplCount(){const f=modalRoot.querySelector('form[data-form=tpl-apply]');if(!f)return;const n=[...f.querySelectorAll('input[type=checkbox]')].filter(c=>c.checked).length;const b=f.querySelector('#tpl-submit');b.textContent=n?`Add ${plural(n,'deliverable')}`:'Select at least one';b.disabled=!n}
function openDuplicate(id){
  const p=project(id);const n=delivsOf(id).length,nt=tasksOf(id).length,np=ppOf(id).length;
  openModal(`<form data-form="dup-project" data-id="${id}" novalidate><div class="m-head"><div><div class="eyebrow">Duplicate</div><h2>New project from ${esc(p.code)}</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div>
    <div class="fgrid"><label class="fld span2"><span class="lb">Project name</span><input class="in" name="name" value="${esc(p.name)} (copy)" maxlength="120"><em class="err"></em></label>
    <label class="fld"><span class="lb">New code</span><input class="in mono" name="code" maxlength="30" placeholder="Must be unique"><em class="err"></em></label>
    <label class="fld"><span class="lb">Client</span><input class="in" name="client" value="${esc(p.client)}" maxlength="120"></label>
    <div class="fld span2"><span class="lb" id="dp-svc-lab">Services</span>${svcPicker('dp-svc',p.serviceIds||[],{form:true,labelledby:'dp-svc-lab'})}</div></div>
    <p class="hint">Its ${plural(np,'phase')} are always copied (Not applicable stays Not applicable).</p>
    <label class="chk block"><input type="checkbox" name="copyD" ${n?'checked':'disabled'}><span>Copy its ${plural(n,'deliverable')}<small>Names, phases, standard milestones, responsible and notes. Checklists start unchecked.</small></span></label>
    <label class="chk block"><input type="checkbox" name="copyDates"><span>Also copy dates<small>Off by default: phases and deliverables start without dates.</small></span></label>
    <label class="chk block"><input type="checkbox" name="copyStatus"><span>Also copy statuses<small>Off by default, so nothing starts as Delivered or Completed.</small></span></label>
    <label class="chk block"><input type="checkbox" name="copyTasks" ${nt?'':'disabled'}><span>Copy its ${plural(nt,'task')}<small>Off by default. Copies start as To Do with no due date.</small></span></label>
    <div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Create copy</button></div></form>`,{focus:'input[name=code]'});
}

