/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
const KEY='az-planner-data-v1', PKEY='az-planner-prefs-v1';
const P_STAT=['Not started','In progress','On hold','Completed'];
const D_STAT=['Planned','In progress','Waiting information','Delivered'];
const T_STAT=['To Do','In progress','Waiting information','QA','Done'];
const PRIOS=['Low','Normal','High'];
const SOURCES=['Planned','Design Change','Rework','Incoming Info','Delay','Error','Coordination Issue'];
function defaultServices(){return ['Electrical','Mechanical','Hydraulics','Coordination','Other'].map(n=>({id:'sv-'+n.toLowerCase(),name:n}))}
const TF0=()=>({q:'',project:'',pm:'',assignee:'',status:'',priority:'',phase:'',service:'',source:'',from:'',to:'',qOver:false,qWait:false,qWeek:false,qUnas:false,qNoDue:false,showDone:false,archived:false});
const PTF0=()=>({assignee:'',status:'',deliv:'',showDone:false,mode:'table'});
const COLORS=['#7A6FB0','#2A9D8F','#3A6FD8','#D08C2B','#4F8A3C','#B5568E','#5B8FA8','#8A7B3B','#C46A3A','#6B7A8F'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY=864e5;
const ICON={
  chev:'<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up:'<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 7.5 6 4.5l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  down:'<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  del:'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 4h9M5.5 4V2.5h3V4M3.8 4l.6 7.5h5.2l.6-7.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  open:'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5.5 3H3v8h8V8.5M8 2.5h3.5V6M11.5 2.5 6.5 7.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit:'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 11.5h2.2l6.3-6.3-2.2-2.2-6.3 6.3zM7.7 4.1l2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  task:'<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.8 6.2 5.3 7.6 8.3 4.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info:'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 6.2v3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="4.3" r=".9" fill="currentColor"/></svg>',
  moon:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  sun:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  more:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="12.5" cy="8" r="1.4" fill="currentColor"/></svg>'
};

let S=null, storageOK=true, lastSaved=null;
let prefs={filters:{q:'',pm:'',status:'',phase:'',from:'',to:''},ovMode:'timeline',tlMode:'milestones',range:'3w',expanded:{},sort:{k:'',dir:1},sortV:2,projTab:'active',projQ:'',tf:TF0(),ptf:PTF0(),tvG:{layout:'table',group:'status',listGroup:'project',fields:false},tvP:{layout:'table',group:'status',listGroup:'deliverable',fields:false},moreTF:false,delivTimeline:true,activeView:{},drafts:{},theme:'system',resF:{project:'',pm:'',team:'',phase:'',status:'',discipline:'',person:''},resShowInactive:false,resCollapsed:{},resMode:'matrix',resWeek:'',resSort:{k:'',dir:1},fOpen:{},projF:{pm:'',status:'',team:'',phase:''},projSort:{k:'',dir:1},resCols:{}};
const ui={view:'overview',pid:null,ptab:'summary',panel:null,panelStack:[],panelNote:'',focusAfter:null,sel:new Set(),visible:[],qaDeliv:'',addProj:'',colAdd:null,winStart:0};
const app=document.getElementById('app');
const tip=document.getElementById('tip');
const modalRoot=document.getElementById('modal-root');

