const assert=require('node:assert/strict');
const {g,snapshot}=require('./game-harness.cjs').createGame(19);
const rosters=new Set(),styles=new Set();
for(let seed=1;seed<=30;seed++){
 const plan=g.makeEncounters(seed);assert.deepEqual(plan,g.makeEncounters(seed));
 for(let wave=0;wave<5;wave++){
  assert.equal(plan[wave].roster.length,[7,10,13,16,20][wave]);
  assert.ok(plan[wave].roster.filter(k=>k==='Monk').length<=4);assert.equal(plan[wave].roster[0],'Warrior');
  if(wave<2)assert.ok(!plan[wave].roster.includes('Monk'));
  if(wave>0){rosters.add(plan[wave].roster.join(','));styles.add(plan[wave].name);}
 }
}
assert.equal(styles.size,3);assert.ok(rosters.size>20,'replays vary authored wave formations');
function opening(){g.startGame(12345);g.setWave(2);for(let i=0;i<13;i++)g.spawnEnemy();return JSON.stringify(snapshot().enemies);}
assert.equal(opening(),opening(),'same expedition reproduces spawn kinds, positions and health');

function leader(pattern){
 g.startGame(77);g.setWave(4);g.spawnBoss();Object.assign(g.boss,{x:540,y:410,entering:false,abilityCooldown:0,patternMask:pattern===undefined?0:7^(1<<pattern),lastPattern:-1});Object.assign(g.hero,{x:680,y:410});return g.boss;
}
for(const [distance,expected] of [[75,'slam'],[140,'charge'],[200,'volley']]){const b=leader();g.hero.x=b.x+distance;assert.equal(g.chooseBossPattern(b,g.hero),expected);}
let b=leader(),previous=null;
for(let cycle=0;cycle<3;cycle++){
 const used=new Set();for(let i=0;i<3;i++){const next=g.chooseBossPattern(b,g.hero);assert.notEqual(next,previous,'no immediate pattern repeats');used.add(next);previous=next;}assert.equal(used.size,3,'every pattern remains available each cycle');
}
for(let pattern=0;pattern<3;pattern++){
 b=leader(pattern);const ally=g.allies[0];Object.assign(ally,{kind:'Warrior',x:640,y:410,speed:88});g.updateBoss(b,1/60);
 for(let i=0;i<48;i++){g.updateUnit(ally,1/60);g.updateBoss(b,1/60);}
 assert.ok(!g.bossDangerAt(ally),'ally leaves warning for pattern '+pattern);assert.equal(g.combatStats.allyEvades,1);
 const safe={x:ally.x,y:ally.y};for(let i=0;i<3;i++)g.updateUnit(ally,1/60);assert.deepEqual({x:ally.x,y:ally.y},safe,'melee ally holds safe ground until attack resolves');
 for(let i=0;i<30;i++){g.updateUnit(ally,1/60);g.updateBoss(b,1/60);}assert.ok(g.positionFits(ally.x,ally.y));assert.equal(ally.hp,ally.maxHp,'ally avoids actual slam/charge damage');
}
b=leader(0);const late=g.allies[0];Object.assign(late,{kind:'Warrior',x:680,y:410,speed:88});g.updateBoss(b,.01);b.bossAction.time=.02;g.updateUnit(late,.01);g.updateBoss(b,.03);assert.ok(late.hp<late.maxHp,'late allies have no hidden immunity');

g.startGame(91);g.spawnEnemy();g.spawnEnemy();const guard=g.enemies[0],support=g.enemies[1];
Object.assign(guard,{kind:'Warrior',x:500,y:400,entering:false});Object.assign(support,{kind:'Archer',x:520,y:400,entering:false});Object.assign(g.hero,{x:560,y:400});
g.updateRole(guard,.01);assert.equal(guard.protectTarget,g.hero,'frontliner identifies a threat to friendly support');
const closer={x:480,y:400,hp:100,kind:'Lancer'};assert.equal(g.combatTarget(guard,[g.hero,closer],210),g.hero,'support interception can outweigh nearest enemy');
const archer={team:'enemy',kind:'Archer',x:500,y:400},fighter={kind:'Warrior',x:630,y:400,hp:100},monk={kind:'Monk',x:650,y:400,hp:100};
assert.equal(g.combatTarget(archer,[fighter,monk],240),monk,'archer values vulnerable support');
g.startGame(4);g.spawnEnemy();const lone=g.enemies[0];Object.assign(lone,{kind:'Monk',x:1030,y:589,hp:12,entering:false,cooldown:0});Object.assign(g.hero,{x:269,y:463});
const before=Math.hypot(lone.x-620,lone.y-410);for(let i=0;i<180;i++)g.updateUnit(lone,1/60);assert.ok(Math.hypot(lone.x-620,lone.y-410)<before-40,'last healer regroups instead of retreating forever');

const shooter={x:730,y:250,team:'enemy'},target={x:940,y:250};const firing=g.firingPosition(shooter,target);assert.ok(firing&&g.positionFits(firing.x,firing.y)&&g.shotClear(firing,target),'archer finds a clear firing position around cover');
const retreat=g.tacticalRetreat({x:112,y:405,team:'enemy'},{x:170,y:405});assert.ok(retreat&&g.positionFits(retreat.x,retreat.y),'retreat near shore stays on land');
g.startGame(7);assert.equal(g.combatStats.allyEvades,0);assert.equal(g.combatStats.roleIntercepts,0);
console.log('Seeded wave variety/replay, adaptive complete boss pattern cycles, real ally evasion/hold/reaction, support protection, ranged positioning, shore safety and lone-healer regrouping: passed');
