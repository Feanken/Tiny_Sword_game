// Isolated, seeded copy of the actual game logic for strategy simulations.
exports.createGame=(seed=1,code=require('node:fs').readFileSync('game.js','utf8'))=>{
// Exercise the actual game logic inside a minimal DOM, without a graphics driver.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
function element() {
  return { dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} }, hidden: false, textContent: '', children: [],
    addEventListener() {}, setAttribute() {}, focus() {}, append() {}, replaceChildren() {},
    querySelector: () => element(), getBoundingClientRect: () => ({ width: 1280, height: 704 }), getContext: () => ({ imageSmoothingEnabled: false }) };
}
const document = { body: element(), getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelector: () => null, querySelectorAll: () => [], createElement: element, createTextNode: t => t, addEventListener() {} };
const assetText = fs.readFileSync('asset-manifest.js', 'utf8');
const assets = JSON.parse(assetText.slice(assetText.indexOf('['), assetText.lastIndexOf(']') + 1));
const window = { TINY_ASSETS: assets, devicePixelRatio: 1, addEventListener() {} };
const testStorage = new Map();
let randomState=seed>>>0;
const seededMath=Object.create(Math);seededMath.random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
const sandbox = { Math:seededMath, window, document, console, matchMedia: () => ({ matches: false }), ResizeObserver: class { observe() {} }, localStorage: { getItem: key => testStorage.get(key) || null, setItem: (key,value) => testStorage.set(key,String(value)) }, requestAnimationFrame() {}, setTimeout() {} };
const source = code.replace('resize(); preload(); requestAnimationFrame(frame);', `
  initialized = true; state = 'ready';
  const metrics={bossHeroDamage:0,bossAllyDamage:0,patterns:[],resolved:[],bossDamageToHero:0,perfectDodges:0};
  const realHurt=hurt;hurt=(target,amount,source)=>{const hp=target.hp,perfect=hero.dashPerfect;realHurt(target,amount,source);if(target===hero&&source?.isBoss)metrics.bossDamageToHero+=hp-target.hp;if(!perfect&&hero.dashPerfect)metrics.perfectDodges++;if(target.isBoss){if(source===hero)metrics.bossHeroDamage+=hp-target.hp;else if(source?.team==='ally')metrics.bossAllyDamage+=hp-target.hp;}};
  const realBoss=updateBoss;updateBoss=(u,dt)=>{const before=u.bossAction,stage=before?.stage;realBoss(u,dt);if(u.bossAction!==before&&u.bossAction?.stage==='warning')metrics.patterns.push(u.bossAction.type);if(stage==='warning'&&before.stage!=='warning')metrics.resolved.push(before.type);};

  window.test = { requestAttack,shotClear,combatTarget,metrics, get time(){return elapsed;}, setDifficulty, showTitle, settings, setSquadOrder, squadAnchor, squadHome, spawnBoss, updateBoss, traceCharge, setWave(n){waveIndex=n;},get boss(){return boss;},startGame, startDash, buyUpgrade, ranks, finishWave, setGold(n){gold=n;}, advance, togglePause, routeTo, routeFields, navNodes, navComponent, navigationStats, obstacleList, update, startWave, spawnEnemy, spriteFrame, canStand, positionFits, clearPath, steerMove, segmentHit, move, updateUnit, updateReaction, gather, heroAttack, fireArrow, recruitUnit, repairCastle, healHero, hurt, keys, hero, castle,
    get enemies() { return enemies; }, get allies() { return allies; }, get state() { return state; },
    get effects() { return effects; }, get floaters() { return floaters; },
    get impacts() { return impacts; }, get projectiles() { return projectiles; },
    get phase() { return phase; }, get wave() { return waveIndex; }, get gold() { return gold; }, get wood() { return wood; }, get food() { return food; }, get score() { return score; }
  };
`);
vm.runInNewContext(source, sandbox, { filename: 'game.js' });

return {g:window.test,snapshot:window.PenjagaPulau.snapshot,storage:testStorage};
};
