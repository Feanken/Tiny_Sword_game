const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {simulate}=require('./balance-test.cjs');
const sources={before:fs.readFileSync('game-preview/balance-source-before.txt','utf8'),after:fs.readFileSync('game.js','utf8')};
const seeds=[11,23,47,71,101];
const defense=['bastion','oath','bastion','oath','rhythm'];
const profiles=[
 {name:'pedang-normal',mode:'normal',maxAllies:4,build:['blade','rhythm','blade','rhythm','oath'],seeds},
 {name:'elak-normal',mode:'normal',maxAllies:4,build:['wind','counter','counter','wind','blade'],seeds},
 {name:'pertahanan-mengejar-normal',mode:'normal',maxAllies:4,build:defense,seeds},
 {name:'pertahanan-kastel-normal',mode:'normal',maxAllies:4,build:defense,defensive:true,seeds},
 {name:'elak-sulit',mode:'hard',maxAllies:4,build:['wind','counter','oath','blade','rhythm'],seeds},
 {name:'pasukan-kecil-santai',mode:'easy',maxAllies:2,build:['wind','counter','oath','blade','rhythm'],seeds:[11,23,47]},
];
const results=[];
for(const version of ['before','after'])for(const profile of profiles)for(const seed of profile.seeds){
 const result=simulate('counter',profile.mode,seed,{...profile,regularDodges:true,code:sources[version]});results.push({version,...result});
 console.log(JSON.stringify({version,profile:profile.name,seed,result:result.result,seconds:result.seconds,fortressSaved:result.combat.fortressSaved,oathHealing:result.combat.oathHealing||0,wave:result.waveLog.at(-1)?.wave}));
}
const summary=[];
for(const version of ['before','after'])for(const profile of profiles){const rows=results.filter(r=>r.version===version&&r.profile===profile.name);summary.push({version,profile:profile.name,wins:rows.filter(r=>r.result==='won').length,matches:rows.length,meanSeconds:+(rows.reduce((n,r)=>n+r.seconds,0)/rows.length).toFixed(1),fortressSaved:rows.reduce((n,r)=>n+r.combat.fortressSaved,0),oathHealing:rows.reduce((n,r)=>n+(r.combat.oathHealing||0),0)});}
fs.writeFileSync('game-preview/director-audit.json',JSON.stringify({sources:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,crypto.createHash('sha256').update(s).digest('hex')])),description:'Same scripted policies on prior and revised source. Normal health/currency, five seeds for most profiles, including an explicit castle-defense policy and its chase control. Not a human win-rate estimate.',summary,results},null,2));
assert.ok(results.every(r=>['won','lost'].includes(r.result)),'every match must finish');
const guarded=summary.find(r=>r.version==='after'&&r.profile==='pertahanan-kastel-normal');assert.ok(guarded.fortressSaved>0,'castle-defense policy must actually use Bastion');
assert.ok(summary.filter(r=>r.version==='after'&&r.profile.endsWith('-normal')&&!r.profile.includes('mengejar')).every(r=>r.wins>=3),'Normal builds remain viable across the sampled seeds');
assert.ok(summary.find(r=>r.version==='after'&&r.profile==='pasukan-kecil-santai').wins>=2);
console.log('Before/after comparison:',JSON.stringify(summary));
