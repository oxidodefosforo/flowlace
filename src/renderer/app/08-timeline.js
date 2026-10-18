/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- timeline window ---------- */
function win(){const r=RANGES[prefs.range]||RANGES['3w'];const s=ui.winStart;return {s,e:s+r.days-1,days:r.days,step:r.step}}
const pctOf=(n,w)=>(n-w.s)/w.days*100;
function trackW(){
  const m=document.getElementById('main');const ws=document.getElementById('ws');
  const lw=parseFloat(getComputedStyle(ws||document.documentElement).getPropertyValue('--labelw'))||300;
  return Math.max(470,((m?m.clientWidth:innerWidth)-34)-lw);
}
function winControls(noLegend){
  const w=win();
  return `<div class="seg" role="group" aria-label="Window length">${Object.entries(RANGES).map(([k,r])=>`<button data-act="range" data-v="${k}" aria-pressed="${prefs.range===k}">${r.label}</button>`).join('')}</div>
   <button class="btn sm" data-act="win" data-d="-1" aria-label="Previous ${w.step} days">‹ Previous</button><button class="btn sm" data-act="win-today">Today</button><button class="btn sm" data-act="win" data-d="1" aria-label="Next ${w.step} days">Next ›</button>
   <span class="rng">${fmtDN(w.s)} – ${fmtDN(w.e)}</span>${noLegend?'':legendCtl()}`;
}
function scaleHTML(w){
  let t1='',t2='',ov='';const t=todayDN(),p=n=>pctOf(n,w),wd=100/w.days;
  const dayCells=w.days<=42&&trackW()/w.days>=17,pxW=trackW()/w.days*7;
  if(dayCells){
    for(let n=w.s-dowMon(w.s);n<=w.e;n+=7){const a=Math.max(n,w.s),b=Math.min(n+6,w.e),span=b-a+1;
      t1+=`<div class="sc1" style="left:${p(a)}%;width:${span*wd}%" title="Week ${isoWeek(n)}, starting ${fmtDN(n)}"><span class="w">W${isoWeek(n)}</span>${span>=3?dd2(n):''}</div>`;
      if(a>w.s)ov+=`<div class="gl strong" style="left:${p(a)}%"></div>`}
    for(let n=w.s;n<=w.e;n++){const dw=dowMon(n),we=dw>=5,[,,dd]=ymd(n);
      t2+=`<div class="sc2${we?' we':''}${n===t?' today':''}" style="left:${p(n)}%;width:${wd}%" title="${fmtDN(n)}">${w.days<=21?`<i>${'MTWTFSS'[dw]}</i>`:''}${dd}</div>`;
      if(we)ov+=`<div class="wkd" style="left:${p(n)}%;width:${wd}%"></div>`;else if(w.days<=21&&n>w.s&&dw!==0)ov+=`<div class="gl" style="left:${p(n)}%"></div>`}
  }else{
    if(w.days<=42)for(let n=w.s;n<=w.e;n++){if(dowMon(n)>=5)ov+=`<div class="wkd" style="left:${p(n)}%;width:${wd}%"></div>`}
    for(let m=monthStart(w.s);m<=w.e;m=nextMonth(m)){const a=Math.max(m,w.s),b=Math.min(nextMonth(m)-1,w.e),[y,mo]=ymd(m);
      t1+=`<div class="sc1" style="left:${p(a)}%;width:${(b-a+1)*wd}%">${MON[mo]} ${y}</div>`;if(a>w.s)ov+=`<div class="gl strong" style="left:${p(a)}%"></div>`}
    for(let n=w.s-dowMon(w.s);n<=w.e;n+=7){const a=Math.max(n,w.s),b=Math.min(n+6,w.e);const isT=t>=n&&t<=n+6;
      t2+=`<div class="sc2 wk${isT?' today':''}" style="left:${p(a)}%;width:${(b-a+1)*wd}%" title="Week ${isoWeek(n)}, starting ${fmtDN(n)}">${pxW>=44?`<i>W${isoWeek(n)}</i>${b-a>=3?dd2(n):''}`:pxW>=20&&b-a>=3?ymd(n)[2]:''}</div>`;if(a>w.s)ov+=`<div class="gl" style="left:${p(a)}%"></div>`}
  }
  if(t>=w.s&&t<=w.e)ov+=`<div class="todayline" style="left:${p(t)+wd/2}%" title="Today"></div>`;
  return {t1,t2,ov};
}
function delivAria(d){const p=project(d.projectId),o=isOverdue(d);return `${d.name}, ${p?p.code:''}, ${phName(d.phaseId)}, due ${fmt(d.due)}${d.start?`, starts ${fmt(d.start)}`:''}, responsible ${pname(ownerId(d))}, ${d.status}${o?', overdue':''}. Enter opens details; arrow keys move it by a day.`}
function markerHTML(d,w,y,small){
  const n=iso2dn(d.due),over=isOverdue(d),done=d.status==='Delivered',wait=d.status==='Waiting information'&&!over;
  const sel=ui.panel&&ui.panel.type==='deliv'&&ui.panel.id===d.id;
  return `<div class="mk${small?' small':''}${over?' over':''}${done?' done':''}${wait?' wait':''}${sel?' sel':''}" id="mk-${d.id}" role="button" tabindex="0" data-did="${d.id}" data-kind="ms" style="left:${pctOf(n,w)+50/w.days}%;top:${y}px;--c:${phColor(d.phaseId)}" aria-label="${esc(delivAria(d))}"><span class="dia"></span>${over?'<span class="sym over" aria-hidden="true">!</span>':done?'<span class="sym done" aria-hidden="true">✓</span>':''}</div>`;
}
/* deliverable diamonds in one lane centred at y; close dates stack (max 3), more become a counter */
function markersHTML(ds,w,cy){
  const items=ds.filter(d=>d.due&&iso2dn(d.due)>=w.s&&iso2dn(d.due)<=w.e).sort((a,b)=>a.due<b.due?-1:a.due>b.due?1:phIdx(a)-phIdx(b));
  const ppd=trackW()/w.days,gap=Math.max(1,Math.ceil(19/ppd));const groups=[];
  items.forEach(d=>{const n=iso2dn(d.due),g=groups[groups.length-1];if(g&&n-g.s<gap)g.items.push(d);else groups.push({s:n,items:[d]})});
  return groups.map(g=>{
    const k=g.items.length;
    if(k===1)return markerHTML(g.items[0],w,cy,false);
    if(k<=3){const offs=k===2?[-6,6]:[-9,0,9];return g.items.map((d,i)=>markerHTML(d,w,cy+offs[i],true)).join('')}
    const anyO=g.items.some(isOverdue),last=iso2dn(g.items[k-1].due);
    return `<button class="cl${anyO?' over':''}" data-act="cluster" data-ids="${g.items.map(d=>d.id).join(',')}" style="left:${pctOf(g.s,w)+50/w.days}%;top:${cy}px" aria-label="${k} deliverables ${g.s===last?`due ${fmtDN(g.s)}`:`due ${fmtDN(g.s)} to ${fmtDN(last)}`}${anyO?', some overdue':''}. Open the list." title="${esc(g.items.map(d=>`${d.name} · ${fmt(d.due)}`).join('\n'))}"><span class="dots">${g.items.slice(0,3).map(d=>`<i style="--c:${phColor(d.phaseId)}"></i>`).join('')}</span>${anyO?'!':''}${k}</button>`;
  }).join('');
}
function edgesHTML(ds,w,pid,y){
  const before=ds.filter(d=>d.due&&d.status!=='Delivered'&&iso2dn(d.due)<w.s),after=ds.filter(d=>d.due&&d.status!=='Delivered'&&iso2dn(d.due)>w.e);
  const bo=before.filter(isOverdue).length;let h='';
  if(before.length)h+=`<button class="edge corner l${bo?' bad':''}" style="top:${y}px" data-act="edge" data-pid="${pid}" data-side="before" aria-label="${plural(before.length,'pending deliverable')} before this window${bo?`, ${bo} overdue`:''}">‹ ${bo?'! ':''}${before.length}</button>`;
  if(after.length)h+=`<button class="edge corner r" style="top:${y}px" data-act="edge" data-pid="${pid}" data-side="after" aria-label="${plural(after.length,'pending deliverable')} after this window">${after.length} ›</button>`;
  return h;
}
/* phase bars */
function ppAria(pp,cl,cr){const p=project(pp.projectId),late=ppLate(pp);return `${ppName(pp)} phase, ${p?p.code:''}, ${fmt(pp.start)} to ${fmt(pp.end)}, ${pp.status}${late?', past its end date':''}${cl?', started before this window':''}${cr?', continues after this window':''}. Enter opens the phase; arrow keys move it by a day.`}
function phaseLanes(ps,w){
  // One lane per visible phase, always in the global order from Settings (Fee, Sketch, DD, Tender, Construction…),
  // even when phases don't overlap. Dates are never changed.
  const items=ps.filter(pp=>ppScheduled(pp)&&pp.status!=='Not applicable').map(pp=>({pp,s:iso2dn(pp.start),e:iso2dn(pp.end)})).filter(x=>x.e>=w.s&&x.s<=w.e).sort((a,b)=>(phIdxId(a.pp.phaseId)-phIdxId(b.pp.phaseId))||(a.s-b.s));
  items.forEach((x,i)=>x.lane=i);
  return {items,n:items.length};
}
function phaseBarHTML(x,w,top,h){
  const pp=x.pp,a=Math.max(x.s,w.s),b=Math.min(x.e,w.e),cl=x.s<w.s,cr=x.e>w.e,late=ppLate(pp),st=pp.status;
  const sel=ui.panel&&ui.panel.type==='pphase'&&ui.panel.id===pp.id;
  const cls=`pb${cl?' xl':''}${cr?' xr':''}${st==='Completed'?' done':''}${st==='On hold'?' hold':''}${st==='Not started'?' ns':''}${late?' late':''}${sel?' sel':''}`;
  const tag=late?'<b class="pt late">!</b>':st==='Completed'?'<b class="pt">✓</b>':st==='On hold'?'<b class="pt">‖</b>':'';
  return `<div class="${cls}" id="pb-${pp.id}" role="button" tabindex="0" data-ppid="${pp.id}" data-kind="phase" style="left:${pctOf(a,w)}%;width:${(b-a+1)/w.days*100}%;top:${top}px;height:${h}px;--c:${phColor(pp.phaseId)}" aria-label="${esc(ppAria(pp,cl,cr))}">${cl?'<span class="cont l" aria-hidden="true">‹</span>':'<span class="h hl" title="Drag to change the start date"></span>'}<span class="pbl">${tag}${esc(ppName(pp))}</span>${cr?'<span class="cont r" aria-hidden="true">›</span>':'<span class="h hr" title="Drag to change the end date"></span>'}</div>`;
}
const LANE_H=15,LANE_GAP=3,MS_H=26,BAND_MS=22;
/* project label: days to the next pending deadline (real next deliverable, even if filters hide it); Perth calendar */
function rowSub(p){
  const np=nextPending(delivsOf(p.id));if(!np)return '<span class="dl none">No upcoming deadline</span>';
  const t=iso2dn(perthToday()),d=iso2dn(np.due),n=d-t,wk=iso2dn(thisWeek()),inWk=d>=wk&&d<=wk+6;
  const txt=n<0?`${plural(-n,'day')} overdue`:n===0?'Due today':n===1?'Due tomorrow':`Due in ${n} days`;
  return `<span class="dl${n<0?' over':n<=1?' soon':''}" title="${esc(np.name)} · ${fmt(np.due)}">${n<0?'<span aria-hidden="true">! </span>':''}${txt}</span>${inWk?'<span class="wkchip">This week</span>':''}`;
}
function projRowHTML(p,ds,ps,w){
  const exp=!!prefs.expanded[p.id],sel=ui.panel&&ui.panel.type==='project'&&ui.panel.id===p.id;
  // Each phase gets its own band: the bar, then that phase's deliverables directly underneath it.
  const {items}=phaseLanes(ps,w),inWin=d=>d.due&&iso2dn(d.due)>=w.s&&iso2dn(d.due)<=w.e;
  const phIds=[...new Set([...items.map(x=>x.pp.phaseId),...ds.filter(inWin).map(d=>d.phaseId)])].sort((a,b)=>phIdxId(a)-phIdxId(b));
  let y=6,track='',lastMid=null;
  phIds.forEach(ph=>{const bar=items.find(x=>x.pp.phaseId===ph),md=ds.filter(d=>d.phaseId===ph&&inWin(d));
    if(bar){track+=phaseBarHTML(bar,w,y,LANE_H);y+=LANE_H+(md.length?0:LANE_GAP+1)}
    if(md.length){const cy=y+BAND_MS/2;track+=markersHTML(md,w,cy);lastMid=cy;y+=BAND_MS+LANE_GAP}});
  const hasEdges=ds.some(d=>d.due&&d.status!=='Delivered'&&(iso2dn(d.due)<w.s||iso2dn(d.due)>w.e));
  if(hasEdges&&lastMid==null){lastMid=y+BAND_MS/2;y+=BAND_MS+LANE_GAP}
  const H=Math.max(48,y+3);if(lastMid==null)lastMid=H/2;
  track+=edgesHTML(ds,w,p.id,lastMid-8);
  return `<div class="tl-row${sel?' sel':''}" data-pid="${p.id}"><div class="tl-label"><div class="tl-l1"><button class="tgl" data-act="expand" data-id="${p.id}" aria-expanded="${exp}" aria-label="${exp?'Hide':'Show'} phases of ${esc(p.name)}">${ICON.chev}</button><div class="tl-id"><button class="tl-name" id="pr-${p.id}" data-act="panel-project" data-id="${p.id}" title="${esc(p.code)} · ${esc(p.name)}"><span class="code">${esc(p.code)}</span><span class="nm">${esc(p.name)}</span></button><div class="tl-sub">${rowSub(p)}</div></div></div></div>
   <div class="tl-track" style="min-height:${H}px">${track}</div></div>`;
}
function phaseRowHTML(pp,w,ds){
  const g=phase(pp.phaseId),sel=ui.panel&&ui.panel.type==='pphase'&&ui.panel.id===pp.id,late=ppLate(pp),na=pp.status==='Not applicable';
  let bar='';
  if(na)bar=`<span class="pb-note">Not applicable</span>`;
  else if(!ppScheduled(pp))bar=`<button class="unsch" data-act="panel-pphase" data-id="${pp.id}">Unscheduled · set dates</button>`;
  else{const s=iso2dn(pp.start),e=iso2dn(pp.end);
    if(e<w.s)bar=`<button class="edge l${late?' bad':''}" style="top:6px" data-act="panel-pphase" data-id="${pp.id}">‹ ended ${dd2(e)}</button>`;
    else if(s>w.e)bar=`<button class="edge r" style="top:6px" data-act="panel-pphase" data-id="${pp.id}">starts ${dd2(s)} ›</button>`;
    else bar=phaseBarHTML({pp,s,e},w,6,LANE_H)}
  const out=ds.filter(outOfPhase).length;
  const st=late?'<span class="chip c-d">! Late</span>':pp.status==='Completed'?'<span class="chip c-o">✓</span>':pp.status==='On hold'?'<span class="chip c-w">‖ On hold</span>':'';
  return `<div class="tl-row sub${sel?' sel':''}${na?' na':''}"><div class="tl-label"><div class="tl-dl"><span class="sw" style="--c:${g.color}"></span><button class="plainbtn" data-act="panel-pphase" data-id="${pp.id}" title="${esc(g.name)} · ${esc(pp.status)}">${esc(g.name)}</button>${st}${out?`<span class="chip c-w" title="${plural(out,'deliverable')} outside the phase dates">${out} outside</span>`:''}</div></div>
   <div class="tl-track" style="height:${6+LANE_H+MS_H+2}px">${bar}${edgesHTML(ds,w,pp.projectId+'" data-phase="'+pp.phaseId,6+LANE_H+5)}${markersHTML(ds,w,6+LANE_H+MS_H/2)}</div></div>`;
}
function timelineHTML(rows,{single=false}={}){
  const w=win(),{t1,t2,ov}=scaleHTML(w);let body='';
  rows.forEach(({p,ds,ps})=>{
    if(!single)body+=projRowHTML(p,ds,ps,w);
    if(single||prefs.expanded[p.id]){const list=single?ppOf(p.id):ps;list.forEach(pp=>{body+=phaseRowHTML(pp,w,ds.filter(d=>d.phaseId===pp.phaseId))});if(!list.length)body+=`<div class="tl-row sub"><div class="tl-label"><span class="tl-dl muted">No phases in this project</span></div><div class="tl-track"></div></div>`}
  });
  return `<div class="tlx"><div class="tl${single?' single':''}" data-ws="${w.s}" data-days="${w.days}"><div class="tl-head"><div class="tl-corner">${single?'Phase':'Project'}</div><div class="tl-scale" aria-hidden="true"><div class="tier">${t1}</div><div class="tier t2">${t2}</div></div></div><div class="tl-body"><div class="tl-ov">${ov}</div>${body}</div></div></div>`;
}
function legendHTML(){
  return `<div class="legend" aria-label="Legend">${S.phases.filter(p=>p.active||S.projectPhases.some(x=>x.phaseId===p.id)).map(p=>`<span><i class="lg-bar" style="--c:${p.color}"></i>${esc(p.name)}</span>`).join('')}<span class="lg-sep"></span><span><i class="lg-bar done" style="--c:var(--muted)"></i>✓ Completed</span><span><i class="lg-bar hold" style="--c:var(--muted)"></i>‖ On hold</span><span><i class="lg-ic over">!</i>Late / overdue</span><span>‹ › continues outside the window</span><span class="lg-sep"></span><span><i class="dia-sw" style="--c:var(--muted)"></i>Deliverable</span><span><i class="lg-ic done">✓</i>Delivered</span><span class="lg-sep"></span><span>Drag a bar to move a phase, its ends to change dates; drag a diamond to change a due date. Or select it and use ← →.</span></div>`;
}

/* tooltip: tied to the element that opened it */
let tipOwner=null;
function tipAllowed(el){const m=document.getElementById('main');return !!(el&&el.isConnected&&m&&m.contains(el)&&!modalRoot.innerHTML&&!document.hidden)}
function showTip(el,s,e){
  if(!tipAllowed(el)){hideTip();return}
  let html='';
  if(el.dataset.kind==='phase'){const pp=pphase(el.dataset.ppid);if(!pp){hideTip();return}const p=project(pp.projectId);
    const sd=s!==undefined&&s!==null?s:iso2dn(pp.start),ed=e!==undefined?e:iso2dn(pp.end),late=!['Completed','Not applicable'].includes(pp.status)&&ed<todayDN();
    const ds=ppDelivs(pp),out=ds.filter(d=>d.due&&(iso2dn(d.due)>ed||iso2dn(d.start||d.due)<sd)).length;
    html=`<b>${esc(ppName(pp))}</b><span class="tm">${esc(p?.code||'')} · ${esc(p?.name||'')}</span><span>${fmtDN(sd)} → ${fmtDN(ed)} · ${ed-sd+1} days</span><span>${PPGLYPH[pp.status]} ${esc(pp.status)}${late?' · <span class="tw">! Past end date</span>':''}</span><span class="tm">${plural(ds.length,'deliverable')}${out?` · ${out} outside these dates`:''}</span>`;
  }else{const d=deliv(el.dataset.did);if(!d){hideTip();return}const p=project(d.projectId);
    const sd=s!==undefined?s:(d.start?iso2dn(d.start):null),ed=e!==undefined?e:iso2dn(d.due);const over=d.status!=='Delivered'&&ed<todayDN();
    html=`<b>${esc(d.name)}</b><span class="tm">${esc(p?.code||'')} · ${esc(phName(d.phaseId))}</span><span>${sd!=null?`${fmtDN(sd)} → ${fmtDN(ed)}`:`Due ${fmtDN(ed)}`}</span><span>${esc(pname(ownerId(d)))} · ${esc(d.status)}${over?' · <span class="tw">! Overdue</span>':''}</span>`}
  if(drag&&drag.moved)html+='<span class="tm">Release to save</span>';
  tip.innerHTML=html;tipOwner=el;tip.hidden=false;
  const r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
  let x=Math.min(Math.max(8,r.left-10),innerWidth-tw-8),y=r.bottom+8;if(y+th>innerHeight-8)y=r.top-th-8;tip.style.left=x+'px';tip.style.top=y+'px';
  requestAnimationFrame(watchTip);
}
function watchTip(){if(tip.hidden)return;if(!tipAllowed(tipOwner)){hideTip();return}requestAnimationFrame(watchTip)}
function hideTip(){tip.hidden=true;tipOwner=null}

