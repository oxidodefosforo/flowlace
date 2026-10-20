/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- workflow diagram: layout (presentation only — the logic stays in steps and "Depends on") ----------
   A layout belongs to a VIEW (a phase id, or "_all" for All phases in a project) and never holds structure:
     n: { <stepId>: { x, dy } }      x in diagram pixels; dy relative to the top of the block's lane. A reference
                                     from another phase is a visual instance of that view only.
     l: { <laneKey>: { h } }         lane heights when last arranged (minimum; the content always fits)
     z: { 1: x, 2: x }               where the Actions / Outputs zones started when last arranged (minimum)
     e: { "<from>><to>": { a:{side,t}, b:{side,t}, s:[…] } | { auto:true } }
                                     anchors of the arrow on its source (a) and target (b): side r|l|t|b and a
                                     relative position 0…1 along it; s = the editable orthogonal route (below)
     auto: true                      project only: ignore the standard's layout for this view
   Company workflow: std.layout[view] (draft → publish). Project: project.wfLayout[view] over the published one.
   Route s: alternating coordinates after the stub that leaves the source: the first one is an x when the arrow
   leaves sideways (r/l) and a y when it leaves from the top or bottom. y values are stored relative to a lane
   ({l,dy,y}) so routes follow their lanes. The route always ends with a stub that enters the target through its
   anchor, so the arrow keeps its direction. Layouts saved by Flowlace 1.1 (no anchors) mean the same thing. */
const WFL={W:196,H:84,GX:58,GY:12,LW:116,P:10,PT:30,TOP:10,BOT:18,GAP:24,STUB:16,PAD:56,ZG:84,SNAP:6};
const WF_SIDES=['r','l','t','b'];
const wfNum=v=>typeof v==='number'&&isFinite(v)?Math.round(v*10)/10:null;
function wfSegsNorm(s){
  if(!Array.isArray(s)||!s.length||s.length>61)return null;const out=[];let prev=null;
  for(const v of s){const t=typeof v==='number'?'x':v&&typeof v==='object'?'y':null;if(!t||t===prev)return null;prev=t;
    if(t==='x'){const x=wfNum(v);if(x==null)return null;out.push(x)}else{const yy=wfNum(v.y);if(yy==null)return null;out.push({l:typeof v.l==='string'?v.l.slice(0,80):null,dy:wfNum(v.dy),y:yy})}}
  return out;
}
const wfAnchorNorm=a=>a&&WF_SIDES.includes(a.side)&&typeof a.t==='number'&&isFinite(a.t)?{side:a.side,t:Math.max(0,Math.min(1,Math.round(a.t*1000)/1000))}:null;
function wfLayNorm(v){
  if(!v||typeof v!=='object')return null;const o={n:{},l:{},e:{}};if(v.auto)o.auto=true;
  Object.entries(v.n||{}).forEach(([id,p])=>{const x=wfNum(p&&p.x),dy=wfNum(p&&p.dy);if(x!=null&&dy!=null&&id.length<=120)o.n[id]={x:Math.max(0,x),dy:Math.max(0,dy)}});
  Object.entries(v.l||{}).forEach(([l,p])=>{const h=wfNum(p&&p.h);if(h!=null&&h>0&&h<20000)o.l[l]={h}});
  if(v.z&&typeof v.z==='object'){const z={};['1','2'].forEach(k=>{const x=wfNum(v.z[k]);if(x!=null&&x>0)z[k]=x});if(Object.keys(z).length)o.z=z}
  Object.entries(v.e||{}).forEach(([k,p])=>{if(!/^[^>]{1,120}>[^>]{1,120}$/.test(k)||!p)return;if(p.auto){o.e[k]={auto:true};return}
    const x={},s=wfSegsNorm(p.s),a=wfAnchorNorm(p.a),b=wfAnchorNorm(p.b);if(s)x.s=s;if(a)x.a=a;if(b)x.b=b;if(Object.keys(x).length)o.e[k]=x});
  return o.auto||o.z||Object.keys(o.n).length||Object.keys(o.l).length||Object.keys(o.e).length?o:null;
}
function wfLayoutsNorm(x){const o={};if(!x||typeof x!=='object')return o;Object.entries(x).forEach(([k,v])=>{if(k.length<=80){const n=wfLayNorm(v);if(n)o[k]=n}});return o}

/* ----- which layout a diagram uses, and who may change it ----- */
const wfCanEditStd=()=>typeof SY==='undefined'||SY.isAdmin!==false;
function wfLayCtx(c){
  if(!c)return null;
  if(c.scope==='std'){const ed=wfEdit();return {...c,base:null,own:(ed.layout||{})[c.key]||null,canEdit:wfCanEditStd(),canLink:wfCanEditStd(),pub:(wfStd().layout||{})[c.key]||null}}
  const p=project(c.pid);return {...c,base:(wfStd().layout||{})[c.key]||null,own:((p&&p.wfLayout)||{})[c.key]||null,canEdit:!!p,canLink:false};
}
const wfCtxId=cx=>cx.scope+':'+(cx.pid||'')+':'+cx.key;
function wfLayEff(cx){
  const b=cx.own&&cx.own.auto?null:cx.base,w=cx.own||{},m=(a,c)=>({...(a||{}),...(c||{})});
  const e=m(b&&b.e,w.e);Object.keys(e).forEach(k=>{if(e[k]&&e[k].auto)delete e[k]});
  return {n:m(b&&b.n,w.n),l:m(b&&b.l,w.l),z:m(b&&b.z,w.z),e};
}
/* zones: Inputs → Actions → Outputs; references from other phases share the Inputs zone */
const wfZone=n=>n.lane==='_ref'?0:n.cat==='input'?0:n.cat==='action'?1:2;

/* ----- geometry ----- */
function wfGeom(nodes,o,lay){
  const {W,H,GX,GY,LW,P,PT,TOP,BOT,ZG}=WFL,X0=LW+P,ids=new Set(nodes.map(n=>n.id)),by=new Map(nodes.map(n=>[n.id,n]));
  const deps=n=>(n.deps||[]).filter(d=>ids.has(d)),Z=new Map(nodes.map(n=>[n.id,wfZone(n)]));
  const conflict=(d,n)=>Z.get(d)>Z.get(n);
  /* sub-column inside a zone: after its predecessors of the same zone */
  const sub=new Map(),sb=(n,stack=new Set())=>{if(sub.has(n.id))return sub.get(n.id);if(stack.has(n.id))return 0;stack.add(n.id);const ds=deps(n).filter(d=>Z.get(d)===Z.get(n.id));const r=ds.length?Math.max(...ds.map(d=>sb(by.get(d),stack)+1)):0;stack.delete(n.id);sub.set(n.id,r);return r};
  nodes.forEach(n=>sb(n));
  const order=wfSpecs(o.std).concat(['_ref']),lanes=[...new Set(nodes.map(n=>n.lane))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  const rel=new Map(),placed=new Map(lanes.map(l=>[l,[]]));
  const hit=(a,b)=>a.x<b.x+W+8&&b.x<a.x+W+8&&a.dy<b.dy+H+GY&&b.dy<a.dy+H+GY;
  nodes.forEach(n=>{const m=lay.n[n.id];if(m){const r={x:Math.max(X0,m.x),dy:Math.max(TOP,m.dy),manual:true};rel.set(n.id,r);placed.get(n.lane).push(r)}});
  const auto=nodes.filter(n=>!rel.has(n.id)).map((n,i)=>({n,i})).sort((a,b)=>Z.get(a.n.id)-Z.get(b.n.id)||sub.get(a.n.id)-sub.get(b.n.id)||lanes.indexOf(a.n.lane)-lanes.indexOf(b.n.lane)||a.i-b.i).map(x=>x.n);
  const zoneStart=z=>{let s=z===0?X0:Math.max(X0,(lay.z&&lay.z[z])||0);nodes.forEach(n=>{if(Z.get(n.id)<z&&rel.has(n.id))s=Math.max(s,rel.get(n.id).x+W+ZG)});return s};
  auto.forEach(n=>{const z=Z.get(n.id);let x=zoneStart(z);
    deps(n).forEach(d=>{if(!conflict(d,n.id)&&rel.has(d))x=Math.max(x,rel.get(d).x+W+GX)});
    const ys=deps(n).filter(d=>rel.has(d)&&by.get(d).lane===n.lane).map(d=>rel.get(d).dy),p={x,dy:ys.length?Math.max(TOP,Math.round(ys.reduce((a,c)=>a+c,0)/ys.length)):TOP};
    let g=0;const pl=placed.get(n.lane);while(pl.some(q=>hit(p,q))&&g++<200)p.dy+=H+GY;if(p.dy!==TOP&&!ys.length){p.dy=TOP;g=0;while(pl.some(q=>hit(p,q))&&g++<200)p.dy+=H+GY}
    rel.set(n.id,p);pl.push(p)});
  const bands=lanes.map(l=>{const ln=nodes.filter(n=>n.lane===l),content=Math.max(H,...ln.map(n=>rel.get(n.id).dy+H))+BOT;return {l,content,h:Math.max(content,(lay.l[l]&&lay.l[l].h)||0)}});
  let y=PT;bands.forEach(b=>{b.y=y;y+=b.h+GY});
  const bandOf=new Map(bands.map(b=>[b.l,b])),pos=new Map();
  nodes.forEach(n=>{const r=rel.get(n.id),b=bandOf.get(n.lane);pos.set(n.id,{x:r.x,y:b.y+r.dy,dy:r.dy,manual:!!r.manual})});
  /* zones as they are now (for the Outputs separator, insertion and dragging) */
  const zr=[0,1,2].map(z=>{const xs=nodes.filter(n=>Z.get(n.id)===z).map(n=>pos.get(n.id).x);return xs.length?{min:Math.min(...xs),max:Math.max(...xs)+W}:null});
  const sep=zr[2]&&(zr[1]||zr[0])?Math.round(((zr[1]||zr[0]).max+zr[2].min)/2):null;
  /* edges: anchors, then routes */
  const edges=[];nodes.forEach(n=>deps(n).forEach(d=>{const k=d+'>'+n.id,c=lay.e[k]||{};edges.push({k,a:d,b:n.id,cross:by.get(d).lane!==n.lane,ref:!!by.get(d).ref,conflict:conflict(d,n.id),sa:c.a||null,sb:c.b||null,man:c.s||null})}));
  const cy=id=>pos.get(id).y+H/2,outs=new Map(),ins=new Map();
  edges.forEach(e=>{if(!e.sa)(outs.get(e.a)||outs.set(e.a,[]).get(e.a)).push(e);if(!e.sb)(ins.get(e.b)||ins.set(e.b,[]).get(e.b)).push(e)});
  const spread=(list,e,other)=>{const s=[...list].sort((p,q)=>cy(p[other])-cy(q[other])||(p[other]<q[other]?-1:1)),i=s.indexOf(e),n=s.length;return n===1?.5:(14+(H-28)*i/(n-1))/H};
  const rects=nodes.map(n=>({id:n.id,...pos.get(n.id)})),usedV=[],usedH=[];
  const yRes=v=>{if(typeof v==='number')return v;const b=v.l&&bandOf.get(v.l);return b&&v.dy!=null?b.y+v.dy:v.y};
  const sortE=[...edges].sort((p,q)=>pos.get(p.a).x-pos.get(q.a).x||cy(p.a)-cy(q.a)||cy(p.b)-cy(q.b));
  sortE.forEach(e=>{const A=pos.get(e.a),B=pos.get(e.b);
    e.A=e.sa||{side:'r',t:spread(outs.get(e.a),e,'b')};e.B=e.sb||{side:'l',t:spread(ins.get(e.b),e,'a')};
    const S=wfAnchorPt(A,e.A,0),E=wfAnchorPt(B,e.B,2),S0=wfOut(S,e.A.side),E0=wfOut(E,e.B.side,true),hz=e.A.side==='r'||e.A.side==='l';
    let coords,manual=false;
    if(e.man&&(typeof e.man[0]==='number')===hz){coords=e.man.map(v=>typeof v==='number'?v:yRes(v));manual=true}
    else coords=wfAutoRoute(S0,E0,hz,e.B.side==='r'||e.B.side==='l',rects,[e.a,e.b],bands,usedV,usedH);
    const r=wfRoutePts(S,S0,coords,E0,E,hz);
    r.pts.forEach((p,j)=>{if(j<1||j>=r.pts.length-2)return;const q=r.pts[j+1];if(p[0]===q[0])usedV.push({x:p[0],lo:Math.min(p[1],q[1]),hi:Math.max(p[1],q[1])});else usedH.push({y:p[1],lo:Math.min(p[0],q[0]),hi:Math.max(p[0],q[0])})});
    Object.assign(e,{S,E,S0,E0,hz,coords,pts:r.pts,ctrl:r.ctrl,manual})});
  const wd=Math.max(X0+W+P,...rects.map(r=>r.x+W),...edges.flatMap(e=>e.pts.map(p=>p[0])))+WFL.PAD,ht=y-GY+P;
  return {pos,bands,bandOf,edges,wd:Math.round(wd),ht:Math.round(ht),by,Z,zr,sep,conflicts:edges.filter(e=>e.conflict)};
}
/* a point on a side of a block; mode 2 = the arrow tip (2 px outside) */
function wfAnchorPt(p,a,off){const {W,H}=WFL,t=a.t;switch(a.side){case 'l':return {x:p.x-off,y:p.y+t*H};case 't':return {x:p.x+t*W,y:p.y-off};case 'b':return {x:p.x+t*W,y:p.y+H+off};default:return {x:p.x+W+off,y:p.y+t*H}}}
function wfOut(P,side,end){const s=WFL.STUB,o=side==='l'?{x:P.x-s,y:P.y,dx:1,dy:0}:side==='t'?{x:P.x,y:P.y-s,dx:0,dy:1}:side==='b'?{x:P.x,y:P.y+s,dx:0,dy:-1}:{x:P.x+s,y:P.y,dx:-1,dy:0};if(!end){o.dx=-o.dx;o.dy=-o.dy}return o}
/* points of a route; ctrl[j] = index of the coordinate that places segment j (only those can be dragged) */
function wfRoutePts(S,S0,coords,E0,E,hz){
  const pts=[[S.x,S.y],[S0.x,S0.y]],ctrl=[];let cx=S0.x,cy=S0.y,h=hz;
  coords.forEach((v,i)=>{if(h)cx=v;else cy=v;pts.push([cx,cy]);ctrl[pts.length-1]=i;h=!h});
  if(h){pts.push([E0.x,cy]);pts.push([E0.x,E0.y])}else{pts.push([cx,E0.y]);pts.push([E0.x,E0.y])}
  pts.push([E.x,E.y]);return {pts,ctrl};
}
/* automatic orthogonal route: a few candidate shapes, the one that crosses no block and shares the least wins */
function wfAutoRoute(S0,E0,hz,ez,rects,skip,bands,usedV,usedH){
  const {W,H,GY}=WFL,rng=(a,b,step)=>{const lo=Math.min(a,b),hi=Math.max(a,b),mid=Math.round((lo+hi)/2),o=[mid];for(let d=step;d<=hi-lo;d+=step){if(mid-d>=lo)o.push(mid-d);if(mid+d<=hi)o.push(mid+d)}return o.slice(0,24)};
  const cand=[[]],xs=rng(S0.x,E0.x,8),ys=rng(S0.y,E0.y,8);
  const chY=[...new Set([...bands.flatMap(b=>[b.y-GY/2,b.y+b.h+GY/2]),...ys,Math.max(S0.y,E0.y)+H/2+8,Math.min(S0.y,E0.y)-H/2-8])];
  const chX=[...new Set([...xs,Math.max(S0.x,E0.x)+24,Math.min(S0.x,E0.x)-24])];
  if(hz){xs.forEach(x=>cand.push([x]));chY.forEach(y=>cand.push([S0.x,y]));chY.forEach(y=>cand.push([S0.x,y,E0.x]));chY.forEach(y=>chX.slice(0,6).forEach(x=>cand.push([x,y])))}
  else{ys.forEach(y=>cand.push([y]));chX.forEach(x=>cand.push([S0.y,x]));chX.forEach(x=>cand.push([S0.y,x,E0.y]))}
  const cross=(a,b)=>rects.filter(r=>{const lx=Math.min(a[0],b[0]),hx=Math.max(a[0],b[0]),ly=Math.min(a[1],b[1]),hy=Math.max(a[1],b[1]);return hx>r.x+2&&lx<r.x+W-2&&hy>r.y+2&&ly<r.y+H-2}).length;
  let best=null,bs=Infinity;
  for(const c of cand){const {pts}=wfRoutePts(S0,S0,c,E0,E0,hz);let sc=0,bends=0,len=0;
    for(let j=1;j<pts.length-1;j++){const a=pts[j],b=pts[j+1];if(a[0]===b[0]&&a[1]===b[1])continue;len+=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);bends++;
      sc+=cross(a,b)*1000;
      if(a[0]===b[0])sc+=usedV.filter(u=>Math.abs(u.x-a[0])<6&&Math.max(a[1],b[1])>u.lo+2&&Math.min(a[1],b[1])<u.hi-2).length*160;
      else sc+=usedH.filter(u=>Math.abs(u.y-a[1])<6&&Math.max(a[0],b[0])>u.lo+2&&Math.min(a[0],b[0])<u.hi-2).length*120}
    /* prefer approaching the target's entry point in the direction the arrow will keep */
    const q=pts.filter((v,i)=>i===0||v[0]!==pts[i-1][0]||v[1]!==pts[i-1][1]);
    if(q.length>1){const a=q[q.length-2],t=q[q.length-1];if(ez?(a[1]===t[1]&&Math.sign(t[0]-a[0])===-E0.dx):(a[0]===t[0]&&Math.sign(t[1]-a[1])===-E0.dy))sc+=600;
      const f=q[1];if(hz?(f[1]===S0.y&&Math.sign(f[0]-S0.x)===-S0.dx):(f[0]===S0.x&&Math.sign(f[1]-S0.y)===-S0.dy))sc+=600}
    sc+=len+bends*18;if(sc<bs){bs=sc;best=c}}
  return best||[];
}
const wfPathD=(pts,round)=>{const p=pts.filter((q,i)=>i===0||q[0]!==pts[i-1][0]||q[1]!==pts[i-1][1]);if(!round||p.length<3)return 'M'+p.map(q=>Math.round(q[0])+','+Math.round(q[1])).join(' L');
  let d='M'+p[0].map(Math.round).join(',');for(let i=1;i<p.length-1;i++){const a=p[i-1],b=p[i],c=p[i+1],r=Math.min(7,Math.hypot(b[0]-a[0],b[1]-a[1])/2,Math.hypot(c[0]-b[0],c[1]-b[1])/2),u=[(a[0]-b[0]),(a[1]-b[1])],v=[(c[0]-b[0]),(c[1]-b[1])],lu=Math.hypot(...u)||1,lv=Math.hypot(...v)||1;
    d+=` L${Math.round(b[0]+u[0]/lu*r)},${Math.round(b[1]+u[1]/lu*r)} Q${Math.round(b[0])},${Math.round(b[1])} ${Math.round(b[0]+v[0]/lv*r)},${Math.round(b[1]+v[1]/lv*r)}`}
  return d+` L${p[p.length-1].map(Math.round).join(',')}`};
/* a y position stored relative to the lane it falls in */
function wfYObj(yy,G){const b=G.bands.find(b=>yy>=b.y-WFL.GY&&yy<=b.y+b.h+WFL.GY)||G.bands.reduce((m,b)=>!m||Math.abs(b.y-yy)<Math.abs(m.y-yy)?b:m,null);return b?{l:b.l,dy:Math.round(yy-b.y),y:Math.round(yy)}:{l:null,dy:null,y:Math.round(yy)}}
const wfCoordsStore=(e,coords,G)=>coords.map((v,i)=>((i%2===0)===e.hz)?Math.round(v):wfYObj(v,G));

/* ----- rendering ----- */
function wfDiagram(nodes,o){
  if(!nodes.length)return (o.ctx?wfLayBar(wfLayCtx(o.ctx),null):'')+`<div class="wfd-empty">${o.empty||'Nothing to show for this selection.'}</div>`;
  const cx=wfLayCtx(o.ctx),lay=cx?wfLayEff(cx):{n:{},l:{},z:{},e:{}},G=wfGeom(nodes,o,lay);
  ui.wfDia={nodes,o,cx,id:cx?wfCtxId(cx):null};
  if(ui.wfEdge&&!G.edges.some(e=>e.k===ui.wfEdge))ui.wfEdge=null;
  ui.wfMulti=(ui.wfMulti||[]).filter(id=>G.pos.has(id));
  const {W,H,LW}=WFL,sel=ui.wfSel,lab=l=>l==='_ref'?'Other phases':wfSpecName(l),editing=!!(cx&&cx.canEdit&&ui.wfLayEdit);
  const bandH=G.bands.map(b=>`<div class="wfl" data-lane="${esc(b.l)}" style="top:${b.y}px;height:${b.h}px;width:${G.wd}px"><span class="wfl-n" style="width:${LW-14}px">${esc(lab(b.l))}${o.extLanes&&o.extLanes.has(b.l)?'<small>external / reference</small>':''}${b.l==='_ref'?'<small>references · Inputs zone</small>':''}</span></div>`).join('');
  const ms=new Set(ui.wfMulti),ref0=ui.wfMulti[0],conn=ui.wfConn&&ui.wfConn.from;
  const nodesH=nodes.map(n=>{const {x,y}=G.pos.get(n.id);return `<button class="wfn c-${n.cat}${n.cls?' '+n.cls:''}${sel===n.id?' sel':''}${ms.has(n.id)?' multi':''}${ref0===n.id&&ms.size>1?' mref':''}${conn===n.id?' conn-from':''}" id="wfn-${n.id}" data-act="wf-node" data-id="${n.id}"${n.tid?` data-tid="${n.tid}"`:''} style="left:${x}px;top:${y}px;width:${W}px;height:${H}px" aria-pressed="${sel===n.id}" title="${esc(n.title||n.name)}${cx&&cx.canEdit?' — drag to arrange':''}">
    <span class="wfn-k">${esc(n.kind)}</span><span class="wfn-n">${esc(n.name)}</span>${n.sub?`<span class="wfn-s">${esc(n.sub)}</span>`:''}${ref0===n.id&&ms.size>1?'<span class="wfn-ref">Reference</span>':''}${editing&&cx.canLink?`<span class="wfconn" data-wfconn="${n.id}" title="Drag to another activity: it will depend on this one"></span>`:''}</button>`}).join('');
  const mk=(id,c)=>`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="${c}"/></marker>`;
  const phN=cx&&cx.key&&cx.key!=='_all'?phName(cx.key):'';
  const sepH=G.sep!=null?`<div class="wfzsep" style="left:${G.sep}px;height:${G.ht}px" aria-hidden="true"><span>Outputs${phN?' — '+esc(phN):''}</span></div>`:'';
  return `${cx?wfLayBar(cx,G):''}<div class="wfd-wrap${editing?' editing':''}${cx&&cx.canEdit?' can-arrange':''}${ui.wfConn?' connecting':''}" role="group" aria-label="Workflow diagram"><div class="wfd" style="width:${G.wd}px;height:${G.ht}px">${bandH}${sepH}<svg class="wfsvg" width="${G.wd}" height="${G.ht}"><defs>${mk('wfarrow','wfe-h')}${mk('wfarrowh','wfe-hh')}${mk('wfarrowx','wfe-hx')}${mk('wfarrowc','wfe-hc')}</defs><g class="wfe-g">${wfEdgesSVG(G,editing)}</g><g class="wfe-tmp"></g></svg>${nodesH}<div class="wfguides"></div></div></div>
    <div class="wfkey" aria-hidden="true"><span><i class="k-n"></i> same specialty</span><span><i class="k-x"></i> between specialties</span><span><i class="k-r"></i> reference outside this view</span>${G.conflicts.length?'<span><i class="k-c"></i> order to review</span>':''}${cx&&cx.canEdit?'<span>Drag blocks to arrange them · <b>Edit layout</b> for arrows, alignment and connections.</span>':''}</div>`;
}
function wfEdgesSVG(G,editing,tmp){
  const sel=ui.wfSel,round=!!prefs.wfRound;let paths='',hits='',hd='';
  G.edges.forEach(e=>{const hot=sel&&(sel===e.a||sel===e.b),on=editing&&ui.wfEdge===e.k,d=wfPathD(e.pts,round);
    paths+=`<path class="wfe${e.cross?' x':''}${e.ref?' r':''}${e.conflict?' conf':''}${hot?' hot':''}${on?' on':''}${e.manual?' man':''}" data-k="${esc(e.k)}" d="${d}" marker-end="url(#wfarrow${on||hot?'h':e.conflict?'c':e.cross?'x':''})"/>`;
    if(editing)hits+=`<path class="wfe-hit" data-wfe="${esc(e.k)}" d="${wfPathD(e.pts,false)}"><title>${esc((G.by.get(e.a)||{}).name+' → '+(G.by.get(e.b)||{}).name)}${e.conflict?' — order to review: an earlier zone depends on a later one':''}</title></path>`;
    if(on){for(let j=1;j<=e.pts.length-3;j++){const [x1,y1]=e.pts[j],[x2,y2]=e.pts[j+1],vert=x1===x2;if(x1===x2&&y1===y2)continue;hd+=`<rect class="wfh${vert?' v':' h'}" data-wfseg="${j}" x="${Math.round((x1+x2)/2)-5}" y="${Math.round((y1+y2)/2)-5}" width="10" height="10" rx="2"><title>Drag to move this ${vert?'vertical':'horizontal'} segment · double-click to remove the bend</title></rect>`}
      hd+=`<circle class="wfend" data-wfend="a" cx="${Math.round(e.S.x)}" cy="${Math.round(e.S.y)}" r="6"><title>Start of the arrow: drag along the block’s sides (top, bottom, left, right)</title></circle><circle class="wfend b" data-wfend="b" cx="${Math.round(e.E.x)}" cy="${Math.round(e.E.y)}" r="6"><title>End of the arrow: drag along the block’s sides</title></circle>`}});
  return paths+(editing?`<g class="wfe-hits">${hits}</g><g class="wfe-hd">${hd}</g>`:'')+(tmp||'');
}
/* compact bar above the diagram */
function wfLayBar(cx,G){
  if(!cx)return '';const h=wfHist(cx),ed=cx.canEdit,has=!!G;
  const state=cx.scope==='std'?(cx.own?(JSON.stringify(cx.own)===JSON.stringify(cx.pub||null)?'Arranged layout (published)':'Arranged layout — publish to share it with projects'):'Automatic layout')
    :(cx.own?(cx.own.auto?'Automatic layout for this project (standard layout ignored)':'Standard layout + this project’s adjustments'):cx.base?'Standard layout':'Automatic layout');
  const b=(k,l,dis,t,cls)=>`<button type="button" class="btn sm${cls||' ghost'}" data-wflay="${k}"${dis?' disabled':''} title="${esc(t)}">${l}</button>`;
  const multi=ui.wfMulti||[],selId=ui.wfSel&&G&&G.pos.has(ui.wfSel)?ui.wfSel:null,selStep=selId&&G.by.get(selId);
  let ctx='';
  if(ui.wfConn)ctx=`<span class="wflay-e">${ui.wfConn.from?`<b>${esc((G&&G.by.get(ui.wfConn.from)||{}).name||'')}</b> → now click the activity that <b>depends on it</b>`:'Click the activity that <b>provides</b> the requirement (A), then the one that depends on it (B). A → B means B depends on A.'}</span>${b('conn-cancel','Cancel',false,'Leave connection mode')}`;
  else if(ui.wfLayEdit&&multi.length>1){const r=G&&G.by.get(multi[0]);ctx=`<span class="wflay-e">${multi.length} selected · reference: <b>${esc(r?r.name:'')}</b> (stays fixed)</span>${b('align-x','Align columns',!ed,'Same x as the reference (any specialty)')}${b('align-y','Align rows',!ed,'Same y as the reference (only blocks of its specialty)')}${b('dist-x','Distribute ↔',!ed||multi.length<3,'Equal horizontal spacing')}${b('dist-y','Distribute ↕',!ed||multi.length<3,'Equal vertical spacing inside each specialty')}${b('multi-clear','Clear selection',false,'Deselect')}`}
  else if(ui.wfEdge&&ui.wfLayEdit)ctx=`<span class="wflay-e">Arrow selected · drag a segment · drag an end along the block’s sides · double-click the line to add a bend, a handle to remove it</span>${b('route-reset','Reset route',!ed,'Back to the automatic route and connection points for this arrow only')}`;
  else if(selStep&&cx.scope==='std'&&cx.canLink&&!selStep.ref)ctx=`<span class="wflay-e"><b>${esc(selStep.name)}</b></span>${b('prereq','Add prerequisite…',false,'Choose what this activity needs, also from other phases')}`;
  else if(selStep&&cx.scope==='proj')ctx=`<span class="wflay-e"><b>${esc(selStep.name)}</b></span>${b('goto-std','Edit in Company workflow',false,'Dependencies are defined in the company standard')}`;
  return `<div class="wflay-bar" role="toolbar" aria-label="Diagram layout">
    <button type="button" class="btn sm${ui.wfLayEdit?' primary':''}" data-wflay="edit" aria-pressed="${!!ui.wfLayEdit}"${ed&&has?'':' disabled'} title="Arrows (segments and ends), multiple selection and alignment">Edit layout</button>
    ${b('undo','↶ Undo',!ed||!h.u.length,'Undo the last layout change')}${b('redo','↷ Redo',!ed||!h.r.length,'Redo')}
    ${b('auto','Auto layout',!ed||!has,cx.scope==='std'?'Arrange this phase automatically: Inputs → Actions → Outputs (removes manual positions and routes)':'Arrange this view automatically, ignoring the standard’s layout')}
    ${b('reset','Reset layout',!ed||!cx.own,cx.scope==='std'?'Back to the published layout of this phase':'Back to the standard’s layout (removes this project’s adjustments)')}
    ${cx.scope==='std'&&cx.canLink?`<button type="button" class="btn sm${ui.wfConn?' primary':' ghost'}" data-wflay="conn" aria-pressed="${!!ui.wfConn}"${has?'':' disabled'} title="Add a dependency: A → B (B depends on A)">Connect</button>`:''}
    <label class="chk wflay-rnd" title="Rounded corners on the arrows (visual only)"><input type="checkbox" data-wflay-round${prefs.wfRound?' checked':''}> Rounded</label>
    ${ctx?`<span class="wflay-sep"></span>${ctx}`:''}
    <span class="spacer"></span>${G&&G.conflicts.length?`<span class="chip c-w" title="${esc(G.conflicts.map(e=>`${G.by.get(e.a).name} (${WF_CAT[G.by.get(e.a).cat]||'Reference'}) → ${G.by.get(e.b).name} (${WF_CAT[G.by.get(e.b).cat]})`).join('\n'))}">⚠ ${plural(G.conflicts.length,'order conflict')} to review</span>`:''}<span class="muted wflay-st">${esc(state)}${ed?'':' · read-only'}</span></div>`;
}

/* ----- history (one entry per operation: blocks, lanes, zones, routes and anchors together) ----- */
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
/* once the user arranges something, every visible block keeps its current place, so nothing else jumps */
function wfFreeze(own,G,nodes){nodes.forEach(n=>{const p=G.pos.get(n.id);own.n[n.id]={x:Math.round(p.x),dy:Math.round(p.dy)}})}
/* lanes and zones as the content needs them now (stored with the operation) */
function wfDims(own,nodes,o,cx){const G=wfGeom(nodes,o,wfLayEff({...cx,own:{...own,l:{},z:{}}}));G.bands.forEach(b=>{own.l[b.l]={h:b.content}});const z={};if(G.zr[1])z[1]=G.zr[1].min;if(G.zr[2])z[2]=G.zr[2].min;own.z=z;return G}
const wfCurCtx=()=>{const D=ui.wfDia;return D&&D.cx?wfLayCtx(D.o.ctx):null};

/* ----- the bar ----- */
document.addEventListener('change',e=>{if(e.target.matches&&e.target.matches('[data-wflay-round]')){prefs.wfRound=e.target.checked;savePrefs();wfRerender()}},true);
document.addEventListener('click',e=>{const bt=e.target.closest&&e.target.closest('[data-wflay]');if(!bt||bt.disabled||bt.tagName==='INPUT'||bt.tagName==='LABEL')return;
  const cx=wfCurCtx(),k=bt.dataset.wflay;if(!cx)return;
  if(k==='conn-cancel'){ui.wfConn=null;wfRerender();return}
  if(k==='multi-clear'){ui.wfMulti=[];wfRerender();return}
  if(k==='goto-std'){const s=wfStep(ui.wfSel);if(!s)return;prefs.wfSetPhase=s.phaseId;prefs.wfSetSpecs=[];ui.stab='workflow';prefs.stab='workflow';ui.wfExp=ui.wfExp||new Set();ui.wfExp.add(s.id);savePrefs();go('settings');setTimeout(()=>{const c=document.getElementById('wfc-'+s.id);c&&c.scrollIntoView({block:'center'})},60);return}
  if(!cx.canEdit)return;
  if(k==='edit'){ui.wfLayEdit=!ui.wfLayEdit;if(!ui.wfLayEdit){ui.wfEdge=null;ui.wfMulti=[]}wfRerender();const x=document.querySelector('[data-wflay=edit]');x&&x.focus();return}
  if(k==='conn'){ui.wfConn=ui.wfConn?null:{from:null};ui.wfEdge=null;wfRerender();return}
  if(k==='prereq'){openWfPrereq(ui.wfSel);return}
  if(k==='undo'||k==='redo'){const h=wfHist(cx),from=k==='undo'?h.u:h.r,to=k==='undo'?h.r:h.u;if(!from.length)return;to.push(JSON.stringify(cx.own||null));wfLayWrite(cx,JSON.parse(from.pop()));const x=document.querySelector(`[data-wflay=${k}]`);x&&!x.disabled&&x.focus();return}
  if(k==='auto'){wfLayCommit(cx,cx.scope==='std'?null:{auto:true,n:{},l:{},e:{}});toast(cx.scope==='std'?'Automatic layout for this phase: Inputs → Actions → Outputs. Publish to share it.':'Automatic layout for this view of the project.');return}
  if(k==='reset'){wfLayCommit(cx,cx.scope==='std'?(cx.pub?wfClone(cx.pub):null):null);toast(cx.scope==='std'?'Layout of this phase back to the published one. Activities and dependencies are unchanged.':'Back to the standard’s layout. Activities and dependencies are unchanged.');return}
  if(k==='route-reset'&&ui.wfEdge){const own=wfOwnCopy(cx),key=ui.wfEdge;if(cx.scope==='proj'&&cx.base&&cx.base.e&&cx.base.e[key]&&!(cx.own&&cx.own.auto))own.e[key]={auto:true};else delete own.e[key];wfLayCommit(cx,own);return}
  if(['align-x','align-y','dist-x','dist-y'].includes(k)){wfAlign(cx,k);return}
});

/* ----- pointer interactions, confined to the diagram -----
   One gesture at a time. It starts only inside .wfd, ends on release, and is cancelled (with the previous state
   restored) when the button is no longer pressed, on Escape, pointercancel, lost capture, window blur or when the
   page changes — so a press that started on a block can never take over a later click elsewhere. */
let wfPtr=null;
function wfCancelPtr(restore){const p=wfPtr;if(!p)return;wfPtr=null;document.body.classList.remove('wf-dragging');
  try{if(p.capEl&&p.capEl.hasPointerCapture&&p.capEl.hasPointerCapture(p.pointerId))p.capEl.releasePointerCapture(p.pointerId)}catch(_){}
  if(p.moved&&restore&&document.querySelector('.wfd'))wfRepaint(null)}
function wfPtrLive(p){return ui.wfDia&&ui.wfDia.id===p.ctxId&&document.querySelector('.wfd')}
document.addEventListener('pointerdown',e=>{
  const box=e.target.closest&&e.target.closest('.wfd');
  ui.wfSuppress=0;                                       // a new press: the next click is a real one
  if(wfPtr)wfCancelPtr(true);
  if(!box||e.button!==0)return;
  const cx=wfCurCtx();if(!cx||!cx.canEdit)return;
  const t=e.target,end=t.closest('.wfend'),seg=t.closest('.wfh'),con=t.closest('.wfconn'),hitE=t.closest('.wfe-hit'),n=t.closest('.wfn');
  const base={x0:e.clientX,y0:e.clientY,cx,ctxId:wfCtxId(cx),moved:false,pointerId:e.pointerId,box};
  if(end&&ui.wfEdge){e.preventDefault();wfPtr={...base,kind:'end',which:end.dataset.wfend};return}
  if(seg&&ui.wfEdge){e.preventDefault();wfPtr={...base,kind:'seg',j:+seg.dataset.wfseg};return}
  if(con&&cx.canLink){e.preventDefault();e.stopPropagation();wfPtr={...base,kind:'conn',from:con.dataset.wfconn};return}
  if(hitE){e.preventDefault();if(ui.wfEdge!==hitE.dataset.wfe){ui.wfEdge=hitE.dataset.wfe;ui.wfMulti=[];wfRepaint(null)}return}
  if(n&&!ui.wfConn){wfPtr={...base,kind:'node',id:n.dataset.id,el:n};return}
  if(!n&&ui.wfEdge){ui.wfEdge=null;wfRepaint(null)}
},true);
document.addEventListener('pointermove',e=>{const p=wfPtr;if(!p)return;
  if(!(e.buttons&1)){wfCancelPtr(true);return}            // released outside the window: never resume later
  if(!wfPtrLive(p)){wfCancelPtr(false);return}
  const dx=e.clientX-p.x0,dy=e.clientY-p.y0;
  if(!p.moved){if(Math.abs(dx)<5&&Math.abs(dy)<5)return;p.moved=true;document.body.classList.add('wf-dragging');
    p.capEl=p.box;try{p.box.setPointerCapture(p.pointerId)}catch(_){}
    if(p.kind==='node')wfDragStart(p)}
  e.preventDefault();
  if(p.kind==='node'){const r=wfDragOwn(p,dx,dy,false);p.last=r;wfRepaint(r.own,p,r.guides)}
  else if(p.kind==='seg'){const own=wfSegOwn(p,dx,dy);p.last={own};wfRepaint(own,p)}
  else if(p.kind==='end'){const r=wfEndOwn(p,e);p.last=r;wfRepaint(r?r.own:null,p,null,r&&r.hl)}
  else if(p.kind==='conn')wfConnPreview(p,e);
},true);
document.addEventListener('pointerup',e=>{const p=wfPtr;if(!p)return;wfPtr=null;document.body.classList.remove('wf-dragging');
  try{if(p.capEl&&p.capEl.hasPointerCapture(p.pointerId))p.capEl.releasePointerCapture(p.pointerId)}catch(_){}
  if(!p.moved)return;                                    // a click: selection / opening work as before
  ui.wfSuppress=Date.now();
  if(!wfPtrLive(p))return;
  const dx=e.clientX-p.x0,dy=e.clientY-p.y0;
  if(p.kind==='node'){const r=wfDragOwn(p,dx,dy,true);wfLayCommit(p.cx,r.own)}
  else if(p.kind==='seg')wfLayCommit(p.cx,wfSegOwn(p,dx,dy));
  else if(p.kind==='end'){const r=wfEndOwn(p,e);if(r&&r.ok)wfLayCommit(p.cx,r.own);else{wfRepaint(null);toast('The arrow end stays where it was: drop it on a side of its own block.')}}
  else if(p.kind==='conn'){const tg=document.elementFromPoint(e.clientX,e.clientY),n=tg&&tg.closest&&tg.closest('.wfd .wfn');const tmp=document.querySelector('.wfe-tmp');if(tmp)tmp.innerHTML='';if(n&&n.dataset.id!==p.from)wfAskLink(p.from,n.dataset.id)}
},true);
const wfCancelAll=()=>wfCancelPtr(true);
document.addEventListener('pointercancel',wfCancelAll,true);
document.addEventListener('lostpointercapture',e=>{if(wfPtr&&wfPtr.capEl===e.target&&wfPtr.moved)wfCancelPtr(true)},true);
window.addEventListener('blur',wfCancelAll);window.addEventListener('hashchange',wfCancelAll);document.addEventListener('visibilitychange',wfCancelAll);
/* a drag never counts as a click; Shift/Ctrl+click selects several blocks; clicks in connection mode build A → B */
document.addEventListener('click',e=>{
  const inD=e.target.closest&&e.target.closest('.wfd');
  if(ui.wfSuppress&&Date.now()-ui.wfSuppress<400&&(inD||!e.target.isConnected)){ui.wfSuppress=0;e.stopImmediatePropagation();e.preventDefault();return}
  const n=inD&&e.target.closest('.wfn');if(!n)return;const cx=wfCurCtx();if(!cx)return;
  if(ui.wfConn){e.stopImmediatePropagation();e.preventDefault();const id=n.dataset.id;
    if(!ui.wfConn.from){ui.wfConn.from=id;wfRerender()}else if(id===ui.wfConn.from){ui.wfConn.from=null;wfRerender()}else wfAskLink(ui.wfConn.from,id);return}
  if(ui.wfLayEdit&&cx.canEdit&&(e.shiftKey||e.ctrlKey||e.metaKey)){e.stopImmediatePropagation();e.preventDefault();const id=n.dataset.id,m=ui.wfMulti||[];
    ui.wfMulti=m.includes(id)?m.filter(x=>x!==id):[...m,id];ui.wfEdge=null;wfRerender();return}
},true);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(wfPtr&&wfPtr.moved){e.preventDefault();e.stopImmediatePropagation();wfCancelPtr(true);return}
    if(ui.wfConn){e.preventDefault();ui.wfConn=null;wfRerender();return}
    if(ui.wfLayEdit&&(ui.wfEdge||(ui.wfMulti||[]).length)){ui.wfEdge=null;ui.wfMulti=[];wfRerender();return}}
  /* keyboard: Alt + arrows moves the focused block (same rules as dragging) */
  const n=e.target.closest&&e.target.closest('.wfd .wfn');if(!n||!e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  const cx=wfCurCtx();if(!cx||!cx.canEdit)return;e.preventDefault();
  const p={kind:'node',id:n.dataset.id,cx,el:n,ctxId:wfCtxId(cx),noSnap:true};wfDragStart(p);const st=e.shiftKey?48:12;
  const r=wfDragOwn(p,e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0,true);wfLayCommit(cx,r.own);
  const f=document.getElementById('wfn-'+p.id);f&&f.focus();
},true);

/* ----- moving blocks ----- */
function wfDragStart(p){
  const D=ui.wfDia,cx=p.cx,G=wfGeom(D.nodes,D.o,wfLayEff(cx)),me=G.pos.get(p.id),{W,GAP,ZG}=WFL;
  /* the set that moves sideways: this block and the activities that follow it, to its right (decided now) */
  const set=new Set([p.id]),q=[p.id];while(q.length){const a=q.shift();G.edges.filter(e=>e.a===a&&!e.conflict).forEach(e=>{if(!set.has(e.b)&&G.pos.get(e.b).x>=me.x){set.add(e.b);q.push(e.b)}})}
  /* limits: no successor before its predecessor (minimum gap); a block never enters an earlier zone */
  let lo=WFL.LW+WFL.P-Math.min(...[...set].map(id=>G.pos.get(id).x)),hi=Infinity;
  G.edges.forEach(e=>{if(e.conflict)return;const A=G.pos.get(e.a),B=G.pos.get(e.b);
    if(!set.has(e.a)&&set.has(e.b))lo=Math.max(lo,Math.min(0,A.x+W+GAP-B.x));
    if(set.has(e.a)&&!set.has(e.b))hi=Math.min(hi,Math.max(0,B.x-(A.x+W+GAP)))});
  set.forEach(id=>{const z=G.Z.get(id);if(!z)return;let m=-Infinity;D.nodes.forEach(n=>{if(!set.has(n.id)&&G.Z.get(n.id)<z)m=Math.max(m,G.pos.get(n.id).x+W+ZG)});if(m>-Infinity)lo=Math.max(lo,Math.min(0,m-G.pos.get(id).x))});
  Object.assign(p,{G0:G,set,lo:Math.min(lo,0),hi:Math.max(hi,0),me,snap:{}});
  if(p.el)p.el.classList.add('dragging');
}
/* alignment guides: edges and centres of the other visible blocks (x: any lane; y: same lane) */
function wfSnap(p,dx,dy){
  const {W,H,SNAP}=WFL,G=p.G0,me=p.me,lane=G.by.get(p.id).lane,out={dx,dy,g:[]};if(p.noSnap)return out;
  const others=[...G.pos.entries()].filter(([id])=>!p.set.has(id));
  const pick=(mine,refs,cur)=>{let best=null,keep=null;for(const r of refs)for(const m of mine){const d=r.v-m.v,ad=Math.abs(d);
      if(cur&&cur.v===r.v&&cur.k===m.k&&ad<=SNAP+3)keep={d,v:r.v,k:m.k,id:r.id};if(ad<=SNAP&&(!best||ad<Math.abs(best.d)))best={d,v:r.v,k:m.k,id:r.id}}
    /* stay on the current guide unless another one is clearly closer: no jumping between near references */
    return keep&&(!best||Math.abs(best.d)>Math.abs(keep.d)-2)?keep:best};
  const nx=me.x+dx,ny=me.dy+dy;
  const xr=others.flatMap(([id,q])=>[{v:q.x,id},{v:q.x+W/2,id},{v:q.x+W,id}]),xm=[{v:nx,k:'l'},{v:nx+W/2,k:'c'},{v:nx+W,k:'r'}];
  const bx=pick(xm,xr,p.snap.x);if(bx){out.dx=dx+bx.d;p.snap.x=bx;const q=G.pos.get(bx.id);out.g.push({axis:'x',v:bx.v,a:Math.min(q.y,me.y+dy),b:Math.max(q.y+H,me.y+dy+H)})}else p.snap.x=null;
  const yr=others.filter(([id])=>G.by.get(id).lane===lane).flatMap(([id,q])=>[{v:q.dy,id},{v:q.dy+H/2,id},{v:q.dy+H,id}]),ym=[{v:ny,k:'t'},{v:ny+H/2,k:'m'},{v:ny+H,k:'b'}];
  const by=pick(ym,yr,p.snap.y);if(by){out.dy=dy+by.d;p.snap.y=by;const q=G.pos.get(by.id);out.g.push({axis:'y',v:by.v,lane,a:Math.min(q.x,me.x+out.dx),b:Math.max(q.x+W,me.x+out.dx+W)})}else p.snap.y=null;
  return out;
}
function wfDragOwn(p,dx0,dy0,final){
  const D=ui.wfDia,own=wfOwnCopy(p.cx),G=p.G0,{W,H,GY,TOP,ZG}=WFL;
  wfFreeze(own,G,D.nodes);
  const s=wfSnap(p,dx0,dy0);
  const ddx=Math.round(Math.max(p.lo,Math.min(p.hi,s.dx))),ndy=Math.round(Math.max(TOP,p.me.dy+s.dy));
  const moved=new Map();p.set.forEach(id=>{own.n[id].x=Math.round(G.pos.get(id).x+ddx);moved.set(id,ddx)});own.n[p.id].dy=ndy;
  /* zones follow the content: a later zone moves right when an earlier one needs the space */
  /* (only the blocks that stay still are pushed; the moving set keeps its own distances) */
  for(const z of [1,2]){let need=-Infinity,minZ=Infinity;D.nodes.forEach(n=>{const zz=G.Z.get(n.id),q=own.n[n.id];if(zz<z)need=Math.max(need,q.x+W+ZG);else if(zz===z&&!p.set.has(n.id))minZ=Math.min(minZ,q.x)});
    if(need>-Infinity&&minZ<Infinity&&minZ<need){const d=Math.round(need-minZ);D.nodes.forEach(n=>{if(G.Z.get(n.id)>=z&&!p.set.has(n.id)){own.n[n.id].x+=d;moved.set(n.id,(moved.get(n.id)||0)+d)}})}}
  /* routes between blocks that moved by the same amount keep their shape */
  G.edges.forEach(e=>{if(!e.manual)return;const a=moved.get(e.a),b=moved.get(e.b);if(a&&a===b)own.e[e.k]={...(own.e[e.k]||{}),s:wfCoordsStore(e,e.coords.map((v,i)=>((i%2===0)===e.hz)?v+a:v),G)}});
  if(final){
    /* no overlaps: a block dropped on another one goes just below it, inside the same lane */
    const lane=id=>G.by.get(id).lane,list=[p.id,...[...moved.keys()].filter(id=>id!==p.id)];
    list.forEach(id=>{const a=own.n[id];let g=0,c;while(g++<100&&(c=D.nodes.find(n=>n.id!==id&&lane(n.id)===lane(id)&&Math.abs(own.n[n.id].x-a.x)<W+8&&Math.abs(own.n[n.id].dy-a.dy)<H+GY)))a.dy=own.n[c.id].dy+H+GY});
    wfDims(own,D.nodes,D.o,p.cx);
  }
  return {own,guides:s.g};
}

/* ----- editing a route: segments and ends ----- */
function wfEdgeNow(cx){const D=ui.wfDia,G=wfGeom(D.nodes,D.o,wfLayEff(cx));return {G,e:G.edges.find(x=>x.k===ui.wfEdge)}}
function wfSegOwn(p,dx,dy){
  if(!p.base){const {G,e}=wfEdgeNow(p.cx);if(!e)return wfOwnCopy(p.cx);let c=wfFullCoords(e),ci=wfCtrlOf(e,c,p.j);
    /* the first move after the start: two coordinates are added so that move gets its own line */
    if(p.j===1){c=[e.hz?e.S0.x:e.S0.y,e.hz?e.S0.y:e.S0.x,...c];ci=1}
    p.base={G,e,c,ci}}
  const {G,e,c}=p.base,s=c.slice(),i=p.base.ci;if(i==null)return wfOwnCopy(p.cx);
  const isX=(i%2===0)===e.hz;s[i]=Math.round(s[i]+(isX?dx:dy));
  const own=wfOwnCopy(p.cx);own.e[ui.wfEdge]={...(own.e[ui.wfEdge]||{}),a:e.A,b:e.B,s:wfCoordsStore(e,s,G)};return own;
}
/* the route with its finishing moves written out, so every middle segment is controlled by one coordinate */
function wfFullCoords(e){const p=e.pts,c=[];let h=e.hz;for(let j=2;j<p.length-2;j++){c.push(h?p[j][0]:p[j][1]);h=!h}return c}
function wfCtrlOf(e,c,j){/* segment j starts at point j; with full coords point j (j≥2) comes from coordinate j-2 */return j>=2&&j-2<c.length?j-2:null}
/* an end of the arrow moves along the sides of its own block; the route is recomputed for the new direction */
function wfEndOwn(p,ev){
  if(!p.base){const {G,e}=wfEdgeNow(p.cx);if(!e)return null;p.base={G,e}}
  const {G,e}=p.base,id=p.which==='a'?e.a:e.b,q=G.pos.get(id),r=document.querySelector('.wfd').getBoundingClientRect(),x=ev.clientX-r.left,y=ev.clientY-r.top,{W,H}=WFL;
  const far=x<q.x-48||x>q.x+W+48||y<q.y-48||y>q.y+H+48;
  const d={l:Math.abs(x-q.x),r:Math.abs(x-q.x-W),t:Math.abs(y-q.y),b:Math.abs(y-q.y-H)},side=Object.keys(d).sort((a,b)=>d[a]-d[b])[0];
  const t=side==='l'||side==='r'?Math.max(0,Math.min(1,(y-q.y)/H)):Math.max(0,Math.min(1,(x-q.x)/W));
  const own=wfOwnCopy(p.cx),cur=own.e[ui.wfEdge]||{},a={side,t:Math.round(t*1000)/1000},nx={a:p.which==='a'?a:(cur.a||e.A),b:p.which==='b'?a:(cur.b||e.B)};
  own.e[ui.wfEdge]=nx;   // a new direction gets a new automatic route
  const hl=side==='l'?[q.x,q.y,q.x,q.y+H]:side==='r'?[q.x+W,q.y,q.x+W,q.y+H]:side==='t'?[q.x,q.y,q.x+W,q.y]:[q.x,q.y+H,q.x+W,q.y+H];
  return {own,ok:!far,hl};
}
document.addEventListener('dblclick',e=>{if(!ui.wfLayEdit||!(e.target.closest&&e.target.closest('.wfd')))return;const cx=wfCurCtx();if(!cx||!cx.canEdit)return;
  const h=e.target.closest('.wfh'),hitE=e.target.closest('.wfe-hit');if(!h&&!hitE)return;e.preventDefault();
  if(hitE)ui.wfEdge=hitE.dataset.wfe;const {G,e:E}=wfEdgeNow(cx);if(!E)return;const c=wfFullCoords(E);
  if(h){const i=+h.dataset.wfseg===1?null:wfCtrlOf(E,c,+h.dataset.wfseg);if(i==null||c.length<3){toast('This arrow has no bend to remove there.');return}if(i+1<c.length)c.splice(i,2);else c.splice(i-1,2)}
  else{const r=document.querySelector('.wfd').getBoundingClientRect(),C=[e.clientX-r.left,e.clientY-r.top],pts=E.pts;let best=-1,bd=Infinity;
    for(let j=1;j<pts.length-2;j++){const [x1,y1]=pts[j],[x2,y2]=pts[j+1],d=x1===x2?Math.abs(C[0]-x1)+Math.max(0,Math.min(y1,y2)-C[1],C[1]-Math.max(y1,y2)):Math.abs(C[1]-y1)+Math.max(0,Math.min(x1,x2)-C[0],C[0]-Math.max(x1,x2));if(d<bd){bd=d;best=j}}
    if(best<1)return;
    if(best===1)c.splice(0,0,...(E.hz?[Math.round(C[0]),E.S0.y]:[Math.round(C[1]),E.S0.x]));          // first move after the start
    else{const i=best-2,isX=(i%2===0)===E.hz;c.splice(i+1,0,isX?Math.round(C[1]):Math.round(C[0]),c[i])}   // split: line, cross value, line
  }
  const own=wfOwnCopy(cx);own.e[ui.wfEdge]={...(own.e[ui.wfEdge]||{}),a:E.A,b:E.B,s:wfCoordsStore(E,c,G)};wfLayCommit(cx,own);
},true);

/* ----- live preview: positions, lanes, separator, arrows and guides are updated in place ----- */
function wfRepaint(own,p,guides,hl){
  const D=ui.wfDia;if(!D)return;const cx=wfLayCtx(D.o.ctx);if(!cx)return;
  const G=wfGeom(D.nodes,D.o,wfLayEff(own?{...cx,own}:cx)),box=document.querySelector('.wfd');if(!box)return;
  box.style.width=G.wd+'px';box.style.height=G.ht+'px';const svg=box.querySelector('svg.wfsvg');if(svg){svg.setAttribute('width',G.wd);svg.setAttribute('height',G.ht)}
  G.bands.forEach(b=>{const el=box.querySelector(`.wfl[data-lane="${CSS.escape(b.l)}"]`);if(el){el.style.top=b.y+'px';el.style.height=b.h+'px';el.style.width=G.wd+'px'}});
  const sp=box.querySelector('.wfzsep');if(sp&&G.sep!=null){sp.style.left=G.sep+'px';sp.style.height=G.ht+'px'}
  D.nodes.forEach(n=>{const el=document.getElementById('wfn-'+n.id),q=G.pos.get(n.id);if(el){el.style.left=q.x+'px';el.style.top=q.y+'px'}});
  const tmp=hl?`<line class="wfside" x1="${hl[0]}" y1="${hl[1]}" x2="${hl[2]}" y2="${hl[3]}"/>`:'';
  const g=box.querySelector('.wfe-g');if(g)g.innerHTML=wfEdgesSVG(G,!!(cx.canEdit&&ui.wfLayEdit),tmp);
  const gl=box.querySelector('.wfguides');if(gl)gl.innerHTML=(guides||[]).map(x=>x.axis==='x'?`<i class="wfg v" style="left:${Math.round(x.v)}px;top:${Math.round(x.a)-8}px;height:${Math.round(x.b-x.a)+16}px"></i>`:(()=>{const b=G.bandOf.get(x.lane);return b?`<i class="wfg h" style="top:${Math.round(b.y+x.v)}px;left:${Math.round(x.a)-8}px;width:${Math.round(x.b-x.a)+16}px"></i>`:''})()).join('');
  const bar=document.querySelector('.wflay-bar');if(bar&&!p){const t=document.createElement('div');t.innerHTML=wfLayBar(cx,G);bar.replaceWith(t.firstElementChild)}
}

/* ----- alignment of several blocks (Edit layout + Shift/Ctrl+click); the first one selected stays fixed ----- */
function wfAlign(cx,k){
  const D=ui.wfDia,G=wfGeom(D.nodes,D.o,wfLayEff(cx)),ids=(ui.wfMulti||[]).filter(id=>G.pos.has(id));if(ids.length<2)return;
  const {W,H,GY,GAP,ZG}=WFL,own=wfOwnCopy(cx);wfFreeze(own,G,D.nodes);const ref=G.pos.get(ids[0]),lane=id=>G.by.get(id).lane;let skipped=[];
  const okX=(id,x)=>{const edges=G.edges.filter(e=>!e.conflict&&(e.a===id||e.b===id));for(const e of edges){if(e.b===id&&x<own.n[e.a].x+W+GAP)return 'a requirement would be after it';if(e.a===id&&own.n[e.b].x<x+W+GAP)return 'an activity that needs it would be before it'}
    const z=G.Z.get(id);for(const n of D.nodes){if(n.id===id)continue;const zz=G.Z.get(n.id),q=own.n[n.id];if(zz<z&&x<q.x+W+ZG)return 'it would enter an earlier zone';if(zz>z&&x+W+ZG>q.x)return 'it would enter a later zone'}
    for(const n of D.nodes){if(n.id!==id&&lane(n.id)===lane(id)&&Math.abs(own.n[n.id].x-x)<W+8&&Math.abs(own.n[n.id].dy-own.n[id].dy)<H+GY)return 'it would overlap another block'}return null};
  const okY=(id,dy)=>{if(lane(id)!==lane(ids[0]))return 'rows are shared only inside the same specialty';for(const n of D.nodes){if(n.id!==id&&lane(n.id)===lane(id)&&Math.abs(own.n[n.id].x-own.n[id].x)<W+8&&Math.abs(own.n[n.id].dy-dy)<H+GY)return 'it would overlap another block'}return null};
  const tryX=(id,x)=>{const r=okX(id,Math.round(x));if(r)skipped.push(`${G.by.get(id).name}: ${r}`);else own.n[id].x=Math.round(x)};
  const tryY=(id,dy)=>{const r=okY(id,Math.round(dy));if(r)skipped.push(`${G.by.get(id).name}: ${r}`);else own.n[id].dy=Math.round(dy)};
  if(k==='align-x')ids.slice(1).forEach(id=>tryX(id,ref.x));
  if(k==='align-y')ids.slice(1).forEach(id=>tryY(id,ref.dy));
  if(k==='dist-x'){const s=[...ids].sort((a,b)=>G.pos.get(a).x-G.pos.get(b).x),a=G.pos.get(s[0]).x,b=G.pos.get(s[s.length-1]).x;s.slice(1,-1).forEach((id,i)=>tryX(id,a+(b-a)*(i+1)/(s.length-1)))}
  if(k==='dist-y'){const byL=new Map();ids.forEach(id=>(byL.get(lane(id))||byL.set(lane(id),[]).get(lane(id))).push(id));byL.forEach(list=>{if(list.length<3)return;const s=[...list].sort((a,b)=>G.pos.get(a).dy-G.pos.get(b).dy),a=G.pos.get(s[0]).dy,b=G.pos.get(s[s.length-1]).dy;s.slice(1,-1).forEach((id,i)=>{own.n[id].dy=Math.round(a+(b-a)*(i+1)/(s.length-1))})})}
  wfDims(own,D.nodes,D.o,cx);wfLayCommit(cx,own);
  toast(skipped.length?`Aligned. Not moved: ${skipped.slice(0,3).join('; ')}${skipped.length>3?'…':''}`:'Aligned.',skipped.length?'err':undefined);
}

/* ----- adding a dependency from the diagram (A → B: B depends on A) ----- */
function wfConnPreview(p,ev){const r=document.querySelector('.wfd').getBoundingClientRect(),D=ui.wfDia,G=wfGeom(D.nodes,D.o,wfLayEff(p.cx)),a=G.pos.get(p.from);if(!a)return;
  const x1=a.x+WFL.W,y1=a.y+WFL.H/2,x2=ev.clientX-r.left,y2=ev.clientY-r.top,t=document.querySelector('.wfe-tmp');if(t)t.innerHTML=`<path class="wfe on tmp" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#wfarrowh)"/>`}
function wfLinkProblem(ed,a,b){const A=wfStep(a,ed),B=wfStep(b,ed);if(!A||!B)return 'Only activities of the Company workflow can be connected here.';
  if(a===b)return 'An activity can’t depend on itself.';if(B.deps.includes(a))return `“${B.name}” already depends on “${A.name}”.`;
  if(wfCycle(ed,b,a))return `Not possible: “${A.name}” already depends on “${B.name}” (directly or through other activities), so this link would create a loop.`;return null}
async function wfAskLink(a,b){
  const ed=wfEdit(),A=wfStep(a,ed),B=wfStep(b,ed),prob=wfLinkProblem(ed,a,b);ui.wfConn=null;
  if(prob){wfRerender();toast(prob,'err');return}
  const ok=await confirmBox('Add this dependency?',`<b>${esc(A.name)}</b> → <b>${esc(B.name)}</b><br>“${esc(B.name)}” will <b>depend on</b> “${esc(A.name)}” (it needs it first). ${A.phaseId!==B.phaseId?`The requirement comes from ${esc(phName(A.phaseId))}. `:''}This changes the Company workflow draft; publish to share it.`,'Add dependency');
  if(!ok){wfRerender();return}
  wfMutate(dr=>{const s=wfStep(b,dr);if(s&&!s.deps.includes(a)&&!wfCycle(dr,b,a))s.deps.push(a);wfFixOrder(dr,s.phaseId)});
  toast(`“${B.name}” now depends on “${A.name}”`);
}
/* a new dependency never leaves a manually placed activity before what it needs: it (and what follows it) moves right */
function wfFixOrder(dr,ph){
  const L=dr.layout&&dr.layout[ph];if(!L||!L.n)return;const {W,GAP}=WFL,steps=dr.steps.filter(s=>!s.retired),zone=s=>s.phaseId!==ph?0:s.cat==='input'?0:s.cat==='action'?1:2;
  for(let g=0;g<50;g++){let changed=false;
    steps.forEach(s=>{const q=L.n[s.id];if(!q)return;s.deps.forEach(d=>{const ds=wfStep(d,dr),pq=L.n[d];if(!ds||!pq||zone(ds)>zone(s))return;const need=pq.x+W+GAP;
      if(q.x<need){const dx=need-q.x,mv=new Set([s.id]),st=[s.id];while(st.length){const x=st.pop();steps.forEach(y=>{if(y.deps.includes(x)&&!mv.has(y.id)&&L.n[y.id]&&L.n[y.id].x>=q.x){mv.add(y.id);st.push(y.id)}})}
        mv.forEach(id=>{L.n[id].x+=dx});changed=true}})});
    if(!changed)break}
}
/* a new activity in a phase with an arranged layout goes at the START of its zone (left of the first one of that
   category); when its lane has no room there, the blocks from that position on move right to make space */
function wfInsertInLayout(dr,s){
  const L=dr.layout&&dr.layout[s.phaseId];if(!L||!L.n||!Object.keys(L.n).length)return;
  const g=wfStdNodes(dr,s.phaseId,null),others=g.nodes.filter(n=>n.id!==s.id),{W,GX,ZG,TOP,H,GY}=WFL,X0=WFL.LW+WFL.P;
  const G=wfGeom(others,{mode:'std',std:dr},{n:L.n,l:L.l||{},z:L.z||{},e:L.e||{}}),z=s.cat==='input'?0:s.cat==='action'?1:2,lane=wfSpecOf(s);
  const inZ=others.filter(n=>G.Z.get(n.id)===z),prev=others.filter(n=>G.Z.get(n.id)<z);
  let x=inZ.length?Math.min(...inZ.map(n=>G.pos.get(n.id).x)):(prev.length?Math.max(...prev.map(n=>G.pos.get(n.id).x+W))+ZG:X0);
  others.forEach(n=>{const q=G.pos.get(n.id);L.n[n.id]={x:Math.round(q.x),dy:Math.round(q.dy)}});
  const sameLane=others.filter(n=>n.lane===lane),over=dy=>sameLane.some(n=>{const q=L.n[n.id];return q.x<x+W+8&&q.x+W+8>x&&q.dy<dy+H+GY&&q.dy+H+GY>dy});
  if(over(TOP)){const dx=W+GX;others.forEach(n=>{if(L.n[n.id].x>=x)L.n[n.id].x+=dx});
    Object.keys(L.e||{}).forEach(k=>{const r=L.e[k];if(r&&r.s)r.s=r.s.map(v=>typeof v==='number'&&v>=x?v+dx:v)});if(L.z){if(L.z[1]>=x)L.z[1]+=dx;if(L.z[2]>=x)L.z[2]+=dx}}
  let dy=TOP,gi=0;while(over(dy)&&gi++<100)dy+=H+GY;
  L.n[s.id]={x:Math.round(x),dy};
}
/* several arrows close together: the one under the pointer is highlighted */
document.addEventListener('pointerover',e=>{const h=e.target.closest&&e.target.closest('.wfe-hit');if(!h)return;const k=h.dataset.wfe;document.querySelectorAll('.wfe.hov').forEach(x=>x.classList.remove('hov'));const p=document.querySelector(`path.wfe[data-k="${CSS.escape(k)}"]`);p&&p.classList.add('hov')},true);
document.addEventListener('pointerout',e=>{if(e.target.closest&&e.target.closest('.wfe-hit'))document.querySelectorAll('.wfe.hov').forEach(x=>x.classList.remove('hov'))},true);
