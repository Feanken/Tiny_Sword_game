// Desktop aim/sweep rendering against real combat and browser input.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempRoot = path.resolve(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'penjaga-aim-visual-'));
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
        const runtime = value(...args); window.__testRuntime = runtime; return runtime;
      }; }
    });
  `});
  const url=pathToFileURL(path.join(root,'index.html')).href;
  const evaluateRuntime=source=>evaluate('(()=>{const r=window.__testRuntime;'+source+'})()');
  const draw=()=>evaluateRuntime('r.renderer.draw();');
  async function closeup(name) {
    if(!screenshots)return;
    const clip=await evaluateRuntime(`const h=r.session.hero,p=r.renderer.camera.worldToScreen(h.x,h.y,r.host.canvas.getBoundingClientRect()),s=r.renderer.cssScale;
      return {x:p.x-150*s,y:p.y-180*s,width:300*s,height:320*s,scale:2};`);
    const result=await page('Page.captureScreenshot',{format:'png',clip});
    fs.writeFileSync(path.join(screenshots,name+'-detail.png'),Buffer.from(result.data,'base64'));
  }
  async function reset() {
    await evaluateRuntime(`r.input.clearCombatInput();r.session.enemies=[];r.session.allies=[];
      r.session.effects=[];r.session.floaters=[];r.session.impacts=[];r.session.shake=0;
      r.session.phase='prepare';r.session.waveTimer=999;
      Object.assign(r.session.hero,{x:720,y:400,hp:100,moving:false,attack:0,cooldown:0,
        stagger:0,dash:0,strike:null,missCue:0,work:null,knockX:0,knockY:0,animTime:0});
      r.renderer.draw();`);
  }
  async function aim(angle) {
    const point=await evaluateRuntime(`const h=r.session.hero;return r.renderer.camera.worldToScreen(
      h.x+Math.cos(${angle})*140,h.y+Math.sin(${angle})*140,r.host.canvas.getBoundingClientRect());`);
    await page('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await evaluateRuntime('r.input.updateAim();r.renderer.draw();');
    return point;
  }
  async function attack(point) {
    await page('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await page('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }
  const step=frames=>evaluateRuntime(`for(let i=0;i<${frames};i++){r.simulation.update(1/60);r.renderer.draw();}`);
  const visual=()=>evaluateRuntime(`return {aim:r.renderer.lastAimVisual,swing:r.renderer.lastSwingVisual,
    angle:r.session.hero.aimAngle,committed:r.session.hero.strike?.angle,bodyFacing:r.renderer.heroSprite.facing,
    path:r.renderer.heroSprite.path,frame:r.renderer.heroSprite.age,attack:r.session.hero.attack,
    x:r.session.hero.x,y:r.session.hero.y,state:r.session.state,keys:[...r.input.keys],
    smoothing:r.host.ctx.imageSmoothingEnabled};`);
  const angularDifference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const directions=[['right',0],['down-right',Math.PI/4],['down',Math.PI/2],['down-left',Math.PI*3/4],
    ['left',Math.PI],['up-left',-Math.PI*3/4],['up',-Math.PI/2],['up-right',-Math.PI/4]];

  for(const {width,height,dpr} of [{width:1280,height:720,dpr:1},{width:1440,height:900,dpr:1.25},
    {width:1920,height:1080,dpr:2}]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
    await page('Page.navigate',{url});
    await waitFor("window.PenjagaPulau?.snapshot().state==='ready'",'Main game loads');
    await activate('#menuExpeditionButton',false);await activate('#startButton',false);
    await waitFor("PenjagaPulau.snapshot().state==='playing'",'Expedition starts');
    await evaluateRuntime(`cancelAnimationFrame(r.simulation.frameId);r.renderer.reducedMotion=true;
      r.ui.announcementTimer=0;r.host.$('announcement').classList.remove('show');`);
    assert.equal(await evaluateRuntime('return typeof r.combat.heroAttackAngle;'),'function','Core aim dependency must be integrated.');
    await reset();
    // Rasterize the actual drawing path, then compare its solid interior/exterior
    // against the real contact predicate. Only antialiased boundary pixels are skipped.
    const raster=await evaluateRuntime(`const config=r.config.SWING,canvas=document.createElement('canvas');
      canvas.width=canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      let comparisons=0;const differences=[];
      for(const axis of [0,Math.PI/4,Math.PI/2,Math.PI*3/4,Math.PI,-Math.PI*3/4,-Math.PI/2,-Math.PI/4,
        .37,2.63,-Math.PI+.005,Math.PI-.005])
        for(const age of [.16,.19,.22,.25,.28]) {
          ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,512,512);ctx.save();
          ctx.translate(256,256);ctx.scale(2,2);ctx.rotate(axis);
          PenjagaModules.AimVisual.footprint(ctx,{from:-config.angle,to:r.combat.swingAngle(age),reach:config.reach,radius:config.radius});
          ctx.fillStyle='#fff';ctx.fill();ctx.restore();
          const pixels=ctx.getImageData(0,0,512,512).data;
          for(let y=-100.27;y<101;y+=7)for(let x=-100.31;x<101;x+=7) {
            const px=Math.floor(256+x*2),py=Math.floor(256+y*2),alpha=pixels[(py*512+px)*4+3];
            if(alpha!==0&&alpha!==255)continue;
            let uniform=true;
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(pixels[((py+dy)*512+px+dx)*4+3]!==alpha)uniform=false;
            if(!uniform)continue;
            const h=r.session.hero,target={x:h.x+x,y:h.y+y};
            const hit=r.combat.swingContact({angle:axis},target,config.start,age);
            comparisons++;
            if(hit!==(alpha===255)&&differences.length<8)differences.push({axis,age,x,y,hit,alpha});
          }
        }
      return {comparisons,differences};`);
    assert.deepEqual(raster.differences,[],'Visible footprint matches contact: '+JSON.stringify(raster));
    assert.ok(raster.comparisons>25000);

    for(const [name,angle] of directions) {
      await reset();const point=await aim(angle);
      await evaluateRuntime(`const h=r.session.hero;for(const [distance,offset] of [[60,0],[60,Math.PI],[104,0]]) {
        r.director.spawnEnemy();const u=r.session.enemies.at(-1);
        Object.assign(u,{x:h.x+Math.cos(${angle}+offset)*distance,y:h.y+Math.sin(${angle}+offset)*distance,
          kind:'Warrior',color:'Red',hp:500,maxHp:500,entering:false,speed:0,cooldown:99});
      }r.session.effects=[];`);
      await attack(point);
      await evaluateRuntime(`r.session.hero.attack-=.1;r.combat.updateHeroSwing(.1);r.renderer.draw();`);
      let state=await visual();assert.equal(state.swing.phase,'windup');
      assert.equal(await evaluateRuntime('return r.session.enemies[0].hp;'),500,'Windup cannot damage.');
      await evaluateRuntime(`r.session.hero.attack-=.16;r.combat.updateHeroSwing(.16);r.renderer.draw();`);
      state=await visual();
      assert.equal(state.swing.phase,'active');assert.ok(angularDifference(state.swing.angle,angle)<1e-5,JSON.stringify({name,angle,state}));
      assert.equal(state.swing.angle,state.committed);assert.equal(state.aim.angle,state.committed);
      assert.deepEqual(state.swing.origin,{x:state.x,y:state.y});
      assert.equal(state.swing.reach,76);assert.equal(state.swing.radius,18);
      assert.ok(Math.abs(state.swing.to-await evaluateRuntime('return r.combat.swingAngle(r.combat.heroAttackAge());'))<1e-8);
      assert.deepEqual(await evaluateRuntime('return r.session.enemies.map(u=>u.hp);'),[473,500,500]);
      assert.ok(state.frame<=1,'Horizontal baked slash frames must not draw.');
      assert.equal(state.smoothing,false);
      assert.equal(await evaluateRuntime(`const a=r.session.hero.markerLayout,b=PenjagaModules.AimVisual.indicatorBounds(r.renderer.lastAimVisual);
        return Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.y-b.y)>=(a.h+b.h)/2;`),true,'Player label cannot cover the direction marker.');
      if(Math.abs(Math.cos(angle))>.08)assert.equal(state.bodyFacing,Math.cos(angle)<0?-1:1);
      if(width===1440){await screenshot('strike-'+name);if(['up','down','up-right','down-left'].includes(name))await closeup('strike-'+name);}
    }

    // Move opposite the aim, then attack without turning the body toward movement.
    await reset();let point=await aim(0);
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA'});await step(24);
    let state=await visual();assert.ok(state.x<670);assert.equal(state.bodyFacing,1);assert.match(state.path,/_Run/);
    point=await aim(0);await attack(point);await step(12);state=await visual();
    assert.equal(state.bodyFacing,1);assert.ok(angularDifference(state.swing.angle,0)<1e-5);
    const committed=state.swing.angle;
    assert.deepEqual(state.swing.origin,{x:state.x,y:state.y},'Moving strike origin follows the current feet.');
    await page('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA'});
    if(width===1440){await screenshot('backward-attack');await closeup('backward-attack');}
    // The pointer can move during lock; aim/sweep/body remain on the committed axis.
    await aim(Math.PI);state=await visual();assert.equal(state.angle,committed);
    await key('p','KeyP');await draw();const paused=await visual();
    assert.equal(paused.state,'paused');assert.equal(paused.aim.paused,true);
    await evaluateRuntime('r.simulation.advance(.1);r.renderer.draw();');
    state=await visual();assert.equal(state.attack,paused.attack);assert.equal(state.swing.age,paused.swing.age);
    await activate('#resumeButton',false);await aim(Math.PI);await step(7);state=await visual();
    assert.equal(state.state,'playing');assert.ok(angularDifference(state.aim.angle,Math.PI)<.002);
    assert.equal(state.swing.angle,committed,'Recovery remains on the old axis.');
    if(width===1440)await screenshot('recovery-new-aim');
    await key('u','KeyU');await draw();
    assert.equal(await evaluate('document.getElementById("campDialog").open'),true);
    assert.equal((await visual()).aim,null,'No interactive indicator through an upgrade dialog.');
    await activate('[data-perk="blade"]',false);
    assert.equal(await evaluateRuntime('return r.session.ranks.blade;'),1);
    await activate('#campDialog .close-button',false);
    await waitFor("__testRuntime.session.state==='playing'&&!document.getElementById('campDialog').open",'Camp close returns to play');
    await step(40);await aim(-Math.PI/2);
    assert.equal((await visual()).state,'playing');
    assert.ok(angularDifference((await visual()).aim.angle,-Math.PI/2)<.002);
    assert.equal((await visual()).swing,null,'No stale afterimage after returning from camp.');

    // A coordinate-only large-world fixture exercises both camera axes. It does
    // not introduce another playable arena or use the old world's collision there.
    const camera=await evaluateRuntime(`const original=r.renderer.camera,h=r.session.hero,saved={x:h.x,y:h.y};
      r.renderer.camera=new PenjagaModules.Camera2D(4096,3072);r.renderer.resize();
      Object.assign(h,{x:2048,y:1536});r.renderer.draw();return {saved,initial:{x:r.renderer.camera.x,y:r.renderer.camera.y}};`);
    await aim(-Math.PI/4);
    const cameraCheck=await evaluateRuntime(`const h=r.session.hero,before={x:r.renderer.camera.x,y:r.renderer.camera.y};
      h.x+=70;h.y+=90;r.renderer.draw();r.input.updateAim();r.renderer.draw();
      const pointer=r.input.pointerWorld,expected=Math.atan2(pointer.y-h.y,pointer.x-h.x),v=r.renderer.lastAimVisual;
      const result={dx:r.renderer.camera.x-before.x,dy:r.renderer.camera.y-before.y,error:Math.abs(Math.atan2(Math.sin(v.angle-expected),Math.cos(v.angle-expected))),origin:v.origin};
      r.renderer.camera=new PenjagaModules.Camera2D(r.world.width,r.world.height);
      Object.assign(h,${JSON.stringify(camera.saved)});r.renderer.resize();r.renderer.draw();return result;`);
    assert.ok(cameraCheck.dx>30&&cameraCheck.dy>30,JSON.stringify(cameraCheck));assert.ok(cameraCheck.error<1e-8);
    console.log('PASS '+width+'x'+height+' DPR '+dpr+': '+raster.comparisons+' raster/contact samples, eight directional hits, body facing, moving origin, pause, camp, recovery, X/Y camera.');
  }

  // Resize the same running arena, including a fractional DPR.
  for(const [width,height,dpr] of [[1100,1000,1.25],[1920,1080,2],[1280,720,1]]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
    await reset();await aim(-Math.PI*3/4);
    const result=await evaluateRuntime(`r.renderer.resize();r.renderer.draw();r.input.updateAim();r.renderer.draw();
      const h=r.session.hero,p=r.input.pointerWorld,v=r.renderer.lastAimVisual;
      return {angle:v.angle,expected:Math.atan2(p.y-h.y,p.x-h.x),width:r.host.canvas.width,height:r.host.canvas.height};`);
    assert.ok(angularDifference(result.angle,result.expected)<1e-8);
    assert.ok(result.width>0&&result.height>0);
  }
  // Compare contrast treatments in an untainted path-only canvas.
  const contrast=await evaluate(`(()=>{const result=[];
    for(const background of ['#c5c78b','#10263b']) {
      const canvas=document.createElement('canvas');canvas.width=220;canvas.height=160;const ctx=canvas.getContext('2d');
      ctx.fillStyle=background;ctx.fillRect(0,0,220,160);
      PenjagaModules.AimVisual.drawIndicator(ctx,{origin:{x:100,y:100},angle:-Math.PI/2,reach:76,radius:18});
      const pixels=ctx.getImageData(80,0,40,40).data;let dark=0,light=0;
      for(let i=0;i<pixels.length;i+=4){if(pixels[i]<40&&pixels[i+1]<65&&pixels[i+2]<70)dark++;
        if(pixels[i]>220&&pixels[i+1]>215&&pixels[i+2]>160)light++;}
      result.push({background,dark,light});
    }return result;})()`);
  assert.ok(contrast.every(c=>c.dark>0&&c.light>0));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log('PASS resize, sharp sprites, and light/dark indicator contrast; no JS or asset errors.');
  await call('Browser.close');
} finally {
  socket?.close();chrome.kill();
  const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-aim-visual-')) {
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
