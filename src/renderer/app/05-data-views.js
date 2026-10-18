/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- v4 data: saved task views and favorites (configuration only) ---------- */
function normViews(o,d){
  const pids=new Set(o.projects.map(p=>p.id)),seen=new Set(),now=new Date().toISOString();
  o.views=arr(d.views).filter(v=>v&&v.id&&typeof v==='object'&&!seen.has(v.id)&&seen.add(v.id)).filter(v=>!v.projectId||pids.has(v.projectId)).map(v=>{const pid=v.projectId||null;
    return {id:String(v.id),name:String(v.name||'Untitled view').trim().slice(0,80)||'Untitled view',projectId:pid,...normCfg(v,pid),createdAt:v.createdAt||now,updatedAt:v.updatedAt||v.createdAt||now}});
  const vids=new Set(o.views.map(v=>v.id)),fs=new Set();
  o.favorites=arr(d.favorites).filter(f=>f&&vids.has(f.viewId)&&!fs.has(f.viewId)&&fs.add(f.viewId)).map(f=>({id:String(f.id||uid('fav')),viewId:f.viewId}));
}
/* deliverable order inside a phase: target % ascending, then the configured milestone order, then additional deliverables by date and name.
   Milestones without a target keep their configured position (they take the target of the milestone before them). Names are never parsed for %. */
function msRank(phaseId,msId){
  const g=phase(phaseId);if(!g||!msId)return null;let last=-1,i=0;
  for(const m of g.milestones){if(m.target!=null)last=m.target;if(m.id===msId)return [last,i];i++}
  return null;
}
function delivCmp(a,b){
  const pa=phIdxId(a.phaseId),pb=phIdxId(b.phaseId);if(pa!==pb)return pa-pb;
  const ra=msRank(a.phaseId,a.milestoneId),rb=msRank(b.phaseId,b.milestoneId);
  if(ra&&!rb)return -1;if(rb&&!ra)return 1;
  if(ra&&rb){if(ra[0]!==rb[0])return ra[0]-rb[0];if(ra[1]!==rb[1])return ra[1]-rb[1]}
  const da=a.due?iso2dn(a.due):Infinity,db=b.due?iso2dn(b.due):Infinity;if(da!==db)return da-db;
  const n=String(a.name).localeCompare(String(b.name),undefined,{numeric:true,sensitivity:'base'});if(n)return n;
  return (a.seq||0)-(b.seq||0);
}
function sortDelivs(list){return list.slice().sort(delivCmp)}
