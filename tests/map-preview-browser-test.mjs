// Browser integration checks for the standalone desktop file:// map preview.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempRoot = path.resolve(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'penjaga-map-preview-'));
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
  // DevTools captures the real navigation context, without shipping a gameplay cheat API.
  await page('Page.addScriptToEvaluateOnNewDocument', {source:`
    window.PenjagaModules = {};
    let install;
    Object.defineProperty(window.PenjagaModules, 'installNavigation', {
      get() { return install; },
      set(value) { install = context => {window.__previewRuntime=context;return value(context);}; }
    });
    let art;
    Object.defineProperty(window.PenjagaModules, 'MapPreviewRenderer', {
      get() {return art;},
      set(value) {art=class extends value {constructor(...args){super(...args);window.__previewArt=this;}};}
    });
  `});
  const url = pathToFileURL(process.env.PREVIEW_ENTRY || path.join(root,'preview-map.html')).href;
  const snapshot = () => evaluate('PenjagaMapPreview.snapshot()');
  const visit = id => evaluate('PenjagaMapPreview.visit('+JSON.stringify(id)+')');
  const nextFrame = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const active = [['island-main'],['island-main','island-north','bridge-north'],
    ['island-main','island-north','island-southwest','bridge-north','bridge-southwest']];
  let referenceHeroSize;
  for (const {width,height,dpr} of [
    {width:1280,height:720,dpr:1}, {width:1440,height:900,dpr:1}, {width:1920,height:1080,dpr:2}
  ]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
    await page('Page.navigate',{url});
    await waitFor('!!window.PenjagaMapPreview','Preview loads from file://');
    assert.equal(await evaluate('location.protocol'),'file:');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
    for (let chapter=1;chapter<=3;chapter++) {
      await activate('[data-chapter="chapter-'+chapter+'"]',false);
      await nextFrame();
      let state=await snapshot();
      assert.equal(state.chapterId,'chapter-'+chapter);
      assert.deepEqual(state.activeRegionIds.toSorted(),active[chapter-1].toSorted());
      assert.equal(state.camera.height,704,'Viewport height is independent of world and chapter.');
      assert.deepEqual(state.castle,{hp:500,maxHp:500});
      assert.equal(await evaluate('__previewRuntime.world.isWalkable(__previewRuntime.session.hero.x,__previewRuntime.session.hero.y)'),true);
      assert.equal(await evaluate('Array.from(document.querySelectorAll("#regionSelect option:disabled")).length'),5-active[chapter-1].length);
      const heroSize=await evaluate('136*document.getElementById("previewCanvas").getBoundingClientRect().height/704');
      if(chapter===1)referenceHeroSize=heroSize;
      assert.equal(heroSize,referenceHeroSize,'Unlocking land must not shrink actors.');
      assert.ok(state.render.culled>0,'Offscreen scenery is culled.');
      assert.equal(state.render.painted+state.render.culled,state.render.objects);
      assert.equal(await evaluate(`(()=>{const world=__previewRuntime.world;
        return __previewArt.objects.length===['trees','goldNodes','buildings','rocks','bushes','sheep','villagers'].reduce((n,key)=>n+world[key].length,0)
          && __previewArt.objects.every(object=>world.isObjectActive(object.sourceId))
          && world.buildings.every(building=>__previewArt.objects.some(object=>object.x===building.x&&object.y===building.y));})()`),true,'Scenery retains its map identity after chapter changes.');
      if(width===1440)await screenshot('chapter-'+chapter+'-fortress');
      for(const id of active[chapter-1]) {
        await visit(id);await nextFrame();
        state=await snapshot();
        const expected=await evaluate(`(()=>{const {world,session}=__previewRuntime,c=PenjagaMapPreview.snapshot().camera,h=session.hero;
          return {x:Math.max(0,Math.min(world.width-c.width,h.x-c.width/2)),y:Math.max(0,Math.min(world.height-c.height,h.y-c.height/2))};})()`);
        assert.ok(Math.abs(state.camera.x-expected.x)<.001);
        assert.ok(Math.abs(state.camera.y-expected.y)<.001);
        assert.equal(await evaluate('__previewRuntime.world.isWalkable(__previewRuntime.session.hero.x,__previewRuntime.session.hero.y)'),true);
        if(width===1440&&chapter===3&&id!=='island-main')await screenshot('chapter-3-'+id);
      }
    }

    // Mouse clicks and a stationary pointer both reproject through the moving camera.
    await evaluate('document.getElementById("resetPosition").click()');await nextFrame();
    const point=await evaluate(`(()=>{const {world,session}=__previewRuntime,h=session.hero,c=PenjagaMapPreview.snapshot().camera,r=document.getElementById('previewCanvas').getBoundingClientRect();
      for(const dx of [75,-75,50,-50])if(world.isWalkable(h.x+dx,h.y))return {x:r.left+(h.x+dx-c.x)*r.width/c.width,y:r.top+(h.y-c.y)*r.height/c.height,wx:h.x+dx,wy:h.y};})()`);
    await page('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
    await page('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y});
    await page('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y});
    let state=await snapshot();
    assert.ok(Math.hypot(state.target.x-point.wx,state.target.y-point.wy)<.01);
    await waitFor('PenjagaMapPreview.snapshot().target===null','Click movement reaches target');
    state=await snapshot();
    assert.ok(Math.hypot(state.hero.x-point.wx,state.hero.y-point.wy)<5.5);
    const rect=await evaluate('(()=>{const r=document.getElementById("previewCanvas").getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};})()');
    assert.ok(Math.abs(state.pointerWorld.x-(state.camera.x+(point.x-rect.left)*state.camera.width/rect.width))<.01);
    assert.ok(Math.abs(state.pointerWorld.y-(state.camera.y+(point.y-rect.top)*state.camera.height/rect.height))<.01);
    // Real keyboard input moves the player, with the camera following Y as well as X.
    const before=state.hero.y;
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS'});await delay(180);
    await page('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS'});await nextFrame();
    assert.ok((await snapshot()).hero.y>before+8);

    const traversal=await evaluate(`(()=>{
      const {world,session,navigation}=__previewRuntime,hero=session.hero,results=[];
      for(const region of world.regions.filter(r=>r.kind==='bridge')) {
        for(const direction of [1,-1]) {
          const points=region.centerline.map(p=>Array.isArray(p)?{x:p[0],y:p[1]}:{...p});
          if(direction<0)points.reverse();
          Object.assign(hero,points[0]);let frames=0;
          for(const target of points.slice(1)) {
            for(let i=0;Math.hypot(hero.x-target.x,hero.y-target.y)>5&&i<1500;i++) {
              navigation.steerMove(hero,target,1/60,185);frames++;
              if(!world.isWalkable(hero.x,hero.y))throw Error('Left valid floor: '+region.id);
            }
            if(Math.hypot(hero.x-target.x,hero.y-target.y)>5)throw Error('Stuck on '+region.id);
          }
          results.push({id:region.id,direction,frames});
        }
      }
      const water={x:40,y:40};
      if(navigation.positionFits(water.x,water.y,hero))throw Error('Water accepts movement');
      const obstacle=world.activeObstacles[0];
      if(navigation.positionFits(obstacle.x,obstacle.y))throw Error('Obstacle accepts movement');
      for(const [x,y] of [[0,0],[world.width,world.height]]) {
        const camera=new PenjagaModules.Camera2D(world.width,world.height);camera.resize(1000,700);camera.follow({x,y});
        if(camera.x<0||camera.y<0||camera.x>world.width-camera.width||camera.y>world.height-camera.height)throw Error('Camera outside world');
      }
      return results;
    })()`);
    assert.equal(traversal.length,4);
    // Closing a region must reset actor and cached route safely, and visibly darken it.
    await visit('island-southwest');
    await activate('[data-chapter="chapter-1"]',false);await nextFrame();
    assert.equal((await snapshot()).chapterId,'chapter-1');
    assert.equal(await evaluate('__previewRuntime.world.isWalkable(448,1472)'),false);
    assert.equal(await evaluate('__previewRuntime.navigation.routeTo(__previewRuntime.session.hero,{x:448,y:1472}).length'),0);
    console.log('PASS '+width+'x'+height+' DPR '+dpr+': three chapters, safe positions, locks, scale, camera, input, culling, collision; bridge traversals '+JSON.stringify(traversal));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  await call('Browser.close');
} finally {
  socket?.close();chrome.kill();
  const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-map-preview-')) {
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
