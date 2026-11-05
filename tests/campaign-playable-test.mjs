import assert from 'node:assert/strict';
import {createCampaignFixture} from './fixtures/campaign-runtime.mjs';
let checks=0;const check=(ok,msg)=>{assert(ok,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const events=[];
const {r,M}=createCampaignFixture({mines:{
  reset:()=>events.push('reset'),enterChapter:value=>events.push({...value}),
  update:dt=>events.push(dt),interact:id=>{events.push(id);return true;},snapshot:()=>({test:true})
}});
const s=r.session,c=r.campaign;
function start(seed=723){r.lifecycle.startGame(seed);s.waveTimer=99999;}
function killAll(){
  for(const enemy of s.enemies)if(enemy.hp>0){
    r.combat.hurt(enemy,1000000,s.hero);
    const gold=s.gold;r.combat.hurt(enemy,1000000,s.hero);eq(s.gold,gold,'Dead unit gives no repeated bounty');
  }
  s.enemies=s.enemies.filter(u=>u.hp>0);
}
function fixtureWave(){
  r.director.startWave();const receipt=c.receipt(),count=r.config.waves[s.waveIndex].count;
  const schedule=r.director.arrivalSchedule,slots=schedule.flatMap(e=>e.slots);
  eq(slots.length,count,'Scheduling preserves enemy total');
  eq(new Set(slots).size,count,'Each authored enemy is dispatched once');
  check(schedule.every(e=>e.departure>=.3-1e-9&&r.world.entryPaths.has(e.pathId)),'Only open paths with valid departure times');
  const first=schedule.filter(e=>e.packet===0),paths=new Set(first.map(e=>e.pathId));
  if(c.snapshot().chapterIndex>0&&s.waveIndex===0){
    eq(paths.size,1,'New direction introduced alone');
    check(paths.has(c.chapter().newPath),'First packet introduces new gate');
  }
  if(c.snapshot().chapterIndex===1&&s.waveIndex>=2)eq(paths.size,2,'Chapter2 pairs');
  if(c.snapshot().chapterIndex===2&&s.waveIndex===2)eq(paths.size,2,'Chapter3 paired introduction');
  if(c.snapshot().chapterIndex===2&&s.waveIndex>=3)eq(paths.size,3,'Chapter3 triple arrivals');
  eq(new Set(first.map(e=>e.arrival)).size,1,'One target arrival across packet paths');
  let time=0;
  while(s.spawned<count||s.waveIndex===4&&!s.bossSpawned){
    s.elapsed+=.05;r.director.updateSpawns(.05);killAll();time+=.05;
    assert(time<200,'Spawns finish');
  }
  killAll();check(c.canCompleteWave(),'Wave completion predicate');
  check(r.director.finishWave(receipt),'First completion accepted');
  const state=JSON.stringify({gold:s.gold,wood:s.wood,food:s.food,hp:s.hero.hp,castle:s.castle.hp,progress:c.snapshot()});
  for(let i=0;i<5;i++)check(!r.director.finishWave(receipt),'Duplicate receipt rejected');
  eq(JSON.stringify({gold:s.gold,wood:s.wood,food:s.food,hp:s.hero.hp,castle:s.castle.hp,progress:c.snapshot()}),state,'Completion replay is atomic');
}
start();
const world=r.world,hero=s.hero,castle=s.castle,runId=c.snapshot().runId;
eq(world.wavePathIds.join(','),'path-west','Chapter one west only');
check(!world.isRegionActive('island-north')&&!world.isRegionActive('bridge-north'),'North locked');
s.gold=100000;for(let i=0;i<10;i++)check(r.upgrading.buyUpgrade('blade'),'Reach rank10 legitimately');
check(!r.upgrading.unlockTier('blade','tier-2'),'No tier before real boss proof');
// Premature/replayed finish callbacks cannot award or skip the chapter.
const wallet=s.gold;check(!r.lifecycle.finish(true),'Direct win callback cannot bypass campaign');eq(s.gold,wallet,'Premature finish is free');
check(!r.lifecycle.finish(false),'Stale loss callback cannot kill living defenders');
for(let chapter=0;chapter<3;chapter++){
  for(let wave=0;wave<5;wave++){
    eq(s.waveIndex,wave,'Local wave cursor');
    if(wave===4){
      r.director.startWave();const receipt=c.receipt();
      r.bossSystem.spawnBoss();r.combat.hurt(s.boss,1000000,s.hero);
      check(!c.hasBossVictory('boss-chapter-'+(chapter+1)),'Boss death alone is not proof');
      check(!r.director.finishWave(receipt),'Pending spawns prevent finish');
      // Continue fixture using the existing launch, without resetting its schedule.
      let t=0;while(s.spawned<20){s.elapsed+=.05;r.director.updateSpawns(.05);killAll();assert((t+=.05)<200);}
      killAll();
      s.hero.hp=40;s.castle.hp=200;
      s.wood=37;s.food=4;
      const ally=s.allies[0],aliveHp=ally?.hp;
      check(r.director.finishWave(receipt),'Boss wave resolves after the last enemy');
      const after=s.gold;check(!r.director.finishWave(receipt),'Repeated boss result rejected');eq(s.gold,after,'Boss reward once');
      check(c.hasBossVictory('boss-chapter-'+(chapter+1)),'Committed boss proof');
      eq(s.wood,52,'Wood carried plus wave reward');eq(s.food,5,'Food carried plus wave reward');
      if(chapter<2){
        check(r.world===world&&s.hero===hero&&s.castle===castle,'One ongoing world and actor identity');
        eq(s.hero.hp,100,'Actual hero HP plus wave25 and chapter50 capped at100');
        eq(s.castle.hp,340,'Actual fortress HP plus140, no full heal');
        check(s.allies[0]===ally&&ally.hp===aliveHp,'Live ally carried with actual HP');
        eq(s.ranks.blade,chapter===0?10:20,'Rank carry');
        check(s.state==='chapter-review','Review freezes the world');
        const frozen=JSON.stringify(c.snapshot()),elapsed=s.elapsed,n=events.length;
        r.simulation.update(10);eq(s.elapsed,elapsed,'Review timer frozen');eq(events.length,n,'Mines not ticked in review');
        eq(JSON.stringify(c.snapshot()),frozen,'No progress while reviewing');
        check(c.beginPreparation(),'Player starts next preparation');check(!c.beginPreparation(),'Continue is idempotent');
        s.gold=100000;
        check(r.upgrading.unlockTier('blade',chapter===0?'tier-2':'tier-3'),'Tier uses committed campaign proof');
        const target=chapter===0?20:25;while(s.ranks.blade<target)check(r.upgrading.buyUpgrade('blade'),'Next ranks available');
        if(chapter===0)check(!r.upgrading.unlockTier('blade','tier-3'),'Boss2 still required');
      }
    }else fixtureWave();
  }
}
eq(c.snapshot().clearedWaveIds.length,15,'All 15 waves');eq(s.state,'won','Full campaign won');
eq(c.snapshot().bossVictories.length,3,'All boss evidence');
eq(world.activeRegionIds.length,5,'Three islands and two bridges open');
const gold=s.gold,score=s.score;check(!r.lifecycle.finish(true),'Repeated final win rejected');
eq(s.gold,gold,'Final wallet unchanged');eq(s.score,score,'Final score unchanged');
// Exact guaranteed economy, with real spawns and lethal-damage fixture but no mining/pickups/passive.
start(9);
for(let chapter=0;chapter<3;chapter++){
  const before=s.gold;
  for(let wave=0;wave<5;wave++)fixtureWave();
  eq(s.gold-before,[3910,7490,11820][chapter],'Economy model A guaranteed income chapter '+(chapter+1));
  if(chapter<2)c.beginPreparation();
}
eq(s.gold,23300,'Total guaranteed including80 initial');
eq(events.filter(e=>e&&e.runId===runId&&e.chapterId).length,3,'One mines boundary per chapter');
// Stale prior-run receipts, pause, death in each chapter, restart and topology reset.
const stale=c.receipt();
for(let chapter=0;chapter<3;chapter++){
  start();
  for(let i=0;i<chapter;i++){for(let w=0;w<5;w++)fixtureWave();c.beginPreparation();}
  s.phase='battle';s.hero.hp=chapter===1?0:100;s.castle.hp=chapter===1?500:0;
  const before=s.gold;r.simulation.update(1/60);
  eq(s.state,'lost','Loss chapter '+(chapter+1));eq(s.gold,before,'No reward on death');
  check(!r.lifecycle.finish(false),'Repeated loss rejected');
}
start();check(!c.completeWave(stale).accepted,'Prior-run receipt rejected');
eq(s.ranks.blade,0,'New run resets ranks');eq(s.paidTierUnlocks.blade.length,0,'New run resets tier fees');
eq(c.snapshot().bossVictories.length,0,'New run resets boss proof');
eq(world.activeRegionIds.join(','),'island-main','New run closes other islands');
eq(s.allies.length,1,'One initial Archer only');
eq(M.config.GATHERING_REWARDS.gold,10000,'Manual mining override preserved');eq(c.miningRewardOverride(),null,'Standard profile opts out of override');
const n=events.length;s.state='paused';r.simulation.update(5);eq(events.length,n,'No mines tick on pause');
s.state='playing';r.simulation.update(1/60);check(events.some(e=>e===1/60),'Mines fixed-step hook');
const node=world.goldNodes[0];Object.assign(s.hero,{x:node.x,y:node.y,moving:false,attack:0,dash:0,stagger:0,work:null});
s.gatherCooldown=0;const resource=r.economy.nearestResource();eq(resource.type,'gold','Mine resource selected');
const beforeGold=s.gold,beforeCalls=events.filter(e=>typeof e==='string'&&e.startsWith('gold-')).length;
r.economy.gather();r.economy.updateWork(.9);r.economy.updateWork(.9);
eq(events.filter(e=>typeof e==='string'&&e.startsWith('gold-')).length,beforeCalls+1,'Completed work calls mine port once');
eq(s.gold,beforeGold,'Economy caller never awards gold on top of mine port');
for(let i=0;i<51;i++)c.passiveTick();eq(c.snapshot().passiveTicks,50,'Base passive bounded50 per chapter');
const testProfile=createCampaignFixture({economyProfileId:'testing'});testProfile.r.lifecycle.startGame(1);
eq(testProfile.r.campaign.miningRewardOverride(),10000,'Testing override explicit');
testProfile.r.navigation.dispose();r.navigation.dispose();
console.log('PASS campaign playable: '+checks+' checks; complete15-wave fixture, rewards/proofs once, gates, carry, failures, reset, mines hooks, profile separation.');
