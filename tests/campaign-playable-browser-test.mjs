// Browser integration for the ongoing campaign; lethal-damage fixtures are labeled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempRoot=path.resolve(os.tmpdir()),profile=fs.mkdtempSync(path.join(tempRoot,'penjaga-campaign-'));
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
  let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
  const r='__aimRuntime',s=r+'.session';
  async function activate(selector){
    await evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');
    await click(await center(selector));
  }
  async function fixtureWave(){
    return evaluate(`(()=>{
      const r=__aimRuntime,s=r.session;
      if(s.phase==='prepare')r.director.startWave();
      const receipt=r.campaign.receipt();let time=0;
      while(s.spawned<r.config.waves[s.waveIndex].count||s.waveIndex===4&&!s.bossSpawned){
        s.elapsed+=.05;r.director.updateSpawns(.05);time+=.05;
        for(const u of s.enemies)if(u.hp>0)r.combat.hurt(u,1000000,s.hero);
        s.enemies=s.enemies.filter(u=>u.hp>0);
        if(time>150)throw new Error('Fixture spawn timeout '+JSON.stringify({state:s.state,phase:s.phase,wave:s.waveIndex,spawned:s.spawned,boss:s.bossSpawned,elapsed:s.elapsed,schedule:r.director.arrivalSchedule,cursor:r.director.departureCursor}));
      }
      const accepted=r.director.finishWave(receipt),gold=s.gold,score=s.score;
      const repeated=r.director.finishWave(receipt);
      r.ui.updateUI();r.renderer.draw();
      return {accepted,repeated,goldUnchanged:gold===s.gold,scoreUnchanged:score===s.score};
    })()`);
  }
  const snap=()=>evaluate('PenjagaPulau.snapshot()');
  const screenshotIndex=process.argv.indexOf('--screenshots');
  const screenshotDir=screenshotIndex>=0?path.resolve(process.argv[screenshotIndex+1]):null;
  if(screenshotDir)fs.mkdirSync(screenshotDir,{recursive:true});
  async function shot(name){
    if(!screenshotDir)return;
    const result=await page('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(screenshotDir,name+'.png'),Buffer.from(result.data,'base64'));
  }
  for(const [protocol,url] of [
    ['file',pathToFileURL(path.join(root,'index.html')).href+'?economy=standard'],
    ['HTTP','http://127.0.0.1:'+server.address().port+'/index.html?economy=standard']
  ]){
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url});
    await waitFor("window.PenjagaPulau?.snapshot().state==='ready'&&!document.querySelector('.menu-main').hidden");
    eq(await evaluate(r+'.world.id'),'campaign-islands');
    await activate('#menuExpeditionButton');
    assert.match(await evaluate("document.getElementById('menuSetupRoute').textContent"),/Bab 1.*Bab 2.*Bab 3/);checks++;
    await activate('#startButton');await waitFor(s+".state==='playing'");
    await evaluate('cancelAnimationFrame('+r+'.simulation.frameId)');
    eq((await snap()).campaign.chapterId,'chapter-1');
    eq((await snap()).campaign.miningOverrideGold,null);
    eq(await evaluate(r+'.world.activeRegionIds'),['island-main']);
    await shot(protocol+'-chapter1');
    // Actual mouse combat in the normal, shifted world/camera.
    await evaluate(`(()=>{
      const r=__aimRuntime,s=r.session;window.__sameWorld=r.world;window.__sameCastle=s.castle;
      r.director.startWave();r.director.spawnEnemy('path-west',0);
      const u=s.enemies.at(-1);window.__target=u;
      Object.assign(u,{x:s.hero.x+55,y:s.hero.y,hp:1000,maxHp:1000,speed:0,entering:false,stagger:100});
      r.renderer.draw();
    })()`);
    const point=await evaluate(r+'.renderer.camera.worldToScreen('+s+'.hero.x+100,'+s+'.hero.y,'+r+'.host.canvas.getBoundingClientRect())');
    await click(point);
    await evaluate(r+'.simulation.update(.22)');
    eq(await evaluate('__target.hp'),973);
    await evaluate(r+'.lifecycle.startGame(723);'+r+'.renderer.draw()');
    // Finish real scheduler waves with lethal damage fixture; no free boss receipt injection.
    for(let chapter=0;chapter<3;chapter++){
      for(let wave=0;wave<5;wave++){
        if(chapter===0&&wave===4){
          await evaluate(s+'.gold=10000;'+s+'.phase="prepare"');
          await activate('#campButton');
          for(let n=0;n<10;n++)await activate('[data-perk="blade"]');
          eq(await evaluate(s+'.ranks.blade'),10);
          eq(await evaluate(r+'.upgrading.quoteTier("blade","tier-2").reason'),'boss-required');
          await activate('#campDialog [data-close]');await waitFor(s+".state==='playing'&&!document.querySelector('dialog[open]')");
        }
        const result=await fixtureWave();
        eq(result,{accepted:true,repeated:false,goldUnchanged:true,scoreUnchanged:true});
      }
      eq(await evaluate(r+'.world===__sameWorld&&'+s+'.castle===__sameCastle'),true);
      eq((await snap()).campaign.bossVictories.length,chapter+1);
      if(chapter<2){
        eq((await snap()).state,'chapter-review');
        eq(await evaluate(r+'.world.wavePathIds.length'),chapter+2);
        const elapsed=await evaluate(s+'.elapsed');await evaluate(r+'.simulation.update(10)');
        eq(await evaluate(s+'.elapsed'),elapsed);
        await shot(protocol+'-chapter'+(chapter+2)+'-review');
        await activate('#chapterContinueButton');eq((await snap()).state,'playing');
        if(chapter===0){
          await activate('#campButton');await activate('[data-perk="blade"]');
          eq(await evaluate(s+'.paidTierUnlocks.blade'),['tier-2']);eq(await evaluate(s+'.ranks.blade'),10);
          await activate('#campDialog [data-close]');await waitFor(s+".state==='playing'&&!document.querySelector('dialog[open]')");
        }
        // Preview all three warning labels while their spawn gates are off camera.
        if(chapter===1){
          await evaluate(s+'.waveIndex=3;'+r+'.director.startWave()');
          await evaluate(`(()=>{
            const r=__aimRuntime,s=r.session,e=r.director.arrivalSchedule[0];
            s.elapsed=r.director.waveStartedAt+e.arrival-1;r.director.updateSpawns(0);
            r.renderer.draw();
          })()`);
          const warning=await evaluate("document.getElementById('entryWarning').textContent");
          assert(warning.includes('Barat')&&warning.includes('Utara')&&warning.includes('Barat daya'));checks++;
          for(const [width,height] of [[1440,900],[960,480]]){
            await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
            await delay(70);await evaluate(r+'.renderer.resize();'+r+'.renderer.draw()');
            const box=await evaluate("(()=>{const e=document.getElementById('entryWarning'),b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,hidden:e.hidden};})()");
            await shot(protocol+'-three-warnings-'+width);
            assert(!box.hidden&&box.left>=0&&box.right<=width&&box.top>=0&&box.bottom<=height,JSON.stringify({width,height,box}));checks++;
          }
          await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
          // Return only the fixture cursor to the start of chapter3; campaign ledger is unchanged.
          await evaluate(s+'.waveIndex=0;'+s+'.spawned=0;'+s+'.enemies=[];'+s+'.phase="prepare";'+s+'.bossSpawned=false;'+s+'.boss=null');
        }
      }
    }
    eq((await snap()).state,'won');eq((await snap()).campaign.clearedWaveIds.length,15);
    eq(await evaluate(r+'.lifecycle.finish(true)'),false);
    await shot(protocol+'-complete');
    await activate('#titleButton');await activate('#menuExpeditionButton');await activate('#startButton');
    await waitFor(s+".state==='playing'");await evaluate('cancelAnimationFrame('+r+'.simulation.frameId)');
    eq((await snap()).campaign.chapterId,'chapter-1');eq((await snap()).campaign.bossVictories,[]);
    eq(await evaluate(r+'.world.activeRegionIds'),['island-main']);
    eq((await snap()).gold,80);eq(Object.values((await snap()).upgrades),[0,0,0,0,0,0]);
    await activate('#pauseButton');await activate('#restartPauseButton');
    eq((await snap()).campaign.clearedWaveIds,[]);
    console.log('PASS '+protocol+': normal campaign menu, mouse combat, all15 fixture waves, boss/tier, one World, review/carry, three offscreen warnings, repeat callback, title/restart.');
  }
  eq(errors,[]);console.log('PASS campaign browser: '+checks+' checks.');
  await call('Browser.close');

}finally{
  server.close();socket?.close();chrome.kill();
  const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-campaign-')){
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:8,retryDelay:150});
  }
}
