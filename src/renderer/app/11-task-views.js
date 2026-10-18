/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- saved task views: configuration only, never copies of tasks ---------- */
const FIELDS={
  text:{label:'Task or project name',ops:['contains','not_contains'],val:'text'},
  project:{label:'Project',ops:['is','isnot'],val:'project',globalOnly:true},
  pm:{label:'Project PM',ops:['is','isnot'],val:'person'},
  assignee:{label:'Assignee',ops:['is','isnot','set','empty'],val:'person'},
  status:{label:'Status',ops:['is','isnot'],val:'status'},
  priority:{label:'Priority',ops:['is','isnot'],val:'priority'},
  phase:{label:'Phase',ops:['is','isnot'],val:'phase'},
  deliverable:{label:'Deliverable',ops:['is','isnot','set','empty'],val:'deliverable'},
  service:{label:'Discipline',ops:['is','isnot','set','empty'],val:'service'},
  source:{label:'Source',ops:['is','isnot'],val:'source'},
  due:{label:'Due date',ops:['overdue','today','this_week','next_7','next_30','before','after','on','empty','set'],val:'date'}};
const OPL={is:'is',isnot:'is not',set:'is set',empty:'is empty',contains:'contains',not_contains:'does not contain',overdue:'is overdue',today:'is today',this_week:'is this week (Mon–Sun)',next_7:'is in the next 7 days',next_30:'is in the next 30 days',before:'is before',after:'is after',on:'is on'};
const OPL_F={assignee:{set:'is assigned',empty:'is unassigned'},deliverable:{set:'is linked',empty:'is general (none)'},service:{set:'is set',empty:'is not set'},due:{empty:'is not set',set:'is set'}};
const opLabel=(f,o)=>(OPL_F[f]&&OPL_F[f][o])||OPL[o];
const NOVAL=['set','empty','overdue','today','this_week','next_7','next_30'];
const SORTF={due:'Due date',priority:'Priority',status:'Status',name:'Task name',project:'Project',assignee:'Assignee',phase:'Phase',deliverable:'Deliverable',service:'Discipline',source:'Source',updated:'Last updated',created:'Created'};
const COL2SORT={project:'project',deliverable:'deliverable',assignee:'assignee',status:'status',due:'due',priority:'priority',phase:'phase',service:'service',source:'source',updated:'updated',created:'created'};
const TCOLS={project:'Project',deliverable:'Deliverable',assignee:'Assignee',status:'Status',due:'Due',priority:'Priority',phase:'Phase',service:'Discipline',source:'Source',updated:'Updated',created:'Created'};
const GROUPS={status:'Status',assignee:'Assignee',project:'Project',phase:'Phase',deliverable:'Deliverable',none:'No grouping'};
const LAYOUTS={table:'Table',board:'Board',list:'List',calendar:'Calendar'};
const clone=o=>JSON.parse(JSON.stringify(o));
function defaultCfg(pid){return {layout:'table',filters:{mode:'simple',join:'and',groups:[{join:'and',rules:[]}]},sort:[{field:'due',dir:'asc'},{field:'priority',dir:'desc'}],group:pid?'deliverable':'status',columns:pid?['deliverable','assignee','status','due']:['project','deliverable','assignee','status','due'],showDone:false,includeArchived:false}}
const CFG_KEYS=['layout','filters','sort','group','columns','showDone','includeArchived'];
const cfgOf=v=>{const o={};CFG_KEYS.forEach(k=>o[k]=clone(v[k]));return o};
function normCfg(c,pid){
  const d=defaultCfg(pid),o={};
  o.layout=LAYOUTS[c.layout]?c.layout:d.layout;
  const f=c.filters&&typeof c.filters==='object'?c.filters:d.filters;
  o.filters={mode:f.mode==='advanced'?'advanced':'simple',join:f.join==='or'?'or':'and',groups:arr(f.groups).filter(g=>g&&typeof g==='object').map(g=>({join:g.join==='or'?'or':'and',rules:arr(g.rules).filter(r=>r&&FIELDS[r.field]&&FIELDS[r.field].ops.includes(r.op)&&!(pid&&r.field==='project')).map(r=>({field:r.field,op:r.op,value:r.value==null?'':String(r.value)}))}))};
  if(!o.filters.groups.length)o.filters.groups=[{join:'and',rules:[]}];
  o.sort=arr(c.sort).filter(s=>s&&SORTF[s.field]&&!(pid&&s.field==='project')).map(s=>({field:s.field,dir:s.dir==='desc'?'desc':'asc'}));
  o.group=GROUPS[c.group]&&!(pid&&c.group==='project')?c.group:d.group;
  o.columns=arr(c.columns).filter((x,i,a)=>TCOLS[x]&&a.indexOf(x)===i&&!(pid&&x==='project'));
  if(!Array.isArray(c.columns))o.columns=d.columns;
  o.showDone=!!c.showDone;o.includeArchived=!pid&&!!c.includeArchived;
  return o;
}
/* evaluation (relative dates are recalculated every time) */
const incomplete=r=>!NOVAL.includes(r.op)&&(r.value==null||String(r.value).trim()==='');
function ruleMatch(t,r){
  if(incomplete(r))return true; // a rule still being written doesn't hide anything
  const p=project(t.projectId),v=r.value,today=todayDN();
  const isop=(x)=>r.op==='is'?x===v:r.op==='isnot'?x!==v:r.op==='set'?!!x:r.op==='empty'?!x:true;
  switch(r.field){
    case 'text':{const hay=(t.name+' '+(p?p.name+' '+p.code:'')).toLowerCase(),q=String(v).toLowerCase().trim();if(!q)return true;return r.op==='contains'?hay.includes(q):!hay.includes(q)}
    case 'project':return isop(t.projectId);
    case 'pm':return isop(p?p.pmId:null);
    case 'assignee':return isop(t.assignedToId||null);
    case 'status':return isop(t.status);
    case 'priority':return isop(t.priority);
    case 'source':return isop(t.source);
    case 'phase':return isop(taskPhaseId(t));
    case 'deliverable':return isop(t.deliverableId||null);
    case 'service':return isop(t.serviceId||null);
    case 'due':{const x=t.due?iso2dn(t.due):null,wk0=today-dowMon(today);
      switch(r.op){case 'empty':return x==null;case 'set':return x!=null;case 'overdue':return x!=null&&x<today&&t.status!=='Done';case 'today':return x===today;case 'this_week':return x!=null&&x>=wk0&&x<=wk0+6;case 'next_7':return x!=null&&x>=today&&x<=today+7;case 'next_30':return x!=null&&x>=today&&x<=today+30;
        case 'before':return x!=null&&!!v&&x<iso2dn(v);case 'after':return x!=null&&!!v&&x>iso2dn(v);case 'on':return x!=null&&!!v&&x===iso2dn(v)}return true}
  }
  return true;
}
function cfgMatch(t,cfg){
  const gs=cfg.filters.groups.filter(g=>g.rules.length);if(!gs.length)return true;
  const gm=g=>g.join==='or'?g.rules.some(r=>ruleMatch(t,r)):g.rules.every(r=>ruleMatch(t,r));
  return cfg.filters.join==='or'?gs.some(gm):gs.every(gm);
}
const allRules=cfg=>(cfg.filters?cfg.filters.groups:[]).flatMap(g=>g.rules);
function evalView(cfg,pid){
  const doneAsked=allRules(cfg).some(r=>r.field==='status'&&r.op==='is'&&r.value==='Done');
  let list=(pid?tasksOf(pid):S.tasks.filter(t=>{const p=project(t.projectId);return p&&(cfg.includeArchived||!p.archived)}));
  list=list.filter(t=>(cfg.showDone||doneAsked||t.status!=='Done')&&cfgMatch(t,cfg));
  return sortByCfg(list,cfg);
}
function sortByCfg(list,cfg){
  const pr={High:2,Normal:1,Low:0};
  const key=(t,f)=>{switch(f){case 'due':return t.due?iso2dn(t.due):null;case 'priority':return pr[t.priority]??1;case 'status':return T_STAT.indexOf(t.status);case 'name':return t.name.toLowerCase();case 'project':return project(t.projectId)?.code||null;
    case 'assignee':return t.assignedToId?pname(t.assignedToId).toLowerCase():null;case 'phase':{const ph=taskPhaseId(t);return ph?phIdxId(ph):null}case 'deliverable':return t.deliverableId?(deliv(t.deliverableId)?.name||'').toLowerCase():null;case 'service':return service(t.serviceId)?service(t.serviceId).name.toLowerCase():null;case 'source':{const i=SOURCES.indexOf(t.source);return i<0?null:i}case 'updated':return t.updatedAt||null;case 'created':return t.createdAt||null}return 0};
  // no sort levels = creation order (task seq, then created time)
  const sorts=cfg.sort;
  return list.slice().sort((a,b)=>{for(const s of sorts){const x=key(a,s.field),y=key(b,s.field);if(x===y)continue;if(x==null)return 1;if(y==null)return -1;const c=typeof x==='string'&&typeof y==='string'?x.localeCompare(y,undefined,{numeric:true,sensitivity:'base'}):(x<y?-1:1);if(!c)continue;return s.dir==='desc'?-c:c}return ((a.seq||0)-(b.seq||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))});
}
/* human summary of filters */
function valueLabel(r){
  const v=r.value;switch(FIELDS[r.field].val){
    case 'person':return pname(v)==='Unassigned'&&!person(v)?'(deleted person)':pname(v);
    case 'project':{const p=project(v);return p?p.code:'(deleted project)'}
    case 'phase':return phase(v)?phase(v).name:'(deleted phase)';
    case 'deliverable':{const d=deliv(v);return d?d.name:'(deleted deliverable)'}
    case 'service':return service(v)?service(v).name:'(deleted discipline)';
    case 'date':return v?fmt(v):'(no date)';
    case 'text':return `“${v}”`;
    default:return v}
}
function ruleText(r){return `${FIELDS[r.field].label} ${opLabel(r.field,r.op)}${NOVAL.includes(r.op)?'':incomplete(r)?' (no value yet)':' '+valueLabel(r)}`}
function cfgSummary(cfg){
  const gs=cfg.filters.groups.filter(g=>g.rules.length);let s;
  if(!gs.length)s='No filters';
  else if(gs.length===1)s=gs[0].rules.map(ruleText).join(gs[0].join==='or'?' or ':' · ');
  else s=gs.map(g=>'('+g.rules.map(ruleText).join(g.join==='or'?' or ':' and ')+')').join(cfg.filters.join==='or'?' or ':' and ');
  return s+(cfg.showDone?' · Done shown':'');
}
/* references to deleted items: flagged, never removed silently */
function cfgIssues(cfg,pid){
  const out=[];
  allRules(cfg).forEach(r=>{const v=r.value;if(NOVAL.includes(r.op)||r.field==='text'||r.field==='due'||incomplete(r))return;
    const k=FIELDS[r.field].val;
    if(k==='person'&&!person(v))out.push(`${FIELDS[r.field].label} filter refers to a person who was removed`);
    if(k==='project'&&!project(v))out.push('Project filter refers to a project that was deleted');
    if(k==='phase'&&!phase(v))out.push('Phase filter refers to a phase that was deleted');
    if(k==='deliverable'&&(!deliv(v)||(pid&&deliv(v).projectId!==pid)))out.push('Deliverable filter refers to a deliverable that was deleted');
    if(k==='service'&&!service(v))out.push('Discipline filter refers to a discipline that was deleted')});
  return out;
}
/* scope + active view + temporary (unsaved) changes */
const scopeKeyOf=pid=>pid||'global';
const allKey=pid=>pid?'all:'+pid:'all';
const viewsFor=pid=>S.views.filter(v=>(v.projectId||null)===(pid||null));
const viewById=id=>S.views.find(v=>v.id===id);
function ctxOf(pid){
  const sk=scopeKeyOf(pid);let vid=prefs.activeView[sk]||'all';
  let view=vid==='all'?null:viewById(vid);if(vid!=='all'&&(!view||(view.projectId||null)!==(pid||null))){vid='all';view=null;prefs.activeView[sk]='all'}
  const key=view?view.id:allKey(pid),base=view?cfgOf(view):defaultCfg(pid);
  const draft=prefs.drafts[key];const cfg=draft?normCfg(draft,pid):clone(base);
  const dirty=!!draft&&cfgKey(draft,pid)!==cfgKey(base,pid);
  return {pid,sk,vid,view,key,base,cfg,dirty};
}
// switching between the simple and advanced editor is not a change to the view
const cfgKey=(c,pid)=>{const n=normCfg(c,pid);n.filters.mode='';return JSON.stringify(n)};
function setCfg(pid,fn,noRender){const c=ctxOf(pid);const d=clone(c.cfg);fn(d);const n=normCfg(d,pid);if(JSON.stringify(n)===JSON.stringify(normCfg(c.base,pid)))delete prefs.drafts[c.key];else prefs.drafts[c.key]=n;savePrefs();if(!noRender)render()}
const curPid=()=>ui.view==='project'?ui.pid:null;
const advShown=c=>c.cfg.filters.mode==='advanced'||!simpleCompatible(c.cfg)||cfgIssues(c.cfg,c.pid).length>0;
function deleteViews(ids){const k=new Set(ids);S.views=S.views.filter(v=>!k.has(v.id));S.favorites=S.favorites.filter(f=>!k.has(f.viewId));
  ids.forEach(id=>delete prefs.drafts[id]);Object.keys(prefs.activeView).forEach(sk=>{if(k.has(prefs.activeView[sk]))prefs.activeView[sk]='all'})}
function viewRefs(kind,id){return S.views.filter(v=>allRules(v).some(r=>FIELDS[r.field].val===kind&&r.value===id&&!NOVAL.includes(r.op)))}
function simpleRule(cfg,field){return cfg.filters.groups[0]?.rules.find(r=>r.field===field)||null}
function simpleValue(cfg,field){const r=simpleRule(cfg,field);if(!r)return '';
  if(field==='assignee'||field==='deliverable'||field==='service'){if(r.op==='set')return '__set';if(r.op==='empty')return '__empty'}
  if(field==='status'&&r.op==='isnot'&&r.value==='Done')return '__open';
  if(field==='due')return r.op;
  return r.value}
function setSimple(cfg,field,val){
  const g=cfg.filters.groups[0]||(cfg.filters.groups[0]={join:'and',rules:[]});g.rules=g.rules.filter(r=>r.field!==field);if(!val)return;
  let r;if(field==='text')r={field,op:'contains',value:val};
  else if(val==='__set')r={field,op:'set',value:''};else if(val==='__empty')r={field,op:'empty',value:''};
  else if(field==='status'&&val==='__open')r={field,op:'isnot',value:'Done'};
  else if(field==='due')r={field,op:val,value:''};
  else r={field,op:'is',value:val};
  g.rules.push(r);
}
/* the simple editor can show a filter set when it is one AND group with at most one supported rule per field */
function simpleCompatible(cfg){
  const gs=cfg.filters.groups.filter(g=>g.rules.length);if(gs.length>1)return false;if(!gs.length)return true;const g=gs[0];
  if(g.join==='or'&&g.rules.length>1)return false;const seen=new Set();
  return g.rules.every(r=>{if(seen.has(r.field))return false;seen.add(r.field);
    if(r.field==='text')return r.op==='contains';if(r.field==='due')return ['overdue','today','this_week','next_7','next_30','empty','set'].includes(r.op);
    if(r.field==='status')return r.op==='is'||(r.op==='isnot'&&r.value==='Done');
    if(['assignee','deliverable','service'].includes(r.field))return ['is','set','empty'].includes(r.op);return r.op==='is'});
}
function viewIssuesById(v){return cfgIssues(cfgOf(v),v.projectId||null)}

