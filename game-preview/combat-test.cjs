const assert=require('node:assert/strict');
const {g}=require('./game-harness.cjs').createGame(73);
g.startGame();g.hero.cooldown=.08;g.requestAttack();assert.equal(g.hero.attack,0);
for(let i=0;i<6;i++)g.update(1/60);
assert.ok(g.hero.attack>0,'released tap starts when cooldown ends');
for(let i=0;i<90;i++)g.update(1/60);
assert.equal(g.hero.attack,0,'one tap cannot produce repeated attacks');
g.hero.cooldown=.4;g.requestAttack();for(let i=0;i<30;i++)g.update(1/60);assert.equal(g.hero.attack,0,'old taps expire');
g.hero.cooldown=.08;g.requestAttack();g.startDash();assert.equal(g.hero.attackBuffer,0);
g.startGame();g.hero.cooldown=.08;g.requestAttack();g.togglePause(true);g.togglePause(false);g.update(.1);assert.equal(g.hero.attack,0,'pause clears queued attack');
g.requestAttack();g.startGame();assert.equal(g.hero.attackBuffer,0,'restart clears queued attack');

const unit={x:500,y:400,kind:'Warrior'},a={x:550,y:400,hp:100},b={x:560,y:400,hp:100};
assert.equal(g.combatTarget(unit,[a,b],200),a);b.x=548;assert.equal(g.combatTarget(unit,[a,b],200),a,'small distance changes do not switch targets');
b.x=510;assert.equal(g.combatTarget(unit,[a,b],200),b,'much closer threat can replace target');b.hp=0;assert.equal(g.combatTarget(unit,[a,b],200),a,'dead targets are released');
assert.equal(g.combatTarget(unit,[],200),null,'targets outside command area are released');

g.startGame();g.spawnEnemy();g.spawnEnemy();
const archer=g.allies[0],blocked=g.enemies[0],clear=g.enemies[1];
Object.assign(archer,{x:730,y:250,cooldown:0});Object.assign(blocked,{x:940,y:250,entering:false});Object.assign(clear,{x:700,y:380,entering:false});
assert.equal(g.shotClear(archer,blocked),false);assert.equal(g.shotClear(archer,clear),true);
assert.equal(g.combatTarget(archer,[blocked,clear],470),clear,'archer chooses visible enemy');
g.enemies.pop();g.updateUnit(archer,1/60);assert.equal(archer.strike,null,'blocked archer moves instead of winding up');
archer.strike={timer:.01,target:blocked,range:225};g.updateUnit(archer,.02);assert.equal(g.projectiles.length,0,'cover appearing during windup prevents wasteful shot');
Object.assign(archer,{x:600,y:400,cooldown:0,attack:0,strike:null});Object.assign(blocked,{x:760,y:400});
assert.equal(g.shotClear(archer,blocked),true);g.updateUnit(archer,.01);assert.ok(archer.strike);g.updateUnit(archer,.32);assert.equal(g.projectiles.length,1,'clear shot still fires');
const arrow=g.projectiles[0];assert.ok(Math.abs((blocked.x-arrow.x)*arrow.vy-(blocked.y-arrow.y)*arrow.vx)<1e-8,'arrow trajectory agrees with the checked line of fire');
g.startGame();g.spawnEnemy();Object.assign(g.hero,{x:170,y:326,facing:-1});Object.assign(g.enemies[0],{x:230,y:326});g.heroAttack();assert.equal(g.hero.facing,-1,'hero does not auto-face a target hidden behind a tree');
g.startGame();g.hero.cooldown=.08;g.requestAttack();g.hurt(g.hero,10,{x:600,y:400});assert.equal(g.hero.attackBuffer,0,'damage cancels a queued attack');
g.startGame();g.hero.x=610;g.hero.y=510;g.gather();assert.ok(g.hero.work);g.hero.cooldown=.08;g.requestAttack();assert.equal(g.hero.work,null,'buffered tap immediately cancels gathering');
g.startGame();g.hero.x=250;g.hero.y=400;g.spawnEnemy();const melee=g.allies[0];Object.assign(melee,{kind:'Warrior',x:176,y:326,cooldown:0});Object.assign(g.enemies[0],{x:224,y:326});assert.equal(g.clearPath(melee,g.enemies[0]),false);g.updateUnit(melee,.01);assert.equal(melee.strike,null,'melee unit routes around a tree instead of swinging into it');
console.log('Tap buffering/expiry/cancellation, stable target selection, cover-aware archer movement and release-time shot validation: passed');

// A blade sweeps across its active interval and remembers contacts across steps.
function swingFixture(){g.startGame();g.allies.length=0;Object.assign(g.hero,{x:600,y:400,facing:1});g.spawnEnemy();Object.assign(g.enemies[0],{x:650,y:400,hp:100,maxHp:100,entering:false,cooldown:999,speed:0});return g.enemies[0];}
let victim=swingFixture();g.heroAttack();g.updateHeroSwing(.15);assert.equal(victim.hp,100,'windup cannot deal damage');g.updateHeroSwing(.07);assert.equal(victim.hp,73);g.updateHeroSwing(.05);assert.equal(victim.hp,73,'same enemy cannot be hit twice in active window');g.updateHeroSwing(.02);assert.equal(g.hero.strike,null);
victim=swingFixture();g.heroAttack();g.updateHeroSwing(.3);assert.equal(victim.hp,73,'sweep survives a step crossing the whole active interval');
victim=swingFixture();g.heroAttack();victim.x=550;g.updateHeroSwing(.3);assert.equal(victim.hp,100,'moving behind a committed swing avoids damage');assert.equal(g.combatStats.misses,1);
victim=swingFixture();g.heroAttack();g.updateHeroSwing(.29);victim.x=640;const hpAfter=victim.hp;g.updateHeroSwing(.2);assert.equal(victim.hp,hpAfter,'recovery cannot deal damage');
victim=swingFixture();for(let i=0;i<4;i++){g.spawnEnemy();Object.assign(g.enemies.at(-1),{x:650,y:390+i*5,hp:100,maxHp:100});}g.heroAttack();for(let i=0;i<20;i++)g.updateHeroSwing(1/60);assert.equal(g.enemies.filter(e=>e.hp<100).length,3,'cleave cap spans the whole sweep');assert.equal(g.combatStats.hits,3);

// Impact poses never stop movement, cooldowns, projectiles or encounter time.
victim=swingFixture();g.heroAttack();g.update(.22);const cd=g.hero.cooldown,x=g.hero.x,time=g.time;g.keys.add('d');g.update(1/60);g.keys.clear();assert.ok(g.hero.cooldown<cd&&g.hero.x>x&&g.time>time,'global simulation continues after contact');

// Aggregate a simulation step in constant space; strongest eligible hit wins.
const weak={combatId:1,kind:'Pawn',x:500,y:400},strong={combatId:2,isBoss:true,x:500,y:400};
for(const order of [[weak,strong],[strong,weak]]){g.startGame();g.beginDamageStep();for(const source of order)g.hurt(g.hero,source===strong?30:8,source);assert.equal(g.hero.hp,100,'defer application until the step is complete');g.resolveHeroDamage();assert.equal(g.hero.hp,70);assert.equal(g.combatStats.damageBySource.boss,30);assert.equal(g.combatStats.mergedHits,1);g.hurt(g.hero,30,strong);assert.equal(g.hero.hp,70,'post-hit immunity remains');}
g.startGame();g.startDash();g.beginDamageStep();g.hurt(g.hero,30,strong);g.resolveHeroDamage();assert.equal(g.hero.hp,100);assert.ok(g.hero.riposte>0,'aggregation preserves perfect dodges');

// Healers favor critical patients and obey cover and cooldown rules.
g.startGame();g.setGold(1000);g.recruitUnit();const healer=g.allies[0],critical=g.allies[1];
Object.assign(healer,{kind:'Monk',x:650,y:400,cooldown:0});Object.assign(g.hero,{x:600,y:400,hp:99});Object.assign(critical,{x:750,y:400,hp:10});g.updateUnit(healer,.01);assert.equal(critical.hp,26);assert.equal(g.hero.hp,99);assert.equal(g.combatStats.healingDone,16);assert.equal(g.combatStats.healingWasted,0);
g.updateUnit(healer,.01);assert.equal(critical.hp,26,'healing respects cooldown');
Object.assign(healer,{x:730,y:250,cooldown:0,healThink:0});Object.assign(critical,{x:940,y:250});Object.assign(g.hero,{x:740,y:280,hp:100});g.updateUnit(healer,.01);assert.equal(critical.hp,26,'healing cannot cross castle cover');

// Reused approach reservations remain unique and bounded.
g.startGame();g.hero.x=600;g.hero.y=400;const attackers=[];for(let i=0;i<8;i++){g.spawnEnemy();const u=g.enemies.at(-1);Object.assign(u,{x:500,y:400,entering:false});g.approachPoint(u,g.hero,51);attackers.push(u);}assert.equal(new Set(attackers.map(u=>u.approachSlot)).size,8);assert.equal(g.approachSlots.size,1);
for(const u of attackers)Object.assign(u,{x:600,y:400,cooldown:999});g.setGold(1000);g.recruitUnit();const friend=g.allies[0];Object.assign(friend,{x:600,y:400,cooldown:999});g.update(.016);assert.ok(g.enemies.some(u=>Math.hypot(u.x-friend.x,u.y-friend.y)>1),'opposing teams separate');assert.ok(g.enemies.every(u=>g.positionFits(u.x,u.y)));
g.startGame();Object.assign(g.hero,{x:600,y:400});g.spawnEnemy();const switching=g.enemies[0];Object.assign(switching,{x:650,y:400,entering:false});Object.assign(g.allies[0],{x:650,y:390});g.approachPoint(switching,g.hero,51);g.updateUnit(switching,.01);assert.equal(switching.approachTarget,null,'switching to an in-range target releases the previous reservation');assert.ok(!g.approachSlots.get(g.hero).includes(switching));
g.approachPoint(g.allies[0],switching,51);g.hero.x=1000;g.hero.y=400;g.updateUnit(g.allies[0],.01);assert.equal(g.allies[0].approachTarget,null,'leash return releases a combat slot');

// Pressure is bounded per mode, while existing attacks can finish normally.
for(const [mode,limit] of [['easy',2],['normal',3],['hard',4]]){
 g.showTitle();g.setDifficulty(mode);g.startGame();g.allies.length=0;g.hero.x=600;g.hero.y=400;g.hero.hp=10000;g.hero.maxHp=10000;
 for(let i=0;i<8;i++){g.spawnEnemy();Object.assign(g.enemies.at(-1),{kind:'Lancer',x:650,y:400,entering:false,cooldown:0,speed:0,hp:10000});}
 for(let i=0;i<120;i++){g.update(1/60);assert.ok(g.enemies.filter(u=>u.strike?.target===g.hero).length<=limit,'windups respect '+mode+' pressure budget');}
 assert.ok(g.combatStats.pressureDeferrals>0);
}

g.showTitle();g.setDifficulty('normal');g.startGame();g.setWave(4);g.spawnBoss();const boss=g.boss;Object.assign(boss,{x:500,y:400,entering:false,abilityCooldown:0});g.hero.x=650;g.hero.y=400;
const poses=[];for(let pattern=0;pattern<3;pattern++){boss.bossAction=null;boss.abilityCooldown=0;boss.patternMask=7^(1<<pattern);boss.lastPattern=-1;g.updateBoss(boss,.01);poses.push(g.bossPose(boss).path);assert.ok(g.combatSounds[boss.bossAction.type]);}
assert.equal(new Set(poses).size,3,'each boss warning uses a different pose');boss.bossAction.stage='recovery';boss.bossAction.time=.5;boss.bossAction.recoveryDuration=.95;assert.ok(g.bossPose(boss).path.endsWith('Warrior_Idle.png'));
const report=g.combatStats;g.startGame();assert.equal(g.combatStats.swings,0);assert.equal(g.combatStats.damageTaken,0);assert.equal(g.approachSlots.size,0);assert.equal(g.hero.damageCue,0);
console.log('Swept blade contacts/cap/misses, local impact poses, deterministic simultaneous damage, healer triage/cover, bounded approach slots/pressure, distinct boss poses, diagnostics and reset: passed');
