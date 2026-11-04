// Local fixture QA using the browser's DevTools protocol. No npm dependencies.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function withBrowser(run) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'penjaga-menu-'));
  const types = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png'};
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank'], {windowsHide:true, stdio:'ignore'});
  let socket;
  try {
    const active = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(active); i++) await delay(100);
    assert.ok(fs.existsSync(active), 'Chrome DevTools port is available');
    const [port, socketPath] = fs.readFileSync(active, 'utf8').trim().split('\n');
    socket = new WebSocket('ws://127.0.0.1:' + port + socketPath.trim());
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let seq = 0;
    const pending = new Map(), errors = [], missing = [], requests = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (request) {
          pending.delete(message.id);
          message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
        }
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) missing.push(message.params.response.url);
      if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    };
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, {resolve, reject});
      socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
    });
    const {targetId} = await call('Target.createTarget', {url:'about:blank'});
    const {sessionId} = await call('Target.attachToTarget', {targetId, flatten:true});
    const page = (method, params = {}) => call(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true, userGesture:true});
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await Promise.all([page('Page.enable'), page('Runtime.enable'), page('Network.enable')]);
    await run({page, evaluate, origin, errors, missing, requests});
    await call('Browser.close');
  } finally {
    socket?.close();
    chrome.kill();
    server.close();
    await delay(400);
    const absolute = path.resolve(profile);
    if (absolute.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(absolute).startsWith('penjaga-menu-')) {
      try { fs.rmSync(absolute, {recursive:true, force:true, maxRetries:3, retryDelay:200}); } catch {}
    }
  }
}

async function check() {
  const outputIndex = process.argv.indexOf('--output');
  const output = path.resolve(outputIndex < 0 ? path.join(root, 'menu-preview', 'screenshots') : process.argv[outputIndex + 1]);
  fs.mkdirSync(output, {recursive:true});
  await withBrowser(async ({page, evaluate, origin, errors, missing, requests}) => {
    const fixture = pathToFileURL(path.join(root, 'menu-preview', 'fixture.html')).href;
    const results = [];
    for (const [name, width, height, url] of [
      ['desktop', 1920, 1080, origin + '/menu-preview/fixture.html'],
      ['laptop', 1366, 768, fixture],
      ['desktop-short', 1280, 520, fixture],
      ['tablet', 820, 1180, fixture],
      ['mobile', 390, 844, fixture],
      ['mobile-small', 320, 640, fixture],
      ['mobile-short', 320, 568, fixture],
      ['mobile-landscape', 844, 390, fixture]
    ]) {
      await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor:1, mobile:width <= 900});
      const start = requests.length;
      await page('Page.navigate', {url});
      for (let i = 0; i < 100 && !(await evaluate("document.readyState === 'complete' && !!document.querySelector('.menu-main')")); i++) await delay(50);
      await delay(150);
      const metrics = await evaluate(`(() => {
        const root = document.getElementById('startScreen');
        const panel = document.querySelector('.menu-main');
        const actions = [...panel.querySelectorAll('.menu-actions button')];
        const mobile = innerWidth <= 900;
        return {
          width: innerWidth, height: innerHeight,
          overflow: root.scrollWidth > root.clientWidth,
          panel: panel.getBoundingClientRect().toJSON(),
          artHeight: parseFloat(getComputedStyle(root, '::before').height),
          background: getComputedStyle(root).backgroundImage,
          art: getComputedStyle(root, '::before').backgroundImage,
          setupHidden: getComputedStyle(document.querySelector('.menu-setup')).display === 'none',
          actionHeights: actions.map(button => button.getBoundingClientRect().height),
          actionWidthsFit: actions.every(button => button.getBoundingClientRect().right <= innerWidth),
          colors: actions.map(button => ({color:getComputedStyle(button).color, background:getComputedStyle(button).backgroundColor})),
          mobile
        };
      })()`);
      assert.equal(metrics.overflow, false, name + ' has no horizontal overflow');
      assert.equal(metrics.setupHidden, true);
      assert.ok(metrics.actionHeights.every(height => height >= 48));
      assert.ok(metrics.actionWidthsFit);
      if (metrics.mobile) {
        assert.ok(metrics.panel.top >= metrics.artHeight - 1, 'Mobile illustration precedes the actions');
        const landscape = width > height;
        const activeAsset = landscape ? 'dawn-desktop.webp' : 'dawn-mobile.webp';
        const otherAsset = landscape ? 'dawn-mobile.webp' : 'dawn-desktop.webp';
        assert.ok(metrics.art.includes(activeAsset));
        assert.ok(!requests.slice(start).some(request => request.endsWith(otherAsset)), 'Mobile loads only its chosen illustration');
      } else {
        assert.ok(metrics.panel.right <= width * .46, 'Menu stays on the dark left');
        assert.ok(metrics.background.includes('dawn-desktop.webp'));
        assert.ok(!requests.slice(start).some(request => request.endsWith('dawn-mobile.webp')), 'Desktop loads only its illustration');
      }
      if (url.startsWith('file:')) assert.ok(!requests.slice(start).some(request => /^https?:/.test(request)), 'Offline fixture needs no HTTP requests');
      const screenshot = async suffix => {
        const result = await page('Page.captureScreenshot', {format:'png', captureBeyondViewport:false});
        fs.writeFileSync(path.join(output, name + suffix + '.png'), Buffer.from(result.data, 'base64'));
      };
      await screenshot('');
      if (metrics.mobile) {
        await evaluate("document.querySelector('.menu-secondary').scrollIntoView({block:'end'})");
        assert.ok(await evaluate("document.querySelector('.menu-secondary').getBoundingClientRect().bottom <= innerHeight + 1"), 'Last action remains reachable on short screens');
        await screenshot('-scrolled');
        await evaluate("document.getElementById('startScreen').scrollTop = 0");
      }
      await page('Input.dispatchKeyEvent', {type:'keyDown', key:'Tab', code:'Tab'});
      await page('Input.dispatchKeyEvent', {type:'keyUp', key:'Tab', code:'Tab'});
      const focus = await evaluate("({id:document.activeElement.id, visible:document.activeElement.matches(':focus-visible'), outline:getComputedStyle(document.activeElement).outlineWidth})");
      assert.equal(focus.id, 'previewPrepare');
      assert.equal(focus.visible, true);
      assert.equal(focus.outline, '3px');
      await screenshot('-focus');
      for (let choice = 0; choice < 4; choice++) {
        await page('Input.dispatchKeyEvent', {type:'keyDown', key:'Tab', code:'Tab'});
        await page('Input.dispatchKeyEvent', {type:'keyUp', key:'Tab', code:'Tab'});
        assert.ok(await evaluate(`(() => {
          const button = document.activeElement;
          const rect = button.getBoundingClientRect();
          return button.closest('.menu-main') && button.matches(':focus-visible') &&
            rect.top >= -1 && rect.bottom <= innerHeight + 1;
        })()`), name + ' keyboard reaches every main choice');
      }
      assert.ok(await evaluate("document.activeElement.matches('.menu-secondary')"));
      await evaluate("document.getElementById('previewPrepare').focus()");
      await page('Input.dispatchKeyEvent', {type:'rawKeyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
      await page('Input.dispatchKeyEvent', {type:'char', key:'Enter', code:'Enter', text:'\r', windowsVirtualKeyCode:13});
      await page('Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
      assert.ok(await evaluate("document.querySelector('.menu-main').hidden && !document.querySelector('.menu-setup').hidden"));
      assert.ok(await evaluate("document.getElementById('startScreen').scrollWidth <= document.getElementById('startScreen').clientWidth"));
      await screenshot('-setup');
      for (let choice = 0; choice < 5; choice++) {
        await page('Input.dispatchKeyEvent', {type:'keyDown', key:'Tab', code:'Tab'});
        await page('Input.dispatchKeyEvent', {type:'keyUp', key:'Tab', code:'Tab'});
        assert.ok(await evaluate(`(() => {
          const control = document.activeElement;
          const rect = control.getBoundingClientRect();
          return control.closest('.menu-setup') && control.matches(':focus-visible') &&
            rect.top >= -1 && rect.bottom <= innerHeight + 1;
        })()`), name + ' keyboard reaches every setup choice');
      }
      assert.equal(await evaluate("document.activeElement.id"), 'previewBack');
      await screenshot('-setup-scrolled');
      await evaluate("document.getElementById('startScreen').hidden = true");
      assert.equal(await evaluate("getComputedStyle(document.getElementById('startScreen')).display"), 'none');
      results.push({name, ...metrics, focus});
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
    console.log('PASS eight viewports including short desktop/phone and landscape; HTTP/file, responsive art, every keyboard choice, setup, scroll and hidden lifecycle.');
    console.log('Screenshots: ' + output);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await check();
