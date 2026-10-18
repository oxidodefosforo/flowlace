/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- side panels ---------- */
function wfTaskInfoHTML(t){
  if(!t.wfStepId)return '';const s=wfStep(t.wfStepId),a=wfAvail(t),req=wfReqOf(t),ext=!wfIsInt(t);
  if(!s)return `<div class="wfinfo"><b>Workflow step no longer in the standard.</b> This task is kept as history.</div>`;
  const flags=`${s.retired?' <span class="chip c-w">Retired step (history)</span>':''}${t.wfOutOfScope?' <span class="chip c-w">Out of internal scope (history)</span>':''}${t.wfReview?' <span class="chip c-w">Source changed — review</span>':''}`;
  if(ext){const cons=wfConsumers(t);
    return `<div class="wfinfo ext"><div class="wfinfo-h"><span class="chip c-w">External input</span> <b>${esc(s.name)}</b> · from ${esc(wfSpecName(wfSpecOf(s)))}${flags}<span class="spacer"></span><button class="linkbtn" data-act="open-full" data-id="${t.projectId}" data-tab="workflow">Open project workflow</button></div>
      ${s.desc?`<p class="wfinfo-d">${esc(s.desc)}</p>`:''}
      <label class="cp-in"><span>Consultant / supplier <i>optional</i></span><input class="in" id="pt-wfcons" data-wfcons="${t.id}" value="${esc(t.wfConsultant||'')}" maxlength="120" placeholder="e.g. Example Mechanical Consultants"></label>
      <div class="wfinfo-r"><span class="muted">Needed by</span> ${cons.length?cons.map(c=>`<button class="chip" data-act="panel-task" data-id="${c.id}" data-push="1">${esc(c.name)}</button>`).join(' '):'<span class="muted">no current activity</span>'}</div>
      <div class="wfinfo-r"><span class="muted">Required by</span> ${req.length?req.map(d=>`<button class="chip" data-act="panel-deliv" data-id="${d.id}" data-push="1">${esc(d.name)}</button>`).join(' '):'<span class="muted">no deliverable</span>'}</div>
      <p class="hint" style="margin:4px 0 0"><b>Assignee</b> = internal follow-up (not responsible for the external design) · <b>Due date</b> = date required · <b>Done</b> = information received and validated (requesting it is not enough). Use notes and links for the evidence.</p></div>`}
  return `<div class="wfinfo"><div class="wfinfo-h"><span class="chip">${WF_CAT[s.cat]}</span> <b>Company workflow</b> · ${esc(phName(s.phaseId))} · ${esc(wfSpecName(wfSpecOf(s)))}${flags}<span class="spacer"></span><button class="linkbtn" data-act="open-full" data-id="${t.projectId}" data-tab="workflow">Open project workflow</button></div>
    ${s.desc?`<p class="wfinfo-d">${esc(s.desc)}</p>`:''}
    <div class="wfinfo-r"><span class="muted">Requirements</span> ${s.deps.length?s.deps.map(d=>{const x=wfStep(d);if(!x)return '';const st=wfDepState(t.projectId,x);return `<button class="chip${st.ok?' c-o':st.kind==='external'?' c-w':''}" ${st.t?`data-act="panel-task" data-id="${st.t.id}" data-push="1"`:''} title="${esc(WF_MISS[st.kind]||'')}">${st.ok?'✓ ':''}${st.kind==='external'||st.kind==='externalMissing'?'External input: ':''}${esc(x.name)}${st.ok?'':` <small>· ${esc(st.kind==='internal'?'not done':st.kind==='external'?'not received':WF_MISS[st.kind])}</small>`}</button>`}).join(' '):'<span class="muted">none</span>'}</div>
    ${a?`<div class="wfinfo-r"><span class="muted">Availability</span> ${wfAvailChip(a)}${a.warn?` <span class="warnt">${esc(a.warn)}</span>`:''}</div>`:''}
    <div class="wfinfo-r"><span class="muted">Required by</span> ${req.length?req.map(d=>`<button class="chip" data-act="panel-deliv" data-id="${d.id}" data-push="1">${esc(d.name)}</button>`).join(' '):'<span class="muted">no deliverable</span>'}</div>
    <p class="hint" style="margin:4px 0 0">Name, instructions, specialty and dependencies come from Settings → Company workflow. Completing this task never marks its external inputs as received.</p></div>`;
}
function wfDelivReqHTML(d){
  const m=wfReqMet(d),p=project(d.projectId),edit=ui.reqEdit===d.id,pool=S.tasks.filter(t=>t.projectId===d.projectId&&t.wfStepId&&(wfLive(t)||(d.reqTaskIds||[]).includes(t.id)));
  const phs=[...new Set([d.phaseId,...pool.map(t=>wfStep(t.wfStepId)?.phaseId).filter(Boolean)])];
  return `<section class="pn-sec" id="wfreq"><div class="pn-sec-h"><h3>Workflow requirements</h3><span class="tcomp">${m.total?`<span>${m.done} of ${m.total} met</span>${wfBar(m.done,m.total)}`:'<span class="muted">None linked</span>'}</span></div>
    ${m.total?`<ul class="mini-list">${m.ts.map(t=>{const a=wfAvail(t);return `<li class="${t.status==='Done'?'done':''}"><span>${TGLYPH[t.status]}</span><button class="plainbtn grow" data-act="panel-task" data-id="${t.id}" data-push="1">${esc(t.name)}</button><span class="meta">${esc(t.assignedToId?shortName(pname(t.assignedToId)):'Unassigned')}</span>${a?wfAvailChip(a):''}</li>`}).join('')}</ul>`:''}
    <p class="hint">Delivery status (${esc(d.status)}) is set by you: meeting every requirement, or receiving its external inputs, doesn’t mark it Delivered. A task can be required by several deliverables without being duplicated.</p>
    ${pool.length?`<button class="btn sm" data-act="wf-req-edit" data-id="${d.id}" aria-expanded="${edit}">${edit?'Done choosing':'Choose required tasks…'}</button>
    ${edit?`<div class="wfreq-ed">${phs.map(ph=>{const ts=pool.filter(t=>wfStep(t.wfStepId)?.phaseId===ph);return ts.length?`<fieldset><legend><span class="sw" style="--c:${phColor(ph)}"></span> ${esc(phName(ph))}</legend>${ts.map(t=>{const s=wfStep(t.wfStepId);return `<label class="chk"><input type="checkbox" data-dreq="${d.id}" value="${t.id}"${(d.reqTaskIds||[]).includes(t.id)?' checked':''}><span>${esc(t.name)} <small>${wfIsInt(t)?WF_CAT[s.cat]:'External input'} · ${esc(wfSpecName(wfSpecOf(s)))}${t.status==='Done'?' · ✓ done':''}</small></span></label>`}).join('')}</fieldset>`:''}).join('')}</div>`:''}`:`<p class="muted">This project has no workflow tasks yet. ${p?`<button class="linkbtn" data-act="wf-import" data-pid="${p.id}">Import activities…</button>`:''}</p>`}</section>`;
}

