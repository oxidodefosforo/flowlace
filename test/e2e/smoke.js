const { _electron } = require('playwright-core');
const path=require('path'),fs=require('fs'),os=require('os');
(async()=>{
  const ud=fs.mkdtempSync(path.join(os.tmpdir(),'ms-ud-'));
  const app=await _electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'..','..')],env:{...process.env,FLOWLACE_USER_DATA:ud}});
  const w=await app.firstWindow();
  w.on('console',m=>console.log('console:',m.type(),m.text()));
  w.on('pageerror',e=>console.log('pageerror:',e.stack));
  await w.waitForTimeout(1500); await w.reload(); await w.waitForTimeout(1500);
  console.log(await w.title(), await w.evaluate(()=>document.querySelector('#ms-start')&&!document.querySelector('#ms-start').hidden));
  await w.screenshot({path:'/tmp/claude-0/-home-claude/bbd8596f-2028-52b7-9933-06765fbf3579/scratchpad/start.png'});
  await app.close();
})().catch(e=>{console.error(e);process.exit(1)});
