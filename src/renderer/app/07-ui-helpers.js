/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- UI helpers ---------- */
const TGLYPH={'To Do':'○','In progress':'→','Waiting information':'◷','QA':'◇','Done':'✓'};
const DGLYPH={'Planned':'○','In progress':'→','Waiting information':'◷','Delivered':'✓'};
const RANGES={'3w':{days:21,step:7,label:'3 weeks'},'6w':{days:42,step:14,label:'6 weeks'},'3m':{days:91,step:28,label:'3 months'}};
const initials=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
const shortName=n=>{const p=String(n||'').trim().split(/\s+/);return p.length>1?`${p[0]} ${p[p.length-1][0]}.`:String(n||'')};
const peopleSorted=()=>S.people.slice().sort((a,b)=>a.name.localeCompare(b.name));
const statusOpts=(list,v,gl)=>list.map(x=>`<option value="${esc(x)}"${x===v?' selected':''}>${gl[x]?gl[x]+' ':''}${esc(x)}</option>`).join('');
const dd2=n=>{const[,m,d]=ymd(n);return `${String(d).padStart(2,'0')} ${MON[m]}`};
const hhmm=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const activeProjects=()=>S.projects.filter(p=>!p.archived).sort(codeSort);
function projOpts(sel,list){return (list||activeProjects()).map(p=>`<option value="${p.id}"${p.id===sel?' selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}
function taskStatusChip(s){return `<span class="chip ${s==='Done'?'c-o':s==='Waiting information'?'c-w':s==='In progress'||s==='QA'?'c-a':'c-n'}">${TGLYPH[s]} ${esc(s)}</span>`}
function dlStatusChip(d){
  if(isOverdue(d))return `<span class="chip c-d">! Overdue</span>`;
  if(d.status==='Delivered')return `<span class="chip c-o">✓ Delivered</span>`;
  if(!d.due)return `<span class="chip c-u">No due date</span>`;
  if(d.status==='Waiting information')return `<span class="chip c-w">◷ Waiting info</span>`;
  if(d.status==='In progress')return `<span class="chip c-a">→ In progress</span>`;
  return `<span class="chip c-n">○ Planned</span>`;
}
function taskCompletion(d){const ts=delivTasks(d.id);if(!ts.length)return 'No tasks';const done=ts.filter(t=>t.status==='Done').length;return `${done} of ${plural(ts.length,'task')} done`}

/* toasts with optional Undo */
function toast(msg,kind,undo){
  const box=document.getElementById('toasts');const el=document.createElement('div');el.className='toast'+(kind==='err'?' err':'');el.setAttribute('role',kind==='err'?'alert':'status');
  const sp=document.createElement('span');sp.textContent=msg;el.appendChild(sp);
  if(undo){const b=document.createElement('button');b.type='button';b.textContent='Undo';b.addEventListener('click',()=>{el.remove();undo();toast('Change undone')});el.appendChild(b)}
  box.appendChild(el);setTimeout(()=>el.remove(),undo?8000:kind==='err'?4800:2600);while(box.children.length>3)box.firstChild.remove();
}
function snapshot(objs){
  const c=objs.filter(Boolean).map(o=>[o,JSON.parse(JSON.stringify(o))]);
  return ()=>{c.forEach(([o,v])=>{Object.keys(o).forEach(k=>delete o[k]);Object.assign(o,v)});save();render()};
}
/* save indicator (header + panel) */
let saveTimer=null;
function saveText(){return !storageOK?'Not saved: export a backup':lastSaved?`Saved ${hhmm(lastSaved)}`:'Saved'}
function saveIndHTML(id){return `<span class="save-ind${storageOK?'':' bad'}" id="${id||'save-ind'}" title="Stored in this browser on this computer only"><span>${saveText()}${id?'':' · this browser only'}</span></span>`}
function setSaveInd(){
  ['save-ind','pn-save'].forEach(id=>{const el=document.getElementById(id);if(el&&storageOK){el.className='save-ind saving';el.firstElementChild.textContent='Saving…'}});
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{['save-ind','pn-save'].forEach(id=>{const el=document.getElementById(id);if(el)el.outerHTML=saveIndHTML(id==='pn-save'?'pn-save':'')})},380);
}
function fieldError(el,msg){
  el.setAttribute('aria-invalid','true');
  const host=el.closest('.fld')||el.closest('td')||el.parentElement;let er=host.querySelector(':scope > .ferr');
  if(!er){er=document.createElement('em');er.className='ferr';host.appendChild(er)}
  er.textContent=msg;er.id=er.id||'er-'+(el.id||Math.random().toString(36).slice(2));el.setAttribute('aria-describedby',er.id);
}
function clearFieldError(el){el.removeAttribute('aria-invalid');const host=el.closest('.fld')||el.closest('td')||el.parentElement;const er=host&&host.querySelector(':scope > .ferr');if(er)er.remove()}

function menuHTML(key,items){
  return `<div class="menu-wrap"><button class="btn sm more-btn" data-act="menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions">More ${ICON.chev}</button><div class="menu" role="menu" hidden>${items.map(i=>`<button role="menuitem" class="${i.cls||''}" data-act="${i.act}" data-id="${i.id||''}">${i.label}</button>`).join('')}</div></div>`;
}

