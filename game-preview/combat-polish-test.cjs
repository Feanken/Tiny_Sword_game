const assert=require('node:assert/strict');
const {createGame}=require('./game-harness.cjs');const {g}=createGame(77);
function reset(){g.startGame(77);g.allies.length=0;Object.assign(g.hero,{x:600,y:400});}
function steps(n){for(let i=0;i<n;i++)g.advance(1/60);}
reset();g.keyboardInput('a',true);g.pointerInput(1,'a',true);g.pointerInput(2,'a',true);g.pointerInput(1,null,false);g.pointerInput(2,null,false);assert.ok(g.keys.has('a'),'touch release preserves keyboard');g.keyboardInput('a',false);assert.ok(!g.keys.has('a'));
g.pointerInput(1,' ',true);g.pointerInput(2,' ',true);g.pointerInput(1,null,false);assert.ok(g.keys.has(' '),'one finger cannot release the other');g.pointerInput(2,null,false);assert.ok(!g.keys.has(' '));
reset();g.hero.dashCooldown=.08;g.requestDash();steps(6);assert.ok(g.hero.dash>0);steps(60);assert.equal(g.hero.dash,0,'queued dash runs once');
reset();g.hero.dashCooldown=.4;g.requestDash();steps(35);assert.equal(g.hero.dash,0,'early dash tap expires');
reset();g.startDash();steps(7);g.requestAttack();steps(7);assert.equal(g.combatStats.swings,1,'late dash tap flows into one attack');steps(60);assert.equal(g.combatStats.swings,1);
reset();g.hero.cooldown=g.hero.dashCooldown=.08;g.requestAttack();g.requestDash();steps(6);assert.ok(g.hero.dash>0);assert.equal(g.combatStats.swings,0,'dash has priority over both queued actions');
for(const action of [()=>g.togglePause(true),()=>g.startGame(),()=>g.hurt(g.hero,10,{x:500,y:400})]){
 reset();g.hero.cooldown=g.hero.dashCooldown=.08;g.pointerInput(5,'a',true);g.requestAttack();g.requestDash();action();assert.equal(g.hero.attackBuffer,0);assert.equal(g.hero.dashBuffer,0);
 if(g.state==='paused'){g.togglePause(false);steps(10);assert.equal(g.combatStats.swings,0);assert.equal(g.hero.dash,0);assert.equal(g.keys.size,0);}
}
reset();g.spawnEnemy();const target=g.enemies[0];Object.assign(target,{x:650,y:400,hp:1000,maxHp:1000,entering:false,speed:0,cooldown:999});g.hero.riposte=.01;g.requestAttack();steps(18);assert.equal(target.hp,961,'a counter started in time keeps its bonus through anticipation');assert.equal(g.hero.riposte,0);
reset();g.hero.riposte=.1;g.requestAttack();g.startDash();steps(20);assert.equal(g.hero.swingEmpowered,false);assert.equal(g.hero.riposte,0,'cancel cannot preserve an expired counter');
reset();g.keyboardInput('a',true);g.requestAttack();assert.equal(g.hero.facing,-1,'movement input is considered before the next simulation step');
reset();g.advance(NaN);g.advance(Infinity);g.advance(-1);steps(1);assert.ok(Number.isFinite(g.time)&&g.time>0,'invalid frame deltas cannot poison the accumulator');
function replay(fps){const {g}=createGame(77);g.startGame(77);g.allies.length=0;g.float('proof',600,400);g.keys.add('d');g.requestAttack();for(let i=0;i<fps/2;i++)g.advance(1/fps);return {x:+g.hero.x.toFixed(6),attack:+g.hero.attack.toFixed(6),effects:g.effects.length,floaters:g.floaters.map(f=>[f.text,+f.life.toFixed(6),+f.y.toFixed(6)])};}
assert.equal(JSON.stringify(replay(30)),JSON.stringify(replay(60)));assert.equal(JSON.stringify(replay(60)),JSON.stringify(replay(120)),'presentation and combat share the fixed clock');
reset();g.float('temporary',600,400);steps(65);assert.equal(g.floaters.length,0,'headless simulation also cleans presentation');
g.resetLabels();g.reserveLabel(600,300,80,30,'player');const a={},b={};const offsets=[[0,0],[-90,0],[90,0]];const ra=g.placeLabel(a,600,300,30,20,offsets),rb=g.placeLabel(b,600,300,30,20,offsets);assert.ok(ra&&rb);assert.ok(Math.abs(ra.x-rb.x)>30,'labels occupy separate slots');assert.equal(g.placeLabel({},600,300,30,20,[[0,0]]),null,'minor labels yield when space is exhausted');
console.log('Independent input owners, dash buffer/priority/expiry, attack after dash, pause/damage/reset, committed counter bonus, invalid delta recovery, fixed visual clock and label collision: passed');
