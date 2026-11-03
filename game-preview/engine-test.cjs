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
const sandbox = { window, document, console, matchMedia: () => ({ matches: false }), ResizeObserver: class { observe() {} }, localStorage: { getItem: key => testStorage.get(key) || null, setItem: (key,value) => testStorage.set(key,String(value)) }, requestAnimationFrame() {}, setTimeout() {} };
const source = fs.readFileSync('game.js', 'utf8').replace('resize(); preload(); requestAnimationFrame(frame);', `
  initialized = true; state = 'ready';
  window.test = { setDifficulty, showTitle, settings, setSquadOrder, squadAnchor, squadHome, spawnBoss, updateBoss, traceCharge, setWave(n){waveIndex=n;},get boss(){return boss;},startGame, startDash, buyUpgrade, ranks, finishWave, setGold(n){gold=n;}, advance, togglePause, routeTo, routeFields, navNodes, navComponent, navigationStats, obstacleList, update, startWave, spawnEnemy, spriteFrame, canStand, positionFits, clearPath, steerMove, segmentHit, move, updateUnit, updateReaction, gather, heroAttack, fireArrow, recruitUnit, repairCastle, healHero, hurt, keys, hero, castle,
    get enemies() { return enemies; }, get allies() { return allies; }, get state() { return state; },
    get effects() { return effects; }, get floaters() { return floaters; },
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
g.update(.22); assert.equal(enemy.hp, enemyHp - 27); assert.ok(enemy.hitFlash > 0); assert.ok(enemy.stagger > 0); assert.ok(enemy.knockX < 0); assert.ok(g.impacts.length > 0);
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
g.heroAttack();g.update(.22);
assert.equal(g.enemies[0].hp,73);assert.equal(g.enemies[1].hp,82);assert.equal(g.enemies[2].hp,82);
assert.equal(g.enemies[3].hp,100,'fourth target is outside cleave limit');assert.equal(g.enemies[4].hp,100,'rear target is outside forward arc');
console.log('Forward attack arc, three-target cleave cap, and secondary damage: passed');

// Regression checks for collision sliding, navigation and frame-independent arrows.
g.startGame();const walker={x:730,y:260,speed:100,facing:1,flankSign:1};const destination={x:940,y:260};
assert.equal(g.clearPath(walker,destination),false,'castle blocks the direct route');
for(let tick=0;tick<480;tick++){g.steerMove(walker,destination,1/60);assert.ok(g.positionFits(walker.x,walker.y),'navigation avoids colliders');}
assert.ok(Math.hypot(walker.x-destination.x,walker.y-destination.y)<30,'troops route around the castle');
const facingActor={x:500,y:400,facing:1,attack:.3};g.move(facingActor,-1,0,.05,100);assert.equal(facingActor.facing,1,'movement cannot reverse an ongoing swing');
assert.ok(Number.isFinite(g.segmentHit({x:0,y:0},{x:100,y:0},{x:50,y:0},4)),'swept arrow detects crossed targets');
assert.equal(g.segmentHit({x:0,y:0},{x:100,y:0},{x:50,y:20},4),Infinity,'arrow does not hit off its path');
g.startGame();g.allies.length=0;g.startWave();g.spawnEnemy();const shooter=g.enemies[0];Object.assign(shooter,{x:400,y:400,kind:'Archer',entering:false,cooldown:999});g.hero.x=500;g.hero.y=400;g.fireArrow(shooter,g.hero);g.projectiles[0].vx=8000;g.projectiles[0].vy=0;g.update(.04);assert.equal(g.hero.hp,90,'fast arrow deals one hit when it crosses the player');
g.startGame();g.hero.hp=20;const foodBefore=g.food;g.healHero();g.healHero();assert.equal(g.food,foodBefore-1,'rapid healing cannot consume multiple meals at once');
g.keys.add('d');g.update(.016);g.gather();assert.equal(g.hero.work,null,'holding E while walking cannot restart work');
console.log('Obstacle routing, locked swing direction, swept arrow hits/misses, healing cadence, and animation cancellation: passed');

// Cover must intercept arrows before a target, including fast sweeps.
function arrowScenario(start,target,velocity){
 g.startGame();g.allies.length=0;g.startWave();g.spawnEnemy();
 const shooter=g.enemies[0];Object.assign(shooter,{x:start.x,y:start.y,entering:false,kind:'Archer',cooldown:999});
 Object.assign(g.hero,{x:target.x,y:target.y});g.fireArrow(shooter,g.hero);
 g.projectiles[0].vx=velocity.x;g.projectiles[0].vy=velocity.y;g.update(.04);return g.hero.hp;
}
assert.equal(arrowScenario({x:130,y:326},{x:260,y:326},{x:5000,y:0}),100,'tree trunk blocks arrow');
assert.equal(arrowScenario({x:730,y:250},{x:945,y:250},{x:8000,y:0}),100,'castle blocks arrow');
assert.equal(arrowScenario({x:400,y:400},{x:500,y:400},{x:8000,y:0}),90,'open line still hits');
g.startGame();const invalid={x:-200,y:-200,speed:90};g.steerMove(invalid,{x:500,y:400},1/60);assert.equal(invalid.moving,false,'no path stops safely');
const projected=g.routeTo({x:500,y:400},{x:-500,y:-500});assert.ok(projected.length>0,'inaccessible target projects onto reachable component');assert.ok(projected.every(p=>g.positionFits(p.x,p.y)));
const initialBuilds=g.navigationStats.builds;for(let i=0;i<100;i++)g.routeTo({x:730,y:260},{x:940,y:260});assert.ok(g.navigationStats.builds-initialBuilds<=1,'identical goals reuse a shared field');assert.ok(g.routeFields.size<=32);

// Feed the same input timeline through the actual fixed-step frame entry point.
function timeline(fps){
 g.startGame();g.allies.length=0;g.hero.x=470;g.hero.y=400;g.keys.add('d');
 for(let i=0;i<fps;i++)g.advance(1/fps);g.keys.clear();
 g.hero.knockX=195;g.hero.knockY=0;for(let i=0;i<fps;i++)g.advance(1/fps);
 const x=g.hero.x;g.hero.x=610;g.hero.y=510;g.hero.moving=false;g.gather();
 for(let i=0;i<fps;i++)g.advance(1/fps);
 g.hero.x=600;g.hero.y=400;g.hero.knockX=0;g.hero.knockY=0;g.startWave();g.spawnEnemy();
 Object.assign(g.enemies[0],{x:650,y:400,entering:false,speed:0,cooldown:999,hp:100,maxHp:100});
 g.keys.add(' ');for(let i=0;i<fps*2;i++)g.advance(1/fps);g.keys.clear();
 return {x,gold:g.gold,work:g.hero.work,phase:g.phase,health:g.hero.hp,score:g.score,enemyHp:g.enemies[0]?.hp};
}
const fps30=timeline(30),fps60=timeline(60),fps120=timeline(120);
assert.deepEqual(fps30,fps60);assert.deepEqual(fps60,fps120);
g.startGame();g.hero.x=610;g.hero.y=510;g.hero.moving=false;g.gather();g.keys.add(' ');g.advance(1/60);assert.equal(g.hero.work,null,'attack cancels work before its reward');
const hpBefore=g.hero.hp;g.hurt(g.hero,8,{x:500,y:400});assert.equal(g.hero.strike,null);assert.equal(g.hero.attack,0);
g.togglePause(true);const frozen={x:g.hero.x,hp:g.hero.hp,stagger:g.hero.stagger};g.advance(.1);g.update(.1);assert.deepEqual({x:g.hero.x,hp:g.hero.hp,stagger:g.hero.stagger},frozen,'paused transition freezes simulation');g.togglePause(false);g.advance(1/60);assert.ok(g.hero.hp<hpBefore);
console.log('Cover collision, unreachable routing, shared cache, exact 30/60/120 FPS replay, and rapid action/pause transitions: passed');

// Langkah Embun: bounded movement, dodge frames, cooldown, riposte, and reset.
g.startGame();g.hero.x=500;g.hero.y=400;g.keys.add('d');assert.equal(g.startDash(),true);g.keys.clear();const dashStart=g.hero.x;
g.hurt(g.hero,10,{x:400,y:400});assert.equal(g.hero.hp,100);assert.ok(g.hero.riposte>0,'successful dodge grants counter window');
assert.equal(g.startDash(),false,'cooldown prevents repeated dashes');for(let i=0;i<13;i++)g.advance(1/60);
assert.ok(g.hero.x-dashStart>120&&g.hero.x-dashStart<160);assert.equal(g.hero.dash,0);assert.ok(g.positionFits(g.hero.x,g.hero.y));
g.hero.invuln=0;g.hurt(g.hero,8,{x:400,y:400});assert.equal(g.hero.hp,92,'dash immunity ends after dash');
g.startGame();g.hero.x=104;g.hero.y=405;g.keys.add('a');g.startDash();g.keys.clear();for(let i=0;i<13;i++)g.advance(1/60);assert.ok(g.canStand(g.hero.x,g.hero.y),'dash cannot enter water');
g.startGame();g.hero.x=730;g.hero.y=250;g.keys.add('d');g.startDash();g.keys.clear();for(let i=0;i<13;i++)g.advance(1/60);assert.ok(g.positionFits(g.hero.x,g.hero.y),'dash cannot cross castle');
g.startGame();g.hero.x=600;g.hero.y=400;g.allies.length=0;g.startWave();g.spawnEnemy();Object.assign(g.enemies[0],{x:650,y:400,entering:false,cooldown:999,speed:0,hp:100,maxHp:100});g.hero.riposte=2;g.heroAttack();g.update(.22);assert.equal(g.enemies[0].hp,61,'counterattack adds 12 damage');assert.equal(g.hero.riposte,0);

// Upgrade transactions and dynamic health caps.
g.startGame();g.setGold(1000);assert.equal(g.buyUpgrade('wind'),true);assert.equal(g.gold,965);assert.equal(g.ranks.wind,1);assert.equal(g.buyUpgrade('blade'),false,'one purchase per intermission');
g.finishWave();assert.equal(g.buyUpgrade('wind'),true);g.finishWave();assert.equal(g.buyUpgrade('wind'),true);g.finishWave();const goldAtCap=g.gold;assert.equal(g.buyUpgrade('wind'),false);assert.equal(g.gold,goldAtCap);
assert.equal(g.buyUpgrade('bastion'),true);assert.equal(g.castle.maxHp,580);assert.equal(g.castle.hp,580);g.finishWave();assert.equal(g.buyUpgrade('oath'),true);assert.equal(g.hero.maxHp,115);assert.equal(g.hero.hp,115);
g.startGame();g.setGold(0);assert.equal(g.buyUpgrade('blade'),false,'cannot spend unavailable gold');g.setGold(1000);g.startWave();assert.equal(g.buyUpgrade('blade'),false,'cannot upgrade in battle');
g.startGame();for(const id in g.ranks)assert.equal(g.ranks[id],0);assert.equal(g.hero.maxHp,100);assert.equal(g.castle.maxHp,500);assert.equal(g.hero.dashCooldown,0);
console.log('Dash distance, shore/obstacle collisions, dodge immunity, counterattack, upgrades/costs/caps, phase restrictions and match reset: passed');

g.startGame();g.keys.add('w');g.update(1/60);g.keys.clear();g.startDash();assert.equal(g.hero.dashX,0);assert.equal(g.hero.dashY,-1,'stationary dash remembers a vertical direction');
const dashCd=g.hero.dashCooldown;g.togglePause(true);g.advance(.1);assert.equal(g.hero.dashCooldown,dashCd);g.togglePause(false);
g.startGame();g.buyUpgrade('blade');assert.equal(g.ranks.blade,1);g.allies.length=0;g.startWave();g.spawnEnemy();Object.assign(g.enemies[0],{x:650,y:400,entering:false,cooldown:999,speed:0,hp:100,maxHp:100});g.hero.x=600;g.hero.y=400;g.heroAttack();g.update(.22);assert.equal(g.enemies[0].hp,68,'blade upgrade adds actual damage');
g.startGame();g.buyUpgrade('rhythm');g.heroAttack();assert.ok(g.hero.cooldown<.58,'rhythm reduces attack cooldown');
g.startGame();g.buyUpgrade('counter');g.hero.x=600;g.hero.y=400;g.allies.length=0;g.startWave();g.spawnEnemy();Object.assign(g.enemies[0],{x:650,y:400,entering:false,cooldown:999,speed:0,hp:100,maxHp:100});g.hero.riposte=2;g.heroAttack();g.update(.22);assert.equal(g.enemies[0].hp,55,'counter perk increases riposte damage');
console.log('Vertical dash memory, paused cooldown, blade, rhythm and counter perk effects: passed');

// Formation orders: return to the anchor and do not abandon the castle.
g.startGame();g.hero.x=400;g.hero.y=400;const escort=g.allies[0];escort.x=850;escort.y=355;
assert.equal(g.setSquadOrder('follow'),true);const followBefore=Math.hypot(escort.x-g.hero.x,escort.y-g.hero.y);for(let i=0;i<120;i++)g.updateUnit(escort,1/60);assert.ok(Math.hypot(escort.x-g.hero.x,escort.y-g.hero.y)<followBefore-80);
g.setSquadOrder('guard');const guardBefore=Math.hypot(escort.x-845,escort.y-355);for(let i=0;i<180;i++)g.updateUnit(escort,1/60);assert.ok(Math.hypot(escort.x-845,escort.y-355)<guardBefore);assert.equal(g.squadAnchor().x,845);
g.togglePause(true);assert.equal(g.setSquadOrder('follow'),false);g.togglePause(false);

// Difficulty stays locked in-match, changes actual stats, and can be changed at title.
g.showTitle();assert.equal(g.setDifficulty('easy'),true);g.startGame();g.spawnEnemy();const easyHp=g.enemies[0].hp,easySpeed=g.enemies[0].speed;assert.equal(g.setDifficulty('hard'),false);
g.showTitle();g.setDifficulty('hard');g.startGame();g.spawnEnemy();assert.ok(g.enemies[0].hp>easyHp&&g.enemies[0].speed>easySpeed);g.setWave(4);g.spawnBoss();assert.equal(g.boss.hp,850);
g.showTitle();g.setDifficulty('normal');
function bossFixture(){g.startGame();g.setWave(4);assert.equal(g.spawnBoss(),true);assert.equal(g.spawnBoss(),false,'leader spawns only once');g.allies.length=0;Object.assign(g.boss,{x:500,y:400,entering:false,abilityCooldown:0});g.hero.x=650;g.hero.y=400;return g.boss;}
let leader=bossFixture();g.updateBoss(leader,.016);assert.equal(leader.bossAction.type,'slam');assert.equal(g.hero.hp,100);g.updateBoss(leader,.5);assert.equal(g.hero.hp,100,'warning must not damage early');g.hero.y=570;g.updateBoss(leader,.5);assert.equal(g.hero.hp,100,'moving out avoids slam');assert.equal(leader.bossAction.stage,'recovery');
leader=bossFixture();leader.pattern=1;g.updateBoss(leader,.016);assert.equal(leader.bossAction.type,'charge');g.updateBoss(leader,1);for(let i=0;i<28;i++)g.updateBoss(leader,1/60);assert.equal(g.hero.hp,73,'charge damages once');assert.ok(g.positionFits(leader.x,leader.y));
leader=bossFixture();leader.pattern=2;g.updateBoss(leader,.016);g.updateBoss(leader,1);assert.equal(g.projectiles.length,3,'volley emits three arrows');
leader=bossFixture();g.updateBoss(leader,.016);g.hero.dash=.2;g.hero.dashElapsed=.05;g.updateBoss(leader,1);assert.equal(g.hero.hp,100,'dash avoids leader slam');assert.ok(g.hero.riposte>0);
leader=bossFixture();leader.hp=leader.maxHp/2;g.updateBoss(leader,.016);assert.equal(leader.enraged,true);g.hurt(leader,10,g.hero);assert.equal(leader.stagger,0,'leader cannot be stun locked');
g.startGame();g.setWave(3);assert.equal(g.spawnBoss(),false,'leader is exclusive to final wave');
console.log('Follow/guard formations, difficulty stat scaling and locking, unique final leader, all three telegraphs, dodge windows, rage and recovery: passed');

g.showTitle();g.setDifficulty('hard');g.startGame();g.setWave(4);g.startWave();for(let i=0;i<20;i++)g.spawnEnemy();g.spawnBoss();
for(const enemy of g.enemies)if(!enemy.isBoss)g.hurt(enemy,enemy.hp,g.hero);
for(let i=0;i<10;i++)g.update(1/60);assert.equal(g.state,'playing','final wave cannot finish while leader is alive');
g.hurt(g.boss,g.boss.hp,g.hero);for(let i=0;i<10;i++)g.update(1/60);assert.equal(g.state,'won','leader plus all soldiers must be defeated');
g.showTitle();g.setDifficulty('normal');g.startGame();assert.equal(g.boss,null);assert.equal(g.squadAnchor().x,g.hero.x);
console.log('Hard-mode final victory requires leader defeat; title and match reset clear leader/orders: passed');

assert.ok(Number(testStorage.get('penjaga-pulau-best-normal'))>0,'normal victory saves its own best score');
assert.ok(Number(testStorage.get('penjaga-pulau-best-hard'))>0,'hard victory saves separately');
const savedNormal=testStorage.get('penjaga-pulau-best-normal');g.showTitle();g.setDifficulty('easy');assert.equal(testStorage.get('penjaga-pulau-best-normal'),savedNormal,'changing mode preserves other records');
console.log('Separate best-score persistence for each difficulty: passed');

// Formation slots survive casualties, list compaction and reinforcement.
g.showTitle();g.setDifficulty('normal');g.startGame();g.setGold(1000);for(let i=0;i<7;i++)g.recruitUnit();g.setSquadOrder('guard');
const casualty=g.allies[2],survivors=g.allies.filter(u=>u!==casualty),homes=survivors.map(u=>({unit:u,slot:u.formationSlot,point:g.squadHome(u)}));
g.hurt(casualty,casualty.hp,{team:'enemy',x:600,y:400});g.update(1/60);
for(const h of homes){assert.equal(h.unit.formationSlot,h.slot);assert.deepEqual(g.squadHome(h.unit),h.point,'survivor keeps the same formation destination');}
g.recruitUnit();assert.equal(g.allies.at(-1).formationSlot,casualty.formationSlot,'reinforcement takes vacant slot');assert.equal(new Set(g.allies.map(u=>u.formationSlot)).size,8);

// Lock the charge path at warning time, shorten it at colliders, and never slide.
for(const fixture of [
 {from:{x:730,y:250},to:{x:940,y:250},name:'castle'},
 {from:{x:730,y:280},to:{x:910,y:190},name:'diagonal castle'},
 {from:{x:160,y:326},to:{x:240,y:326},name:'tree'},
 {from:{x:170,y:405},to:{x:104,y:405},name:'shore'},
]){
 const u=bossFixture();Object.assign(u,fixture.from,{pattern:1});Object.assign(g.hero,fixture.to);assert.ok(g.positionFits(u.x,u.y),'valid start at '+fixture.name);assert.ok(g.positionFits(g.hero.x,g.hero.y),'valid target at '+fixture.name);g.updateBoss(u,1/60);
 const a=u.bossAction,end={x:a.chargeEnd.x,y:a.chargeEnd.y},speed=a.chargeSpeed;
 assert.ok(a.chargeEnd.distance<speed*.45,'warning is clipped by '+fixture.name);
 u.hp=u.maxHp*.4;g.updateBoss(u,.05);assert.equal(a.chargeSpeed,speed,'enrage cannot change a telegraphed speed');assert.deepEqual({x:a.chargeEnd.x,y:a.chargeEnd.y},end);
 g.updateBoss(u,1.2);for(let i=0;i<40&&a.stage==='charge';i++)g.updateBoss(u,1/60);
 assert.ok(Math.hypot(u.x-end.x,u.y-end.y)<.01,'actual endpoint matches warning at '+fixture.name);
 assert.ok(g.positionFits(u.x,u.y));assert.ok(Math.abs((u.x-a.origin.x)*a.dy-(u.y-a.origin.y)*a.dx)<.001,'no sliding outside warning');
}
let heavy=bossFixture();heavy.pattern=1;g.updateBoss(heavy,1/60);g.spawnEnemy();Object.assign(g.enemies.at(-1),{x:heavy.x+5,y:heavy.y,entering:false,speed:0,cooldown:999});const warningOrigin={x:heavy.x,y:heavy.y};g.update(1/60);assert.deepEqual({x:heavy.x,y:heavy.y},warningOrigin,'crowd separation cannot displace a warning origin');
heavy=bossFixture();const guardHp=heavy.hp;g.hurt(heavy,20,{team:'ally',x:450,y:400});assert.equal(heavy.hp,guardHp-11);heavy.bossAction={stage:'recovery',time:.95};g.hurt(heavy,20,{team:'ally',x:450,y:400});assert.equal(heavy.hp,guardHp-31);g.hurt(heavy,20,g.hero);assert.equal(heavy.hp,guardHp-57,'player receives the recovery window bonus');
console.log('Persistent formation slots, vacancy reuse, clipped straight charges at buildings/trees/shore, locked rage speed, immovable warning origin and recovery damage: passed');
