/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- utils ---------- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const iso2dn=s=>{if(!s)return null;const[y,m,d]=s.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/DAY)};
const dn2iso=n=>new Date(n*DAY).toISOString().slice(0,10);
const todayDN=()=>{const t=new Date();return Math.round(Date.UTC(t.getFullYear(),t.getMonth(),t.getDate())/DAY)};
const fmt=s=>{if(!s)return '—';const[y,m,d]=s.split('-');return `${d} ${MON[+m-1]} ${y}`};
const fmtDN=n=>fmt(dn2iso(n));
const dowMon=n=>(new Date(n*DAY).getUTCDay()+6)%7;
const ymd=n=>{const d=new Date(n*DAY);return[d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()]};
const monthStart=n=>{const[y,m]=ymd(n);return Math.round(Date.UTC(y,m,1)/DAY)};
const nextMonth=n=>{const[y,m]=ymd(n);return Math.round(Date.UTC(y,m+1,1)/DAY)};
function isoWeek(n){const d=new Date(n*DAY);d.setUTCDate(d.getUTCDate()+3-((d.getUTCDay()+6)%7));const j4=new Date(Date.UTC(d.getUTCFullYear(),0,4));return 1+Math.round(((d-j4)/DAY-3+((j4.getUTCDay()+6)%7))/7)}
function rel(due){const diff=iso2dn(due)-todayDN();if(diff===0)return 'today';if(diff===1)return 'tomorrow';if(diff===-1)return '1 day overdue';if(diff>0)return `in ${diff} days`;return `${-diff} days overdue`}
const plural=(n,w,pl)=>`${n} ${n===1?w:(pl||w+'s')}`;
function normUrl(u){u=(u||'').trim();if(!u)return '';if(/^[a-z][a-z0-9+.-]*:/i.test(u))return u;if(/^\\\\|^[A-Za-z]:\\/.test(u))return u;return 'https://'+u}

