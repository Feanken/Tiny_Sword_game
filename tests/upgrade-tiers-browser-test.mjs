// Camp transactions through normal index.html, with explicit test-only boss receipts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempRoot=path.resolve(os.tmpdir()),profile=fs.mkdtempSync(path.join(tempRoot,'penjaga-tiers-'));
const chromePath=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run',
  '--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
  {windowsHide:true,stdio:'ignore'});
const server=http.createServer((request,response)=>{
  const requested=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
  if(requested==='/favicon.ico'){response.writeHead(204);response.end();return;}
  const file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    response.writeHead(404);response.end();return;
  }
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png',
    '.webp':'image/webp','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav'};
  response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(response);
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket;
try{
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<150&&!fs.existsSync(portFile);i++)await delay(100);
  const [port,socketPath]=fs.readFileSync(portFile,'utf8').trim().split('\n');
  socket=new WebSocket('ws://127.0.0.1:'+port+socketPath.trim());
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  const pending=new Map(),errors=[];let serial=0;
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id){const p=pending.get(message.id);pending.delete(message.id);
      message.error?p.reject(new Error(JSON.stringify(message.error))):p.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  };
  const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
    const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
  const {targetId}=await call('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  const page=(method,params={})=>call(method,params,sessionId);
  const evaluate=async expression=>{
    const result=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  async function waitFor(expression){
    for(let i=0;i<300;i++){if(await evaluate(expression))return;await delay(50);}
    assert.fail('Timed out '+expression+' '+JSON.stringify(errors));
  }
  const mouse=(type,point,button='left')=>page('Input.dispatchMouseEvent',{
    type,x:point.x,y:point.y,...(type==='mouseMoved'?{}:{button,clickCount:1})});
  async function click(point){await mouse('mouseMoved',point);await mouse('mousePressed',point);await mouse('mouseReleased',point);}
  const center=selector=>evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
  await Promise.all([page('Page.enable'),page('Runtime.enable')]);
  await page('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.PenjagaModules={};let factory;
    Object.defineProperty(PenjagaModules,'createRuntime',{get(){return factory;},set(value){
      factory=(...args)=>{const rt=value(...args);window.__aimRuntime=rt;return rt;};
    }});
  `});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let checks=0;const same=(a,b)=>{assert.deepEqual(a,b);checks++;};
  const r='__aimRuntime',s=r+'.session',u=r+'.upgrading';
  const idSelector=id=>'#campCards [data-perk="'+id+'"]';
  const buttonDisabled=id=>evaluate('document.querySelector('+JSON.stringify(idSelector(id))+').disabled');
  const contents=id=>evaluate('document.querySelector('+JSON.stringify(idSelector(id))+').textContent');
  async function activate(selector){
    await evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');
    await click(await center(selector));
  }
  const gold=amount=>evaluate(s+'.gold='+amount+';'+r+'.ui.renderCamp();'+r+'.ui.updateUI()');
  const rank=id=>evaluate(s+'.ranks.'+id);
  async function buy(id,n){
    await activate(idSelector(id));same(await rank(id),n);
  }
  async function rankView(id,n,cap,stage){
    const text=await contents(id);
    assert(text.includes(n+' / 25')&&text.includes('batas '+cap));
    assert(text.includes(stage?'Tahap skill '+stage:'Skill pada rank 10'));checks++;
  }
  const progress=()=>evaluate('JSON.stringify({gold:'+s+'.gold,ranks:'+s+'.ranks,paid:'+s+'.paidTierUnlocks,proof:'+s+'.upgradeProgress})');
  for(const [protocol,url] of [
    ['file',pathToFileURL(path.join(root,'index.html')).href],
    ['HTTP','http://127.0.0.1:'+server.address().port+'/index.html']
  ]){
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url});
    await waitFor("window.PenjagaPulau?.snapshot().state==='ready'&&!document.querySelector('.menu-main').hidden");
    await activate('#menuExpeditionButton');await activate('#startButton');
    await waitFor(r+".session.state==='playing'");
    await evaluate('cancelAnimationFrame('+r+'.simulation.frameId)');
    await evaluate(fs.readFileSync(path.join(root,'tests/fixtures/upgrade-progress.js'),'utf8'));
    const ids=await evaluate('PenjagaModules.UpgradeProgress.ids');
    for(const id of ids){
      // Fresh normal lifecycle, with only wallet/time fixed by this fixture.
      await evaluate(r+'.lifecycle.startGame(53);'+s+'.gold=100000;'+s+'.waveTimer=100000;'+r+'.ui.updateUI()');
      await activate('#campButton');
      for(let n=1;n<=9;n++)await buy(id,n);
      await rankView(id,9,10,0);
      const price10=await evaluate(u+'.quoteRank('+JSON.stringify(id)+').cost');
      await gold(price10-1);same(await buttonDisabled(id),true);
      assert((await contents(id)).includes('Butuh '+price10+' emas'));checks++;
      await gold(price10);await buy(id,10);same(await evaluate(s+'.gold'),0);
      await rankView(id,10,10,1);
      await gold(100000);same(await buttonDisabled(id),true);
      assert((await contents(id)).includes('Menangkan boss Bab 1'));checks++;
      await evaluate('giveUpgradeBossEvidence('+r+',"boss-chapter-1")');
      same(await evaluate(s+'.paidTierUnlocks.'+id+'.length'),0);
      await gold(499);same(await buttonDisabled(id),true);
      await gold(500);same(await buttonDisabled(id),false);
      await activate(idSelector(id));same(await rank(id),10);same(await evaluate(s+'.gold'),0);
      await rankView(id,10,20,1);
      const before=await progress();
      same(await evaluate(u+'.unlockTier('+JSON.stringify(id)+',"tier-2")'),false);
      same(await progress(),before);
      await gold(100000);
      for(let n=11;n<=19;n++){await buy(id,n);if(n===11||n===19)await rankView(id,n,20,1);}
      const price20=await evaluate(u+'.quoteRank('+JSON.stringify(id)+').cost');
      await gold(price20-1);same(await buttonDisabled(id),true);
      await gold(price20);await buy(id,20);await rankView(id,20,20,2);
      await gold(100000);same(await buttonDisabled(id),true);
      assert((await contents(id)).includes('Menangkan boss Bab 2'));checks++;
      await evaluate('giveUpgradeBossEvidence('+r+',"boss-chapter-2")');
      await gold(1499);same(await buttonDisabled(id),true);
      await gold(1500);await activate(idSelector(id));same(await rank(id),20);same(await evaluate(s+'.gold'),0);
      await gold(100000);
      for(let n=21;n<=25;n++){await buy(id,n);if([21,24,25].includes(n))await rankView(id,n,25,n===25?3:2);}
      same(await buttonDisabled(id),true);
      assert((await contents(id)).includes('Maksimum rank 25'));checks++;
      same(await evaluate(u+'.unlockTier('+JSON.stringify(id)+',"tier-3")'),false);
      await activate('#campDialog [data-close]');
      await waitFor(s+".state==='playing'&&!document.querySelector('dialog[open]')");
    }
    // Rank 25, both receipts and both payments survive the actual arena handoff.
    await evaluate(r+'.lifecycle.finish(true)');await activate('#continueButton');
    await waitFor("document.getElementById('gameShell').dataset.map==='crossroads'&&"+s+".state==='playing'");
    await evaluate('cancelAnimationFrame('+r+'.simulation.frameId)');
    same(await evaluate(s+'.ranks.oath'),25);
    same(await evaluate(s+'.paidTierUnlocks.oath'),['tier-2','tier-3']);
    same(await evaluate(s+'.upgradeProgress.bossVictories'),['boss-chapter-1','boss-chapter-2']);
    same(await evaluate('['+s+'.hero.hp,'+s+'.hero.maxHp]'),[350,350]);
    await evaluate(r+'.lifecycle.finish(false)');await activate('#titleButton');
    await waitFor("document.getElementById('gameShell').dataset.map==='island'&&"+s+".state==='ready'");
    await activate('#menuExpeditionButton');await activate('#startButton');
    await waitFor(s+".state==='playing'");
    await evaluate('cancelAnimationFrame('+r+'.simulation.frameId)');
    // Keyboard focus can reach an available card; short screens scroll to all six cards.
    await evaluate(r+'.lifecycle.startGame(57);'+s+'.gold=100000;'+s+'.waveTimer=100000;'+r+'.ui.updateUI()');
    for(const [width,height] of [[1440,900],[1024,600],[960,480]]){
      await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await activate('#campButton');
      await evaluate("document.querySelector('#campCards [data-perk=blade]').focus()");
      same(await evaluate("document.activeElement.dataset.perk"),'blade');
      await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      assert((await rank('blade'))>=1);checks++;
      for(const id of ids){
        await evaluate('document.querySelector('+JSON.stringify(idSelector(id))+').scrollIntoView({block:"center"})');
        const rect=await evaluate('(()=>{const b=document.querySelector('+JSON.stringify(idSelector(id))+'),r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,readable:getComputedStyle(b).opacity};})()');
        assert(rect.w>180&&rect.y+rect.h>0&&rect.y<height&&Number(rect.readable)>=.8);checks++;
        const middle=await center(idSelector(id));
        same(await evaluate('document.elementFromPoint('+middle.x+','+middle.y+')?.closest("[data-perk]")?.dataset.perk'),id);
      }
      await activate('#campReady');
      await waitFor("!document.querySelector('dialog[open]')");
      await evaluate(s+'.waveTimer=100000');
    }
    // Title and replay clear proof, payment, rank and capacities through normal menu actions.
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await gold(100000);await activate('#campButton');
    for(let n=await rank('blade')+1;n<=10;n++)await buy('blade',n);
    await evaluate('giveUpgradeBossEvidence('+r+',"boss-chapter-1")');
    await activate(idSelector('blade'));
    same(await evaluate(s+'.paidTierUnlocks.blade'),['tier-2']);
    await activate('#campDialog [data-close]');
    await waitFor(s+".state==='playing'");
    await evaluate(r+'.lifecycle.finish(false)');await activate('#titleButton');
    await waitFor(s+".state==='ready'");
    same(await evaluate(s+'.paidTierUnlocks.blade'),[]);
    same(await evaluate(s+'.upgradeProgress.bossVictories'),[]);
    await activate('#menuExpeditionButton');await activate('#startButton');
    await waitFor(r+".session.state==='playing'");
    await evaluate('cancelAnimationFrame('+r+'.simulation.frameId)');
    same(await evaluate('Object.values('+s+'.ranks)'),[0,0,0,0,0,0]);
    same(await evaluate('['+s+'.gold,'+s+'.hero.maxHp,'+s+'.castle.maxHp]'),[80,100,500]);
    same(await evaluate(r+'.config.GATHERING_REWARDS.gold'),10000);
    console.log('PASS '+protocol+': six paths to rank 25 via camp, exact/short gold, boss receipts, repeated payment, rank/tier/skill labels, keyboard, 1440x900/1024x600/960x480 reachability, title/replay reset.');
  }
  same(errors,[]);console.log('PASS upgrade tiers browser: '+checks+' checks.');
  await call('Browser.close');


}finally{
  server.close();socket?.close();chrome.kill();
  const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-tiers-')){
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:8,retryDelay:150});
  }
}
