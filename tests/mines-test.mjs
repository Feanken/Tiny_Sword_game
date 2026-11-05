import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),context={};context.window=context;vm.createContext(context);
for(const file of ['maps/island.js','maps/floor-geometry.js','maps/campaign-islands.js','maps/validate-map.js','src/config.js','src/world/world.js',
  'src/math.js','src/navigation.js','src/mines.js','src/mine-visual.js','src/mines-integration.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const M=context.PenjagaModules,P=M.MineParameters,original=context.PenjagaMaps['campaign-islands'],originalText=JSON.stringify(original);
let checks=0;const check=(ok,label)=>{assert(ok,label);checks++;},close=(a,b,label)=>check(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
function fixture(profile='standard'){
  const world=new M.World(M.prepareMineMap(original)),session={gold:80,state:'playing',phase:'prepare',hero:{...world.heroSpawn,hp:100},castle:{...world.castle,hp:500},gameRandom:Math.random,combatStats:{},allies:[],enemies:[],combatUnits:[],approachSlots:new Map()};
  const math={},navigation={};M.installMath({math,session});M.installNavigation({world,session,math,navigation,config:M.config,combat:{heroAttackAge:()=>0}});
  let allowed=true,panel=false;
  const mines=M.createMines({world,session,profile,testingYield:M.config.GATHERING_REWARDS.gold,isActive:()=>allowed,
    hasBossVictory:id=>P.chapters.indexOf(mines.snapshot().chapterId)>=Number(id.at(-1)),
    canPurchase:()=>session.phase==='prepare'&&(session.state==='playing'||session.state==='paused'&&panel)});
  const enter=id=>{world.applyChapterPreview(id);return mines.enterChapter({runId:'test-run',chapterId:id});};enter('chapter-1');
  const advance=seconds=>{for(let n=seconds;n>1e-9;n-=.05)mines.update(Math.min(.05,n));};
  function stand(id){const node=mines.nodes().find(n=>n.id===id);for(const radius of [58,68,78])for(let i=0;i<24;i++){
    const a=Math.PI/2+i*Math.PI/12,p={x:node.x+Math.cos(a)*radius,y:node.y+Math.sin(a)*radius};if(navigation.positionFits(p.x,p.y)){Object.assign(session.hero,p);return p;}}
    throw new Error('No safe mining position for '+id);
  }
  return {world,session,mines,navigation,math,enter,advance,stand,allow:value=>allowed=value,panel:value=>panel=value,dispose:()=>navigation.dispose()};
}
let f=fixture(),{mines:m,session:s}=f;
check(JSON.stringify(original)===originalText,'Map source is never mutated');
check(m.status().stageId==='rock'&&m.status().yield===25&&m.status().remaining===20,'Standard initial state');
check(m.purchaseNextLevel().reason==='chapter-locked'&&s.gold===80,'Chapter1 cannot buy outpost');
const first=JSON.stringify(m.snapshot());check(m.enterChapter({runId:'test-run',chapterId:'chapter-1'}).reason==='already-entered','Same chapter is idempotent');check(JSON.stringify(m.snapshot())===first,'Repeat preserves exact state');
check(!m.enterChapter({runId:'another-run',chapterId:'chapter-1'}).ok,'New run needs explicit reset');
check(!m.enterChapter({runId:'test-run',chapterId:'chapter-3'}).ok,'Cannot skip chapter');
for(const id of ['gold-north-01','gold-southwest-01','missing'])check(!m.interact(id).ok,'Locked/unknown node '+id);
f.stand('gold-01');const before=s.gold,receipt=m.interact('gold-01');check(receipt.ok,'Valid harvest');close(s.gold-before,25,'Standard actual credit');
check(m.interact('gold-01').reason==='cannot-harvest','No immediate duplicate harvest');
const saved=JSON.stringify(m.snapshot());m.enterChapter({runId:'test-run',chapterId:'chapter-1'});check(JSON.stringify(m.snapshot())===saved,'Repeat keeps partial quota and cooldown');
f.advance(.18);check(m.status().gatherCooldownRemaining<=1e-9,'Gather gap measured in simulation seconds');

//20/21 across the operation's node allocations, never20 per node.
for(const node of m.nodes())while(m.status(node.id).nodeRemaining>0){f.stand(node.id);check(m.interact(node.id).ok,'Consume allocated action');f.advance(.18);}
check(m.status().remaining===0&&m.snapshot().chapters['chapter-1'].actions===20,'Exactly20 total actions');
close(m.snapshot().chapters['chapter-1'].manualGold,500,'Maximum standard manual chapter1');
const zero=s.gold;f.stand('gold-01');check(!m.interact('gold-01').ok&&s.gold===zero,'Action21 cannot credit');

f.enter('chapter-2');check(m.status().remaining===20&&m.snapshot().stageId==='rock','New chapter adds quota once, carries operation');
s.gold=149;const unbought=JSON.stringify(m.snapshot());check(m.purchaseNextLevel().reason==='insufficient-gold'&&s.gold===149,'Cost minus one150');check(JSON.stringify(m.snapshot())===unbought,'Failed purchase atomic');
s.gold=150;check(m.purchaseNextLevel().ok&&s.gold===0&&m.snapshot().stageId==='outpost','Exact150');
check(m.status().yield===35&&m.status().production===6,'Outpost parameters reflect actual stage');
const purchased=JSON.stringify(m.snapshot());check(!m.purchaseNextLevel().ok&&s.gold===0,'Repeated outpost purchase cannot charge');m.enterChapter({runId:'test-run',chapterId:'chapter-2'});check(JSON.stringify(m.snapshot())===purchased,'Repeat keeps purchase and new quota');
f.stand('gold-north-01');close(m.interact('gold-north-01').goldDelta,35,'All nodes share level');
check(m.enterChapter({runId:'test-run',chapterId:'chapter-1'}).reason==='stale-chapter','Old chapter cannot refill or regress');
f.advance(5.99);const partial=m.snapshot().chapters['chapter-2'];check(partial.passiveTicks===0,'No early tick');
m.enterChapter({runId:'test-run',chapterId:'chapter-2'});f.advance(.01);close(m.snapshot().chapters['chapter-2'].passiveGold,6,'One operation tick, not four nodes');
const phaseBefore=m.snapshot().chapters['chapter-2'].passiveElapsedSeconds;
f.enter('chapter-3');check(m.status().remaining===20&&m.status().stageId==='outpost','Chapter3 carries purchased outpost');
s.gold=249;check(!m.purchaseNextLevel().ok&&s.gold===249,'Cost minus one250');s.gold=250;check(m.purchaseNextLevel().ok&&s.gold===0,'Exact250');
check(m.snapshot().purchases.reduce((n,p)=>n+p.cost,0)===400,'Total construction400');
check(m.status().yield===45&&m.status().production===16&&!m.status().next,'House complete');
check(m.purchaseNextLevel().reason==='max-level'&&s.gold===0,'Repeated house purchase is free rejection');
for(const node of m.nodes())while(m.status(node.id).nodeRemaining>0){f.stand(node.id);check(m.interact(node.id).ok,'House shared quota');f.advance(.18);}
close(m.snapshot().chapters['chapter-3'].manualGold,900,'House max manual900');check(!m.interact('gold-01').ok,'House action21 rejected');

// Pause, dialogs, menu, loading, review, hidden window and no offline catch-up.
for(const state of ['paused','ready','loading','won','lost']){s.state=state;const snap=JSON.stringify(m.snapshot()),gold=s.gold;f.advance(12);check(JSON.stringify(m.snapshot())===snap&&s.gold===gold,'No income in '+state);}
s.state='playing';f.allow(false);const inactive=JSON.stringify(m.snapshot());f.advance(12);check(JSON.stringify(m.snapshot())===inactive,'Review/dialog/visibility guard stops clock');f.allow(true);
check(!m.update(3600).ok&&!m.update(NaN).ok&&!m.update(-1).ok,'Reject wall-clock/invalid dt');
const json=m.snapshot();check(JSON.stringify(JSON.parse(JSON.stringify(json)))===JSON.stringify(json),'Snapshot serializable');json.purchases[0].cost=999;json.chapters['chapter-3'].remaining['gold-01']=999;check(m.snapshot().purchases[0].cost===150&&m.status().remaining===0,'Snapshot is detached');
const inspect=JSON.stringify(m.snapshot());for(let i=0;i<100;i++){m.status('gold-01');m.nodes();m.snapshot();}check(JSON.stringify(m.snapshot())===inspect,'Panel inspections never tick or refill');
const wallet=s.gold;m.reset();check(s.gold===wallet&&m.snapshot().runId===null&&m.snapshot().stageId==='rock','Reset clears only mine state, campaign owns wallet');
check(m.enterChapter({runId:'new-run',chapterId:'chapter-1'}).ok&&m.status().remaining===20,'Fresh run restarts quota and purchases');f.dispose();

// Upgrade preserves timer/tick phase; exactly50 additional-production ticks/bab.
f=fixture();m=f.mines;s=f.session;f.enter('chapter-2');f.advance(5.5);s.gold=150;check(m.purchaseNextLevel().ok,'Buy mid-period');
close(m.status().passiveElapsedSeconds,5.5,'Purchase does not reset production phase');f.advance(.5);close(s.gold,6,'Only new level paid at next tick');
f.advance(294);close(m.snapshot().chapters['chapter-2'].passiveGold,300,'Outpost max passive300');check(m.status().passiveTicks===50,'Tick cap50');
const capped=JSON.stringify(m.snapshot()),cappedGold=s.gold;f.advance(600);check(JSON.stringify(m.snapshot())===capped&&s.gold===cappedGold,'Holding last enemy cannot farm after cap');
f.enter('chapter-3');s.gold=250;m.purchaseNextLevel();f.advance(300);close(s.gold,800,'House max passive800');f.dispose();

f=fixture('user-testing');m=f.mines;s=f.session;f.stand('gold-01');check(m.status().yield===10000&&m.status().standardYield===25&&m.status().manualOverride===10000,'Explicit preserved testing override');
close(m.interact('gold-01').goldDelta,10000,'Override actual credit');check(m.status().remaining===19,'Override keeps quota');f.enter('chapter-2');m.purchaseNextLevel();close(m.status().yield,10000,'Testing override persists through stage');f.advance(6);close(m.snapshot().chapters['chapter-2'].passiveGold,6,'Override does not multiply passive production');
f.stand('gold-01');s.gold=Number.MAX_SAFE_INTEGER;const overflow=JSON.stringify(m.snapshot());check(!m.interact('gold-01').ok&&JSON.stringify(m.snapshot())===overflow,'Overflow cannot spend quota');
f.dispose();

for(const profile of ['standard','user-testing']){
  f=fixture(profile);m=f.mines;s=f.session;
  for(let index=0;index<3;index++){
    const chapterId=P.chapters[index];if(index){f.enter(chapterId);s.gold=1000;check(m.purchaseNextLevel().ok,'Economic scenario construction '+profile);}
    for(const node of m.nodes())while(m.status(node.id).nodeRemaining){f.stand(node.id);check(m.interact(node.id).ok,'Economic scenario action '+profile);f.advance(.18);}
    close(m.snapshot().chapters[chapterId].manualGold,20*(profile==='standard'?P.yield[index]:10000),'Full chapter quota yield '+profile+' '+chapterId);
    check(!m.interact('gold-01').ok,'No21st economic scenario '+profile);
  }
  close(Object.values(m.snapshot().chapters).reduce((sum,l)=>sum+l.manualGold,0),profile==='standard'?2100:600000,'Full campaign manual budget '+profile);f.dispose();
}

// Installer matches Chat1's boolean contract and trusts only campaign identity/proof.
f=fixture();s=f.session;const port={},proof=new Set();let cursor={runId:7,chapterId:'chapter-1',status:'active'},override=null;
const campaign={enabled:true,snapshot:()=>({...cursor}),miningRewardOverride:()=>override,hasBossVictory:id=>proof.has(id)};
M.installMines({mines:port,campaign,session:s,world:f.world,config:M.config});
check(port.snapshot()===null&&port.interact('gold-01')===false,'Empty installer gives no reward');
check(!port.enterChapter({runId:8,chapterId:'chapter-1'}).ok&&port.snapshot()===null,'Wrong campaign identity has no side effects');
check(port.enterChapter(cursor).ok,'Install enters trusted chapter');f.stand('gold-01');
check(port.interact('gold-01')===true&&port.lastReceipt().goldDelta===25,'Boolean success with accurate receipt');
check(port.interact('gold-01')===false,'Boolean false for rejected interaction');
for(const [flag,value] of [['attack',.2],['dash',.2],['stagger',.2],['moving',true]]){
  for(let i=0;i<12;i++)port.update(1/60);s.hero[flag]=value;const snap=JSON.stringify(port.snapshot());check(port.interact('gold-01')===false&&JSON.stringify(port.snapshot())===snap,'Combat state blocks harvest '+flag);s.hero[flag]=false;
}
cursor={...cursor,chapterId:'chapter-2',status:'chapter-review'};s.state='chapter-review';s.phase='review';f.world.applyChapterPreview('chapter-2');port.enterChapter(cursor);s.gold=150;
check(port.purchaseNextLevel()===false&&port.lastReceipt().reason==='boss-locked'&&s.gold===150,'Chapter alone never invents boss evidence');
proof.add('boss-chapter-1');check(port.purchaseNextLevel()===true&&s.gold===0,'Review purchase with real source proof');
const reviewSnap=JSON.stringify(port.snapshot());for(let i=0;i<120;i++)port.update(.1);check(JSON.stringify(port.snapshot())===reviewSnap,'Chapter review produces no income');
s.state='playing';s.phase='prepare';cursor.status='active';for(let i=0;i<60;i++)port.update(.1);close(s.gold,6,'Installed operation pays exactly once');
const stable=JSON.stringify(port.snapshot());port.enterChapter(cursor);check(JSON.stringify(port.snapshot())===stable,'Installer duplicate preserves tick/purchase/quota');
s.phase='battle';check(port.purchaseNextLevel()===false&&port.lastReceipt().reason==='purchase-closed','Battle purchase rejected');
port.reset();port.reset();check(port.snapshot()===null,'Installer reset idempotent');override=10000;cursor={runId:8,chapterId:'chapter-1',status:'active'};s.phase='prepare';f.world.applyChapterPreview('chapter-1');port.enterChapter(cursor);
check(port.status().yield===10000&&port.snapshot().manualOverride===10000,'Runtime resolves testing override explicitly on new run');f.dispose();

f=fixture();s=f.session;s.wood=40;let residentTicks=0,legacyCalls=0;
const sharedPort={},sharedCursor={runId:'opaque-run-token',chapterId:'chapter-1',status:'active'},sharedProof=new Set();
const sharedCampaign={enabled:true,snapshot:()=>({...sharedCursor}),miningRewardOverride:()=>null,hasBossVictory:id=>sharedProof.has(id),
  passiveTick:()=>{if(residentTicks>=50)return false;residentTicks++;s.gold+=4;s.wood+=3;return true;}};
const legacy=()=>{legacyCalls++;},sharedEconomy={updatePassiveIncome:legacy};
M.installMines({mines:sharedPort,campaign:sharedCampaign,economy:sharedEconomy,session:s,world:f.world,config:M.config});sharedPort.enterChapter(sharedCursor);
const sharedStep=frames=>{for(let i=0;i<frames;i++){sharedPort.update(1/60);sharedEconomy.updatePassiveIncome(1/60);}};
sharedStep(360);close(s.gold,84,'Residents at same exact6s tick');check(residentTicks===1&&sharedPort.status().passiveTicks===1,'One shared tick in rock stage');
sharedCursor.chapterId='chapter-2';f.world.applyChapterPreview('chapter-2');sharedProof.add('boss-chapter-1');sharedPort.enterChapter(sharedCursor);residentTicks=0;s.gold=150;sharedPort.purchaseNextLevel();
sharedStep(360);close(s.gold,10,'Shared clock pays6+4 once');check(s.wood===46,'Resident wood from owner only');
for(let i=0;i<10;i++)sharedEconomy.updatePassiveIncome(1/60);close(s.gold,10,'Repeated income callback cannot duplicate tick');
sharedStep(17640);close(s.gold,500,'Shared outpost cap300 plus residents200');check(residentTicks===50&&sharedPort.status().passiveTicks===50,'Both clocks cap together');
sharedPort.dispose();check(sharedEconomy.updatePassiveIncome===legacy,'Disposal restores income hook');sharedEconomy.updatePassiveIncome(.1);check(legacyCalls===1,'Legacy path preserved after disposal');f.dispose();

// Real World/navigation: reserved plot exists at every level; bridges still work.
const collision=[];f=fixture();m=f.mines;s=f.session;
for(const [chapterId,stage] of [['chapter-1','rock'],['chapter-2','outpost'],['chapter-3','mine-house']]){
  if(chapterId!=='chapter-1'){f.enter(chapterId);s.gold=1000;m.purchaseNextLevel();}
  check(m.snapshot().stageId===stage&&f.navigation.componentCount===1,'Connected world '+stage);
  const node=m.nodes().find(n=>n.id==='gold-01');check(!f.navigation.positionFits(node.x,node.y),'Reserved plot collides '+stage);
  for(const n of m.nodes().filter(n=>m.status(n.id).nodeActive)){
    const point=f.stand(n.id);check(f.navigation.positionFits(point.x,point.y)&&Math.hypot(point.x-n.x,point.y-n.y)<=85,'Safe mining space '+n.id+' '+stage);
    check(f.navigation.routeTo(f.world.heroSpawn,point).length>0,'Reachable mining space '+n.id+' '+stage);
  }
  const traversals=[];
  for(const [id,start,end] of [['bridge-north',{x:1568,y:480},{x:1568,y:832}],['bridge-southwest',{x:672,y:1312},{x:992,y:1184}]]){
    if(!f.world.isRegionActive(id))continue;
    for(const direction of [1,-1]){
      const actor={...(direction===1?start:end),hp:100,facing:1},goal=direction===1?end:start;let frames=0;
      for(;frames<3600&&Math.hypot(actor.x-goal.x,actor.y-goal.y)>5;frames++){f.navigation.steerMove(actor,goal,1/60,185);check(f.world.isWalkable(actor.x,actor.y),'Traversal stays on ground');}
      check(frames<3600,'Bridge not obstructed '+id+' '+stage);traversals.push({id,direction,frames});
    }
  }
  collision.push({stage,componentCount:f.navigation.componentCount,traversals});
}
check(JSON.stringify(original)===originalText,'No authoring mutation after upgrades');f.dispose();
console.log(JSON.stringify({result:'PASS',checks,profiles:{standard:[25,35,45],userTestingOverride:10000},costs:[150,250],quota:20,passive:{period:6,stages:[0,6,16],tickLimit:50},collision},null,2));
