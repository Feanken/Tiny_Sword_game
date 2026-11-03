const assert=require('node:assert/strict');const {createGame}=require('./game-harness.cjs');const {g,snapshot}=createGame(31);
const counts=[7,10,13,16,20],names=new Set();
for(let seed=1;seed<=500;seed++){
 const plans=g.makeEncounters(seed);assert.equal(JSON.stringify(plans),JSON.stringify(g.makeEncounters(seed)));
 assert.equal(new Set(plans.slice(1,4).map(p=>p.name)).size,3,'every expedition includes each tactical style');assert.notEqual(plans[3].name,plans[4].name);
 for(let w=0;w<5;w++){
  const p=plans[w];assert.equal(p.roster.length,counts[w]);assert.equal(p.spawnLanes.length,counts[w]);assert.equal(p.roster[0],'Warrior');
  assert.equal(p.groups.reduce((n,v)=>n+v.count,0),counts[w]);
  let start=0;for(const group of p.groups){assert.equal(group.start,start);assert.ok(group.count>=1&&group.count<=3);assert.ok(Number.isFinite(group.delay)&&group.delay>0);const roles=p.roster.slice(start,start+group.count);assert.ok(roles.filter(k=>k==='Monk').length<=1,'healers cannot arrive stacked in one packet');start+=group.count;}
  assert.ok(p.spawnLanes.every(l=>Number.isInteger(l)&&Math.abs(l)<=2));if(w>0)names.add(p.name);
 }
}
assert.equal(names.size,3);
for(const [mode,limit] of [['easy',1],['normal',2],['hard',3]])for(const distance of [70,180]){
 g.showTitle();g.setDifficulty(mode);g.startGame(31);g.allies.length=0;Object.assign(g.hero,{x:760,y:410,hp:100000,maxHp:100000});
 for(let i=0;i<6;i++){g.spawnEnemy();Object.assign(g.enemies.at(-1),{kind:'Archer',x:760-distance,y:380+i*10,entering:false,speed:0,cooldown:0,hp:10000,maxHp:10000});}
 for(let i=0;i<300;i++){g.advance(1/60);assert.ok(g.enemies.filter(u=>u.strike?.target===g.hero).length<=limit,'ranged windup cap in '+mode);}
 assert.ok(g.combatStats.maxRangedWindups>0&&g.combatStats.maxRangedWindups<=limit);assert.ok(g.combatStats.rangedDeferrals>0);assert.ok(g.combatStats.damageBySource.Archer>0,'limited archers remain dangerous');
}
for(const [mode,limit] of [['easy',1],['normal',1],['hard',2]]){
 g.showTitle();g.setDifficulty(mode);g.startGame(31);g.allies.length=0;g.setWave(4);g.spawnBoss();Object.assign(g.boss,{entering:false,x:540,y:410,abilityCooldown:0});Object.assign(g.hero,{x:710,y:410});g.updateBoss(g.boss,.01);g.boss.bossAction.time=g.boss.bossAction.duration=2;
 for(let i=0;i<6;i++){g.spawnEnemy();Object.assign(g.enemies.at(-1),{kind:'Archer',x:600,y:390+i*9,entering:false,speed:0,cooldown:0,hp:10000});}
 for(let i=0;i<24;i++){g.advance(1/60);assert.ok(g.enemies.filter(u=>u.kind==='Archer'&&u.strike?.target===g.hero).length<=limit,'boss warning preserves a response window');}
}
g.startGame(31);g.setGold(1000);assert.equal(g.buyUpgrade('oath'),true);assert.equal(g.hero.maxHp,115);g.hero.hp=1;g.healHero();assert.equal(g.hero.hp,51);assert.equal(g.combatStats.oathHealing,5);
Object.assign(g.hero,{hp:113,healCooldown:0});g.healHero();assert.equal(g.hero.hp,115,'food cannot exceed the upgraded maximum');
const monk=g.allies[0];Object.assign(monk,{kind:'Monk',x:650,y:410,cooldown:0,healThink:0});Object.assign(g.hero,{x:600,y:410,hp:10});g.updateUnit(monk,.01);assert.equal(g.hero.hp,28,'ally monk uses the Oath healing bonus');assert.equal(g.combatStats.oathHealing,7);
g.startGame(31);assert.equal(g.combatStats.oathHealing,0);assert.equal(g.combatStats.rangedDeferrals,0);assert.equal(g.combatStats.maxRangedWindups,0);
g.showTitle();g.setDifficulty('normal');g.startGame(31);g.allies.length=0;Object.assign(g.hero,{x:760,y:410});
for(let i=0;i<2;i++){g.spawnEnemy();Object.assign(g.enemies.at(-1),{kind:'Archer',x:600,y:395+i*30,entering:false,cooldown:999,speed:0,strike:{timer:.1,target:g.hero,range:225},attack:.5,attackDuration:.72});}
g.setWave(4);g.spawnBoss();Object.assign(g.boss,{entering:false,x:540,y:410,bossAction:{type:'slam',stage:'warning',time:2,duration:2,target:{x:760,y:410},origin:{x:540,y:410}}});
for(const archer of g.enemies.filter(u=>u.kind==='Archer'))g.updateUnit(archer,.11);assert.equal(g.projectiles.length,2,'already committed shots finish when a boss warning begins');
g.startGame(31);
assert.equal(snapshot().upgrades.oath,0);console.log('500 seeded expeditions, complete style coverage, packet roles/lanes, real ranged pressure per difficulty/branch, boss response windows, Oath food/monk healing, caps and reset: passed');
g.startGame(31);g.setGold(1000);g.buyUpgrade('bastion');assert.equal(g.fortressRadius(),180);
Object.assign(g.hero,{x:g.castle.x-175,y:g.castle.y});g.hurt(g.hero,20,{x:500,y:310});assert.equal(g.hero.hp,82,'rank one covers the expanded courtyard');
Object.assign(g.hero,{x:g.castle.x-185,invuln:0});g.hurt(g.hero,20,{x:500,y:310});assert.equal(g.hero.hp,62,'protection ends at the visible perk range');
g.finishWave();g.buyUpgrade('bastion');assert.equal(g.fortressRadius(),200);Object.assign(g.hero,{x:g.castle.x-195,invuln:0,hp:100});g.hurt(g.hero,20,{x:500,y:310});assert.equal(g.hero.hp,84);
Object.assign(g.hero,{x:g.castle.x-205,invuln:0});g.hurt(g.hero,20,{x:500,y:310});assert.equal(g.hero.hp,64);console.log('Bastion rank radius growth and exact protection boundaries: passed');
