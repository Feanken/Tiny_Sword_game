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
  window.__bossPreview=(stage='warning',pattern=0)=>{startGame();waveIndex=4;phase='battle';spawned=20;enemies=[];allies=[];spawnBoss();Object.assign(boss,{x:540,y:410,entering:false,abilityCooldown:0,pattern,patternMask:7^(1<<pattern)});hero.x=680;hero.y=410;updateBoss(boss,1/60);boss.bossAction.stage=stage;boss.bossAction.time=stage==='warning'?boss.bossAction.duration*.5:.5;boss.bossAction.recoveryDuration=.95;announcementTimer=0;$('announcement').classList.remove('show');state='paused';updateUI();return bossPose(boss).path;};
  window.__audioProbe=async()=>{initAudio();await audioLoading;soundOn=true;audioMaster.gain.value=.8;lastCombatCue.clear();for(const name of Object.keys(combatSamples))combatCue(name);for(let i=0;i<20;i++)tone(220,.1);return activeVoices;};
  window.__audioVoices=()=>activeVoices;
  window.__resultPreview=()=>{startGame(77);waveIndex=4;phase='battle';finish(true);};
  window.__ragePreview=()=>{window.__bossPreview();boss.bossAction=null;boss.hp=boss.maxHp*.49;updateBoss(boss,1/60);updateUI();return {stage:boss.bossAction.stage,intent:$('bossIntent').textContent};};
  window.__audioDetails=async()=>{initAudio();await audioLoading;return {decoded:sampleBuffers.size,failed:audioFailures,maxDuration:Math.max(...[...sampleBuffers.values()].map(b=>b.duration)),fx:effectsBus.gain.value,music:musicBus.gain.value,master:audioMaster.gain.value,clips:[...sampleBuffers].map(([name,b])=>{let peak=0,energy=0;const channel=b.getChannelData(0);for(const v of channel){peak=Math.max(peak,Math.abs(v));energy+=v*v;}return{name,duration:b.duration,peak,rms:Math.sqrt(energy/channel.length)};})};};
  window.__chargePreview=()=>{startGame();waveIndex=4;phase='battle';spawned=20;enemies=[];allies=[];spawnBoss();Object.assign(boss,{x:730,y:250,entering:false,abilityCooldown:0,patternMask:5});hero.x=940;hero.y=250;updateBoss(boss,1/60);announcementTimer=0;$('announcement').classList.remove('show');state='paused';updateUI();return boss.bossAction.chargeEnd;};
  let stressPatterns=new Set(),stressResolved=new Set();
  const originalUpdateBoss=updateBoss;
  updateBoss=(u,dt)=>{const action=u.bossAction,stage=action?.stage;originalUpdateBoss(u,dt);if(u.bossAction?.stage==='warning')stressPatterns.add(u.bossAction.type);if(stage==='warning'&&action.stage!=='warning')stressResolved.add(action.type);};
  window.__stressState=()=>({units:enemies.length+allies.length,difficulty,bossEnraged:boss.enraged,bossPatterns:[...stressPatterns],bossResolved:[...stressResolved],effects:effects.length,impacts:impacts.length,fields:routeFields.size,approachTargets:approachSlots.size,combat:{...combatStats,damageBySource:{...combatStats.damageBySource}}});
  window.__combatTap=(reset=false)=>{if(reset){startGame();hero.cooldown=.1;}return {attack:hero.attack,queued:hero.attackBuffer};};
  window.__stress = (runSteps=900) => {
    showTitle();setDifficulty('hard');startGame();phase='battle';gold=10000;
    for(let i=0;i<7;i++)recruitUnit();waveIndex=4;
    for(let i=0;i<20;i++)spawnEnemy();
    hero.hp=hero.maxHp=100000;castle.hp=100000;allies.forEach(u=>{u.hp=u.maxHp=100000;});
    enemies.forEach((u,i)=>{u.x=420+i%5*35;u.y=345+Math.floor(i/5)*35;u.entering=false;u.hp=u.maxHp=100000;});
    spawnBoss();Object.assign(boss,{x:610,y:410,entering:false,abilityCooldown:.15,hp:45000,maxHp:100000});hero.x=740;hero.y=410;
    stressPatterns.clear();stressResolved.clear();
    for(let i=0;i<140;i++)addEffect('Particle FX/Dust_01.png',500,400,40);
    const effectCap=effects.length, samples=[];keys.add(' ');
    for(let i=0;i<runSteps;i++){const before=performance.now();update(1/60);samples.push(performance.now()-before);}
    keys.clear();samples.sort((a,b)=>a-b);
    const result={...window.__stressState(),steps:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),effectCap};
    if(runSteps>0){showTitle();setDifficulty('normal');startGame();}return result;
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
  if(process.argv.includes('--replay-only')) {
    await evaluate('window.__resultPreview()');const original=await snapshot();assert.equal(original.runSeed,77);
    await evaluate('document.getElementById("restartButton").click()');assert.equal((await snapshot()).state,'playing');assert.equal((await snapshot()).runSeed,77);assert.deepEqual((await snapshot()).encounters,original.encounters);
    await evaluate('window.__resultPreview();document.getElementById("newRunButton").click()');assert.notEqual((await snapshot()).runSeed,77);
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('window.__resultPreview()');await delay(100);await screenshot('expedition-result-mobile.png');
    assert.ok(await evaluate('(()=>{const r=document.querySelector(".result-panel").getBoundingClientRect(),a=document.getElementById("arena").getBoundingClientRect();return r.top>=a.top&&r.bottom<=a.bottom})()'));
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Retry preserves expedition, new expedition changes seed, mobile result actions fit: passed');
  } else if(process.argv.includes('--audio-only')) {
    await evaluate('document.getElementById("startButton").click();document.getElementById("audioSettingsButton").click()');assert.equal((await snapshot()).state,'paused');
    const details=await evaluate('window.__audioDetails()');assert.equal(details.decoded,17);assert.equal(details.failed,0);assert.ok(details.clips.every(c=>c.duration>0&&c.rms>.001&&c.peak<1.1));
    await evaluate('document.getElementById("effectsVolume").value="40";document.getElementById("effectsVolume").dispatchEvent(new Event("input"));document.getElementById("musicVolume").value="15";document.getElementById("musicVolume").dispatchEvent(new Event("input"))');await delay(120);
    const levels=await evaluate('window.__audioDetails()');assert.ok(Math.abs(levels.fx-.4)<.01&&Math.abs(levels.music-.15)<.01);
    await evaluate('document.getElementById("audioDialog").close();document.getElementById("soundButton").click()');await delay(60);assert.equal((await snapshot()).state,'playing');assert.equal((await snapshot()).audio.enabled,true);
    assert.equal(await evaluate('window.__audioProbe()'),12);await delay(Math.ceil(details.maxDuration*1000)+200);assert.equal(await evaluate('window.__audioVoices()'),0);
    await evaluate('document.getElementById("soundButton").click()');await delay(120);assert.equal((await snapshot()).audio.enabled,false);assert.ok((await evaluate('window.__audioDetails()')).master<.01);
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('document.getElementById("audioSettingsButton").click()');await delay(100);await screenshot('audio-mobile.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await page('Page.navigate',{url:'file:///'+root.replaceAll('\\','/')+'/index.html'});for(let i=0;i<150;i++){if(await evaluate('window.PenjagaPulau?.snapshot().state==="ready"'))break;await delay(100);}
    await evaluate('document.getElementById("soundButton").click()');for(let i=0;i<100&&(await snapshot()).audio.decoded<17;i++)await delay(40);assert.equal((await snapshot()).audio.decoded,17,'samples decode offline through file://');
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('17 downloaded effects decoded online/offline, independent volumes, mute, voice cap/release and mobile audio dialog: passed');
  } else if(process.argv.includes('--combat-only')) {
    await evaluate('window.__combatTap(true)');
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:' '});await page('Input.dispatchKeyEvent',{type:'keyUp',key:' '});await delay(180);
    assert.ok((await evaluate('window.__combatTap()')).attack>0,'released keyboard tap is buffered');
    await evaluate('window.__combatTap(true)');
    const point=await evaluate('(()=>{const r=document.getElementById("gameCanvas").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await page('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await page('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await delay(180);
    assert.ok((await evaluate('window.__combatTap()')).attack>0,'released mouse tap is buffered');
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await page('Emulation.setTouchEmulationEnabled',{enabled:true});
    await evaluate('window.__combatTap(true)');
    const touch=await evaluate('(()=>{const r=document.getElementById("touchAttack").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(180);
    assert.ok((await evaluate('window.__combatTap()')).attack>0,'released touch tap is buffered');assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    console.log('Real keyboard, mouse and touch quick taps during attack cooldown: passed');
  } else if(process.argv.includes('--preview-only')) {
    const chargeEnd=await evaluate('window.__chargePreview()');assert.equal(chargeEnd.distance,50);await delay(100);await screenshot('leader-charge-clipped.png');
    await evaluate('window.__bossPreview()');await delay(100);await screenshot('leader-final.png');
    const poses=[];
    for(let pattern=0;pattern<3;pattern++){poses.push(await evaluate('window.__bossPreview("warning",'+pattern+')'));await delay(80);await screenshot(['leader-slam-pose.png','leader-charge-pose.png','leader-volley-pose.png'][pattern]);}
    assert.equal(new Set(poses).size,3,'all leader warning poses differ');
    const rage=await evaluate('window.__ragePreview()');assert.equal(rage.stage,'rally');assert.ok(rage.intent.includes('MENGAMUK'));await delay(100);await screenshot('leader-rage-transition.png');
    assert.equal(await evaluate('window.__audioProbe()'),12,'cues respect the voice budget');const audioInfo=await evaluate('window.__audioDetails()');await delay(Math.ceil(audioInfo.maxDuration*1000)+200);assert.equal(await evaluate('window.__audioVoices()'),0,'audio nodes release after cues');
    await evaluate('window.__bossPreview("recovery")');assert.ok(await evaluate('document.getElementById("bossIntent").textContent.includes("+30%")'));
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);await screenshot('leader-mobile-recovery.png');
    assert.ok(await evaluate('(()=>{const r=document.getElementById("bossBar").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=document.getElementById("arena").getBoundingClientRect().bottom})()'),'mobile leader status fits arena');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    console.log('Clipped 50px charge warning and mobile recovery HUD: passed');
  } else if(!process.argv.includes('--benchmark-only')) {
  await screenshot('desktop-start.png');
  await evaluate('document.querySelector("[data-difficulty=hard]").click()');assert.equal((await snapshot()).difficulty,'hard');
  await evaluate('document.querySelector("[data-difficulty=easy]").click()');assert.equal((await snapshot()).difficulty,'easy');
  await evaluate('document.querySelector("[data-difficulty=normal]").click()');

  assert.ok(await evaluate('document.querySelector(".command-bar").getBoundingClientRect().bottom <= innerHeight'), 'commands fit on a laptop screen');
  await evaluate('document.getElementById("startButton").click()');
  assert.equal((await snapshot()).state, 'playing');
  assert.equal((await snapshot()).allies.length, 1);
  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'g'});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'g'});assert.equal((await snapshot()).squadOrder,'guard');
  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'f'});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'f'});assert.equal((await snapshot()).squadOrder,'follow');
  await evaluate('document.querySelector("[data-difficulty=hard]").click()');assert.equal((await snapshot()).difficulty,'normal');

  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'u'});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'u'});
  assert.equal((await snapshot()).state,'paused');assert.equal(await evaluate('document.querySelectorAll(".perk-card").length'),6);
  const campTimer=(await snapshot()).waveTimer;await delay(150);assert.equal((await snapshot()).waveTimer,campTimer);
  await screenshot('camp-desktop.png');
  await evaluate('document.querySelector("[data-perk=wind]").click()');assert.equal((await snapshot()).upgrades.wind,1);assert.equal((await snapshot()).gold,45);
  assert.ok(await evaluate('[...document.querySelectorAll(".perk-card")].every(b=>b.disabled)'),'second purchase is locked');
  await evaluate('document.getElementById("campDialog").close()');await delay(40);
  const dashOrigin=(await snapshot()).hero.x;
  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'d'});await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Shift',code:'ShiftLeft'});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft'});await delay(80);
  assert.ok((await snapshot()).dash.active>0);await screenshot('dash-desktop.png');await delay(140);await page('Input.dispatchKeyEvent',{type:'keyUp',key:'d'});
  assert.ok((await snapshot()).hero.x>dashOrigin+70);assert.ok((await snapshot()).dash.cooldown>0);

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
    await evaluate('window.__bossPreview()');assert.equal((await snapshot()).boss.action.type,'slam');assert.equal(await evaluate('document.getElementById("bossBar").hidden'),false);await delay(100);await screenshot('leader-final.png');
    const chargeEnd=await evaluate('window.__chargePreview()');assert.ok(chargeEnd.distance<252);await delay(100);await screenshot('leader-charge-clipped.png');
    const stress=await evaluate('window.__stress()');
    assert.equal(stress.units,29);assert.equal(stress.bossEnraged,true);assert.deepEqual([...stress.bossResolved].sort(),['charge','slam','volley']);assert.equal(stress.effectCap,80);assert.ok(stress.effects<=80&&stress.impacts<=60&&stress.fields<=32);
    assert.ok(stress.meanMs<10&&stress.p95Ms<20,'crowded simulation stays within test CPU budget');
    fs.writeFileSync(path.join(root,'game-preview','performance-simulation.json'),JSON.stringify(stress,null,2));
    console.log('29-unit stress benchmark with enraged leader:',JSON.stringify(stress));
  }
  await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page('Emulation.setTouchEmulationEnabled', { enabled: true });
  await evaluate('document.getElementById("restartPauseButton").click()'); await delay(200);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'mobile layout fits viewport');
  assert.equal(await evaluate('document.getElementById("mobileControls").hidden'), false);
  await screenshot('mobile-playing.png');
  await evaluate('document.getElementById("campButton").click()');await delay(60);await screenshot('camp-mobile.png');
  assert.ok(await evaluate('document.getElementById("campDialog").getBoundingClientRect().width<=innerWidth'));
  await evaluate('document.getElementById("campDialog").close()');await delay(50);

  const touch = await evaluate('(()=>{const r=document.querySelector("[data-move=left]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const touchBefore = (await snapshot()).hero.x;
  await page('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touch, radiusX: 2, radiusY: 2 }] }); await delay(300); await page('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await snapshot()).hero.x < touchBefore - 15, 'touch direction pad moves the hero');
  const dashTouch=await evaluate('(()=>{const r=document.getElementById("touchDash").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...dashTouch,radiusX:2,radiusY:2}]});await page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(60);
  assert.ok((await snapshot()).dash.active>0,'touch dash starts the same dodge action');await delay(180);

  await evaluate('document.getElementById("pauseButton").click();document.getElementById("endScreen").hidden=false;document.getElementById("resultDescription").textContent="Lima gelombang berlalu. Rumah ini masih milik kita."');
  assert.ok(await evaluate('(()=>{const panel=document.querySelector(".result-panel").getBoundingClientRect(),arena=document.getElementById("arena").getBoundingClientRect();return panel.top>=arena.top&&panel.bottom<=arena.bottom})()'), 'mobile result panel stays inside the arena');
  await evaluate('document.querySelector(".result-panel").scrollTop=9999');
  await screenshot('mobile-result.png');
  await page('Page.navigate', { url: 'file:///' + root.replaceAll('\\', '/') + '/index.html' });
  for (let i = 0; i < 150; i++) { if (await evaluate('window.PenjagaPulau?.snapshot().state === "ready"')) break; await delay(100); }
  assert.equal((await snapshot()).state, 'ready', 'double-click/file mode loads all game assets');
  await screenshot('mobile-start.png');
  assert.ok(await evaluate('(()=>{const b=document.getElementById("startButton").getBoundingClientRect(),a=document.getElementById("arena").getBoundingClientRect();return b.top>=a.top&&b.bottom<=a.bottom})()'),'mobile start and difficulty choices fit the intro');

  assert.deepEqual(errors, [], 'browser has no runtime exceptions'); assert.deepEqual(missing, [], 'no missing assets');
  console.log('Mobile layout + touch controls, direct file launch, zero missing assets/runtime exceptions: passed');
  } else {
    await evaluate('document.getElementById("soundButton").click()');const sound=await evaluate('window.__audioDetails()');assert.equal(sound.decoded,17);assert.equal(sound.failed,0);
    const stress=await evaluate('window.__stress()');
    assert.equal(stress.units,29);assert.ok(stress.meanMs<10&&stress.p95Ms<20);assert.ok(stress.approachTargets<=30);assert.ok(stress.combat.hits<=stress.combat.swings*3);assert.deepEqual([...stress.bossResolved].sort(),['charge','slam','volley']);
    await evaluate('window.__stress(0)');
    stress.render=await evaluate(`new Promise(resolve=>{
      const samples=[];let start=performance.now(),last=start;
      function sample(now){if(now-start>250)samples.push(now-last);last=now;
        if(now-start<15250)requestAnimationFrame(sample);
        else {samples.sort((a,b)=>a-b);resolve({frames:samples.length,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1)});}
      }requestAnimationFrame(sample);
    })`);
    stress.live=await evaluate('window.__stressState()');
    stress.audio=(await snapshot()).audio;assert.equal(stress.audio.enabled,true);assert.equal(stress.audio.decoded,17);assert.ok(stress.audio.voices<=12);
    assert.equal(stress.live.units,29);assert.equal(stress.live.bossEnraged,true);assert.deepEqual([...stress.live.bossResolved].sort(),['charge','slam','volley']);assert.ok(stress.live.effects<=80&&stress.live.impacts<=60&&stress.live.fields<=32&&stress.live.approachTargets<=30);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
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
