const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createGame}=require('./game-harness.cjs');
const code=fs.readFileSync('game.js','utf8');
function verify(results){
 assert.equal(results.length,14);assert.ok(results.every(r=>r.result==='won'),'all scripted matches finish');
 for(const r of results){
   const c=r.combat;assert.ok(c&&c.swings>0&&c.hits<=c.swings*3);
   assert.equal(Object.values(c.damageBySource).reduce((a,b)=>a+b,0),c.damageTaken,'damage-source accounting matches applied damage');
   assert.ok(c.misses+c.interruptions+c.cancels<=c.swings,'each swing has one final outcome');
   assert.ok(Object.values(c).filter(v=>typeof v==='number').every(v=>Number.isFinite(v)&&v>=0));
 }
 const normal=results.filter(r=>r.mode==='normal'),group=id=>normal.filter(r=>r.strategy===id),sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
 for(const r of normal)assert.deepEqual([...new Set(r.resolved)].sort(),['charge','slam','volley'],'all leader patterns execute before defeat');
 assert.ok(sum(group('upgrades'),'bossSeconds')<sum(group('basic'),'bossSeconds'),'upgrade investment improves boss clear time');
 assert.ok(sum(group('tactical'),'bossDamageToHero')<sum(group('upgrades'),'bossDamageToHero'),'dodging reduces incoming boss damage');
 assert.ok(group('counter').every(r=>r.bossDamageToHero===0&&r.perfectDodges>0),'counter policy avoids boss damage and triggers ripostes');
 console.log('14 completed matches; all Normal leader patterns, upgrade benefit and dodge/counter benefit: passed');
}
if(process.argv.includes('--verify')){verify(JSON.parse(fs.readFileSync('game-preview/balance-after.json','utf8')).results);process.exit(0);}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function simulate(strategy,mode,seed){
 const {g,snapshot}=createGame(seed,code);g.setDifficulty(mode);g.startGame();
 const build=['blade','wind','counter','blade','rhythm'];
 let bossArrived=null,bossEnded=null,dashes=0,upgrades=0;
 for(let frame=0;frame<36000&&g.state==='playing';frame++){
   g.keys.clear();
   if(strategy!=='basic'&&g.phase==='prepare'&&g.buyUpgrade(build[g.wave]))upgrades++;
   const target=g.enemies.filter(e=>e.hp>0).sort((a,b)=>distance(g.hero,a)-distance(g.hero,b))[0];
   if(target){
     const dx=target.x-g.hero.x,dy=target.y-g.hero.y,d=distance(g.hero,target);
     if(d<86)g.keys.add(' ');
     if(d>65){if(Math.abs(dx)>12)g.keys.add(dx>0?'d':'a');if(Math.abs(dy)>12)g.keys.add(dy>0?'s':'w');}
   }
   const b=g.boss;
   if(b&&b.hp>0&&!b.entering&&bossArrived===null)bossArrived=g.time;
   if(b&&b.hp<=0&&bossEnded===null)bossEnded=g.time;
   if(['tactical','counter'].includes(strategy)&&b?.bossAction?.stage==='warning'&&b.bossAction.time<.12&&g.hero.dashCooldown<=0){
     const a=b.bossAction;let dx,dy;
     if(strategy==='counter'){
       const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
       const end=a.chargeEnd||{x:a.origin.x+a.dx*252,y:a.origin.y+a.dy*252};
       const threatened=a.type==='slam'?distance(g.hero,a.target)<105:a.type==='charge'?Number.isFinite(g.segmentHit(a.origin,end,g.hero,36)):distance(g.hero,b)<500;
       if(!threatened){g.advance(1/60);continue;}
       const candidates=directions.map(([x,y])=>{const n=Math.hypot(x,y);return{x:g.hero.x+x/n*144,y:g.hero.y+y/n*144,dx:x,dy:y};})
         .filter(p=>g.positionFits(p.x,p.y)&&(a.type==='slam'?distance(p,a.target)>110:a.type==='charge'?!Number.isFinite(g.segmentHit(a.origin,end,p,42)):Math.abs((p.x-b.x)*a.dy-(p.y-b.y)*a.dx)>110))
         .sort((p,q)=>distance(p,b)-distance(q,b));
       if(candidates.length){dx=candidates[0].dx;dy=candidates[0].dy;}else{dx=-a.dy;dy=a.dx;}
     }else
     if(a.type==='slam'){dx=g.hero.x-a.target.x;dy=g.hero.y-a.target.y;if(Math.hypot(dx,dy)<5){dx=g.hero.x-b.x;dy=g.hero.y-b.y;}}
     else{dx=-a.dy;dy=a.dx;}
     g.keys.clear();if(Math.abs(dx)>.1)g.keys.add(dx>0?'d':'a');if(Math.abs(dy)>.1)g.keys.add(dy>0?'s':'w');if(g.startDash())dashes++;
   }
   if(g.hero.hp<g.hero.maxHp*.55&&g.food)g.healHero();
   if(g.castle.hp<g.castle.maxHp-160&&g.wood>=30)g.repairCastle();
   const reserve=strategy!=='basic'&&g.phase==='prepare'&&!snapshot().campPurchased?45:0;
   if(g.gold>=55+reserve&&g.allies.length<8)g.recruitUnit();
   g.advance(1/60);
 }
 return {strategy,mode,seed,result:g.state,seconds:+g.time.toFixed(1),heroHp:Math.ceil(g.hero.hp),castleHp:Math.ceil(g.castle.hp),bossSeconds:bossArrived===null?null:+((bossEnded??g.time)-bossArrived).toFixed(1),dashes,upgrades,...g.metrics,combat:snapshot().combat};
}
const cases=[];
for(const seed of [11,23,47])for(const strategy of ['basic','upgrades','tactical','counter'])cases.push([strategy,'normal',seed]);
for(const mode of ['easy','hard'])cases.push(['counter',mode,23]);
const results=[];
for(const args of cases){const result=simulate(...args);results.push(result);console.log(JSON.stringify(result));}
fs.writeFileSync('game-preview/balance-after.json',JSON.stringify({sourceSha256:require('node:crypto').createHash('sha256').update(code).digest('hex'),description:'Seeded scripted policies; no health, currency, cooldown or enemy manipulation. Strategy comparison is not a human difficulty rating.',results},null,2));
verify(results);
