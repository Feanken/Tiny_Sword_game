// Headless traversal using the real World, movement, entry AI and separation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context={};context.window=context;vm.createContext(context);
for(const file of ['maps/island.js','maps/crossroads.example.js','maps/floor-geometry.js',
  'maps/campaign-islands.js','maps/validate-map.js','src/world/world.js','src/config.js',
  'src/skill-config.js','src/upgrade-skills.js','src/session.js','src/math.js','src/navigation.js','src/ai.js','src/director.js',
  'src/economy.js','src/boss.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const M=context.PenjagaModules,definition=context.PenjagaMaps['campaign-islands'];
const clone=value=>JSON.parse(JSON.stringify(value));
const report={checks:0,traversals:[],gateTimes:[],traffic:[],validationFailures:[]};
function check(value,message){assert(value,message);report.checks++;}
// Union coverage must reject an interior water gap even when all box corners land.
const hole={version:2,width:256,height:192,tileSize:64,regions:[
  {id:'test-island',kind:'island',origin:{x:0,y:0},localBounds:{left:0,right:256,top:0,bottom:192},
    maskRows:{1:[[0,0],[2,3]]}}
]};
const gap=context.PenjagaFloor.createFloor(hole);
check(gap.contains(32,96)&&gap.contains(160,96)&&!gap.contains(96,96),'Multiple spans retain water gap');
check(!gap.coversRect({left:16,right:240,top:80,bottom:112}),'Union coverage checks interior gap');
hole.regions.push({id:'test-bridge',kind:'bridge',width:64,centerline:[{x:64,y:96},{x:128,y:96}]});
const joined=context.PenjagaFloor.createFloor(hole);
check(joined.canStand(96,96)&&!joined.canStand(96,64),'Bridge floor and edge footprint');
check(!gap.segmentFits({x:32,y:96},{x:160,y:96}),'Continuous segment rejects water gap');
check(joined.segmentFits({x:32,y:96},{x:160,y:96}),'Continuous segment crosses union seams');
function runtime(map=definition){
  const world=new M.World(map),session=new M.GameSession({world});
  session.state='playing';session.combatStats={stalls:0,blockedSeconds:0};
  const noop=()=>{},rt={world,session,config:M.config,navigation:{},math:{},ai:{},director:{},
    economy:{},bossSystem:{},lifecycle:{},upgrading:{},
    ui:{notify:noop,updateUI:noop,announce:noop},
    renderer:{addEffect:noop,float:noop},audio:{tone:noop},
    combat:{heroAttackAge:()=>0,hurt:noop,fireArrow:noop}};
  for(const name of ['Math','Navigation','UpgradeSkills','Ai','Director','Economy','BossSystem'])M['install'+name](rt);
  session.gameRandom=rt.math.seededRandom(723);
  return rt;
}
function setActors(rt,actors){
  rt.session.allies=actors.filter(u=>u.team==='ally');
  rt.session.enemies=actors.filter(u=>u.team==='enemy');
  rt.session.combatUnits=actors.filter(u=>u!==rt.session.hero);
}
function actor(rt,kind='Hero',team='enemy',pathId='path-west',lane=0,jitter={x:0,y:0}){
  const {session,director}=rt;
  if(kind==='Hero'){Object.assign(session.hero,{attack:0,stagger:0});return session.hero;}
  if(kind==='Boss'){
    const previous=rt.world.bossSpawn;
    rt.world.bossSpawn=rt.world.bossSpawns.get(pathId);
    session.waveIndex=4;session.bossSpawned=false;rt.bossSystem.spawnBoss();
    rt.world.bossSpawn=previous;session.waveIndex=0;
    return session.boss;
  }
  if(team==='ally'){
    session.recruitIndex=['Archer','Lancer','Monk','Warrior'].indexOf(kind);
    rt.economy.recruitUnit(true);return session.allies.at(-1);
  }
  session.waveIndex=0;session.spawned=0;
  session.encounters[0]={roster:Array(7).fill(kind),spawnLanes:[lane]};
  director.spawnEnemy(pathId,0);
  const u=session.enemies.at(-1),spawn=rt.world.waveSpawns.get(pathId),p=rt.world.path(pathId);
  u.x=spawn.x+lane*p.entryLaneOffset.x+jitter.x;
  u.y=spawn.y+lane*p.entryLaneOffset.y+jitter.y;
  return u;
}
const dt=1/60,distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function travel(rt,u,start,goal,{entry=false,maxSeconds=100,speed}={}){
  check(rt.world.isWalkable(start.x,start.y),'Valid traversal start');
  if(!entry)check(rt.world.isWalkable(goal.x,goal.y),'Valid traversal destination');
  Object.assign(u,start);u.route=[];u.routeTimer=0;u.routeTarget=null;
  setActors(rt,[u]);let seconds=0,maxStall=0;
  const initial=distance(start,goal);
  for(let frame=0;frame<Math.ceil(maxSeconds/dt);frame++){
    if(entry?!u.entering:distance(u,goal)<4)break;
    if(entry)rt.ai.updateUnit(u,dt);
    else rt.navigation.steerMove(u,goal,dt,speed??u.speed??185);
    seconds+=dt;maxStall=Math.max(maxStall,u.stallSeconds||0);
    assert(rt.world.isWalkable(u.x,u.y),'Actor left floor/collision: '+JSON.stringify({kind:u.kind,x:u.x,y:u.y}));
  }
  check(entry?!u.entering:distance(u,goal)<4,'Traversal timed out: '+JSON.stringify({kind:u.kind,start,goal,at:{x:u.x,y:u.y},initial}));
  return {seconds:Number(seconds.toFixed(3)),maxStall};
}

// Legacy maps keep their original footprint and obstacle answers.
for(const name of ['island','crossroads']){
  check(context.PenjagaMapValidation.validateMap(context.PenjagaMaps[name]).valid,name+' validation');
  const legacy=runtime(context.PenjagaMaps[name]);
  for(let y=80;y<630;y+=13)for(let x=80;x<1195;x+=17)
    assert.equal(legacy.navigation.positionFits(x,y),context.PenjagaMapValidation.positionFits(context.PenjagaMaps[name],x,y));
  legacy.navigation.dispose();report.checks++;
}
check(M.config.GATHERING_REWARDS.gold===10000,'Manual mining preserved');
assert.deepEqual(Array.from(M.config.upgrades,u=>u.id),['blade','rhythm','wind','counter','bastion','oath']);
check(M.config.MAX_UPGRADE_LEVEL===10,'Existing cap preserved');
check(context.PenjagaMapValidation.validateMap(definition).valid,'Campaign validates');
const pristine=JSON.stringify(definition),rt=runtime(),{world,navigation,session}=rt;
for(const [chapter,pathCount] of [['chapter-1',1],['chapter-2',2],['chapter-3',3]]){
  world.applyChapterPreview(chapter);
  check(world.wavePathIds.length===pathCount,chapter+' paths');
  check(navigation.componentCount===1,chapter+' connected graph');
  for(const region of definition.regions.filter(r=>r.kind==='island'&&!world.isRegionActive(r.id))){
    const locked=context.PenjagaFloor.createFloor(definition,[region.id]);
    for(const r of locked.rectangles) {
      const x=r.x+r.width/2,y=r.y+r.height/2;
      check(!world.floorGeometry.contains(x,y),chapter+' locked '+region.id);
      check(!navigation.positionFits(x,y),'Locked floor collision');
      check(navigation.routeTo(session.hero,{x,y}).length===0,'No route onto locked island');
    }
  }
  check(world.floorGeometry.rectangles.every(r=>world.isRegionActive(r.regionId)),'Renderer floor ownership');
  check(world.activeObstacles.every(o=>world.isObjectActive(o.sourceId)),'Active obstacle ownership');
  check(world.goldNodes.length===pathCount+2,'Locked mines filtered');
}
check(JSON.stringify(definition)===pristine,'World never mutates registry definition');
const stamp=world.topologyVersion;
check(!world.applyChapterPreview('chapter-3')&&world.topologyVersion===stamp,'Same set is a no-op');
for(const invalid of [['island-main','bridge-north'],['island-main','island-main'],['unknown']]){
  assert.throws(()=>world.applyOpenRegions(invalid),/cumulative/);report.checks++;
  check(world.topologyVersion===stamp,'Rejected activation is atomic');
}
check(Object.isFrozen(world.floorGeometry)&&Object.isFrozen(world.floorGeometry.rectangles),'Floor snapshots immutable');
const oldFloor=world.floorGeometry,oldVersion=world.topologyVersion;
const mover=actor(rt,'Warrior');Object.assign(mover,{x:1664,y:384,route:[{x:1,y:2}],routeTarget:{x:3,y:4},approachTarget:session.hero,approachSlot:2,combatTarget:session.hero});
setActors(rt,[mover]);session.approachSlots.set(session.hero,[mover]);session.engagements.set(session.hero,1);
navigation.routeFields.set(999,new Int16Array([0]));
let events=0;const stop=world.onTopologyChange(e=>{events++;assert.equal(e.version,world.topologyVersion);});
world.applyChapterPreview('chapter-1');
check(events===1&&world.topologyVersion===oldVersion+1,'One activation event');
check(oldFloor.contains(1664,384)&&!world.floorGeometry.contains(1664,384),'Old snapshot remains stable');
check(world.isWalkable(mover.x,mover.y),'Closing preview relocates actor safely');
check(navigation.routeFields.size===0&&session.approachSlots.size===0&&session.engagements.size===0,'All reservations invalidated');
check(mover.route.length===0&&!mover.routeTarget&&!mover.approachTarget&&!mover.combatTarget,'Actor routing invalidated');
stop();world.applyChapterPreview('chapter-3');check(events===1,'Unsubscribe works');

const bridges=[
  ['north',{x:1568,y:464},{x:1568,y:832}],
  ['southwest',{x:672,y:1312},{x:1008,y:1184}]
];
const types=[['Hero','player'],...['Pawn','Warrior','Archer','Lancer','Monk','Boss'].map(k=>[k,'enemy']),
  ...['Warrior','Archer','Lancer','Monk'].map(k=>[k,'ally'])];
for(const [bridge,a,b] of bridges)for(const [kind,team] of types)for(const reverse of [false,true]){
  const u=actor(rt,kind,team),result=travel(rt,u,reverse?b:a,reverse?a:b);
  report.traversals.push({bridge,kind,team,reverse,...result});
}

// Every entry lane, continuous jitter corners/interior, and the complete ordered path.
for(const p of definition.paths){
  const entry=world.waveSpawns.get(p.id);
  for(const kind of ['Pawn','Warrior','Archer','Lancer','Monk','Boss'])
    for(const lane of kind==='Boss'?[0]:entry.lanes)
      for(const jitter of kind==='Boss'?[{x:0,y:0}]:[{x:-3,y:-3},{x:-3,y:3},{x:3,y:-3},{x:3,y:3},{x:0,y:0}]){
        const u=actor(rt,kind,'enemy',p.id,lane,jitter);
        u.entering=true;u.entryWaypoint=1;
        const result=travel(rt,u,{x:u.x,y:u.y},p.points.at(-1),{entry:true});
        check(distance(u,{x:p.points.at(-1).x+lane*p.exitLaneOffset.x,y:p.points.at(-1).y+lane*p.exitLaneOffset.y})<p.exitRadius+2,'Entry reaches correct gate');
        report.traversals.push({path:p.id,kind,team:'enemy',lane,jitter,...result});
      }
}

// All guard points connect to each other and to the fortress approach.
for(const a of definition.guardPoints)for(const b of definition.guardPoints){
  if(a.id===b.id)continue;
  for(const [kind,team] of types){
    const u=actor(rt,kind,team),result=travel(rt,u,a.position,b.position);
    report.gateTimes.push({from:a.id,to:b.id,kind,team,...result});
  }
}
for(const b of definition.guardPoints){
  const u=actor(rt,'Warrior');
  travel(rt,u,b.position,world.squadGuard);
}

// High-speed dash / knockback-style movement cannot skip water at an unopened bridge.
world.applyChapterPreview('chapter-1');
for(const [x,y,dx,dy] of [[1568,736,0,-1],[864,1184,-1,0]]){
  const u=actor(rt,'Hero');Object.assign(u,{x,y});
  check(world.isWalkable(x,y),'Boundary start is valid');
  for(let i=0;i<30;i++){navigation.move(u,dx,dy,dt,720);check(world.isWalkable(u.x,u.y),'Fast movement stays on active floor');}
}
world.applyChapterPreview('chapter-3');
for(const [bridge,a,b] of bridges){
  // Opposing groups use real passing steering and pairwise separation.
  const trafficB=bridge==='north'?{x:1533,y:965}:b;
  const units=[];
  for(let i=0;i<8;i++){
    const reverse=i>=4,start=reverse?trafficB:a,offset=(i%4-1.5)*32;
    const u=actor(rt,['Warrior','Archer','Lancer','Monk'][i%4],i<4?'ally':'enemy');
    Object.assign(u,{x:start.x+(bridge==='north'?offset:0),y:start.y+(bridge==='north'?0:offset),entering:false});
    check(world.isWalkable(u.x,u.y),'Traffic start is valid');
    const target=reverse?a:trafficB;
    const goal={x:target.x+(bridge==='north'?offset:0),y:target.y+(bridge==='north'?0:offset)};
    const baseline=travel(rt,{...u},{x:u.x,y:u.y},goal);
    units.push({u,goal,isolatedSeconds:baseline.seconds,arrived:null,peakStall:0});
  }
  setActors(rt,units.map(t=>t.u));let seconds=0;const crowded=new Map();
  for(let frame=0;frame<60/dt&&units.some(t=>t.arrived===null);frame++){
    seconds+=dt;
    for(const t of units){
      if(t.arrived!==null)continue;
      if(distance(t.u,t.goal)<8){t.arrived=Number(seconds.toFixed(3));continue;}
      const before=distance(t.u,t.goal);
      navigation.steerMove(t.u,t.goal,dt);
      t.peakStall=Math.max(t.peakStall,t.u.stallSeconds||0);
      const neighbours=units.filter(other=>other!==t&&distance(other.u,t.u)<45).length;
      if(neighbours>=2&&before-distance(t.u,t.goal)<t.u.speed*dt*.35){
        const key=Math.floor(t.u.x/64)*64+','+Math.floor(t.u.y/64)*64;
        crowded.set(key,(crowded.get(key)||0)+dt);
      }
    }
    rt.ai.separateCombatUnits(dt);
    for(const t of units)assert(world.isWalkable(t.u.x,t.u.y),'Traffic unit left walkable floor');
  }
  check(units.every(t=>t.arrived!==null),'Opposing traffic timed out at '+bridge);
  report.traffic.push({bridge,units:units.map(t=>({kind:t.u.kind,team:t.u.team,arrival:t.arrived,
    isolatedSeconds:t.isolatedSeconds,delay:Number((t.arrived-t.isolatedSeconds).toFixed(3)),peakStall:t.peakStall})),
    crowdedSpots:[...crowded].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([cell,actorSeconds])=>({cell,actorSeconds:Number(actorSeconds.toFixed(3))}))});
}

// Malformed authoring and a severed bridge are rejected, never silently projected.
for(const [name,mutate] of [
  ['diagonal bridge',m=>m.regions.find(r=>r.kind==='bridge').centerline[1].x+=32],
  ['missing owner',m=>delete m.objectRegions['gold-01']],
  ['collider mismatch',m=>m.obstacles[0].x+=1],
  ['blocked lane interior',m=>{const t=m.trees[0];t.x=878;t.y=1049;const o=m.obstacles[0];o.x=t.x;o.y=t.y-4;}],
  ['broken bridge attachment',m=>{m.regions.find(r=>r.id==='bridge-north').centerline[1].y=640;}],
  ['invalid mask',m=>m.regions[0].maskRows[4]=[[4,8],[7,10]]],
  ['duplicate boss entry',m=>m.enemySpawns.push({...m.enemySpawns[1],id:'duplicate-boss'})],
  ['missing source object',m=>m.trees[0]=null],
  ['bad cumulative unlock',m=>m.previewChapters['chapter-2']=['island-main','island-north']],
  ['extra activation condition',m=>m.previewChapters.secret=['island-main','bridge-north']],
  ['locked ally spawn',m=>m.allySpawn={x:1664,y:384}],
  ['malformed path points',m=>m.paths[0].points={}],
  ['malformed collision profile',m=>m.collision='invalid']
]){
  const broken=clone(definition);mutate(broken);
  const result=context.PenjagaMapValidation.validateMap(broken);
  check(!result.valid,'Invalid definition accepted: '+name);
  report.validationFailures.push({name,codes:[...new Set(result.errors.map(e=>e.code))]});
}
navigation.dispose();
if(process.argv.includes('--report')){
  const target=process.argv[process.argv.indexOf('--report')+1];
  fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
}
const entries=definition.paths.map(p=>{const values=report.traversals.filter(t=>t.path===p.id).map(t=>t.seconds);return {
  path:p.id,minSeconds:Math.min(...values),maxSeconds:Math.max(...values)};});
const gates=report.gateTimes.filter(t=>t.kind==='Hero').map(t=>({from:t.from,to:t.to,seconds:t.seconds}));
console.log(JSON.stringify({checks:report.checks,traversals:report.traversals.length,entries,gates,
  guardTransfers:report.gateTimes.length,traffic:report.traffic,invalidDefinitionsRejected:report.validationFailures.length},null,2));
