// Real keyboard and touch interactions against the standalone file:// game.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempRoot = path.resolve(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'penjaga-menu-'));
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
  const url = pathToFileURL(path.join(root, 'index.html')).href;
  const snapshot = () => evaluate('PenjagaPulau.snapshot()');
  const mainReady = "window.PenjagaPulau?.snapshot().state === 'ready' && !document.querySelector('.menu-main').hidden";
  const hudHidden = "['gameHud','commandBar','gameFooter','battleStatus','squadBar'].every(id => document.getElementById(id).hidden)";
  const carriedRanks = {blade:5, rhythm:10, wind:4, counter:9, bastion:10, oath:5};

  for (const {name, width, height, touch} of [
    {name:'keyboard', width:1440, height:900, touch:false},
    {name:'touch', width:390, height:844, touch:true},
    {name:'touch-small', width:320, height:640, touch:true},
    {name:'touch-landscape', width:844, height:390, touch:true}
  ]) {
    await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor:1, mobile:touch});
    await page('Emulation.setTouchEmulationEnabled', {enabled:touch});
    await page('Page.navigate', {url});
    await waitFor(mainReady, 'Main menu ready');
    assert.equal(await evaluate('location.protocol'), 'file:');
    assert.equal(await evaluate("document.querySelectorAll('.menu-main .menu-actions button').length"), 4);
    assert.equal(await evaluate(hudHidden), true);
    assert.equal((await snapshot()).difficulty, 'normal');
    await screenshot(name + '-main');
    if (!touch) {
      await evaluate("document.getElementById('menuExpeditionButton').focus()");
      await key('Tab');
      assert.equal(await evaluate('document.activeElement.id'), 'menuPracticeButton');
      await key('ArrowDown', 'ArrowDown', 40);
      assert.equal(await evaluate('document.activeElement.id'), 'menuSettingsButton');
    }
    for (const [button, dialog] of [['#menuSettingsButton','audioDialog'], ['#menuHelpButton','helpDialog'], ['#menuGalleryButton','galleryDialog']]) {
      await activate(button, touch);
      assert.equal(await evaluate('document.getElementById(' + JSON.stringify(dialog) + ').open'), true,
        JSON.stringify({button, touch, errors, active:await evaluate('document.activeElement.id')}));
      if (touch) await activate('#' + dialog + ' [data-close]', true);
      else await key('Escape');
      assert.equal(await evaluate('document.getElementById(' + JSON.stringify(dialog) + ').open'), false);
      assert.equal(await evaluate(hudHidden), true);
    }

    for (const [button, mode] of [['#menuPracticeButton','practice'], ['#menuExpeditionButton','expedition']]) {
      await activate(button, touch);
      assert.equal(await evaluate("document.querySelector('.menu-setup').dataset.mode"), mode);
      assert.equal(await evaluate("document.querySelector('.menu-main').hidden"), true);
      await activate('#menuBackButton', touch);
      assert.equal(await evaluate("document.querySelector('.menu-setup').hidden"), true);
    }
    await activate('#menuExpeditionButton', touch);
    if (!touch) {
      await key('Escape');
      assert.equal(await evaluate("document.querySelector('.menu-setup').hidden"), true);
      await activate('#menuExpeditionButton', false);
    }
    assert.equal(await evaluate("document.getElementById('menuSetupRoute').textContent"), 'Pulau Embun → Pulau Dua Arah');
    await activate('[data-difficulty="hard"]', touch);
    await screenshot(name + '-setup');
    assert.equal(await evaluate("document.getElementById('startLabel').textContent"), 'Berangkat');
    await activate('#startButton', touch);
    await waitFor("PenjagaPulau.snapshot().state === 'playing'", 'Expedition starts');
    assert.equal((await snapshot()).difficulty, 'hard');
    assert.equal(await evaluate("document.getElementById('gameShell').dataset.map"), 'island');
    assert.equal(await evaluate("['gameHud','commandBar','gameFooter','battleStatus'].every(id => !document.getElementById(id).hidden)"), true);
    await evaluate(`const session = window.__testRuntime.session;
      session.gold = 317; Object.assign(session.ranks, ${JSON.stringify(carriedRanks)});
      window.__testRuntime.lifecycle.finish(true);`);
    await activate('#continueButton', touch);
    await waitFor("document.getElementById('gameShell').dataset.map === 'crossroads' && PenjagaPulau.snapshot().state === 'playing'", 'Continue expedition to Map 2');
    let state = await snapshot();
    assert.equal(state.gold, 317);
    assert.deepEqual(state.upgrades, carriedRanks);
    assert.equal(state.hero.hp, 175);
    assert.equal(state.castleHp, 1300);
    assert.equal(state.difficulty, 'hard');
    assert.equal(state.wood, 40);
    assert.equal(state.food, 3);
    assert.equal(state.allies.length, 1);

    await evaluate('window.__testRuntime.lifecycle.finish(false)');
    await activate('#titleButton', touch);
    await waitFor(mainReady, 'Return to main menu');
    assert.equal(await evaluate(hudHidden), true);
    await activate('#menuPracticeButton', touch);
    assert.match(await evaluate("document.getElementById('menuSetupSummary').textContent"), /80 emas, 40 kayu, 3 bekal/);
    await activate('[data-difficulty="easy"]', touch);
    await activate('#startButton', touch);
    await waitFor("document.getElementById('gameShell').dataset.mode === 'practice' && PenjagaPulau.snapshot().state === 'playing'", 'Practice starts');
    state = await snapshot();
    assert.equal(state.difficulty, 'easy');
    assert.equal(state.gold, 80);
    assert.equal(state.hero.hp, 100);
    assert.equal(state.castleHp, 500);
    assert.deepEqual(Object.values(state.upgrades), [0,0,0,0,0,0]);
    assert.equal(state.allies.length, 1);
    await evaluate('window.__testRuntime.lifecycle.finish(true)');
    assert.equal(await evaluate("document.getElementById('continueButton').hidden"), true);
    await activate('#titleButton', touch);
    await waitFor(mainReady, 'Practice returns to main menu');
    await activate('#menuExpeditionButton', touch);
    await activate('#startButton', touch);
    await waitFor("document.getElementById('gameShell').dataset.map === 'island' && document.getElementById('gameShell').dataset.mode === 'expedition' && PenjagaPulau.snapshot().state === 'playing'", 'Practice can switch back to a new expedition');
    assert.equal((await snapshot()).gold, 80);
    console.log('PASS ' + name + ': main actions, dialogs, back, difficulty, HUD, expedition carry and fresh practice.');
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  await call('Browser.close');
} finally {
  socket?.close();
  chrome.kill();
  const resolved = path.resolve(profile);
  if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('penjaga-menu-')) {
    await delay(200);
    fs.rmSync(resolved, {recursive:true, force:true, maxRetries:5, retryDelay:100});
  }
}
