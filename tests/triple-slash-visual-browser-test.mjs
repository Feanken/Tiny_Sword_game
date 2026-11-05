// Isolated original-island combat fixture; actual campaign entry is covered by campaign-playable-browser-test.mjs.
// Triple Slash HUD and drawing: contract fixture or actual combat.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempRoot = path.resolve(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'penjaga-triple-visual-'));
const screenshotIndex = process.argv.indexOf('--screenshots');
const screenshots = screenshotIndex >= 0 ? path.resolve(process.argv[screenshotIndex + 1]) : null;
if (screenshots) fs.mkdirSync(screenshots, {recursive:true});
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
  {windowsHide:true, stdio:'ignore'});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100);
  const [port, socketPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  socket = new WebSocket('ws://127.0.0.1:' + port + socketPath.trim());
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  const pending = new Map(), errors = [], missing = [];
  let sequence = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const promise = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) promise.reject(new Error(JSON.stringify(message.error)));
      else promise.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) missing.push(message.params.errorText);
  };
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, {resolve, reject});
    socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const {targetId} = await call('Target.createTarget', {url:'about:blank'});
  const {sessionId} = await call('Target.attachToTarget', {targetId, flatten:true});
  const page = (method, params) => call(method, params, sessionId);
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true, userGesture:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  async function waitFor(expression, description) {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    assert.fail(description + ': ' + JSON.stringify({errors, missing}));
  }
  async function key(key, code = key, virtualKey = key === 'Enter' ? 13 : key === 'Escape' ? 27 : key === 'Tab' ? 9 : undefined) {
    const params = {key, code, ...(virtualKey ? {windowsVirtualKeyCode:virtualKey} : {})};
    await page('Input.dispatchKeyEvent', {type:'keyDown', ...params, ...(key === 'Enter' ? {text:'\r'} : {})});
    await page('Input.dispatchKeyEvent', {type:'keyUp', ...params});
  }
  async function activate(selector, touch) {
    assert.equal(await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && parseFloat(style.fontSize) > 0 && style.visibility === 'visible';
    })()`), true, 'Control has a visible label: ' + selector);
    if (!touch) {
      await evaluate('document.querySelector(' + JSON.stringify(selector) + ').focus()');
      await key('Enter');
      return;
    }
    const point = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      element.scrollIntoView({block:'center'});
      const rect = element.getBoundingClientRect();
      return {x:rect.left + rect.width / 2, y:rect.top + rect.height / 2};
    })()`);
    await page('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[point]});
    await page('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    await delay(60);
  }
  async function screenshot(name) {
    if (!screenshots) return;
    const result = await page('Page.captureScreenshot', {format:'png'});
    fs.writeFileSync(path.join(screenshots, name + '.png'), Buffer.from(result.data, 'base64'));
  }
  await Promise.all([page('Page.enable'), page('Runtime.enable'), page('Network.enable')]);
  // Capture the actual composed runtime for terminal-result regression tests.
  // This hook is injected by DevTools and is absent from production scripts.
  await page('Page.addScriptToEvaluateOnNewDocument', {source:`
    window.PenjagaModules = {};
    let factory;
    Object.defineProperty(window.PenjagaModules, 'createRuntime', {
      get() { return factory; },
      set(value) { factory = (...args) => {
        const runtime = value({...args[0],map:window.PenjagaMaps.island}); window.__testRuntime = runtime; return runtime;
      }; }
    });
  `});
  const fixtureMode=process.argv.includes('--fixture');
  const url=pathToFileURL(path.join(root,'index.html')).href;
  const run=source=>evaluate('(()=>{const r=window.__testRuntime;'+source+'})()');
  const view=()=>run(`return {snapshot:r.combat.tripleSlashSnapshot(),effect:r.renderer.lastTripleSlashVisual,
    cancel:r.renderer.lastTripleCancelVisual,basic:r.renderer.lastSwingVisual,status:r.host.$('tripleSlashButton').dataset.status,
    label:r.host.$('tripleSlashStatus').textContent,disabled:r.host.$('tripleSlashButton').disabled,
    steps:[...r.host.$('tripleSlashSteps').children].map(e=>e.dataset.state)};`);
  const step=frames=>run(`for(let i=0;i<${frames};i++){
    for(const u of r.session.enemies)if(u.testPin)Object.assign(u,{...u.testPin,knockX:0,knockY:0,speed:0,cooldown:99});
    r.simulation.update(1/60);r.renderer.draw();}`);
  async function reset(rank=10){
    await run(`r.input.clearCombatInput();r.session.resetForRun();r.session.state='playing';r.session.phase='prepare';
      r.session.waveTimer=999;r.session.ranks.blade=${rank};Object.assign(r.session.hero,{x:720,y:400});
      r.renderer.tripleCancel=null;r.session.enemies=[];r.session.allies=[];r.ui.announcementTimer=0;r.ui.toastTimer=0;
      r.host.$('announcement').classList.remove('show');r.host.$('toast').classList.remove('show');
      r.renderer.draw();r.host.canvas.focus({preventScroll:true});`);
  }
  async function aim(angle){
    const point=await run(`const h=r.session.hero;return r.renderer.camera.worldToScreen(
      h.x+Math.cos(${angle})*140,h.y+Math.sin(${angle})*140,r.host.canvas.getBoundingClientRect());`);
    await page('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await run('r.input.updateAim();r.renderer.draw();');
  }
  async function fixture(overrides){
    await run(`const v=PenjagaModules.tripleSlashVisualFixture(${JSON.stringify(overrides)});window.__tripleFixture=v;
      r.session.ranks.blade=v.unlocked?10:9;Object.assign(r.session.hero,{...v.hitArea.origin,aimAngle:v.hitArea.angle,swingAngle:v.hitArea.angle,
        attackDuration:.3,attack:v.status==='active'?.3-v.slashElapsed:0,missCue:0});
      r.session.hero.strike=v.status==='active'?{kind:'triple-slash',angle:v.hitArea.angle,elapsed:v.slashElapsed,hits:new Set()}:null;
      r.renderer.draw();`);
  }
  async function detail(name,hud=false){
    if(!screenshots)return;
    const clip=await run(hud?`const b=r.host.$('tripleSlashButton').getBoundingClientRect();return {x:b.left-4,y:b.top-4,width:b.width+8,height:b.height+8,scale:2};`:
      `const h=r.session.hero,p=r.renderer.camera.worldToScreen(h.x,h.y,r.host.canvas.getBoundingClientRect()),s=r.renderer.cssScale;
      return {x:p.x-150*s,y:p.y-180*s,width:300*s,height:320*s,scale:2};`);
    const result=await page('Page.captureScreenshot',{format:'png',clip});
    fs.writeFileSync(path.join(screenshots,name+'.png'),Buffer.from(result.data,'base64'));
  }
  const directions=[['right',0],['down-right',Math.PI/4],['down',Math.PI/2],['down-left',Math.PI*3/4],
    ['left',Math.PI],['up-left',-Math.PI*3/4],['up',-Math.PI/2],['up-right',-Math.PI/4]];
  const angleDifference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  for(const {width,height,dpr} of [{width:1280,height:720,dpr:1},{width:1440,height:900,dpr:1.25},
    {width:1920,height:1080,dpr:2}]){
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
    await page('Page.navigate',{url});await waitFor("window.PenjagaPulau?.snapshot().state==='ready'",'Main game loads');
    assert.equal(await evaluate('document.getElementById("tripleSlashButton").hidden'),true);
    await activate('#menuExpeditionButton',false);await activate('#startButton',false);
    await waitFor("PenjagaPulau.snapshot().state==='playing'",'Game starts');
    await run('cancelAnimationFrame(r.simulation.frameId);r.renderer.reducedMotion=true;');
    await evaluate(fs.readFileSync(path.join(root,'tests/fixtures/triple-slash-visual-fixture.js'),'utf8'));
    if(fixtureMode){
      await run(`r.combat.tripleSlashSnapshot=()=>JSON.parse(JSON.stringify(window.__tripleFixture));
        r.combat.requestTripleSlash=()=>{window.__fixtureRequests=(window.__fixtureRequests||0)+1;return false;};`);
      await fixture({status:'idle',unlocked:false,ready:false});
    }else assert.equal(await run('return typeof r.combat.tripleSlashSnapshot;'),'function','Integrate the combat dependency before running actual mode.');
    await reset(9);if(fixtureMode)await fixture({status:'idle',unlocked:false});
    let state=await view();assert.equal(state.status,'locked');assert.equal(state.label,'Bilah tingkat 10');assert.equal(state.disabled,true);
    if(!fixtureMode){
      await run('r.session.hero.hp=50;');await key('q','KeyQ');
      assert.equal((await view()).snapshot.sequence,0);assert.equal(await run('return r.session.food;'),3);
      assert.equal(await run('return r.session.hero.hp;'),50,'Locked Q cannot consume a ration.');
      await key('h','KeyH');assert.equal(await run('return r.session.food;'),2);
      assert.equal(await run('return r.session.hero.hp;'),95,'H retains healing.');
    }
    if(width===1440)await detail('hud-locked',true);
    await reset();if(fixtureMode)await fixture({status:'idle',unlocked:true,ready:true});
    state=await view();assert.equal(state.status,'ready');assert.equal(state.label,'Siap');assert.equal(state.disabled,false);
    if(width===1440)await detail('hud-ready',true);

    const raster=await run(`const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});let comparisons=0;const differences=[];
      for(const axis of [0,.37,Math.PI/2,Math.PI,-Math.PI/2,-Math.PI/4])for(const index of [1,2,3])for(const age of [.18,.22,.26]){
        ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,512,512);ctx.save();ctx.translate(256,256);ctx.scale(2,2);
        const v=PenjagaModules.tripleSlashVisualFixture({slashIndex:index,slashElapsed:age,angle:axis,hitArea:{origin:{x:0,y:0},angle:axis}});
        PenjagaModules.TripleSlashFx.drawSlash(ctx,v,r.combat.swingAngle(age),null);ctx.restore();
        const pixels=ctx.getImageData(0,0,512,512).data;
        for(let y=-100.27;y<101;y+=7)for(let x=-100.31;x<101;x+=7){
          const px=Math.floor(256+x*2),py=Math.floor(256+y*2),alpha=pixels[(py*512+px)*4+3];
          if(alpha>0&&alpha<40)continue;const painted=alpha>=40;let uniform=true;
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((pixels[((py+dy)*512+px+dx)*4+3]>=40)!==painted)uniform=false;
          if(!uniform)continue;const h=r.session.hero,hit=r.combat.swingContact({angle:axis},{x:h.x+x,y:h.y+y},.16,age);comparisons++;
          if(hit!==painted&&differences.length<5)differences.push({axis,index,age,x,y,hit,alpha});
        }
      }return {comparisons,differences};`);
    assert.deepEqual(raster.differences,[],JSON.stringify(raster));
    for(const [name,angle] of directions){
      await reset();await aim(angle);
      if(!fixtureMode){
        await run(`r.director.spawnEnemy();const u=r.session.enemies.at(-1),h=r.session.hero;
          Object.assign(u,{x:h.x+Math.cos(${angle})*60,y:h.y+Math.sin(${angle})*60,hp:1000,maxHp:1000,kind:'Warrior',color:'Red',entering:false});
          u.testPin={x:u.x,y:u.y};r.session.effects=[];`);
        await key('q','KeyQ');
      }
      const colors=[];
      for(const index of [1,2,3]){
        if(fixtureMode)await fixture({slashIndex:index,slashElapsed:13/60,angle});else await step(index===1?13:18);
        state=await view();const effect=state.effect,s=state.snapshot;
        assert.equal(s.status,'active');assert.equal(s.slashIndex,index);assert.equal(effect.slashIndex,index);
        assert.equal(effect.phase,'contact');assert.equal(state.label,'Tebasan '+index+' / 3');
        assert.equal(state.steps[index-1],'active');assert.equal(state.disabled,true);assert.equal(state.basic,null);
        assert.deepEqual(effect.origin,s.hitArea.origin);assert.equal(effect.angle,s.hitArea.angle);
        assert.equal(effect.reach,s.hitArea.reach);assert.equal(effect.radius,s.hitArea.radius);
        assert.equal(effect.trails,index);
        assert.equal(await run('return r.renderer.heroSprite.path;'),'Units/Blue Units/Warrior/Warrior_Attack'+(index===2?2:1)+'.png');
        assert.ok(angleDifference(effect.angle,angle)<1e-5);colors.push(effect.color);
        const unchanged=await run('const before=r.combat.tripleSlashSnapshot();r.renderer.draw();return JSON.stringify(before)===JSON.stringify(r.combat.tripleSlashSnapshot());');
        assert.equal(unchanged,true,'Rendering cannot advance or mutate skill state.');
        if(!fixtureMode){assert.equal(await run('return r.session.enemies[0].hp;'),1000-index*77);assert.deepEqual(s.hitCounts,[1,index>=2?1:0,index>=3?1:0]);}
        if(width===1440&&name==='up-right'){
          await screenshot('sequence-'+index);await detail('sequence-'+index+'-detail');await detail('hud-sequence-'+index,true);
        }
        if(width===1440&&index===2&&['up','down','left','right','down-left'].includes(name))await detail('direction-'+name);
      }
      assert.equal(new Set(colors).size,3);
      if(fixtureMode)await fixture({status:'completed',elapsed:.9,cooldownRemaining:7.1,unlocked:true,ready:false});else await step(6);
      state=await view();assert.equal(state.snapshot.status,'completed');assert.equal(state.effect,null);assert.equal(state.basic,null);
      assert.equal(state.status,'cooldown');if(width===1440&&name==='up-right')await detail('hud-cooldown',true);
    }

    await reset();await aim(0);
    if(fixtureMode)await fixture({slashIndex:1,slashElapsed:13/60});else{await key('q','KeyQ');await step(13);}
    // Keep the same live descriptor while moving only the coordinate fixture.
    await run(`window.__savedTripleCamera=r.renderer.camera;window.__savedTripleHero={x:r.session.hero.x,y:r.session.hero.y};
      r.renderer.camera=new PenjagaModules.Camera2D(4096,3072);r.renderer.resize();Object.assign(r.session.hero,{x:2048,y:1536});
      ${fixtureMode?'window.__tripleFixture.hitArea.origin={x:2048,y:1536};':''}r.renderer.draw();`);
    const camera=await run(`const before={x:r.renderer.camera.x,y:r.renderer.camera.y};
      r.session.hero.x+=70;r.session.hero.y+=90;${fixtureMode?'window.__tripleFixture.hitArea.origin={x:r.session.hero.x,y:r.session.hero.y};':''}
      r.renderer.draw();const v=r.renderer.lastTripleSlashVisual;return {dx:r.renderer.camera.x-before.x,dy:r.renderer.camera.y-before.y,origin:v.origin,hero:{x:r.session.hero.x,y:r.session.hero.y}};`);
    assert.ok(camera.dx>30&&camera.dy>30);assert.deepEqual(camera.origin,camera.hero);
    await run(`r.renderer.camera=window.__savedTripleCamera;Object.assign(r.session.hero,window.__savedTripleHero);r.renderer.resize();
      ${fixtureMode?'window.__tripleFixture.hitArea.origin={...window.__savedTripleHero};':''}r.renderer.draw();`);
    await key('u','KeyU');await run('r.renderer.draw();');
    assert.equal(await evaluate('document.getElementById("campDialog").open'),true);
    const frozen=await view();assert.equal(frozen.disabled,true);
    await run('r.simulation.advance(.1);r.renderer.draw();');assert.deepEqual((await view()).snapshot,frozen.snapshot);
    if(width===1440)await screenshot('upgrade-dialog');
    await activate('#campDialog .close-button',false);await waitFor("__testRuntime.session.state==='playing'",'Upgrade closes');

    if(fixtureMode){
      await fixture({status:'cancelled',phase:'idle',slashIndex:1,slashElapsed:.22,elapsed:.22,cancelReason:'dash',cooldownRemaining:7.78});
    }else{
      await key('Shift','ShiftLeft');await step(1);
    }
    state=await view();assert.equal(state.snapshot.status,'cancelled');assert.equal(state.effect,null);assert.equal(state.basic,null);
    assert.equal(state.cancel.reason,'dash');assert.equal(state.cancel.angle,state.snapshot.hitArea.angle);
    assert.match(state.label,/Dibatalkan/);assert.ok(state.snapshot.cooldownRemaining>7);
    if(width===1440){await screenshot('dash-cancel');await detail('dash-cancel-detail');await detail('hud-cancel',true);}
    if(fixtureMode)await fixture({status:'cancelled',cancelReason:'dash',cooldownRemaining:7.4});else await step(30);
    state=await view();assert.equal(state.effect,null);assert.equal(state.cancel,null);
    assert.equal(state.snapshot.hitCounts[1],0);assert.equal(state.snapshot.hitCounts[2],0);
    const bounds=await evaluate(`(()=>{const a=document.getElementById('arena').getBoundingClientRect(),b=document.getElementById('tripleSlashButton').getBoundingClientRect(),d=document.getElementById('dashButton').getBoundingClientRect();
      return {inside:b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom,separate:b.left>=d.right||b.top>=d.bottom||b.bottom<=d.top};})()`);
    assert.equal(bounds.inside,true);assert.equal(bounds.separate,true);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Desktop controls cannot overflow horizontally.');
    assert.equal(await evaluate('document.querySelectorAll("#tripleSlashButton").length'),1);
    assert.equal(await evaluate('document.getElementById("healButton").querySelector("kbd").textContent'),'H');

    if(!fixtureMode){
      // The HUD command uses the same atomic entry as Q, and cannot double-start.
      await reset();await aim(0);
      await run("r.host.$('tripleSlashButton').click();r.host.$('tripleSlashButton').click();r.renderer.draw();");
      state=await view();assert.equal(state.snapshot.sequence,1);assert.equal(state.snapshot.cooldownRemaining,8);
      await step(13);const firstAxis=(await view()).effect.angle;await aim(Math.PI/2);
      await step(18);state=await view();
      assert.ok(angleDifference(state.effect.angle,firstAxis)<=Math.PI/6+1e-8);
      assert.ok(angleDifference(state.effect.angle,firstAxis)>.5,'Second slash applies the permitted correction.');
      assert.equal(state.effect.angle,state.snapshot.angle);
      if(width===1440)await detail('bounded-turn-detail');
      await key('p','KeyP');await run('r.renderer.draw();');const paused=await view();
      assert.equal(paused.disabled,true);await run('r.simulation.advance(.1);r.renderer.draw();');
      assert.deepEqual((await view()).snapshot,paused.snapshot);
      await activate('#resumeButton',false);await aim(Math.PI/2);await step(2);
      assert.equal((await view()).snapshot.status,'active');
    }

    // Dense legal enemy positions beside the castle, including a covered target.
    await reset();await run(`Object.assign(r.session.hero,{x:810,y:310});r.renderer.draw();
      const spawn=(x,y)=>{r.director.spawnEnemy();const u=r.session.enemies.at(-1);
        Object.assign(u,{x,y,hp:1000,maxHp:1000,kind:'Warrior',color:'Red',entering:false,speed:0,cooldown:99});
        u.testPin={x,y};};
      spawn(880,315);
      for(let i=0;i<32&&r.session.enemies.length<13;i++){
        const angle=i*Math.PI/8,distance=48+Math.floor(i/16)*28,x=810+Math.cos(angle)*distance,y=310+Math.sin(angle)*distance;
        if(r.navigation.positionFits(x,y))spawn(x,y);
      }r.session.effects=[];`);await aim(0);
    assert.equal(await run('return r.navigation.clearPath(r.session.hero,{x:880,y:315});'),false);
    if(fixtureMode)await fixture({slashIndex:2,slashElapsed:13/60,angle:0,hitArea:{origin:{x:810,y:310},angle:0}});
    else{await key('q','KeyQ');await step(31);}
    state=await view();assert.equal(state.effect.slashIndex,2);
    assert.ok(await run('return r.session.enemies.length>=10;'));
    if(!fixtureMode){
      assert.equal(await run('return r.session.enemies[0].hp;'),1000,'Cover still blocks actual damage.');
      assert.ok(state.snapshot.hitCounts.every(n=>n<=5));
    }
    assert.equal(await run('return r.session.impacts.length<=60&&r.session.floaters.length<=35&&r.renderer.labelCount<=80;'),true);
    if(width===1440){await screenshot('crowd-castle');await detail('crowd-castle-detail');}
    console.log('PASS '+(fixtureMode?'fixture':'actual')+' '+width+'x'+height+' DPR '+dpr+': '+raster.comparisons+' effect/contact samples, 8 directions x 3 slashes, HUD gates/progress/cooldown, camera X/Y, dialog, dash cancel.');
  }

  // Resize an active sequence without adding simulation time.
  await reset();await aim(-Math.PI/2);
  if(fixtureMode)await fixture({slashIndex:2,slashElapsed:.2,angle:-Math.PI/2});
  else{await key('q','KeyQ');await step(31);}
  const beforeResize=(await view()).snapshot;
  for(const [width,height,dpr] of [[1100,1000,1.25],[1920,1080,2],[1280,720,1]]){
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
    await run('r.renderer.resize();r.renderer.draw();');
    const after=await view();assert.deepEqual(after.snapshot,beforeResize);
    assert.equal(after.disabled,true);assert.equal(after.effect.angle,after.snapshot.hitArea.angle);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Control hints remain within the resized desktop.');
    assert.equal(await evaluate('(()=>{const a=document.getElementById("arena").getBoundingClientRect(),b=document.getElementById("tripleSlashButton").getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom;})()'),true);
  }
  const visibleCancel=await evaluate(`(()=>{const c=document.createElement('canvas');c.width=c.height=180;const ctx=c.getContext('2d');
    PenjagaModules.TripleSlashFx.drawCancellation(ctx,{x:90,y:90},.2,Math.PI/3);
    const p=ctx.getImageData(0,0,180,180).data;let outsideFeet=0;
    for(let y=0;y<180;y++)for(let x=0;x<180;x++)if(p[(y*180+x)*4+3]>100&&Math.hypot(x-90,y-90)>30)outsideFeet++;
    return outsideFeet;})()`);
  assert.ok(visibleCancel>60,'Cancellation marks must be visible beyond the player foot ring.');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  await call('Browser.close');
}finally{
  socket?.close();chrome.kill();const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-triple-visual-')){
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
