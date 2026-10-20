/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- workflow diagram: layout (presentation only — the logic stays in steps and "Depends on") ----------
   A layout belongs to a VIEW: a phase id (or "_all" for All phases in a project). It never holds structure:
     { n: { <stepId>: { x, dy } },          x in diagram pixels; dy relative to the top of the block's lane
       l: { <laneKey>: { h } },             lane height when last arranged (minimum; the content always fits)
       e: { "<fromStepId>><toStepId>": { s:[x, {l,dy,y}, x, …] } | { auto:true } },   orthogonal route (see below)
       auto: true }                         project only: ignore the standard's layout for this view
   Company workflow: std.layout[view] — part of the draft and published with it.
   Project: project.wfLayout[view] — adjustments applied over the published standard's layout; never changes it.
   Route "s": alternating coordinates of an orthogonal connector between the out-port of the source and the in-port
   of the target: horizontal to x0, vertical to y1, horizontal to x2 … vertical to the target's port, horizontal in.
   y values are stored relative to a lane, so routes follow their lanes when another lane grows. */
const WFL={W:196,H:84,GX:58,GY:12,LW:116,P:10,TOP:10,GAP:24,STUB:16,PAD:48,CL:8};
/* an arrow always leaves its source to the right and enters its target from the left (its direction is kept) */
function wfClampSegs(segs,S,E){const s=segs.slice(),L=s.length;s[0]=Math.max(s[0],S.x+WFL.CL);s[L-1]=Math.min(s[L-1],E.x-WFL.CL);if(L===1&&s[0]<S.x+WFL.CL)s[0]=Math.round((S.x+E.x)/2);return s}
const wfNum=v=>typeof v==='number'&&isFinite(v)?Math.round(v*10)/10:null;
function wfSegsNorm(s){
  if(!Array.isArray(s)||!s.length||s.length%2!==1||s.length>61)return null;const out=[];
  for(let i=0;i<s.length;i++){if(i%2===0){const x=wfNum(s[i]);if(x==null)return null;out.push(x)}
    else{const y=s[i];if(!y||typeof y!=='object')return null;const yy=wfNum(y.y);if(yy==null)return null;out.push({l:typeof y.l==='string'?y.l.slice(0,80):null,dy:wfNum(y.dy),y:yy})}}
  return out;
}
function wfLayNorm(v){
  if(!v||typeof v!=='object')return null;const o={n:{},l:{},e:{}};if(v.auto)o.auto=true;
  Object.entries(v.n||{}).forEach(([id,p])=>{const x=wfNum(p&&p.x),dy=wfNum(p&&p.dy);if(x!=null&&dy!=null&&id.length<=120)o.n[id]={x:Math.max(0,x),dy:Math.max(0,dy)}});
  Object.entries(v.l||{}).forEach(([l,p])=>{const h=wfNum(p&&p.h);if(h!=null&&h>0&&h<20000)o.l[l]={h}});
  Object.entries(v.e||{}).forEach(([k,p])=>{if(!/^[^>]{1,120}>[^>]{1,120}$/.test(k)||!p)return;if(p.auto){o.e[k]={auto:true};return}const s=wfSegsNorm(p.s);if(s)o.e[k]={s}});
  return o.auto||Object.keys(o.n).length||Object.keys(o.l).length||Object.keys(o.e).length?o:null;
}
function wfLayoutsNorm(x){const o={};if(!x||typeof x!=='object')return o;Object.entries(x).forEach(([k,v])=>{if(k.length<=80){const n=wfLayNorm(v);if(n)o[k]=n}});return o}

/* ----- which layout a diagram uses, and who may change it ----- */
const wfCanEditStd=()=>typeof SY==='undefined'||SY.isAdmin!==false;
function wfLayCtx(c){
  if(!c)return null;
  if(c.scope==='std'){const ed=wfEdit();return {...c,base:null,own:(ed.layout||{})[c.key]||null,canEdit:wfCanEditStd(),pub:(wfStd().layout||{})[c.key]||null}}
  const p=project(c.pid);return {...c,base:(wfStd().layout||{})[c.key]||null,own:((p&&p.wfLayout)||{})[c.key]||null,canEdit:!!p};
}
const wfCtxId=cx=>cx.scope+':'+(cx.pid||'')+':'+cx.key;
function wfLayEff(cx){
  const b=cx.own&&cx.own.auto?null:cx.base,w=cx.own||{},m=(a,c)=>({...(a||{}),...(c||{})});
  const e=m(b&&b.e,w.e);Object.keys(e).forEach(k=>{if(e[k]&&e[k].auto)delete e[k]});
  return {n:m(b&&b.n,w.n),l:m(b&&b.l,w.l),e};
}

/* ----- geometry: positions, lanes and routes for a set of nodes ----- */
function wfGeom(nodes,o,lay){
  const {W,H,GX,GY,LW,P,TOP,STUB}=WFL,ids=new Set(nodes.map(n=>n.id)),by=new Map(nodes.map(n=>[n.id,n])),rank=new Map();
  const deps=n=>(n.deps||[]).filter(d=>ids.has(d));
  const rk=(n,stack=new Set())=>{if(rank.has(n.id))return rank.get(n.id);if(stack.has(n.id))return 0;stack.add(n.id);const ds=deps(n);const r=ds.length?Math.max(...ds.map(d=>rk(by.get(d),stack)+1)):(n.cat==='output'&&!n.ref?1:0);stack.delete(n.id);rank.set(n.id,r);return r};
  nodes.forEach(n=>rk(n));
  const order=wfSpecs(o.std).concat(['_ref']),lanes=[...new Set(nodes.map(n=>n.lane))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  const maxR=Math.max(0,...rank.values()),rel=new Map(),bands=[],X0=LW+P;
  const hit=(a,b)=>a.x<b.x+W+8&&b.x<a.x+W+8&&a.dy<b.dy+H+GY&&b.dy<a.dy+H+GY;
  lanes.forEach(l=>{
    const ln=nodes.filter(n=>n.lane===l),placed=[];
    ln.forEach(n=>{const m=lay.n[n.id];if(m){const r={x:Math.max(X0,m.x),dy:Math.max(TOP,m.dy),manual:true};rel.set(n.id,r);placed.push(r)}});
    for(let r=0;r<=maxR;r++){const col=ln.filter(n=>!rel.has(n.id)&&rank.get(n.id)===r);
      col.sort((a,b)=>{const m=x=>{const ys=deps(x).filter(d=>rel.has(d)&&by.get(d).lane===l).map(d=>rel.get(d).dy);return ys.length?ys.reduce((p,c)=>p+c,0)/ys.length:1e9};return m(a)-m(b)});
      col.forEach((n,i)=>{const p={x:X0+r*(W+GX),dy:TOP+i*(H+GY)};let g=0;while(placed.some(q=>hit(p,q))&&g++<200)p.dy+=H+GY;rel.set(n.id,p);placed.push(p)})}
    const content=Math.max(H,...ln.map(n=>rel.get(n.id).dy+H))+TOP;
    bands.push({l,content,h:Math.max(content,(lay.l[l]&&lay.l[l].h)||0)});
  });
  let y=P;bands.forEach(b=>{b.y=y;y+=b.h+GY});
  const bandOf=new Map(bands.map(b=>[b.l,b])),pos=new Map();
  nodes.forEach(n=>{const r=rel.get(n.id),b=bandOf.get(n.lane);pos.set(n.id,{x:r.x,y:b.y+r.dy,dy:r.dy,manual:!!r.manual})});
  /* ports: several arrows leaving or entering a block get separate connection points */
  const edges=[];nodes.forEach(n=>deps(n).forEach(d=>edges.push({k:d+'>'+n.id,a:d,b:n.id,cross:by.get(d).lane!==n.lane,ref:!!by.get(d).ref})));
  const outs=new Map(),ins=new Map(),cy=id=>pos.get(id).y+H/2;
  edges.forEach(e=>{(outs.get(e.a)||outs.set(e.a,[]).get(e.a)).push(e);(ins.get(e.b)||ins.set(e.b,[]).get(e.b)).push(e)});
  const port=(list,e,other)=>{const s=[...list].sort((p,q)=>cy(p[other])-cy(q[other])||(p[other]<q[other]?-1:1)),i=s.indexOf(e),n=s.length;return n===1?H/2:Math.round(14+(H-28)*i/(n-1))};
  const rects=nodes.map(n=>({id:n.id,...pos.get(n.id)})),usedV=[];
  const vFree=(x,y1,y2,skip)=>!rects.some(r=>!skip.includes(r.id)&&x>r.x-4&&x<r.x+W+4&&Math.max(y1,y2)>r.y-3&&Math.min(y1,y2)<r.y+H+3);
  const hFree=(yy,x1,x2,skip)=>!rects.some(r=>!skip.includes(r.id)&&yy>r.y-3&&yy<r.y+H+3&&Math.max(x1,x2)>r.x-2&&Math.min(x1,x2)<r.x+W+2);
  const vShared=(x,y1,y2)=>usedV.some(u=>Math.abs(u.x-x)<6&&Math.max(y1,y2)>u.lo-2&&Math.min(y1,y2)<u.hi+2);
  const yRes=v=>{if(typeof v==='number')return v;const b=v.l&&bandOf.get(v.l);return b&&v.dy!=null?b.y+v.dy:v.y};
  const sortE=[...edges].sort((p,q)=>pos.get(p.a).x-pos.get(q.a).x||cy(p.a)-cy(q.a)||cy(p.b)-cy(q.b));
  sortE.forEach(e=>{const A=pos.get(e.a),B=pos.get(e.b),S={x:A.x+W,y:A.y+port(outs.get(e.a),e,'b')},E={x:B.x-2,y:B.y+port(ins.get(e.b),e,'a')},skip=[e.a,e.b];
    let segs,manual=false;const m=lay.e[e.k];
    if(m&&m.s&&!(m.s.length===1&&E.x-S.x<2*WFL.CL)){segs=wfClampSegs(m.s.map((v,i)=>i%2?yRes(v):v),S,E);manual=true}
    else if(E.x-S.x>=2*STUB+4){const lo=S.x+STUB,hi=E.x-STUB,mid=Math.round((lo+hi)/2),c=[mid];for(let d=8;d<=hi-lo;d+=8){if(mid-d>=lo)c.push(mid-d);if(mid+d<=hi)c.push(mid+d)}
      const ok=x=>vFree(x,S.y,E.y,skip)&&!vShared(x,S.y,E.y);
      const mx=c.find(x=>ok(x)&&hFree(S.y,S.x,x,skip)&&hFree(E.y,x,E.x,skip))??c.find(ok)??c.find(x=>vFree(x,S.y,E.y,skip))??mid;segs=[mx]}
    else{const ax=S.x+STUB,bx=E.x-STUB,bot=Math.max(A.y,B.y)+H+GY/2,top=Math.min(A.y,B.y)-GY/2,cand=[];for(let i=0;i<8;i++){cand.push(bot+i*12);cand.push(top-i*12)}
      const yy=cand.find(v=>v>2&&hFree(v,ax,bx,[])&&vFree(ax,S.y,v,skip)&&vFree(bx,v,E.y,skip))??bot;segs=[ax,yy,bx]}
    const pts=wfSegPts(S,E,segs);
    for(let j=1;j<pts.length-2;j++)if(j%2===1)usedV.push({x:pts[j][0],lo:Math.min(pts[j][1],pts[j+1][1]),hi:Math.max(pts[j][1],pts[j+1][1])});
    Object.assign(e,{S,E,segs,pts,manual})});
  const wd=Math.max(X0+W+P,...rects.map(r=>r.x+W),...edges.flatMap(e=>e.pts.map(p=>p[0])))+WFL.PAD,ht=y-GY+P;
  return {pos,bands,bandOf,edges,wd:Math.round(wd),ht:Math.round(ht),rank,by};
}
/* route coordinates → points: S, (x0,S.y), (x0,y1), (x2,y1) … (xn,E.y), E */
function wfSegPts(S,E,segs){const pts=[[S.x,S.y]];let cx=S.x,cy=S.y;segs.forEach((v,i)=>{if(i%2===0)cx=v;else cy=v;pts.push([cx,cy])});pts.push([cx,E.y]);pts.push([E.x,E.y]);return pts}
const wfPathD=pts=>'M'+pts.map(p=>Math.round(p[0])+','+Math.round(p[1])).join(' L');
/* a y position stored relative to the lane it falls in */
function wfYObj(yy,G){const b=G.bands.find(b=>yy>=b.y-WFL.GY&&yy<=b.y+b.h+WFL.GY)||G.bands.reduce((m,b)=>!m||Math.abs(b.y-yy)<Math.abs(m.y-yy)?b:m,null);return b?{l:b.l,dy:Math.round(yy-b.y),y:Math.round(yy)}:{l:null,dy:null,y:Math.round(yy)}}
const wfSegsStore=(segs,G)=>segs.map((v,i)=>i%2?wfYObj(v,G):Math.round(v));

/* ----- rendering ----- */
function wfDiagram(nodes,o){
  if(!nodes.length)return (o.ctx?wfLayBar(wfLayCtx(o.ctx),false):'')+`<div class="wfd-empty">${o.empty||'Nothing to show for this selection.'}</div>`;
  const cx=wfLayCtx(o.ctx),lay=cx?wfLayEff(cx):{n:{},l:{},e:{}},G=wfGeom(nodes,o,lay);
  ui.wfDia={nodes,o,cx};
  if(ui.wfEdge&&!G.edges.some(e=>e.k===ui.wfEdge))ui.wfEdge=null;
  const {W,H,LW}=WFL,sel=ui.wfSel,lab=l=>l==='_ref'?'Other phases':wfSpecName(l),editing=!!(cx&&cx.canEdit&&ui.wfLayEdit);
  const bandH=G.bands.map(b=>`<div class="wfl" data-lane="${esc(b.l)}" style="top:${b.y}px;height:${b.h}px;width:${G.wd}px"><span class="wfl-n" style="width:${LW-14}px">${esc(lab(b.l))}${o.extLanes&&o.extLanes.has(b.l)?'<small>external / reference</small>':''}</span></div>`).join('');
  const nodesH=nodes.map(n=>{const {x,y}=G.pos.get(n.id);return `<button class="wfn c-${n.cat}${n.cls?' '+n.cls:''}${sel===n.id?' sel':''}" id="wfn-${n.id}" data-act="wf-node" data-id="${n.id}"${n.tid?` data-tid="${n.tid}"`:''} style="left:${x}px;top:${y}px;width:${W}px;height:${H}px" aria-pressed="${sel===n.id}" title="${esc(n.title||n.name)}${cx&&cx.canEdit?' — drag to arrange':''}">
    <span class="wfn-k">${esc(n.kind)}</span><span class="wfn-n">${esc(n.name)}</span>${n.sub?`<span class="wfn-s">${esc(n.sub)}</span>`:''}</button>`}).join('');
  const mk=(id,c)=>`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="${c}"/></marker>`;
  return `${cx?wfLayBar(cx,true):''}<div class="wfd-wrap${editing?' editing':''}${cx&&cx.canEdit?' can-arrange':''}" role="group" aria-label="Workflow diagram"><div class="wfd" style="width:${G.wd}px;height:${G.ht}px">${bandH}<svg class="wfsvg" width="${G.wd}" height="${G.ht}"><defs>${mk('wfarrow','wfe-h')}${mk('wfarrowh','wfe-hh')}${mk('wfarrowx','wfe-hx')}</defs><g class="wfe-g">${wfEdgesSVG(G,editing)}</g></svg>${nodesH}</div></div>
    <div class="wfkey" aria-hidden="true"><span><i class="k-n"></i> same specialty</span><span><i class="k-x"></i> between specialties</span><span><i class="k-r"></i> reference outside this view</span>${cx&&cx.canEdit?'<span>Drag blocks to arrange them. <b>Edit layout</b> to adjust the arrows.</span>':''}</div>`;
}
function wfEdgesSVG(G,editing){
  const sel=ui.wfSel;let paths='',hits='',hd='';
  G.edges.forEach(e=>{const hot=sel&&(sel===e.a||sel===e.b),on=editing&&ui.wfEdge===e.k,d=wfPathD(e.pts);
    paths+=`<path class="wfe${e.cross?' x':''}${e.ref?' r':''}${hot?' hot':''}${on?' on':''}${e.manual?' man':''}" data-k="${esc(e.k)}" d="${d}" marker-end="url(#wfarrow${hot||on?'h':e.cross?'x':''})"/>`;
    if(editing)hits+=`<path class="wfe-hit" data-wfe="${esc(e.k)}" d="${d}"><title>${esc((G.by.get(e.a)||{}).name+' → '+(G.by.get(e.b)||{}).name)}</title></path>`;
    if(on)for(let j=1;j<e.pts.length-2;j++){const [x1,y1]=e.pts[j],[x2,y2]=e.pts[j+1],vert=j%2===1;hd+=`<rect class="wfh${vert?' v':' h'}" data-wfseg="${j}" x="${Math.round((x1+x2)/2)-5}" y="${Math.round((y1+y2)/2)-5}" width="10" height="10" rx="2"><title>Drag to move this ${vert?'vertical':'horizontal'} segment · double-click to remove the bend</title></rect>`}});
  return paths+(editing?`<g class="wfe-hits">${hits}</g><g class="wfe-hd">${hd}</g>`:'');
}
/* compact bar above the diagram */
function wfLayBar(cx,has){
  if(!cx)return '';const h=wfHist(cx),ed=cx.canEdit;
  const state=cx.scope==='std'?(cx.own?(JSON.stringify(cx.own)===JSON.stringify(cx.pub||null)?'Arranged layout (published)':'Arranged layout — publish to share it with projects'):'Automatic layout')
    :(cx.own?(cx.own.auto?'Automatic layout for this project (standard layout ignored)':'Standard layout + this project’s adjustments'):cx.base?'Standard layout':'Automatic layout');
  const e=ui.wfEdge&&ui.wfLayEdit;
  const b=(k,l,dis,t,extra)=>`<button type="button" class="btn sm${extra||' ghost'}" data-wflay="${k}"${dis?' disabled':''} title="${esc(t)}">${l}</button>`;
  return `<div class="wflay-bar" role="toolbar" aria-label="Diagram layout">
    <button type="button" class="btn sm${ui.wfLayEdit?' primary':''}" data-wflay="edit" aria-pressed="${!!ui.wfLayEdit}"${ed&&has?'':' disabled'} title="Select an arrow to move its segments and bends">Edit layout</button>
    ${b('undo','↶ Undo',!ed||!h.u.length,'Undo the last layout change')}${b('redo','↷ Redo',!ed||!h.r.length,'Redo')}
    ${b('auto','Auto layout',!ed||!has,cx.scope==='std'?'Arrange this phase automatically (removes manual positions and routes)':'Arrange this view automatically, ignoring the standard’s layout')}
    ${b('reset','Reset layout',!ed||!cx.own,cx.scope==='std'?'Back to the published layout of this phase':'Back to the standard’s layout (removes this project’s adjustments)')}
    ${e?`<span class="wflay-sep"></span><span class="wflay-e">Arrow selected · drag a segment · double-click the line to add a bend, a handle to remove it</span>${b('route-reset','Reset route',!ed,'Back to the automatic route for this arrow only')}`:''}
    <span class="spacer"></span><span class="muted wflay-st">${esc(state)}${ed?'':' · read-only'}</span></div>`;
}

/* ----- history (one entry per drop / action: blocks, lanes and routes together) ----- */
function wfHist(cx){ui.wfHistS=ui.wfHistS||{};const k=wfCtxId(cx);return ui.wfHistS[k]||(ui.wfHistS[k]={u:[],r:[]})}
function wfLayWrite(cx,own){
  const now=new Date().toISOString();
  if(cx.scope==='std'){const dr=wfDraft();dr.layout={...(dr.layout||{})};if(own)dr.layout[cx.key]=own;else delete dr.layout[cx.key];save(true);setSaveInd()}
  else{const p=project(cx.pid);if(!p)return;p.wfLayout={...(p.wfLayout||{})};if(own)p.wfLayout[cx.key]=own;else delete p.wfLayout[cx.key];p.updatedAt=now;save()}
  wfRerender();
}
function wfLayCommit(cx,own){const h=wfHist(cx);h.u.push(JSON.stringify(cx.own||null));if(h.u.length>60)h.u.shift();h.r=[];wfLayWrite(cx,own&&wfLayNorm(own))}
function wfRerender(){const wrap=document.querySelector('.wfd-wrap'),sl=wrap&&wrap.scrollLeft,st=wrap&&wrap.scrollTop,m=document.getElementById('main'),ms=m&&m.scrollTop;render();const w2=document.querySelector('.wfd-wrap');if(w2&&wrap){w2.scrollLeft=sl;w2.scrollTop=st}if(m)m.scrollTop=ms}
const wfOwnCopy=cx=>{const o=cx.own?wfClone(cx.own):{n:{},l:{},e:{}};o.n=o.n||{};o.l=o.l||{};o.e=o.e||{};return o};
/* every visible block keeps its current place once the user arranges one, so nothing else jumps */
function wfFreeze(own,G,nodes){nodes.forEach(n=>{const p=G.pos.get(n.id);own.n[n.id]={x:Math.round(p.x),dy:Math.round(p.dy)}})}
function wfLaneHeights(own,G0,nodes){const D=ui.wfDia,G=wfGeom(nodes,D.o,wfLayEff({...D.cx,own:{...own,l:{}}}));G.bands.forEach(b=>{own.l[b.l]={h:b.content}});void G0}

document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-wflay]');if(!b||b.disabled)return;
  const D=ui.wfDia;if(!D||!D.cx)return;const cx=wfLayCtx(D.o.ctx),k=b.dataset.wflay;if(!cx||!cx.canEdit)return;
  if(k==='edit'){ui.wfLayEdit=!ui.wfLayEdit;if(!ui.wfLayEdit)ui.wfEdge=null;wfRerender();const x=document.querySelector('[data-wflay=edit]');x&&x.focus();return}
  if(k==='undo'||k==='redo'){const h=wfHist(cx),from=k==='undo'?h.u:h.r,to=k==='undo'?h.r:h.u;if(!from.length)return;to.push(JSON.stringify(cx.own||null));const s=JSON.parse(from.pop());wfLayWrite(cx,s);const x=document.querySelector(`[data-wflay=${k}]`);x&&!x.disabled&&x.focus();return}
  if(k==='auto'){wfLayCommit(cx,cx.scope==='std'?null:{auto:true,n:{},l:{},e:{}});toast(cx.scope==='std'?'Automatic layout for this phase. Publish to share it.':'Automatic layout for this view of the project.');return}
  if(k==='reset'){wfLayCommit(cx,cx.scope==='std'?(cx.pub?wfClone(cx.pub):null):null);toast(cx.scope==='std'?'Layout of this phase back to the published one. Activities and dependencies are unchanged.':'Back to the standard’s layout. Activities and dependencies are unchanged.');return}
  if(k==='route-reset'&&ui.wfEdge){const own=wfOwnCopy(cx),key=ui.wfEdge;if(cx.scope==='proj'&&cx.base&&cx.base.e&&cx.base.e[key]&&!(cx.own&&cx.own.auto))own.e[key]={auto:true};else delete own.e[key];wfLayCommit(cx,own);return}
});

/* ----- dragging blocks ----- */
let wfDrag=null;
document.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;const D=ui.wfDia;if(!D||!D.cx)return;
  const h=e.target.closest&&e.target.closest('.wfh'),hitE=e.target.closest&&e.target.closest('.wfe-hit'),n=e.target.closest&&e.target.closest('.wfd .wfn');
  const cx=wfLayCtx(D.o.ctx);if(!cx||!cx.canEdit)return;
  if(h&&ui.wfEdge){e.preventDefault();wfDrag={kind:'seg',j:+h.dataset.wfseg,x0:e.clientX,y0:e.clientY,cx,moved:false};h.setPointerCapture&&h.setPointerCapture(e.pointerId);return}
  if(hitE){e.preventDefault();if(ui.wfEdge!==hitE.dataset.wfe){ui.wfEdge=hitE.dataset.wfe;wfRepaint(null)}return}
  if(n){wfDrag={kind:'node',id:n.dataset.id,x0:e.clientX,y0:e.clientY,cx,moved:false,el:n,pid:e.pointerId};return}
  if(ui.wfEdge&&e.target.closest&&e.target.closest('.wfd')){ui.wfEdge=null;wfRepaint(null)}
},true);
function wfDragStart(dr){
  const D=ui.wfDia,cx=dr.cx,G=wfGeom(D.nodes,D.o,wfLayEff(cx)),me=G.pos.get(dr.id);
  /* the set that moves sideways: this block and the activities that follow it to its right */
  const set=new Set([dr.id]),q=[dr.id];while(q.length){const a=q.shift();G.edges.filter(e=>e.a===a).forEach(e=>{if(!set.has(e.b)&&G.pos.get(e.b).x>=me.x){set.add(e.b);q.push(e.b)}})}
  /* limits: no successor before its predecessor, with a minimum gap; the set stops at the nearest valid position */
  const {W,GAP}=WFL;let lo=WFL.LW+WFL.P-Math.min(...[...set].map(id=>G.pos.get(id).x)),hi=Infinity;
  G.edges.forEach(e=>{const A=G.pos.get(e.a),B=G.pos.get(e.b);
    if(!set.has(e.a)&&set.has(e.b))lo=Math.max(lo,Math.min(0,A.x+W+GAP-B.x));
    if(set.has(e.a)&&!set.has(e.b))hi=Math.min(hi,Math.max(0,B.x-(A.x+W+GAP)))});
  Object.assign(dr,{G0:G,set,lo:Math.min(lo,0),hi:Math.max(hi,0),me});
  document.body.classList.add('wf-dragging');dr.el.classList.add('dragging');
  try{dr.el.setPointerCapture(dr.pid)}catch(_){}
}
function wfDragOwn(dr,dx,dy,final){
  const D=ui.wfDia,own=wfOwnCopy(dr.cx),G=dr.G0,{W,H,GY,TOP}=WFL;
  wfFreeze(own,G,D.nodes);
  const ddx=Math.round(Math.max(dr.lo,Math.min(dr.hi,dx))),ndy=Math.round(Math.max(TOP,dr.me.dy+dy));
  dr.set.forEach(id=>{own.n[id].x=Math.round(G.pos.get(id).x+ddx)});own.n[dr.id].dy=ndy;
  /* routes between blocks that move together keep their shape */
  if(ddx)G.edges.forEach(e=>{if(dr.set.has(e.a)&&dr.set.has(e.b)&&e.manual){own.e[e.k]={s:wfSegsStore(e.segs.map((v,i)=>i%2?v:v+ddx),G)}}});
  if(final){
    /* no overlaps: a block dropped on another one goes just below it, inside the same lane */
    const lane=id=>D.nodes.find(n=>n.id===id).lane,moved=[dr.id,...[...dr.set].filter(id=>id!==dr.id)];
    moved.forEach(id=>{const a=own.n[id];let g=0,clash;
      while(g++<100&&(clash=D.nodes.find(n=>n.id!==id&&lane(n.id)===lane(id)&&own.n[n.id]&&Math.abs(own.n[n.id].x-a.x)<W+8&&Math.abs(own.n[n.id].dy-a.dy)<H+GY)))a.dy=own.n[clash.id].dy+H+GY});
    wfLaneHeights(own,G,D.nodes);
  }
  return {own,ddx,ndy};
}
document.addEventListener('pointermove',e=>{const dr=wfDrag;if(!dr)return;const dx=e.clientX-dr.x0,dy=e.clientY-dr.y0;
  if(!dr.moved){if(Math.abs(dx)<5&&Math.abs(dy)<5)return;dr.moved=true;if(dr.kind==='node')wfDragStart(dr)}
  e.preventDefault();
  if(dr.kind==='node'){const r=wfDragOwn(dr,dx,dy,false);dr.last=r;wfRepaint(r.own,dr)}
  else{const own=wfSegOwn(dr,dx,dy);dr.last={own};wfRepaint(own,dr)}
},true);
document.addEventListener('pointerup',e=>{const dr=wfDrag;if(!dr)return;wfDrag=null;document.body.classList.remove('wf-dragging');
  if(!dr.moved)return;   // a click: selection / opening work as before
  ui.wfSuppressClick=Date.now();
  const dx=e.clientX-dr.x0,dy=e.clientY-dr.y0;
  if(dr.kind==='node'){const r=wfDragOwn(dr,dx,dy,true);wfLayCommit(dr.cx,r.own)}
  else wfLayCommit(dr.cx,wfSegOwn(dr,dx,dy));
},true);
document.addEventListener('pointercancel',()=>{if(wfDrag){wfDrag=null;document.body.classList.remove('wf-dragging');wfRerender()}},true);
/* a drag never counts as a click on the block */
document.addEventListener('click',e=>{if(ui.wfSuppressClick&&Date.now()-ui.wfSuppressClick<400&&e.target.closest&&e.target.closest('.wfd')){ui.wfSuppressClick=0;e.stopImmediatePropagation();e.preventDefault()}},true);

/* ----- editing a route ----- */
function wfEdgeNow(cx){const D=ui.wfDia,G=wfGeom(D.nodes,D.o,wfLayEff(cx));return {G,e:G.edges.find(x=>x.k===ui.wfEdge)}}
function wfSegOwn(dr,dx,dy){
  if(!dr.base){const {G,e}=wfEdgeNow(dr.cx);dr.base={G,e,segs:e.segs.slice()}}
  const {G,segs}=dr.base,s=segs.slice(),i=dr.j-1;
  if(dr.j%2===1)s[i]=Math.round(s[i]+dx);else s[i]=Math.round(s[i]+dy);
  const e=dr.base.e,c=e?wfClampSegs(s,e.S,e.E):s;
  const own=wfOwnCopy(dr.cx);own.e[ui.wfEdge]={s:wfSegsStore(c,G)};return own;
}
document.addEventListener('dblclick',e=>{const D=ui.wfDia;if(!D||!D.cx||!ui.wfLayEdit)return;const cx=wfLayCtx(D.o.ctx);if(!cx||!cx.canEdit)return;
  const h=e.target.closest&&e.target.closest('.wfh'),hitE=e.target.closest&&e.target.closest('.wfe-hit');if(!h&&!hitE)return;e.preventDefault();
  if(hitE)ui.wfEdge=hitE.dataset.wfe;const {G,e:E}=wfEdgeNow(cx);if(!E)return;const segs=E.segs.slice();
  if(h){const j=+h.dataset.wfseg;if(segs.length<3){toast('This arrow has no bend to remove.');return}const i=j-1;if(i+1<segs.length)segs.splice(i,2);else segs.splice(i-1,2)}
  else{const r=document.querySelector('.wfd').getBoundingClientRect(),C={x:e.clientX-r.left,y:e.clientY-r.top},pts=E.pts;
    let best=0,bd=Infinity;for(let j=0;j<pts.length-1;j++){const [x1,y1]=pts[j],[x2,y2]=pts[j+1],d=x1===x2?Math.abs(C.x-x1)+Math.max(0,Math.min(y1,y2)-C.y,C.y-Math.max(y1,y2)):Math.abs(C.y-y1)+Math.max(0,Math.min(x1,x2)-C.x,C.x-Math.max(x1,x2));if(d<bd){bd=d;best=j}}
    const j=best,vert=j%2===1;
    if(vert)segs.splice(j,0,C.y,segs[j-1]);                       // split a vertical segment: x, y, x
    else if(j===pts.length-2)segs.push(pts[j][1],Math.round(C.x));  // last horizontal (into the target)
    else segs.splice(j,0,Math.round(C.x),pts[j][1]);               // split a horizontal segment: x, y
  }
  const own=wfOwnCopy(cx);own.e[ui.wfEdge]={s:wfSegsStore(segs,G)};wfLayCommit(cx,own);
},true);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&ui.wfEdge&&ui.wfLayEdit){ui.wfEdge=null;wfRepaint(null);return}
  /* keyboard: Alt + arrows moves the focused block (same rules as dragging) */
  const n=e.target.closest&&e.target.closest('.wfd .wfn');if(!n||!e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  const D=ui.wfDia;if(!D||!D.cx)return;const cx=wfLayCtx(D.o.ctx);if(!cx||!cx.canEdit)return;e.preventDefault();
  const dr={kind:'node',id:n.dataset.id,cx,el:n};wfDragStart(dr);document.body.classList.remove('wf-dragging');const st=e.shiftKey?48:12;
  const r=wfDragOwn(dr,e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0,true);wfLayCommit(cx,r.own);
  const f=document.getElementById('wfn-'+dr.id);f&&f.focus();
},true);

/* live preview while dragging: positions, lanes and arrows are updated in place (no full redraw) */
function wfRepaint(own,dr){
  const D=ui.wfDia;if(!D)return;const cx=wfLayCtx(D.o.ctx);if(!cx)return;
  const G=wfGeom(D.nodes,D.o,wfLayEff(own?{...cx,own}:cx)),box=document.querySelector('.wfd');if(!box)return;
  box.style.width=G.wd+'px';box.style.height=G.ht+'px';const svg=box.querySelector('svg.wfsvg');if(svg){svg.setAttribute('width',G.wd);svg.setAttribute('height',G.ht)}
  G.bands.forEach(b=>{const el=box.querySelector(`.wfl[data-lane="${CSS.escape(b.l)}"]`);if(el){el.style.top=b.y+'px';el.style.height=b.h+'px';el.style.width=G.wd+'px'}});
  D.nodes.forEach(n=>{const el=document.getElementById('wfn-'+n.id),p=G.pos.get(n.id);if(el){el.style.left=p.x+'px';el.style.top=p.y+'px'}});
  const g=box.querySelector('.wfe-g');if(g)g.innerHTML=wfEdgesSVG(G,!!(cx.canEdit&&ui.wfLayEdit));
  const bar=document.querySelector('.wflay-bar');if(bar&&!dr){const t=document.createElement('div');t.innerHTML=wfLayBar(cx,true);bar.replaceWith(t.firstElementChild)}
}
