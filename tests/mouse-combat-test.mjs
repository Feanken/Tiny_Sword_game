// Real input/combat/navigation ports, with a DOM/audio stub and no renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context={};context.window=context;
const canvas={hasPointerCapture:()=>false};
context.document={querySelector:()=>null,elementFromPoint:()=>canvas};
vm.createContext(context);
for(const file of ['maps/island.js','maps/floor-geometry.js','maps/campaign-islands.js',
  'maps/validate-map.js','src/config.js','src/base-stats.js','src/upgrade-progress.js','src/camera.js','src/world/world.js',
  'src/skill-config.js','src/upgrade-skills.js','src/session.js','src/math.js','src/input.js','src/navigation.js','src/upgrading.js','src/triple-slash.js','src/combat.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const M=context.PenjagaModules,noop=()=>{};
const rt={world:new M.World(context.PenjagaMaps.island),config:M.config,
  input:new M.InputController(),math:{},navigation:{},upgrading:{},combat:{},
  host:{$:()=>({hidden:false,classList:{add:noop}}),canvas},
  renderer:{},audio:{},ai:{releaseApproach:noop},ui:{},economy:{},director:{}};
rt.session=new M.GameSession({world:rt.world});
const camera=new M.Camera2D(1280,704),rect={left:123,top:77,width:1000,height:550};
camera.resize(rect.width,rect.height);camera.follow(rt.session.hero);
rt.renderer.screenToWorld=(x,y)=>camera.screenToWorld(x,y,rect);
for(const key of ['addEffect','float','floatDamage'])rt.renderer[key]=noop;
for(const key of ['tone','combatCue','playSample'])rt.audio[key]=noop;
for(const name of ['Math','Input','Navigation','Upgrading','Combat'])M['install'+name](rt);
const {session,input,combat,navigation}=rt;
let checks=0;
const check=(ok,message)=>{assert(ok,message);checks++;};
const near=(a,b,tolerance=1e-9)=>check(Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<tolerance,'Angles agree');
function reset(){
  session.resetForRun();session.state='playing';combat.resetCombatStats();input.clearCombatInput();
  input.mouseAimActive=true;input.pointerOverCanvas=true;
  session.enemies=[];session.allies=[];session.hero.hp=1000;
  Object.assign(session.hero,{x:700,y:400});
  camera.follow(session.hero);
}
function point(x,y){
  const p=camera.worldToScreen(x,y,rect);input.pointerScreen=p;input.updateAim();
}
function aim(angle,distance=200){point(session.hero.x+Math.cos(angle)*distance,session.hero.y+Math.sin(angle)*distance);}
function enemy(x,y){const e={x,y,hp:1000,maxHp:1000,team:'enemy',kind:'Warrior',combatId:session.enemies.length+1};session.enemies.push(e);return e;}
function relativeEnemy(angle,distance){return enemy(session.hero.x+Math.cos(angle)*distance,session.hero.y+Math.sin(angle)*distance);}
function finish(){combat.updateHeroSwing(.28);input.updateAim();}

// Full circle, including the ±pi seam. Range and rear exclusion stay rotationally equal.
for(let i=0;i<72;i++){
  reset();const axis=-Math.PI+i*Math.PI/36;
  aim(axis);near(session.hero.aimAngle,axis);
  const front=relativeEnemy(axis,60),rear=relativeEnemy(axis+Math.PI,30);
  combat.heroAttack();const strike=session.hero.strike;
  near(strike.angle,axis);check(strike.target===front,'No auto-turn toward closer enemy behind');
  check(combat.swingContact(strike,front,0,.28),'Forward cone rotates');
  check(!combat.swingContact(strike,rear,0,.28),'Rear gate retained');
  check(!combat.swingContact(strike,relativeEnemy(axis,94.01),0,.28),'Reach cap retained');
  check(combat.swingContact(strike,relativeEnemy(axis,93.99),0,.28),'Reach includes target radius');
  const edge=1.3+Math.asin(18/70);
  check(combat.swingContact(strike,relativeEnemy(axis+edge-.001,70),0,.28),'Sweep edge includes target radius');
  check(!combat.swingContact(strike,relativeEnemy(axis+edge+.001,70),0,.28),'Sweep edge excludes outside target');
  session.enemies=[front,rear];finish();
  check(front.hp===973&&rear.hp===1000,'Basic damage only in aimed sector');
}

// Windup/contact direction is fixed; recovery reticle resumes with the latest pointer.
reset();aim(0);combat.heroAttack();const locked=session.hero.strike;
assert.throws(()=>{locked.angle=Math.PI;},/read only|readonly|assign/i);checks++;
aim(Math.PI/2);near(session.hero.aimAngle,0);near(combat.heroAttackAngle(),0);
combat.updateHeroSwing(.159);input.updateAim();near(session.hero.aimAngle,0);
combat.updateHeroSwing(.12);input.updateAim();near(session.hero.aimAngle,0);
combat.updateHeroSwing(.002);input.updateAim();
check(!session.hero.strike,'Strike finishes at existing contact boundary');
near(session.hero.aimAngle,Math.PI/2);near(session.hero.swingAngle,0);
near(combat.heroAttackAngle(),0);check(session.hero.attack>0,'Direction unlocked during recovery');

// Exact center and rounding noise preserve the last direction instead of atan2(0,0).
reset();aim(-Math.PI/2);point(session.hero.x,session.hero.y);near(session.hero.aimAngle,-Math.PI/2);
point(session.hero.x+1e-9,session.hero.y);near(session.hero.aimAngle,-Math.PI/2);
point(session.hero.x+.0005,session.hero.y);near(session.hero.aimAngle,-Math.PI/2);
point(session.hero.x+.01,session.hero.y);near(session.hero.aimAngle,0);
aim(-Math.PI/2);
input.pointerOverCanvas=false;input.keyboardInput('a',true);input.updateAim();
near(session.hero.aimAngle,-Math.PI/2);
input.mouseAimActive=false;input.updateAim();near(Math.abs(session.hero.aimAngle),Math.PI);

// Movement/facing cannot redirect a mouse strike, including backwards movement.
reset();aim(0);input.keyboardInput('a',true);combat.heroAttack();
const startX=session.hero.x;
navigation.move(session.hero,-1,0,1/60,185*combat.heroMoveScale());input.updateAim();
check(session.hero.x<startX,'WASD still moves backwards');near(session.hero.strike.angle,0);
check(session.hero.facing===1,'Facing remains aimed during contact');
input.clearCombatInput();check(!input.keys.size&&session.hero.attackBuffer===0,'Clearing input stops holds/buffers');

// Hit origin follows walking hero, and matches the public visual-origin port.
reset();aim(0);const movingTarget=relativeEnemy(0,110);combat.heroAttack();
const oldOrigin=combat.heroAttackOrigin();session.hero.x+=30;
check(combat.heroAttackOrigin().x===oldOrigin.x+30,'Origin follows hero translation');
finish();check(movingTarget.hp===973,'Translation changes reach from current origin');

// Caps at ranks 0/5/10, damage, one hit per target and counter remain unchanged.
reset();aim(0);const single=relativeEnemy(0,60);combat.heroAttack();
combat.updateHeroSwing(.22);combat.updateHeroSwing(.01);
check(single.hp===973&&session.hero.strike.hits.size===1,'One target cannot be hit twice before cap');
for(let rank=0;rank<=10;rank++){
  reset();session.ranks.blade=rank;aim(0);
  const targets=Array.from({length:7},(_,i)=>relativeEnemy(0,50+i*3));
  combat.heroAttack();const s=session.hero.strike;combat.updateHeroSwing(.22);
  const hp=targets.map(t=>t.hp);combat.updateHeroSwing(.01);
  assert.deepEqual(targets.map(t=>t.hp),hp);checks++;
  check(s.hits.size===3+Math.floor(rank/5),'Upgrade cap at rank '+rank);
  check(targets[0].hp===1000-(27+rank*5),'Primary damage unchanged');
  check(targets[1].hp===1000-(18+rank*3),'Secondary damage unchanged');
}
for(const [rank,expectedBonus] of [[0,0],[5,0],[10,88]]){
  reset();session.ranks.counter=rank;combat.onPerfectDodge();aim(Math.PI/2);
  const counterA=relativeEnemy(Math.PI/2,50),counterB=relativeEnemy(Math.PI/2,60);
  combat.heroAttack();const bonus=session.hero.strike.counterBonus;
  check(bonus===expectedBonus,'Counter milestone snapshot retained');finish();
  check(counterA.hp===1000-27-expectedBonus&&counterB.hp===982&&session.hero.riposte===0,'Counter consumed once on first hit');
}

// Real static cover near the castle, and an actual shoreline, preserve collision.
reset();Object.assign(session.hero,{x:805,y:310});camera.follow(session.hero);aim(0);
const blocked=enemy(885,310);check(navigation.positionFits(805,310)&&navigation.positionFits(885,310),'Cover endpoints legal');
combat.heroAttack();finish();check(blocked.hp===1000,'No swing through building');
reset();Object.assign(session.hero,{x:104,y:360});camera.follow(session.hero);aim(Math.PI);
const acrossWater=enemy(60,360);combat.heroAttack();
for(let i=0;i<20;i++){navigation.move(session.hero,-1,0,1/60,185);check(navigation.positionFits(session.hero.x,session.hero.y),'No walking into water');}
finish();check(acrossWater.hp===1000,'Water still blocks melee path');

// Big-world fixture uses the real camera conversion, including a stationary pointer.
reset();camera.worldWidth=2560;camera.worldHeight=1792;Object.assign(session.hero,{x:1613,y:995});
camera.follow(session.hero);aim(-Math.PI/4);near(session.hero.aimAngle,-Math.PI/4);
const pointer={...input.pointerScreen};Object.assign(session.hero,{x:1900,y:1300});camera.follow(session.hero);
input.updateAim();check(input.pointerScreen.x===pointer.x&&input.pointerScreen.y===pointer.y,'Stationary screen point retained');
const projected=camera.screenToWorld(pointer.x,pointer.y,rect);
near(session.hero.aimAngle,Math.atan2(projected.y-session.hero.y,projected.x-session.hero.x));
combat.heroAttack();near(session.hero.strike.angle,session.hero.aimAngle);
combat.cancelHeroSwing(false);aim(Math.PI);near(session.hero.aimAngle,Math.PI);

session.resetForRun();
check(session.hero.aimAngle===0&&session.hero.swingAngle===0&&!session.hero.strike,'New run resets combat directions');
check(M.config.GATHERING_REWARDS.gold===10000&&M.config.MAX_UPGRADE_LEVEL===25&&M.config.UPGRADE_TIERS[0].cap===10,'Mining preserved; tier I cap 10, maximum 25');
navigation.dispose();
console.log('PASS mouse combat: '+checks+' checks; 72 aim axes, lock/recovery, backward movement, origin, caps, counter, cover, water, camera.');
