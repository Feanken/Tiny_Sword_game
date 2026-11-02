// Dependency-free Chromium smoke test over the DevTools protocol.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = process.cwd();
process.env.PORT = '4175';
const { server } = await import('../server.mjs');
const profile = path.join(root, 'game-preview', `chrome-test-${process.pid}`);
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(r => setTimeout(r, ms));
let socket;
try {
  const activePortFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !fs.existsSync(activePortFile); i++) await delay(100);
  const [port, socketPath] = fs.readFileSync(activePortFile, 'utf8').trim().split('\n');
  socket = new WebSocket(`ws://127.0.0.1:${port}${socketPath.trim()}`);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0; const pending = new Map(), errors = [], missing = [];
  socket.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } }
    if(m.method==='Fetch.requestPaused') {
      const source=fs.readFileSync('game.js','utf8').replace('  // Read-only state for meaningful smoke tests', `
  window.__stress = (runSteps=360) => {
    startGame();phase='prepare';waveTimer=999;gold=10000;
    for(let i=0;i<7;i++)recruitUnit();waveIndex=4;
    for(let i=0;i<20;i++)spawnEnemy();
    hero.hp=hero.maxHp=100000;castle.hp=100000;allies.forEach(u=>{u.hp=u.maxHp=100000;});
    enemies.forEach((u,i)=>{u.x=420+i%5*35;u.y=345+Math.floor(i/5)*35;u.entering=false;u.hp=u.maxHp=100000;});
    for(let i=0;i<140;i++)addEffect('Particle FX/Dust_01.png',500,400,40);
    const effectCap=effects.length, samples=[];keys.add(' ');
    for(let i=0;i<runSteps;i++){const before=performance.now();update(1/60);samples.push(performance.now()-before);}
    keys.clear();samples.sort((a,b)=>a-b);
    const result={units:enemies.length+allies.length,steps:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),effectCap,effects:effects.length,impacts:impacts.length,fields:routeFields.size};
    if(runSteps>0)startGame();return result;
  };
  // Read-only state for meaningful smoke tests`);
      page('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript; charset=utf-8'}],body:Buffer.from(source).toString('base64')}).catch(error=>errors.push(error.message));
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) missing.push(m.params.response.url);
  };
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params = {}) => call(method, params, sessionId);
  const evaluate = async expression => { const r = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  await Promise.all([page('Page.enable'), page('Runtime.enable'), page('Network.enable')]);
  await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if(process.argv.includes('--stress'))await page('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:4175/game.js',requestStage:'Request'}]});
  await page('Page.navigate', { url: 'http://127.0.0.1:4175' });
  for (let i = 0; i < 200; i++) { if (await evaluate('window.PenjagaPulau?.snapshot().state === "ready"')) break; await delay(100); }
  if (!(await evaluate('Boolean(window.PenjagaPulau)'))) throw new Error('Game failed to initialize: ' + JSON.stringify({ errors, missing }));
  const snapshot = () => evaluate('PenjagaPulau.snapshot()');
  assert.equal((await snapshot()).state, 'ready');
  assert.equal((await snapshot()).assetCount, 410);
  async function screenshot(name) { const r = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); try { fs.writeFileSync(path.join(root, 'game-preview', name), Buffer.from(r.data, 'base64')); } catch { fs.writeFileSync(path.join(root,'game-preview',name.replace('.png','-run'+process.pid+'.png')),Buffer.from(r.data,'base64')); } }
  if(!process.argv.includes('--benchmark-only')) {
  await screenshot('desktop-start.png');
  assert.ok(await evaluate('document.querySelector(".command-bar").getBoundingClientRect().bottom <= innerHeight'), 'commands fit on a laptop screen');
  await evaluate('document.getElementById("startButton").click()');
  assert.equal((await snapshot()).state, 'playing');
  assert.equal((await snapshot()).allies.length, 1);
  assert.ok(await evaluate('document.getElementById("wavePanel").getBoundingClientRect().bottom <= document.getElementById("arena").getBoundingClientRect().top'), 'wave status stays above the battlefield');
  assert.ok(await evaluate('document.querySelector(".command-bar").getBoundingClientRect().bottom <= innerHeight'), 'playing layout fits laptop screen');
  const before = await snapshot();
  await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA' }); await delay(350); await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA' });
  assert.ok((await snapshot()).hero.x < before.hero.x - 25, 'movement changes world position');
  await evaluate('document.getElementById("recruitButton").click()');
  assert.equal((await snapshot()).allies.length, 2);
  assert.ok((await snapshot()).gold < before.gold);
  await evaluate('document.getElementById("pauseButton").click()');
  assert.equal((await snapshot()).state, 'paused');
  const paused = (await snapshot()).waveTimer; await delay(300); assert.equal((await snapshot()).waveTimer, paused);
  await evaluate('document.getElementById("resumeButton").click()'); assert.equal((await snapshot()).state, 'playing');
  await evaluate('document.getElementById("helpButton").click()'); assert.equal((await snapshot()).state, 'paused');
  await evaluate('document.getElementById("helpDialog").close()'); await delay(50); assert.equal((await snapshot()).state, 'playing');
  await evaluate('document.getElementById("galleryButton").click()');
  assert.equal(await evaluate('document.querySelectorAll(".gallery-card").length'), 410);
  await evaluate('document.getElementById("gallerySearch").value="Rubber";document.getElementById("gallerySearch").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelectorAll(".gallery-card").length'), 1);
  await evaluate('document.getElementById("gallerySearch").value="";document.getElementById("galleryCategory").value="Buildings";document.getElementById("galleryCategory").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelectorAll(".gallery-card").length'), 40);
  await evaluate('document.getElementById("galleryDialog").close()'); await delay(80);
  await screenshot('desktop-playing.png');
  // Walk to the mine and use E through the same input path as a player.
  for(let i=0;i<24;i++) {
    const position=(await snapshot()).hero, dx=610-position.x, dy=501-position.y;
    if(Math.hypot(dx,dy)<12)break;
    const active=[...(Math.abs(dx)>8?[dx>0?'d':'a']:[]),...(Math.abs(dy)>8?[dy>0?'s':'w']:[])];
    for(const key of active)await page('Input.dispatchKeyEvent',{type:'keyDown',key});
    await delay(90);
    for(const key of active)await page('Input.dispatchKeyEvent',{type:'keyUp',key});
  }
  const goldBeforeWork=(await snapshot()).gold;
  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'e'});await delay(280);
  assert.equal((await snapshot()).work?.type,'gold','E starts the visible pickaxe animation');
  await screenshot('mining-animation.png');
  await page('Input.dispatchKeyEvent',{type:'keyUp',key:'e'});await delay(800);
  assert.ok((await snapshot()).gold>=goldBeforeWork+10,'resource arrives after the animated action');
  console.log('Mining animation, progress, delayed resource reward: passed');
  // Exercise a real wave, not just the opening screen.
  console.log('Desktop controls, economy, pause/resume, guide, and gallery: passed');
  for (let i = 0; i < 120 && (await snapshot()).phase !== 'battle'; i++) await delay(200);
  await delay(2200); const battle = await snapshot(); assert.equal(battle.phase, 'battle'); assert.ok(battle.enemies.length > 0);
  await screenshot('desktop-battle.png');
  console.log('Wave spawning:', battle.enemies.map(e => e.kind).join(', '));
  assert.ok(battle.enemies.every(e => e.x < 350 && e.y > 340 && e.y < 465), 'initial group comes from the western road');
  // Approach a real enemy with normal keys, take a hit, then return it.
  let held = new Set();
  async function hold(next) {
    const desired = new Set(next);
    for (const key of held) if (!desired.has(key)) await page('Input.dispatchKeyEvent', { type: 'keyUp', key });
    for (const key of desired) if (!held.has(key)) await page('Input.dispatchKeyEvent', { type: 'keyDown', key });
    held = desired;
  }
  for (let i = 0; i < 42; i++) {
    const s = await snapshot(), target = [...s.enemies].sort((a,b) => Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y))[0];
    if (!target || Math.hypot(target.x-s.hero.x,target.y-s.hero.y) < 35) break;
    const dx = target.x-s.hero.x, dy = target.y-s.hero.y;
    await hold([...(Math.abs(dx)>10?[dx>0?'d':'a']:[]),...(Math.abs(dy)>10?[dy>0?'s':'w']:[])]); await delay(110);
  }
  await hold([]);
  for (let i = 0; i < 90 && !(await snapshot()).damageTaken; i++) await delay(30);
  const gotHit = await snapshot(); assert.ok(gotHit.damageTaken > 0, 'enemy wind-up deals damage to the player');
  assert.ok(gotHit.hero.hitFlash > 0 || gotHit.impacts > 0, 'received damage has visible feedback');
  await screenshot('desktop-hit-received.png');
  const damageBefore = gotHit.damageDealt; await hold([' ']);
  for (let i = 0; i < 75 && (await snapshot()).damageDealt <= damageBefore; i++) await delay(30);
  const dealtHit = await snapshot(); assert.ok(dealtHit.damageDealt > damageBefore, 'space attack hits real enemies'); assert.ok(dealtHit.impacts > 0, 'dealt damage emits impact sparks');
  await screenshot('desktop-hit-dealt.png'); await hold([]);
  console.log('Real combat in browser: received hit, white flash, impact sparks, and player strike damage passed');
  await page('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false }); await delay(100);
  assert.ok(await evaluate('document.querySelector(".command-bar").getBoundingClientRect().bottom <= innerHeight'), 'all controls fit a 1366x768 laptop');
  await evaluate('document.getElementById("gameShell").requestFullscreen()'); await delay(100);
  assert.ok(await evaluate('document.querySelector(".command-bar").getBoundingClientRect().bottom <= innerHeight'), 'fullscreen keeps action controls visible');
  await screenshot('fullscreen-battle.png'); await evaluate('document.exitFullscreen()');
  if(process.argv.includes('--stress')) {
    const stress=await evaluate('window.__stress()');
    assert.equal(stress.units,28);assert.equal(stress.effectCap,80);assert.ok(stress.effects<=80&&stress.impacts<=60&&stress.fields<=32);
    assert.ok(stress.meanMs<10&&stress.p95Ms<20,'crowded simulation stays within test CPU budget');
    fs.writeFileSync(path.join(root,'game-preview','performance.json'),JSON.stringify(stress,null,2));
    console.log('28-unit stress benchmark:',JSON.stringify(stress));
  }
  await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page('Emulation.setTouchEmulationEnabled', { enabled: true });
  await evaluate('document.getElementById("restartPauseButton").click()'); await delay(200);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'mobile layout fits viewport');
  assert.equal(await evaluate('document.getElementById("mobileControls").hidden'), false);
  await screenshot('mobile-playing.png');
  const touch = await evaluate('(()=>{const r=document.querySelector("[data-move=left]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const touchBefore = (await snapshot()).hero.x;
  await page('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touch, radiusX: 2, radiusY: 2 }] }); await delay(300); await page('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await snapshot()).hero.x < touchBefore - 15, 'touch direction pad moves the hero');
  await evaluate('document.getElementById("pauseButton").click();document.getElementById("endScreen").hidden=false;document.getElementById("resultDescription").textContent="Lima gelombang berlalu. Rumah ini masih milik kita."');
  assert.ok(await evaluate('(()=>{const panel=document.querySelector(".result-panel").getBoundingClientRect(),arena=document.getElementById("arena").getBoundingClientRect();return panel.top>=arena.top&&panel.bottom<=arena.bottom})()'), 'mobile result panel stays inside the arena');
  await evaluate('document.querySelector(".result-panel").scrollTop=9999');
  await screenshot('mobile-result.png');
  await page('Page.navigate', { url: 'file:///' + root.replaceAll('\\', '/') + '/index.html' });
  for (let i = 0; i < 150; i++) { if (await evaluate('window.PenjagaPulau?.snapshot().state === "ready"')) break; await delay(100); }
  assert.equal((await snapshot()).state, 'ready', 'double-click/file mode loads all game assets');
  assert.deepEqual(errors, [], 'browser has no runtime exceptions'); assert.deepEqual(missing, [], 'no missing assets');
  console.log('Mobile layout + touch controls, direct file launch, zero missing assets/runtime exceptions: passed');
  } else {
    const stress=await evaluate('window.__stress()');
    assert.equal(stress.units,28);assert.ok(stress.meanMs<10&&stress.p95Ms<20);
    await evaluate('window.__stress(0)');
    stress.render=await evaluate(`new Promise(resolve=>{
      const samples=[];let start=performance.now(),last=start;
      function sample(now){if(now-start>250)samples.push(now-last);last=now;
        if(now-start<4250)requestAnimationFrame(sample);
        else {samples.sort((a,b)=>a-b);resolve({frames:samples.length,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1)});}
      }requestAnimationFrame(sample);
    })`);
    stress.activeUnits=(await snapshot()).enemies.length+(await snapshot()).allies.length;
    assert.equal(stress.activeUnits,28);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(root,'game-preview','performance.json'),JSON.stringify(stress,null,2));
    console.log('CPU + rendered-frame benchmark:',JSON.stringify(stress));
  }
  await call('Browser.close');
} finally {
  socket?.close(); chrome.kill(); server.close();
  // Delete only the isolated test profile created inside this workspace.
  const resolvedProfile = path.resolve(profile);
  if (resolvedProfile.startsWith(path.resolve(root, 'game-preview') + path.sep)) {
    await delay(250);
    try { fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 }); } catch { console.log('Temporary Chrome profile could not be removed:', path.basename(resolvedProfile)); }
  }
}
