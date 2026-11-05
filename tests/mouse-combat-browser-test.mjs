// Real mouse/keyboard events through index.html. Runtime injection only makes
// scenes deterministic; production input, combat, navigation and camera stay real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempRoot=path.resolve(os.tmpdir()),profile=fs.mkdtempSync(path.join(tempRoot,'penjaga-mouse-'));
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
  const worldPoint=(x,y)=>evaluate('(()=>{const r=__aimRuntime;return r.renderer.camera.worldToScreen('+x+','+y+',r.host.canvas.getBoundingClientRect());})()');
  const step=n=>evaluate('(()=>{const r=__aimRuntime;for(let i=0;i<'+n+';i++)r.simulation.update(1/60);r.renderer.draw();})()');
  const key=(type,key,code)=>page('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:key===' '?32:key.toUpperCase().charCodeAt(0)});
  // DevTools pointer coordinates pass through Blink's float CSS coordinates.
  const angleClose=(actual,expected)=>assert(Math.abs(Math.atan2(Math.sin(actual-expected),Math.cos(actual-expected)))<1e-5,actual+' != '+expected);
  async function scene(axis=0,position={x:700,y:400}){
    await evaluate(`(()=>{
      const r=__aimRuntime,s=r.session;cancelAnimationFrame(r.simulation.frameId);
      r.input.clearCombatInput();s.resetForRun();r.combat.resetCombatStats();
      s.state='playing';s.phase='prepare';s.waveTimer=1000000;
      Object.assign(s.hero,{x:${position.x},y:${position.y},hp:10000,maxHp:10000});
      s.allies=[];s.enemies=[];s.boss=null;
      window.__aimTargets=[];
      for(const offset of [0,Math.PI]){
        r.director.spawnEnemy('path-west',0);
        const u=s.enemies.at(-1),a=${axis}+offset;
        Object.assign(u,{x:s.hero.x+Math.cos(a)*60,y:s.hero.y+Math.sin(a)*60,
          hp:1000,maxHp:1000,speed:0,entering:false,stagger:10,knockX:0,knockY:0});
        __aimTargets.push(u);
      }
      r.renderer.draw();r.host.canvas.focus({preventScroll:true});
    })()`);
  }
  await Promise.all([page('Page.enable'),page('Runtime.enable')]);
  await page('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.PenjagaModules={};let factory;
    Object.defineProperty(PenjagaModules,'createRuntime',{get(){return factory;},set(value){
      factory=(...args)=>{const rt=value(...args);window.__aimRuntime=rt;return rt;};
    }});
  `});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  for(const [protocol,url,dpr] of [
    ['file',pathToFileURL(path.join(root,'index.html')).href,1],
    ['HTTP','http://127.0.0.1:'+server.address().port+'/index.html',2]
  ]){
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:dpr,mobile:false});
    await page('Page.navigate',{url});
    await waitFor("window.PenjagaPulau?.snapshot().state==='ready'&&!document.querySelector('.menu-main').hidden");
    await click(await center('#menuExpeditionButton'));
    await click(await center('#startButton'));
    await waitFor("window.__aimRuntime?.session.state==='playing'");
    for(let i=0;i<8;i++){
      const axis=i*Math.PI/4;
      await scene(axis);
      const point=await worldPoint(700+Math.cos(axis)*100,400+Math.sin(axis)*100);
      assert.equal(await evaluate('document.elementFromPoint('+point.x+','+point.y+').id'),'gameCanvas');
      await click(point);
      angleClose(await evaluate('__aimRuntime.session.hero.strike.angle'),axis);
      await step(18);
      assert.deepEqual(await evaluate('__aimTargets.map(e=>e.hp)'),[973,1000]);
    }
    await scene();const right=await worldPoint(800,400),up=await worldPoint(700,300);
    await mouse('mouseMoved',up);await mouse('mouseMoved',await worldPoint(700,400));
    angleClose(await evaluate('__aimRuntime.session.hero.aimAngle'),-Math.PI/2);
    await mouse('mouseMoved',right);await mouse('mousePressed',right);
    await mouse('mouseMoved',up);
    angleClose(await evaluate('__aimRuntime.session.hero.aimAngle'),0);
    await step(17); // contact done, recovery continues with new aim
    angleClose(await evaluate('__aimRuntime.session.hero.aimAngle'),-Math.PI/2);
    angleClose(await evaluate('__aimRuntime.combat.heroAttackAngle()'),0);
    await step(19);
    angleClose(await evaluate('__aimRuntime.session.hero.strike.angle'),-Math.PI/2);
    await mouse('mouseReleased',up);

    await scene();await mouse('mouseMoved',right);
    await key('keyDown','a','KeyA');await click(right);await step(2);await key('keyUp','a','KeyA');
    assert(await evaluate('__aimRuntime.session.hero.x<700'));
    angleClose(await evaluate('__aimRuntime.session.hero.strike.angle'),0);

    // Real UI buttons never become attack presses. Drag capture over UI releases hold.
    await scene();const swings=await evaluate('__aimRuntime.session.combatStats.swings');
    await click(await center('#recruitButton'));
    assert.equal(await evaluate('__aimRuntime.session.allies.length'),1);
    assert.equal(await evaluate('__aimRuntime.session.combatStats.swings'),swings);
    await click(await center('#pauseButton'));assert.equal(await evaluate('__aimRuntime.session.state'),'paused');
    await click(await center('#resumeButton'));assert.equal(await evaluate('__aimRuntime.session.state'),'playing');
    await click(await center('#campButton'));assert(await evaluate("document.getElementById('campDialog').open"));
    await click(await center('#campDialog [data-close]'));
    assert.equal(await evaluate('__aimRuntime.session.combatStats.swings'),swings);
    await scene();await mouse('mouseMoved',right);await mouse('mousePressed',right);
    const pause=await center('#pauseButton');await mouse('mouseMoved',pause);await step(50);await mouse('mouseReleased',pause);
    assert.equal(await evaluate("__aimRuntime.input.keys.has(' ')"),false);
    assert.equal(await evaluate('__aimRuntime.session.combatStats.swings'),1);

    // Building cover and water through the normal composed simulation.
    await scene(0,{x:805,y:310});
    await evaluate("Object.assign(__aimTargets[0],{x:885,y:310});__aimRuntime.session.enemies=[__aimTargets[0]];");
    await click(await worldPoint(905,310));await step(18);
    assert.equal(await evaluate('__aimTargets[0].hp'),1000);
    await scene(Math.PI,{x:104,y:360});
    await evaluate("Object.assign(__aimTargets[0],{x:164,y:360});__aimRuntime.session.enemies=[__aimTargets[0]];");
    await click(await worldPoint(40,360));await key('keyDown','a','KeyA');await step(18);await key('keyUp','a','KeyA');
    assert(await evaluate('__aimRuntime.session.hero.x>=103'));
    assert.equal(await evaluate('__aimTargets[0].hp'),1000);

    // Camera follows X in the normal entry. View is made taller via browser resize.
    await page('Emulation.setDeviceMetricsOverride',{width:900,height:1000,deviceScaleFactor:dpr,mobile:false});
    await waitFor("(()=>{const r=__aimRuntime,rect=r.host.canvas.getBoundingClientRect();return Math.abs(r.renderer.camera.width-704*rect.width/rect.height)<.001;})()");
    await scene(0,{x:600,y:370});
    const stillPointer=await worldPoint(700,450);await mouse('mouseMoved',stillPointer);
    await key('keyDown','d','KeyD');await step(4);await key('keyUp','d','KeyD');
    const stationaryAim=await evaluate("(()=>{const r=__aimRuntime,h=r.session.hero,p=r.input.pointerWorld;return {actual:h.aimAngle,expected:Math.atan2(p.y-h.y,p.x-h.x)};})()");
    angleClose(stationaryAim.actual,stationaryAim.expected);
    const oldCamera=await evaluate('__aimRuntime.renderer.camera.x');
    await evaluate('__aimRuntime.session.hero.x=1050;__aimRuntime.renderer.draw()');
    assert(await evaluate('__aimRuntime.renderer.camera.x>'+oldCamera));
    const movedPoint=await worldPoint(1050,470);await click(movedPoint);
    angleClose(await evaluate('__aimRuntime.session.hero.strike.angle'),Math.PI/2);

    // Test-only large world: real Camera2D/input/combat, including shifted Y and DPR.
    await evaluate(fs.readFileSync(path.join(root,'tests/fixtures/large-world-aim.js'),'utf8'));
    await evaluate("window.__largeAim=createLargeWorldAimFixture(document.getElementById('gameCanvas'))");
    const large=await evaluate(`(()=>{
      const f=__largeAim,h=f.session.hero,rect=f.host.canvas.getBoundingClientRect();
      const p=f.camera.worldToScreen(h.x+90,h.y-90,rect);f.setPointer(p.x,p.y);f.combat.heroAttack();
      const before={angle:h.strike.angle,x:f.camera.x,y:f.camera.y};
      f.combat.cancelHeroSwing(false);h.x=1900;h.y=1300;f.camera.follow(h);f.input.updateAim();
      return {before,after:{x:f.camera.x,y:f.camera.y,angle:h.aimAngle},
        expected:Math.atan2(f.input.pointerWorld.y-h.y,f.input.pointerWorld.x-h.x)};
    })()`);
    angleClose(large.before.angle,-Math.PI/4);angleClose(large.after.angle,large.expected);
    assert(large.after.x>large.before.x&&large.after.y>large.before.y);
    await evaluate('__largeAim.navigation.dispose()');
    console.log('PASS '+protocol+' DPR '+dpr+': normal entry, 8 directions, hold/lock/recovery, backwards, UI/drag, cover/water, shifted camera, large-world fixture.');
  }
  assert.deepEqual(errors,[]);
  await call('Browser.close');
}finally{
  server.close();socket?.close();chrome.kill();
  const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-mouse-')){
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:8,retryDelay:150});
  }
}
