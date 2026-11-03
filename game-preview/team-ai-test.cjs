const assert=require('node:assert/strict');
const {g}=require('./game-harness.cjs').createGame(21);
g.startGame(21);const u={x:500,y:400,team:'enemy',kind:'Warrior'},a={x:560,y:400,hp:100,kind:'Lancer'},b={x:600,y:400,hp:100,kind:'Lancer'};
g.engagements.set(a,6);assert.equal(g.combatTarget(u,[a,b],220),b,'choose an uncovered opponent instead of stacking on one target');
u.protectTarget=a;u.combatTarget=null;assert.equal(g.combatTarget(u,[a,b],220),a,'protecting support takes precedence over distributing attackers');

g.startGame(4);g.setGold(1000);g.recruitUnit();g.setSquadOrder('guard');g.spawnEnemy();
const archer=g.allies[0],enemy=g.enemies[0];Object.assign(archer,{x:500,y:400,cooldown:0,strike:{timer:.001,target:enemy,range:225}});Object.assign(enemy,{x:520,y:400,entering:false,hp:100});
g.updateUnit(archer,.02);assert.equal(g.projectiles.length,0,'leash return cancels a queued shot before release');assert.equal(archer.strike,null);
archer.arrowGoal={x:300,y:400};archer.arrowEvade=.3;archer.supportGoal={x:320,y:400};g.setSquadOrder('follow');assert.equal(archer.arrowEvade,0);assert.equal(archer.supportGoal,null,'new command clears old tactical destinations');

g.startGame(8);g.setGold(1000);g.recruitUnit();const healer=g.allies[0],patient=g.allies[1];
Object.assign(healer,{kind:'Monk',x:730,y:250,cooldown:0});Object.assign(g.hero,{x:940,y:250,hp:10});Object.assign(patient,{x:700,y:380,hp:60});
assert.equal(g.healingTarget(healer,[g.hero,patient]),patient,'effective healing in reach takes precedence over chasing a patient behind cover');g.updateUnit(healer,.016);assert.equal(patient.hp,76);assert.equal(g.hero.hp,10);

g.startGame(9);Object.assign(g.hero,{x:650,y:400});const support=g.allies[0];Object.assign(support,{x:650,y:400,speed:88,stagger:0});
g.projectiles.push({x:560,y:400,vx:360,vy:0,team:'enemy',life:1});assert.equal(g.evadeProjectile(support,1/60),true,'support notices a visible incoming arrow');assert.ok(support.arrowGoal&&g.positionFits(support.arrowGoal.x,support.arrowGoal.y));assert.equal(support.hp,support.maxHp,'avoidance does not fabricate damage or immunity');
g.projectiles.length=0;support.arrowEvade=0;support.arrowThink=0;g.projectiles.push({x:560,y:400,vx:360,vy:0,team:'ally',life:1});assert.equal(g.evadeProjectile(support,1/60),false,'friendly arrows do not trigger evasion');
for(const [start,expected] of [[560,100],[645,90]]){
 g.startGame(9);Object.assign(g.hero,{x:740,y:480});Object.assign(g.allies[0],{x:650,y:400});
 g.projectiles.push({x:start,y:400,vx:360,vy:0,team:'enemy',life:1,damage:10,source:{x:500,y:400,kind:'Archer'}});
 for(let i=0;i<(start===560?24:1);i++)g.update(1/60);
 assert.equal(g.allies[0].hp,expected,start===560?'visible incoming arrow can be dodged':'late reaction still takes arrow damage');
}

g.startGame(12);g.setGold(1000);g.recruitUnit();g.update(.001);const left=g.allies[0],right=g.allies[1];Object.assign(left,{x:450,y:400,entering:false});Object.assign(right,{x:490,y:400,entering:false});
for(let i=0;i<100;i++){g.navigateStep(left,1,0,1/60,88);g.navigateStep(right,-1,0,1/60,88);}
assert.ok(left.x>right.x+80,'opposing traffic passes without locking');assert.ok(g.positionFits(left.x,left.y)&&g.positionFits(right.x,right.y));
for(const p of [{x:170,y:405},{x:780,y:250},{x:1150,y:420}]){Object.assign(g.hero,p);const home=g.squadHome(left);assert.ok(g.positionFits(home.x,home.y),'formation home remains walkable near shore/buildings');}
g.startGame(12);assert.equal(g.engagements.size,0,'engagement counts clear on restart');
console.log('Distributed targets, support interception priority, command-before-strike, tactical reset, reachable healer triage, visible-arrow evasion, passing traffic and walkable formation homes: passed');
