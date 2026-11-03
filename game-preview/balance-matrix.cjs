const fs=require('node:fs'),assert=require('node:assert/strict');
const {simulate}=require('./balance-test.cjs');
const profiles=[
 {name:'pedang-4-sekutu',build:['blade','rhythm','blade','rhythm','oath'],maxAllies:4,mode:'normal'},
 {name:'elak-4-sekutu',build:['wind','counter','counter','wind','blade'],maxAllies:4,mode:'normal'},
 {name:'pertahanan-4-sekutu',build:['bastion','oath','bastion','oath','rhythm'],maxAllies:4,mode:'normal'},
 {name:'pasukan-kecil-santai',build:['wind','counter','oath','blade','rhythm'],maxAllies:2,mode:'easy'},
 {name:'pasukan-4-sulit',build:['wind','counter','oath','blade','rhythm'],maxAllies:4,mode:'hard'},
];
const results=[];
for(const profile of profiles)for(const seed of [11,23,47]){
 const r=simulate('counter',profile.mode,seed,{...profile,regularDodges:true});results.push(r);
 console.log(JSON.stringify({profile:r.profile,seed:r.seed,result:r.result,seconds:r.seconds,heroHp:r.heroHp,castleHp:r.castleHp,bossSeconds:r.bossSeconds,allyEvades:r.combat.allyEvades,allyHazardHits:r.combat.allyHazardHits}));
}
const summary=profiles.map(p=>({profile:p.name,wins:results.filter(r=>r.profile===p.name&&r.result==='won').length,matches:3}));
fs.writeFileSync('game-preview/balance-matrix.json',JSON.stringify({sourceSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync('game.js')).digest('hex'),description:'Input-only scripted play across different builds and party sizes, dodging both ordinary melee windups and boss warnings. Human difficulty remains a playtest judgement.',summary,results},null,2));
for(const p of summary)assert.ok(p.wins>=(p.profile==='pasukan-4-sulit'?1:2),'viable build: '+p.profile);
assert.ok(results.every(r=>['won','lost'].includes(r.result)),'matches cannot remain stuck indefinitely');
console.log('Build and party-size viability:',JSON.stringify(summary));
