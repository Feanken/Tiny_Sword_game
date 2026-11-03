const assert=require('node:assert/strict');const {g,snapshot}=require('./game-harness.cjs').createGame(55);
const prices={blade:45,rhythm:40,wind:35,counter:35,bastion:40,oath:40};
g.startGame(55);g.setGold(10000);let spent=0;
for(const [id,base] of Object.entries(prices)){
 for(let rank=1;rank<=5;rank++){const before=g.gold;assert.equal(g.buyUpgrade(id),true);assert.equal(g.ranks[id],rank);assert.equal(before-g.gold,base+(rank-1)*20);spent+=base+(rank-1)*20;}
 assert.equal(g.ranks[id],5);
}
assert.equal(g.gold,10000-spent);assert.equal(snapshot().upgradeMaxLevel,10);assert.equal(g.hero.maxHp,175);assert.equal(g.castle.maxHp,900);assert.equal(g.fortressRadius(),260);
g.startDash();assert.ok(Math.abs(g.hero.dashCooldown-1.15)<1e-9);g.hero.dash=0;g.hero.cooldown=0;g.requestAttack();assert.ok(Math.abs(g.hero.cooldown-.406)<1e-9);assert.equal(g.hero.attackDuration,g.hero.cooldown,'fastest attack animation finishes before the next swing');assert.equal(g.heroPose().age,0,'fastest rhythm starts at anticipation frame zero');
g.startGame(55);g.setGold(79);assert.equal(g.buyUpgrade('wind'),true);assert.equal(g.buyUpgrade('oath'),true);assert.equal(g.gold,4);const before=g.gold;assert.equal(g.buyUpgrade('blade'),false);assert.equal(g.gold,before);
g.setGold(1000);g.togglePause(true);assert.equal(g.buyUpgrade('blade'),false,'ordinary pause cannot buy upgrades');g.togglePause(false);g.startWave();assert.equal(g.buyUpgrade('blade'),false,'battle cannot buy upgrades');
g.startGame(55);assert.ok(Object.values(g.ranks).every(rank=>rank===0));assert.equal(g.hero.maxHp,100);assert.equal(g.castle.maxHp,500);assert.equal(snapshot().campPurchased,false);
g.setGold(1000);for(let i=0;i<5;i++)g.buyUpgrade('blade');g.allies.length=0;g.spawnEnemy();Object.assign(g.hero,{x:600,y:400});Object.assign(g.enemies[0],{x:650,y:400,hp:1000,maxHp:1000,speed:0,cooldown:999,entering:false});g.requestAttack();g.advance(.1);g.advance(.05);assert.equal(g.enemies[0].hp,1000);g.advance(.1);assert.equal(g.enemies[0].hp,948,'level-five blade deals the expected primary damage');
console.log('Five-rank milestone regression, prices, funds/state restrictions, level-five combat/dash/caps and reset: passed');
