import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s={};s.window=s;
const canvas={hasPointerCapture:()=>false};s.document={querySelector:()=>null,elementFromPoint:()=>canvas};
vm.createContext(s);
for(const file of ['maps/island.js','maps/validate-map.js','src/config.js','src/base-stats.js','src/upgrade-progress.js','src/world/world.js',
  'src/skill-config.js','src/upgrade-skills.js','src/session.js','src/math.js','src/input.js','src/navigation.js','src/upgrading.js','src/triple-slash.js','src/combat.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s,{filename:file});
const M=s.PenjagaModules,noop=()=>{},rt={world:new M.World(s.PenjagaMaps.island),config:M.config,math:{},
  input:new M.InputController(),navigation:{},upgrading:{},combat:{},ui:{},economy:{},director:{},
  host:{canvas,$:()=>({hidden:false,classList:{add:noop}})},ai:{releaseApproach:noop},
  renderer:{screenToWorld:(x,y)=>({x,y}),float:noop,floatDamage:noop,addEffect:noop},
  audio:{tone:noop,combatCue:noop,playSample:noop}};
rt.session=new M.GameSession({world:rt.world});
for(const name of ['Math','Input','Navigation','Upgrading','Combat'])M['install'+name](rt);
const {session,input,combat}=rt,state=()=>session.hero.skills.tripleSlash;
let checks=0;
const check=(value,label)=>{assert(value,label);checks++;};
const close=(a,b)=>check(Math.abs(a-b)<1e-8,a+' != '+b);
const angleClose=(a,b)=>close(Math.atan2(Math.sin(a-b),Math.cos(a-b)),0);
function reset(rank=10){
  session.resetForRun();session.state='playing';session.ranks.blade=rank;
  combat.resetCombatStats();input.clearCombatInput();
  Object.assign(session.hero,{x:700,y:400});session.enemies=[];
  input.mouseAimActive=true;input.pointerOverCanvas=true;aim(0);
}
function aim(angle){input.pointerScreen={x:session.hero.x+Math.cos(angle)*150,y:session.hero.y+Math.sin(angle)*150};input.updateAim();}
function enemy(distance=50,angle=0){
  const e={x:session.hero.x+Math.cos(angle)*distance,y:session.hero.y+Math.sin(angle)*distance,
    hp:10000,maxHp:10000,team:'enemy',kind:'Warrior',combatId:session.enemies.length+1};
  session.enemies.push(e);return e;
}
function tick(dt){combat.updateHeroSwing(dt);input.updateAim();}

reset(9);check(!combat.requestTripleSlash(),'Rank 9 is locked');
check(state().sequence===0&&state().cooldownRemaining===0,'Locked request is free');
session.ranks.blade=10;check(combat.requestTripleSlash(),'Rank 10 unlocks');
check(state().phase==='windup'&&state().slashIndex===1,'First windup begins');
close(state().cooldownRemaining,8);
for(let i=0;i<20;i++)check(!combat.requestTripleSlash(),'Repeated Q rejected');
combat.requestAttack();combat.heroAttack();
check(session.combatStats.swings===1&&session.hero.attackBuffer===0,'No basic overlap or buffer');
const snapshot=combat.tripleSlashSnapshot();snapshot.hitCounts[0]=99;snapshot.hitArea.origin.x=0;
check(state().hitCounts[0]===0&&combat.heroAttackOrigin().x===700,'Snapshot does not expose mutable state');

reset();const target=enemy();combat.requestTripleSlash();
tick(.159);check(target.hp===10000&&state().phase==='windup','Windup cannot hit early');
tick(.061);check(target.hp===9923&&state().hitCounts[0]===1,'First distinct contact');
tick(.01);check(target.hp===9923,'One hit per target in slash 1');
tick(.07);check(state().slashIndex===2&&state().phase==='windup','Second windup at .3');
tick(.22);check(target.hp===9846&&state().hitCounts[1]===1,'Second distinct contact');
tick(.3);check(target.hp===9769&&state().hitCounts[2]===1,'Third distinct contact');
tick(.08);check(state().status==='completed'&&!session.hero.strike,'Complete at .9, no fourth contact');
close(state().elapsed,.9);close(state().cooldownRemaining,7.1);
check(session.combatStats.swings===3,'Exactly three strikes');

// A coalesced update still processes each contact separately.
reset();const coalesced=enemy();combat.requestTripleSlash();tick(.9);
check(coalesced.hp===9769&&state().hitCounts.join(',')==='1,1,1','All phase boundaries processed');
tick(20);check(coalesced.hp===9769&&state().cooldownRemaining===0,'No late contact, cooldown expires');
check(combat.requestTripleSlash()&&state().sequence===2,'Fresh combo after cooldown');

reset();const targets=Array.from({length:7},(_,i)=>enemy(45+i*2));
combat.requestTripleSlash();tick(.9);
check(targets.slice(0,5).every(e=>e.hp===9769)&&targets.slice(5).every(e=>e.hp===10000),'Five targets, full primary damage each');
check(state().hitCounts.join(',')==='5,5,5','Independent hit sets per slash');

for(const late of [false,true]){
  reset();session.ranks.counter=10;combat.onPerfectDodge();
  const a=enemy(50,late?Math.PI:0),b=enemy(60,late?Math.PI:0);
  combat.requestTripleSlash();if(late)tick(.3);
  if(late){a.x=750;b.x=760;}
  tick(late?.6:.9);
  check(state().counterConsumed,'Counter consumed on first valid combo hit');
  check(a.hp===10000-(late?2:3)*77-88&&b.hp===10000-(late?2:3)*77,'Counter only once across combo');
  check(session.hero.riposte===0,'Riposte consumed');
}

reset();combat.requestTripleSlash();const first=session.hero.strike;
aim(Math.PI);tick(.22);
angleClose(first.angle,0);angleClose(session.hero.aimAngle,0);
tick(.08);angleClose(state().angle,Math.PI/6);check(state().slashIndex===2,'Correction only between slashes');
aim(-Math.PI/2);tick(.3);angleClose(state().angle,0);
reset();aim(170*Math.PI/180);combat.requestTripleSlash();aim(-170*Math.PI/180);tick(.3);
angleClose(state().angle,-170*Math.PI/180);
input.pointerScreen={x:session.hero.x,y:session.hero.y};tick(.3);
angleClose(state().angle,-170*Math.PI/180);

reset();Object.assign(session.hero,{x:805,y:310});aim(0);
const cover=enemy(80);combat.requestTripleSlash();tick(.9);
check(cover.hp===10000&&state().hitCounts.every(n=>n===0),'Building blocks all three contacts');
reset();const boss=enemy();boss.isBoss=true;boss.bossAction={stage:'recovery'};
combat.requestTripleSlash();tick(.9);check(boss.hp===9700,'Existing boss damage modifier applies');

reset();const cancelled=enemy();combat.requestTripleSlash();tick(.22);
const oldStrike=session.hero.strike,damage=cancelled.hp,remaining=state().cooldownRemaining;
check(combat.startDash(),'Dash starts');check(state().cancelReason==='dash'&&state().status==='cancelled','Dash cancels combo');
close(state().cooldownRemaining,remaining);
combat.resolveHeroStrike(oldStrike,.16,.28);tick(.9);
check(cancelled.hp===damage,'Cancelled contacts cannot return');
check(!combat.requestTripleSlash(),'Cancel does not refund cooldown');

reset();session.hero.skills.upgrade.wind.charges=0;session.hero.skills.upgrade.wind.rechargeRemaining=1;combat.requestTripleSlash();
check(!combat.startDash()&&state().status==='active','Failed dash does not cancel');
tick(.9);check(state().status==='completed','Combo survives failed dash');
for(const [damage,reason] of [[10,'hit'],[1000,'death']]){
  reset();const e=enemy();combat.requestTripleSlash();combat.hurt(session.hero,damage,e);
  check(state().cancelReason===reason&&!session.hero.strike,'Damage cancellation '+reason);
  tick(.9);check(e.hp===10000,'Interrupted windup has no late contacts');
}
reset();combat.requestTripleSlash();session.hero.strike=null;tick(.01);
check(state().cancelReason==='strike-lost','Lost strike cannot be recreated');
reset();combat.requestTripleSlash();session.hero.strike.comboSequence=999;tick(.01);
check(state().cancelReason==='invalid-state','Mismatched sequence cannot hit');
reset();const reentrant=[enemy(50),enemy(55)],realHurt=combat.hurt;
combat.hurt=(...args)=>{realHurt(...args);combat.cancelTripleSlash('hit');};
combat.requestTripleSlash();tick(.9);combat.hurt=realHurt;
check(reentrant[0].hp===9923&&reentrant[1].hp===10000,'Cancel during hit resolution stops remaining contacts');
check(state().status==='cancelled'&&state().hitCounts.join(',')==='1,0,0','No remaining phase after reentrant cancel');

reset();combat.heroAttack();check(!combat.requestTripleSlash(),'Basic windup blocks skill');
tick(.28);check(!combat.requestTripleSlash(),'Basic recovery/cooldown blocks skill');
reset();combat.requestTripleSlash();tick(.1);session.state='paused';
const frozen=JSON.stringify(combat.tripleSlashSnapshot());
combat.updateHeroSwing(10);combat.updateTripleSlash(10);
check(JSON.stringify(combat.tripleSlashSnapshot())===frozen,'Pause freezes all timers');
session.state='playing';tick(.8);close(state().elapsed,.9);close(state().cooldownRemaining,7.1);
session.resetForRun();check(state().status==='idle'&&state().sequence===0&&state().cooldownRemaining===0,'Restart resets full skill state');
check(!session.hero.strike&&session.ranks.blade===0,'Restart removes stale strike and unlock');
check(M.config.GATHERING_REWARDS.gold===10000,'Manual mining unchanged');
rt.navigation.dispose();
console.log('PASS Triple Slash: '+checks+' checks; unlock, 3 contacts, full damage/cap, counter once, turn bounds, cover, cancellation, pause/reset.');
