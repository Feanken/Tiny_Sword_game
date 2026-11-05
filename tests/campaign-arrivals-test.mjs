import assert from 'node:assert/strict';
import {createCampaignFixture} from './fixtures/campaign-runtime.mjs';
const {r}=createCampaignFixture(),s=r.session;
let checks=0;const check=(v,m)=>{assert(v,m);checks++;},report=[];
r.lifecycle.startGame(123);
for(let chapter=0;chapter<3;chapter++){
  r.world.applyChapterPreview('chapter-'+(chapter+1));
  // For isolated traversal, open the matching world. Actual pressure is tested by the run suite.
  for(const wave of [0,2,4]){
    s.waveIndex=wave;s.phase='prepare';s.enemies=[];s.bossSpawned=false;s.boss=null;
    // Scheduler paths are based on actual campaign cursor; use all open paths for route samples.
    for(const pathId of r.world.wavePathIds){
      const path=r.world.entryPaths.get(pathId),spawn=r.world.waveSpawns.get(pathId);
      for(const kind of ['Warrior','Lancer','Archer','Pawn','Monk'])for(const lane of [-2,0,2]){
        s.encounters[wave].roster[0]=kind;s.encounters[wave].spawnLanes[0]=lane;s.spawned=0;s.enemies=[];
        r.director.spawnEnemy(pathId,0);const unit=s.enemies[0];
        const expected=r.director.estimateTravel(pathId,spawn,lane,unit.speed);
        let actual=0;
        for(let i=0;i<2400&&unit.entering;i++){
          const old={x:unit.x,y:unit.y};r.navigation.followEntry(unit,1/60);actual+=1/60;
          check(r.navigation.positionFits(unit.x,unit.y),'Unit stays on legal floor');
          check(r.navigation.clearPath(old,unit),'No water shortcut at corners');
        }
        check(!unit.entering,'Every unit and lane reaches defense gate');
        check(Math.abs(actual-expected)<1.1,'Arrival estimate deviation bounded: '+pathId+' '+actual+' / '+expected);
        report.push({chapter:chapter+1,wave:wave+1,path:pathId,kind,lane,
          expected:+expected.toFixed(3),actual:+actual.toFixed(3),error:+(actual-expected).toFixed(3)});
      }
    }
  }
}
const summary=Object.fromEntries(['path-west','path-north','path-southwest'].map(id=>{
  const values=report.filter(row=>row.path===id);
  return [id,{samples:values.length,minSeconds:Math.min(...values.map(v=>v.actual)),maxSeconds:Math.max(...values.map(v=>v.actual)),
    maxAbsoluteError:Math.max(...values.map(v=>Math.abs(v.error)))}];
}));
r.navigation.dispose();
console.log(JSON.stringify({result:'PASS',checks,traversals:report.length,summary},null,2));
