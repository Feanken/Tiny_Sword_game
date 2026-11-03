const assert=require('node:assert/strict');const {g,snapshot}=require('./game-harness.cjs').createGame(55);
const prices={blade:45,rhythm:40,wind:35,counter:35,bastion:40,oath:40};
g.startGame(55);g.setGold(10000);
for(const [id,base] of Object.entries(prices))for(let rank=1;rank<=10;rank++){
 const before=g.gold;assert.equal(g.buyUpgrade(id),true);assert.equal(before-g.gold,base+(rank-1)*20);assert.equal(g.milestone(id),Math.floor(rank/5));
 if(rank===4||rank===9)assert.equal(g.milestone(id),rank===4?0:1,'no early milestone');
 if(rank===10){const capped=g.gold;assert.equal(g.buyUpgrade(id),false);assert.equal(g.gold,capped);}
}
assert.equal(g.gold,2250);assert.equal(snapshot().upgradeMaxLevel,10);assert.equal(g.hero.maxHp,250);assert.equal(g.castle.maxHp,1300);
assert.equal(g.swingCap(),5);assert.equal(g.counterBonus(),88);assert.ok(Math.abs(g.foodCooldown()-1.2)<1e-9);assert.ok(Math.abs(g.dashCooldown()-.75)<1e-9);assert.ok(g.attackCooldown()>.28);
g.requestAttack();assert.ok(Math.abs(g.hero.cooldown-.319)<1e-9);assert.equal(g.heroPose().age,0);assert.ok(Math.abs(g.heroMoveScale()-.75)<1e-9);
const hp=g.castle.hp;g.hurt(g.castle,20,{x:500,y:400});assert.equal(g.castle.hp,hp-12,'level ten castle armor absorbs 40%');
g.hero.attack=0;g.hero.cooldown=0;g.startDash();g.hero.dashElapsed=.19;g.hurt(g.hero,20,{x:500,y:400});assert.equal(g.hero.hp,250,'level ten wind protects late dash');
for(const rank of [4,5,6,9,10]){
 g.startGame(55);g.setGold(10000);for(let i=0;i<rank;i++)for(const id of Object.keys(prices))g.buyUpgrade(id);
 assert.equal(g.swingCap(),3+Math.floor(rank/5));const before=g.castle.hp;g.hurt(g.castle,20,{x:500,y:400});assert.equal(before-g.castle.hp,20-Math.floor(rank/5)*4);
 assert.equal(g.counterBonus(),12+rank*6+Math.floor(rank/5)*8);g.hero.hp=1;g.healHero();assert.ok(Math.abs(g.hero.healCooldown-(1.8-Math.floor(rank/5)*.3))<1e-9);
}
g.startGame(55);assert.ok(Object.values(g.ranks).every(n=>n===0));assert.equal(g.swingCap(),3);assert.equal(g.counterBonus(),12);assert.equal(g.heroMoveScale(),1);assert.equal(g.foodCooldown(),1.8);
for(const [rank,cap] of [[4,3],[5,4],[10,5]]){
 g.startGame(55);g.setGold(10000);for(let i=0;i<rank;i++)g.buyUpgrade('blade');g.allies.length=0;Object.assign(g.hero,{x:600,y:400});
 for(let i=0;i<6;i++){g.spawnEnemy();Object.assign(g.enemies.at(-1),{x:650,y:400,hp:1000,maxHp:1000,entering:false});}
 g.heroAttack();g.updateHeroSwing(.3);assert.equal(g.enemies.filter(e=>e.hp<1000).length,cap,'milestone changes real cleave contacts');
}
g.startGame(55);g.setGold(10000);for(let i=0;i<10;i++)g.buyUpgrade('counter');g.allies.length=0;Object.assign(g.hero,{x:600,y:400,riposte:1});g.spawnEnemy();Object.assign(g.enemies[0],{x:650,y:400,hp:1000,maxHp:1000});g.heroAttack();g.updateHeroSwing(.3);assert.equal(g.enemies[0].hp,885,'level ten counter applies the actual bonus');assert.equal(g.hero.riposte,0);
console.log('60 purchases, exact costs, cap 10, milestone boundaries 4/5/6/9/10, all six real buffs, positive combat timing and reset: passed');
