/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- modal (short operations and confirmations only) ---------- */
let lastFocus=null,confirmResolve=null;
function openModal(html,{wide=false,focus=null}={}){
  hideTip();if(!modalRoot.innerHTML)lastFocus=document.activeElement;
  modalRoot.innerHTML=`<div class="mb" data-act="modal-bg"><div class="modal${wide?' wide':''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const m=modalRoot.querySelector('.modal');const f=focus?m.querySelector(focus):m.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea,button.primary');
  if(f){f.focus();if(f.select&&f.type==='text')f.select()}
}
function closeModal(silent){
  hideTip();if(!modalRoot.innerHTML)return;modalRoot.innerHTML='';
  if(confirmResolve){const r=confirmResolve;confirmResolve=null;r(false)}
  if(!silent&&lastFocus&&document.contains(lastFocus))try{lastFocus.focus()}catch(e){}
}
function hideMenus(except){document.querySelectorAll('.menu').forEach(m=>{if(m!==except){m.hidden=true;const b=m.previousElementSibling;if(b)b.setAttribute('aria-expanded','false')}})}

