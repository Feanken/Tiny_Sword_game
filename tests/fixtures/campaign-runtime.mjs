import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
export function createCampaignFixture({economyProfileId='standard',mines={}}={}){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),scope={};
  const noop=()=>{},nodes=new Map(),element=()=>({hidden:false,open:false,textContent:'',style:{},
    classList:{add:noop,remove:noop,toggle:noop},focus:noop,setAttribute:noop,querySelector:()=>null});
  scope.window=scope;scope.document={querySelector:()=>null,body:element(),elementFromPoint:()=>null};
  scope.localStorage={getItem:()=>null,setItem:noop};scope.matchMedia=()=>({matches:false});scope.setTimeout=noop;
  vm.createContext(scope);
  for(const file of ['maps/island.js','maps/floor-geometry.js','maps/campaign-islands.js','maps/validate-map.js',
    'src/config.js','src/base-stats.js','src/upgrade-progress.js','src/skill-config.js','src/upgrade-skills.js',
    'src/campaign-data.js','src/campaign.js','src/world/world.js','src/session.js','src/math.js',
    'src/input.js','src/navigation.js','src/upgrading.js','src/ai.js','src/director.js','src/economy.js',
    'src/boss.js','src/triple-slash.js','src/combat.js','src/simulation.js','src/lifecycle.js'])
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
  const M=scope.PenjagaModules,r={world:new M.World(scope.PenjagaMaps['campaign-islands']),config:M.config,
    options:{economyProfileId},campaign:{},mines,math:{},input:new M.InputController(),navigation:{},
    upgrading:{},combat:{},ai:{},director:{},economy:{},bossSystem:{},simulation:{},lifecycle:{},
    host:{canvas:{focus:noop},$:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);}},
    ui:{best:0,scoreKey:()=>'',setDifficulty:noop,setEntryWarning:text=>{r.warning=text;},showChapterReview:noop,
      notify:noop,renderCamp:noop,updateUI:noop,updateInteraction:noop,announce:noop},
    renderer:{screenToWorld:(x,y)=>({x,y}),resize:noop,float:noop,floatDamage:noop,addEffect:noop,updatePresentation:noop},
    audio:{soundVoices:new Set(),lastCombatCue:new Map(),tone:noop,combatCue:noop,playSample:noop,updateMusic:noop}};
  r.session=new M.GameSession({world:r.world});r.session.initialized=true;
  for(const name of ['Campaign','Math','Input','Navigation','Upgrading','Ai','Director','Economy','BossSystem','Combat','Simulation','Lifecycle'])
    M['install'+name](r);
  return {r,M,scope};
}
