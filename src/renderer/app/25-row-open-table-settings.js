/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- v16: open a Projects / Tasks row by clicking its free space or informative text ---------- */
/* The rule: a click on a real control uses that control; anything else in the row opens the record in the side panel.
   Only the interactive element itself is excluded (never a whole cell), so free space around a field still opens the row. */
const ROW_CTL='input,select,textarea,button,a[href],label,option,[data-act],[contenteditable=""],[contenteditable="true"],[role=button],[role=menuitem],.dfield,.pp-new,.svc-dd';
let rowDown=null;
/* window capture runs before every document listener, so it sees popovers before their outside-click handlers close them */
window.addEventListener('mousedown',e=>{
  const tr=e.target.closest&&e.target.closest('tr[data-prow],tr[data-trow]');
  const float=!!document.querySelector('#rowmenu:not([hidden]),.svc-list:not([hidden]),.menu:not([hidden]),#ctxmenu:not([hidden]),#cal-pop:not([hidden]),#rs-qt:not([hidden]),#pj-tset:not([hidden]),.pp-new:not([hidden])');
  rowDown=tr&&e.button===0?{tr,x:e.clientX,y:e.clientY,ctl:!!e.target.closest(ROW_CTL),float,sel:selText()}:null;
},true);
function selText(){try{const s=getSelection();return s&&!s.isCollapsed?s.toString():''}catch(e){return ''}}
function rowRec(tr){return tr.dataset.prow?{type:'project',id:tr.dataset.prow}:{type:'task',id:tr.dataset.trow}}
function openRow(tr){
  const r=rowRec(tr);if(r.type==='project'?!project(r.id):!S.tasks.some(t=>t.id===r.id))return;
  /* a valid pending edit in the list is committed by its change event (fired on blur, before this click); an editor in the panel is committed by openPanel */
  const ae=document.activeElement;if(ae&&ae!==document.body&&ae.closest&&ae.closest('#main')&&ae.blur)ae.blur();
  const had=!!ui.panel;openPanel(r.type,r.id);
  if(!had)ui.panelOpener=r.type==='project'?'pn-open-'+r.id:'to-'+r.id;
}
/* mouseup (not click): when saving a pending edit re-renders the list between press and release, the browser may not fire a click at all */
document.addEventListener('mouseup',e=>{
  const d=rowDown;rowDown=null;if(!d||e.button!==0)return;
  if(d.ctl||d.float)return;                                    // the press began on a control, or closed an open menu / dropdown
  if(Math.abs(e.clientX-d.x)>4||Math.abs(e.clientY-d.y)>4)return; // a drag (for example to select text)
  const s=selText();if(s&&s!==d.sel)return;                    // text was selected
  let tr;
  if(document.contains(d.tr)){tr=e.target.closest&&e.target.closest('tr[data-prow],tr[data-trow]');if(tr!==d.tr||e.target.closest(ROW_CTL))return}
  else{/* the list re-rendered between press and release (a pending edit was saved): open the row that was pressed, found again by its id */
    const r=rowRec(d.tr);tr=document.querySelector(r.type==='project'?`tr[data-prow="${r.id}"]`:`tr[data-trow="${r.id}"]`);if(!tr)return}
  if(tr.dataset.prow&&ui.view!=='projects')return;
  /* the checkbox cell selects (a bigger target for the checkbox), it never opens */
  const ck=e.target.closest('td.ck');if(ck){const cb=ck.querySelector('input[type=checkbox]');if(cb)setTimeout(()=>cb.click(),0);return}
  openRow(tr);
});
/* Enter on a focused row (not inside one of its fields) opens it */
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.altKey||e.ctrlKey||e.metaKey)return;const tr=e.target;
  if(!tr.matches||!tr.matches('tr[data-prow],tr[data-trow]'))return;e.preventDefault();openRow(tr)});

/* ---------- Table settings (width + wrap per column) for Projects and Tasks — same look as Resources, independent preferences ---------- */
/* stable column ids. Projects: proj, svc, pm, status, deliv, tasks, due, act. Tasks: name + the TCOLS keys. */
const PJCOLS=[['proj','Project',260,true],['svc','Services',170,false],['pm','PM',150,false],['status','Status',128,false],['deliv','Delivered',96,false],['tasks','Open tasks',96,false],['due','Next due',190,false],['act','Actions',48,null]];
const TKDEF={name:['Task',280,false],project:['Project',200,true],deliverable:['Deliverable',170,true],assignee:['Assignee',150,false],status:['Status',150,false],due:['Due',150,true],priority:['Priority',100,false],phase:['Phase',160,true],service:['Discipline',130,false],source:['Source',130,false],updated:['Updated',110,false],created:['Created',110,false]};
const TKALL=Object.entries(TKDEF).map(([k,[l,w,wr]])=>[k,l,w,wr]);
const TS_MIN=36,TS_MAX=600;
const TSK={
  pj:{pref:'projCols',all:()=>PJCOLS,shown:()=>PJCOLS,shell:'pj-shell',table:'pj-table',v:'--pw-',label:'Projects table settings',hint:'Projects list. Changes apply immediately and are kept on this browser.'},
  tk:{pref:'taskCols',all:()=>TKALL,shown:()=>{const c=ctxOf(curPid()).cfg;return [TKALL[0],...c.columns.map(k=>TKALL.find(x=>x[0]===k)).filter(Boolean)]},shell:'tk-shell',table:'tk-table',v:'--tw-',label:'Tasks table settings',hint:'Task and the visible fields of this view (choose and order them in Fields). Kept on this browser for every task table.'}};
function tsCfg(key){const D=TSK[key],c=prefs[D.pref]||{},o={};D.all().forEach(([k,,w,wr])=>{const x=c[k]||{};o[k]={w:Number.isFinite(+x.w)&&x.w>=TS_MIN&&x.w<=TS_MAX?Math.round(+x.w):w,wrap:wr===null?false:(typeof x.wrap==='boolean'?x.wrap:wr)}});return o}
function tsShellStyle(key){const D=TSK[key],c=tsCfg(key);return D.all().map(([k])=>`${D.v}${k}:${c[k].w}px`).join(';')}
function tsWrapCls(key){const D=TSK[key],c=tsCfg(key);return D.all().filter(([k,,,wr])=>wr!==null&&!c[k].wrap).map(([k])=>' nw-'+k).join('')}
function tsApply(key){const D=TSK[key],sh=document.getElementById(D.shell),t=document.getElementById(D.table);if(sh)sh.setAttribute('style',tsShellStyle(key));
  if(t){D.all().forEach(([k])=>t.classList.remove('nw-'+k));tsWrapCls(key).trim().split(/\s+/).filter(Boolean).forEach(c=>t.classList.add(c))}}
const projShellStyle=()=>tsShellStyle('pj'),projWrapCls=()=>tsWrapCls('pj'),applyProjCols=()=>tsApply('pj');
const tsFromK={};
function closeTSK(key,back){const m=document.getElementById(key+'-tset');if(!m||m.hidden)return false;m.hidden=true;const b=document.getElementById(key+'-tset-btn');if(b)b.setAttribute('aria-expanded','false');if(back&&tsFromK[key]&&document.contains(tsFromK[key]))tsFromK[key].focus();return true}
const closePJ=b=>closeTSK('pj',b),closeTK=b=>closeTSK('tk',b);
/* floating panels open under their button, right-aligned with it, always inside the viewport */
function placePop(m,btn){const r=btn.getBoundingClientRect(),mr=m.getBoundingClientRect();
  m.style.left=Math.max(8,Math.min(r.right-mr.width,innerWidth-mr.width-8))+'px';
  m.style.top=(r.bottom+6+mr.height>innerHeight-8?Math.max(8,r.top-6-mr.height):r.bottom+6)+'px'}
function openTSK(key,btn){
  const D=TSK[key];tsFromK[key]=btn;const c=tsCfg(key),id=key+'-tset';let m=document.getElementById(id);
  if(!m){m=document.createElement('div');m.id=id;m.className='cappop tset';m.setAttribute('role','dialog');document.body.appendChild(m)}
  m.setAttribute('aria-label',D.label);
  m.innerHTML=`<div class="cp-h"><b>Table settings</b><button type="button" class="iconbtn" data-act="${key}-tset-close" aria-label="Close">✕</button></div>
    <p class="hint" style="margin:0 0 4px">${D.hint}</p>
    <div class="tsgrid"><span class="tsh">Column</span><span class="tsh">Width (px)</span><span class="tsh">Wrap text</span>
    ${D.shown().map(([k,l,d,wr])=>`<label for="${key}-w-${k}">${l}</label><input class="in" type="number" id="${key}-w-${k}" data-tsk="${key}" data-tsw2="${k}" min="${TS_MIN}" max="${TS_MAX}" step="2" value="${c[k].w}" aria-label="${l} width in pixels (default ${d})"><label class="chk"${wr===null?' title="Not applicable to the actions menu"':''}><input type="checkbox" id="${key}-r-${k}" data-tsk="${key}" data-tsr2="${k}"${c[k].wrap?' checked':''}${wr===null?' disabled':''} aria-label="${l}: wrap text${wr===null?' (not applicable)':''}"></label>`).join('')}</div>
    <div class="cp-act"><button type="button" class="btn sm ghost" data-act="${key}-tset-reset">Reset defaults</button><span class="spacer"></span><button type="button" class="btn sm primary" data-act="${key}-tset-close">Done</button></div>`;
  m.hidden=false;btn.setAttribute('aria-expanded','true');placePop(m,btn);m.querySelector('input').focus();
}
const openPJ=b=>openTSK('pj',b),openTK=b=>openTSK('tk',b);
function tsToggle(key,btn){const m=document.getElementById(key+'-tset');if(m&&!m.hidden){closeTSK(key,true);return}openTSK(key,btn)}
function tsReset(key){prefs[TSK[key].pref]={};savePrefs();if(key==='tk')render();else tsApply(key);const b=document.getElementById(key+'-tset-btn');if(b)openTSK(key,b);toast(`${key==='pj'?'Projects':'Tasks'} table settings reset to defaults`)}
function setTSK(key,k,patch){const D=TSK[key],c=tsCfg(key);c[k]={...c[k],...patch};prefs[D.pref]=c;savePrefs();
  /* Task names switch between a one-line field and a wrapping text area, so that change re-renders; everything else is applied in place */
  if(key==='tk'&&k==='name'&&'wrap' in patch){render();const i=document.getElementById(`tk-r-name`);i&&i.focus()}else tsApply(key)}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.tsw2)return;const v=+el.value;
  if(Number.isFinite(v)&&v>=TS_MIN&&v<=TS_MAX){el.removeAttribute('aria-invalid');setTSK(el.dataset.tsk,el.dataset.tsw2,{w:Math.round(v)})}else el.setAttribute('aria-invalid','true')});
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.tsw2){const k=el.dataset.tsk,v=Math.max(TS_MIN,Math.min(TS_MAX,Math.round(+el.value||tsCfg(k)[el.dataset.tsw2].w)));el.value=v;el.removeAttribute('aria-invalid');setTSK(k,el.dataset.tsw2,{w:v});return}
  if(el.dataset.tsr2){setTSK(el.dataset.tsk,el.dataset.tsr2,{wrap:el.checked})}});
document.addEventListener('mousedown',e=>{['pj','tk'].forEach(k=>{const m=document.getElementById(k+'-tset');if(m&&!m.hidden&&!m.contains(e.target)&&!e.target.closest('#'+k+'-tset-btn'))closeTSK(k)})},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;for(const k of ['pj','tk']){const m=document.getElementById(k+'-tset');if(m&&!m.hidden){e.preventDefault();e.stopImmediatePropagation();closeTSK(k,true);return}}},true);
/* the toolbar block on the right: Table settings above the counter */
function tableMeta(key,count,show){return `<div class="tmeta">${show?`<button class="btn sm ghost" id="${key}-tset-btn" data-act="${key}-tset" aria-haspopup="dialog" aria-expanded="false" aria-controls="${key}-tset">⚙ Table settings</button>`:''}<span class="muted tcount">${count}</span></div>`}
/* wrapping task names: a text area that grows with its content (Enter saves, it never adds a line break) */
function tkGrow(el){el.style.height='auto';el.style.height=el.scrollHeight+'px'}
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('tnm-wrap'))tkGrow(e.target)});
document.addEventListener('keydown',e=>{const el=e.target;if(e.key==='Enter'&&el.classList&&el.classList.contains('tnm-wrap')){e.preventDefault();el.value=el.value.replace(/\s*\n\s*/g,' ');el.dispatchEvent(new Event('change',{bubbles:true}))}});
function tkGrowAll(){document.querySelectorAll('textarea.tnm-wrap').forEach(tkGrow)}

/* ======================= Workflow v2: company standard by phase + specialty, explicit import per project =======================
   S.workflow / S.workflowDraft = {version, appliedAt, demo, schema:2, steps:[step]}
   step  = {id (stable), phaseId, serviceId (specialty, from S.services; null = to classify), cat:'input'|'action'|'output', name, desc, deps:[stepId any phase/specialty], order, retired}
   project.wfScope  = {[phaseId]:{specs:[serviceId|'_none'], importedAt, v}}   which specialties we do internally in each configured phase
   project.wfDecide = {[stepId]:'internal'|'external'}                         decisions for requirements of phases not configured
   task.wfStepId + task.wfExecutionMode ('internal' | 'externalInput')         one record per project + step (shared by every consumer)
   task.wfConsultant, task.wfOutOfScope (history), task.wfReview + task.wfModeLog (change of source to review)
   deliverable.reqTaskIds = workflow tasks (internal or external inputs) a delivery needs */
const WF_COLS=[['input','Inputs'],['action','Actions'],['output','Outputs']];
const WF_CAT={input:'Input',action:'Action',output:'Output'};
const WF_SPEC_NAMES=['Electrical','Mechanical','Hydraulics','Fire','Coordination'];
/* activity type = shape and behaviour, independent of the category (where it belongs: Input / Action / Output) */
const WF_TYPES=[['normal','Standard'],['info','Information'],['document','Document'],['decision','Decision'],['qa','QA / Approval']];
const WF_TYPE=Object.fromEntries(WF_TYPES);
const wfType=s=>s&&WF_TYPE[s.type]?s.type:'normal';
const wfIsDec=s=>{const t=wfType(s);return t==='decision'||t==='qa'};
const WF_BR=[['yes','Yes'],['no','No']];   // stable branch ids; labels are display only
const WF_EMPTY={version:0,appliedAt:null,demo:false,schema:2,steps:[]};
const wfStd=()=>S.workflow||WF_EMPTY;
const wfEdit=()=>S.workflowDraft||wfStd();
const wfClone=x=>JSON.parse(JSON.stringify(x));
function wfDraft(){if(!S.workflowDraft)S.workflowDraft=wfClone(wfStd());return S.workflowDraft}
function wfDirty(){const d=S.workflowDraft,s=wfStd();return !!d&&(JSON.stringify(d.steps)!==JSON.stringify(s.steps)||JSON.stringify(d.layout||{})!==JSON.stringify(s.layout||{}))}
function wfStep(id,std){return (std||wfStd()).steps.find(s=>s.id===id)||null}
const wfSpecOf=s=>s&&s.serviceId||'_none';
function wfSpecName(id){return id==='_none'?'To classify':(service(id)?.name||'Unknown')}
/* specialties: the five workflow flows first, then any other discipline of the catalogue */
function wfSpecs(std){const all=S.services.map(s=>s.id),byN=n=>(S.services.find(s=>s.name.toLowerCase()===n.toLowerCase())||{}).id,co=byN('Coordination'),k=WF_SPEC_NAMES.filter(n=>n!=='Coordination').map(byN).filter(Boolean);
  /* Electrical, Mechanical, Hydraulics, Fire, any other specialty (in its order), and Coordination last: it involves all of them */
  const out=[...k,...all.filter(id=>!k.includes(id)&&id!==co),...(co?[co]:[])];if((std||wfEdit()).steps.some(s=>!s.retired&&!s.serviceId))out.push('_none');return out}
function wfPhaseSteps(std,phaseId,retired){return std.steps.filter(s=>s.phaseId===phaseId&&!!s.retired===!!retired).sort((a,b)=>WF_COLS.findIndex(c=>c[0]===a.cat)-WF_COLS.findIndex(c=>c[0]===b.cat)||a.order-b.order)}
function wfColSteps(std,phaseId,cat,specs){return std.steps.filter(s=>s.phaseId===phaseId&&!s.retired&&s.cat===cat&&(!specs||specs.includes(wfSpecOf(s)))).sort((a,b)=>a.order-b.order)}
function wfReaches(std,from,target,seen=new Set()){if(from===target)return true;if(seen.has(from))return false;seen.add(from);const s=wfStep(from,std);return !!s&&s.deps.some(d=>wfReaches(std,d,target,seen))}
function wfCycle(std,stepId,depId){return stepId===depId||wfReqReaches(std,depId,stepId)}
/* three kinds of connection:
   - normal dependency (deps): a requirement to run an activity; never circular;
   - conditional transition (Decision / QA outlet to an activity AFTER it): runs after that answer;
   - review return (a No outlet to earlier work, or a "return" link from rework back to earlier work): the work is
     repeated. Returns never count as requirements, so a loop never blocks the initial work. */
function wfIsBack(std,decId,tid){return wfReaches(std,decId,tid)}   // the decision already needs that activity: going there is a return
function wfReqPreds(std,s){const out=new Set(s.deps);(std||wfStd()).steps.forEach(d=>{if(d.retired||!wfIsDec(d)||!d.branches)return;['yes','no'].forEach(b=>{if(d.branches[b]===s.id&&!wfIsBack(std,d.id,s.id))out.add(d.id)})});return [...out]}
function wfReqReaches(std,from,target,seen=new Set()){if(from===target)return true;if(seen.has(from))return false;seen.add(from);const s=wfStep(from,std);return !!s&&wfReqPreds(std,s).some(d=>wfReqReaches(std,d,target,seen))}

