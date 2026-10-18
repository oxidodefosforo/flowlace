/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- Resources: quick task from the selected hours cell ---------- */
function rsSelValid(){const s=ui.rsSel;return s&&project(s.pid)&&person(s.peid)?s:null}
function rsCtxText(){const s=rsSelValid();if(!s)return 'Select an hours cell';const w=ui.resLayout?ui.resLayout.w:resWeek();return `${project(s.pid).code} · ${shortName(person(s.peid).name)} · Week ${isoWeekNo(w)}`}
function rsCtxUpdate(){const c=document.getElementById('rs-ctx'),b=document.getElementById('rs-addtask'),s=rsSelValid();if(c)c.textContent=rsCtxText();if(b){b.disabled=!s;b.title=s?`New task for ${rsCtxText()}`:'Select an hours cell first'}}
document.addEventListener('focusin',e=>{const el=e.target;if(el.classList&&el.classList.contains('rci')){ui.rsSel={pid:el.dataset.rp,peid:el.dataset.rq,cell:el.id};rsCtxUpdate()}});
let qtFrom=null,qtAdded=[];
function closeQT(back){const m=document.getElementById('rs-qt');if(!m||m.hidden)return false;m.hidden=true;const s=rsSelValid();if(back){const c=s&&document.getElementById(s.cell);(c||qtFrom)&&(c||qtFrom).focus()}return true}
function openQT(btn){
  const act=document.activeElement;if(act&&act.classList&&act.classList.contains('rci'))commitCell(act);
  const s=rsSelValid();if(!s){toast('Select an hours cell first (project row × person column).','err');return}
  qtFrom=btn;qtAdded=[];const p=project(s.pid),pe=person(s.peid),sv=pe.disciplineId&&service(pe.disciplineId);
  let m=document.getElementById('rs-qt');if(!m){m=document.createElement('div');m.id='rs-qt';m.className='cappop qtpop';m.setAttribute('role','dialog');document.body.appendChild(m)}
  m.setAttribute('aria-label',`New task for ${p.code}, ${pe.name}`);
  m.innerHTML=`<form data-form="rs-qt" data-pid="${p.id}" data-pe="${pe.id}" novalidate><div class="cp-h"><b>New task</b><button type="button" class="iconbtn" data-act="rs-qt-close" aria-label="Close">✕</button></div>
    <div class="qt-ctx"><span class="mono">${esc(p.code)}</span> ${esc(p.name)}<br><span class="muted">${esc(pe.name)} · Week ${isoWeekNo(ui.resLayout?ui.resLayout.w:resWeek())} (planning context only, not a due date)</span></div>
    <label class="cp-in"><span>Task name</span><input class="in" name="name" id="qt-name" maxlength="160" autocomplete="off" placeholder="Type a name and press Enter"><em class="err"></em></label>
    <p class="hint" style="margin:0">General project task · To Do · Normal · Planned${sv?` · ${esc(sv.name)}`:''} · assigned to ${esc(shortName(pe.name))}</p>
    <button type="button" class="linkbtn qt-mb" data-act="rs-qt-more" aria-expanded="false" aria-controls="qt-more">More options ▾</button>
    <div id="qt-more" class="qt-more" hidden>
      <label class="cp-in"><span>Due date <i>optional</i></span><input class="in" type="date" name="due" id="qt-due"></label>
      <label class="cp-in"><span>Deliverable <i>optional</i></span><select class="in" name="deliverableId" id="qt-deliv"><option value="">General (no deliverable)</option>${sortDelivs(delivsOf(p.id)).map(d=>`<option value="${d.id}">${esc(d.name)}${d.due?` · ${fmt(d.due)}`:''}</option>`).join('')}</select></label>
      <label class="cp-in"><span>Phase <i>optional</i></span><select class="in" name="phaseId" id="qt-phase"><option value="">General (no phase)</option>${ppPhaseOpts(p.id,'')}</select></label></div>
    <div class="cp-act"><span class="qt-done muted" id="qt-done" role="status" aria-live="polite"></span><span class="spacer"></span><button type="button" class="btn sm ghost" data-act="rs-qt-close">Done</button><button class="btn sm primary">Add task</button></div></form>`;
  m.hidden=false;const cell=document.getElementById(s.cell),r=(cell||btn).getBoundingClientRect(),mr=m.getBoundingClientRect();
  m.style.left=Math.max(8,Math.min(r.right+6,innerWidth-mr.width-8))+'px';m.style.top=Math.max(8,Math.min(r.top,innerHeight-mr.height-8))+'px';
  m.querySelector('#qt-name').focus();
}
document.addEventListener('change',e=>{const el=e.target;if(el.id!=='qt-deliv')return;const ph=document.getElementById('qt-phase'),d=el.value?deliv(el.value):null;
  if(d){ph.value=d.phaseId;ph.disabled=true;ph.title='Taken from the deliverable'}else{ph.disabled=false;ph.title=''}});
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form!=='rs-qt')return;e.preventDefault();e.stopImmediatePropagation();
  const F=f.elements,name=F.name.value.trim();if(!name){F.name.setAttribute('aria-invalid','true');f.querySelector('.err').textContent='Type a task name.';F.name.focus();return}
  F.name.removeAttribute('aria-invalid');f.querySelector('.err').textContent='';
  const pid=f.dataset.pid,pe=person(f.dataset.pe),did=F.deliverableId.value||null,d=did?deliv(did):null;
  if(d&&d.projectId!==pid)return;const ph=!d&&F.phaseId.value&&ppFor(pid,F.phaseId.value)?F.phaseId.value:null;
  const t=newTask({projectId:pid,name,assignedToId:pe.id,status:'To Do',priority:'Normal',source:'Planned',serviceId:pe.disciplineId&&service(pe.disciplineId)?pe.disciplineId:null,deliverableId:did,phaseId:ph,due:isoOK(F.due.value)?F.due.value:null});
  S.tasks.push(t);save(true);setSaveInd();qtAdded.push(t.id);
  document.getElementById('qt-done').textContent=`✓ ${plural(qtAdded.length,'task')} added · last: “${name}”`;
  toast(`Task “${name}” added to ${project(pid).code} for ${shortName(pe.name)}`,'',()=>{S.tasks=S.tasks.filter(x=>x.id!==t.id);save();render()});
  F.name.value='';F.name.focus();
},true);
document.addEventListener('mousedown',e=>{const m=document.getElementById('rs-qt');if(m&&!m.hidden&&!m.contains(e.target)&&!e.target.closest('#rs-addtask,.rc-add'))closeQT()},true);
document.addEventListener('keydown',e=>{const m=document.getElementById('rs-qt');if(e.key==='Escape'&&m&&!m.hidden&&m.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();closeQT(true)}},true);

