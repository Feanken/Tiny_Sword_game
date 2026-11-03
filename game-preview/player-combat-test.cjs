const assert=require('node:assert/strict');
const {g}=require('./game-harness.cjs').createGame(91);
function fixture(){g.startGame(91);g.allies.length=0;Object.assign(g.hero,{x:600,y:400,facing:1});}
function enemy(x=650,y=400){g.spawnEnemy();const u=g.enemies.at(-1);Object.assign(u,{x,y,hp:1000,maxHp:1000,entering:false,cooldown:999,speed:0});return u;}
function age(n){g.hero.attack=g.HERO_ATTACK.duration-n;}
fixture();g.heroAttack();
for(const [time,frame] of [[0,0],[.12,1],[.161,2],[.22,2],[.279,2],[.281,3],[.4,3]]){
 age(time);const pose=g.heroPose(),actual=g.spriteFrame(pose.path,pose.age,pose.fps,pose.once);
 assert.equal(actual.x/actual.width,frame,'sprite frame matches the damage phase at '+time);
}
age(.22);g.hero.impactHold=1;g.hero.impactAge=0;assert.equal(g.heroPose().age,2,'impact hold cannot rewind the player contact pose');
for(const time of [0,.1,.2,.28]){age(time);assert.ok(Math.abs(g.heroMoveScale()-.55)<1e-8);}
let previous=.55;for(let time=.29;time<.42;time+=.01){age(time);assert.ok(g.heroMoveScale()>previous&&g.heroMoveScale()<=1);previous=g.heroMoveScale();}
g.hero.attack=0;assert.equal(g.heroMoveScale(),1,'movement returns continuously to full speed');
age(.34);g.hero.moving=true;assert.ok(g.heroPose().path.endsWith('Warrior_Run.png'),'moving out of recovery uses the running pose');

fixture();g.heroAttack();g.keys.add('a');g.advance(.1);assert.equal(g.hero.facing,1,'windup keeps the committed direction');g.advance(.1);assert.equal(g.hero.facing,1,'contact keeps the committed direction');g.advance(.1);assert.equal(g.hero.facing,-1,'recovery accepts a new movement direction');assert.equal(g.hero.swingFacing,1,'the fading sweep preserves the original direction');
g.startDash();assert.equal(g.hero.attack,0);assert.equal(g.hero.strike,null,'recovery can still be cancelled into dash');

fixture();const front=enemy(670),back=enemy(535);assert.equal(g.heroAttackTarget(),front,'small distance differences do not flip the player away from the front');back.x=550;assert.equal(g.heroAttackTarget(),back,'a substantially closer rear threat can still be faced');
front.hp=0;back.hp=0;const outside=enemy(600,310),inside=enemy(665,375);assert.equal(g.heroAttackTarget(),inside,'aim assistance only chooses a target the horizontal sweep can reach');inside.hp=0;assert.equal(g.heroAttackTarget(),null);g.heroAttack();assert.equal(g.hero.strike.target,null);g.updateHeroSwing(.3);assert.equal(outside.hp,1000,'aim assistance does not extend the hitbox');
assert.equal(g.swingAngle(0),-g.SWING.angle);assert.equal(g.swingAngle(1),g.SWING.angle);assert.ok(Math.abs(g.swingAngle((g.SWING.start+g.SWING.end)/2))<1e-9);

fixture();const victim=enemy();g.floatDamage(victim,7,{team:'ally'});g.floatDamage(victim,9,{team:'ally'});assert.equal(g.floaters.length,1);assert.equal(g.floaters[0].text,'−16','nearby squad hits add their actual damage');
g.floatDamage(victim,27,g.hero);assert.equal(g.floaters.length,2,'player damage remains distinct from squad damage');assert.equal(g.floaters[1].priority,2);
g.advance(.1);g.advance(.05);g.floatDamage(victim,8,{team:'ally'});assert.equal(g.floaters.length,3,'aggregation has a bounded window');
fixture();const dying=enemy();dying.hp=6;g.hurt(dying,100,g.hero);assert.equal(g.floaters.find(f=>f.target===dying).text,'−6','overkill does not inflate the displayed number');
g.hurt(g.hero,12,{x:650,y:400});const playerDamage=g.floaters.find(f=>f.target===g.hero);for(let i=0;i<80;i++)g.float('1',600,400,'#ddd',false,0);assert.equal(g.floaters.length,35);assert.ok(g.floaters.includes(playerDamage),'squad chatter cannot evict player damage');assert.ok(g.impacts.find(f=>f.prominent),'important contacts retain prominent sparks');

fixture();const attacker=enemy();attacker.strike={target:g.hero,timer:.1};attacker.kind='Warrior';assert.equal(g.playerThreat(attacker).progress,.5);assert.equal(g.playerThreat(attacker).ranged,false);attacker.kind='Archer';assert.equal(g.playerThreat(attacker).ranged,true);attacker.strike.target=g.castle;assert.equal(g.playerThreat(attacker),null,'unrelated attacks do not mark the player as threatened');attacker.strike=null;assert.equal(g.playerThreat(attacker),null,'cancelled attacks immediately clear their cue');
assert.equal(g.sceneryCoversHero(600,450,100,120),true);assert.equal(g.sceneryCoversHero(750,450,100,120),false);g.hero.y=470;assert.equal(g.sceneryCoversHero(600,450,100,120),false,'foreground unit does not fade scenery behind it');
g.startGame();assert.equal(g.hero.swingEmpowered,false);assert.equal(g.hero.swingFacing,1);assert.equal(g.floaters.length,0);
console.log('Player pose/contact timing, gradual recovery and facing, reachable aim assistance, damage aggregation/priority, threat ownership, scenery occlusion and reset: passed');
