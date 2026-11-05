// Desktop mine fixture: real ledger, work timing, World and Tiny Swords rendering.
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
const profile = fs.mkdtempSync(path.join(tempRoot, 'penjaga-mines-'));
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
  server=http.createServer((req,res)=>{
    let target;try{target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png'})[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const run=source=>evaluate('(()=>{const f=window.MinePreview;'+source+'})()');
  const step=n=>run(`for(let i=0;i<${n};i++)f.step(1/60);f.draw();`);
  const snapshot=()=>run('return f.snapshot();');
  const down=(key,code)=>page('Input.dispatchKeyEvent',{type:'keyDown',key,code});
  const up=(key,code)=>page('Input.dispatchKeyEvent',{type:'keyUp',key,code});
  const field=id=>evaluate(`document.querySelector('[data-mine-field="${id}"]').textContent`);
  const results=[];
  for(const transport of ['file','http']){
    const url=transport==='file'?pathToFileURL(path.join(root,'mines-preview.html')).href:'http://127.0.0.1:'+server.address().port+'/mines-preview.html';
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url});await waitFor('!!window.MinePreview','Mine fixture loads '+transport);
    await run('f.stop();f.reset("standard");');
    assert.equal((await snapshot()).view.yield,25);assert.equal((await snapshot()).gold,80);
    // E uses a real .9s work cycle and awards exactly the advertised yield.
    await down('e','KeyE');await step(30);assert.equal((await snapshot()).gold,80);
    const workBefore=(await snapshot()).work;assert.ok(workBefore);
    await key('p','KeyP');const paused=await snapshot();await step(1200);assert.deepEqual(await snapshot(),paused);
    await key('p','KeyP');await down('e','KeyE');await step(25);await up('e','KeyE');
    assert.equal((await snapshot()).gold,105);assert.equal((await snapshot()).view.remaining,19);
    // End all20 allocated harvests, assert operation-wide quota and no21st credit.
    await run(`for(const n of f.mines.nodes())while(f.mines.status(n.id).nodeRemaining){
      f.visit(n.id);for(let i=0;i<12;i++)f.step(1/60);const r=f.mines.interact(n.id);if(!r.ok)throw Error(r.reason);
    }f.draw();`);
    assert.equal((await snapshot()).view.remaining,0);
    assert.equal((await snapshot()).mine.chapters['chapter-1'].manualGold,500);
    const exhausted=await snapshot();await run('f.mines.interact("gold-01");f.draw();');assert.deepEqual(await snapshot(),exhausted);
    await run('f.chapter("chapter-1");');assert.deepEqual((await snapshot()).mine,exhausted.mine);
    await run('f.reset("standard");');
    for(const [chapter,stage,cost,yieldGold,production] of [['chapter-1','rock',0,25,0],['chapter-2','outpost',150,35,6],['chapter-3','mine-house',250,45,16]]){
      if(cost){
        await run(`f.chapter("${chapter}");f.session.gold=${cost-1};f.draw();`);
        await key('m','KeyM');assert.equal(await evaluate('document.querySelector(".mine-panel").open'),true);
        assert.equal(await evaluate('document.querySelector("[data-mine-buy]").disabled'),true);
        assert.equal(await field('gold'),(cost-1)+' emas');
        const rejected=await run('return f.mines.purchaseNextLevel();');assert.equal(rejected.ok,false);
        await run(`f.session.gold=${cost};f.panel.update();`);
        assert.equal(await evaluate('document.querySelector("[data-mine-buy]").disabled'),false);
        await activate('[data-mine-buy]',false);
        assert.equal((await snapshot()).gold,0);assert.equal((await snapshot()).mine.stageId,stage);
        assert.equal(await field('gold'),'0 emas');assert.equal(await field('yield'),yieldGold+' emas');
        const bought=(await snapshot()).mine;await run(`f.chapter("${chapter}");`);assert.deepEqual((await snapshot()).mine,bought);
        const sameGold=(await snapshot()).gold;assert.equal((await run('return f.mines.purchaseNextLevel();')).ok,false);assert.equal((await snapshot()).gold,sameGold);
        const frozen=await snapshot();await step(1000);assert.deepEqual(await snapshot(),frozen,'Panel time never produces');
        if(transport==='file')await screenshot('panel-'+stage);
        await key('Escape','Escape');await waitFor('!document.querySelector(".mine-panel").open','Panel closes');
        await waitFor("MinePreview.session.state==='playing'",'Panel resumes');
      }
      await run('f.visit("gold-01");f.draw();');
      assert.equal((await snapshot()).view.yield,yieldGold);
      // Building is drawn now, without topology rebuild or any simulation frame.
      const plot=await run(`return {radius:f.world.allCollections.goldNodes[0].radius,version:f.world.topologyVersion,stage:f.mines.snapshot().stageId};`);
      assert.equal(plot.radius,36);assert.equal(plot.stage,stage);
      const before=await snapshot();await step(360);const after=await snapshot();
      assert.equal(after.gold-before.gold,production+4,'One operation plus resident tick');
      assert.equal(after.mine.chapters[chapter].passiveGold-before.mine.chapters[chapter].passiveGold,production);
      if(transport==='file'){
        await run('const n=f.mines.nodes()[0];Object.assign(f.session.hero,{x:n.x-95,y:n.y+55});f.draw();');
        await screenshot(stage);await run('f.visit("gold-01");');
      }
      await down('w','KeyW');await step(45);await up('w','KeyW');
      assert.equal(await run('return f.navigation.positionFits(f.session.hero.x,f.session.hero.y);'),true);
      assert.equal(await run('return f.navigation.componentCount;'),1);
      await run('f.visit("gold-01");');
    }
    for(const [width,height,dpr] of [[1280,720,1],[1920,1080,2],[1100,900,1.25]]){
      await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
      await run('f.draw();');await key('m','KeyM');
      const dimensions=await evaluate(`(()=>{const p=document.querySelector('.mine-panel').getBoundingClientRect();return {horizontal:document.documentElement.scrollWidth<=innerWidth,within:p.x>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight};})()`);
      assert.equal(dimensions.horizontal,true);assert.equal(dimensions.within,true);
      await key('Escape','Escape');await waitFor('!document.querySelector(".mine-panel").open','Resized panel closes');
      await waitFor("MinePreview.session.state==='playing'",'Resume resize');
    }
    await run('document.getElementById("mineProfile").value="user-testing";document.getElementById("mineProfile").dispatchEvent(new Event("change"));');
    assert.equal((await snapshot()).view.yield,10000);assert.equal((await snapshot()).view.remaining,20);
    await key('m','KeyM');assert.ok((await field('profile')).includes('override 10000'));
    assert.equal(await field('yield'),'10000 emas');await key('Escape','Escape');await waitFor("MinePreview.session.state==='playing'",'Testing panel resumes');
    const testBefore=(await snapshot()).gold;await down('e','KeyE');await step(55);await up('e','KeyE');assert.equal((await snapshot()).gold-testBefore,10000);
    assert.equal((await snapshot()).view.remaining,19);
    const offline=await snapshot();await run('f.mines.update(3600);');assert.deepEqual(await snapshot(),offline);
    await run('f.reset("standard");');assert.equal((await snapshot()).gold,80);assert.equal((await snapshot()).mine.stageId,'rock');assert.equal((await snapshot()).view.remaining,20);
    // Compose the published installer with the same campaign port contract.
    await run(`const drawn=[],loaded=[],removers=[],proof=new Set(),source={runId:'adapter-run',chapterId:'chapter-1',status:'active'};
      const session={...f.session,hero:{...f.session.hero},castle:{...f.session.castle},gold:150,state:'playing',phase:'prepare'};
      const originalDraw=()=>{},originalUI=()=>{},originalPreload=()=>Promise.resolve('base-loader'),originalIncome=()=>{};
      const ctx=new Proxy({},{get:(target,key)=>key==='drawImage'?(image)=>drawn.push(image.src):()=>{},set:()=>true});
      const ports={mines:{},config:PenjagaModules.config,world:f.world,session,
        campaign:{enabled:true,snapshot:()=>({...source}),miningRewardOverride:()=>null,hasBossVictory:id=>proof.has(id),passiveTick:()=>true},
        host:{$:id=>id==='arena'?document.getElementById('minePanelMount'):null,canvas:f.canvas,ctx},
        input:{listen:(target,type,fn)=>{target.addEventListener(type,fn);removers.push(()=>target.removeEventListener(type,fn));},clearCombatInput:()=>{}},
        renderer:{camera:f.camera,drawScenery:originalDraw,draw:()=>{}},ui:{updateUI:originalUI},economy:{updatePassiveIncome:originalIncome},
        assets:{img:path=>f.images.get(path),loadImage:path=>{loaded.push(path);return Promise.resolve(f.images.get(path));},preload:originalPreload}};
      PenjagaModules.installMines(ports);ports.mines.enterChapter(source);ports.ui.updateUI();
      ports.renderer.drawScenery({type:'gold',source:f.world.goldNodes[0]});
      ports.mines.panel.button.id='installedMineToggle';ports.mines.panel.dialog.querySelector('[data-mine-buy]').id='installedMineBuy';
      window.__mineInstalled={...ports,source,proof,drawn,loaded,removers,originalDraw,originalUI,originalPreload,originalIncome};
      return ports.assets.preload();`);
    assert.equal(await evaluate('__mineInstalled.loaded.length'),5,'All mine art loaded before base preload');
    assert.equal(await evaluate('__mineInstalled.drawn.some(p=>decodeURI(p).includes("Gold Stone 1.png"))'),true);
    await run('f.world.applyChapterPreview("chapter-2");const p=__mineInstalled;p.source.chapterId="chapter-2";p.mines.enterChapter(p.source);p.proof.add("boss-chapter-1");p.ui.updateUI();');
    await activate('#installedMineToggle',false);assert.equal(await evaluate('__mineInstalled.session.state'),'paused');
    const adapterFrozen=await evaluate('__mineInstalled.mines.snapshot()');
    await evaluate('for(let i=0;i<1000;i++)__mineInstalled.mines.update(1/60)');assert.deepEqual(await evaluate('__mineInstalled.mines.snapshot()'),adapterFrozen);
    await activate('#installedMineBuy',false);assert.equal(await evaluate('__mineInstalled.session.gold'),0);
    assert.equal(await evaluate('__mineInstalled.mines.snapshot().stageId'),'outpost');
    await evaluate('__mineInstalled.renderer.drawScenery({type:"gold",source:MinePreview.world.goldNodes[0]})');
    assert.equal(await evaluate('__mineInstalled.drawn.some(p=>p.includes("House1.png"))'),true,'Purchase changes art without a timer tick');
    await key('Escape','Escape');await waitFor("__mineInstalled.session.state==='playing'",'Installed panel resumes its owner');
    await evaluate('__mineInstalled.mines.dispose()');
    assert.equal(await evaluate('__mineInstalled.ui.updateUI===__mineInstalled.originalUI&&__mineInstalled.renderer.drawScenery===__mineInstalled.originalDraw&&__mineInstalled.assets.preload===__mineInstalled.originalPreload&&__mineInstalled.economy.updatePassiveIncome===__mineInstalled.originalIncome'),true,'Dispose restores shared hooks');
    assert.equal(await evaluate('document.querySelectorAll(".mine-panel").length'),1,'Runtime disposal removes owned dialog');
    await key('m','KeyM');await key('Escape','Escape');
    results.push({transport,stages:3,profiles:2,quota20And21:true,exactPrices:true,repeatChapter:true,pauseAndDialog:true,desktopSizes:4});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log(JSON.stringify({result:'PASS',results},null,2));await call('Browser.close');
}finally{
  server?.closeAllConnections();server?.close();socket?.close();chrome.kill();const resolved=path.resolve(profile);
  if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('penjaga-mines-')){
    await delay(200);fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
