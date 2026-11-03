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
  window.__combatReadability=(scene='crowd',age=.22)=>{
    startGame(77);waveIndex=4;phase='battle';spawned=20;allies=[];enemies=[];gold=10000;hero.x=600;hero.y=410;
    for(let i=0;i<8;i++){spawnEnemy();Object.assign(enemies.at(-1),{kind:i<6?'Warrior':'Archer',x:i<6?550+i%3*46:480+(i-6)*260,y:i<6?380+Math.floor(i/3)*68:410,entering:false,cooldown:999,speed:0,hp:200,maxHp:200});}
    for(let i=0;i<6;i++){recruitUnit();Object.assign(allies.at(-1),{x:565+i%3*44,y:398+Math.floor(i/3)*48});}
    for(const u of enemies)hurt(u,6,allies[0]);
    enemies.forEach((u,i)=>{u.hitFlash=0;u.stagger=0;u.strike={target:hero,timer:i<6?.12:.2};u.attack=u.attackDuration=i<6?.4:.72;});
    if(scene==='forest'){hero.x=200;hero.y=280;}
    else if(scene==='edge'){hero.x=620;hero.y=104;}
    else if(scene==='roof'){hero.x=845;hero.y=175;}
    else if(scene==='counter'){startDash();hurt(hero,10,enemies[0]);hero.dash=0;}
    heroAttack();hero.attack=HERO_ATTACK.duration-age;updateHeroSwing(age);
    if(scene==='hurt')hurt(hero,12,enemies[0]);
    announcementTimer=0;$('announcement').classList.remove('show');state='paused';updateUI();draw();
    const pose=heroPose();return {poseFrame:spriteFrame(pose.path,pose.age,pose.fps,pose.once).x/192,threats:enemies.filter(playerThreat).length,floaters:floaters.length,riposte:hero.riposte,hp:hero.hp};
  };
  window.__renderAudit=()=>{
    const events=[],originalDanger=drawBossDanger,originalUnit=drawUnit,originalMarker=drawHeroMarker;
    drawBossDanger=(overlay=false)=>{events.push(overlay?'danger-outline':'danger-floor');originalDanger(overlay);};
    drawUnit=(...args)=>{events.push('unit');originalUnit(...args);};drawHeroMarker=()=>{events.push('player-marker');originalMarker();};
    try{draw();}finally{drawBossDanger=originalDanger;drawUnit=originalUnit;drawHeroMarker=originalMarker;}return events;
  };
  let renderSamples=null;const measuredDraw=draw;
  draw=()=>{const start=renderSamples?performance.now():0;measuredDraw();if(renderSamples&&renderSamples.length<1100)renderSamples.push(performance.now()-start);};
  window.__renderMeasure=(start=false)=>{if(start){renderSamples=[];return;}const samples=renderSamples.slice().sort((a,b)=>a-b);renderSamples=null;return {frames:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1)};};
  const renderCosts={};
  window.__profileRender=()=>{
    const timed=(name,fn)=>(...args)=>{const start=performance.now();fn(...args);const bucket=renderCosts[name]||(renderCosts[name]={calls:0,ms:0});bucket.calls++;bucket.ms+=performance.now()-start;};
    drawSprite=timed('sprites',drawSprite);drawScenery=timed('scenery',drawScenery);drawUnit=timed('units',drawUnit);
    drawHeroOutline=timed('outline',drawHeroOutline);beginLabelLayout=timed('layout',beginLabelLayout);drawCombatNumbers=timed('numbers',drawCombatNumbers);drawPlayerThreats=timed('threats',drawPlayerThreats);drawHeroMarker=timed('marker',drawHeroMarker);drawBossDanger=timed('danger',drawBossDanger);
    const original=unitFrame;renderCosts.cache={hits:0,misses:0};unitFrame=(path,x,info)=>{renderCosts.cache[unitFrames.has(path+':'+x)?'hits':'misses']++;return original(path,x,info);};
  };
  window.__renderCosts=()=>renderCosts;
  window.__polishMetrics=()=>({labels:labelPool.slice(0,labelCount).map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,kind:r.owner==='hud'?'hud':r.owner===hero?'player':r.owner.team?'threat':'number'})),cssScale,unitFrames:unitFrames.size,unitFrameBytes,whiteFrames:flashFrames.size,outlines:heroOutlines.size,metadata:spriteMetadata.size,keys:[...keys],pointers:pointerBindings.size,attackBuffer:hero.attackBuffer,dashBuffer:hero.dashBuffer,swings:combatStats.swings,attack:hero.attack,pixels:canvas.width*canvas.height});
  window.__verifyFrameCache=()=>{
    let checked=0,different=0,pixels=0;
    for(const path of [blue('Warrior','Attack1'),blue('Lancer','Right_Attack'),unitPath('Black','Warrior','Run'),unitPath('Black','Monk','Heal')]){
      const info=spriteInfo(path),a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=220;a.height=b.height=220;
      const ga=a.getContext('2d',{willReadFrequently:true}),gb=b.getContext('2d',{willReadFrequently:true});ga.imageSmoothingEnabled=gb.imageSmoothingEnabled=false;
      for(let i=0;i<info.count;i++){
        ga.clearRect(0,0,220,220);gb.clearRect(0,0,220,220);const frame=unitFrame(path,i*info.width,info),ratio=136/info.height;
        ga.drawImage(img(path),i*info.width,0,info.width,info.height,40,40,info.width*ratio,136);
        gb.drawImage(frame.image,40+frame.x*ratio,40+frame.y*ratio,frame.image.width*ratio,frame.image.height*ratio);
        const pa=ga.getImageData(0,0,220,220).data,pb=gb.getImageData(0,0,220,220).data;
        for(let p=0;p<pa.length;p+=4){if(pa[p+3]||pb[p+3])pixels++;if(pa[p]!==pb[p]||pa[p+1]!==pb[p+1]||pa[p+2]!==pb[p+2]||pa[p+3]!==pb[p+3])different++;}checked++;
      }
    }
    for(const [path,record] of images)if(path.startsWith('Units/')&&record.loaded){const info=spriteInfo(path);for(let i=0;i<info.count;i++){
      const bounds=window.TINY_UNIT_BOUNDS[path][i];if(!bounds||bounds[0]<0||bounds[1]<0||bounds[0]+bounds[2]>info.width||bounds[1]+bounds[3]>info.height)throw new Error('Invalid frame bounds: '+path);
      unitFrame(path,i*info.width,info);
    }}
    return{checked,different,pixels,frames:unitFrames.size,bytes:unitFrameBytes,accountedBytes:[...unitFrames.values()].reduce((n,f)=>n+f.bytes,0)};
  };
  window.__exportUnitBounds=()=>{
    const result={},scratch=document.createElement('canvas'),g=scratch.getContext('2d',{willReadFrequently:true});
    for(const [path,record] of images){if(!path.startsWith('Units/')||!record.loaded)continue;
      const info=spriteInfo(path),frames=[];scratch.width=info.width;scratch.height=info.height;
      for(let i=0;i<info.count;i++){
        g.clearRect(0,0,info.width,info.height);g.drawImage(record.image,i*info.width,0,info.width,info.height,0,0,info.width,info.height);
        const pixels=g.getImageData(0,0,info.width,info.height).data;let l=info.width,t=info.height,r=0,b=0;
        for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(pixels[(y*info.width+x)*4+3]){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
        frames.push(l>r?[0,0,1,1]:[l,t,r-l+1,b-t+1]);
      }result[path]=frames;
    }return result;
  };
  window.__polishReset=()=>{startGame(77);hero.x=600;hero.y=410;hero.cooldown=.1;announcementTimer=0;$('announcement').classList.remove('show');overlayDirty=true;};
  window.__upgradePreview=()=>{startGame(77);gold=10000;openCamp();};
  window.__directorPreview=(camp=false)=>{
    startGame(47);gold=1000;
    if(camp){openCamp();return {cards:$('campCards').children.length};}
    buyUpgrade('oath');hero.hp=30;healHero();waveIndex=2;startWave();
    for(let i=0;i<9;i++){spawnEnemy();const u=enemies.at(-1);Object.assign(u,{x:300+Math.floor(i/3)*88,y:395+u.lane*24,entering:false});}
    announcementTimer=0;$('announcement').classList.remove('show');state='paused';updateUI();overlayDirty=true;draw();
    return {hp:hero.hp,maxHp:hero.maxHp,title:$('healButton').title,styles:encounters.slice(1,4).map(p=>p.name),groups:encounters[2].groups};
  };
  window.__dashButtonQueue=()=>{window.__polishReset();hero.dashCooldown=.08;updateUI();$('dashButton').click();return hero.dashBuffer;};
  window.__soak=(steps=72000)=>{
    window.__stress(0);hero.hp=hero.maxHp=castle.hp=10000000;for(const u of [...allies,...enemies])u.hp=u.maxHp=10000000;boss.hp=4500000;
    keys.add(' ');let pauses=0;
    for(let i=0;i<steps;i++){
      if(i%180===0)requestDash();update(1/60);
      if(i%3600===3599){const before=elapsed;togglePause(true);advance(1);if(elapsed!==before)throw new Error('Paused clock advanced');togglePause(false);keys.add(' ');pauses++;}
      if(state!=='playing')throw new Error('Soak stopped unexpectedly');
    }
    keys.clear();draw();return {seconds:elapsed,steps,pauses,units:enemies.length+allies.length,effects:effects.length,impacts:impacts.length,floaters:floaters.length,fields:routeFields.size,approachTargets:approachSlots.size,...window.__polishMetrics()};
  };
  window.__stress = (runSteps=900) => {
    showTitle();setDifficulty('hard');startGame(77);phase='battle';gold=10000;
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
  if(process.argv.includes('--upgrade-only')) {
    await evaluate('window.__upgradePreview()');const timer=(await snapshot()).waveTimer;
    await evaluate('document.querySelector("[data-perk=rhythm]").click()');assert.ok(await evaluate('document.activeElement.dataset.perk==="rhythm"'),'focus remains on the purchased card');
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});await page('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});assert.equal((await snapshot()).upgrades.rhythm,2,'keyboard can immediately buy the next rank');
    for(const id of ['blade','rhythm','wind','counter','bastion','oath']){
      while((await snapshot()).upgrades[id]<10)await evaluate('document.querySelector("[data-perk='+id+']").click()');
      assert.ok(await evaluate('document.querySelector("[data-perk='+id+']").disabled'));assert.ok(await evaluate('document.querySelector("[data-perk='+id+']").textContent.includes("TINGKAT 10 / 10")'));
    }
    assert.equal((await snapshot()).gold,2250);assert.equal((await snapshot()).waveTimer,timer);await screenshot('upgrade-ten-desktop.png');
    await evaluate('document.getElementById("campDialog").close()');await delay(60);await evaluate('document.getElementById("campButton").click()');assert.ok(Object.values((await snapshot()).upgrades).every(n=>n===10));
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await delay(100);await screenshot('upgrade-ten-mobile.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.ok(await evaluate('[...document.querySelectorAll(".perk-card")].every(card=>card.scrollWidth<=card.clientWidth+2)'),'ten rank labels fit mobile cards');
    await evaluate('document.getElementById("campDialog").close()');await delay(60);await evaluate('document.getElementById("restartPauseButton").click()');assert.ok(Object.values((await snapshot()).upgrades).every(n=>n===0));
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Repeated purchases through all ten ranks, keyboard focus, exact gold, cap UI, paused time, reopen persistence, mobile layout and reset: passed');
  } else if(process.argv.includes('--director-only')) {
    const result=await evaluate('window.__directorPreview()');assert.equal(result.hp,80);assert.equal(result.maxHp,115);assert.ok(result.title.includes('50'));assert.equal(new Set(result.styles).size,3);await delay(80);await screenshot('director-wave-desktop.png');
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await page('Emulation.setTouchEmulationEnabled',{enabled:true});await evaluate('window.__directorPreview(true)');await delay(80);await screenshot('director-camp-mobile.png');
    assert.ok(await evaluate('(()=>{const card=document.querySelector("[data-perk=oath]"),text=card.querySelector(".perk-description");return text.textContent.includes("+5")&&text.textContent.includes("+2")&&card.scrollHeight<=card.clientHeight+2})()'),'Oath description remains inside the mobile card');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Wave style coverage, Oath health/food tooltip, desktop packet preview and mobile perk description: passed');
  } else if(process.argv.includes('--export-bounds')) {
    const bounds=await evaluate('window.__exportUnitBounds()');
    fs.writeFileSync('unit-frame-bounds.js','/* Generated from original PNG alpha bounds. Regenerate: node game-preview/browser-test.mjs --stress --export-bounds */\nwindow.TINY_UNIT_BOUNDS = '+JSON.stringify(bounds)+';\n');
    console.log('Exported exact alpha bounds for '+Object.keys(bounds).length+' unit sheets.');
  } else if(process.argv.includes('--soak-only')) {
    await page('HeapProfiler.collectGarbage');const before=await page('Runtime.getHeapUsage');
    const result=await evaluate('window.__soak()');await page('HeapProfiler.collectGarbage');const after=await page('Runtime.getHeapUsage');
    result.retainedHeapBefore=before.usedSize;result.retainedHeapAfter=after.usedSize;
    assert.ok(result.seconds>=1199&&result.pauses===20&&result.units===29);assert.ok(result.effects<=80&&result.impacts<=60&&result.floaters<=35&&result.fields<=32&&result.approachTargets<=30&&result.whiteFrames<=32&&result.outlines<=32&&result.metadata<=410);
    assert.ok(after.usedSize-before.usedSize<12*1024*1024,'retained JS heap stays within the soak budget');assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    assert.ok(result.unitFrames<=512&&result.unitFrameBytes<=12*1024*1024);
    result.sourceSha256=(await import('node:crypto')).createHash('sha256').update(fs.readFileSync('game.js')).digest('hex');
    fs.writeFileSync('game-preview/stability-soak.json',JSON.stringify(result,null,2));console.log('20-minute fixed-step soak, 20 pause/resume cycles, bounded effects/caches/heap:',JSON.stringify({seconds:result.seconds,units:result.units,floaters:result.floaters,heapGrowth:after.usedSize-before.usedSize}));
  } else if(process.argv.includes('--polish-only')) {
    const cache=await evaluate('window.__verifyFrameCache()');assert.ok(cache.checked>=20&&cache.different/cache.pixels<.005,'cached crops preserve sprite pixels');assert.ok(cache.frames<=512&&cache.bytes<=12*1024*1024);assert.equal(cache.bytes,cache.accountedBytes,'cache eviction preserves the exact byte budget');
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await page('Emulation.setTouchEmulationEnabled',{enabled:true});
    await evaluate('window.__combatReadability("crowd",.22)');await delay(80);
    const first=await evaluate('window.__polishMetrics()'),overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2-1&&Math.abs(a.y-b.y)<(a.h+b.h)/2-1;
    for(let i=0;i<first.labels.length;i++)for(let j=i+1;j<first.labels.length;j++)if(first.labels[i].kind!=='hud'||first.labels[j].kind!=='hud')assert.ok(!overlap(first.labels[i],first.labels[j]),'important indicators avoid each other and HUD');
    const badge=first.labels.find(r=>r.kind==='player');assert.ok(badge);assert.ok(first.labels.filter(r=>r.kind==='threat').length>=4);
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await delay(100);await evaluate('window.__combatReadability("crowd",.22)');await delay(60);
    const second=await evaluate('window.__polishMetrics()'),badge2=second.labels.find(r=>r.kind==='player');assert.ok(Math.abs(badge.w*first.cssScale-badge2.w*second.cssScale)<1,'marker size is independent of device pixel ratio');await screenshot('polished-combat-mobile-dpr2.png');
    await evaluate('window.__polishReset()');const button=await evaluate('(()=>{const r=document.querySelector("[data-move=right]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:'d'});await page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[button]});await page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await evaluate('window.__polishMetrics()')).keys.includes('d'),'touch release preserves held keyboard');
    await page('Input.dispatchKeyEvent',{type:'keyUp',key:'d'});assert.ok(!(await evaluate('window.__polishMetrics()')).keys.includes('d'));
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:' '});await evaluate('document.getElementById("pauseButton").click();document.getElementById("resumeButton").click()');await page('Input.dispatchKeyEvent',{type:'keyDown',key:' ',autoRepeat:true});assert.equal((await evaluate('window.__polishMetrics()')).keys.length,0,'OS repeat cannot resurrect input after pause');await page('Input.dispatchKeyEvent',{type:'keyUp',key:' '});
    await evaluate('window.__polishReset();document.getElementById("helpButton").click()');const paused=(await snapshot()).waveTimer;await delay(150);assert.equal((await snapshot()).waveTimer,paused);await evaluate('document.getElementById("helpDialog").close()');await delay(50);assert.equal((await snapshot()).state,'playing');
    assert.equal((await evaluate('window.__polishMetrics()')).pointers,0);
    assert.ok(await evaluate('window.__dashButtonQueue()')>0,'the HUD button accepts the same late dash buffer as the keyboard');await delay(120);assert.ok((await snapshot()).dash.active>0);
    await page('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:2,mobile:false});await delay(80);assert.ok((await evaluate('window.__polishMetrics()')).pixels<2450000,'large high-density canvas has a pixel budget');
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    const hashFile=file=>(fs.readFileSync(file));const crypto=await import('node:crypto');
    fs.writeFileSync('game-preview/polish-checks.json',JSON.stringify({sourceSha256:crypto.createHash('sha256').update(hashFile('game.js')).digest('hex'),frameBoundsSha256:crypto.createHash('sha256').update(hashFile('unit-frame-bounds.js')).digest('hex'),cache,labels:first.labels.length,visibleThreats:first.labels.filter(r=>r.kind==='threat').length,markerCssWidthDpr1:badge.w*first.cssScale,markerCssWidthDpr2:badge2.w*second.cssScale,checks:['no label/HUD overlap','metadata bounds valid','cache byte accounting','sprite pixel equivalence','keyboard and touch ownership','stale repeat rejection','dialog pause clock','HUD dash queue','pixel budget'],errors,missing},null,2));
    console.log('Indicator collision/HUD avoidance, DPR-independent labels, pixel budget, keyboard + touch ownership, stale repeat rejection, paused dialog clock and cleanup: passed');
  } else if(process.argv.includes('--replay-only')) {
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
  } else if(process.argv.includes('--readability-only')) {
    for(const [age,frame,name] of [[.1,1,'player-windup.png'],[.22,2,'player-contact.png'],[.34,3,'player-recovery.png']]){
      const result=await evaluate('window.__combatReadability("crowd",'+age+')');assert.equal(result.poseFrame,frame);assert.ok(result.threats>0);await delay(60);await screenshot(name);
    }
    for(const scene of ['counter','hurt','forest','roof']){const result=await evaluate('window.__combatReadability("'+scene+'",.1)');assert.equal(result.hp,scene==='hurt'?88:100);await delay(60);await screenshot('player-'+scene+'.png');}
    await evaluate('window.__bossPreview()');const layers=await evaluate('window.__renderAudit()');
    assert.ok(layers.indexOf('danger-floor')<layers.indexOf('unit'));assert.ok(layers.lastIndexOf('unit')<layers.indexOf('danger-outline'));assert.ok(layers.indexOf('danger-outline')<layers.indexOf('player-marker'));
    await screenshot('readability-boss-desktop.png');
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await page('Emulation.setTouchEmulationEnabled',{enabled:true});
    await evaluate('window.__combatReadability("crowd",.22)');await delay(100);await screenshot('player-combat-mobile.png');
    assert.equal(await evaluate('document.getElementById("mobileControls").hidden'),false);
    assert.ok(await evaluate('(()=>{const toast=document.getElementById("toast").getBoundingClientRect(),arena=document.getElementById("arena").getBoundingClientRect(),dash=document.getElementById("dashButton").getBoundingClientRect();return toast.bottom<=arena.top+54&&toast.left>=dash.right&&toast.right<=arena.right})()'),'notification occupies the top corner beside dash, away from combat and touch controls');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await evaluate('window.__bossPreview()');await screenshot('readability-boss-mobile.png');
    await evaluate('window.__combatReadability("edge",.1)');await delay(60);await screenshot('player-edge-mobile.png');
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Actual player animation frames, combat/cover/counter previews, foreground warning and player marker layers, mobile readability: passed');
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
  assert.ok(await evaluate('!document.querySelector("[data-perk=counter]").disabled'),'another affordable upgrade remains available');
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
    await evaluate('window.__stress(0);window.__renderMeasure(true)');
    if(process.argv.includes('--profile-render'))await evaluate('window.__profileRender()');
    stress.render=await evaluate(`new Promise(resolve=>{
      const samples=[];let start=performance.now(),last=start;
      function sample(now){if(now-start>250)samples.push(now-last);last=now;
        if(now-start<15250)requestAnimationFrame(sample);
        else {samples.sort((a,b)=>a-b);resolve({frames:samples.length,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1)});}
      }requestAnimationFrame(sample);
    })`);
    stress.draw=await evaluate('window.__renderMeasure()');
    stress.caches=await evaluate('window.__polishMetrics()');delete stress.caches.labels;
    if(process.argv.includes('--profile-render'))stress.costs=await evaluate('window.__renderCosts()');
    stress.live=await evaluate('window.__stressState()');
    stress.audio=(await snapshot()).audio;assert.equal(stress.audio.enabled,true);assert.equal(stress.audio.decoded,17);assert.ok(stress.audio.voices<=12);
    assert.equal(stress.live.units,29);assert.equal(stress.live.bossEnraged,true);assert.deepEqual([...stress.live.bossResolved].sort(),['charge','slam','volley']);assert.ok(stress.live.effects<=80&&stress.live.impacts<=60&&stress.live.fields<=32&&stress.live.approachTargets<=30);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    stress.sourceSha256=(await import('node:crypto')).createHash('sha256').update(fs.readFileSync('game.js')).digest('hex');
    fs.writeFileSync(path.join(root,'game-preview',process.argv.includes('--baseline')?'performance-before-polish.json':process.argv.includes('--profile-render')?'performance-profile.json':'performance.json'),JSON.stringify(stress,null,2));
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
