// Automated player, real Normal statistics/AI/combat/economy. No forced kills, gold, HP or cooldowns.
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {createCampaignFixture} from './fixtures/campaign-runtime.mjs';
const {r}=createCampaignFixture(),s=r.session,seed=Number(process.argv[2]||723);
r.lifecycle.startGame(seed);r.ai.setSquadOrder('guard');
r.input.mouseAimActive=true;r.input.pointerOverCanvas=true;
const log=[],timings=[],bossPatterns=new Map();
let last='',foodUsed=0,recruited=0,repairs=0;
function prepare(){
  const chapter=r.campaign.snapshot().chapterIndex;
  const goals=[
    {blade:10,bastion:10,oath:5,rhythm:0,wind:0,counter:0},
    {blade:20,bastion:20,oath:5,rhythm:5,wind:0,counter:0},
    {blade:25,bastion:25,oath:10,rhythm:5,wind:10,counter:0}
  ][chapter];
  // Keep a small guard force; repair/recruit/upgrade always use the actual transactions.
  while(s.allies.length<4&&s.gold>=55){r.economy.recruitUnit();recruited++;}
  for(const id of ['blade','bastion','oath','rhythm','wind','counter']){
    while(s.ranks[id]<goals[id]){
      const view=r.upgrading.viewUpgrade(id),q=view.actionQuote;
      if(!q.allowed)break;
      if(q.action==='tier')r.upgrading.unlockTier(id,q.tierId);else r.upgrading.buyUpgrade(id);
    }
  }
}
function controls(){
  const h=s.hero;
  r.input.keys.clear();
  if(s.castle.hp<=s.castle.maxHp-140&&s.wood>=30){r.economy.repairCastle();repairs++;}
  if(h.hp<h.maxHp-40&&s.food>0&&h.healCooldown<=0){r.economy.healHero();foodUsed++;}
  if(h.hp<h.maxHp*.85)r.combat.requestOath();
  const enemies=s.enemies.filter(e=>e.hp>0&&!e.entering);
  const target=enemies.sort((a,b)=>r.math.dist(a,h)-r.math.dist(b,h))[0];
  let dx=0,dy=0;
  if(target){
    r.input.pointerScreen={x:target.x,y:target.y};r.input.updateAim();
    const d=r.math.dist(target,h);
    const hazard=s.boss?.bossAction;
    const closeStrike=enemies.find(e=>e.strike?.target===h&&e.strike.timer<.16&&e.kind!=='Archer'&&r.math.dist(e,h)<e.strike.range+10);
    if(hazard?.stage==='warning'&&r.math.dist(h,hazard.target)<130){
      const angle=Math.atan2(h.y-s.boss.y,h.x-s.boss.x)+Math.PI/2;
      dx=Math.cos(angle);dy=Math.sin(angle);
    }else if(closeStrike){dx=(h.x-closeStrike.x)/(r.math.dist(h,closeStrike)||1);dy=(h.y-closeStrike.y)/(r.math.dist(h,closeStrike)||1);}
    else if(d>68){dx=(target.x-h.x)/d;dy=(target.y-h.y)/d;}
    if(Math.abs(dx)>.25)r.input.keys.add(dx>0?'d':'a');
    if(Math.abs(dy)>.25)r.input.keys.add(dy>0?'s':'w');
    if((hazard?.stage==='warning'||closeStrike)&&Math.hypot(dx,dy)>.1)r.combat.requestDash();
    if(d<90){
      r.combat.requestTripleSlash();
      r.input.keys.add(' ');
    }
  }else{
    // Regroup on walkable ground beside the fixed fortress, without teleportation.
    const home={x:r.world.heroSpawn.x,y:r.world.heroSpawn.y},d=r.math.dist(h,home);
    if(d>30){
      dx=(home.x-h.x)/d;dy=(home.y-h.y)/d;
      if(Math.abs(dx)>.25)r.input.keys.add(dx>0?'d':'a');
      if(Math.abs(dy)>.25)r.input.keys.add(dy>0?'s':'w');
    }
  }
}
for(let frame=0;frame<60*2400&&!['won','lost'].includes(s.state);frame++){
  if(s.state==='chapter-review')r.campaign.beginPreparation();
  const key=r.campaign.snapshot().chapterId+'/'+s.waveIndex+'/'+s.phase;
  if(key!==last){
    last=key;
    const entry={at:+s.elapsed.toFixed(2),key,gold:s.gold,heroHp:+s.hero.hp.toFixed(1),
      castleHp:+s.castle.hp.toFixed(1),allies:s.allies.length,ranks:{...s.ranks}};
    log.push(entry);console.log(JSON.stringify(entry));
    if(s.phase==='prepare')prepare();
  }
  if(frame%60===0&&s.phase==='prepare')prepare();
  controls();
  const before=performance.now();r.simulation.update(1/60);timings.push(performance.now()-before);
  if(s.boss)bossPatterns.set(s.boss.campaignBossId,s.boss.pattern);
}
timings.sort((a,b)=>a-b);
const result={seed,difficulty:s.difficulty,economyProfile:'standard',miningActions:0,
  outcome:s.state,elapsed:+s.elapsed.toFixed(2),progress:r.campaign.snapshot(),
  heroHp:+s.hero.hp.toFixed(2),castleHp:+s.castle.hp.toFixed(2),gold:s.gold,wood:s.wood,food:s.food,
  ranks:{...s.ranks},livingAllies:s.allies.length,kills:s.kills,foodUsed,recruited,repairs,
  bossPatterns:Object.fromEntries(bossPatterns),
  simulationP95Ms:+timings[Math.floor(timings.length*.95)].toFixed(3),log};
const dir=path.resolve('artifacts/campaign-playable');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'normal-seed-'+seed+'.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,log:undefined},null,2));r.navigation.dispose();
if(!['won','lost'].includes(s.state))process.exitCode=1;
