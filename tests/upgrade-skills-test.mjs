// Real combat/economy/AI/simulation; ranks >10 exist only in this fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s={};s.window=s;
const noop=()=>{},element={hidden:false,textContent:'',classList:{add:noop,toggle:noop,remove:noop},style:{},focus:noop};
s.document={querySelector:()=>null};vm.createContext(s);
for(const file of ['maps/island.js','maps/validate-map.js','src/config.js','src/base-stats.js','src/upgrade-progress.js','src/skill-config.js','src/upgrade-skills.js','src/world/world.js',
  'src/session.js','src/math.js','src/input.js','src/navigation.js','src/upgrading.js','src/ai.js','src/director.js','src/economy.js','src/boss.js',
  'src/triple-slash.js','src/combat.js','src/simulation.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s,{filename:file});
const M=s.PenjagaModules,r={world:new M.World(s.PenjagaMaps.island),config:M.config,math:{},input:new M.InputController(),navigation:{},
  upgrading:{},combat:{},ai:{},director:{},economy:{},bossSystem:{},simulation:{},lifecycle:{finish:()=>{r.session.state='lost';r.combat.endUpgradeSkills('death');}},
  host:{canvas:{},$:()=>element},ui:{notify:noop,updateUI:noop,updateInteraction:noop,announce:noop},
  renderer:{screenToWorld:(x,y)=>({x,y}),float:noop,floatDamage:noop,addEffect:noop,updatePresentation:noop},
  audio:{tone:noop,combatCue:noop,playSample:noop,updateMusic:noop}};
r.session=new M.GameSession({world:r.world});
for(const name of ['Math','Input','Navigation','Upgrading','Ai','Director','Economy','BossSystem','Combat','Simulation'])M['install'+name](r);
const {session:h,input,combat:c,economy,simulation}=r,ids=['blade','rhythm','wind','counter','bastion','oath'];
let checks=0;const check=(value,label)=>{assert(value,label);checks++;},close=(a,b,label='numeric equality')=>check(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
function reset(rank=0){h.resetForRun();h.state='playing';h.waveTimer=99999;h.gameRandom=r.math.seededRandom(723);h.encounters=r.director.makeEncounters(723);
  Object.assign(h.ranks,Object.fromEntries(ids.map(id=>[id,rank])));Object.assign(h.hero,{x:700,y:400});c.resetCombatStats();input.clearCombatInput();
  input.mouseAimActive=true;input.pointerOverCanvas=true;input.pointerScreen={x:850,y:400};input.updateAim();c.syncSkillRanks();}
function tick(seconds,{swing=true,dash=false}={}){for(let remaining=seconds;remaining>1e-9;){const dt=Math.min(1/60,remaining);c.updateSkillState(dt);if(dash)c.updateDash(dt);if(swing)c.updateHeroSwing(dt);remaining-=dt;}}
function enemy(){const e={x:h.hero.x+50,y:h.hero.y,hp:10000,maxHp:10000,team:'enemy',kind:'Warrior',combatId:++h.combatId};h.enemies.push(e);return e;}

for(const rank of [9,10,19,20,24,25]){
  reset(rank);const stage=rank<10?0:rank<20?1:rank<25?2:3,view=c.skillsSnapshot();
  check(ids.every(id=>view.stages[id]===stage),'All six stage boundaries '+rank);
  check(view.wind.capacity===(stage?3:1)&&view.garrison.capacity===[8,10,12,12][stage],'Capacity gates '+rank);
  check(c.requestOath()===!!stage,'R gates '+rank);check(c.requestTripleSlash()===!!stage,'Q gates '+rank);
  if(stage){const target=enemy();tick(.9);check(h.hero.skills.tripleSlash.hitCounts.join(',')==='1,1,1','Three contacts '+rank);
    close(10000-target.hp,3*Math.round(c.heroPrimaryDamage()*[0,1,1.05,1.10][stage]),'Stage damage '+rank);
    close(h.hero.skills.tripleSlash.cooldownDuration,[0,8,7,6][stage],'Stage cooldown '+rank);
    check(c.skillsSnapshot().rhythm.stacks===3,'Hits add rhythm '+rank);}
  const before=c.skillsSnapshot();h.state='paused';tick(10,{dash:true});
  check(JSON.stringify(c.skillsSnapshot())===JSON.stringify({...before,wind:{...before.wind,ready:false},oath:{...before.oath,ready:false}}),'Pause freezes timers '+rank);
  check(!c.requestDash()&&!c.requestOath()&&!c.requestTripleSlash(),'Pause rejects input '+rank);
}

reset(10);const target=enemy();for(let i=0;i<8;i++)c.hurt(target,1,h.hero);
check(c.skillsSnapshot().rhythm.stacks===5,'Five layers maximum');
const fullCooldown=c.attackCooldown();check(fullCooldown>=.30&&fullCooldown>=r.config.SWING.end+r.config.FIXED_STEP,'Full contact window survives haste');
tick(3);check(c.skillsSnapshot().rhythm.stacks===5,'Hold time');tick(.6);check(c.skillsSnapshot().rhythm.stacks===4,'One stack decays each .6');
tick(2.4);check(c.skillsSnapshot().rhythm.stacks===0,'Decay completes');
target.hp=0;c.hurt(target,5,h.hero);check(c.skillsSnapshot().rhythm.stacks===0,'Dead target cannot grant stack');
c.hurt(h.hero,1,target);check(c.skillsSnapshot().rhythm.stacks===0,'Enemy damage cannot grant stack');
for(const rank of [10,19,20,24,25]){reset(rank);for(let i=0;i<5;i++)c.onHeroSkillHit(1);check(Number.isFinite(c.attackCooldown())&&c.attackCooldown()>=.30,'Cooldown floor '+rank);}

// One charge timer, no legacy dashCooldown source, serial recharge, honest iframe.
reset(10);check(c.startDash(),'First dash');check(!c.startDash(),'No overlapping dash');
h.hero.dashElapsed=.159;const original=h.hero.hp;c.hurt(h.hero,20,enemy());close(h.hero.hp,original,'Immunity');check(c.captureCounter().token===1,'Perfect dodge token');
c.hurt(h.hero,20,h.enemies[0]);check(c.captureCounter().token===1,'One perfect event per dash');
h.hero.dashElapsed=.161;c.hurt(h.hero,20,h.enemies[0]);check(h.hero.hp<original,'Iframe ends before dash movement');
reset(10);check(c.startDash(),'Consume charge one');tick(.6,{dash:true});check(c.startDash(),'Consume charge two');tick(.6,{dash:true});check(c.startDash(),'Consume charge three');
check(c.dashSnapshot().charges===0,'All charges used');h.hero.dashCooldown=0;check(!c.startDash(),'Legacy mirror cannot bypass charge source');
tick(1.2,{dash:true});check(c.dashSnapshot().charges===1,'First serial recharge at 2.4');tick(2.4);check(c.dashSnapshot().charges===2,'Second serial charge');tick(2.4);check(c.dashSnapshot().charges===3,'Third serial charge');
reset(9);c.startDash();h.ranks.wind=10;c.syncSkillRanks();check(c.dashSnapshot().charges===2,'Unlock adds only new capacity');for(let i=0;i<100;i++)c.syncSkillRanks();check(c.dashSnapshot().charges===2,'Recompute never refills');
reset(10);Object.assign(h.hero,{x:104,y:360,lastMoveX:-1,lastMoveY:0});c.startDash();tick(.2,{dash:true});check(r.navigation.positionFits(h.hero.x,h.hero.y),'Dash still collides with shoreline');

// Counter requires a live token, never a writable compatibility mirror.
reset(9);c.onPerfectDodge();h.hero.riposte=4;check(c.captureCounter().token===0,'Counter locked before 10');
for(const rank of [10,20,25]){
  reset(rank);h.hero.skills.tripleSlash.cooldownRemaining=5;h.hero.skills.upgrade.oath.cooldownRemaining=10;c.onPerfectDodge();
  const strike=c.captureCounter(),e=enemy();e.attack=.1;e.strike=null;
  close(c.counterHitBonus({counterToken:strike.token,counterBonus:strike.bonus},e),Math.round(strike.bonus*[1,1.1,1.2][M.SkillConfig.stage(rank)-1]),'Recovery bonus '+rank);
  c.heroAttack();c.updateHeroSwing(.28);check(!c.captureCounter().token,'Single valid hit consumes counter');
  close(h.hero.skills.upgrade.oath.cooldownRemaining,10-M.SkillConfig.counter.refund[M.SkillConfig.stage(rank)],'Refund '+rank);
  const after=h.hero.skills.upgrade.oath.cooldownRemaining;c.onPerfectDodge();c.consumeCounter({counterToken:c.captureCounter().token});
  close(h.hero.skills.upgrade.oath.cooldownRemaining,after,'Repeated perfect dodge cannot reset ICD');
}
reset(10);c.onPerfectDodge();tick(4);check(!c.captureCounter().token,'Expires at four seconds');
reset(10);h.hero.skills.upgrade.oath.cooldownRemaining=18;c.onPerfectDodge();c.consumeCounter({counterToken:c.captureCounter().token});
tick(3.01);const refunded=h.hero.skills.upgrade.oath.cooldownRemaining;c.onPerfectDodge();c.consumeCounter({counterToken:c.captureCounter().token});
close(h.hero.skills.upgrade.oath.cooldownRemaining,refunded-.5,'Refund usable again after internal cooldown');
reset(10);c.onPerfectDodge();tick(3.95);const expired=enemy();c.requestTripleSlash();tick(.9);
close(10000-expired.hp,3*c.heroPrimaryDamage(),'Pending combo cannot reserve expired counter');
reset(25);c.onPerfectDodge();const a=enemy(),b=enemy();c.requestTripleSlash();tick(.9);
close(10000-a.hp,3*Math.round(c.heroPrimaryDamage()*1.10)+r.upgrading.counterBonus(),'Once per combo');
close(10000-b.hp,3*Math.round(c.heroPrimaryDamage()*1.10),'Second target cannot duplicate counter');
reset(20);c.requestTripleSlash();tick(.22);const saved=h.hero.strike,hit=enemy();c.requestDash();check(h.hero.skills.tripleSlash.cancelReason==='dash','Dash cancels combo');c.resolveHeroStrike(saved,.16,.28);tick(.9,{dash:true});close(hit.hp,10000,'Cancelled remaining contacts never resume');

// Healing uses actual max HP, one fixed zone; wood is the only castle repair.
for(const rank of [10,20,25]){
  reset(rank);h.hero.maxHp=1000;h.hero.hp=500;h.castle.hp=200;
  const ally={x:700,y:400,hp:20,maxHp:100,team:'ally'},dead={...ally,hp:0},outside={...ally,x:950};h.allies=[ally,dead,outside];
  const e=enemy();e.hp=20;c.requestOath();const position={...c.skillsSnapshot().oath.zone};check(!c.requestOath(),'Only one zone');
  tick(1);close(h.hero.hp,500+position.hps,'Zone hero HPS');close(ally.hp,20+position.hps,'Zone ally HPS');close(dead.hp,0,'No revive');close(outside.hp,20,'Outside remains unhealed');close(e.hp,20,'No enemy heal');close(h.castle.hp,200,'No castle heal');
  h.hero.x+=200;tick(1);close(c.skillsSnapshot().oath.zone.x,position.x,'Zone fixed at cast');
  tick(position.duration-2);check(!c.skillsSnapshot().oath.zone,'Zone lifetime');check(h.hero.skills.upgrade.oath.cooldownRemaining>0,'Cooldown survives expiry');
}
reset(20);c.requestOath();const zone=c.skillsSnapshot().oath.zone;
const edge={x:zone.x+zone.radius,y:zone.y,hp:10,maxHp:100,team:'ally'},beyond={...edge,x:edge.x+.001};h.allies=[edge,beyond];tick(1);
close(edge.hp,15,'Exact zone boundary is included');close(beyond.hp,10,'Outside actual radius is excluded');
tick(17);check(c.requestOath(),'Second cast after full cooldown');check(h.hero.skills.upgrade.oath.sequence===2,'New cast sequence is explicit');
reset(25);h.hero.hp=1;c.requestOath();tick(1);check(h.hero.hp<=5+1e-7,'Hero passive cap4% maxHP per second');
const beforeHeal=h.hero.hp;c.restorePassiveHp(h.hero,999);close(h.hero.hp,beforeHeal,'Monk and prep share rolling cap');
economy.healHero();check(h.hero.hp>beforeHeal&&h.food===2,'Food is independent');
reset(10);c.requestOath();c.requestTripleSlash();const attacker=enemy();c.hurt(h.hero,10,attacker);
check(h.hero.skills.tripleSlash.cancelReason==='hit'&&!!c.skillsSnapshot().oath.zone,'Nonlethal hit cancels combo but retains ground zone');
reset(25);c.onHeroSkillHit(1);c.onPerfectDodge();c.requestOath();h.hero.hp=1;h.hero.invuln=0;c.hurt(h.hero,9999,enemy());
check(h.hero.hp===0&&!c.skillsSnapshot().oath.zone&&!c.captureCounter().token&&c.skillsSnapshot().rhythm.stacks===0,'Death clears temporary effects');
tick(30);check(h.hero.hp===0&&!c.requestOath()&&!c.requestTripleSlash()&&!c.requestDash(),'Death cannot heal or activate');
reset(25);c.requestOath();c.onPerfectDodge();c.onHeroSkillHit(1);c.startDash();h.resetForRun();
check(h.hero.skills.upgrade.clock===0&&h.hero.skills.upgrade.wind.charges===1&&!h.hero.skills.upgrade.oath.zone&&h.hero.skills.upgrade.counter.token===0&&h.hero.skills.upgrade.rhythm.stacks===0,'Restart is a fresh state');

reset(25);const ally={x:h.castle.x,y:h.castle.y,hp:100,maxHp:100,team:'ally'};
close(c.applySkillResistance(ally,100,100),80,'Aura 20% for allies');ally.x+=161;close(c.applySkillResistance(ally,100,100),100,'Aura range');ally.x=h.castle.x;
close(c.applySkillResistance(h.castle,100,100),100,'Aura excludes castle');close(c.applySkillResistance(ally,70,100),65,'Total reduction cap35%');
h.castle.hp=0;close(c.applySkillResistance(ally,100,100),100,'Dead castle has no aura');

const costs=[];
for(const [rank,capacity] of [[9,8],[10,10],[19,10],[20,12],[24,12],[25,12]]){
  reset(rank);h.gold=10000;economy.recruitUnit(true);for(let i=1;i<capacity;i++)check(economy.recruitUnit(),'Normal paid recruitment');
  const gold=h.gold;check(economy.recruitUnit()===false&&economy.recruitUnit(true)===false&&h.gold===gold,'Cap covers paid and free');
  const expected=Array.from({length:capacity-1},(_,i)=>(i+1)%4===2?55:40).reduce((a,b)=>a+b,0);
  close(10000-h.gold,expected,'Normal cost cycle');costs.push({rank,capacity,paidUnits:capacity-1,cost:expected});
  h.allies[0].hp=0;check(economy.recruitUnit(),'Only living units occupy slots');
}
// Full real AI/navigation simulation benchmark, equally seeded 8 vs12,21 enemies.
const benchmarks=[];
for(const size of [8,12]){
  reset(size===8?0:25);h.gold=10000;for(let i=0;i<size;i++)economy.recruitUnit();
  for(let i=0;i<21;i++)r.director.spawnEnemy();
  h.hero.hp=h.hero.maxHp=1e9;h.castle.hp=h.castle.maxHp=1e9;
  h.allies.forEach(u=>u.hp=u.maxHp=1e9);h.enemies.forEach(u=>u.hp=u.maxHp=1e9);
  const times=[];for(let frame=0;frame<900;frame++){const start=performance.now();simulation.update(1/60);if(frame>=120)times.push(performance.now()-start);}
  check(h.allies.length===size&&h.enemies.length===21,'Maximum cap benchmark remains populated');
  check(h.allies.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&r.navigation.positionFits(u.x,u.y)),'All recruited units retain legal positions');
  times.sort((a,b)=>a-b);benchmarks.push({allies:size,enemies:21,frames:times.length,meanMs:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),p95Ms:+times[Math.floor(times.length*.95)].toFixed(3),maxMs:+times.at(-1).toFixed(3)});
}
check(M.config.MAX_UPGRADE_LEVEL===25&&M.config.UPGRADE_TIERS[0].cap===10,'Stage 5 cap25 with initial tier10');
console.log(JSON.stringify({result:'PASS',checks,costs,benchmarks},null,2));
