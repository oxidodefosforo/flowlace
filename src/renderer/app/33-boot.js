/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- boot ---------- */
ui.winStart=todayDN();ui.phOpen=new Set();ui.suggest={};ui.stab='phases';
load();wfBoot();applyTheme();ui.stab=prefs.stab||'phases';ui.phOpen=new Set(Array.isArray(prefs.phOpen)?prefs.phOpen:[]);
route();
setInterval(()=>{const t=todayDN();if(t!==window.__azDay){window.__azDay=t;if(!modalRoot.innerHTML&&!drag&&!(document.activeElement&&app.contains(document.activeElement)&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)))render()}},60000);
window.__azDay=todayDN();

document.addEventListener('toggle',e=>{const d=e.target;if(d.classList&&d.classList.contains('phcard')){d.open?ui.phOpen.add(d.dataset.ph):ui.phOpen.delete(d.dataset.ph)}},true);

