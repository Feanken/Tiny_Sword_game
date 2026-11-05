// Isolated original-island combat fixture; actual campaign entry is covered by campaign-playable-browser-test.mjs.
// Desktop skill integration; ranks >10 are injected only through DevTools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempRoot = path.resolve(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'penjaga-upgrade-skills-'));
const screenshotIndex = process.argv.indexOf('--screenshots');
const screenshots = screenshotIndex >= 0 ? path.resolve(process.argv[screenshotIndex + 1]) : null;
if (screenshots) fs.mkdirSync(screenshots, {recursive:true});
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
  {windowsHide:true, stdio:'ignore'});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, server;
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

  server=http.createServer((req,res)=>{
    let target;try{target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{const ext=path.extname(target);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[ext]||'application/octet-stream');res.end(fs.readFileSync(target));}
    catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const run=source=>evaluate('(()=>{const r=window.__testRuntime;'+source+'})()');
  const view=()=>run('return {skills:r.combat.skillsSnapshot(),triple:r.combat.tripleSlashSnapshot(),rLabel:r.host.$("oathStatus").textContent,qStatus:r.host.$("tripleSlashButton").dataset.status,rStatus:r.host.$("oathButton").dataset.status};');
  const step=frames=>run(`for(let i=0;i<${frames};i++){
    for(const u of r.session.enemies)if(u.testPin)Object.assign(u,{...u.testPin,knockX:0,knockY:0,speed:0,cooldown:99,stagger:0});
    r.simulation.update(1/60);r.renderer.draw();}`);
  async function reset(rank){await run(`r.input.clearCombatInput();r.session.resetForRun();r.session.state='playing';r.session.waveTimer=99999;
    Object.keys(r.session.ranks).forEach(id=>r.session.ranks[id]=${rank});
    Object.assign(r.session.hero,{x:700,y:400,hp:500,maxHp:1000});r.session.enemies=[];r.session.allies=[];
    r.combat.syncSkillRanks();r.ui.announcementTimer=0;r.ui.toastTimer=0;
    r.host.$('announcement').classList.remove('show');r.host.$('toast').classList.remove('show');
    r.ui.updateUI();r.renderer.draw();r.host.canvas.focus();`);}
  const results=[];
  for(const transport of ['file','http']){
    const url=transport==='file'?pathToFileURL(path.join(root,'index.html')).href:'http://127.0.0.1:'+server.address().port+'/index.html';
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url});await waitFor("window.PenjagaPulau?.snapshot().state==='ready'",'Title loads '+transport);
    assert.equal(await evaluate('document.getElementById("oathButton").hidden'),true);
    assert.equal(await evaluate('document.getElementById("passiveSkills").hidden'),true);
    await activate('#menuExpeditionButton',false);await activate('#startButton',false);
    await waitFor("PenjagaPulau.snapshot().state==='playing'",'Arena starts');
    await run('cancelAnimationFrame(r.simulation.frameId);r.renderer.reducedMotion=true;');
    // Production transactions remain capped at10; no fixture script is shipped.
    await run("r.session.ranks.blade=10;r.session.gold=100000;r.upgrading.buyUpgrade('blade');");
    assert.equal(await run('return r.session.ranks.blade;'),10);
    for(const rank of [9,10,19,20,24,25]){
      await reset(rank);const unlocked=rank>=10;
      assert.equal((await view()).rStatus,unlocked?'ready':'locked');
      assert.equal((await view()).qStatus,unlocked?'ready':'locked');
      await key('r','KeyR');const afterR=await view();
      assert.equal(!!afterR.skills.oath.zone,unlocked);
      assert.equal(await run('return r.session.food;'),3,'R never eats a ration');
      await key('q','KeyQ');assert.equal((await view()).triple.status,unlocked?'active':'idle');
      if(unlocked){
        const radius=(await view()).skills.oath.zone.radius;
        assert.equal(radius,rank<20?110:rank<25?125:140);
        await step(13);assert.equal((await view()).triple.slashIndex,1);
        const frozen=await view();await key('p','KeyP');await step(120);
        assert.equal((await view()).skills.oath.zone.remaining,frozen.skills.oath.zone.remaining);
        assert.equal((await view()).triple.elapsed,frozen.triple.elapsed);
        assert.equal(await evaluate('document.getElementById("oathButton").disabled'),true);
        await key('r','KeyR');await key('q','KeyQ');
        assert.equal((await view()).skills.oath.sequence,1);
        await key('p','KeyP');await run('r.renderer.draw();');
        await activate('#campButton',false);assert.equal(await run('return r.session.state;'),'paused');
        const inCamp=await view();await key('r','KeyR');await key('q','KeyQ');await step(120);
        assert.equal((await view()).skills.oath.zone.remaining,inCamp.skills.oath.zone.remaining);
        await evaluate('document.getElementById("campDialog").close()');
        await waitFor("__testRuntime.session.state==='playing'",'Resume after camp');
        await run('r.host.canvas.focus();');await key('Shift','ShiftLeft',16);await run('r.renderer.draw();');
        assert.equal((await view()).triple.cancelReason,'dash');
        assert.equal((await view()).skills.wind.charges,2);
        assert.ok((await view()).skills.oath.zone,'Dash cancels combo, zone persists');
      }
    }
    await reset(25);
    // Eight directions use actual contact, stage3 damage and counter once.
    for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI*3/4,Math.PI,-Math.PI*3/4,-Math.PI/2,-Math.PI/4]){
      await reset(25);
      const point=await run(`const h=r.session.hero;return r.renderer.camera.worldToScreen(h.x+Math.cos(${angle})*140,h.y+Math.sin(${angle})*140,r.host.canvas.getBoundingClientRect());`);
      await page('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await run(`r.director.spawnEnemy();const u=r.session.enemies.at(-1),h=r.session.hero;
        Object.assign(u,{x:h.x+Math.cos(${angle})*50,y:h.y+Math.sin(${angle})*50,hp:10000,maxHp:10000,kind:'Warrior',entering:false});u.testPin={x:u.x,y:u.y};
        r.combat.onPerfectDodge();r.combat.requestOath();r.renderer.draw();`);
      await key('q','KeyQ');await step(13);const first=await view();
      assert.equal(first.triple.hitCounts[0],1);assert.equal(first.triple.counterConsumed,true);
      assert.equal(first.skills.counter.ready,false);
      await step(18);await step(18);
      assert.deepEqual((await view()).triple.hitCounts,[1,1,1]);
      assert.equal(await run('return r.session.enemies[0].hp;'),await run('return 10000-3*Math.round(r.combat.heroPrimaryDamage()*PenjagaModules.SkillConfig.triple.damageScale[3])-r.upgrading.counterBonus();'),'Stage3 scale and one counter from the base-stat adapter');
    }
    for(const [width,height,dpr] of [[1280,720,1],[1440,900,1.25],[1920,1080,2],[1100,1000,1]]){
      await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
      await reset(25);await run(`r.session.gold=10000;for(let i=0;i<12;i++)r.economy.recruitUnit();
        Object.assign(r.session.hero,{x:800,y:400});r.combat.requestOath();r.combat.onPerfectDodge();
        for(let i=0;i<5;i++)r.combat.onHeroSkillHit(1);r.renderer.resize();r.renderer.draw();`);
      assert.equal(await run('return r.session.allies.length;'),12);
      const frozen=(await view()).skills;
      await run('r.renderer.draw();r.renderer.draw();');assert.deepEqual((await view()).skills,frozen,'Render never stacks buffs');
      const boxes=await evaluate(`(()=>{const ids=['oathButton','tripleSlashButton','passiveSkills','dashButton'],a=document.getElementById('arena').getBoundingClientRect();
        const boxes=ids.map(id=>{const b=document.getElementById(id).getBoundingClientRect();return {id,x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height};});
        return {within:boxes.every(b=>b.x>=a.x&&b.right<=a.right&&b.y>=a.y&&b.bottom<=a.bottom),overlap:boxes.some((b,i)=>boxes.slice(i+1).some(c=>b.x<c.right&&b.right>c.x&&b.y<c.bottom&&b.bottom>c.y)),boxes};})()`);
      assert.equal(boxes.within,true,JSON.stringify(boxes));assert.equal(boxes.overlap,false,JSON.stringify(boxes));
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
      if(transport==='file'&&[1280,1440,1920].includes(width))await screenshot('skills-'+width+'x'+height);
      await run(`const h=r.session.hero;r.input.keyboardInput('d',true);r.input.keyboardInput('s',true);
        for(let i=0;i<120;i++)r.simulation.update(1/60);r.input.clearCombatInput();r.renderer.draw();`);
      const origin=await run('return {zone:r.combat.skillsSnapshot().oath.zone,hero:{x:r.session.hero.x,y:r.session.hero.y}};');
      assert.ok(origin.zone&&origin.zone.x===800&&origin.zone.y===400,'Camera/movement does not shift heal zone');
      assert.ok(Math.hypot(origin.hero.x-800,origin.hero.y-400)>50,'Hero moves independently of zone');
    }
    await reset(25);await key('r','KeyR');await key('q','KeyQ');
    await run(`r.session.hero.hp=1;r.session.hero.invuln=0;r.combat.hurt(r.session.hero,10000,{x:600,y:400,team:'enemy'});r.renderer.draw();`);
    assert.equal((await view()).skills.oath.zone,null);assert.equal((await view()).triple.cancelReason,'death');
    await run('r.lifecycle.startGame(723);cancelAnimationFrame(r.simulation.frameId);r.renderer.draw();');
    assert.equal((await view()).skills.oath.sequence,0);assert.equal((await view()).skills.wind.charges,1);
    assert.equal((await view()).skills.rhythm.stacks,0);
    await key('h','KeyH');assert.equal((await view()).skills.oath.sequence,0,'H does not cast R');
    await run('r.lifecycle.showTitle();r.renderer.draw();');
    assert.equal(await evaluate('document.getElementById("oathButton").hidden'),true);
    results.push({transport,ranks:[9,10,19,20,24,25],directions:8,desktopSizes:4,pause:true,upgradeDialog:true,restart:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log(JSON.stringify({result:'PASS',results},null,2));
  await call('Browser.close');
}finally{
  server?.close();socket?.close();chrome.kill();const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-upgrade-skills-')){
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
