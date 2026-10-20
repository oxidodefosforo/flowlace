/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  const di=e.target.closest('.dfield input');if(di){try{di.showPicker&&di.showPicker()}catch(err){}}
  const a=e.target.closest('[data-act]');
  if(!e.target.closest('.menu-wrap'))hideMenus();
  if(ui.legendOpen&&!e.target.closest('.legend-wrap'))setLegend(false);
  closeCtx();if(e.target.closest&&e.target.closest('#cal-pop .cev'))closeCalPop();
  if(!a)return;
  const act=a.dataset.act,id=a.dataset.id,push=a.dataset.push==='1';
  switch(act){
    case 'menu':{const m=a.nextElementSibling;const open=m.hidden;hideMenus(m);m.hidden=!open;a.setAttribute('aria-expanded',String(open));if(open){const b=m.querySelector('button');b&&b.focus()}return}
    case 'modal-bg':if(e.target===a)closeModal();return;
    case 'modal-close':closeModal();return;
    case 'cf-yes':{const r=confirmResolve;confirmResolve=null;modalRoot.innerHTML='';r&&r(true);return}
    case 'cf-no':closeModal();return;
    case 'cf-choice':{const r=confirmResolve;confirmResolve=null;modalRoot.innerHTML='';r&&r(a.dataset.v);return}
    case 'nav':navSection(a.dataset.to);return;
    case 'go-list':go('projects');return;
    case 'new-project':openNewProject();return;
    case 'open-project':go('p-'+id);return;
    case 'open-full':{const tab=a.dataset.tab;ui.panel=null;ui.panelStack=[];go('p-'+id,{tab:tab||'summary'});return}
    case 'ptab':setPtab(a.dataset.v);return;
    case 'panel-project':openPanel('project',id,{push});return;
    case 'panel-deliv':openPanel('deliv',id,{push});return;
    case 'panel-task':openPanel('task',id,{push});return;
    case 'panel-pphase':openPanel('pphase',id,{push});return;
    case 'stab':ui.stab=a.dataset.v;prefs.stab=ui.stab;savePrefs();render();return;
    case 'pp-suggest':{const pp=pphase(id);if(!pp)return;ui.suggest=ui.suggest||{};ui.suggest[id]=suggestDates(pp)||{none:true};render();return}
    case 'pp-apply':{const pp=pphase(id),s=ui.suggest&&ui.suggest[id];if(!pp||!s||s.none)return;const undo=snapshot([pp]);pp.start=s.start;pp.end=s.end;delete ui.suggest[id];save();render();toast(phaseMoveMsg(pp),'',undo);return}
    case 'pp-dismiss':if(ui.suggest)delete ui.suggest[id];render();return;
    case 'pp-remove':{hideMenus();const pp=pphase(id);if(!pp)return;if(ppDelivs(pp).length||ppTasks(pp).length){toast('This phase still has deliverables or tasks. Move them to another phase first, or set the phase to Not applicable.','err');return}
      if(!await confirmBox('Remove phase from project?',`${esc(ppName(pp))} will be removed from ${esc(project(pp.projectId).code)}. The global phase definition is not affected.`,'Remove'))return;
      S.projectPhases=S.projectPhases.filter(x=>x.id!==id);if(ui.panel&&ui.panel.id===id){ui.panel=ui.panelStack.pop()||null}save();render();toast('Phase removed from the project');return}
    case 'add-deliv-phase':addDeliverable(a.dataset.pid,a.dataset.phase,true);return;
    case 'extend-phase':{const d=deliv(id),pp=d&&ppFor(d.projectId,d.phaseId);if(!pp||!d.due)return;const undo=snapshot([pp]);const s=d.start||d.due;if(s<pp.start)pp.start=s;if(d.due>pp.end)pp.end=d.due;save();render();toast(`${ppName(pp)} now runs ${fmt(pp.start)} – ${fmt(pp.end)}`,'',undo);return}
    case 'ms-review':{const d=deliv(id),f=d&&findMs(d.milestoneId);if(f){d.milestoneRev=f.ms.updatedAt;save();render();toast('Marked as reviewed')}return}
    case 'goto-def':{ui.stab='phases';ui.phOpen.add(id);ui.panel=null;ui.panelStack=[];go('settings');const el=document.querySelector(`.phcard[data-ph="${id}"]`);if(el){el.scrollIntoView({block:'start'});const b=el.querySelector('[data-act=ph-toggle]');b&&b.focus()}return}
    case 'gph-move':{const i=S.phases.findIndex(x=>x.id===id),j=i+(+a.dataset.d);if(j<0||j>=S.phases.length)return;[S.phases[i],S.phases[j]]=[S.phases[j],S.phases[i]];save();render();{const b=document.querySelector(`[data-act=gph-move][data-id="${id}"][data-d="${a.dataset.d}"]:not([disabled])`)||document.querySelector(`[data-act=gph-move][data-id="${id}"]:not([disabled])`);b&&b.focus()}toast(`${phName(id)} moved to position ${j+1}. The Gantt and project lists follow this order.`);return}
    case 'gph-del':{const g=phase(id),u=phaseUse(id);
      if(u.projects||u.delivs||u.tasks){const parts=[u.projects&&plural(u.projects,'project'),u.delivs&&plural(u.delivs,'deliverable'),u.tasks&&plural(u.tasks,'general task')].filter(Boolean);toast(`“${g.name}” is used by ${parts.join(', ')}. Untick “Available for new projects” to retire it, or move those items first.`,'err');return}
      if(S.phases.length<=1){toast('Keep at least one phase.','err');return}
      {const vr=viewRefs('phase',id);if(!await confirmBox('Delete phase?',`“${esc(g.name)}” isn't used by any project and will be removed from the catalogue, with its standard milestones.${vr.length?` ${plural(vr.length,'saved view')} filter by this phase; they keep the filter and will be marked “Needs review”.`:''}`))return}
      S.phases=S.phases.filter(x=>x.id!==id);S.defaults.phaseIds=S.defaults.phaseIds.filter(x=>x!==id);if(prefs.filters.phase===id)prefs.filters.phase='';if(prefs.tf.phase===id)prefs.tf.phase='';savePrefs();save();render();toast('Phase deleted');return}
    case 'ms-add':{const g=phase(a.dataset.pid);const m=mkMs('New milestone',null);g.milestones.push(m);ui.phOpen.add(g.id);save();ui.focusAfter=`ms-${m.id}-n`;ui.selectFocus=true;render();return}
    case 'ms-del':{const g=phase(a.dataset.pid),m=g&&g.milestones.find(x=>x.id===id);if(!m)return;const n=S.deliverables.filter(d=>d.milestoneId===id).length;
      if(n){toast(`“${m.name}” is used by ${plural(n,'deliverable')}. Link them to another milestone or mark them as additional deliverables first.`,'err');return}
      if(!await confirmBox('Delete standard milestone?',`“${esc(m.name)}” and its criteria will be removed from ${esc(g.name)}.`))return;
      g.milestones=g.milestones.filter(x=>x.id!==id);save();render();toast('Milestone deleted');return}
    case 'cli-add':{const g=phase(a.dataset.pid),m=g&&g.milestones.find(x=>x.id===a.dataset.mid);if(!m)return;const c={id:uid('cl'),text:''};m.checklist.push(c);m.updatedAt=new Date().toISOString();save();ui.focusAfter='cl-'+c.id;render();return}
    case 'cli-del':{const g=phase(a.dataset.pid),m=g&&g.milestones.find(x=>x.id===a.dataset.mid);if(!m)return;m.checklist=m.checklist.filter(x=>x.id!==id);m.updatedAt=new Date().toISOString();save();render();toast('Criterion removed');return}
    case 'def-move':{const L=S.defaults.phaseIds,i=L.indexOf(id),j=i+(+a.dataset.d);if(i<0||j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];save();render();return}
    case 'ex-phases':{const n=applyExamplePhases(S);save();render();toast(n?`Example dates added to ${plural(n,'phase')} of example projects`:'Nothing to add');return}
    case 'panel-close':closePanel();return;
    case 'panel-force-close':closePanel(true);return;
    case 'panel-keep':{const w=document.getElementById('pn-warn');if(w)w.remove();const f=document.querySelector('#panel [aria-invalid="true"]');if(f)f.focus();return}
    case 'panel-back':{const prev=ui.panelStack.pop();if(prev){ui.panel=prev;ui.panelNote='';render()}return}
    case 'ov-mode':prefs.ovMode=a.dataset.v;savePrefs();render();return;
    case 'tl-mode':prefs.tlMode=a.dataset.v;savePrefs();render();return;
    case 'range':prefs.range=a.dataset.v;savePrefs();render();return;
    case 'win':ui.winStart+=(+a.dataset.d)*win().step;render();return;
    case 'win-today':ui.winStart=todayDN();render();return;
    case 'expand':prefs.expanded[id]=!prefs.expanded[id];savePrefs();render();{const b=document.querySelector(`[data-act=expand][data-id="${id}"]`);b&&b.focus()}return;
    case 'expand-all':filtered().forEach(r=>prefs.expanded[r.p.id]=true);savePrefs();render();return;
    case 'collapse-all':prefs.expanded={};savePrefs();render();return;
    case 'kpi':{const k=overviewSets(filtered()),key=a.dataset.k,nf=activeFilterCount(),sc=nf?'Follows the Overview filters. ':'';
      if(key==='inprog')openList('Projects in progress',k.inprog.map(p=>p.id),{kpi:key,listType:'projects',kind:'Projects',note:sc});
      else if(key==='due21')openList('Due in the next 21 days',k.due21.map(d=>d.id),{kpi:key,note:sc+`Pending deliverables due ${fmtDN(todayDN())} – ${fmtDN(todayDN()+21)}.`});
      else if(key==='over')openList('Overdue deliverables',k.over.map(d=>d.id),{kpi:key,note:sc+'Due date has passed and the status is not Delivered.'});
      else if(key==='late')openList('Late phases',k.late.map(pp=>pp.id),{kpi:key,listType:'phases',kind:'Phases',note:sc+'End date has passed and the status is not Completed or Not applicable.'});
      else openList('Waiting information',k.wait.map(d=>d.id),{kpi:key,note:sc+'Pending deliverables with at least one task in Waiting information.'});
      return}
    case 'outside':{const w=win(),all=filtered().flatMap(r=>r.ds),k=a.dataset.k;
      if(k==='before')openList(`Pending before ${fmtDN(w.s)}`,all.filter(d=>d.due&&d.status!=='Delivered'&&iso2dn(d.due)<w.s).map(d=>d.id),{note:'Not delivered and due before the visible window.'});
      else if(k==='after')openList(`Due after ${fmtDN(w.e)}`,all.filter(d=>d.due&&d.status!=='Delivered'&&iso2dn(d.due)>w.e).map(d=>d.id),{note:'Pending deliverables after the visible window.'});
      else if(k==='unsph')openList('Phases without dates',filtered().flatMap(r=>r.ps).filter(pp=>!ppScheduled(pp)&&pp.status!=='Not applicable').map(pp=>pp.id),{listType:'phases',kind:'Phases',note:'Set a start and end date to show them as bars. No dates are invented.'});
      else openList('Without a due date',all.filter(d=>!d.due&&d.status!=='Delivered').map(d=>d.id),{note:'Add a due date to place them on the timeline.'});return}
    case 'edge':{const w=win(),p=project(a.dataset.pid),ds=(filtered().find(r=>r.p.id===p.id)||{ds:delivsOf(p.id)}).ds.filter(d=>!a.dataset.phase||d.phaseId===a.dataset.phase);
      const before=a.dataset.side==='before';openList(`${p.code} · ${before?'before':'after'} this window`,ds.filter(d=>d.due&&d.status!=='Delivered'&&(before?iso2dn(d.due)<w.s:iso2dn(d.due)>w.e)).map(d=>d.id),{note:`${p.name}: pending deliverables ${before?'before':'after'} ${fmtDN(before?w.s:w.e)}.`});return}
    case 'cluster':{const ids=a.dataset.ids.split(','),ds=ids.map(deliv).filter(Boolean),p=project(ds[0].projectId);openList(`${p.code} · ${ds.length} deliverables close together`,ids,{note:'These dates are close together on the timeline. Their dates are unchanged; select one to open it.'});return}
    case 'clear-filters':prefs.filters={q:'',pm:'',status:'',phase:'',from:'',to:''};savePrefs();render();toast('Filters cleared');return;
    case 'sort':{const k=a.dataset.k,o=prefs.sort;prefs.sort=o.k!==k?{k,dir:1}:o.dir>0?{k,dir:-1}:{k:'',dir:1};savePrefs();render();{const b=document.querySelector(`[data-act=sort][data-k="${k}"]`);b&&b.focus()}return}
    case 'proj-tab':prefs.projTab=a.dataset.v;savePrefs();render();return;
    case 'add-deliv':addDeliverable(a.dataset.pid);return;
    case 'apply-tpl':openTemplate(a.dataset.pid);return;
    case 'del-deliv':hideMenus();deleteDeliverable(id);return;
    case 'add-task-page':ui.colAdd=null;setPtab('tasks');newTaskFocus();return;
    case 'new-task':newTaskFocus();return;
    case 'project-tasks':ui.panel=null;ui.panelStack=[];go('p-'+id,{tab:'tasks'});return;
    case 'person-filter':{
      if(ui.view==='project'||ui.view==='tasks'){const pid=curPid();setCfg(pid,x=>setSimple(x,'assignee',simpleValue(x,'assignee')===id||id===''?'':id));return}
      prefs.activeView.global='all';setCfg(null,x=>setSimple(x,'assignee',id),true);go('tasks');return}
    case 'tchip':{const m={over:['due','overdue'],wait:['status','Waiting information'],unas:['assignee','__empty']}[a.dataset.k];if(!m)return;setCfg(curPid(),x=>setSimple(x,m[0],simpleValue(x,m[0])===m[1]?'':m[1]));return}
    case 'noop':return;
    /* saved views */
    case 'view-select':{const pid=curPid();prefs.activeView[scopeKeyOf(pid)]=id;ui.sel.clear();ui.colAdd=null;ui.cfgOpen=null;savePrefs();render();const b=document.querySelector(`.vtab[data-id="${id}"]`);b&&b.focus();return}
    case 'view-new':openViewDialog('new',a.dataset.pid||null);return;
    case 'view-saveas':openViewDialog('saveas',a.dataset.pid||null);return;
    case 'view-rename':case 'view-dup':{hideMenus();const v=viewById(id);if(v)openViewDialog(act==='view-rename'?'rename':'dup',v.projectId||null,id);return}
    case 'view-del':{hideMenus();const v=viewById(id);if(!v)return;const fi=S.favorites.findIndex(f=>f.viewId===id),fav=fi>=0?S.favorites[fi]:null,vi=S.views.indexOf(v),n=evalView(cfgOf(v),v.projectId||null).length;
      if(!await confirmBox('Delete view?',`“${esc(v.name)}” will be deleted${fav?' and removed from Favorites':''}. Only the view’s settings are removed: its ${plural(n,'task')} and all other tasks stay exactly as they are.`,'Delete view'))return;
      deleteViews([id]);savePrefs();save();render();
      toast(`View “${v.name}” deleted · no tasks were changed`,'',()=>{S.views.splice(Math.min(vi,S.views.length),0,v);if(fav)S.favorites.splice(Math.min(fi,S.favorites.length),0,fav);save();render()});return}
    case 'view-star':{const v=viewById(id);if(!v)return;const i=S.favorites.findIndex(f=>f.viewId===id);
      if(i>=0){const f=S.favorites[i];S.favorites.splice(i,1);save();render();toast(`“${v.name}” removed from Favorites`,'',()=>{S.favorites.splice(i,0,f);save();render()})}
      else{S.favorites.push({id:uid('fav'),viewId:id});save();render();toast(`“${v.name}” added to Favorites`)}
      const b=document.querySelector(`[data-act=view-star][data-id="${id}"]`);b&&b.focus();return}
    case 'view-save':{const pid=curPid(),c=ctxOf(pid);if(!c.view)return;if(ui.advOpen)delete ui.advOpen[c.key];Object.assign(c.view,normCfg(c.cfg,pid),{updatedAt:new Date().toISOString()});delete prefs.drafts[c.key];savePrefs();save();render();toast(`“${c.view.name}” saved`);return}
    case 'view-reset':{const c=ctxOf(curPid());delete prefs.drafts[c.key];ui.colAdd=null;savePrefs();render();toast(`Changes discarded · ${c.view?`“${c.view.name}”`:'All tasks'} is back to its saved settings`);return}
    case 'cfg-layout':ui.colAdd=null;setCfg(curPid(),x=>{x.layout=a.dataset.v});return;
    case 'cfg-open':ui.cfgOpen=ui.cfgOpen===a.dataset.v?null:a.dataset.v;render();return;
    case 'cfg-clear-filters':setCfg(curPid(),x=>{x.filters={mode:x.filters.mode,join:'and',groups:[{join:'and',rules:[]}]}});toast('Filters cleared. Use Reset changes to bring them back.');return;
    case 'cfg-edit-filters':{const c=ctxOf(curPid());ui.cfgOpen=null;setFOpen('tasks',true);if(!advShown(c))ui.moreSF=true;else{ui.advOpen=ui.advOpen||{};ui.advOpen[c.key]=true}render();const f=document.querySelector('.adv select,.adv input,.filters input,.filters select');if(f){f.focus();f.scrollIntoView({block:'center'})}return}
    case 'more-sf':ui.moreSF=!ui.moreSF;render();return;
    case 'adv-on':{const c=ctxOf(curPid());ui.advOpen=ui.advOpen||{};ui.advOpen[c.key]=true;setCfg(c.pid,x=>{x.filters.mode='advanced'});return}
    case 'adv-edit':{const c=ctxOf(curPid());setFOpen('tasks',true);ui.advOpen=ui.advOpen||{};ui.advOpen[c.key]=true;ui.focusAfter=`adv-join-${c.pid||'g'}`;render();return}
    case 'adv-close':{const c=ctxOf(curPid());if(ui.advOpen)delete ui.advOpen[c.key];render();const b=document.querySelector('[data-act=adv-edit]');b&&b.focus();return}
    case 'adv-off':setCfg(curPid(),x=>{x.filters.mode='simple'});return;
    case 'rule-add':{const gi=+a.dataset.g;let ri=0;setCfg(curPid(),x=>{const g=x.filters.groups[gi];if(!g)return;g.rules.push({field:'status',op:'is',value:''});ri=g.rules.length-1},true);ui.focusAfter=`ar-${curPid()||'g'}-${gi}-${ri}-f`;render();return}
    case 'rule-del':setCfg(curPid(),x=>{const g=x.filters.groups[+a.dataset.g];if(g)g.rules.splice(+a.dataset.r,1)});return;
    case 'group-add':setCfg(curPid(),x=>{x.filters.groups.push({join:'and',rules:[{field:'status',op:'is',value:''}]})});return;
    case 'group-del':setCfg(curPid(),x=>{x.filters.groups.splice(+a.dataset.g,1);if(!x.filters.groups.length)x.filters.groups=[{join:'and',rules:[]}]});return;
    case 'sort-dir':setCfg(curPid(),x=>{const s=x.sort[+a.dataset.i];if(s)s.dir=s.dir==='asc'?'desc':'asc'});return;
    case 'sort-move':setCfg(curPid(),x=>{const i=+a.dataset.i,j=i+(+a.dataset.d);if(j<0||j>=x.sort.length)return;[x.sort[i],x.sort[j]]=[x.sort[j],x.sort[i]]});return;
    case 'sort-del':setCfg(curPid(),x=>{x.sort.splice(+a.dataset.i,1)});return;
    case 'sort-add':{const pid=curPid();setCfg(pid,x=>{const used=x.sort.map(s=>s.field);const f=Object.keys(SORTF).find(k=>!used.includes(k)&&!(pid&&k==='project'));if(f)x.sort.push({field:f,dir:'asc'})});return}
    case 'col-move':setCfg(curPid(),x=>{const i=x.columns.indexOf(id),j=i+(+a.dataset.d);if(i<0||j<0||j>=x.columns.length)return;[x.columns[i],x.columns[j]]=[x.columns[j],x.columns[i]]});{const b=document.querySelector(`[data-act=col-move][data-id="${id}"][data-d="${a.dataset.d}"]:not([disabled])`)||document.querySelector(`[data-act=col-move][data-id="${id}"]:not([disabled])`);b&&b.focus()}return;
    /* favorites */
    case 'fav-open':openView(id);return;
    case 'fav-move':{const i=S.favorites.findIndex(f=>f.id===id),j=i+(+a.dataset.d);if(i<0||j<0||j>=S.favorites.length)return;[S.favorites[i],S.favorites[j]]=[S.favorites[j],S.favorites[i]];save();render();const b=document.querySelector(`[data-act=fav-move][data-id="${id}"][data-d="${a.dataset.d}"]:not([disabled])`)||document.querySelector(`[data-act=fav-move][data-id="${id}"]:not([disabled])`);b&&b.focus();return}
    /* timeline legend */
    case 'legend':{const open=!ui.legendOpen;setLegend(open);if(!open){const b=document.getElementById('legend-btn');b&&b.focus()}return}
    case 'ms-move':{const g=phase(a.dataset.pid);if(!g)return;const L=g.milestones,i=L.findIndex(x=>x.id===id),j=i+(+a.dataset.d);if(i<0||j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];ui.phOpen.add(g.id);save();render();toast('Milestone order updated. Deliverables without a target % follow this order.');const b=document.querySelector(`[data-act=ms-move][data-id="${id}"][data-d="${a.dataset.d}"]:not([disabled])`)||document.querySelector(`[data-act=ms-move][data-id="${id}"]:not([disabled])`);b&&b.focus();return}
    case 'gjoin-or':setCfg(curPid(),x=>{const g=x.filters.groups[+a.dataset.g];if(g)g.join='or'});return;
    case 'theme-set':prefs.theme=a.dataset.v;savePrefs();applyTheme();render();return;
    case 'theme-toggle':prefs.theme=isDark()?'light':'dark';savePrefs();applyTheme();render();{const b=document.querySelector('.themeb');b&&b.focus()}return;
    case 'logo-reset':{const k=a.dataset.k,prev=k==='dark'?S.company.logoDark:S.company.logo;if(k==='dark')S.company.logoDark=null;else S.company.logo=null;save();render();toast(k==='dark'?'Dark-mode company logo removed':'Company logo removed','',()=>{if(k==='dark')S.company.logoDark=prev;else S.company.logo=prev;save();render()});return}
    /* resources */
    case 'rs-mode':prefs.resMode=a.dataset.v;savePrefs();render();return;
    case 'rs-week':{const d=+a.dataset.d;setResWeek(d===0?thisWeek():dn2iso(iso2dn(resWeek())+d));ui.focusAfter=null;render();const b=document.querySelector(`[data-act=rs-week][data-d="${d}"]`);b&&b.focus();return}
    case 'rs-copy':openCopyWeek();return;
    case 'rs-undo':runResUndo();return;
    case 'rs-group':{prefs.resCollapsed=prefs.resCollapsed||{};prefs.resCollapsed[id]=!prefs.resCollapsed[id];savePrefs();render();const b=document.querySelector(`[data-act=rs-group][data-id="${id}"]`);b&&b.focus();return}
    case 'rs-hide':{const R=S.resMeeting,p=project(id);if(!R.hidden.includes(id))R.hidden.push(id);const wasAdded=R.added.includes(id);R.added=R.added.filter(x=>x!==id);save();render();
      toast(`${p.code} hidden from this view. Its hours are kept and still count in each person’s weekly load.`,'',()=>{R.hidden=R.hidden.filter(x=>x!==id);if(wasAdded)R.added.push(id);save();render()});return}
    case 'rs-unhide-all':S.resMeeting.hidden=[];save();render();toast('Hidden projects are shown again');return;
    case 'rs-clear':prefs.resF=RF0();savePrefs();render();return;
    case 'rs-delivs':{const p=project(id),{pend}=nextDelivery(id);openList(`${p.code} · pending deliverables`,pend.slice().sort((x,y)=>(x.due||'9999')<(y.due||'9999')?-1:(x.due||'9999')>(y.due||'9999')?1:delivCmp(x,y)).map(d=>d.id),{note:'Not delivered yet, earliest due date first. Select one to open its editor.'});return}
    case 'rs-open-project':{const R=S.resMeeting,p=project(id);if(!p)return;R.hidden=R.hidden.filter(x=>x!==id);if(!resBaseProjects(resWeek()).some(x=>x.id===id))R.added.push(id);prefs.resF={...RF0(),project:id};prefs.resMode='matrix';savePrefs();save();ui.panel=null;ui.panelStack=[];go('resources');return}
    case 'team-del':{const t=team(id);if(!t)return;const n=S.projects.filter(p=>p.teamId===id).length;if(n){toast(`“${t.name}” is used by ${plural(n,'project')}. Change those projects first.`,'err');return}
      if(!await confirmBox('Delete project team?',`“${esc(t.name)}” isn’t used by any project and will be removed.`))return;S.projectTeams=S.projectTeams.filter(x=>x.id!==id);if(prefs.resF.team===id){prefs.resF.team='';savePrefs()}save();render();toast('Project team deleted');return}
    case 'rs-cap':{const m=document.getElementById('rs-cappop');if(m&&!m.hidden&&capFrom===a){closeCapPop(true);return}openCapPop(id,a);return}
    case 'rs-cap-close':closeCapPop(true);return;
    case 'rs-cap-reset':{const f=a.closest('form');setWeekCap(f.dataset.id,'');return}
    case 'rs-sort':{const k=a.dataset.k,o=prefs.resSort||{};prefs.resSort=o.k!==k?{k,dir:RS_NUM(k)?-1:1}:o.dir===(RS_NUM(k)?-1:1)?{k,dir:-o.dir}:{k:'',dir:1};ui.focusAfter='rss-'+k.replace(':','-');savePrefs();render();return}
    case 'ph-toggle':ui.phOpen.has(id)?ui.phOpen.delete(id):ui.phOpen.add(id);prefs.phOpen=[...ui.phOpen];savePrefs();ui.focusAfter='gp-'+id+'-t';render();return;
    case 'f-toggle':{const k=a.dataset.sec;setFOpen(k,!fOpen(k));ui.focusAfter='ft-'+k;render();return}
    case 'pf-clear':prefs.projQ='';prefs.projF=PF0();savePrefs();render();toast('Project filters cleared');return;
    case 'psort':{const k=a.dataset.k;prefs.projSort=cycleSort(prefs.projSort,k,['delivered','tasks'].includes(k)?-1:1);savePrefs();ui.focusAfter='psort-'+k;render();return}
    case 'ov-sort-dir':prefs.sort={...prefs.sort,dir:-(prefs.sort.dir||1)};savePrefs();ui.focusAfter='ov-sort-dir';render();return;
    case 'tsort':{const f=a.dataset.f;setCfg(curPid(),x=>{const i=x.sort.findIndex(s=>s.field===f);if(i===0){x.sort[0].dir=x.sort[0].dir==='asc'?'desc':'asc'}else{if(i>0)x.sort.splice(i,1);x.sort.unshift({field:f,dir:'asc'})}},true);ui.focusAfter='tsort-'+f;render();return}
    case 'rs-tset':{const m=document.getElementById('rs-tset');if(m&&!m.hidden){closeTS(true);return}openTS(a);return}
    case 'rs-tset-close':closeTS(true);return;
    case 'rs-tset-reset':{prefs.resCols={};savePrefs();applyResCols();const b=document.getElementById('rs-tset-btn');if(b)openTS(b);toast('Table settings reset to defaults');return}
    case 'cal-mode':setCal(a.dataset.key,{mode:a.dataset.v});render();return;
    case 'cal-nav':calShift(a.dataset.key,+a.dataset.d);ui.focusAfter=a.id;render();return;
    case 'cal-today':setCal(a.dataset.key,{date:dn2iso(todayDN())});render();return;
    case 'cal-more':{const m=document.getElementById('cal-pop');if(m&&!m.hidden&&calFrom===a){closeCalPop(true);return}openCalPop(a);return}
    case 'cal-pop-close':closeCalPop(true);return;
    case 'pj-tset':case 'tk-tset':tsToggle(act.slice(0,2),a);return;
    case 'pj-tset-close':case 'tk-tset-close':closeTSK(act.slice(0,2),true);return;
    case 'pj-tset-reset':case 'tk-tset-reset':tsReset(act.slice(0,2));return;
    case 'wf-sphase':case 'wf-pphase':case 'wf-sspec':case 'wf-pspec':case 'wf-import':case 'wf-reviewed':case 'wf-node':case 'wf-sel':case 'wf-exp':case 'wf-move':case 'wf-retire':case 'wf-restore':case 'wf-save':case 'wf-discard':case 'wf-goto-settings':case 'wf-req-edit':wfAct(act,a);return;
    case 'prow-menu':openRowMenu(a);return;
    case 'panel-project-details':projPanelDetails(id);return;
    case 'pp-goto-details':projPanelDetails(id);return;
    case 'svc-toggle':svcToggle(a);return;
    case 'rs-cell-add':rsCellAdd(a);return;
    case 'rs-addtask':{const m=document.getElementById('rs-qt');if(m&&!m.hidden){closeQT(true);return}openQT(a);return}
    case 'rs-qt-close':closeQT(true);return;
    case 'rs-qt-more':{const b=document.getElementById('qt-more'),o=b.hidden;b.hidden=!o;a.setAttribute('aria-expanded',String(o));a.textContent=o?'Fewer options ▴':'More options ▾';if(o)document.getElementById('qt-due').focus();return}
    case 'badd':ui.colAdd=a.dataset.k;ui.focusAfter='badd-name';render();return;
    case 'badd-cancel':ui.colAdd=null;render();return;
    case 'bulk-clear':ui.sel.clear();render();return;
    case 'bulk-del':bulkDelete();return;
    case 'del-task':hideMenus();deleteTask(id);return;
    case 'dup-project':hideMenus();openDuplicate(id);return;
    case 'archive-project':{hideMenus();const p=project(id);p.archived=true;save();render();toast(`${p.code} archived. Find it under Projects → Archived.`,'',()=>{p.archived=false;save();render()});return}
    case 'restore-project':{hideMenus();const p=project(id);p.archived=false;save();render();toast(`${p.code} restored to active projects`);return}
    case 'delete-project':hideMenus();deleteProject(id);return;
    case 'add-link':{const p=project(a.dataset.pid);p.links.push({label:'',url:''});save();ui.focusAfter=`lk-${p.id}-${p.links.length-1}-l`;render();return}
    case 'del-link':{const p=project(a.dataset.pid);p.links.splice(+a.dataset.i,1);save();render();toast('Link removed');return}
    case 'tlink-add':{const t=S.tasks.find(x=>x.id===id);t.links.push({label:'',url:''});t.updatedAt=new Date().toISOString();save();ui.focusAfter=`tl-${t.id}-${t.links.length-1}-l`;render();return}
    case 'tlink-del':{const t=S.tasks.find(x=>x.id===id);t.links.splice(+a.dataset.i,1);t.updatedAt=new Date().toISOString();save();render();toast('Link removed');return}
    case 'dclear':{const inp=a.parentElement.querySelector('input[type=date]');inp.value='';inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));a.remove();return}
    case 'pp-add':ppAdd(a.closest('.pp'));return;
    case 'pp-cancel':ppClose(a.closest('.pp'));return;
    case 'dq-add':addFromDeliv(a.dataset.did);return;
    case 'phase-move':case 'tpl-move':{const list=act==='phase-move'?S.phases:S.template;const i=list.findIndex(x=>x.id===id),j=i+(+a.dataset.d);if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];save();render();return}
    case 'phase-del':{const ph=phase(id);const n=S.deliverables.filter(d=>d.phaseId===id).length,t=S.template.filter(x=>x.phaseId===id).length,k=S.tasks.filter(x=>!x.deliverableId&&x.phaseId===id).length;
      if(n||t||k){const parts=[n&&plural(n,'deliverable'),k&&plural(k,'general task'),t&&plural(t,'template item')].filter(Boolean);toast(`“${ph.name}” is used by ${parts.join(', ')}. Move them to another phase first.`,'err');return}
      if(S.phases.length<=1){toast('Keep at least one phase.','err');return}
      if(!await confirmBox('Delete phase?',`“${esc(ph.name)}” isn't used anywhere and will be removed.`))return;
      S.phases=S.phases.filter(x=>x.id!==id);if(prefs.filters.phase===id)prefs.filters.phase='';if(prefs.tf.phase===id)prefs.tf.phase='';savePrefs();save();render();toast('Phase deleted');return}
    case 'tpl-del':S.template=S.template.filter(x=>x.id!==id);save();render();toast('Removed from template');return;
    case 'person-del':{const pe=person(id);const pm=S.projects.filter(p=>p.pmId===id).length,own=S.deliverables.filter(d=>d.ownerId===id).length,tk=S.tasks.filter(t=>t.assignedToId===id).length;
      {const na=S.assignments.filter(a=>a.personId===id).length;if(na){toast(`${pe.name} has planned hours in Resources (${plural(na,'assignment')}). Untick “Active” instead, so their history is kept.`,'err');return}}
      if(pm||own||tk){const parts=[pm&&`PM on ${plural(pm,'project')}`,own&&`responsible for ${plural(own,'deliverable')}`,tk&&`assigned to ${plural(tk,'task')}`].filter(Boolean);toast(`${pe.name} is still ${parts.join(', ')}. Reassign those first.`,'err');return}
      {const vr=viewRefs('person',id);if(!await confirmBox('Remove person?',`${esc(pe.name)} will be removed from the people list.${vr.length?` ${plural(vr.length,'saved view')} filter by this person (${vr.map(v=>'“'+esc(v.name)+'”').join(', ')}); they keep the filter and will be marked “Needs review”.`:''}`,'Remove'))return}
      S.people=S.people.filter(x=>x.id!==id);if(prefs.filters.pm===id)prefs.filters.pm='';['pm','assignee'].forEach(k=>{if(prefs.tf[k]===id)prefs.tf[k]=''});if(prefs.ptf.assignee===id)prefs.ptf.assignee='';savePrefs();save();render();toast('Person removed');return}
    case 'service-del':{const sv=service(id);const n=S.tasks.filter(t=>t.serviceId===id).length,np=S.people.filter(pe=>pe.disciplineId===id).length;
      if(np&&!n){toast(`“${sv.name}” is the primary discipline of ${plural(np,'person','people')}. Change them in Settings → People first.`,'err');return}
      if(n){toast(`“${sv.name}” is used by ${plural(n,'task')}. Change those tasks first.`,'err');return}
      {const vr=viewRefs('service',id);if(!await confirmBox('Delete discipline?',`“${esc(sv.name)}” isn't used by any task and will be removed.${(n2=>n2?` It is also removed from the services of ${plural(n2,'project')}.`:'')(S.projects.filter(p=>(p.serviceIds||[]).includes(id)).length)}${vr.length?` ${plural(vr.length,'saved view')} filter by it; they keep the filter and will be marked “Needs review”.`:''}`))return}
      S.services=S.services.filter(x=>x.id!==id);S.projects.forEach(p=>{if(p.serviceIds)p.serviceIds=p.serviceIds.filter(x=>x!==id)});if(prefs.tf.service===id){prefs.tf.service='';savePrefs()}save();render();toast('Discipline deleted');return}
    case 'export':exportData();return;
    case 'copy-export':{const ta=document.getElementById('exp-txt');try{await navigator.clipboard.writeText(ta.value);toast('Backup copied. Paste it into a .json file.')}catch(err){ta.focus();ta.select();toast('Text selected. Press Ctrl+C (or ⌘C) to copy.')}return}
    case 'import-paste':openModal(`<form data-form="import-paste" novalidate><div class="m-head"><div><div class="eyebrow">Backup</div><h2>Paste backup text</h2></div><button type="button" class="x" data-act="modal-close" aria-label="Close">×</button></div><textarea class="in code-area" name="txt" placeholder='{"app":"alphazeta-project-planner", ...}'></textarea><div class="m-actions"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary">Import</button></div></form>`);return;
    case 'remove-examples':removeExamples();return;
    case 'load-examples':{const real=S.projects.filter(p=>!p.example).length;
      if(real&&!await confirmBox('Add example data to this workspace?',`This workspace already has ${plural(real,'real project')}. The examples will be added next to them, marked <span class="ex">Example</span>, and can be removed later from Settings. To try Flowlace without touching real data, create a separate workspace instead.`,'Add example data'))return;
      closeModal(true);loadExamples();return}
    case 'add-example-tasks':{const m=missingExampleTasks();S.tasks.push(...m);save();render();toast(`${plural(m.length,'example task')} added`);return}
    case 'reset-all':{if(!await confirmBox('Delete all data?','All projects, phases of projects, deliverables, tasks, people, saved views and favorites in this workspace will be deleted. The application name, logo and company details are kept. The phase catalogue, standard milestones and disciplines go back to their defaults. Export a backup first if you might need it.','Delete everything'))return;
      {const ph=defaultPhases(),keepB=S.branding,keepC=S.company;S={version:4,branding:keepB,company:keepC,views:[],favorites:[],assignments:[],capacityOverrides:[],projectTeams:DEF_TEAMS(),resMeeting:{added:[],hidden:[]},people:[],roles:DEF_ROLES(),phases:ph,services:[...defaultServices(),{id:'sv-fire',name:'Fire'}],projects:[],deliverables:[],tasks:[],projectPhases:[],defaults:{phaseIds:ph.map(p=>p.id)},workflow:{version:0,appliedAt:null,demo:false,schema:2,demoV2:false,steps:[]},workflowDraft:null}}prefs.filters={q:'',pm:'',status:'',phase:'',from:'',to:''};prefs.tf=TF0();prefs.ptf=PTF0();prefs.expanded={};prefs.drafts={};prefs.activeView={};ui.sel.clear();ui.panel=null;ui.panelStack=[];savePrefs();save();render();toast('All data deleted');return}
  }
});

function ppOpen(sel){const pp=sel.closest('.pp');sel.value=sel.dataset.prev||'';sel.hidden=true;const n=pp.querySelector('.pp-new');n.hidden=false;const i=n.querySelector('input');i.value='';i.focus()}

document.addEventListener('change',e=>{
  const el=e.target;
  if(el.classList.contains('person-select')){if(el.value==='__new'){ppOpen(el);return}el.dataset.prev=el.value}
  if(el.dataset.tsel){el.checked?ui.sel.add(el.dataset.tsel):ui.sel.delete(el.dataset.tsel);render();const c=document.querySelector(`[data-tsel="${el.dataset.tsel}"]`);if(c)c.focus();return}
  if(el.dataset.def){const id=el.dataset.def;if(el.checked){if(!S.defaults.phaseIds.includes(id))S.defaults.phaseIds.push(id)}else S.defaults.phaseIds=S.defaults.phaseIds.filter(x=>x!==id);save();render();return}
  if(el.id==='pp-add-sel'){if(!el.value)return;const pp=ensurePP(el.dataset.pid,el.value);save();render();toast(`${ppName(pp)} added. Set its dates in the table.`);return}
  if(el.id==='tsel-all'){el.dataset.ids.split(',').filter(Boolean).forEach(i=>el.checked?ui.sel.add(i):ui.sel.delete(i));render();return}
  if(el.id==='bulk-status'||el.id==='bulk-assign'){applyBulk(el.id==='bulk-status'?'status':'assignedToId',el.value);return}
  if(el.closest('.tpl-tbl')&&el.type==='checkbox'){el.closest('tr').classList.toggle('off',!el.checked);updateTplCount();return}
  if(el.id==='import-file'){const file=el.files&&el.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{importText(String(r.result));el.value=''};r.onerror=()=>toast('Could not read that file.','err');r.readAsText(file);return}
  if(el.dataset.filter&&el.dataset.filter!=='q'){prefs.filters[el.dataset.filter]=el.value;savePrefs();render();return}
  if(el.dataset.tfilter&&el.dataset.tfilter!=='q'){prefs.tf[el.dataset.tfilter]=el.type==='checkbox'?el.checked:el.value;savePrefs();render();return}
  if(el.dataset.pfilter){prefs.ptf[el.dataset.pfilter]=el.type==='checkbox'?el.checked:el.value;savePrefs();render();return}
  if(el.dataset.tv){const tv=ui.view==='tasks'?prefs.tvG:prefs.tvP;tv[el.dataset.tv]=el.type==='checkbox'?el.checked:el.value;ui.colAdd=null;savePrefs();render();return}
  if(el.dataset.pref){prefs[el.dataset.pref]=el.type==='checkbox'?el.checked:el.value;savePrefs();render();return}
  if(el.name==='projectId'&&el.closest('form[data-form=tnew]')){ui.addProj=el.value;return}
  if(el.name==='deliverableId'&&el.closest('form[data-form=tnew]')){ui.qaDeliv=el.value;return}
  if(el.dataset.sf){if(el.dataset.sf==='text')return;const f=el.dataset.sf,v=el.value;setCfg(curPid(),x=>setSimple(x,f,v));return}
  if(el.dataset.cfg){const k=el.dataset.cfg,v=el.type==='checkbox'?el.checked:el.value;ui.colAdd=null;setCfg(curPid(),x=>{x[k]=v});return}
  if(el.dataset.adv){const v=el.value,g=+el.dataset.g;setCfg(curPid(),x=>{if(el.dataset.adv==='join')x.filters.join=v;else if(x.filters.groups[g])x.filters.groups[g].join=v});return}
  if(el.dataset.rule){const k=el.dataset.rule,v=el.value,gi=+el.dataset.g,ri=+el.dataset.r;setCfg(curPid(),x=>{const r=x.filters.groups[gi]&&x.filters.groups[gi].rules[ri];if(!r)return;
    if(k==='field'){r.field=v;r.op=FIELDS[v].ops[0];r.value=''}else if(k==='op'){const was=FIELDS[r.field].val;r.op=v;if(NOVAL.includes(v))r.value=''}else r.value=v});return}
  if(el.dataset.sort){const i=+el.dataset.i,v=el.value;setCfg(curPid(),x=>{if(x.sort[i])x.sort[i].field=v});return}
  if(el.dataset.col){const k=el.dataset.col,on=el.checked;setCfg(curPid(),x=>{x.columns=x.columns.filter(c=>c!==k);if(on)x.columns.push(k)});return}
  if(el.dataset.ent)commitField(el);
});
let qTimer=null;
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.type==='date'&&el.closest('.dfield')){const f=el.closest('.dfield');f.querySelector('.dtxt').textContent=el.value?fmt(el.value):'Add date';f.classList.toggle('is-empty',!el.value)}
  if(el.getAttribute('aria-invalid')==='true'&&el.id==='dq-name')clearFieldError(el);
  if(el.dataset.filter==='q'){prefs.filters.q=el.value;savePrefs();clearTimeout(qTimer);qTimer=setTimeout(render,140);return}
  if(el.dataset.sf==='text'){const v=el.value,pid=curPid();clearTimeout(qTimer);qTimer=setTimeout(()=>setCfg(pid,x=>setSimple(x,'text',v)),220);return}
  if(el.id==='proj-q'){prefs.projQ=el.value;savePrefs();clearTimeout(qTimer);qTimer=setTimeout(render,140)}
});

function commitField(el){
  const{ent,id,f}=el.dataset;let v=el.type==='checkbox'?el.checked:el.value;let undo=null,msg='';
  const bad=m=>{fieldError(el,m);return};
  if(ent==='d'){
    const d=deliv(id);if(!d)return;
    if(f==='name'){v=v.trim();if(!v)return bad('A deliverable needs a name.')}
    if(f==='start'||f==='due'){const s=f==='start'?v:d.start,du=f==='due'?v:d.due;if(s&&du&&s>du)return bad(f==='start'?`Start can’t be after the due date (${fmt(du)}).`:`Due can’t be before the start date (${fmt(s)}).`);v=v||null}
    if(f==='ownerId'||f==='milestoneId')v=v||null;
    if(f==='phaseId'&&!ppFor(d.projectId,v))return bad('Choose one of this project’s phases.');
    if(d[f]===v){clearFieldError(el);return}
    if(['start','due','status'].includes(f))undo=snapshot([d]);
    d[f]=v;
    if(f==='phaseId'&&d.milestoneId&&!phase(v).milestones.some(m=>m.id===d.milestoneId)){d.milestoneId=null;d.milestoneRev=null;msg=`${d.name} moved to ${phName(v)}. Its standard milestone belonged to another phase, so it is now an additional deliverable.`}
    if(f==='milestoneId'){const fm=findMs(v);d.milestoneRev=fm?fm.ms.updatedAt:null;if(fm&&(!d.name.trim()||/^new deliverable$/i.test(d.name)))d.name=fm.ms.name}
    if(f==='status'){const o=delivTasks(d.id).filter(taskOpen).length;msg=`${d.name}: ${DGLYPH[v]} ${v}${v==='Delivered'&&o?` · ${plural(o,'linked task')} still open`:''}`}
    else if(f==='start'||f==='due')msg=`${d.name}: ${d.due?rangeText(d):'no due date'}${outOfPhase(d)?` · outside the ${phName(d.phaseId)} dates`:''}`;
  }else if(ent==='p'){
    const p=project(id);if(!p)return;
    if(f==='name'||f==='code'){v=v.trim();if(!v)return bad(`A project needs a ${f==='code'?'code':'name'}.`);if(f==='code'){const c=codeTaken(v,id);if(c)return bad(`Code ${v} is already used by ${c.name}.`)}}
    if(f==='pmId'||f==='teamId')v=v||null;
    if(p[f]===v){clearFieldError(el);return}
    p[f]=v;
  }else if(ent==='link'){
    const p=project(id);const l=p&&p.links[+el.dataset.i];if(!l)return;l[f]=f==='url'?normUrl(v):v.trim();
  }else if(ent==='tlink'){
    const t=S.tasks.find(x=>x.id===id);const l=t&&t.links[+el.dataset.i];if(!l)return;l[f]=f==='url'?normUrl(v):v.trim();t.updatedAt=new Date().toISOString();
  }else if(ent==='t'){
    const tk=S.tasks.find(x=>x.id===id);if(!tk)return;
    if(f==='name'){v=v.trim();if(!v)return bad('A task needs a name.')}
    if(['assignedToId','due','deliverableId','phaseId','serviceId'].includes(f))v=v||null;
    if(f==='phaseId'&&v&&(tk.deliverableId||!ppFor(tk.projectId,v)))return bad(tk.deliverableId?'This task takes its phase from its deliverable.':'Choose one of this project’s phases.');
    if(tk[f]===v){clearFieldError(el);return}
    if(f==='projectId'||f==='status'||el.classList.contains('csel')){clearFieldError(el);moveTask(tk,f,v);return}
    if(f==='due')undo=snapshot([tk]);
    if(!setTaskField(tk,f,v))return bad('That deliverable belongs to another project.');
    if(f==='due')msg=`${tk.name}: ${tk.due?`due ${fmt(tk.due)}`:'no due date'}${taskLate(tk)?` · after its deliverable (${fmt(deliv(tk.deliverableId).due)})`:''}`;
    else if((f==='deliverableId')&&taskLate(tk))msg=`Saved. “${tk.name}” is due after its deliverable (${fmt(deliv(tk.deliverableId).due)}).`;
  }else if(ent==='pp'){
    const pp=pphase(id);if(!pp)return;
    if(f==='start'||f==='end'){const s=f==='start'?v:pp.start,en=f==='end'?v:pp.end;if(s&&en&&s>en)return bad(f==='start'?`Start can’t be after the end date (${fmt(en)}).`:`End can’t be before the start date (${fmt(s)}).`);v=v||null}
    if(pp[f]===v){clearFieldError(el);return}
    if(['start','end','status'].includes(f))undo=snapshot([pp]);
    pp[f]=v;
    if(f==='start'||f==='end')msg=pp.start&&pp.end?phaseMoveMsg(pp):`${ppName(pp)}: unscheduled until both dates are set`;else if(f==='status')msg=`${ppName(pp)}: ${PPGLYPH[v]} ${v}`;
  }else if(ent==='gphase'){
    const g=phase(id);if(!g)return;
    if(f==='name'){v=v.trim();if(!v)return bad('A phase needs a name.');if(S.phases.some(x=>x.id!==id&&x.name.toLowerCase()===v.toLowerCase()))return bad(`${v} already exists.`);g.name=v;msg='Phase renamed in every project'}
    else if(f==='hex'){v=v.trim();if(!/^#?[0-9a-f]{6}$/i.test(v))return bad('Use a 6-digit HEX code, for example #3A6FD8.');g.color=(v[0]==='#'?v:'#'+v).toUpperCase();msg='Colour updated in every project'}
    else if(f==='color'){g.color=v.toUpperCase();msg='Colour updated in every project'}
    else if(f==='active'){g.active=!!v;if(!g.active)S.defaults.phaseIds=S.defaults.phaseIds.filter(x=>x!==id);msg=g.active?`${g.name} is available for new projects`:`${g.name} won’t be offered for new projects. Existing projects keep it.`}
    else g[f]=v;
  }else if(ent==='ms'){
    const g=phase(el.dataset.pid),m=g&&g.milestones.find(x=>x.id===id);if(!m)return;
    if(f==='name'){v=v.trim();if(!v)return bad('A milestone needs a name.')}
    if(f==='target'){if(String(v).trim()===''){v=null}else{const n=Number(v);if(!Number.isFinite(n)||n<0||n>100)return bad('Use a number from 0 to 100, or leave it empty.');v=Math.round(n)}}
    if(m[f]===v){clearFieldError(el);return}
    m[f]=v;if(f!=='name'){m.updatedAt=new Date().toISOString();const n=S.deliverables.filter(d=>d.milestoneId===m.id).length;if(n)msg=`Definition updated. ${plural(n,'linked deliverable')} will show that the criteria changed; their dates and statuses are unchanged.`}
  }else if(ent==='cli'){
    const g=phase(el.dataset.pid),m=g&&g.milestones.find(x=>x.id===el.dataset.mid),c=m&&m.checklist.find(x=>x.id===id);if(!c)return;
    v=v.trim();if(c.text===v)return;c.text=v;m.updatedAt=new Date().toISOString();
  }else if(ent==='dcheck'){
    const d=deliv(id);if(!d)return;if(v)d.checks[el.dataset.c]=true;else delete d.checks[el.dataset.c];
  }else if(ent==='person'){
    const pe=person(id);v=v.trim().replace(/\s+/g,' ');if(!v)return bad('A name is required.');
    if(S.people.some(x=>x.id!==id&&x.name.toLowerCase()===v.toLowerCase()))return bad(`${v} is already in the list.`);
    pe.name=v;
  }else if(ent==='phase'){const ph=phase(id);if(f==='name'){v=v.trim();if(!v)return bad('A phase needs a name.')}ph[f]=v}
  else if(ent==='tpl'){const t=S.template.find(x=>x.id===id);if(f==='name'){v=v.trim();if(!v)return bad('A template item needs a name.')}t[f]=v}
  else if(ent==='service'){const sv=service(id);v=v.trim();if(!v)return bad('A discipline needs a name.');if(S.services.some(x=>x.id!==id&&x.name.toLowerCase()===v.toLowerCase()))return bad(`${v} is already in the list.`);sv.name=v}
  else return;
  clearFieldError(el);save();render();if(msg)toast(msg,'',undo);
}

document.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,kind=form.dataset.form,F=form.elements;
  if(kind==='new-project'){
    const name=F.name.value.trim(),code=F.code.value.trim();let bad=false;setErr(form,'name','');setErr(form,'code','');
    if(!code){setErr(form,'code','Enter a project code or number.');bad=true}else if(codeTaken(code)){setErr(form,'code',`Already used by ${codeTaken(code).name}.`);bad=true}
    if(!name){setErr(form,'name','Enter a project name.');bad=true}
    if(bad)return;
    const pmId=F.pmId.value&&F.pmId.value!=='__new'?F.pmId.value:null;
    const p={id:uid('p'),name,code,client:F.client.value.trim(),pmId,status:F.status.value,teamId:F.teamId&&F.teamId.value||null,serviceIds:svcFormVal(form),description:'',notes:'',links:[],archived:false,example:false,createdAt:new Date().toISOString()};
    p.seq=nextProjSeq();S.projects.push(p);S.defaults.phaseIds.forEach(id=>{if(phase(id)&&phase(id).active)ensurePP(p.id,id)});p.wfScope={};p.wfDecide={};
    save();closeModal(true);go('p-'+p.id,{tab:'phases'});toast(`${code} created with ${plural(ppOf(p.id).length,'phase')}. Set their dates when you know them.`);
  }else if(kind==='tnew'||kind==='tcol'){
    const name=F.name.value.trim();if(!name){fieldError(F.name,'Type a task name first.');F.name.focus();return}
    let pid=form.dataset.pid||(F.projectId?F.projectId.value:'')||'';const o={name};
    if(kind==='tcol'){const fd=form.dataset.field,val=form.dataset.val;
      if(fd==='projectId')pid=val;else if(fd==='status')o.status=val;else if(fd==='assignedToId')o.assignedToId=val||null;
      else if(fd==='deliverableId'){if(val){const dv=deliv(val);if(!dv){toast('That deliverable no longer exists.','err');return}pid=dv.projectId;o.deliverableId=val}}
      else if(fd==='phaseId'&&val){if(pid&&!ppFor(pid,val)){toast(`${project(pid)?.code||'That project'} doesn’t use ${phName(val)}. Choose another project, or add the phase to it first.`,'err');return}o.phaseId=val}}
    if(!pid||!project(pid)){toast('Choose a project for the task.','err');return}
    const did=kind==='tnew'&&F.deliverableId?F.deliverableId.value||null:(o.deliverableId||null),d=did?deliv(did):null;
    const fixed=new Set(Object.keys(o).filter(k=>k!=='name'));if(did&&kind==='tnew')fixed.add('deliverableId');
    if(!('assignedToId' in o))o.assignedToId=d?ownerId(d):project(pid).pmId;
    const base={id:'_new',projectId:pid,deliverableId:did,status:'To Do',priority:'Normal',source:'Planned',serviceId:null,phaseId:null,due:null,...o};
    const vcfg=ctxOf(curPid()).cfg,fit=fitsCfg(base,vcfg)?null:viewDefaults(base,fixed,vcfg);let adj='';
    if(fit){const ch=[];if(fit.status!==base.status)ch.push(fit.status);if(fit.assignedToId!==base.assignedToId)ch.push(fit.assignedToId?'assigned to '+pname(fit.assignedToId):'unassigned');
      if(fit.priority!==base.priority)ch.push(fit.priority+' priority');if(fit.serviceId!==base.serviceId&&fit.serviceId)ch.push(service(fit.serviceId).name);if(fit.source!==base.source)ch.push(fit.source);
      if(fit.deliverableId!==base.deliverableId)ch.push(fit.deliverableId?deliv(fit.deliverableId).name:'general task');if(fit.phaseId!==base.phaseId&&fit.phaseId)ch.push(phName(fit.phaseId));if(fit.due!==base.due&&fit.due)ch.push('due '+fmt(fit.due));
      ['status','assignedToId','priority','serviceId','source','deliverableId','phaseId','due'].forEach(k=>o[k]=fit[k]);adj=ch.length?` · ${ch.join(', ')} to match this view`:''}
    const t=newTask({projectId:pid,deliverableId:o.deliverableId!==undefined?o.deliverableId:did,...o});if(t.deliverableId)t.phaseId=null;S.tasks.push(t);ui.addProj=form.dataset.pid?ui.addProj:pid;if(kind==='tnew')ui.qaDeliv=did||'';
    save();ui.focusAfter=kind==='tcol'?'badd-name':'tnew-name';render();
    toast(`Task added${ui.visible.includes(t.id)?adj:' (hidden by this view’s filters)'}`,'',()=>{S.tasks=S.tasks.filter(x=>x.id!==t.id);save();render()});
  }else if(kind==='tpl-apply'){
    const pid=form.dataset.pid,err=form.querySelector('#tpl-err');const add=[];let problem='';
    for(let k=0;F['use-'+k];k++){if(!F['use-'+k].checked)continue;const m=findMs(F['ms-'+k].value);if(!m)continue;
      const name=F['name-'+k].value.trim()||m.ms.name,s=F['s-'+k].value||null,du=F['e-'+k].value||null;
      if(s&&du&&s>du&&!problem)problem=`“${name}”: start date is after the due date.`;
      add.push({id:uid('d'),projectId:pid,name,phaseId:F['ph-'+k].value,milestoneId:m.ms.id,milestoneRev:m.ms.updatedAt,checks:{},start:s,due:du,ownerId:null,status:'Planned',notes:'',seq:nextSeq()})}
    if(problem){err.textContent=problem;err.hidden=false;return}
    if(!add.length){err.textContent='Select at least one milestone.';err.hidden=false;return}
    add.forEach(d=>ensurePP(pid,d.phaseId));S.deliverables.push(...add);save();closeModal(true);render();const un=add.filter(d=>!d.due).length;toast(`${plural(add.length,'deliverable')} added${un?` · ${un} without a due date`:''}`);
  }else if(kind==='dup-project'){
    const src=project(form.dataset.id);const name=F.name.value.trim(),code=F.code.value.trim();let bad=false;setErr(form,'name','');setErr(form,'code','');
    if(!code){setErr(form,'code','Enter a code for the new project.');bad=true}else if(codeTaken(code)){setErr(form,'code',`Already used by ${codeTaken(code).name}.`);bad=true}
    if(!name){setErr(form,'name','Enter a name.');bad=true}
    if(bad)return;
    const kd=F.copyDates.checked,ks=F.copyStatus.checked;
    const p={...src,id:uid('p'),name,code,client:F.client.value.trim(),status:'Not started',archived:false,example:false,serviceIds:F.serviceIds?svcFormVal(form):[...(src.serviceIds||[])],links:src.links.map(l=>({...l})),createdAt:new Date().toISOString()};
    p.seq=nextProjSeq();S.projects.push(p);const dmap={};
    ppOf(src.id).forEach(pp=>S.projectPhases.push({...pp,id:uid('pp'),projectId:p.id,start:kd?pp.start:null,end:kd?pp.end:null,status:pp.status==='Not applicable'?'Not applicable':(ks?pp.status:'Not started')}));
    if(F.copyD.checked)delivsOf(src.id).forEach(d=>{const nid=uid('d');dmap[d.id]=nid;S.deliverables.push({...d,id:nid,projectId:p.id,start:kd?d.start:null,due:kd?d.due:null,status:ks?d.status:'Planned',checks:{},seq:nextSeq()})});
    if(F.copyTasks&&F.copyTasks.checked)tasksOf(src.id).forEach(t=>{const nd=t.deliverableId?dmap[t.deliverableId]||null:null;S.tasks.push(newTask({projectId:p.id,deliverableId:nd,name:t.name,assignedToId:t.assignedToId,priority:t.priority,phaseId:nd?null:taskPhaseId(t),serviceId:t.serviceId,source:t.source,notes:t.notes,links:t.links.map(l=>({...l}))}))});
    S.tasks.filter(t=>t.projectId===p.id&&t.phaseId).forEach(t=>ensurePP(p.id,t.phaseId));
    wfAfterDup(p,src,!!(F.copyTasks&&F.copyTasks.checked));ui.panel=null;ui.panelStack=[];save();closeModal(true);go('p-'+p.id);toast(`${code} created from ${src.code}`);
  }else if(kind==='view-name'){
    const mode=form.dataset.mode,pid=form.dataset.pid||null,vid=form.dataset.id||null,name=F.name.value.trim().replace(/\s+/g,' ');setErr(form,'name','');
    if(!name){setErr(form,'name','Enter a name for the view.');F.name.focus();return}
    const clash=viewsFor(pid).find(v=>v.id!==(mode==='rename'?vid:null)&&v.name.toLowerCase()===name.toLowerCase());
    if(clash||name.toLowerCase()==='all tasks'){setErr(form,'name',`“${name}” is already used ${pid?'in this project':'in Tasks'}. Choose another name.`);F.name.focus();return}
    const now=new Date().toISOString();
    if(mode==='rename'){const v=viewById(vid);if(!v)return;v.name=name;v.updatedAt=now;save();closeModal(true);render();toast(`View renamed to “${name}”${S.favorites.some(f=>f.viewId===vid)?' · Favorites updated':''}`);return}
    const c=ctxOf(pid);let cfg;
    if(mode==='dup'){const v=viewById(vid);if(!v)return;cfg=cfgOf(v)}
    else if(mode==='new'&&F.start&&F.start.value==='blank')cfg=defaultCfg(pid);
    else cfg=clone(c.cfg);
    if(F.layout)cfg.layout=F.layout.value;
    const v={id:uid('v'),name,projectId:pid,...normCfg(cfg,pid),createdAt:now,updatedAt:now};
    S.views.push(v);
    if(mode==='saveas')delete prefs.drafts[c.key]; // the view it started from stays exactly as saved
    prefs.activeView[scopeKeyOf(pid)]=v.id;ui.cfgOpen=null;ui.colAdd=null;savePrefs();save();closeModal(true);render();
    toast(mode==='dup'?`“${name}” created as a copy`:`View “${name}” saved${mode==='saveas'&&c.view?` · “${c.view.name}” is unchanged`:''}`);
    const b=document.querySelector(`.vtab[data-id="${v.id}"]`);b&&b.focus();
  }else if(kind==='rs-paste'){applyPaste(!!(F.clearBlanks&&F.clearBlanks.checked))
  }else if(kind==='rs-copy'){applyCopy(form)
  }else if(kind==='team-add'){const v=F.name.value.trim();if(!v){F.name.focus();return}if(S.projectTeams.some(x=>x.name.toLowerCase()===v.toLowerCase())){toast(`${v} is already in the list.`,'err');return}S.projectTeams.push({id:uid('tm'),name:v.slice(0,60)});save();ui.focusAfter='tm-new';render();toast(`Project team “${v}” added`)
  }else if(kind==='import-paste'){const t=F.txt.value.trim();if(!t){toast('Paste the backup text first.','err');return}await importText(t)}
  else if(kind==='phase-add'){const v=F.name.value.trim();if(!v){F.name.focus();return}if(S.phases.some(x=>x.name.toLowerCase()===v.toLowerCase())){toast(`${v} already exists.`,'err');return}const g={id:uid('ph'),name:v,color:COLORS[S.phases.length%COLORS.length],description:'',completion:'',active:true,milestones:[]};S.phases.push(g);ui.phOpen.add(g.id);save();ui.focusAfter='ph-new';render();toast(`Phase “${v}” added to the catalogue`)}
  else if(kind==='person-add'){const v=F.name.value.trim().replace(/\s+/g,' ');if(!v){F.name.focus();return}if(S.people.some(x=>x.name.toLowerCase()===v.toLowerCase())){toast(`${v} is already in the list.`,'err');return}S.people.push({id:uid('pe'),name:v,disciplineId:null,capacity:null,active:true});save();ui.focusAfter='pe-new';render();toast(`${v} added`)}
  else if(kind==='service-add'){const v=F.name.value.trim();if(!v){F.name.focus();return}if(S.services.some(x=>x.name.toLowerCase()===v.toLowerCase())){toast(`${v} is already in the list.`,'err');return}S.services.push({id:uid('sv'),name:v});save();ui.focusAfter='sv-new';render();toast(`Discipline “${v}” added`)}
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    hideTip();
    if(ui.legendOpen){e.preventDefault();setLegend(false);const b=document.getElementById('legend-btn');b&&b.focus();return}
    if(closeCtx(true))return;
    if(ui.cfgOpen&&e.target.closest&&e.target.closest('.cfgbox')){ui.cfgOpen=null;render();return}
    if(e.target.closest&&e.target.closest('.adv')&&ui.advOpen){const c=ctxOf(curPid());if(ui.advOpen[c.key]){delete ui.advOpen[c.key];render();const b=document.querySelector('[data-act=adv-edit]');b&&b.focus();return}}
    const ppn=e.target.closest&&e.target.closest('.pp-new');if(ppn){e.preventDefault();ppClose(ppn.closest('.pp'));return}
    const openMenu=document.querySelector('.menu:not([hidden])');if(openMenu){hideMenus();const b=openMenu.previousElementSibling;b&&b.focus();return}
    if(modalRoot.innerHTML){closeModal();return}
    if(drag){endDrag(true);return}
    if(ui.colAdd){ui.colAdd=null;render();return}
    if(ui.panel){e.preventDefault();closePanel();return}
    return;
  }
  if(e.key==='Enter'&&e.target.id==='dq-name'){e.preventDefault();addFromDeliv(e.target.dataset.did);return}
  if(e.key==='Enter'&&e.target.closest&&e.target.closest('.pp-new')){e.preventDefault();ppAdd(e.target.closest('.pp'));return}
  const card=e.target.classList&&e.target.classList.contains('card')?e.target:null;
  if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openPanel('task',card.dataset.tid);return}
  const it=e.target.closest&&e.target.closest('[data-kind]');
  if(it&&it.dataset.kind==='phase'){const pp=pphase(it.dataset.ppid);if(!pp)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel('pphase',pp.id);return}
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const k=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?7:1);const undo=snapshot([pp]);
      pp.start=dn2iso(iso2dn(pp.start)+k);pp.end=dn2iso(iso2dn(pp.end)+k);save();render();const n=document.getElementById(it.id);if(n){n.focus({preventScroll:true});showTip(n)}
      toast(phaseMoveMsg(pp),'',undo)}
    return}
  if(it){const d=deliv(it.dataset.did);if(!d)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel('deliv',d.id);return}
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const k=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?7:1);const undo=snapshot([d]);
      let s=d.start?iso2dn(d.start):null,en=iso2dn(d.due)+k,clamped=false;if(s!=null&&en<s){en=s;clamped=true}
      d.due=dn2iso(en);save();render();const n=document.getElementById(it.id);if(n){n.focus({preventScroll:true});showTip(n)}
      toast(clamped?`Due date can’t go before the start date (${fmt(d.start)}). Change the start date in the deliverable first.`:`${d.name}: due ${fmt(d.due)}${outOfPhase(d)?` · outside the ${phName(d.phaseId)} dates`:''}`,'',undo);return}}
  if(modalRoot.innerHTML&&e.key==='Tab'){const m=modalRoot.querySelector('.modal');const f=[...m.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.offsetParent!==null);if(!f.length)return;if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}}
});
function phaseMoveMsg(pp){const out=ppDelivs(pp).filter(outOfPhase).length;return `${ppName(pp)}: ${fmt(pp.start)} – ${fmt(pp.end)}${out?` · ${plural(out,'deliverable')} now outside these dates (not moved)`:''}`}

/* tooltip events: shown only for elements in the current view, hidden on every exit path */
document.addEventListener('pointerover',e=>{if(drag)return;const it=e.target.closest&&e.target.closest('[data-kind]');if(it)showTip(it)});
document.addEventListener('pointerout',e=>{if(drag)return;const it=e.target.closest&&e.target.closest('[data-kind]');if(it&&!it.contains(e.relatedTarget))hideTip()});
document.addEventListener('focusin',e=>{const it=e.target.closest&&e.target.closest('[data-kind]');if(it&&it.matches(':focus-visible'))showTip(it);else if(!it&&tipOwner&&!drag)hideTip()});
document.addEventListener('focusout',e=>{if(e.target.closest&&e.target.closest('[data-kind]'))hideTip()});
document.addEventListener('scroll',()=>{if(!drag)hideTip()},true);
document.addEventListener('visibilitychange',hideTip);
window.addEventListener('blur',hideTip);

/* drag on the timeline: deliverable diamonds (due date) and phase bars (move / resize) */
let drag=null;
document.addEventListener('pointerdown',e=>{
  const it=e.target.closest('[data-kind]');if(!it||e.button!==0)return;
  const tl=it.closest('.tl'),track=it.closest('.tl-track');if(!tl||!track)return;
  const days=+tl.dataset.days,base={it,x0:e.clientX,ppd:track.clientWidth/days,ws:+tl.dataset.ws,days,moved:false,clamped:false};
  if(it.dataset.kind==='phase'){const pp=pphase(it.dataset.ppid);if(!pp||!ppScheduled(pp))return;
    drag={...base,pp,mode:e.target.classList.contains('hl')?'start':e.target.classList.contains('hr')?'end':'move',s0:iso2dn(pp.start),e0:iso2dn(pp.end)}}
  else{const d=deliv(it.dataset.did);if(!d||!d.due)return;drag={...base,d,mode:'due',s0:d.start?iso2dn(d.start):null,e0:iso2dn(d.due)}}
  drag.ns=drag.s0;drag.ne=drag.e0;try{it.setPointerCapture(e.pointerId)}catch(err){}e.preventDefault();hideTip();
});
document.addEventListener('pointermove',e=>{
  if(!drag)return;const dx=e.clientX-drag.x0;if(!drag.moved&&Math.abs(dx)<4)return;
  drag.moved=true;drag.it.classList.add('dragging');const k=Math.round(dx/drag.ppd);let s=drag.s0,en=drag.e0;drag.clamped=false;
  if(drag.mode==='due'){en=drag.e0+k;if(s!=null&&en<s){en=s;drag.clamped=true}}
  else if(drag.mode==='move'){s+=k;en+=k}else if(drag.mode==='start'){s=Math.min(drag.s0+k,drag.e0)}else{en=Math.max(drag.e0+k,drag.s0)}
  drag.ns=s;drag.ne=en;const w={s:drag.ws,days:drag.days};
  if(drag.mode==='due')drag.it.style.left=(pctOf(en,w)+50/drag.days)+'%';
  else{const a=Math.max(s,w.s),b=Math.min(en,w.s+w.days-1);drag.it.style.left=pctOf(a,w)+'%';drag.it.style.width=(Math.max(0,b-a+1)/drag.days*100)+'%'}
  showTip(drag.it,drag.mode==='due'?undefined:s,en);
});
function endDrag(cancel){
  const dr=drag;drag=null;if(!dr)return;dr.it.classList.remove('dragging');hideTip();
  if(cancel){render();return}
  if(dr.pp){
    if(!dr.moved){openPanel('pphase',dr.pp.id);return}
    if(dr.ns===dr.s0&&dr.ne===dr.e0){render();return}
    const undo=snapshot([dr.pp]);dr.pp.start=dn2iso(dr.ns);dr.pp.end=dn2iso(dr.ne);save();render();toast(phaseMoveMsg(dr.pp),'',undo);return;
  }
  if(!dr.moved){openPanel('deliv',dr.d.id);return}
  if(dr.ns===dr.s0&&dr.ne===dr.e0){render();if(dr.clamped)toast(`Due date can’t go before the start date (${fmt(dr.d.start)}). Change the start date in the deliverable first.`,'err');return}
  const undo=snapshot([dr.d]);dr.d.due=dn2iso(dr.ne);save();render();
  toast(`${dr.d.name}: due ${fmt(dr.d.due)}${dr.clamped?' (kept on or after its start date)':''}${outOfPhase(dr.d)?` · outside the ${phName(dr.d.phaseId)} dates`:''}`,'',undo);
}
document.addEventListener('pointerup',()=>endDrag(false));
document.addEventListener('pointercancel',()=>endDrag(true));

/* board drag and drop */
let dragTask=null;
document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('.card');if(!c)return;dragTask=c.dataset.tid;c.classList.add('dragging');try{e.dataTransfer.setData('text/plain',dragTask);e.dataTransfer.effectAllowed='move'}catch(err){}});
document.addEventListener('dragend',e=>{const c=e.target.closest&&e.target.closest('.card');if(c)c.classList.remove('dragging');document.querySelectorAll('.bcol.drop').forEach(x=>x.classList.remove('drop'));dragTask=null});
document.addEventListener('dragover',e=>{const col=e.target.closest&&e.target.closest('.bcol');if(!col||!dragTask)return;e.preventDefault();document.querySelectorAll('.bcol.drop').forEach(x=>{if(x!==col)x.classList.remove('drop')});col.classList.add('drop')});
document.addEventListener('drop',e=>{const col=e.target.closest&&e.target.closest('.bcol');if(!col||!dragTask)return;e.preventDefault();col.classList.remove('drop');const t=S.tasks.find(x=>x.id===dragTask);dragTask=null;if(t)moveTask(t,col.dataset.gfield,col.dataset.gval)});

let rsT=null;window.addEventListener('resize',()=>{clearTimeout(rsT);rsT=setTimeout(()=>{if(['overview','project'].includes(ui.view))render()},180)});

