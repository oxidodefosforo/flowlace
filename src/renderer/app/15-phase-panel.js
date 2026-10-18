/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- phase panel & milestone reference ---------- */
function panelPPhase(pp){
  const g=phase(pp.phaseId),p=project(pp.projectId),ds=sortDelivs(ppDelivs(pp)),late=ppLate(pp),sg=ui.suggest&&ui.suggest[pp.id],tks=ppTasks(pp);
  return `<div class="fgrid">
    ${fld('Start date',dateField('pph-s',pp.start,`data-ent="pp" data-id="${pp.id}" data-f="start"${pp.end?` max="${pp.end}"`:''}`,true))}
    ${fld('Planned end date',dateField('pph-e',pp.end,`data-ent="pp" data-id="${pp.id}" data-f="end"${pp.start?` min="${pp.start}"`:''}`,true))}
    ${fld('Status',`<select class="in" id="pph-st" data-ent="pp" data-id="${pp.id}" data-f="status">${statusOpts(PP_STAT,pp.status,PPGLYPH)}</select>`)}
    ${fld('Project',`<button class="plainbtn" data-act="panel-project" data-id="${p.id}" data-push="1" style="padding-top:6px"><span class="mono muted">${esc(p.code)}</span> ${esc(p.name)}</button>`)}
    ${fld('Notes <i>optional</i>',`<textarea class="in" id="pph-n" data-ent="pp" data-id="${pp.id}" data-f="notes" rows="2">${esc(pp.notes)}</textarea>`,{span:1})}
  </div>
  ${late?`<p class="od" style="font-size:12.5px">! The planned end date (${fmt(pp.end)}) has passed and the status isn’t Completed. Update the dates or the status.</p>`:''}
  ${!ppScheduled(pp)&&pp.status!=='Not applicable'?'<p class="warnt" style="font-size:12.5px">Unscheduled: set a start and an end date to show this phase as a bar.</p>':''}
  <div class="pn-sec"><div class="pn-sec-h"><h3>Suggest dates</h3><button class="btn sm" data-act="pp-suggest" data-id="${pp.id}">Suggest from deliverables</button></div>
    ${sg?`<div class="sugbox">${sg.none?'No deliverable in this phase has a due date, so there is nothing to suggest from.':`Suggested from ${plural(sg.n,'deliverable')}: <b>${fmt(sg.start)} – ${fmt(sg.end)}</b>. Nothing changes until you apply it.`}<div style="display:flex;gap:6px;margin-top:6px">${sg.none?'':`<button class="btn sm primary" data-act="pp-apply" data-id="${pp.id}">Apply these dates</button>`}<button class="btn sm ghost" data-act="pp-dismiss" data-id="${pp.id}">Dismiss</button></div></div>`:'<p class="hint">Proposes the period from the earliest start or due date to the latest due date of this phase’s deliverables. You decide whether to apply it.</p>'}</div>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Deliverables in this phase</h3><button class="btn sm" data-act="add-deliv-phase" data-pid="${p.id}" data-phase="${pp.phaseId}">+ Add deliverable</button></div>
    ${ds.length?`<ul class="mini-list">${ds.map(d=>`<li><span class="dia-sw" style="--c:${g.color}"></span><button class="plainbtn grow" data-act="panel-deliv" data-id="${d.id}" data-push="1">${esc(d.name)}</button>${d.milestoneId?'<span class="chip c-n" title="Standard milestone">Standard</span>':''}<span class="num">${d.due?fmt(d.due):'No due date'}</span>${dlStatusChip(d)}${outOfPhase(d)?'<span class="chip c-w">Outside phase dates</span>':''}</li>`).join('')}</ul>`:'<p class="muted">No deliverables in this phase yet.</p>'}
    ${tks.length?`<p class="hint">${plural(tks.length,'general task')} linked directly to this phase.</p>`:''}</section>
  <section class="pn-sec"><div class="pn-sec-h"><h3>Phase definition</h3><button class="btn sm ghost" data-act="goto-def" data-id="${g.id}">Edit in Settings</button></div>
    <dl class="defl"><dt>Description and purpose</dt><dd>${g.description?esc(g.description):'<span class="muted">Not defined yet.</span>'}</dd><dt>Completion criteria</dt><dd>${g.completion?esc(g.completion):'<span class="muted">Not defined yet.</span>'}</dd><dt>Standard milestones</dt><dd>${g.milestones.length?g.milestones.map(m=>`${esc(m.name)}${m.target!=null?` <span class="muted">(${m.target}% target)</span>`:''}`).join(' · '):'<span class="muted">None defined.</span>'}</dd></dl>
    <p class="hint">Shared by every project. Changing it in Settings updates all projects.</p></section>
  <div class="pn-actions"><button class="btn" data-act="open-full" data-id="${p.id}" data-tab="phases">Open project phases</button></div>`;
}
function delivRefHTML(d){
  const f=findMs(d.milestoneId);if(!f)return '';const m=f.ms,chg=msChanged(d);
  const items=m.checklist,done=items.filter(c=>d.checks[c.id]).length;
  return `<section class="pn-sec msref"><div class="pn-sec-h"><h3>Standard milestone: ${esc(m.name)}</h3><button class="btn sm ghost" data-act="goto-def" data-id="${f.phase.id}">Definition</button></div>
    ${chg?`<div class="pn-warn" role="status"><span>The reference criteria for “${esc(m.name)}” changed on ${fmt(m.updatedAt.slice(0,10))}.${d.status==='Delivered'?' This deliverable stays Delivered.':''} Review the checklist below.</span><button class="btn sm" data-act="ms-review" data-id="${d.id}">Mark as reviewed</button></div>`:''}
    <dl class="defl">${m.target!=null?`<dt>Target development level</dt><dd><b>${m.target}%</b> <span class="muted">— an agreed level of design development, not time elapsed or tasks completed.</span></dd>`:''}<dt>Description</dt><dd>${m.description?esc(m.description):'<span class="muted">Not defined yet.</span>'}</dd><dt>Expected outputs</dt><dd>${m.outputs?esc(m.outputs):'<span class="muted">Not defined yet.</span>'}</dd></dl>
    <div class="pn-sec-h"><h3 style="font-size:11px">Criteria checklist</h3><span class="muted" style="font-size:12px">${items.length?`${done} of ${items.length} checked for this deliverable`:''}</span></div>
    ${items.length?`<ul class="checklist">${items.map(c=>`<li><label class="chk block"><input type="checkbox" id="dc-${d.id}-${c.id}" data-ent="dcheck" data-id="${d.id}" data-c="${c.id}"${d.checks[c.id]?' checked':''}> <span>${esc(c.text||'(empty criterion)')}</span></label></li>`).join('')}</ul>`:'<p class="hint">No criteria defined for this milestone yet. Add them in Settings → Phases &amp; milestones.</p>'}</section>`;
}

