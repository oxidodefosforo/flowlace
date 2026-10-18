/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */
/* ---------- app identity (fixed: Flowlace), company details and logo, light / dark theme ---------- */
const APP_NAME='Flowlace';
const defaultBranding=()=>({appName:APP_NAME}); // kept for backup compatibility; the application name and logo can't be changed
const defaultCompany=()=>({name:'Alphazeta Group',legalName:'',taxId:'',address:'',phone:'',email:'',website:'',notes:'',logo:null,logoDark:null});
const CO_FIELDS=[['name','Company name','e.g. Alphazeta Group',80],['legalName','Legal / registered name','e.g. Alphazeta Group Pty Ltd',120],['taxId','Business or tax number','e.g. ABN 12 345 678 901',40],['phone','Phone','+61 8 …',40],['email','Email','projects@company.com',120],['website','Website','https://…',160],['address','Address','Street, city, state, postcode, country',240]];
const okLogo=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(v)&&v.length<900000;
function normBrand(o,d){
  const b=d.branding&&typeof d.branding==='object'?d.branding:{},c=d.company&&typeof d.company==='object'?d.company:{};
  o.branding=defaultBranding();
  const dc=defaultCompany();o.company={};Object.keys(dc).forEach(k=>{if(k==='logo'||k==='logoDark')return;o.company[k]=k in c?String(c[k]||'').slice(0,k==='notes'?2000:240):dc[k]});
  // a logo uploaded in the earlier "application logo" setting becomes the company logo
  o.company.logo=okLogo(c.logo)?c.logo:okLogo(b.logo)?b.logo:null;
  o.company.logoDark=okLogo(c.logoDark)?c.logoDark:(!okLogo(c.logo)&&okLogo(b.logoDark))?b.logoDark:null;
}
const appName=()=>APP_NAME;
function companyLogoHTML(){
  const c=S.company;if(!c.logo&&!c.logoDark)return '';
  const l=c.logo||c.logoDark,d=c.logoDark;
  if(d&&c.logo)return `<img class="clogo lg-light" src="${l}" alt=""><img class="clogo lg-dark" src="${d}" alt="">`;
  return `<img class="clogo chip" src="${l}" alt="">`;
}
function brandHTML(){
  const co=S.company.name.trim(),cl=companyLogoHTML();
  return `<button class="brand" data-act="nav" data-to="overview" aria-label="${APP_NAME}${co?`, ${esc(co)}`:''}: go to Overview"><img class="logo lg-light" src="${LOGO_LIGHT}" alt=""><img class="logo lg-dark" src="${LOGO_DARK}" alt=""><span class="bname">${APP_NAME}</span>${co||cl?`<span class="bco" title="${esc(co)}">${cl}${co?`<span class="bcn">${esc(co)}</span>`:''}</span>`:''}</button>`;
}
/* theme: a personal preference (System / Light / Dark) */
function applyTheme(){const t=prefs.theme;if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;
  const m=document.querySelector('meta[name=color-scheme]');if(m)m.content=t==='light'?'light':t==='dark'?'dark':'light dark'}
const isDark=()=>prefs.theme==='dark'||(prefs.theme!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
function themeBtn(){const d=isDark();return `<button class="iconbtn themeb" data-act="theme-toggle" aria-label="${d?'Switch to light mode':'Switch to dark mode'}" title="${d?'Light mode':'Dark mode'}">${d?ICON.sun:ICON.moon}</button>`}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(!prefs.theme||prefs.theme==='system')render()})}catch(e){}

function settingsBrand(){
  const c=S.company,th=prefs.theme||'system';
  const logoBox=(k,label,val,hint)=>`<div class="logo-row"><div class="logo-prev${k==='dark'?' dk':''}">${val?`<img src="${val}" alt="${esc(label)}">`:'<span class="muted" style="font-size:11px">No logo</span>'}</div>
    <div class="logo-meta"><b>${esc(label)}</b><span class="hint">${hint}</span>
    <div class="data-actions"><label class="btn sm" for="logo-file-${k}" style="cursor:pointer">${val?'Replace image…':'Upload image…'}</label><input type="file" id="logo-file-${k}" data-logo="${k}" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>${val?`<button class="btn sm ghost" data-act="logo-reset" data-k="${k}">Remove</button>`:''}</div></div></div>`;
  return `<div class="sgrid"><section class="panelbox"><h2>Company</h2><p class="note" style="margin:0 0 10px">The company whose projects are managed here. Its logo and name appear in the top bar next to ${APP_NAME}; all details are saved with the data and included in backups.</p>
    <div class="fgrid">${CO_FIELDS.map(([k,l,ph,max])=>fld(esc(l),`<input class="in" id="co-${k}" data-cf="${k}" value="${esc(c[k])}" maxlength="${max}" placeholder="${esc(ph)}"${k==='email'?' type="email"':k==='website'?' type="url"':''}><em class="err"></em>`,{span:k==='address'})).join('')}
    ${fld('Notes',`<textarea class="in" id="co-notes" data-cf="notes" rows="3" maxlength="2000" placeholder="Offices, standards, billing contacts…">${esc(c.notes)}</textarea>`,{span:1})}</div></section>
  <div style="display:flex;flex-direction:column;gap:14px"><section class="panelbox"><h2>Company logo</h2>
    ${logoBox('light','Company logo',c.logo,'Shown in the top bar beside the company name. Wide or square images work; shown about 22 px high.')}
    ${logoBox('dark','Company logo for dark mode',c.logoDark,c.logo?'Optional. Without it the logo sits on a light tile in dark mode.':'Optional.')}
    <p class="hint" style="margin-top:6px">Images are stored with the data (and in backups), resized to at most 256 px. The ${APP_NAME} name and logo are fixed.</p></section>
  <section class="panelbox"><h2>Appearance</h2>
    <div class="seg" role="group" aria-label="Theme">${[['system','System'],['light','Light'],['dark','Dark']].map(([v,l])=>`<button data-act="theme-set" data-v="${v}" aria-pressed="${th===v}">${l}</button>`).join('')}</div>
    <p class="hint" style="margin-top:8px">System follows your computer’s light or dark setting. The moon / sun button in the top bar switches quickly. This choice is saved in this browser only.</p></section></div></div>`;
}
function readLogo(file,cb){
  if(!file)return;if(!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)){toast('Use a PNG, JPG, WebP or SVG image.','err');return}
  if(file.size>3e6){toast('That image is larger than 3 MB. Use a smaller file.','err');return}
  const r=new FileReader();r.onerror=()=>toast('Could not read that image.','err');
  r.onload=()=>{const url=String(r.result);
    if(file.type==='image/svg+xml'){if(url.length>300000){toast('That SVG is too large (max 200 KB).','err');return}cb(url);return}
    const img=new Image();img.onload=()=>{const k=Math.min(1,256/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*k));cv.height=Math.max(1,Math.round(img.height*k));cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);cb(cv.toDataURL('image/png'))};
    img.onerror=()=>toast('Could not read that image.','err');img.src=url};
  r.readAsDataURL(file);
}
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.cf){const k=el.dataset.cf,v=el.value.trim();
    if(k==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){fieldError(el,'Check the email address.');return}
    if(k==='website'&&v&&!/^https?:\/\//i.test(v)){el.value='https://'+v}
    clearFieldError(el);const nv=k==='website'&&v&&!/^https?:\/\//i.test(v)?'https://'+v:v;if(S.company[k]===nv)return;S.company[k]=nv;save();if(k==='name')render();setSaveInd();return}
  if(el.dataset.logo){const k=el.dataset.logo,f=el.files&&el.files[0];el.value='';
    readLogo(f,url=>{if(k==='dark')S.company.logoDark=url;else S.company.logo=url;save();render();toast(k==='dark'?'Dark-mode company logo updated':'Company logo updated')});return}
});

