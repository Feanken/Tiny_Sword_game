const assert=require('node:assert/strict');
const {g}=require('./game-harness.cjs').createGame(81);
function fixture(mode='normal',pattern=0){g.showTitle();g.setDifficulty(mode);g.startGame(81);g.setWave(4);g.spawnBoss();Object.assign(g.boss,{x:540,y:410,entering:false,abilityCooldown:0,patternMask:7^(1<<pattern)});Object.assign(g.hero,{x:680,y:410});return g.boss;}
let b=fixture();g.updateBoss(b,.01);const warning=b.bossAction;warning.time=.3;b.hp=b.maxHp*.49;
g.updateBoss(b,.05);assert.equal(b.enraged,false);assert.equal(b.ragePending,true);assert.equal(b.bossAction,warning,'threshold cannot replace a warned attack');assert.equal(warning.stage,'warning');
g.hero.y=570;g.updateBoss(b,.3);assert.equal(warning.stage,'recovery');assert.ok(warning.time>=1,'first-phase opening remains intact');g.updateBoss(b,warning.time+.01);assert.equal(b.bossAction,null);g.updateBoss(b,.01);
assert.equal(b.bossAction.stage,'rally');assert.equal(b.enraged,true);const hp=g.hero.hp,position={x:b.x,y:b.y};g.updateBoss(b,.3);assert.equal(g.hero.hp,hp);assert.deepEqual({x:b.x,y:b.y},position,'phase transition does not move or attack');assert.ok(g.bossIntentText(b).includes('MENGAMUK'));const time=b.bossAction.time;g.updateBoss(b,time+.01);assert.equal(b.bossAction,null);assert.ok(b.abilityCooldown>0,'new phase has a readable exit beat');
b.hp=b.maxHp*.2;g.updateBoss(b,.1);assert.notEqual(b.bossAction?.stage,'rally','rage transition occurs only once');

for(const pattern of [0,1,2]){
 const times=[];
 for(const mode of ['easy','normal','hard']){b=fixture(mode,pattern);const action={type:['slam','charge','volley'][pattern]};g.recoverBoss(b,action);times.push(action.time);assert.equal(action.time,action.recoveryDuration);b.enraged=true;g.recoverBoss(b,action);assert.ok(action.time>=.85,'rage preserves a usable counter window');}
 assert.ok(times[0]>times[1]&&times[1]>times[2],'difficulty scales recovery without hidden stat changes');
}
b=fixture();b.bossAction={type:'slam',stage:'recovery',time:1,recoveryDuration:1};g.hero.x=600;g.hero.y=410;
const soldier={team:'enemy',kind:'Lancer'};assert.equal(g.mayStartMelee(soldier,g.hero),true);assert.equal(g.mayStartMelee(soldier,g.hero),false,'ordinary windups cannot fill the counter opening');assert.ok(g.bossIntentText(b).includes('+30%'));
for(const [mode,limit] of [['easy',1],['normal',1],['hard',2]]){
 b=fixture(mode);g.allies.length=0;g.hero.x=600;g.hero.y=410;b.bossAction={type:'slam',stage:'recovery',time:1.3,recoveryDuration:1.3};
 for(let i=0;i<5;i++){g.spawnEnemy();Object.assign(g.enemies.at(-1),{kind:'Lancer',x:625,y:410,entering:false,cooldown:0,speed:0,hp:10000});}
 let max=0;for(let i=0;i<13;i++){g.update(1/60);max=Math.max(max,g.enemies.filter(e=>e.strike?.target===g.hero).length);}
 assert.ok(max>0&&max<=limit,'counter opening limits real concurrent windups in '+mode);
}

g.startGame(11);g.setGold(1000);g.buyUpgrade('bastion');g.hero.x=845;g.hero.y=360;const hit={x:700,y:400,kind:'Warrior'};
g.beginDamageStep();g.hurt(g.hero,8,hit);g.hurt(g.hero,20,hit);g.resolveHeroDamage();assert.equal(g.hero.hp,82,'fortress applies once to the winning simultaneous hit');assert.equal(g.combatStats.fortressSaved,2);assert.equal(g.combatStats.damageTaken,18);
g.hero.invuln=0;g.hero.x=500;g.hero.y=400;g.hurt(g.hero,20,hit);assert.equal(g.hero.hp,62,'aura requires defending near the castle');
g.hero.invuln=0;g.hero.x=845;g.hero.y=360;g.castle.hp=0;g.hurt(g.hero,20,hit);assert.equal(g.hero.hp,42,'ruined castle provides no protection');
g.startGame(11);assert.equal(g.combatStats.fortressSaved,0);assert.equal(g.ranks.bastion,0);
console.log('Deferred and single rage transition, uninterrupted telegraphs, complete openings, mode recovery windows, ordinary pressure limits, fortress range/stacking/reset and damage accounting: passed');
