// Exercise the actual game logic inside a minimal DOM, without a graphics driver.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
function element() {
  return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, hidden: false, textContent: '', children: [],
    addEventListener() {}, setAttribute() {}, focus() {}, append() {}, replaceChildren() {},
    querySelector: () => element(), getBoundingClientRect: () => ({ width: 1280, height: 704 }), getContext: () => ({ imageSmoothingEnabled: false }) };
}
const document = { body: element(), getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelector: () => null, querySelectorAll: () => [], createElement: element, createTextNode: t => t, addEventListener() {} };
const assetText = fs.readFileSync('asset-manifest.js', 'utf8');
const assets = JSON.parse(assetText.slice(assetText.indexOf('['), assetText.lastIndexOf(']') + 1));
const window = { TINY_ASSETS: assets, devicePixelRatio: 1, addEventListener() {} };
const sandbox = { window, document, console, matchMedia: () => ({ matches: false }), ResizeObserver: class { observe() {} }, localStorage: { getItem: () => 0, setItem() {} }, requestAnimationFrame() {}, setTimeout() {} };
const source = fs.readFileSync('game.js', 'utf8').replace('resize(); preload(); requestAnimationFrame(frame);', `
  initialized = true; state = 'ready';
  window.test = { startGame, update, startWave, spawnEnemy, spriteFrame, canStand, move, updateUnit, updateReaction, gather, heroAttack, fireArrow, recruitUnit, repairCastle, healHero, hurt, keys, hero, castle,
    get enemies() { return enemies; }, get allies() { return allies; }, get state() { return state; },
    get impacts() { return impacts; }, get projectiles() { return projectiles; },
    get phase() { return phase; }, get wave() { return waveIndex; }, get gold() { return gold; }, get wood() { return wood; }, get food() { return food; }, get score() { return score; }
  };
`);
vm.runInNewContext(source, sandbox, { filename: 'game.js' });
const g = window.test;
for (let variant = 1; variant <= 4; variant++) {
  const path = `Terrain/Resources/Wood/Trees/Tree${variant}.png`;
  for (let frame = 0; frame < 8; frame++) {
    const sprite = g.spriteFrame(path, frame, 1);
    assert.equal(sprite.width, 192); assert.equal(sprite.count, 8);
    assert.equal(sprite.x, frame * 192); assert.equal(sprite.height, variant < 3 ? 256 : 192);
    assert.ok(sprite.x + sprite.width <= 1536, 'every tree frame stays within the sprite sheet');
  }
}
console.log('All eight frames of every tree: correct rectangular crops and foot anchors');
g.startGame(); assert.equal(g.state, 'playing'); assert.equal(g.allies.length, 1);
function finishWork() { for(let i=0;i<70;i++) g.update(1/60); }
g.hero.x=196;g.hero.y=319;const startingWood=g.wood;g.gather();
assert.ok(g.hero.work);assert.equal(g.wood,startingWood,'no resources before animation completes');
g.gather();assert.equal(g.wood,startingWood);finishWork();assert.equal(g.wood,startingWood+8);
g.hero.x=571;g.hero.y=534;const startingGold=g.gold;g.gather();finishWork();assert.equal(g.gold,startingGold+10);
g.hero.x=1014;g.hero.y=298;const startingFood=g.food;g.gather();finishWork();assert.equal(g.food,startingFood+1);
g.hero.x=196;g.hero.y=319;g.gather();g.keys.add('d');g.update(.1);g.keys.clear();assert.equal(g.hero.work,null,'moving cancels work');assert.equal(g.wood,startingWood+8);
g.update(.3);g.gather();g.hurt(g.hero,1,{x:100,y:319});assert.equal(g.hero.work,null,'damage cancels work');g.hero.invuln=0;g.hero.stagger=0;
g.hero.hp = 30; g.healHero(); assert.equal(g.hero.hp, 75); assert.equal(g.food, startingFood);
g.castle.hp = 220; g.repairCastle(); assert.equal(g.castle.hp, 360); assert.ok(g.wood < startingWood);
const recruitGold = g.gold; g.recruitUnit(); assert.equal(g.allies.length, 2); assert.equal(g.gold, recruitGold - 40);
g.startWave(); g.update(.4); assert.equal(g.enemies.length, 3);
const enemy = g.enemies[0]; enemy.x = 350; enemy.y = 401; enemy.entering = false; g.hero.x = enemy.x + 30; g.hero.y = enemy.y; const enemyHp = enemy.hp;
g.heroAttack(); assert.equal(enemy.hp, enemyHp, 'wind-up does not damage before the strike frame');
g.update(.13); assert.equal(enemy.hp, enemyHp - 27); assert.ok(enemy.hitFlash > 0); assert.ok(enemy.stagger > 0); assert.ok(enemy.knockX < 0); assert.ok(g.impacts.length > 0);
g.heroAttack(); assert.equal(enemy.hp, enemyHp - 27, 'attack cooldown prevents duplicate hits');
const beforeHit = g.hero.hp; g.hurt(g.hero, 8, enemy); assert.equal(g.hero.hp, beforeHit - 8);
assert.ok(g.hero.hitFlash > 0 && g.hero.stagger > 0 && g.hero.knockX > 0, 'player gets the same visible impact response');
g.hurt(g.hero, 8, enemy); assert.equal(g.hero.hp, beforeHit - 8, 'player invulnerability blocks repeated damage');
g.fireArrow(enemy, g.hero); assert.equal(g.projectiles[0].source, enemy, 'arrows retain their source for directional impact');
console.log('Gathering, cooldowns, food/healing, castle repair, recruitment, and melee damage: passed');
console.log('Timed strikes, hit sparks, white flash, directional knockback, hit stun, and invulnerability: passed');

g.startGame(); g.startWave(); for (let tick = 0; tick < 24; tick++) g.update(1 / 60);
const cohort = [...g.enemies]; assert.ok(cohort.every(e => e.x > 90 && e.x < 135 && e.y > 375 && e.y < 435 && e.entering), 'all enemies start on the western road');
const beforeDistance = Math.hypot(cohort[0].x - g.hero.x, cohort[0].y - g.hero.y);
g.allies.length = 0;
for (let tick = 0; tick < 540; tick++) g.update(1 / 60);
assert.ok(cohort.every(e => !e.entering && e.x > 390), 'troops leave the road and advance across the island');
assert.ok(Math.hypot(cohort[0].x - g.hero.x, cohort[0].y - g.hero.y) < beforeDistance - 200, 'hunters pursue the player from across the map');
assert.ok(Math.max(...cohort.map(e => e.y)) - Math.min(...cohort.map(e => e.y)) > 25, 'formation spreads into different flanking routes');
console.log('Road-only group spawns, road exit, distinct flanks, and map-wide player pursuit: passed');

// Drive all five real spawners and phase transitions to the victory screen.
g.startGame(); const seenKinds = new Set(), seenColors = new Set();
for (let wave = 0; wave < 5; wave++) {
  g.startWave();
  for (let tick = 0; tick < 3000 && g.state === 'playing' && g.phase === 'battle'; tick++) {
    g.update(.05);
    for (const e of g.enemies) { seenKinds.add(e.kind); seenColors.add(e.color); g.hurt(e, e.hp, g.hero); }
  }
  if (wave < 4) { assert.equal(g.phase, 'prepare'); assert.equal(g.wave, wave + 1); }
}
assert.equal(g.state, 'won'); assert.equal(seenKinds.size, 5); assert.equal(seenColors.size, 4); assert.ok(g.score > 2500);
console.log('All five waves, all five enemy classes, four enemy factions, rewards, and victory: passed');
g.startGame(); g.hero.hp = 0; g.update(.05); assert.equal(g.state, 'lost');
g.startGame(); g.castle.hp = 0; g.update(.05); assert.equal(g.state, 'lost');
g.startGame(); assert.equal(g.castle.hp, 500); assert.equal(g.hero.hp, 100); assert.equal(g.enemies.length, 0);
console.log('Hero death, castle destruction, and complete match reset: passed');

// An input-only bot checks navigation and combat under the real AI and damage rules.
g.startGame();
for (let tick = 0; tick < 36000 && g.state === 'playing'; tick++) {
  const target = g.enemies.filter(e => e.hp > 0).sort((a, b) => Math.hypot(a.x - g.hero.x, a.y - g.hero.y) - Math.hypot(b.x - g.hero.x, b.y - g.hero.y))[0];
  g.keys.clear(); if(target && Math.hypot(target.x-g.hero.x,target.y-g.hero.y)<86) g.keys.add(' ');
  if (target) { const dx = target.x - g.hero.x, dy = target.y - g.hero.y; if (Math.hypot(dx, dy) > 65) { if (Math.abs(dx) > 12) g.keys.add(dx > 0 ? 'd' : 'a'); if (Math.abs(dy) > 12) g.keys.add(dy > 0 ? 's' : 'w'); } }
  if (g.hero.hp < 55 && g.food) g.healHero();
  if (g.castle.hp < 340 && g.wood >= 30) g.repairCastle();
  if (g.gold >= 55 && g.allies.length < 8) g.recruitUnit();
  g.update(1 / 60);
}
assert.equal(g.state, 'won', 'input-only bot can finish a match without modifying health, resources, or enemies');
console.log('Full match with movement, attacks, recruiting, healing, repairs, and unmodified AI: won');

// Every traversable shoreline tile, diagonal movement and extreme knockback.
g.startGame();let shoreChecks=0;
for(let y=90;y<630;y+=24)for(let x=90;x<1195;x+=24){
 if(!g.canStand(x,y))continue;
 if([[-30,0],[30,0],[0,-30],[0,30]].every(([dx,dy])=>g.canStand(x+dx,y+dy)))continue;
 for(let dir=0;dir<8;dir++){
  const actor={x,y,facing:1};g.move(actor,Math.cos(dir*Math.PI/4),Math.sin(dir*Math.PI/4),2,600);
  assert.ok(g.canStand(actor.x,actor.y),'swept movement remains on land');
  actor.knockX=Math.cos(dir*Math.PI/4)*5000;actor.knockY=Math.sin(dir*Math.PI/4)*5000;g.updateReaction(actor,.2);
  assert.ok(g.canStand(actor.x,actor.y),'knockback remains on land');shoreChecks++;
 }
}
assert.ok(shoreChecks>100);console.log('Shoreline checks passed:',shoreChecks,'normal, diagonal, and knockback paths');
g.startGame();g.hero.x=60;g.hero.y=450;g.update(.016);assert.ok(g.canStand(g.hero.x,g.hero.y),'invalid old positions recover onto grass');
g.startGame();g.startWave();g.update(.4);const archer=g.enemies[0];archer.kind='Archer';archer.entering=false;archer.x=500;archer.y=400;archer.cooldown=1;g.hero.x=560;g.hero.y=400;g.allies.length=0;const distanceBefore=Math.hypot(archer.x-g.hero.x,archer.y-g.hero.y);g.updateUnit(archer,.1);assert.ok(Math.hypot(archer.x-g.hero.x,archer.y-g.hero.y)>distanceBefore,'enemy archer retreats from close player');
console.log('Archer distance keeping and work cancellation: passed');

g.startGame();g.allies.length=0;g.startWave();for(let i=0;i<5;i++)g.spawnEnemy();
g.hero.x=600;g.hero.y=400;
g.enemies.forEach((e,i)=>{e.x=i===4?555:630+i*12;e.y=400;e.entering=false;e.hp=e.maxHp=100;e.cooldown=10;});
g.heroAttack();g.update(.13);
assert.equal(g.enemies[0].hp,73);assert.equal(g.enemies[1].hp,82);assert.equal(g.enemies[2].hp,82);
assert.equal(g.enemies[3].hp,100,'fourth target is outside cleave limit');assert.equal(g.enemies[4].hp,100,'rear target is outside forward arc');
console.log('Forward attack arc, three-target cleave cap, and secondary damage: passed');
