// Real transactions, stat resolver, combat, economy and simulation. Only DOM/audio/AI are stubs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope={};scope.window=scope;
const noop=()=>{},canvas={hasPointerCapture:()=>false};
scope.document={querySelector:()=>null,elementFromPoint:()=>canvas};vm.createContext(scope);
for(const file of ['maps/island.js','maps/validate-map.js','src/config.js','src/base-stats.js',
  'src/upgrade-progress.js','src/expedition.js','src/world/world.js','src/session.js','src/math.js',
  'src/input.js','src/navigation.js','src/upgrading.js','src/triple-slash.js','src/combat.js',
  'src/economy.js','src/simulation.js','src/ai.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
const M=scope.PenjagaModules,P=M.UpgradeProgress,nodes=new Map();
const rt={world:new M.World(scope.PenjagaMaps.island),config:M.config,input:new M.InputController(),
  math:{},navigation:{},upgrading:{},combat:{},economy:{},simulation:{},
  host:{canvas,$:id=>{
    if(!nodes.has(id))nodes.set(id,{open:false,hidden:false,textContent:'',focus:noop,
      querySelector:()=>null,classList:{add:noop,toggle:noop}});
    return nodes.get(id);
  }},renderer:{screenToWorld:(x,y)=>({x,y}),float:noop,floatDamage:noop,addEffect:noop,updatePresentation:noop},
  audio:{tone:noop,combatCue:noop,playSample:noop,updateMusic:noop},
  ui:{renderCamp:noop,updateUI:noop,notify:noop,updateInteraction:noop},
  ai:{releaseApproach:noop,updateUnit:noop,separateCombatUnits:noop},
  director:{startWave:noop,finishWave:noop,updateSpawns:noop},lifecycle:{finish:noop}};
rt.session=new M.GameSession({world:rt.world});
for(const name of ['Math','Input','Navigation','Upgrading','Combat','Economy','Simulation'])M['install'+name](rt);
const {session:s,upgrading:u,combat:c}=rt;
let checks=0;
const check=(ok,label)=>{assert(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b)=>check(Math.abs(a-b)<1e-9,a+' != '+b);
const data=()=>JSON.stringify({gold:s.gold,ranks:s.ranks,paid:s.paidTierUnlocks,proof:s.upgradeProgress,
  hero:s.hero,castle:s.castle,camp:s.campPurchase,feedback:rt.host.$('campFeedback').textContent});
function reset(){
  s.resetForRun();s.state='playing';s.gold=100000;s.waveTimer=100000;
  rt.host.$('campDialog').open=false;rt.host.$('campFeedback').textContent='';
  rt.input.clearCombatInput();c.resetCombatStats();u.applyBaseStats();
}
function refused(action,label){
  const before=data();equal(action(),false,label);equal(data(),before,label+' preserves all state');
}
function boss(id){check(P.recordBossVictory(s,id),'Record explicit boss evidence '+id);}
function toRank(id,target){
  while(s.ranks[id]<target){
    if(s.ranks[id]===10&&P.paidTier(s,id)===1)check(u.unlockTier(id,'tier-2'),'Pay tier II');
    if(s.ranks[id]===20&&P.paidTier(s,id)===2)check(u.unlockTier(id,'tier-3'),'Pay tier III');
    check(u.buyUpgrade(id),'Buy '+id+' rank '+(s.ranks[id]));
  }
}
const boundaries=[9,10,11,19,20,21,24,25];
for(const id of P.ids){
  reset();
  for(let rank=1;rank<=25;rank++){
    if(rank===11||rank===21){
      const tierId=rank===11?'tier-2':'tier-3',bossId=rank===11?'boss-chapter-1':'boss-chapter-2',
        cost=rank===11?500:1500;
      const before=data();equal(P.quoteTier(s,id,tierId).reason,'boss-required','Requires boss');
      equal(data(),before,'Quotes are pure');
      refused(()=>u.unlockTier(id,tierId),'Cannot pay before boss');
      refused(()=>u.buyUpgrade(id),'Cannot exceed paid tier');
      boss(bossId);
      equal(s.paidTierUnlocks[id].length,rank===11?0:1,'Evidence does not pay');
      s.gold=cost-1;equal(u.quoteTier(id,tierId).reason,'gold-short','Unlock one gold short');
      refused(()=>u.unlockTier(id,tierId),'One short unlock');
      s.gold=cost;check(u.unlockTier(id,tierId),'Exact unlock balance');
      equal(s.gold,0,'Exact unlock consumes cost only');equal(s.ranks[id],rank-1,'Unlock does not buy rank');
      equal(P.hasBossVictory(s,bossId),true,'Payment keeps evidence');
      refused(()=>u.unlockTier(id,tierId),'No repeat payment');
      for(const other of P.ids.filter(other=>other!==id))
        equal(s.paidTierUnlocks[other].length,0,'Payments are per path');
    }
    const price=P.rankPrice(id,rank);
    s.gold=price-1;refused(()=>u.buyUpgrade(id),'Rank one short '+id+'/'+rank);
    s.gold=price;check(u.buyUpgrade(id),'Exact rank balance '+id+'/'+rank);
    equal(s.gold,0,'No negative balance or extra cost');
    equal(s.ranks[id],rank,'Rank committed once');
    if(boundaries.includes(rank)){
      const view=u.viewUpgrade(id);
      equal(view.cap,rank<=10?10:rank<=20?20:25,'Paid cap at boundary '+rank);
      equal(view.skillStage,rank<10?0:rank<20?1:rank<25?2:3,'Skill stage from rank '+rank);
      equal(u.milestone(id),rank<10?1:2,'Milestones stop at 5/10');
    }
  }
  s.gold=100000;
  refused(()=>u.buyUpgrade(id),'Rank 25 maximum');
  refused(()=>u.unlockTier(id,'tier-2'),'Old tier stays paid at 25');
  refused(()=>u.unlockTier(id,'tier-3'),'Top tier stays paid at 25');
  const snap=P.snapshot(s);check(P.validSnapshot(snap),'Valid snapshot rank 25');
  const next=new M.GameSession({world:rt.world}),ranksRef=next.ranks;
  check(P.restore(next,snap),'Restore complete explicit progress');check(next.ranks===ranksRef,'Keep ranks owner identity');
  equal(JSON.stringify(P.snapshot(next)),JSON.stringify(snap),'Snapshot round trip');
  snap.ranks[id]=0;check(next.ranks[id]===25,'Snapshot restored by value');
  const invalid=P.snapshot(next);invalid.bossVictories=[];
  const preserved=JSON.stringify(P.snapshot(next));check(!P.restore(next,invalid),'Paid tier without evidence cannot restore');
  equal(JSON.stringify(P.snapshot(next)),preserved,'Invalid restore is atomic');
}
reset();
refused(()=>u.unlockTier('blade','tier-3'),'Cannot skip tier');
refused(()=>u.unlockTier('blade','tier-2'),'Requires own rank ten');
refused(()=>u.buyUpgrade('unknown'),'Unknown path');
refused(()=>u.unlockTier('blade','unknown'),'Unknown tier');
refused(()=>u.unlockTier('blade','tier-1'),'Cannot pay free tier');
for(const [state,phase,open] of [['ready','prepare',true],['won','prepare',true],['playing','battle',true],['paused','prepare',false]]){
  s.state=state;s.phase=phase;rt.host.$('campDialog').open=open;
  refused(()=>u.buyUpgrade('blade'),'Not a live preparation');
}
s.state='paused';s.phase='prepare';rt.host.$('campDialog').open=true;
check(u.buyUpgrade('blade'),'Camp purchase while paused');
reset();
boss('boss-chapter-1');check(!P.recordBossVictory(s,'boss-chapter-1'),'Duplicate receipt is harmless');
check(!P.recordBossVictory(s,'unknown'),'Unknown boss cannot unlock');
equal(s.paidTierUnlocks.blade.length,0,'Evidence remains separate from payment');
check(!P.bindSource(s,{}),'Invalid source rejected');
check(P.bindSource(s,{hasBossVictory:id=>id==='boss-chapter-2'}),'Bind campaign source');
check(!P.hasBossVictory(s,'boss-chapter-1')&&P.hasBossVictory(s,'boss-chapter-2'),'External source is authoritative');
check(!P.recordBossVictory(s,'boss-chapter-2'),'Local fixture cannot override controller');
P.bindSource(s,{hasBossVictory:()=>1});check(!P.hasBossVictory(s,'boss-chapter-1'),'Only literal true is evidence');
P.bindSource(s,{hasBossVictory:()=>{throw new Error('Unavailable');}});
check(!P.hasBossVictory(s,'boss-chapter-1'),'Unavailable evidence fails closed');
P.bindSource(s,null);check(P.hasBossVictory(s,'boss-chapter-1'),'Unbind returns local source');
reset();boss('boss-chapter-1');boss('boss-chapter-2');
for(const id of P.ids)toRank(id,25);
const stats=u.stats();
equal([stats.primaryDamage,stats.secondaryDamage,stats.heroMaxHp,stats.castleMaxHp],[102,61,350,1800],'Diminishing damage/HP');
near(stats.attackCooldown,.30);near(stats.heroDamageReduction,.35);near(stats.castleDamageReduction,.475);
equal([stats.swingCap,stats.fortressRadius,stats.counterBonus,stats.counterWindow,stats.foodHealing,stats.monkHealing],
  [5,360,113,4,120,42],'Bounded base values');
near(stats.swingMoveScale,.75);near(u.clampMoveScale(1),.85);
near(u.clampHeroDamageReduction(1),.35);near(u.clampCastleDamageReduction(1),.5);
near(u.dashCooldown(),.75);near(u.dashImmunity(),.20);
const spent=100000-s.gold;equal(spent,53875,'All six paths match economy model A total');
equal(Array.from({length:25},(_,i)=>P.rankPrice('blade',i+1)).reduce((a,b)=>a+b,2000),9125,'Blade total includes separate fees');
check(Object.isFrozen(stats),'Stat result is immutable');
Object.assign(s.hero,{x:700,y:400,riposte:4});
rt.input.mouseAimActive=true;rt.input.pointerOverCanvas=true;rt.input.pointerScreen={x:850,y:400};
const comboTarget={x:760,y:400,hp:10000,maxHp:10000,team:'enemy',kind:'Warrior',combatId:1};
s.enemies=[comboTarget];
check(c.requestTripleSlash(),'Existing skill consumes rank 25 base damage');
c.updateHeroSwing(.9);
equal(comboTarget.hp,10000-3*102-113,'Three derived base hits, counter once');
for(let rank=0;rank<=25;rank++){
  const ranks=Object.fromEntries(P.ids.map(id=>[id,rank])),v=M.BaseStats.resolve(ranks);
  check(v.attackCooldown>=.30&&v.attackCooldown>M.config.SWING.end,'Full contact fits every cooldown');
  check(v.heroDamageReduction<=.35&&v.castleDamageReduction<=.5,'DR ceilings at every rank');
  check(v.foodCooldown>=1.2&&v.swingCap<=5,'No milestone overflow');
}
// Recompute cannot heal or stack. Purchases grant only the diminishing HP delta.
for(const [id,hpField,rank,delta] of [['oath','hero',10,8],['oath','hero',20,4],['bastion','castle',10,40],['bastion','castle',20,20]]){
  reset();boss('boss-chapter-1');boss('boss-chapter-2');toRank(id,rank);
  check(u.unlockTier(id,rank===10?'tier-2':'tier-3'),'Unlock before HP delta');
  s[hpField].hp=50;check(u.buyUpgrade(id),'Buy HP rank');equal(s[hpField].hp,50+delta,'Heal delta only');
  for(let i=0;i<10;i++)u.applyBaseStats();
  equal(s[hpField].hp,50+delta,'Repeated recompute does not heal');
}
reset();boss('boss-chapter-1');boss('boss-chapter-2');toRank('bastion',25);
Object.assign(s.hero,{x:s.castle.x-100,y:s.castle.y,hp:100,maxHp:100});
for(const [target,amount,expected] of [[s.hero,18,12],[s.hero,24,16],[s.castle,13,7],[s.castle,24,13]]){
  s.hero.invuln=0;s.hero.stagger=0;const before=target.hp;
  c.hurt(target,amount,{x:s.hero.x-50,y:s.hero.y,kind:'Warrior',team:'enemy'});
  equal(before-target.hp,expected,'Defense retains meaningful incoming damage');
}
s.hero.invuln=0;s.hero.x=s.castle.x-400;const outside=s.hero.hp;c.hurt(s.hero,24);
equal(outside-s.hero.hp,24,'Aura respects radius');
s.hero.invuln=0;s.hero.x=s.castle.x-100;s.castle.hp=0;const dead=s.hero.hp;c.hurt(s.hero,18);
equal(dead-s.hero.hp,18,'Fallen fortress cannot protect hero');
// Real economy consumes the derived healing amount and unchanged mining configuration.
reset();boss('boss-chapter-1');boss('boss-chapter-2');toRank('oath',25);
s.hero.hp=100;rt.economy.healHero();equal(s.hero.hp,220,'Bekal uses base resolver');equal(s.food,2,'One bekal per heal');
const healerAi={};M.installAi({...rt,ai:healerAi,bossSystem:{}});
Object.assign(s.hero,{x:700,y:400,hp:50});
const monk={x:730,y:400,team:'ally',kind:'Monk',healThink:1,healTarget:s.hero,cooldown:0};
healerAi.updateHealer(monk,1/60);equal(s.hero.hp,92,'Actual Monk cast uses diminishing base heal');
equal(monk.cooldown,3,'Monk cooldown is unchanged');
const ally={x:700,y:400,hp:50,maxHp:100,team:'ally'};
Object.assign(monk,{healThink:1,healTarget:ally,cooldown:0});
healerAi.updateHealer(monk,1/60);equal(ally.hp,66,'Other allies retain base 16 heal');
const enemyWounded={x:700,y:400,hp:50,maxHp:100,team:'enemy'};
Object.assign(monk,{team:'enemy',healThink:1,healTarget:enemyWounded,cooldown:0});
healerAi.updateHealer(monk,1/60);equal(enemyWounded.hp,62,'Enemy Monk retains base 12 heal');
const mine=rt.world.goldNodes[0];Object.assign(s.hero,{x:mine.x,y:mine.y,healCooldown:0});
const goldBefore=s.gold;rt.economy.gather();rt.economy.updateWork(.91);
equal(s.gold-goldBefore,10000,'Manual mining value preserved');
// Sustained Space at 60 Hz runs through the real simulation update ordering for 30 s.
for(const rank of [11,15,20,25]){
  reset();boss('boss-chapter-1');boss('boss-chapter-2');toRank('rhythm',rank);toRank('blade',rank);
  Object.assign(s.hero,{x:700,y:400});s.allies=[];
  const enemy={x:760,y:400,hp:100000,maxHp:100000,team:'enemy',kind:'Warrior',combatId:1};
  s.enemies=[enemy];rt.input.mouseAimActive=true;rt.input.pointerOverCanvas=true;
  rt.input.pointerScreen={x:850,y:400};rt.input.keys.add(' ');
  let completed=0,oldStrike=null;
  for(let i=0;i<1800;i++){
    Object.assign(enemy,{x:760,y:400,stagger:0,knockX:0,knockY:0});
    rt.simulation.update(1/60);
    if(oldStrike&&oldStrike!==s.hero.strike){
      check(oldStrike.elapsed>=M.config.SWING.end,'Strike reaches full contact end');
      equal(oldStrike.hits.size,1,'One distinct hit in complete contact');completed++;
    }
    oldStrike=s.hero.strike;
  }
  check(completed>=85&&completed<=100,'Rank '+rank+' sustained cadence: '+completed);
  equal(s.combatStats.hits,s.combatStats.swings-(s.hero.strike?.hits.size===0?1:0),'No skipped contact during held attack');
}
// Existing arena carry keeps explicit proof/payment, using the same derived capacities.
reset();boss('boss-chapter-1');boss('boss-chapter-2');toRank('blade',25);toRank('oath',25);toRank('bastion',25);
const expedition=new M.Expedition(),request=expedition.startNew();
const receipt={...request,outcome:'won',gold:s.gold,ranks:s.ranks,upgradeProgress:P.snapshot(s)};
const invalidReceipt={...receipt,upgradeProgress:{...receipt.upgradeProgress,bossVictories:[]}};
assert.throws(()=>expedition.finishArena(invalidReceipt),/paid tiers/);checks++;
equal(expedition.snapshot().activeArena,request,'Invalid carry cannot advance arena');
const carry=expedition.finishArena(receipt).nextArena.carry;
equal([carry.hero.maxHp,carry.castle.maxHp],[350,1800],'Carry uses derived max HP');
check(Object.isFrozen(carry.upgradeProgress.paidTierUnlocks.blade),'Carry is deeply immutable');
const receiver=new M.GameSession({world:rt.world});check(P.restore(receiver,carry.upgradeProgress),'Carry restores paid progress');
equal(receiver.ranks.blade,25,'Carry keeps rank 25');
// Reset destroys ranks, fees and proof, including bound controller references.
P.bindSource(s,{hasBossVictory:()=>true});s.resetForRun();
equal(P.ids.map(id=>s.ranks[id]).join(','),'0,0,0,0,0,0','Reset ranks');
check(P.ids.every(id=>s.paidTierUnlocks[id].length===0),'Reset fees');
equal(s.upgradeProgress.bossVictories.length,0,'Reset evidence');equal(s.progressSource,null,'Reset external source');
equal([s.gold,s.hero.maxHp,s.castle.maxHp],[80,100,500],'Reset resources and base HP');
rt.navigation.dispose();
console.log('PASS upgrade tiers: '+checks+' checks; six paths, boundaries, atomic payment, proof/source, carry/reset, stat caps, defense, healing/mining, 30 s held attacks at ranks 11/15/20/25.');
