/* Penjaga Pulau — plain Canvas 2D, no dependencies or network services. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 704, TILE = 64;
  const images = new Map();
  const flashFrames = new Map();
  const manifest = new Map(window.TINY_ASSETS.map(a => [a.path, a]));
  const keys = new Set();
  const keyboardKeys = new Set(), pointerBindings = new Map();
  function syncInputKey(key){
    if(keyboardKeys.has(key)||[...pointerBindings.values()].includes(key))keys.add(key);else keys.delete(key);
  }
  function keyboardInput(key,down){
    if(down)keyboardKeys.add(key);else keyboardKeys.delete(key);syncInputKey(key);
  }
  function pointerInput(id,key,down){
    const previous=pointerBindings.get(id);pointerBindings.delete(id);
    if(down)pointerBindings.set(id,key);
    if(previous)syncInputKey(previous);if(key)syncInputKey(key);
  }
  function clearCombatInput(){
    keys.clear();keyboardKeys.clear();pointerBindings.clear();hero.attackBuffer=0;hero.dashBuffer=0;lastTime=0;
  }
  let gameRandom=Math.random;
  const rand = (a, b) => a + gameRandom() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unitPath = (color, kind, action) => {
    const names = { Warrior: `Warrior_${action}`, Archer: `Archer_${action}`, Lancer: `Lancer_${action}`, Monk: action, Pawn: `Pawn_${action}` };
    return `Units/${color} Units/${kind}/${names[kind]}.png`;
  };
  const terrain = p => `Terrain/${p}.png`;
  const blue = (kind, action) => unitPath('Blue', kind, action);
  const castle = { x: 845, y: 310, hp: 500, maxHp: 500 };
  const hero = { x: 788, y: 370, hp: 100, maxHp: 100, facing: 1, attack: 0, cooldown: 0, invuln: 0, moving: false, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0 };
  const waves = [
    { name: 'Tamu tak diundang', color: 'Red', count: 7, interval: 1.7, types: ['Warrior', 'Warrior', 'Pawn'] },
    { name: 'Hujan panah', color: 'Purple', count: 10, interval: 1.65, types: ['Warrior', 'Archer', 'Lancer'] },
    { name: 'Pasukan matahari', color: 'Yellow', count: 13, interval: 1.5, types: ['Lancer', 'Warrior', 'Archer', 'Monk'] },
    { name: 'Bayangan di dermaga', color: 'Black', count: 16, interval: 1.35, types: ['Warrior', 'Lancer', 'Archer', 'Monk'] },
    { name: 'Pertahanan terakhir', color: 'Black', count: 20, interval: 1.1, types: ['Warrior', 'Lancer', 'Archer', 'Monk', 'Pawn'] },
  ];
  let runSeed=0,encounters=[];
  const waveStyles=[
    {name:'Barisan pelindung',hint:'Penombak menahan depan. Cari celah menuju pemanah.',bias:'Lancer'},
    {name:'Sayap pemanah',hint:'Pemanah mengambil sayap. Gunakan penghalang untuk mendekat.',bias:'Archer'},
    {name:'Serbuan bergerak',hint:'Ksatria menekan cepat. Sisakan ruang untuk menghindar.',bias:'Warrior'},
  ];
  function seededRandom(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  function makeEncounters(seed){
    const random=seededRandom(seed);
    const deck=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    return waves.map((w,index)=>{
      const styleIndex=index<4?deck[Math.max(0,index-1)]:(deck[2]+1+Math.floor(random()*2))%3;
      const style=waveStyles[styleIndex],roster=[];
      for(let i=0;i<w.count;i++)roster.push(w.types[i%w.types.length]);
      if(index>0){
        // Shuffle equal-size authored rosters, then exchange one fighter only.
        for(let i=roster.length-1;i>1;i--){const j=1+Math.floor(random()*i);[roster[i],roster[j]]=[roster[j],roster[i]];}
        const swap=roster.findIndex((kind,i)=>i>1&&kind==='Warrior');
        if(swap>=0)roster[swap]=style.bias;
        roster[0]='Warrior';
      }
      const lanes=[-1,0,1,-2,2];if(index>0)for(let i=4;i>0;i--){const j=Math.floor(random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
      const pool=roster.slice(),ordered=[],groups=[],spawnLanes=[];
      const take=preferred=>{let slot=-1;for(const kind of preferred){slot=pool.indexOf(kind);if(slot>=0)break;}return pool.splice(Math.max(0,slot),1)[0];};
      while(pool.length){
        const start=ordered.length,count=Math.min(3,pool.length),front=styleIndex===0?['Lancer','Warrior','Pawn']:['Warrior','Pawn','Lancer'];
        for(let j=0;j<count;j++){
          let kind;
          if(index===0)kind=pool.shift();
          else if(j===0)kind=take(start===0?['Warrior']:front);
          else if(j===count-1){
            const monks=pool.filter(k=>k==='Monk').length,needMonk=monks>=Math.ceil(pool.length/3)||random()<.6;
            kind=take(ordered.slice(start).includes('Monk')?['Archer','Warrior','Lancer','Pawn']:needMonk?['Monk','Archer','Warrior','Lancer','Pawn']:['Archer','Monk','Warrior','Lancer','Pawn']);
          }else kind=take(styleIndex===1&&random()<.65?['Archer','Warrior','Lancer','Pawn']:random()<.5?['Lancer','Warrior','Pawn','Archer']:['Warrior','Pawn','Lancer','Archer']);
          ordered.push(kind);
          const packet=groups.length,side=(packet%2?1:-1)*(random()<.5?-1:1);
          spawnLanes.push(index===0?lanes[(start+j)%5]:styleIndex===0?[-1,0,1][(j+packet)%3]:styleIndex===1?(j===0?0:side*(j===1?2:1)):lanes[(packet+j*2)%5]);
        }
        const threat=ordered.slice(start).reduce((n,k)=>n+({Pawn:.7,Warrior:1,Archer:1.2,Lancer:1.3,Monk:1.4}[k]),0);
        groups.push({start,count,threat,delay:0});
      }
      const average=groups.reduce((n,g)=>n+g.threat,0)/groups.length;
      for(const g of groups)g.delay=w.interval*1.9*(index===0?1:clamp(g.threat/average,.85,1.15));
      return {name:index===0?w.name:style.name,hint:index===0?'Jaga jarak, baca ayunan musuh, lalu balas.':style.hint,roster:ordered,lanes,spawnLanes,groups,interval:w.interval};
    });
  }
  let state = 'loading', phase = 'prepare', waveIndex = 0, waveTimer = 22, spawned = 0, spawnTimer = 0;
  let gold = 80, wood = 40, food = 3, score = 0, kills = 0, recruitIndex = 0;
  let elapsed = 0, animTime = 0, gatherCooldown = 0, passiveTimer = 0, uiTimer = 0, announcementTimer = 0, toastTimer = 0, shake = 0;
  let enemies = [], allies = [], effects = [], floaters = [], drops = [], projectiles = [], impacts = [];
  const SWING = Object.freeze({ start:.16, end:.28, angle:1.3, reach:76, radius:18, cap:3 });
  const HERO_ATTACK = Object.freeze({ duration:.42, cooldown:.58, moveScale:.55 });
  const approachOffsets = Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}));
  const approachSlots = new Map(), combatUnits = [];
  const engagements=new Map();
  let combatId=0, pressureActive=0, pressureGap=0,rangedPressureGap=0,collectingHeroDamage=false, pendingHeroDamage=null;
  const combatStats={};
  function resetCombatStats(){
    Object.assign(combatStats,{swings:0,hits:0,misses:0,interruptions:0,cancels:0,bufferedInputs:0,healingDone:0,healingWasted:0,stalls:0,blockedSeconds:0,mergedHits:0,pressureDeferrals:0,maxWindups:0,damageTaken:0,allyEvades:0,allyHazardHits:0,roleIntercepts:0,repositions:0,fortressSaved:0});
    Object.assign(combatStats,{rangedDeferrals:0,maxRangedWindups:0,oathHealing:0});
    combatStats.damageBySource={Warrior:0,Lancer:0,Archer:0,Pawn:0,boss:0,unknown:0};
  }
  resetCombatStats();
  const FIXED_STEP = 1 / 60;
  let simulationAccumulator = 0;
  let damageDealt = 0, damageTaken = 0;
  let dashTrail = [], campPurchase = -1;
  const difficulties = {
    easy:{name:'Santai',hp:.75,damage:.7,speed:.9,interval:1.15,bossHp:480,warning:1.1,score:.8,note:'Musuh lebih ringan. Ruang untuk belajar dash dan meracik upgrade.'},
    normal:{name:'Normal',hp:1,damage:1,speed:1,interval:1,bossHp:650,warning:.9,score:1,note:'Pertahanan seimbang. Keputusan pasukan dan timing menentukan.'},
    hard:{name:'Sulit',hp:1.2,damage:1.25,speed:1.08,interval:.82,bossHp:850,warning:.75,score:1.4,note:'Musuh lebih tangguh, cepat, dan rapat. Maksimalkan elak sempurna.'},
  };
  let difficulty='normal', squadOrder='follow', bossSpawned=false, boss=null, orderPulse=0;
  const settings=()=>difficulties[difficulty];
  function setDifficulty(id){
    if(!difficulties[id]||!['loading','ready'].includes(state))return false;
    difficulty=id;
    try{best=Number(localStorage.getItem('penjaga-pulau-best-'+id))||(id==='normal'?Number(localStorage.getItem('penjaga-pulau-best')):0)||0;}catch{best=0;}
    $('bestScore').textContent=String(best).padStart(4,'0');$('difficultyNote').textContent=settings().note;
    document.querySelectorAll('[data-difficulty]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.difficulty===id)));
    return true;
  }
  function setSquadOrder(order){
    if(state!=='playing'||!['follow','guard'].includes(order))return false;
    squadOrder=order;orderPulse=1.2;
    for(const u of allies){releaseApproach(u);u.combatTarget=null;u.protectTarget=null;u.roleThink=0;u.evadeAction=null;u.evadeGoal=null;u.retreatGoal=null;u.repositionGoal=null;u.targetThink=0;u.arrowEvade=0;u.arrowGoal=null;u.arrowThink=0;u.supportThink=0;u.supportGoal=null;u.healTarget=null;u.healThink=0;u.strike=null;u.attack=0;u.route=[];u.routeTimer=0;u.stallSeconds=0;u.blockedSeconds=0;}
    notify(order==='follow'?'Sekutu mengikuti penjaga dan melindungi sekitarmu.':'Sekutu kembali menjaga halaman kastel.');updateUI();return true;
  }
  function squadAnchor(){return squadOrder==='guard'?{x:845,y:355}:hero;}
  function squadHome(u){
    const slot=Number.isInteger(u.formationSlot)?u.formationSlot:0,angle=slot*2.399963,anchor=squadAnchor();
    for(const radius of [squadOrder==='guard'?95:65,40])for(let i=0;i<8;i++){
      const a=angle+i*Math.PI/4,p={x:anchor.x+Math.cos(a)*radius,y:anchor.y+Math.sin(a)*50+20};
      if(positionFits(p.x,p.y))return p;
    }
    return positionFits(anchor.x,anchor.y)?{x:anchor.x,y:anchor.y}:{x:u.x,y:u.y};
  }
  function traceCharge(origin,dx,dy,length){
    let traveled=0;
    while(traveled<length){
      const next=Math.min(length,traveled+2),x=origin.x+dx*next,y=origin.y+dy*next;
      if(!positionFits(x,y))break;
      traveled=next;
    }
    return {x:origin.x+dx*traveled,y:origin.y+dy*traveled,distance:traveled};
  }
  function spawnBoss(){
    if(waveIndex!==4||bossSpawned)return false;
    bossSpawned=true;const hp=settings().bossHp;
    boss={combatId:++combatId,x:roadEntry.x,y:405,kind:'Warrior',color:'Black',hp,maxHp:hp,facing:1,moving:false,attack:0,cooldown:1,seed:0,speed:62*settings().speed,team:'enemy',entering:true,lane:0,flankSign:1,isBoss:true,hitFlash:0,stagger:0,knockX:0,knockY:0,bossAction:null,abilityCooldown:.5,pattern:0,patternMask:0,lastPattern:-1,enraged:false};
    enemies.push(boss);spawnTimer=Math.max(spawnTimer,difficulty==='easy'?2.2:difficulty==='hard'?1.4:1.8);
    announce('Panglima Kelam','BACA TANDANYA · HINDARI · BALAS');return true;
  }
  function chooseBossPattern(u,target){
    if(u.patternMask===7)u.patternMask=0;
    const d=dist(u,target),charge=traceCharge(u,(target.x-u.x)/Math.max(1,d),(target.y-u.y)/Math.max(1,d),252);
    let clustered=0;for(const f of [hero,...allies])if(f.hp>0&&dist(f,target)<105)clustered++;
    const scores=[(d<115?7:2)+Math.min(3,clustered),charge.distance>Math.min(d,130)?(d>115?7:2):-2,d>150&&shotClear(u,target)?8:3];
    let selected=-1,score=-Infinity;
    for(let i=0;i<3;i++)if(!(u.patternMask&(1<<i))){const value=scores[i]-(u.lastPattern===i?20:0);if(value>score){selected=i;score=value;}}
    u.patternMask|=1<<selected;u.lastPattern=selected;u.pattern++;
    return ['slam','charge','volley'][selected];
  }
  const bossRecoveryTimes={easy:{slam:1.3,charge:1.3,volley:1.15},normal:{slam:1.1,charge:1.15,volley:1},hard:{slam:1,charge:1.05,volley:.9}};
  function recoverBoss(u,action){
    action.stage='recovery';action.time=action.recoveryDuration=Math.max(.85,bossRecoveryTimes[difficulty][action.type]-(u.enraged?.1:0));
  }
  function bossIntentText(u){
    const a=u.bossAction,time=a?Math.max(0,a.time).toFixed(1):'0';
    if(a?.stage==='rally')return `FASE II · MENGAMUK · ${time} dtk`;
    if(a?.stage==='recovery')return `TERBUKA · PEDANG +30% · ${time} dtk`;
    if(a?.stage==='warning')return ({slam:'HANTAMAN · KELUAR DARI LINGKARAN',charge:'TERJANGAN · HINDARI JALURNYA',volley:'HUJAN PANAH · CARI PERLINDUNGAN'}[a.type])+` · ${time} dtk`;
    return u.enraged?'FASE II · BERSIAP MENGHINDAR':'FASE I · GARDA AKTIF';
  }
  function beginBossRage(u){
    u.enraged=true;u.ragePending=false;u.moving=false;
    const duration=difficulty==='easy'?.9:difficulty==='normal'?.75:.6;
    u.bossAction={type:'rally',stage:'rally',time:duration,duration};
    notify('Panglima mengamuk! Bersiap untuk tempo yang lebih cepat.');combatCue('charge',u);
  }
  function updateBoss(u,dt){
    if(!u.enraged&&u.hp<=u.maxHp*.5)u.ragePending=true;
    u.abilityCooldown-=dt;
    const action=u.bossAction;
    if(action){
      action.time-=dt;u.moving=false;
      if(action.stage==='rally'){
        if(action.time<=0){u.bossAction=null;u.abilityCooldown=.35;}
      }else if(action.stage==='warning'&&action.time<=0){
        if(action.type==='slam'){
          for(const target of [hero,...allies,castle])if(target.hp>0&&dist(target,action.target)<105)hurt(target,Math.round(24*settings().damage),u);
          addEffect('Particle FX/Explosion_02.png',action.target.x,action.target.y,160,.5,20);shake=3;
          recoverBoss(u,action);
        }else if(action.type==='volley'){
          const angle=Math.atan2(action.target.y-u.y,action.target.x-u.x);
          for(const offset of [-.22,0,.22]){fireArrow(u,{x:u.x+Math.cos(angle+offset)*300,y:u.y+Math.sin(angle+offset)*300});projectiles[projectiles.length-1].damage=Math.round(22*settings().damage);}
          recoverBoss(u,action);
        }else {action.stage='charge';action.time=.45;}
      }else if(action.stage==='charge'){
        const previous={x:u.x,y:u.y},remaining=action.chargeEnd.distance-action.traveled;
        const step=Math.min(action.chargeSpeed*dt,Math.max(0,remaining));
        if(step>0){
          const next=action.traveled+step,x=action.origin.x+action.dx*next,y=action.origin.y+action.dy*next;
          if(positionFits(x,y)){u.x=x;u.y=y;action.traveled=next;u.moving=true;}else action.time=0;
        }
        if(dist(previous,u)>.001)for(const target of [hero,...allies,castle])if(target.hp>0&&!action.hit.has(target)&&Number.isFinite(segmentHit(previous,u,target,target===castle?62:36))&&(target===castle||clearPath(u,target))){hurt(target,Math.round(27*settings().damage),u);action.hit.add(target);}
        if(action.time<=0||action.traveled>=action.chargeEnd.distance-.001)recoverBoss(u,action);
      }else if(action.stage==='recovery'&&action.time<=0){u.bossAction=null;u.abilityCooldown=u.enraged?.4:.65;}
      return;
    }
    if(u.ragePending){beginBossRage(u);return;}
    const target=dist(u,hero)>430&&dist(u,castle)<160?castle:hero;
    if(dist(u,target)>220){steerMove(u,target,dt);return;}
    if(u.abilityCooldown>0){if(dist(u,target)>100)steerMove(u,target,dt,u.speed*.65);else u.moving=false;return;}
    const type=chooseBossPattern(u,target),length=Math.max(1,dist(u,target));
    u.facing=target.x<u.x?-1:1;u.moving=false;
    u.bossAction={type,stage:'warning',time:settings().warning,duration:settings().warning,target:{x:target.x,y:target.y},origin:{x:u.x,y:u.y},dx:(target.x-u.x)/length,dy:(target.y-u.y)/length,hit:new Set()};
    combatCue(type,u);
    if(type==='charge'){const a=u.bossAction;a.chargeSpeed=u.enraged?650:560;a.chargeEnd=traceCharge(a.origin,a.dx,a.dy,a.chargeSpeed*.45);a.traveled=0;}
  }
  function showTitle(){
    collectingHeroDamage=false;pendingHeroDamage=null;approachSlots.clear();engagements.clear();combatUnits.length=0;
    state='ready';clearCombatInput();simulationAccumulator=0;
    enemies=[];allies=[];effects=[];impacts=[];projectiles=[];dashTrail=[];boss=null;bossSpawned=false;
    Object.assign(hero,{x:788,y:370,hp:100,maxHp:100,attack:0,dash:0,dashCooldown:0,riposte:0,work:null,facing:1,invuln:0,hitFlash:0,stagger:0,cooldown:0,moving:false,knockX:0,knockY:0});castle.hp=castle.maxHp=500;castle.hitFlash=0;orderPulse=0;gold=80;wood=40;food=3;score=0;waveIndex=0;phase='prepare';waveTimer=22;for(const id in ranks)ranks[id]=0;
    toastTimer=0;announcementTimer=0;$('toast').classList.remove('show');$('announcement').classList.remove('show');$('worldCaption').hidden=false;
    $('startScreen').hidden=false;$('endScreen').hidden=true;$('pauseScreen').hidden=true;$('battleStatus').hidden=true;$('squadBar').hidden=true;$('bossBar').hidden=true;$('dashButton').hidden=true;$('mobileControls').hidden=true;
    document.body.classList.remove('is-playing');$('arena').classList.remove('boss-active');setDifficulty(difficulty);updateUI();resize();
  }
  const MAX_UPGRADE_LEVEL=5;
  const ranks = { blade:0, rhythm:0, wind:0, counter:0, bastion:0, oath:0 };
  const upgrades = [
    {id:'blade',name:'Bilah Bara',group:'PEDANG',icon:'⚔',cost:45,description:'Damage sasaran utama +5, sasaran tambahan +3 per tingkat.'},
    {id:'rhythm',name:'Ritme Tempur',group:'PEDANG',icon:'✦',cost:40,description:'Jeda antarserangan berkurang 6% per tingkat.'},
    {id:'wind',name:'Jejak Angin',group:'KELINCAHAN',icon:'➶',cost:35,description:'Cooldown dash berkurang 0,25 detik per tingkat.'},
    {id:'counter',name:'Balasan Embun',group:'KELINCAHAN',icon:'◇',cost:35,description:'Bonus balasan elak sempurna +6 damage dan durasi +0,5 detik per tingkat.'},
    {id:'bastion',name:'Benteng Hidup',group:'PERTAHANAN',icon:'♜',cost:40,description:'Kastel +80 HP, pulih 80; damage dekat kastel −2 dan jangkauan perlindungan +20 per tingkat.'},
    {id:'oath',name:'Sumpah Penjaga',group:'PERTAHANAN',icon:'♡',cost:40,description:'Nyawa +15, pulih 15; pemulihan bekal +5 dan biarawan untukmu +2 per tingkat.'},
  ];
  function dashCooldown() { return 2.4 - ranks.wind * .25; }
  function fortressRadius(){return 160+ranks.bastion*20;}
  function startDash() {
    if(state!=='playing'||hero.hp<=0||hero.dash>0||hero.dashCooldown>0)return false;
    let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    let dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    if(!dx&&!dy){dx=hero.lastMoveX??hero.facing;dy=hero.lastMoveY??0;}
    const length=Math.hypot(dx,dy);hero.dashX=dx/length;hero.dashY=dy/length;
    hero.dash=.2;hero.dashCooldown=dashCooldown();hero.dashElapsed=0;hero.dashPerfect=false;
    cancelHeroSwing(false);hero.impactHold=0;hero.attackBuffer=0;hero.dashBuffer=0;hero.work=null;hero.attack=0;hero.stagger=0;hero.knockX=0;hero.knockY=0;
    if(Math.abs(dx)>.1)hero.facing=dx>0?1:-1;
    addEffect('Particle FX/Dust_01.png',hero.x,hero.y,55);if(!playSample(['cloth1.ogg','cloth2.ogg'],hero,.4,1.3,2))tone(360,.14,'triangle',.025,720);return true;
  }
  function requestDash(){
    if(state!=='playing'||hero.dash>0)return false;
    hero.dashBuffer=hero.dashCooldown<=.12?.12:0;
    return startDash();
  }
  function renderCamp() {
    $('campGold').textContent=gold;
    $('campRound').textContent=`JEDA ${waveIndex+1} / 5`;
    $('campRule').textContent='Beli berkali-kali selama emas cukup. Setiap jalur maksimal 5 tingkat; sisakan emas untuk pasukan.';
    $('campCards').replaceChildren();
    for(const perk of upgrades){
      const level=ranks[perk.id],cost=perk.cost+level*20,button=document.createElement('button');
      button.className='perk-card';button.dataset.perk=perk.id;
      button.disabled=level>=MAX_UPGRADE_LEVEL||gold<cost||phase!=='prepare';
      button.innerHTML=`<span class="perk-category">${perk.group}<span>${'◆'.repeat(level)}${'◇'.repeat(MAX_UPGRADE_LEVEL-level)}</span></span><span class="perk-icon" aria-hidden="true">${perk.icon}</span><strong>${perk.name}</strong><span class="perk-description">${perk.description}</span><span class="perk-price">${level>=MAX_UPGRADE_LEVEL?'TINGKAT 5 / 5':`${cost} emas <span>Tingkat ${level+1} →</span>`}</span>`;
      button.addEventListener('click',()=>buyUpgrade(perk.id));$('campCards').append(button);
    }
    $('campBuild').textContent=upgrades.filter(p=>ranks[p.id]).map(p=>`${p.name} ${ranks[p.id]}`).join(' · ')||'Belum ada penempaan. Setiap pilihan membentuk cara bertarungmu.';
  }
  function buyUpgrade(id) {
    const perk=upgrades.find(p=>p.id===id);
    if(!perk||phase!=='prepare'||ranks[id]>=MAX_UPGRADE_LEVEL||!(state==='playing'||(state==='paused'&&$('campDialog').open)))return false;
    const cost=perk.cost+ranks[id]*20;if(gold<cost)return false;
    gold-=cost;ranks[id]++;campPurchase=waveIndex;
    if(id==='bastion'){castle.maxHp+=80;castle.hp=Math.min(castle.maxHp,castle.hp+80);}
    if(id==='oath'){hero.maxHp+=15;hero.hp=Math.min(hero.maxHp,hero.hp+15);}
    if(id==='wind')hero.dashCooldown=Math.min(hero.dashCooldown,dashCooldown());
    $('campFeedback').textContent=`${perk.name} tingkat ${ranks[id]} ditempa. Berlaku hingga pertandingan selesai.`;
    tone(523,.2,'triangle');renderCamp();updateUI();
    if($('campDialog').open){const card=$('campCards').querySelector('[data-perk="'+id+'"]');(card&&!card.disabled?card:$('campCards').querySelector('button:not(:disabled)')||$('campReady')).focus({preventScroll:true});}
    return true;
  }
  function openCamp(){
    if(state!=='playing'&&state!=='paused')return;
    if(phase!=='prepare'){notify('Perkemahan dibuka saat jeda gelombang.');return;}
    $('campFeedback').textContent='';renderCamp();openDialog('campDialog');$('campCards').querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  }
  let best = 0, terrainCanvas, lastTime = 0, pausedForDialog = false, initialized = false;
  let scale = 1, cssScale = 1, cameraX = 0, cameraY = 0, viewW = W, viewH = H, overlayDirty=true;
  const spriteMetadata=new Map(),heroOutlines=new Map();
  const unitFrames=new Map(),UNIT_FRAME_BUDGET=12*1024*1024;
  let unitFrameBytes=0;
  const heroSprite={path:null,size:136,age:0,fps:9,facing:1,once:false};
  let waterPattern=null;
  const labelPool=Array.from({length:80},()=>({x:0,y:0,w:0,h:0,owner:null})),overlayRects=[],threatOrder=[],floaterOrder=[];
  let labelCount=0;
  const badgeOffsets=[[0,0],[-58,15],[58,15],[0,115],[-75,45],[75,45]];
  const threatOffsets=[[0,0],[-22,-10],[22,-10],[-36,-29],[36,-29],[0,-44],[-55,-4],[55,-4]];
  const numberOffsets=[[0,0],[-30,-16],[30,-16],[-55,-32],[55,-32],[0,-50],[-80,-10],[80,-10]];
  function reserveLabel(x,y,w,h,owner){
    if(labelCount>=labelPool.length)return null;
    const r=labelPool[labelCount++];Object.assign(r,{x,y,w,h,owner});return r;
  }
  function refreshOverlayRects(){
    overlayDirty=false;overlayRects.length=0;
    const arena=canvas.getBoundingClientRect();
    const add=el=>{if(el.hidden)return;const r=el.getBoundingClientRect();if(r.width&&r.height)overlayRects.push({x:r.left-arena.left,y:r.top-arena.top,w:r.width,h:r.height});};
    add($('bossBar'));add($('dashButton'));
    for(const id of ['toast','announcement'])if($(id).classList.contains('show'))add($(id));
    if(!$('mobileControls').hidden)for(const el of $('mobileControls').querySelectorAll('button'))add(el);
  }
  function beginLabelLayout(){
    if(overlayDirty)refreshOverlayRects();labelCount=0;
    for(const r of overlayRects)reserveLabel(cameraX+(r.x+r.w/2)/cssScale,cameraY+(r.y+r.h/2)/cssScale,r.w/cssScale,r.h/cssScale,'hud');
  }
  function placeLabel(owner,x,y,w,h,offsets,required=false){
    const gap=3/cssScale,pad=4/cssScale;
    let best=-1,bestCost=Infinity,bestX=x,bestY=y;
    for(let i=-1;i<offsets.length;i++){
      const preferred=owner===hero?0:owner.labelSlot??0,slot=i<0?preferred:i;if(i>=0&&slot===preferred)continue;
      const offset=offsets[slot],cx=clamp(x+offset[0],cameraX+pad+w/2,cameraX+viewW-pad-w/2),cy=clamp(y+offset[1],cameraY+pad+h/2,cameraY+viewH-pad-h/2);
      let cost=0;for(let j=0;j<labelCount;j++){const r=labelPool[j],dx=(r.w+w)/2+gap-Math.abs(cx-r.x),dy=(r.h+h)/2+gap-Math.abs(cy-r.y);if(dx>0&&dy>0)cost+=dx*dy;}
      if(cost<bestCost){best=slot;bestCost=cost;bestX=cx;bestY=cy;}if(cost===0)break;
    }
    if(bestCost>0&&!required)return null;
    owner.labelSlot=best;return reserveLabel(bestX,bestY,w,h,owner);
  }
  function layoutHeroMarker(){
    const s=clamp(.8/cssScale,1,1.6),width=heroCounterReady()?66:44;
    return placeLabel(hero,hero.x,hero.y-82-9*s,width*s,30*s,badgeOffsets,true);
  }
  function heroCounterReady(){return hero.riposte>0||!!(hero.strike?.counterBonus>0&&hero.strike.hits.size===0);}
  let soundOn = false, audio, melodyTimer = 0;
  try { best = Number(localStorage.getItem('penjaga-pulau-best')) || 0; } catch { /* private/file contexts may deny storage */ }
  $('bestScore').textContent = String(best).padStart(4, '0');

  // A hand-placed island: its shore and collision use the same tile mask.
  const rows = { 1: [6, 14], 2: [3, 17], 3: [2, 18], 4: [2, 18], 5: [1, 18], 6: [1, 18], 7: [2, 18], 8: [2, 17], 9: [4, 16] };
  const land = (c, r) => !!rows[r] && c >= rows[r][0] && c <= rows[r][1];
  const onLand = (x, y) => land(Math.floor(x / TILE), Math.floor(y / TILE)) && x > 80 && x < 1195 && y > 80 && y < 630;
  const footOffsets = Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*23,Math.sin(i*Math.PI/4)*23]);
  function canStand(x, y) {
    // Stay inside the visible grass edge, including diagonal shore corners.
    for (const [dx,dy] of footOffsets) if (!onLand(x+dx,y+dy)) return false;
    return onLand(x, y);
  }
  function translateEntity(entity, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    for (let i = 0; i < steps; i++) {
      if (positionFits(entity.x + dx / steps, entity.y, entity)) entity.x += dx / steps;
      if (positionFits(entity.x, entity.y + dy / steps, entity)) entity.y += dy / steps;
    }
  }
  function keepOnLand(entity) {
    if (canStand(entity.x, entity.y)) return;
    for (let radius = 4; radius <= 320; radius += 4) for (let i = 0; i < 24; i++) {
      const x = entity.x + Math.cos(i * Math.PI / 12) * radius, y = entity.y + Math.sin(i * Math.PI / 12) * radius;
      if (canStand(x, y)) { entity.x = x; entity.y = y; return; }
    }
    entity.x = 788; entity.y = 370;
  }
  const trees = [
    [200, 330, 1], [153, 488, 2], [222, 505, 3], [292, 554, 4], [349, 589, 1],
    [420, 185, 3], [484, 173, 4], [551, 184, 1], [621, 181, 2],
    [1155, 329, 1], [1157, 414, 2], [1133, 543, 4], [1067, 590, 1], [1001, 613, 2],
    [421, 604, 3], [487, 613, 4], [554, 613, 1], [629, 608, 2],
    [278, 322, 3], [346, 317, 2], [291, 472, 4],
  ].map(([x, y, variant], i) => ({ x, y, variant, seed: i * .71, radius: variant < 3 ? 14 : 12, size: variant < 3 ? 166 : 150, resource: i < 5 || i >= 18 }));
  const roadEntry = { x: 110, y: 405 };
  const goldNodes = [[571, 534, 1], [610, 563, 3], [646, 531, 4]].map(([x, y, variant]) => ({ x, y, variant, radius: 13 }));
  const sheep = [[1014, 298], [1063, 316], [1010, 342]].map(([x, y], i) => ({ x, y, originX: x, originY: y, seed: i * 2, cooldown: 0 }));
  const buildings = [
    { x: 845, y: 307, color: 'Blue', name: 'Castle', width: 208, radius: 54, cy: 250 },
    { x: 733, y: 225, color: 'Blue', name: 'Tower', width: 70, radius: 18, cy: 207 },
    { x: 1005, y: 225, color: 'Blue', name: 'Archery', width: 115, radius: 32, cy: 205 },
    { x: 1070, y: 423, color: 'Blue', name: 'House1', width: 68, radius: 22, cy: 399 },
    { x: 983, y: 502, color: 'Blue', name: 'Barracks', width: 122, radius: 38, cy: 479 },
    { x: 1090, y: 505, color: 'Blue', name: 'Monastery', width: 99, radius: 29, cy: 481 },
    { x: 910, y: 571, color: 'Blue', name: 'House2', width: 76, radius: 25, cy: 552 },
    { x: 755, y: 570, color: 'Blue', name: 'House3', width: 80, radius: 25, cy: 550 },
    { x: 245, y: 270, color: 'Red', name: 'House2', width: 77, radius: 25, cy: 249 },
    { x: 350, y: 226, color: 'Purple', name: 'Tower', width: 61, radius: 17, cy: 208 },
    { x: 697, y: 157, color: 'Yellow', name: 'House3', width: 70, radius: 20, cy: 139 },
    { x: 223, y: 545, color: 'Black', name: 'House1', width: 65, radius: 21, cy: 522 },
  ];
  const rocks = [[140, 473, 1], [384, 202, 3], [469, 576, 2], [687, 591, 4], [1098, 266, 2], [1150, 454, 3]];
  const bushes = [[299, 216, 1], [372, 323, 2], [464, 191, 3], [670, 183, 4], [1044, 243, 1], [1120, 405, 2], [836, 575, 3], [550, 582, 4], [176, 423, 1]];
  const villagers = [{ x: 704, y: 414, tool: 'Axe', type: 'wood', facing: -1 }, { x: 619, y: 493, tool: 'Pickaxe', type: 'gold', facing: -1 }];
  const sceneryItems=[
    ...trees.map(t=>({type:'tree',source:t,x:t.x,y:t.y,path:terrain(`Resources/Wood/Trees/Tree${t.variant}`)})),
    ...goldNodes.map(n=>({type:'gold',source:n,x:n.x,y:n.y,path:terrain(`Resources/Gold/Gold Stones/Gold Stone ${n.variant}`)})),
    ...bushes.map(([x,y,i])=>({type:'bush',x,y,seed:i,path:terrain(`Decorations/Bushes/Bushe${i}`)})),
    ...buildings.map(b=>({type:'building',source:b,x:b.x,y:b.y-9,path:`Buildings/${b.color} Buildings/${b.name}.png`})),
    ...sheep.map(s=>({type:'sheep',source:s,x:s.x,y:s.y,idle:terrain('Resources/Meat/Sheep/Sheep_Idle'),grass:terrain('Resources/Meat/Sheep/Sheep_Grass')})),
    ...villagers.map(v=>({type:'villager',source:v,x:v.x,y:v.y,path:blue('Pawn',`Interact ${v.tool}`)}))
  ].sort((a,b)=>a.y-b.y);
  const renderUnits=[],shoreTiles=[];
  for(const [rstr,[left,right]] of Object.entries(rows)){const r=Number(rstr);for(let c=left;c<=right;c++)if(!land(c,r+1))shoreTiles.push([c*64,(r+1)*64-1]);}
  const obstacleList = [...trees.map(t => ({ x: t.x, y: t.y - 4, radius: t.radius })), ...goldNodes, ...buildings.map(b => ({ x: b.x, y: b.cy, radius: b.radius }))];
  function positionFits(x, y, entity) {
    if (!canStand(x, y)) return false;
    return obstacleList.every(o => {
      const next = Math.hypot(x - o.x, y - o.y), radius = o.radius + 10;
      // An overlapping spawn can slide out, but cannot go deeper into a collider.
      return next >= radius - .01 || (entity && next > Math.hypot(entity.x - o.x, entity.y - o.y) + .001);
    });
  }
  function clearPath(a, b) {
    const steps = Math.max(1, Math.ceil(dist(a, b) / 12));
    for (let i = 1; i <= steps; i++) if (!positionFits(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
    return true;
  }
  const navCols = 40, navRows = 22;
  const navNodes = Array.from({ length: navCols * navRows }, (_, i) => ({ x: i % navCols * 32 + 16, y: Math.floor(i / navCols) * 32 + 16 }));
  const navOpen = navNodes.map(p => positionFits(p.x, p.y));
  // Static topology is built once; units share bounded reverse-distance fields.
  const navEdges = navNodes.map((n, i) => navOpen[i] ? [i-navCols,i+navCols,i%navCols?i-1:-1,i%navCols<navCols-1?i+1:-1].filter(j => j>=0 && j<navNodes.length && navOpen[j] && clearPath(n,navNodes[j])) : []);
  const navComponent = new Int16Array(navNodes.length).fill(-1);
  let componentCount = 0;
  for(let i=0;i<navNodes.length;i++) if(navOpen[i] && navComponent[i]<0) {
    const queue=[i];navComponent[i]=componentCount;
    for(let head=0;head<queue.length;head++) for(const next of navEdges[queue[head]]) if(navComponent[next]<0){navComponent[next]=componentCount;queue.push(next);}
    componentCount++;
  }
  const routeFields = new Map();
  const navigationStats = { builds:0, hits:0 };
  function routeTo(a, b) {
    let start=-1,best=Infinity;
    const col=Math.floor(a.x/32),row=Math.floor(a.y/32);
    for(let r=Math.max(0,row-3);r<=Math.min(navRows-1,row+3);r++) for(let c=Math.max(0,col-3);c<=Math.min(navCols-1,col+3);c++) {
      const i=r*navCols+c,n=navNodes[i],d=(n.x-a.x)**2+(n.y-a.y)**2;
      if(navOpen[i] && d<best && clearPath(a,n)){start=i;best=d;}
    }
    if(start<0)return [];
    let goal=-1;best=Infinity;
    for(let i=0;i<navNodes.length;i++) if(navComponent[i]===navComponent[start]) {
      const n=navNodes[i],d=(n.x-b.x)**2+(n.y-b.y)**2;
      if(d<best){goal=i;best=d;}
    }
    if(goal<0)return [];
    let field=routeFields.get(goal);
    if(!field){
      field=new Int16Array(navNodes.length).fill(-1);field[goal]=0;const queue=[goal];
      for(let head=0;head<queue.length;head++)for(const next of navEdges[queue[head]])if(field[next]<0){field[next]=field[queue[head]]+1;queue.push(next);}
      if(routeFields.size>=32)routeFields.delete(routeFields.keys().next().value);
      routeFields.set(goal,field);navigationStats.builds++;
    }else navigationStats.hits++;
    const path=[];let current=start;
    while(current!==goal){const next=navEdges[current].find(i=>field[i]>=0&&field[i]<field[current]);if(next===undefined)return [];path.push(navNodes[next]);current=next;}
    return path;
  }

  function loadImage(path) {
    if (images.has(path)) return images.get(path).promise;
    const image = new Image();
    const record = { image, loaded: false };
    record.promise = new Promise((resolve, reject) => {
      image.onload = () => { record.loaded = true; resolve(image); };
      image.onerror = () => { images.delete(path); reject(new Error(path)); };
    });
    images.set(path, record);
    image.src = path;
    return record.promise;
  }
  function img(path) { const r = images.get(path); return r?.loaded ? r.image : null; }
  async function preload() {
    const paths = new Set();
    for (const color of ['Blue', 'Red', 'Purple', 'Yellow', 'Black']) {
      for (const kind of ['Warrior', 'Archer', 'Lancer', 'Monk', 'Pawn']) {
        for (const action of ['Idle', 'Run']) paths.add(unitPath(color, kind, action));
        if (kind === 'Warrior') paths.add(unitPath(color, kind, 'Attack1'));
        if (kind === 'Archer') { paths.add(unitPath(color, kind, 'Shoot')); paths.add(`Units/${color} Units/Archer/Arrow.png`); }
        if (kind === 'Lancer') paths.add(unitPath(color, kind, 'Right_Attack'));
        if (kind === 'Monk') paths.add(unitPath(color, kind, 'Heal'));
      }
    }
    for (const tool of ['Axe', 'Pickaxe']) paths.add(blue('Pawn', `Interact ${tool}`));
    paths.add(blue('Pawn', 'Idle Meat'));paths.add(unitPath('Black','Warrior','Attack2'));paths.add(unitPath('Black','Warrior','Guard'));
    paths.add(blue('Monk', 'Heal_Effect'));
    for (const b of buildings) paths.add(`Buildings/${b.color} Buildings/${b.name}.png`);
    for (let i = 1; i <= 4; i++) {
      paths.add(terrain(`Resources/Wood/Trees/Tree${i}`));
      paths.add(terrain(`Resources/Wood/Trees/Stump ${i}`));
      paths.add(terrain(`Decorations/Bushes/Bushe${i}`));
      paths.add(terrain(`Decorations/Rocks/Rock${i}`));
      paths.add(terrain(`Decorations/Rocks in the Water/Water Rocks_0${i}`));
    }
    for (const n of goldNodes) paths.add(terrain(`Resources/Gold/Gold Stones/Gold Stone ${n.variant}`));
    for (const p of ['Tileset/Tilemap_color1', 'Tileset/Water Background color', 'Tileset/Water Foam', 'Tileset/Shadow', 'Decorations/Rubber Duck/Rubber duck', 'Decorations/Clouds/Clouds_01', 'Decorations/Clouds/Clouds_03', 'Resources/Meat/Sheep/Sheep_Idle', 'Resources/Meat/Sheep/Sheep_Move', 'Resources/Meat/Sheep/Sheep_Grass', 'Resources/Gold/Gold Resource/Gold_Resource', 'Resources/Meat/Meat Resource/Meat Resource', 'Resources/Wood/Wood Resource/Wood Resource']) paths.add(terrain(p));
    for (const p of ['Dust_01', 'Dust_02', 'Explosion_01', 'Explosion_02', 'Fire_01', 'Fire_02', 'Fire_03', 'Water Splash']) paths.add(`Particle FX/${p}.png`);
    let loaded = 0;
    const failures = [];
    await Promise.all([...paths].map(async p => { try { await loadImage(p); } catch { failures.push(p); } loaded++; $('loadingProgress').style.width = `${loaded / paths.size * 100}%`; }));
    if (failures.length) {
      $('loadError').hidden = false;
      $('loadError').textContent = `${failures.length} aset gagal dimuat. Pastikan folder aset tetap lengkap, lalu muat ulang.`;
      $('startLabel').textContent = 'Muat ulang untuk mencoba';
      $('startButton').disabled = false;
      $('startButton').onclick = () => location.reload();
      console.error('Assets missing:', failures);
      return;
    }
    terrainCanvas = makeTerrain();
    initialized = true;
    state = 'ready';
    $('startButton').disabled = false;
    $('startLabel').textContent = 'Mulai petualangan';
    $('loadingTrack').hidden = true;
    resize();
  }

  // Draw once, retaining the hand-crafted grass tile texture at pixel scale.
  function makeTerrain() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const tilemap = img(terrain('Tileset/Tilemap_color1'));
    g.fillStyle = '#4c9cab'; g.fillRect(0, 0, W, H);
    const water = img(terrain('Tileset/Water Background color'));
    if (water) { g.fillStyle = g.createPattern(water, 'repeat'); g.fillRect(0, 0, W, H); }
    // Seeded details stay fixed rather than flickering between frames.
    let seed = 8453;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    g.fillStyle = '#b2e6df33';
    for (let i = 0; i < 185; i++) { const x = random() * W, y = random() * H; g.fillRect(x, y, 5 + random() * 20, 2); }
    for (const [rstr, [left, right]] of Object.entries(rows)) {
      const r = Number(rstr);
      for (let col = left; col <= right; col++) {
        const x = col * TILE, y = r * TILE;
        g.fillStyle = '#296b7666'; g.fillRect(x - 4, y + 20, 72, 64);
        if (!land(col, r + 1)) g.drawImage(tilemap, 384, 256, 64, 64, x, y + 37, 64, 43);
      }
    }
    for (const [rstr, [left, right]] of Object.entries(rows)) {
      const r = Number(rstr);
      for (let col = left; col <= right; col++) {
        const sx = col === left ? 0 : col === right ? 128 : 64;
        const sy = !land(col, r - 1) ? 0 : !land(col, r + 1) ? 128 : 64;
        g.drawImage(tilemap, sx, sy, 64, 64, col * TILE, r * TILE, TILE, TILE);
      }
    }
    // Well-trodden roads connect the outposts with the blue settlement.
    const roads = [ [[94, 405], [223, 401], [350, 393], [510, 410], [687, 390], [845, 333]], [[687, 390], [821, 448], [978, 464], [1084, 453]], [[845, 333], [977, 286], [1005, 230]], [[845, 333], [744, 288], [733, 236]] ];
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const points of roads) {
      g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.strokeStyle = '#7eaa5d'; g.lineWidth = 43; g.stroke();
      g.strokeStyle = '#b9bd79'; g.lineWidth = 33; g.stroke();
      g.strokeStyle = '#c4c78b'; g.lineWidth = 24; g.stroke();
    }
    // A visible landing jetty feeds a single road into the island.
    g.fillStyle = '#275f5d66'; g.fillRect(23, 392, 106, 45);
    g.fillStyle = '#684f3b'; g.fillRect(25, 386, 102, 4); g.fillRect(25, 420, 102, 5);
    for (let x = 28; x < 126; x += 11) {
      g.fillStyle = x % 2 ? '#c5a16b' : '#b8915c'; g.fillRect(x, 386, 9, 39);
      g.fillStyle = '#ead39a55'; g.fillRect(x + 1, 389, 2, 30);
      g.fillStyle = '#72533b'; g.fillRect(x + 3, 389, 2, 2); g.fillRect(x + 3, 417, 2, 2);
    }
    g.fillStyle = '#775b3e'; g.fillRect(119, 362, 5, 33); g.fillRect(119, 420, 5, 30);
    for (let i = 0; i < 170; i++) {
      const x = random() * W, y = random() * H;
      if (!onLand(x, y)) continue;
      g.fillStyle = ['#d9d78b', '#e5e2a0', '#679d53', '#9fbc63'][i % 4];
      g.fillRect(x, y, 2, 2); if (i % 3 === 0) g.fillRect(x + 3, y + 2, 2, 2);
    }
    return c;
  }

  function resize() {
    const rect = $('arena').getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    const dpr = Math.max(1,Math.min(window.devicePixelRatio || 1,2,Math.sqrt(2400000/(rect.width*rect.height))));
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    scale = canvas.height / H;cssScale=rect.height/H;viewH = H;viewW = canvas.width / scale;overlayDirty=true;
    ctx.imageSmoothingEnabled = false;
  }
  new ResizeObserver(resize).observe($('arena'));

  function spriteInfo(path){
    let info=spriteMetadata.get(path);if(info)return info;
    const meta = manifest.get(path);
    // All four trees have eight 192px-wide frames; pine frames are 256px tall.
    const isTree = /\/Trees\/Tree[1-4]\.png$/.test(path);
    const width = isTree ? 192 : meta.height, height = meta.height;
    info={width,height,count:Math.max(1,Math.floor(meta.width/width)),anchorY:isTree?(height===256?.95:.87):.79};
    spriteMetadata.set(path,info);return info;
  }
  function spriteFrame(path, time = 0, fps = 9, once = false) {
    const info=spriteInfo(path),{width,height,count,anchorY}=info;
    const tick = Math.max(0, Math.floor(time * fps));
    const index = once ? Math.min(count - 1, tick) : tick % count;
    return { x:index*width,width,height,count,anchorY };
  }
  function whiteFrame(path,frameX,info){
    const key=path+':'+frameX;let white=flashFrames.get(key);if(white)return white;
    white=document.createElement('canvas');white.width=info.width;white.height=info.height;
    const g=white.getContext('2d');g.drawImage(img(path),frameX,0,info.width,info.height,0,0,info.width,info.height);
    g.globalCompositeOperation='source-in';g.fillStyle='#fff';g.fillRect(0,0,info.width,info.height);
    if(flashFrames.size>=32)flashFrames.delete(flashFrames.keys().next().value);
    flashFrames.set(key,white);return white;
  }
  function unitFrame(path,frameX,info){
    const key=path+':'+frameX;let frame=unitFrames.get(key);
    if(frame){unitFrames.delete(key);unitFrames.set(key,frame);return frame;}
    const bounds=window.TINY_UNIT_BOUNDS?.[path]?.[frameX/info.width]||[0,0,info.width,info.height];
    const [left,top,width,height]=bounds,image=document.createElement('canvas');image.width=width;image.height=height;
    image.getContext('2d').drawImage(img(path),frameX+left,top,width,height,0,0,width,height);
    frame={image,x:left,y:top,bytes:image.width*image.height*4};
    while(unitFrames.size>=512||unitFrameBytes+frame.bytes>UNIT_FRAME_BUDGET){const oldest=unitFrames.keys().next().value;unitFrameBytes-=unitFrames.get(oldest).bytes;unitFrames.delete(oldest);}
    unitFrames.set(key,frame);unitFrameBytes+=frame.bytes;return frame;
  }
  function drawSprite(path, x, y, size, time = animTime, fps = 9, facing = 1, alpha = 1, once = false, flash = false) {
    if(x+size<cameraX||x-size>cameraX+viewW||y+size<cameraY||y-size>cameraY+viewH)return;
    const im = img(path); if (!im) return;
    const frame=spriteInfo(path),tick=Math.max(0,Math.floor(time*fps)),frameX=(once?Math.min(frame.count-1,tick):tick%frame.count)*frame.width,width=size*frame.width/frame.height;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1); ctx.globalAlpha = alpha;
    if (flash) {
      const white=whiteFrame(path,frameX,frame);
      ctx.drawImage(white,-width/2,-size*frame.anchorY,width,size);
    } else if(path.startsWith('Units/')){
      const cached=unitFrame(path,frameX,frame),ratio=size/frame.height;
      ctx.drawImage(cached.image,-width/2+cached.x*ratio,-size*frame.anchorY+cached.y*ratio,cached.image.width*ratio,cached.image.height*ratio);
    } else ctx.drawImage(im, frameX, 0, frame.width, frame.height, -width / 2, -size * frame.anchorY, width, size);
    ctx.restore();
  }
  function drawImageAt(path, x, y, width, alpha = 1) {
    const im = img(path); if (!im) return;
    const height = im.height / im.width * width;
    if(x+width/2<cameraX||x-width/2>cameraX+viewW||y<cameraY||y-height>cameraY+viewH)return;
    ctx.globalAlpha = alpha; ctx.drawImage(im, Math.round(x - width / 2), Math.round(y - height), width, height); ctx.globalAlpha = 1;
  }
  function drawScenery(item){
    if(item.x+210<cameraX||item.x-210>cameraX+viewW)return;
    const s=item.source;
    if(item.type==='tree')drawSprite(item.path,s.x,s.y,s.size,animTime+s.seed,5,1,sceneryCoversHero(s.x,s.y,s.size*(s.variant<3?.75:1),s.size)?.32:1);
    else if(item.type==='gold')drawImageAt(item.path,s.x,s.y,64);
    else if(item.type==='bush')drawSprite(item.path,item.x,item.y,75,animTime+item.seed,5);
    else if(item.type==='sheep')drawSprite(state==='playing'&&Math.sin(elapsed+s.seed)>.4?item.grass:item.idle,s.x,s.y,77,animTime+s.seed,6,Math.sin(animTime*.13+s.seed)>0?1:-1);
    else if(item.type==='villager')drawSprite(item.path,s.x,s.y,104,animTime,8,s.facing);
    else{
      const meta=manifest.get(item.path);
      drawImageAt(item.path,s.x,s.y,s.width,sceneryCoversHero(s.x,s.y,s.width,s.width*meta.height/meta.width)?.45:1);
      if(s.name==='Castle'){
        if(castle.hitFlash>0){ctx.save();ctx.filter='brightness(0) invert(1)';drawImageAt(item.path,s.x,s.y,s.width,.6);ctx.restore();}
        if(castle.hp<castle.maxHp)healthBar(s.x,s.y-160,castle.hp,castle.maxHp,'#a7d7bd',85);
        if(castle.hp<230)drawSprite('Particle FX/Fire_01.png',s.x-48,s.y-55,65);
        if(castle.hp<100)drawSprite('Particle FX/Fire_02.png',s.x+49,s.y-63,77);
      }
    }
  }
  function healthBar(x, y, hp, max, color, width = 35) {
    ctx.fillStyle = '#173327cc'; ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
    ctx.fillStyle = color; ctx.fillRect(x - width / 2, y, width * clamp(hp / max, 0, 1), 3);
  }
  function bossPose(u){
    const a=u.bossAction;
    if(!a)return {path:unitPath('Black','Warrior',u.moving?'Run':'Idle'),age:u.animTime||0,fps:9,once:false};
    if(a.stage==='rally')return {path:unitPath('Black','Warrior','Guard'),age:a.duration-a.time,fps:6,once:true};
    const warning=a.stage==='warning',recover=a.stage==='recovery',age=warning?a.duration-a.time:recover?(a.recoveryDuration||.95)-a.time:.45-a.time;
    const action=a.type==='volley'?'Shoot':a.type==='charge'?(a.stage==='charge'?'Run':'Guard'):'Attack2';
    const path=unitPath('Black',a.type==='volley'?'Archer':'Warrior',action);
    if(recover&&age>.2)return {path:unitPath('Black','Warrior','Idle'),age,fps:5,once:false};
    const duration=warning?a.duration:.3,progress=warning?age/duration*.6:.6+Math.min(1,age/.2)*.4;
    return {path,age:action==='Run'?age:progress,fps:action==='Run'?16:spriteFrame(path).count,once:action!=='Run'};
  }
  const swingAngle = age => -SWING.angle+2*SWING.angle*clamp((age-SWING.start)/(SWING.end-SWING.start),0,1);
  const heroAttackAge = () => hero.attack>0 ? (hero.attackDuration||HERO_ATTACK.duration)-hero.attack : HERO_ATTACK.duration;
  function heroMoveScale(){
    return HERO_ATTACK.moveScale+(1-HERO_ATTACK.moveScale)*clamp((heroAttackAge()-SWING.end)/((hero.attackDuration||HERO_ATTACK.duration)-SWING.end),0,1);
  }
  function heroPose(){
    const age=heroAttackAge();
    if(age>=SWING.end&&hero.moving)return {path:blue('Warrior','Run'),age:age-SWING.end,fps:11,once:false};
    const path=blue('Warrior','Attack1'),count=spriteFrame(path).count;
    // The original sheet has two anticipation frames, one contact and one recovery.
    const contact=Math.max(1,count-2),frame=age<SWING.start?Math.min(contact-1,Math.floor(age/SWING.start*contact)):age<SWING.end?contact:count-1;
    return {path,age:frame,fps:1,once:true};
  }
  function sceneryCoversHero(x,y,width,height){
    return state!=='ready'&&hero.y<y-4&&hero.y>y-height+18&&Math.abs(hero.x-x)<width*.38;
  }
  function drawHeroSwing(){
    if(hero.attack<=0&&hero.missCue<=0)return;
    const age=heroAttackAge(),windup=age<SWING.start,active=age<SWING.end;
    if(!windup&&!active&&age>SWING.end+.08&&hero.missCue<=0)return;
    ctx.save();ctx.translate(hero.x,hero.y-23);ctx.scale(hero.swingFacing||hero.facing,1);ctx.lineCap='round';
    const end=swingAngle(age),from=windup?-SWING.angle:Math.max(-SWING.angle,end-.95);
    ctx.globalAlpha=hero.missCue>0?.4:windup?.28+.3*age/SWING.start:active?1:Math.max(0,1-(age-SWING.end)/.08);
    if(windup||hero.missCue>0)ctx.setLineDash([3,7]);
    ctx.beginPath();ctx.arc(0,0,SWING.reach,from,windup||hero.missCue>0?SWING.angle:end);
    ctx.strokeStyle='#173327';ctx.lineWidth=7;ctx.stroke();
    ctx.strokeStyle=hero.missCue>0?'#dfdfcf':hero.swingEmpowered?'#aef8ea':'#fff1c5';ctx.lineWidth=windup?2:3.5;ctx.stroke();
    if(!windup&&active){ctx.setLineDash([]);ctx.fillStyle=hero.swingEmpowered?'#aef8ea':'#fff5d8';ctx.beginPath();ctx.arc(Math.cos(end)*SWING.reach,Math.sin(end)*SWING.reach,4,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  function drawHeroSprite(path,size,age,fps,facing,once=false){
    Object.assign(heroSprite,{path,size,age,fps,facing,once});drawSprite(path,hero.x,hero.y,size,age,fps,facing,1,once);
  }
  function drawHeroOutline(){
    if(!['playing','paused'].includes(state)||!heroSprite.path||!img(heroSprite.path))return;
    let covered=false;
    for(const units of [enemies,allies])for(const u of units)if(u.hp>0&&u.y>hero.y-8&&u.y<hero.y+58&&Math.abs(u.x-hero.x)<42)covered=true;
    if(!covered)return;
    const p=heroSprite,info=spriteInfo(p.path),tick=Math.max(0,Math.floor(p.age*p.fps)),frameX=(p.once?Math.min(info.count-1,tick):tick%info.count)*info.width,key=p.path+':'+frameX;
    let outline=heroOutlines.get(key);
    if(!outline){
      const mask=whiteFrame(p.path,frameX,info);outline=document.createElement('canvas');outline.width=info.width+8;outline.height=info.height+8;
      const g=outline.getContext('2d');for(const [x,y] of [[-3,0],[3,0],[0,-3],[0,3],[-2,-2],[2,-2],[-2,2],[2,2]])g.drawImage(mask,4+x,4+y);
      g.globalCompositeOperation='source-in';g.fillStyle='#fff0b5';g.fillRect(0,0,outline.width,outline.height);g.globalCompositeOperation='destination-out';g.drawImage(mask,4,4);
      if(heroOutlines.size>=32)heroOutlines.delete(heroOutlines.keys().next().value);heroOutlines.set(key,outline);
    }
    const ratio=p.size/info.height;ctx.save();ctx.translate(Math.round(hero.x),Math.round(hero.y));ctx.scale(p.facing,1);ctx.globalAlpha=.88;
    ctx.drawImage(outline,-info.width*ratio/2-4*ratio,-p.size*info.anchorY-4*ratio,outline.width*ratio,outline.height*ratio);ctx.restore();
  }
  function drawHeroMarker(){
    if(!['playing','paused'].includes(state)||hero.hp<=0)return;
    const s=clamp(.8/cssScale,1,1.6),counter=heroCounterReady(),color=counter||hero.dash>0?'#aef8ea':hero.damageCue>0?'#ffb59d':'#f5dfa3';
    ctx.save();ctx.translate(hero.x,hero.y);
    ctx.beginPath();ctx.ellipse(0,-4,22,10,0,0,Math.PI*2);ctx.strokeStyle='#173327';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
    if(ranks.bastion>0&&castle.hp>0&&dist(hero,castle)<=fortressRadius()){ctx.fillStyle='#b5f5e4';ctx.fillRect(-3,-7,6,6);}
    if(hero.damageCue>0){ctx.save();ctx.translate(0,-24);ctx.rotate(hero.damageDirection+Math.PI);ctx.beginPath();ctx.moveTo(46,0);ctx.lineTo(32,-8);ctx.lineTo(32,8);ctx.closePath();ctx.fillStyle='#ffb59d';ctx.strokeStyle='#173327';ctx.lineWidth=3;ctx.stroke();ctx.fill();ctx.restore();}
    const marker=hero.markerLayout||layoutHeroMarker(),markerY=marker.y+9*s;
    const below=markerY>hero.y-45;
    if(Math.abs(marker.x-hero.x)>20||Math.abs(markerY-(hero.y-82))>20){ctx.beginPath();ctx.moveTo(0,below?-20:-65);ctx.lineTo(marker.x-hero.x,markerY-hero.y+(below?-18:6)*s);ctx.strokeStyle='#173327';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();}
    ctx.translate(marker.x-hero.x,markerY-hero.y);ctx.scale(s,s);
    const width=counter?66:44;
    ctx.fillStyle='#173327ed';ctx.fillRect(-width/2,-18,width,18);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(-width/2,-18,width,18);
    ctx.font='bold 11px Segoe UI';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(counter?'BALASAN':'KAMU',0,-6);
    if(hero.cooldown>0){ctx.fillStyle='#ffffff26';ctx.fillRect(-width/2+2,-3,width-4,2);ctx.fillStyle=color;ctx.fillRect(-width/2+2,-3,(width-4)*clamp(1-hero.cooldown/(HERO_ATTACK.cooldown*(1-ranks.rhythm*.06)),0,1),2);}
    ctx.beginPath();ctx.moveTo(-4,below?-19:1);ctx.lineTo(4,below?-19:1);ctx.lineTo(0,below?-24:6);ctx.closePath();ctx.fill();
    if(hero.hp<hero.maxHp)healthBar(0,below?4:-23,hero.hp,hero.maxHp,hero.hp/hero.maxHp<.3?'#ffb59d':'#bde6b1',width-4);
    ctx.restore();
  }
  function playerThreat(u){
    if(u.hp<=0||u.team!=='enemy'||u.isBoss||u.strike?.target!==hero)return null;
    const duration=u.kind==='Archer'?.31:u.kind==='Lancer'?.24:.2;
    return {progress:clamp(1-u.strike.timer/duration,0,1),ranged:u.kind==='Archer'};
  }
  function drawPlayerThreats(){
    if(!['playing','paused'].includes(state))return;
    const s=clamp(.8/cssScale,1,1.6);threatOrder.length=0;
    for(const u of enemies)if(playerThreat(u)&&u.x>cameraX-30&&u.x<cameraX+viewW+30)threatOrder.push(u);
    threatOrder.sort((a,b)=>a.strike.timer-b.strike.timer||a.combatId-b.combatId);
    for(const u of threatOrder){if(u.labelAction!==u.strike){u.labelAction=u.strike;u.labelSlot=0;}const threat=playerThreat(u),r=placeLabel(u,u.x,u.y-66,20*s,28*s,threatOffsets);if(!r)continue;
      if(Math.abs(r.x-u.x)>8||Math.abs(r.y-(u.y-66))>8){ctx.beginPath();ctx.moveTo(u.x,u.y-49);ctx.lineTo(r.x,r.y+12*s);ctx.strokeStyle='#173327';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#ffd6a0';ctx.lineWidth=1;ctx.stroke();}
      ctx.save();ctx.translate(r.x,r.y-2*s);ctx.scale(s,s);
      ctx.fillStyle='#31251ded';ctx.strokeStyle='#ffd6a0';ctx.lineWidth=1.5;
      ctx.beginPath();if(threat.ranged){ctx.moveTo(0,-9);ctx.lineTo(8,6);ctx.lineTo(-8,6);ctx.closePath();}else ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.font='bold 12px Segoe UI';ctx.fillStyle='#fff1c5';ctx.textAlign='center';ctx.fillText('!',0,4);
      ctx.fillStyle='#31251d';ctx.fillRect(-9,10,18,3);ctx.fillStyle='#ffd6a0';ctx.fillRect(-9,10,18*threat.progress,3);ctx.restore();
    }
  }
  function drawCombatNumbers(){
    floaterOrder.length=0;for(const f of floaters)if(f.x>=cameraX-50&&f.x<=cameraX+viewW+50)floaterOrder.push(f);
    floaterOrder.sort((a,b)=>b.priority-a.priority||b.life-a.life);
    let minor=0;
    for(const f of floaterOrder){
      if(f.priority===0&&++minor>8)continue;
      const s=f.priority>=2?clamp(.8/cssScale,1,1.35):1,size=(f.fontSize||(f.large?17:12))*s,font=`bold ${size}px Segoe UI`;
      ctx.font=font;
      if(f.measuredText!==f.text||f.measuredFont!==font){f.textWidth=ctx.measureText(f.text).width;f.measuredText=f.text;f.measuredFont=font;}
      const r=placeLabel(f,f.x,f.y-size*.35,f.textWidth+6,size+5,numberOffsets,f.priority===3);if(!r)continue;
      f.layoutX=r.x;f.layoutY=r.y;
      ctx.globalAlpha=Math.min(1,f.life*4)*(f.priority===0?.7:1);ctx.textAlign='center';ctx.strokeStyle='#142c23';ctx.lineWidth=f.priority>=2?4:3;
      ctx.strokeText(f.text,r.x,r.y+size*.35);ctx.fillStyle=f.color;ctx.fillText(f.text,r.x,r.y+size*.35);
    }
    ctx.globalAlpha=1;
  }
  function drawBossStatus(){
    if(!boss||boss.hp<=0)return;
    const a=boss.bossAction,open=a?.stage==='recovery',s=clamp(.8/cssScale,1,1.5);
    const text=open?'TERBUKA':a?.stage==='rally'?'MENGAMUK':a?.stage==='warning'?({slam:'! HANTAM',charge:'>> TERJANG',volley:'||| PANAH'}[a.type]):boss.enraged?'PANGLIMA · FASE II':'PANGLIMA · FASE I';
    ctx.font=`bold ${11*s}px Segoe UI`;
    const r=placeLabel(boss,boss.x,boss.y-95,ctx.measureText(text).width+8,17*s,numberOffsets);if(!r)return;
    ctx.textAlign='center';ctx.strokeStyle='#173327';ctx.lineWidth=4;ctx.strokeText(text,r.x,r.y+4*s);ctx.fillStyle=open?'#cbffce':'#f4cc92';ctx.fillText(text,r.x,r.y+4*s);
  }
  function drawBossDanger(overlay=false){
    const a=boss?.hp>0?boss.bossAction:null;if(a?.stage!=='warning')return;
    const progress=clamp(1-a.time/a.duration,0,1);
    ctx.save();ctx.fillStyle='#ed75582b';ctx.lineJoin='round';ctx.lineCap='round';
    if(a.type==='slam'){ctx.translate(a.target.x,a.target.y);ctx.beginPath();ctx.arc(0,0,105,0,Math.PI*2);}
    else{
      ctx.translate(a.origin.x,a.origin.y);ctx.rotate(Math.atan2(a.dy,a.dx));ctx.beginPath();
      if(a.type==='charge'){
        const length=a.chargeEnd.distance;ctx.moveTo(0,-36);ctx.lineTo(length,-36);ctx.arc(length,0,36,-Math.PI/2,Math.PI/2);ctx.lineTo(0,36);ctx.arc(0,0,36,Math.PI/2,Math.PI*1.5);ctx.closePath();
      }else{ctx.moveTo(0,0);ctx.lineTo(Math.cos(.22)*500,-Math.sin(.22)*500);ctx.lineTo(Math.cos(.22)*500,Math.sin(.22)*500);ctx.closePath();}
    }
    if(!overlay){ctx.fill();ctx.restore();return;}
    // Keep the narrow boundary above scenery; the translucent floor remains below units.
    ctx.strokeStyle='#402b24c9';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#ffd4a0';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#fff0c4';ctx.lineWidth=3;
    if(a.type==='slam'){ctx.beginPath();ctx.arc(0,0,105,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();}
    else if(a.type==='charge'){
      const length=a.chargeEnd.distance;ctx.beginPath();ctx.moveTo(length,-40);ctx.lineTo(length,40);ctx.stroke();
      if(length>18){ctx.beginPath();ctx.moveTo(Math.max(0,length-18),-12);ctx.lineTo(length,0);ctx.lineTo(Math.max(0,length-18),12);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(0,-36);ctx.lineTo(length*progress,-36);ctx.stroke();
    }else{
      for(const angle of [-.22,0,.22]){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(angle)*500,Math.sin(angle)*500);ctx.strokeStyle='#ffd4a077';ctx.lineWidth=1.5;ctx.stroke();}
      ctx.beginPath();ctx.arc(0,0,48,-.22,-.22+.44*progress);ctx.strokeStyle='#fff0c4';ctx.lineWidth=4;ctx.stroke();
    }
    ctx.restore();
  }
  function drawUnit(u, isHero = false) {
    if(!isHero&&(u.x+190<cameraX||u.x-190>cameraX+viewW))return;
    if(!isHero){
      ctx.save();ctx.translate(u.x,u.y-3);ctx.strokeStyle=u.team==='enemy'?'#ffc49b':'#b8e5df';ctx.lineWidth=1.5;
      ctx.beginPath();if(u.team==='enemy'){ctx.moveTo(-6,0);ctx.lineTo(0,6);ctx.lineTo(6,0);}else ctx.ellipse(0,0,7,3,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    if(isHero&&hero.dash>0){drawHeroSprite(blue('Warrior','Run'),136,hero.dashElapsed,14,u.facing);return;}
    if (isHero && hero.work) {
      const work = hero.work, progress = clamp(work.elapsed / work.duration, 0, 1);
      const action = work.node.type === 'wood' ? 'Interact Axe' : work.node.type === 'gold' ? 'Interact Pickaxe' : 'Idle Meat';
      drawHeroSprite(blue('Pawn',action),136,work.elapsed,spriteInfo(blue('Pawn',action)).count/work.duration,u.facing,true);
      healthBar(u.x, u.y - 63, progress, 1, '#eed18b', 49);
      ctx.fillStyle = '#fff1c5'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText(work.node.type === 'wood' ? 'MENEBANG' : work.node.type === 'gold' ? 'MENAMBANG' : 'MENGAMBIL BEKAL', u.x, u.y - 72);
      ctx.strokeStyle = '#f4d88baa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(work.node.x, work.node.y, 24, 10, 0, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    const kind = isHero ? 'Warrior' : u.kind, color = isHero ? 'Blue' : u.color;
    const action = u.isBoss&&u.bossAction?.stage==='warning'?'Attack2':u.attack > 0 ? ({ Warrior: 'Attack1', Archer: 'Shoot', Lancer: 'Right_Attack', Monk: 'Heal', Pawn: 'Idle' }[kind]) : u.moving ? 'Run' : 'Idle';
    const size = u.isBoss?188:kind === 'Lancer' ? (isHero ? 194 : 178) : isHero ? 136 : 113;
    const alpha = u.invuln > 0 && !u.hitFlash && Math.floor(animTime * 13) % 2 ? .75 : 1;
    const pose=u.isBoss?bossPose(u):isHero&&u.attack>0?heroPose():null;
    const path=pose?.path||unitPath(color,kind,action),age=pose?pose.age:u.impactHold>0?u.impactAge:u.attack>0?(u.attackDuration||.4)-u.attack:(u.animTime||0);
    const fps=pose?pose.fps:u.attack>0?spriteFrame(path).count/(u.attackDuration||.4):9,once=pose?pose.once:u.attack>0;
    if(isHero)drawHeroSprite(path,size,age,fps,u.facing,once);else drawSprite(path,u.x,u.y,size,age,fps,u.facing,alpha,once);
    if (u.hitFlash > 0) drawSprite(path,u.x,u.y,size,age,fps,u.facing,Math.min(.92,u.hitFlash/.15),once,true);
    if (!isHero && u.attack > 0 && age > .07 && age < .29 && !['Archer', 'Monk'].includes(kind)) {
      ctx.save(); ctx.translate(u.x, u.y - 23); ctx.scale(u.facing, 1);
      ctx.strokeStyle = u.team === 'enemy' ? '#ffc49ba8' : '#d4f5ddb0';
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      const progress=(age-.07)/.22;
      ctx.beginPath();ctx.arc(0,0,kind==='Lancer'?77:43,-1.45,1.45*progress);ctx.stroke();ctx.restore();
    }
    if (!u.isBoss && !isHero && u.hp < u.maxHp && (u.hitFlash>0||dist(u,hero)<240) && !playerThreat(u)) healthBar(u.x, u.y - 55, u.hp, u.maxHp, u.team === 'enemy' ? '#ef9a7a' : '#a9dda9', 35);
    if(u.isBoss){
      const a=u.bossAction,open=a?.stage==='recovery';
      if(open){ctx.strokeStyle='#cbffce';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(u.x,u.y,35,12,0,0,Math.PI*2);ctx.stroke();}
      if(a?.stage==='rally'){ctx.strokeStyle='#ffb37b';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(u.x,u.y,35+18*(1-a.time/a.duration),14,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!initialized) { ctx.fillStyle = '#4c9cab'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    cameraX = viewW >= W ? (W - viewW) / 2 : clamp((state === 'ready' ? 790 : hero.x) - viewW / 2, 0, W - viewW);
    cameraY = 0;
    ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, -cameraY * scale);
    if(!waterPattern)waterPattern=ctx.createPattern(img(terrain('Tileset/Water Background color')),'repeat');
    ctx.fillStyle = waterPattern;
    ctx.fillRect(cameraX, 0, viewW, viewH);
    if (shake > 0 && !reducedMotion) ctx.translate((Math.random()*2-1)*shake,(Math.random()*2-1)*shake);
    ctx.drawImage(terrainCanvas, 0, 0);
    // Animated white water follows each exposed shoreline tile.
    ctx.globalAlpha = .32 + Math.sin(animTime * 1.7) * .1;
    const foam = img(terrain('Tileset/Water Foam'));
    if(foam){const frame=Math.floor(animTime*7)%16;for(const [x,y] of shoreTiles)if(x+64>=cameraX&&x<=cameraX+viewW)ctx.drawImage(foam,frame*192+64,128,64,64,x,y,64,28);}
    ctx.globalAlpha = 1;
    [[98, 284, 1], [1216, 510, 2], [360, 659, 3], [1160, 156, 4]].forEach(([x, y, i]) => drawImageAt(terrain(`Decorations/Rocks in the Water/Water Rocks_0${i}`), x, y, 65));
    const duck = img(terrain('Decorations/Rubber Duck/Rubber duck'));
    if (duck) { const i = Math.floor(animTime * 4) % 3; ctx.drawImage(duck, i * 32, 0, 32, 32, 1036 + Math.sin(animTime * .24) * 22, 53 + Math.sin(animTime * 1.8) * 2, 30, 30); }
    // Stumps and little rocks keep the forest floor varied.
    drawImageAt(terrain('Resources/Wood/Trees/Stump 1'), 373, 496, 48);
    drawImageAt(terrain('Resources/Wood/Trees/Stump 3'), 522, 211, 45);
    for (const [x, y, i] of rocks) drawImageAt(terrain(`Decorations/Rocks/Rock${i}`), x, y, 39);
    for (const d of drops) drawSprite(terrain(`Resources/${d.type === 'wood' ? 'Wood/Wood Resource/Wood Resource' : 'Gold/Gold Resource/Gold_Resource'}`), d.x, d.y + Math.sin(animTime * 4 + d.x) * 3, d.type === 'wood' ? 44 : 58);
    for(const trail of dashTrail)drawSprite(blue('Warrior','Run'),trail.x,trail.y,136,trail.time,14,trail.facing,trail.life*2);
    if(orderPulse>0){const anchor=squadAnchor();ctx.strokeStyle='#c3e8c099';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.ellipse(anchor.x,anchor.y,70,30,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    drawBossDanger();
    renderUnits.length=0;
    for(const u of enemies)if(u.hp>0)renderUnits.push(u);
    for(const u of allies)if(u.hp>0)renderUnits.push(u);
    renderUnits.push(hero);renderUnits.sort((a,b)=>a.y-b.y);
    let sceneryIndex=0;
    for(const u of renderUnits){while(sceneryIndex<sceneryItems.length&&sceneryItems[sceneryIndex].y<=u.y)drawScenery(sceneryItems[sceneryIndex++]);drawUnit(u,u===hero);}
    while(sceneryIndex<sceneryItems.length)drawScenery(sceneryItems[sceneryIndex++]);
    for (const p of projectiles) {
      const arrow = img(`Units/${p.color} Units/Archer/Arrow.png`);
      if (arrow) {
        ctx.save(); ctx.translate(p.x, p.y - 22); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.beginPath();ctx.moveTo(-20,0);ctx.lineTo(7,0);ctx.lineCap='round';ctx.strokeStyle='#183127';ctx.lineWidth=5;ctx.stroke();
        ctx.strokeStyle=p.team==='enemy'?'#ffd0a0':'#b4e8e6';ctx.lineWidth=2;ctx.stroke();
        ctx.drawImage(arrow, -21, -21, 42, 42); ctx.restore();
      }
    }
    for (const e of effects) drawSprite(e.path, e.x, e.y, e.size, e.time, e.fps, 1, Math.min(1, e.life * 3));
    for (const hit of impacts) {
      const progress = 1 - hit.life / hit.duration;
      ctx.save(); ctx.translate(hit.x, hit.y); ctx.globalAlpha = Math.min(1, hit.life * 7);
      const prominent=hit.prominent!==false,rays=prominent?7:3;
      ctx.globalAlpha*=prominent?1:.55;ctx.strokeStyle = hit.color; ctx.lineWidth = prominent?2.5:1.5;
      ctx.beginPath(); ctx.arc(0, 0, 5 + progress * (prominent?17:9), 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < rays; i++) {
        const angle = hit.angle + i * Math.PI * 2 / rays, radius = 6 + progress * (prominent?29:14);
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .75;
        ctx.strokeStyle = i % 2 ? '#fff8d8' : hit.color; ctx.lineWidth = i % 2 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(x * .55, y * .55); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    }
    drawHeroSwing();
    drawBossDanger(true);
    drawHeroOutline();
    beginLabelLayout();hero.markerLayout=layoutHeroMarker();
    drawBossStatus();
    drawPlayerThreats();
    drawCombatNumbers();
    ctx.globalAlpha = 1;
    if (state === 'playing' && phase === 'battle') {
      ctx.fillStyle = '#233d31dc'; ctx.fillRect(76, 446, 100, 23);
      ctx.fillStyle = '#f2cc93'; ctx.font = 'bold 8px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('JALUR PENYERANG →', 126, 461);
    }
    // Translucent clouds drift across the sea and treetops.
    const cloud = img(terrain('Decorations/Clouds/Clouds_01'));
    if (cloud && !reducedMotion) {
      ctx.globalAlpha = .13;
      ctx.drawImage(cloud, (animTime * 7 % 1700) - 320, 52, 365, 162);
      ctx.drawImage(cloud, 1020 - (animTime * 4 % 1700), 516, 280, 124);
      ctx.globalAlpha = 1;
    }
    drawHeroMarker();
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function addEffect(path, x, y, size = 90, life = .55, fps = 14) { if(effects.length>=80)effects.shift(); effects.push({ path, x, y, size, life, time: 0, fps }); }
  function float(text, x, y, color = '#f4d790', large = false, priority=1) {
    let fy = y - 30;
    for (let attempts = 0; attempts < 3; attempts++) {
      if (!floaters.some(f => f.priority>=priority&&Math.abs(f.x - x) < 40 && Math.abs(f.y - fy) < 18)) break;
      fy -= 18;
    }
    const f={ text, x, y: fy, life: large ? .8 : .9, color, large, priority };
    if(floaters.length>=35){
      let least=0;for(let i=1;i<floaters.length;i++)if(floaters[i].priority<floaters[least].priority)least=i;
      if(floaters[least].priority>priority)return null;
      floaters.splice(least,1);
    }
    floaters.push(f);return f;
  }
  function floatDamage(target,amount,source){
    const priority=target===hero?3:source===hero||target===castle?2:0;
    const existing=floaters.find(f=>f.target===target&&f.priority===priority&&elapsed<f.mergeUntil);
    if(existing){existing.amount+=amount;existing.text=`−${Math.ceil(existing.amount)}`;return;}
    const color=target===hero||target===castle?'#ffb59d':source===hero?'#fff0ac':'#dfdfc8';
    const direction=source===hero?hero.swingFacing||hero.facing:target===hero?-hero.facing:1;
    const f=float(`−${Math.ceil(amount)}`,target.x+direction*(priority>=2?28:10),target.y-(target===castle?45:priority>=2?25:5),color,priority>=2,priority);
    if(f)Object.assign(f,{target,amount,mergeUntil:elapsed+.12,fontSize:target===hero?20:priority>=2?17:11});
  }
  function notify(text) { $('toast').textContent = text; $('toast').classList.add('show');toastTimer=3;overlayDirty=true; }
  function announce(title, subtitle) {
    $('announcement').replaceChildren(document.createTextNode(title));
    const small = document.createElement('small'); small.textContent = subtitle; $('announcement').append(small);
    $('announcement').classList.add('show');announcementTimer=2.5;overlayDirty=true;
  }
  const sampleBuffers=new Map(),soundVoices=new Set();let audioLoading=null,audioMaster,effectsBus,musicBus,audioFailures=0,sampleSerial=0;
  let effectsVolume=.75,musicVolume=.25;
  try{const saved=JSON.parse(localStorage.getItem('penjaga-audio')||'{}');if(Number.isFinite(saved.effects))effectsVolume=clamp(saved.effects,0,1);if(Number.isFinite(saved.music))musicVolume=clamp(saved.music,0,1);}catch{}
  function initAudio() {
    if(!audio){
      const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
      audio=new A();audioMaster=audio.createGain();audioMaster.gain.value=soundOn?.8:0;
      effectsBus=audio.createGain();effectsBus.gain.value=effectsVolume;musicBus=audio.createGain();musicBus.gain.value=musicVolume;
      const limiter=audio.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.15;
      effectsBus.connect(audioMaster);musicBus.connect(audioMaster);audioMaster.connect(limiter);limiter.connect(audio.destination);
    }
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    if(!audioLoading){
      $('audioStatus').textContent='Memuat efek suara…';
      audioLoading=Promise.all(Object.entries(window.TINY_AUDIO||{}).map(async([name,data])=>{
        try{const raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);sampleBuffers.set(name,await audio.decodeAudioData(bytes.buffer));}catch{audioFailures++;}
      })).then(()=>{$('audioStatus').textContent=sampleBuffers.size?`${sampleBuffers.size} efek suara siap · dapat dimainkan offline.`:'Efek cadangan aktif.';});
    }
  }
  function trackVoice(source,gain,panner,priority){
    const voice={source,priority,finish:null};let finished=false;activeVoices++;
    voice.finish=()=>{if(finished)return;finished=true;activeVoices--;soundVoices.delete(voice);source.disconnect();gain.disconnect();panner?.disconnect();};
    source.onended=voice.finish;soundVoices.add(voice);return voice;
  }
  function playSample(names,point=hero,volume=.5,rate=1,priority=1){
    if(!soundOn||!audio||!names.length)return false;
    const name=names[sampleSerial++%names.length],buffer=sampleBuffers.get(name);if(!buffer)return false;
    if(activeVoices>=12){let victim=null;for(const v of soundVoices)if(v.priority<priority&&(!victim||v.priority<victim.priority))victim=v;if(!victim)return false;victim.source.stop();victim.finish();}
    const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;source.playbackRate.value=rate;
    const distance=dist(point,hero);gain.gain.value=volume*clamp(1-distance/850,.15,1);
    source.connect(gain);let panner=null;
    if(audio.createStereoPanner){panner=audio.createStereoPanner();panner.pan.value=clamp((point.x-hero.x)/440,-.8,.8);gain.connect(panner);panner.connect(effectsBus);}else gain.connect(effectsBus);
    trackVoice(source,gain,panner,priority);source.start();return true;
  }
  function updateAudioVolumes(){
    $('effectsVolume').value=Math.round(effectsVolume*100);$('effectsVolumeValue').textContent=`${Math.round(effectsVolume*100)}%`;
    $('musicVolume').value=Math.round(musicVolume*100);$('musicVolumeValue').textContent=`${Math.round(musicVolume*100)}%`;
    if(audio){effectsBus.gain.setTargetAtTime(effectsVolume,audio.currentTime,.02);musicBus.gain.setTargetAtTime(musicVolume,audio.currentTime,.02);}
    try{localStorage.setItem('penjaga-audio',JSON.stringify({effects:effectsVolume,music:musicVolume}));}catch{}
  }
  const lastCombatCue=new Map();let activeVoices=0;
  const combatSounds={hit:[280,90,'square',.08],miss:[190,100,'triangle',.08],hurt:[150,75,'triangle',.12],dodge:[880,1320,'sine',.18],slam:[150,65,'sawtooth',.22],charge:[240,480,'triangle',.18],volley:[720,540,'sine',.18]};
  const combatSamples={hit:['impactMetal_light_000.ogg','impactMetal_light_001.ogg'],miss:['knifeSlice.ogg','knifeSlice2.ogg'],hurt:['impactSoft_medium_000.ogg'],dodge:['cloth1.ogg','cloth2.ogg'],slam:['impactMetal_heavy_000.ogg'],charge:['drawKnife1.ogg'],volley:['metalClick.ogg'],bow:['cloth2.ogg'],wood:['chop.ogg'],stone:['impactMetal_light_000.ogg'],heal:['handleCoins.ogg']};
  function combatCue(type,point=hero){
    if(elapsed-(lastCombatCue.get(type)??-99)<.06)return;
    lastCombatCue.set(type,elapsed);
    if(playSample(combatSamples[type]||[],point,['slam','charge','volley'].includes(type)?.65:.42,type==='bow'?1.7:1,['slam','charge','volley','dodge'].includes(type)?3:1))return;
    const s=combatSounds[type];if(s)tone(s[0],s[3],s[2],.025,s[1]);
  }
  function tone(freq, duration = .1, type = 'sine', volume = .035, endFreq = freq,bus='fx') {
    if (!soundOn || !audio || activeVoices>=12) return;
    const o = audio.createOscillator(), g = audio.createGain(); o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), audio.currentTime + duration);
    g.gain.setValueAtTime(volume, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    o.connect(g);g.connect(bus==='music'?musicBus:effectsBus);trackVoice(o,g,null,bus==='music'?0:1);o.start();o.stop(audio.currentTime+duration);
  }
  function move(entity, dx, dy, dt, speed) {
    const len = Math.hypot(dx, dy); entity.moving = len > .05;
    if (!entity.moving) return;
    translateEntity(entity, dx / len * speed * dt, dy / len * speed * dt);
    const committed=entity===hero?entity.attack>0&&heroAttackAge()<SWING.end:entity.attack>0;
    if (Math.abs(dx) > .1 && !committed && !(entity.stagger > 0)) entity.facing = dx > 0 ? 1 : -1;
    for (const o of obstacleList) {
      const vx = entity.x - o.x, vy = entity.y - o.y, d = Math.hypot(vx, vy), min = o.radius + 10;
      if (d < min && d > .01) {
        const px = o.x + vx / d * min, py = o.y + vy / d * min;
        translateEntity(entity, px - entity.x, py - entity.y);
      }
    }
  }
  function steerMove(entity, target, dt, speed = entity.speed) {
    entity.progressTimer = (entity.progressTimer || 0) - dt;
    if(entity.progressTimer<=0){
      const previousStall=entity.stallSeconds||0;
      entity.stallSeconds = entity.progressPosition && dist(entity,entity.progressPosition)<6 && dist(entity,target)>40 ? previousStall+1 : 0;
      if(entity.stallSeconds>0&&!previousStall)combatStats.stalls++;
      entity.progressPosition = {x:entity.x,y:entity.y};entity.progressTimer=1;
      if(entity.stallSeconds>0)entity.routeTimer=0;
    }
    entity.routeTimer = (entity.routeTimer || 0) - dt;
    if (!clearPath(entity, target)) {
      if (entity.routeTimer <= 0 || !entity.routeTarget || dist(entity.routeTarget, target) > 64) {
        entity.route = routeTo(entity, target); entity.routeTimer = .9; entity.routeTarget = { ...target };
      }
      const path = entity.route || [];
      while (path.length && dist(entity, path[0]) < 12) path.shift();
      while (path.length > 1 && clearPath(entity, path[1])) path.shift();
      if (path.length) { navigateStep(entity,path[0].x-entity.x,path[0].y-entity.y,dt,speed); entity.blockedSeconds = 0; return; }
      entity.blockedSeconds = (entity.blockedSeconds || 0) + dt;if(entity.blockedSeconds>1)combatStats.blockedSeconds+=dt; entity.moving = false; return;
    } else { entity.route = []; entity.blockedSeconds = 0; }
    let dx = target.x - entity.x, dy = target.y - entity.y;
    const distance = Math.hypot(dx, dy); if (distance < 3) { entity.moving = false; return; }
    dx /= distance; dy /= distance;
    for (const o of obstacleList) {
      const ox = entity.x - o.x, oy = entity.y - o.y, d = Math.hypot(ox, oy);
      if (d < o.radius + 45 && d > .1) {
        const force = (o.radius + 45 - d) / 45, side = entity.flankSign || 1;
        dx += (ox / d * 2.3 - oy / d * side * .9) * force;
        dy += (oy / d * 2.3 + ox / d * side * .9) * force;
      }
    }
    navigateStep(entity,dx,dy,dt,speed);
  }
  function navigateStep(u,dx,dy,dt,speed){
    const length=Math.hypot(dx,dy);if(length<.001){u.moving=false;return;}
    dx/=length;dy/=length;
    // A shared right-hand passing rule avoids opposite steering decisions each frame.
    if(u!==hero&&!u.entering){
      let blocker=null,nearest=38*38;
      for(const other of combatUnits){if(other===u||other.hp<=0||other.entering)continue;
        const ox=other.x-u.x,oy=other.y-u.y,d2=ox*ox+oy*oy;
        if(d2<nearest&&ox*dx+oy*dy>0){nearest=d2;blocker=other;}
      }
      if(blocker){
        const strength=(38-Math.sqrt(nearest))/38*1.4,px=-dy,py=dx;
        const side=positionFits(u.x+(dx+px)*10,u.y+(dy+py)*10)?1:-1;
        dx+=px*strength*side;dy+=py*strength*side;
      }
    }
    move(u,dx,dy,dt,speed);
  }
  function updateReaction(entity, dt) {
    entity.impactHold=Math.max(0,(entity.impactHold||0)-dt);
    entity.damageCue=Math.max(0,(entity.damageCue||0)-dt);entity.dodgeCue=Math.max(0,(entity.dodgeCue||0)-dt);entity.missCue=Math.max(0,(entity.missCue||0)-dt);
    entity.hitFlash = Math.max(0, (entity.hitFlash || 0) - dt);
    entity.stagger = Math.max(0, (entity.stagger || 0) - dt);
    if (Math.hypot(entity.knockX || 0, entity.knockY || 0) > 5) {
      const speed = Math.hypot(entity.knockX, entity.knockY);
      const facing = entity.facing;
      move(entity, entity.knockX, entity.knockY, dt, speed);
      entity.facing = facing;
      const decay = Math.exp(-19 * dt); entity.knockX *= decay; entity.knockY *= decay;
    }
  }

  function startGame(seed) {
    if (!initialized) return;
    runSeed=Number.isInteger(seed)?seed>>>0:Math.floor(Math.random()*4294967296)>>>0;encounters=makeEncounters(runSeed);
    gameRandom=seededRandom(runSeed);
    for(const voice of [...soundVoices]){voice.source.stop();voice.finish();}
    resetCombatStats();combatId=0;pressureActive=0;pressureGap=0;rangedPressureGap=0;approachSlots.clear();engagements.clear();combatUnits.length=0;collectingHeroDamage=false;pendingHeroDamage=null;lastCombatCue.clear();
    Object.assign(hero,{impactHold:0,damageCue:0,dodgeCue:0,missCue:0,lastDamageTime:-99,stepTimer:0,swingFacing:1,swingEmpowered:false,labelSlot:0,markerLayout:null});
    Object.assign(hero, { x: 788, y: 370, hp: 100, facing: 1, attack: 0, cooldown: 0, invuln: 0, moving: false, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
    simulationAccumulator = 0; pausedForDialog = false;toastTimer=0;$('toast').classList.remove('show');
    squadOrder='follow';boss=null;bossSpawned=false;orderPulse=0;$('squadBar').hidden=false;
    hero.maxHp=100;castle.maxHp=500;campPurchase=-1;for(const id in ranks)ranks[id]=0;dashTrail=[];
    Object.assign(hero,{dash:0,dashCooldown:0,dashElapsed:0,riposte:0,dashPerfect:false,lastMoveX:1,lastMoveY:0});
    hero.work = null; hero.healCooldown = 0; hero.animTime = 0; hero.animState = 'Idle';
    castle.hp = 500; castle.hitFlash = 0; gold = 80; wood = 40; food = 3; score = 0; kills = 0; recruitIndex = 0;
    enemies = []; allies = []; effects = []; floaters = []; drops = []; projectiles = []; impacts = []; damageDealt = 0; damageTaken = 0;
    for (const s of sheep) s.cooldown = 0;
    phase = 'prepare'; waveIndex = 0; waveTimer = 22; spawned = 0; spawnTimer = 0; elapsed = 0; passiveTimer = 0; gatherCooldown = 0; shake = 0;
    clearCombatInput(); state = 'playing';
    $('startScreen').hidden = true; $('pauseScreen').hidden = true; $('endScreen').hidden = true;
    $('wavePanel').hidden = false; $('scorePanel').hidden = false; $('worldCaption').hidden = true;
    $('dashButton').hidden = false; $('battleStatus').hidden = false; document.body.classList.add('is-playing'); $('gameShell').classList.remove('player-hit');
    $('mobileControls').hidden = !matchMedia('(pointer:coarse)').matches;
    $('pauseButton').textContent = 'Ⅱ'; $('pauseButton').setAttribute('aria-label', 'Jeda permainan');
    recruitUnit(true); updateUI(); resize(); canvas.focus({ preventScroll: true });
    announce('Selamat datang, Penjaga.', 'KUMPULKAN BEKAL · SIAPKAN PASUKAN');
    tone(392, .2); tone(523, .3, 'sine', .025);
  }
  function startWave() {
    phase = 'battle'; spawned = 0; spawnTimer = .3;
    const w = waves[waveIndex];
    announce(`Gelombang ${waveIndex + 1}`, (encounters[waveIndex]?.name||w.name).toUpperCase());
    tone(220, .25, 'triangle', .04, 330);
  }
  function finishWave() {
    const reward = 30 + waveIndex * 10;
    gold += reward; wood += 15; food += 1; score += 150 + waveIndex * 50;
    hero.hp = Math.min(hero.maxHp, hero.hp + 25);
    if (waveIndex === waves.length - 1) { finish(true); return; }
    waveIndex++; phase = 'prepare'; waveTimer = 15;
    announce('Gelombang ditaklukkan!', `+${reward} EMAS · +15 KAYU · +1 BEKAL`);
    tone(523, .2); setTimeout(() => tone(659, .3), 160);
  }
  function finish(won) {
    state = won ? 'won' : 'lost'; clearCombatInput();
    $('announcement').classList.remove('show'); $('interactionHint').hidden = true; $('mobileControls').hidden = true;
    if (won) score += Math.round(castle.hp * 2 + hero.hp * 3);
    score=Math.round(score*settings().score);
    if (score > best) { best = score; try { localStorage.setItem('penjaga-pulau-best-'+difficulty, String(best)); } catch {} }
    $('bestScore').textContent = String(best).padStart(4, '0');
    $('resultEyebrow').textContent = won ? 'KERAJAAN TETAP BERDIRI' : 'SETIAP PENJAGA PERNAH TERJATUH';
    $('resultIcon').textContent = won ? '♜' : '⚔';
    $('resultTitle').textContent = won ? 'Pulau terselamatkan!' : 'Kita coba sekali lagi.';
    $('resultDescription').textContent = won ? `Panglima Kelam ditaklukkan pada mode ${settings().name}. Rumah ini masih milik kita.` : castle.hp <= 0 ? 'Kastel telah runtuh. Rekrut pasukan dan sisakan kayu untuk perbaikan.' : 'Sang penjaga kehabisan tenaga. Gunakan bekal dan tetap dekat sekutu.';
    $('finalScore').textContent = score; $('finalKills').textContent = kills; $('finalWave').textContent = `${waveIndex + 1} / 5`;
    $('runLabel').textContent=`Ekspedisi ${runSeed.toString(36).toUpperCase().padStart(6,'0')} · ${settings().name}`;
    $('endScreen').hidden = false; $('restartButton').focus({ preventScroll: true }); updateUI();
    tone(won ? 659 : 196, .7, 'triangle', .04, won ? 880 : 98);
  }
  function spawnEnemy() {
    const w = waves[waveIndex],plan=encounters[waveIndex],kind=plan?.roster[spawned%w.count]||w.types[spawned%w.types.length];
    const lane = plan?.spawnLanes?.[spawned]??(plan?.lanes||[-1,0,1,-2,2])[spawned % 5];
    const entry = { x: roadEntry.x + rand(-3, 3), y: roadEntry.y + lane * 7 };
    const baseHp = ({ Warrior: 62, Archer: 43, Lancer: 82, Monk: 48, Pawn: 38 }[kind]) + waveIndex * 9;
    const hp=Math.round(baseHp*settings().hp);
    enemies.push({ combatId:++combatId, x: entry.x, y: entry.y, kind, color: waveIndex === 4 ? ['Red', 'Purple', 'Yellow', 'Black'][spawned % 4] : w.color, hp, maxHp: hp, facing: 1, moving: false, attack: 0, cooldown: rand(.1, .6), seed: rand(0, 10), speed: kind === 'Lancer' ? 59 : kind === 'Pawn' ? 75 : 66, team: 'enemy', entering: true, lane, flankAngle: spawned * 2.399963 + waveIndex * .8, flankSign: spawned % 2 ? -1 : 1, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
    addEffect('Particle FX/Dust_02.png', entry.x, entry.y, 48); spawned++;
    const enemy = enemies[enemies.length - 1]; enemy.speed = (enemy.speed+waveIndex*5)*settings().speed; enemy.chargeCooldown = 2; enemy.charge = 0;
  }
  function recruitUnit(free = false) {
    if (state !== 'playing') return;
    const kind = ['Archer', 'Lancer', 'Monk', 'Warrior'][recruitIndex % 4];
    const cost = kind === 'Monk' ? 55 : 40;
    if (!free && allies.length >= 8) { notify('Pasukan lengkap: maksimal 8 sekutu.'); return; }
    if (!free && gold < cost) { notify(`Butuh ${cost} emas. Kumpulkan di tambang atau kalahkan musuh.`); return; }
    if (!free) gold -= cost;
    const hp = kind === 'Lancer' ? 130 : kind === 'Monk' ? 90 : 100;
    const occupied=new Set(allies.filter(u=>u.hp>0).map(u=>u.formationSlot));let formationSlot=0;while(occupied.has(formationSlot))formationSlot++;
    allies.push({ combatId:++combatId, formationSlot, x: 885 + rand(-15, 15), y: 355 + rand(-10, 10), homeX: 720 + rand(0, 120), homeY: 325 + rand(0, 100), kind, color: 'Blue', hp, maxHp: hp, facing: -1, moving: false, attack: 0, cooldown: .2, seed: rand(0, 10), speed: 88, team: 'ally', flankSign: recruitIndex % 2 ? 1 : -1, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
    recruitIndex++; if (!free) { notify(`${{ Archer: 'Pemanah', Lancer: 'Penombak', Monk: 'Biarawan', Warrior: 'Ksatria' }[kind]} bergabung! (${allies.length}/8 sekutu)`); tone(440, .15, 'triangle'); }
    addEffect('Particle FX/Dust_01.png', 885, 355, 65); updateUI();
  }
  function repairCastle() {
    if (state !== 'playing') return;
    if (castle.hp >= castle.maxHp) { notify('Kastel masih dalam kondisi sempurna.'); return; }
    if (wood < 30) { notify('Butuh 30 kayu. Dekati pohon lalu tahan E.'); return; }
    wood -= 30; castle.hp = Math.min(castle.maxHp, castle.hp + 140); score += 15;
    addEffect(blue('Monk', 'Heal_Effect'), castle.x, castle.y, 220, .8); float('+140', castle.x, castle.y - 70, '#d0efa8', true);
    notify('Kastel diperbaiki. Pertahankan rumahmu!'); tone(330, .2, 'triangle', .03, 550); updateUI();
  }
  function healHero() {
    if (state !== 'playing') return;
    if (hero.healCooldown > 0) return;
    if (hero.hp >= hero.maxHp) { notify('Tenagamu masih penuh.'); return; }
    if (food < 1) { notify('Bekal habis. Dekati domba lalu tekan E.'); return; }
    const restored = Math.min(45+5*ranks.oath, hero.maxHp - hero.hp);combatStats.oathHealing+=Math.max(0,restored-45);
    hero.work = null;
    food--; hero.healCooldown = 1.8; hero.hp += restored; float(`+${Math.ceil(restored)}`, hero.x, hero.y, '#c6eea1', true);
    addEffect(blue('Monk', 'Heal_Effect'), hero.x, hero.y, 140, .8); tone(587, .25); updateUI();
  }
  function nearestResource() {
    let closest = null, distance = 85;
    for (const node of [...trees.filter(t => t.resource).map(t => ({ ...t, type: 'wood', name: 'Tebang kayu +8' })), ...goldNodes.map(n => ({ ...n, type: 'gold', name: 'Tambang emas +10' })), ...sheep.filter(s => s.cooldown <= 0).map(s => ({ ...s, type: 'food', name: 'Ambil bekal +1', original: s }))]) {
      const d = dist(hero, node); if (d < distance) { distance = d; closest = node; }
    }
    return closest;
  }
  function gather() {
    if (state !== 'playing' || gatherCooldown > 0 || hero.work || hero.attack > 0 || hero.stagger > 0 || hero.moving || hero.dash>0) return;
    const node = nearestResource(); if (!node) return;
    hero.work = { node, elapsed: 0, duration: node.type === 'food' ? .7 : .9 };
    hero.facing = node.x < hero.x ? -1 : 1; hero.moving = false;
  }
  function updateWork(dt) {
    const work = hero.work; if (!work) return;
    if (dist(hero, work.node) > 88 || hero.stagger > 0) { hero.work = null; return; }
    const previousTime = work.elapsed;
    work.elapsed += dt;
    if (previousTime < work.duration * .55 && work.elapsed >= work.duration * .55) {
      addEffect('Particle FX/Dust_01.png', work.node.x, work.node.y - 8, 45, .4);
      combatCue(work.node.type==='gold'?'stone':'wood',work.node);
    }
    if (work.elapsed < work.duration) return;
    const node = work.node; hero.work = null; gatherCooldown = .18;
    if (node.type === 'food' && node.original.cooldown > 0) return;
    if (node.type === 'wood') { wood += 8; float('+8 kayu', node.x, node.y); }
    if (node.type === 'gold') { gold += 500; float('+10 emas', node.x, node.y); }
    if (node.type === 'food') { food++; node.original.cooldown = 12; float('+1 bekal', node.x, node.y); }
    score += 5; addEffect('Particle FX/Dust_01.png', node.x, node.y - 10, 55); tone(node.type === 'gold' ? 740 : 300, .08, 'triangle', .025); updateUI();
  }

  function hurt(target, amount, source) {
    if(target===hero&&hero.dash>0&&hero.dashElapsed<=.16){
      if(!hero.dashPerfect&&hero.invuln<=0){hero.dashPerfect=true;hero.riposte=2+ranks.counter*.5;hero.dodgeCue=.35;float('ELAK SEMPURNA',hero.x,hero.y-30,'#b5f5e4',true);combatCue('dodge');}
      return;
    }
    if (target.hp <= 0 || (target === hero && hero.invuln > 0)) return;
    if(target===hero&&collectingHeroDamage){
      if(pendingHeroDamage)combatStats.mergedHits++;
      if(!pendingHeroDamage||amount>pendingHeroDamage.amount||amount===pendingHeroDamage.amount&&damagePriority(source)<damagePriority(pendingHeroDamage.source))pendingHeroDamage={amount,source};
      return;
    }
    if(target===hero&&ranks.bastion>0&&castle.hp>0&&dist(hero,castle)<=fortressRadius()){const guarded=Math.max(1,amount-ranks.bastion*2);combatStats.fortressSaved+=amount-guarded;amount=guarded;}
    if(target.isBoss){
      const open=target.bossAction?.stage==='recovery';
      if(source?.team==='ally')amount=Math.max(1,Math.round(amount*(open?1:.55)));
      else if(source===hero&&open)amount=Math.max(1,Math.round(amount*1.3));
    }
    const appliedDamage = Math.min(target.hp, amount);
    if(target.team==='ally'&&source?.isBoss)combatStats.allyHazardHits++;
    if (source === hero && target.team === 'enemy') damageDealt += appliedDamage;
    if (target === hero) damageTaken += appliedDamage;
    if(target===hero){
      combatStats.damageTaken+=appliedDamage;
      const key=source?.isBoss?'boss':source?.kind||'unknown';
      combatStats.damageBySource[key]=(combatStats.damageBySource[key]||0)+appliedDamage;
    }
    target.hp -= amount;
    target.lastDamageTime=elapsed;
    target.hitFlash = .18;
    const angle = source ? Math.atan2(target.y - source.y, target.x - source.x) : rand(0, Math.PI * 2);
    if(impacts.length>=60)impacts.shift();
    impacts.push({ x: target.x, y: target.y - (target === castle ? 40 : 27), angle, color: target === hero || target.team === 'ally' ? '#ff977d' : '#ffdb86', life: .3, duration: .3, prominent:target===hero||source===hero||target===castle });
    floatDamage(target,appliedDamage,source);
    if (target === hero) {
      hero.invuln = .45;hero.damageDirection=angle;hero.damageCue=.35; shake = Math.max(shake, 3); $('gameShell').classList.add('player-hit');combatCue('hurt');
    } else if (target === castle) { playSample(['impactWood_heavy_000.ogg'],castle,.55,.85,2);shake = Math.max(shake, 2); addEffect('Particle FX/Explosion_02.png', castle.x + rand(-45, 45), castle.y - 20, 65, .35, 24); }
    else if (source === hero) { shake = Math.max(shake, 1.5);if(!hero.strike||hero.strike.hits.size===1)combatCue('hit',target); }
    if(target!==castle&&!target.isBoss)holdImpactPose(target);
    if (target !== castle && !target.isBoss) {
      if (target === hero) {cancelHeroSwing(true);hero.work = null;hero.attackBuffer=0;hero.dashBuffer=0;}
      const force = target.kind === 'Lancer' ? 140 : target === hero ? 195 : 255;
      target.knockX = Math.cos(angle) * force; target.knockY = Math.sin(angle) * force;
      target.stagger = target === hero ? .09 : .12;
      target.strike = null;
      target.attack = 0;
    }
    if (target.hp <= 0 && target.team === 'enemy' && !target.dead) {
      releaseApproach(target);approachSlots.delete(target);
      target.dead = true; kills++; score += target.isBoss?500:25 + waveIndex * 5; gold += target.isBoss?50:6;
      addEffect('Particle FX/Explosion_01.png', target.x, target.y - 9, source===hero?70:45,source===hero?.45:.3);
      drops.push({ x: target.x, y: target.y, type: gameRandom() > .7 ? 'wood' : 'gold', life: 18, value: 5 });
      tone(320, .075, 'triangle', .02, 540);
    } else if (target.hp <= 0 && target.team === 'ally' && !target.dead) { releaseApproach(target);approachSlots.delete(target);target.dead = true; addEffect('Particle FX/Dust_02.png', target.x, target.y, 70); }
    target.hp = Math.max(0, target.hp);
  }
  function heroAttack() {
    if (state !== 'playing' || hero.cooldown > 0 || hero.stagger > 0 || hero.dash > 0) return;
    hero.attackBuffer = 0;
    hero.work = null;
    hero.cooldown=HERO_ATTACK.cooldown*(1-ranks.rhythm*.06);
    hero.attack=hero.attackDuration=Math.min(HERO_ATTACK.duration,hero.cooldown);
    const direction=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    if(direction)hero.facing=direction>0?1:-1;
    const target=heroAttackTarget();
    if(target)hero.facing=target.x<hero.x?-1:1;
    hero.swingFacing=hero.facing;hero.swingEmpowered=hero.riposte>0;hero.missCue=0;
    hero.strike = { elapsed:0, facing:hero.facing, target, hits:new Set(),counterBonus:hero.riposte>0?12+ranks.counter*6:0 };
    combatStats.swings++;
    tone(380, .1, 'triangle', .018, 110);
  }
  function heroAttackTarget(){
    let target=null,cost=Infinity;
    for(const e of enemies){
      if(e.hp<=0)continue;
      const facing=e.x<hero.x?-1:1,d=dist(hero,e),score=d+(facing===hero.facing?0:12);
      if(d>SWING.reach+SWING.radius||score>=cost||!swingContact({facing},e,SWING.start,SWING.end))continue;
      target=e;cost=score;
    }
    return target;
  }
  function cancelHeroSwing(interrupted){
    if(hero.strike){combatStats[interrupted?'interruptions':'cancels']++;hero.strike=null;}
    hero.swingEmpowered=false;hero.missCue=0;
  }
  function holdImpactPose(u){
    u.impactAge=u.attack>0?(u.attackDuration||.4)-u.attack:(u.animTime||0);u.impactHold=.035;
  }
  function damagePriority(source){return (source?.isBoss?-100000:0)+(source?.combatId||0);}
  function beginDamageStep(){collectingHeroDamage=true;pendingHeroDamage=null;}
  function resolveHeroDamage(){
    collectingHeroDamage=false;
    const hit=pendingHeroDamage;pendingHeroDamage=null;
    if(hit)hurt(hero,hit.amount,hit.source);
  }
  function swingContact(strike,target,previous,current){
    const dx=(target.x-hero.x)*strike.facing,dy=target.y-hero.y,d2=dx*dx+dy*dy;
    if(dx < -12||d2>(SWING.reach+SWING.radius)**2)return false;
    const angle=Math.atan2(dy,dx),padding=Math.asin(Math.min(1,SWING.radius/Math.max(1,Math.sqrt(d2))));
    const from=swingAngle(previous),to=swingAngle(current);
    return angle+padding>=from&&angle-padding<=to&&clearPath(hero,target);
  }
  function updateHeroSwing(dt){
    const s=hero.strike;if(!s)return;
    const previous=s.elapsed;s.elapsed+=dt;
    if(s.elapsed>=SWING.start&&previous<=SWING.end&&s.hits.size<SWING.cap){
      // At most three contacts; sorting is bounded by the 21-enemy encounter cap.
      const contacts=enemies.filter(e=>e.hp>0&&!s.hits.has(e)&&swingContact(s,e,previous,s.elapsed));
      contacts.sort((a,b)=>(a===s.target?-1:b===s.target?1:dist(hero,a)-dist(hero,b)));
      for(const target of contacts){
        if(s.hits.size>=SWING.cap)break;
        const primary=s.hits.size===0,bonus=primary?s.counterBonus||0:0;
        s.hits.add(target);combatStats.hits++;
        hurt(target,primary?27+ranks.blade*5+bonus:18+ranks.blade*3,hero);
        if(bonus){hero.riposte=0;float('BALASAN!',hero.x,hero.y-25,'#f8d68b',true);}
      }
    }
    if(s.elapsed>=SWING.end){
      if(!s.hits.size){combatStats.misses++;hero.missCue=.18;combatCue('miss');}
      hero.strike=null;
    }
  }
  function fireArrow(u, target) {
    combatCue('bow',u);
    const origin={x:u.x,y:u.y-5},d=Math.max(1,dist(origin,target));
    projectiles.push({ ...origin, vx: (target.x - origin.x) / d * 360, vy: (target.y - origin.y) / d * 360, color: u.color, team: u.team, target, source: u, damage: u.team === 'ally' ? 17 : Math.round((10 + waveIndex * 2)*settings().damage), life: 1.4 });
  }
  function nearest(entity, candidates, limit = Infinity) {
    let target = null;
    for (const other of candidates) { if (other.hp <= 0) continue; const d = dist(entity, other); if (d < limit) { limit = d; target = other; } }
    return target;
  }
  function requestAttack() {
    if(state!=='playing')return;
    $('interactionHint').hidden=true;
    if(hero.work){hero.work=null;gatherCooldown=Math.max(gatherCooldown,.18);}
    hero.attackBuffer=.14;
    if(hero.cooldown>0)combatStats.bufferedInputs++;
    heroAttack();
  }
  function shotClear(source,target) {
    const origin={x:source.x,y:source.y-5};
    const hit=segmentHit(origin,target,target,target===castle?57:20);
    return obstacleList.every(o=>dist(source,o)<o.radius+10||segmentHit(origin,target,o,o.radius+2)>hit);
  }
  function combatTarget(u,candidates,limit) {
    let best=null,bestCost=Infinity,bestVisible=null,visibleCost=Infinity,currentCost=Infinity,currentVisible=false;
    for(const target of candidates){
      const d=dist(u,target);if(target.hp<=0||d>=limit)continue;
      let bias=0;
      if(u.team){
        if(u.kind==='Archer')bias=target.kind==='Monk'?-28:target.kind==='Archer'?-14:0;
        else if(u.kind==='Warrior')bias=['Monk','Archer'].includes(target.kind)?-22:0;
        else if(u.kind==='Lancer')bias=target.strike?.target?.team===u.team?-40:['Warrior','Pawn'].includes(target.kind)?-18:0;
        if(target===u.protectTarget)bias-=55;
        else bias+=Math.max(0,(engagements.get(target)||0)-(u.combatTarget===target?1:0))*16;
      }
      const cost=Math.max(1,d+bias),visible=u.kind!=='Archer'||shotClear(u,target);
      if(cost<bestCost){best=target;bestCost=cost;}
      if(visible&&cost<visibleCost){bestVisible=target;visibleCost=cost;}
      if(target===u.combatTarget){currentCost=cost;currentVisible=visible;}
    }
    const chosen=bestVisible||best,cost=bestVisible?visibleCost:bestCost;
    if(!u.combatTarget||currentCost===Infinity||currentCost>cost*1.25+12||bestVisible&&!currentVisible){
      if(u.combatTarget)engagements.set(u.combatTarget,Math.max(0,(engagements.get(u.combatTarget)||0)-1));
      u.combatTarget=chosen;if(chosen)engagements.set(chosen,(engagements.get(chosen)||0)+1);
    }
    return u.combatTarget;
  }
  function updateRole(u,dt){
    u.roleThink=(u.roleThink||0)-dt;if(u.roleThink>0)return;
    u.roleThink=.22+(u.combatId%3)*.025;u.protectTarget=null;
    if(!['Warrior','Lancer'].includes(u.kind))return;
    const friends=u.team==='ally'?allies:enemies,opponents=u.team==='ally'?enemies:[hero,...allies];
    let closest=Infinity;
    for(const f of friends)if(f.hp>0&&['Archer','Monk'].includes(f.kind)&&dist(u,f)<150){
      for(const t of opponents)if(t.hp>0&&dist(t,f)<95&&dist(u,t)<210){const d=dist(t,f);if(d<closest){closest=d;u.protectTarget=t;}}
    }
  }
  function bossDangerAt(point,padding=14){
    const a=boss?.hp>0?boss.bossAction:null;if(!a||!['warning','charge'].includes(a.stage))return false;
    if(a.type==='slam')return dist(point,a.target)<105+padding;
    if(a.type==='charge')return Number.isFinite(segmentHit(a.origin,a.chargeEnd,point,36+padding));
    const angle=Math.atan2(a.dy,a.dx);
    for(const offset of [-.22,0,.22])if(Number.isFinite(segmentHit(a.origin,{x:a.origin.x+Math.cos(angle+offset)*500,y:a.origin.y+Math.sin(angle+offset)*500},point,20+padding)))return true;
    return false;
  }
  function evadeBoss(u,dt){
    if(u.team!=='ally')return false;
    const a=boss?.hp>0?boss.bossAction:null;
    if(!a||!['warning','charge'].includes(a.stage)){u.evadeAction=null;u.evadeGoal=null;return false;}
    if(u.evadeAction!==a){u.evadeAction=a;u.evadeDelay=.1+(u.combatId%3)*.035;u.evadeGoal=null;u.evadeThink=0;u.evadedThisAction=false;}
    u.evadeDelay-=dt;if(u.evadeDelay>0)return false;
    const dangerous=bossDangerAt(u);
    if(!dangerous){
      u.evadeGoal=null;
      if(u.evadedThisAction&&!['Archer','Monk'].includes(u.kind)){u.moving=false;return true;}
      return false;
    }
    u.evadeThink=(u.evadeThink||0)-dt;
    let needsGoal=!u.evadeGoal;
    if(u.evadeThink<=0){u.evadeThink=.18;if(u.evadeGoal&&(!positionFits(u.evadeGoal.x,u.evadeGoal.y)||bossDangerAt(u.evadeGoal,22)||!clearPath(u,u.evadeGoal)))needsGoal=true;}
    if(needsGoal){
      let best=null,cost=Infinity;const anchor=squadAnchor(),leash=squadOrder==='guard'?235:320;
      for(const radius of [48,88,128,164])for(const v of approachOffsets){
        const p={x:u.x+v.x*radius,y:u.y+v.y*radius};
        if(bossDangerAt(p,22)||dist(p,anchor)>leash||!positionFits(p.x,p.y)||!clearPath(u,p))continue;
        const score=radius+dist(p,anchor)*.04;if(score<cost){cost=score;best=p;}
      }
      if(best&&!u.evadedThisAction){combatStats.allyEvades++;u.evadedThisAction=true;}
      u.evadeGoal=best;u.evadeThink=.18;
    }
    if(!u.evadeGoal)return false;
    u.strike=null;u.attack=0;releaseApproach(u);steerMove(u,u.evadeGoal,dt,u.speed*1.4);return true;
  }
  function tacticalRetreat(u,target,distance=76){
    const angle=Math.atan2(u.y-target.y,u.x-target.x),anchor=squadAnchor(),leash=squadOrder==='guard'?235:320;
    let best=null,score=-Infinity;
    for(const radius of [distance,distance*.5])for(const offset of [0,.65,-.65,1.25,-1.25,Math.PI/2,-Math.PI/2]){
      const p={x:u.x+Math.cos(angle+offset)*radius,y:u.y+Math.sin(angle+offset)*radius};
      if(!positionFits(p.x,p.y)||!clearPath(u,p)||u.team==='ally'&&(dist(p,anchor)>leash||bossDangerAt(p)))continue;
      const visible=shotClear(p,target),cover=u.kind==='Monk'?(visible?0:55):(visible?35:0);
      const value=dist(p,target)+cover-Math.abs(offset)*8;
      if(value>score){score=value;best=p;}
    }
    return best;
  }
  function evadeProjectile(u,dt){
    if(!['Archer','Monk'].includes(u.kind))return false;
    u.arrowThink=(u.arrowThink||0)-dt;u.arrowEvade=Math.max(0,(u.arrowEvade||0)-dt);
    if(u.arrowThink<=0){
      u.arrowThink=.12+(u.combatId%3)*.02;
      let incoming=null,soonest=Infinity;
      for(const p of projectiles){
        if(p.life<=0||p.team===u.team||dist(p,u)>140)continue;
        const end={x:p.x+p.vx*.35,y:p.y+p.vy*.35},time=segmentHit(p,end,u,23);
        if(time<soonest){incoming=p;soonest=time;}
      }
      if(incoming){
        const length=Math.hypot(incoming.vx,incoming.vy),px=-incoming.vy/length,py=incoming.vx/length;
        let goal=null,cost=Infinity;
        for(const side of [-1,1]){
          const p={x:u.x+px*side*44,y:u.y+py*side*44};
          if(!positionFits(p.x,p.y)||!clearPath(u,p)||u.team==='ally'&&(dist(p,squadAnchor())>(squadOrder==='guard'?235:320)||bossDangerAt(p)))continue;
          const score=dist(p,squadAnchor());if(score<cost){goal=p;cost=score;}
        }
        if(goal){u.arrowGoal=goal;u.arrowEvade=.3;u.strike=null;u.attack=0;}
      }
    }
    if(u.arrowEvade>0&&u.arrowGoal){steerMove(u,u.arrowGoal,dt,u.speed*1.1);return true;}
    return false;
  }
  function firingPosition(u,target){
    const angle=Math.atan2(u.y-target.y,u.x-target.x),anchor=squadAnchor(),leash=squadOrder==='guard'?235:320;
    let best=null,cost=Infinity;
    for(const offset of [0,.55,-.55,1.1,-1.1]){
      const p={x:target.x+Math.cos(angle+offset)*185,y:target.y+Math.sin(angle+offset)*185};
      if(!positionFits(p.x,p.y)||!shotClear(p,target)||u.team==='ally'&&(dist(p,anchor)>leash||bossDangerAt(p)))continue;
      const score=dist(u,p)+(clearPath(u,p)?0:90);if(score<cost){cost=score;best=p;}
    }
    return best;
  }
  function releaseApproach(u){
    const slots=approachSlots.get(u.approachTarget);
    if(slots?.[u.approachSlot]===u)slots[u.approachSlot]=null;
    u.approachTarget=null;u.approachSlot=-1;
  }
  function approachPoint(u,target,range){
    const radius=Math.min(68,range*.78);
    let slots=approachSlots.get(target);
    if(!slots){slots=Array(8).fill(null);approachSlots.set(target,slots);}
    if(u.approachTarget!==target){releaseApproach(u);u.approachTarget=target;u.approachThink=0;}
    if((u.approachThink||0)<=0||u.approachSlot<0){
      let best=-1,cost=Infinity;
      for(let i=0;i<8;i++){
        if(slots[i]&&slots[i].hp<=0)slots[i]=null;
        if(slots[i]&&slots[i]!==u)continue;
        const p=approachOffsets[i],x=target.x+p.x*radius,y=target.y+p.y*radius;
        if(!positionFits(x,y))continue;
        const score=(x-u.x)**2+(y-u.y)**2-(i===u.approachSlot?400:0);
        if(score<cost){best=i;cost=score;}
      }
      if(best>=0){if(slots[u.approachSlot]===u)slots[u.approachSlot]=null;u.approachSlot=best;slots[best]=u;}
      u.approachThink=.3;
    }
    const p=approachOffsets[u.approachSlot];
    return p?{x:target.x+p.x*radius,y:target.y+p.y*radius}:target;
  }
  function mayStartMelee(u,target){
    if(u.team!=='enemy'||target!==hero)return true;
    if(u.kind==='Archer'){
      const bossThreat=boss?.hp>0&&['warning','charge'].includes(boss.bossAction?.stage);
      const limit=Math.max(1,(difficulty==='easy'?1:difficulty==='hard'?3:2)-(bossThreat?1:0));
      let active=0;for(const e of enemies)if(e!==u&&e.hp>0&&e.kind==='Archer'&&e.strike?.target===hero)active++;
      if(active>=limit||rangedPressureGap>0){combatStats.rangedDeferrals++;return false;}
      rangedPressureGap=difficulty==='hard'?.1:.16;combatStats.maxRangedWindups=Math.max(combatStats.maxRangedWindups,active+1);return true;
    }
    let limit=difficulty==='easy'?2:difficulty==='hard'?4:3;
    if(boss?.hp>0&&boss.bossAction?.stage==='recovery'&&dist(hero,boss)<160)limit=difficulty==='hard'?2:1;
    if(pressureActive>=limit||pressureGap>0){combatStats.pressureDeferrals++;return false;}
    pressureActive++;pressureGap=difficulty==='hard'?.08:.12;
    combatStats.maxWindups=Math.max(combatStats.maxWindups,pressureActive);return true;
  }
  function separateCombatUnits(dt){
    for(let i=0;i<combatUnits.length;i++)for(let j=i+1;j<combatUnits.length;j++){
      const a=combatUnits[i],b=combatUnits[j];if(a.hp<=0||b.hp<=0||a.entering||b.entering)continue;
      const dx=a.x-b.x,dy=a.y-b.y,min=a.team===b.team?31:26,d2=dx*dx+dy*dy;
      if(d2>=min*min)continue;
      const d=Math.sqrt(d2),angle=(a.combatId||i)+(b.combatId||j)*2.399963;
      const force=(min-d)*Math.min(.25,dt*5),px=(d>.01?dx/d:Math.cos(angle))*force,py=(d>.01?dy/d:Math.sin(angle))*force;
      if(!a.isBoss)translateEntity(a,px*(b.isBoss?2:1),py*(b.isBoss?2:1));
      if(!b.isBoss)translateEntity(b,-px*(a.isBoss?2:1),-py*(a.isBoss?2:1));
    }
  }
  function healingTarget(u,friends){
    let best=null,bestScore=-Infinity,ready=null,readyScore=-Infinity;
    for(const f of friends){
      if(f===u||f.hp<=0||f.hp>=f.maxHp)continue;
      if(u.team==='ally'&&dist(f,squadAnchor())>(squadOrder==='guard'?235:320))continue;
      const d=dist(u,f);if(d>220)continue;
      const missing=f.maxHp-f.hp,urgency=1-f.hp/f.maxHp;
      const score=urgency*urgency*120+Math.min(missing,u.team==='ally'?16:12)*2-d*.04+(elapsed-(f.lastDamageTime??-99)<2?15:0);
      if(score>bestScore){bestScore=score;best=f;}
      if(d<140&&shotClear(u,f)&&(missing>=8||urgency>.5)&&score>readyScore){ready=f;readyScore=score;}
    }
    return ready||best;
  }
  function updateHealer(u,dt){
    u.healThink=(u.healThink||0)-dt;
    if(u.healThink<=0||u.healTarget&&(u.healTarget.hp<=0||u.healTarget.hp>=u.healTarget.maxHp)){
      u.healTarget=healingTarget(u,u.team==='ally'?[hero,...allies]:enemies);u.healThink=.2;
      u.healThreat=nearest(u,u.team==='ally'?enemies:[hero,...allies],100);
      if(u.team==='enemy'){
        let front=null,d=Infinity;for(const f of enemies)if(f.hp>0&&!f.entering&&['Warrior','Lancer'].includes(f.kind)&&dist(u,f)<d){front=f;d=dist(u,f);}
        if(front){const distance=Math.max(1,dist(front,hero));u.supportHome={x:front.x+(front.x-hero.x)/distance*80,y:front.y+(front.y-hero.y)/distance*80};}
        else u.supportHome={x:620,y:410};
      }
    }
    const wounded=u.healTarget,home=u.team==='ally'?squadHome(u):u.supportHome||u;
    if(wounded&&dist(u,wounded)<140&&u.cooldown<=0&&shotClear(u,wounded)){
      const base=u.team==='ally'?16:12,capacity=base+(u.team==='ally'&&wounded===hero?ranks.oath*2:0),healed=Math.min(wounded.maxHp-wounded.hp,capacity);
      if(wounded===hero)combatStats.oathHealing+=Math.max(0,healed-base);
      wounded.hp+=healed;combatStats.healingDone+=healed;combatStats.healingWasted+=capacity-healed;
      u.attack=u.attackDuration=.45;u.cooldown=u.team==='ally'?3:4.5;u.moving=false;
      addEffect(blue('Monk','Heal_Effect'),wounded.x,wounded.y,110,.7);float(`+${Math.ceil(healed)}`,wounded.x,wounded.y,'#ceefa0');return;
    }
    const threat=u.healThreat;
    if(threat?.hp>0&&dist(u,threat)<80&&u.cooldown>0){
      u.supportThink=(u.supportThink||0)-dt;
      if(u.supportThink<=0||u.supportThreat!==threat){u.supportGoal=tacticalRetreat(u,threat,65);u.supportThink=.24;u.supportThreat=threat;}
      const retreat=u.supportGoal;
      if(retreat){steerMove(u,retreat,dt);return;}
    }
    if(wounded&&u.team==='ally'&&bossDangerAt(wounded)){u.moving=false;return;}
    if(wounded&&(!shotClear(u,wounded)||dist(u,wounded)>100))steerMove(u,wounded,dt);
    else if(!wounded&&dist(u,home)>35)steerMove(u,home,dt);
    else u.moving=false;
  }
  function segmentHit(a, b, target, radius) {
    const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-target.x,oy=a.y-target.y;
    const c=ox*ox+oy*oy-radius*radius;
    if(c<=0)return 0;
    const length=dx*dx+dy*dy;if(length===0)return Infinity;
    const projection=ox*dx+oy*dy,disc=projection*projection-length*c;
    if(disc<0)return Infinity;
    const t=(-projection-Math.sqrt(disc))/length;
    return t>=0&&t<=1?t:Infinity;
  }
  function updateUnit(u, dt) {
    u.approachThink=(u.approachThink||0)-dt;
    u.repositionThink=(u.repositionThink||0)-dt;
    u.attack = Math.max(0, u.attack - dt); u.cooldown -= dt;
    u.chargeCooldown = (u.chargeCooldown || 0) - dt; u.charge = Math.max(0, (u.charge || 0) - dt);
    if (u.hp <= 0) return;
    const anchor=squadAnchor(),leash=squadOrder==='guard'?235:320;
    if(u.team==='ally'&&dist(u,anchor)>leash){
      releaseApproach(u);u.combatTarget=null;u.strike=null;u.attack=0;u.evadeGoal=null;
      if(u.stagger>0){u.moving=false;return;}
      steerMove(u,squadHome(u),dt,u.speed*1.15);return;
    }
    if(!u.isBoss&&!u.entering){updateRole(u,dt);if(u.stagger<=0&&(evadeBoss(u,dt)||evadeProjectile(u,dt)))return;}
    if (u.strike) {
      u.strike.timer -= dt;
      if (u.strike.timer <= 0) {
        const strike = u.strike; u.strike = null;
        if (strike.target.hp > 0 && dist(u, strike.target) <= strike.range && (u.kind === 'Archer' || ((strike.target.x - u.x) * u.facing >= -12 && (strike.target === castle || clearPath(u, strike.target))))) {
          if (u.kind === 'Archer') {if(shotClear(u,strike.target))fireArrow(u, strike.target);}
          else hurt(strike.target, strike.damage, u);
        }
      }
    }
    if (u.stagger > 0) { u.moving = false; return; }
    if (u.strike) { u.moving = false; return; }
    if (u.entering) {
      const exit = { x: 231, y: 402 + u.lane * 13 };
      if (dist(u, exit) < 22) u.entering = false;
      else { steerMove(u, exit, dt); return; }
    }
    if(u.isBoss){updateBoss(u,dt);return;}
    if (u.kind === 'Monk') {
      updateHealer(u,dt);
      return;
    }
    const target = u.team === 'enemy' && (u.blockedSeconds > 2 || u.stallSeconds > 3) ? castle : u.team === 'ally' ? combatTarget(u, enemies.filter(e=>dist(e,anchor)<=leash),leash+150) : combatTarget(u, [hero, ...allies],u.kind==='Archer'?240:200) || (dist(u, castle) < 130 && dist(u, hero) > 420 ? castle : hero);
    if(u.approachTarget&&u.approachTarget!==target)releaseApproach(u);
    if (!target) { releaseApproach(u);if (dist(u, squadHome(u)) > 30) steerMove(u, squadHome(u), dt); else u.moving = false; return; }
    const d = dist(u, target), range = u.kind === 'Archer' ? 225 : target === castle ? 88 : u.kind === 'Lancer' ? 91 : 51;
    const blocked=u.kind==='Archer'?!shotClear(u,target):target!==castle&&d<=range&&!clearPath(u,target);
    if(blocked){
      if(u.kind==='Archer'&&u.repositionThink<=0){u.repositionGoal=firingPosition(u,target);u.repositionThink=.3;if(u.repositionGoal)combatStats.repositions++;}
      steerMove(u,u.kind==='Archer'&&u.repositionGoal||target,dt);return;
    }
    if (u.kind === 'Archer' && d < (u.team==='ally'?110:145) && !u.strike) {
      if(u.repositionThink<=0||!u.retreatGoal){u.retreatGoal=tacticalRetreat(u,target);u.repositionThink=.24;}
      if(u.retreatGoal)steerMove(u,u.retreatGoal,dt,u.speed*.95);else u.moving=false;u.facing=target.x<u.x?-1:1;
      if (u.cooldown <= 0&&mayStartMelee(u,target)) { u.attack = u.attackDuration = .72; u.cooldown = 1.6; u.strike = { timer: .31, target, range: 225 }; }
      return;
    }
    if(u.kind==='Lancer'&&d<49&&u.cooldown>.25){const retreat=tacticalRetreat(u,target,28);if(retreat){steerMove(u,retreat,dt,u.speed*.8);u.facing=target.x<u.x?-1:1;return;}}
    if (u.team === 'enemy' && u.kind === 'Warrior' && d > 100 && d < 250 && u.chargeCooldown <= 0) { u.charge = .65; u.chargeCooldown = 3.8; addEffect('Particle FX/Dust_01.png', u.x, u.y, 42); }
    if (d > range) {
      const aim = u.kind==='Archer'||target===castle?target:approachPoint(u,target,range);
      if(u.team==='ally'&&u.kind!=='Archer'&&bossDangerAt(aim)){u.moving=false;return;}
      steerMove(u, canStand(aim.x, aim.y) ? aim : target, dt, u.speed * (u.charge > 0 ? 1.5 : 1));
    } else {
      u.moving = false; if (u.attack <= 0) u.facing = target.x < u.x ? -1 : 1;
      if (u.cooldown <= 0&&mayStartMelee(u,target)) {
        if(target===u.protectTarget)combatStats.roleIntercepts++;
        u.attack = u.attackDuration = u.kind === 'Archer' ? .72 : .4; u.cooldown = u.kind === 'Archer' ? 1.6 : u.team === 'ally' ? .9 : Math.max(.85, 1.25 - waveIndex * .08);
        u.strike = { timer: u.kind === 'Archer' ? .31 : u.kind === 'Lancer' ? .24 : .2, target, range, damage: u.team === 'ally' ? 18 : Math.round(((target === castle ? 13 : u.kind === 'Lancer' ? 13 : 10) + waveIndex * 2)*settings().damage) };
      }
    }
  }

  function update(dt) {
    if (state !== 'playing') return;
    for (const u of [hero, ...allies, ...enemies]) keepOnLand(u);
    if (castle.hp <= 0 || hero.hp <= 0) { finish(false); return; }
    updatePresentation(dt);
    pressureGap=Math.max(0,pressureGap-dt);rangedPressureGap=Math.max(0,rangedPressureGap-dt);pressureActive=0;
    for(const u of enemies)if(u.hp>0&&(u.strike?.target===hero&&u.kind!=='Archer'||u.isBoss&&u.bossAction?.stage==='warning'))pressureActive++;
    orderPulse=Math.max(0,orderPulse-dt);
    elapsed += dt; gatherCooldown = Math.max(0, gatherCooldown - dt); hero.cooldown = Math.max(0, hero.cooldown - dt); hero.attack = Math.max(0, hero.attack - dt); hero.invuln = Math.max(0, hero.invuln - dt);
    hero.healCooldown = Math.max(0, hero.healCooldown - dt);
    hero.dashCooldown=Math.max(0,(hero.dashCooldown||0)-dt);hero.riposte=Math.max(0,(hero.riposte||0)-dt);
    if(hero.dashBuffer>0){startDash();hero.dashBuffer=Math.max(0,hero.dashBuffer-dt);}
    dashTrail.forEach(t=>t.life-=dt);dashTrail=dashTrail.filter(t=>t.life>0);
    const dashing=hero.dash>0;
    if(dashing){
      hero.dashElapsed+=dt;hero.dash=Math.max(0,hero.dash-dt);
      dashTrail.push({x:hero.x,y:hero.y,time:hero.dashElapsed,facing:hero.facing,life:.12});if(dashTrail.length>6)dashTrail.shift();
      move(hero,hero.dashX,hero.dashY,dt,720);
    }

    for (const u of [hero, ...allies, ...enemies]) updateReaction(u, dt);
    castle.hitFlash = Math.max(0, (castle.hitFlash || 0) - dt);
    $('gameShell').classList.toggle('player-hit', hero.hitFlash > 0);
    const dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    const dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    if ((dx || dy) && hero.work) { hero.work = null; gatherCooldown = .2; }
    if((dx||dy)&&!dashing){const length=Math.hypot(dx,dy);hero.lastMoveX=dx/length;hero.lastMoveY=dy/length;}
    if (!dashing && hero.stagger <= 0) move(hero, dx, dy, dt, 185 * heroMoveScale());
    updateHeroSwing(dt);
    hero.stepTimer=Math.max(0,(hero.stepTimer||0)-dt);if(hero.moving&&!dashing&&hero.stepTimer<=0){playSample(['footstep_grass_000.ogg','footstep_grass_001.ogg'],hero,.16,1,0);hero.stepTimer=.32;}
    if (keys.has(' ') && hero.work) { hero.work = null; gatherCooldown = .18; }
    updateWork(dt);
    if (keys.has(' ') || hero.attackBuffer>0) heroAttack();
    hero.attackBuffer=Math.max(0,(hero.attackBuffer||0)-dt);
    if (keys.has('e')) gather();
    for (const s of sheep) s.cooldown = Math.max(0, s.cooldown - dt);
    if (phase === 'prepare') { waveTimer -= dt; if (dist(hero, castle) < 155) hero.hp = Math.min(hero.maxHp, hero.hp + 4 * dt); if (waveTimer <= 0) startWave(); }
    else {
      spawnTimer -= dt;
      if (spawned < waves[waveIndex].count && spawnTimer <= 0) {
        const group=encounters[waveIndex]?.groups?.find(g=>spawned>=g.start&&spawned<g.start+g.count);
        const batch = Math.min(group?group.start+group.count-spawned:3, waves[waveIndex].count - spawned);
        for (let i = 0; i < batch; i++) spawnEnemy();
        spawnTimer = (group?.delay||waves[waveIndex].interval*1.9)*settings().interval;
      }
    }
    if(phase==='battle'&&waveIndex===4&&spawned>=Math.ceil(waves[4].count/2)&&!bossSpawned)spawnBoss();
    combatUnits.length=0;for(const u of allies)combatUnits.push(u);for(const u of enemies)combatUnits.push(u);
    engagements.clear();for(const u of combatUnits)if(u.hp>0&&u.kind!=='Monk'){const target=u.strike?.target||u.combatTarget;if(target?.hp>0)engagements.set(target,(engagements.get(target)||0)+1);}
    beginDamageStep();
    for (const u of combatUnits) updateUnit(u, dt);
    separateCombatUnits(dt);
    for (const p of projectiles) {
      const previous = { x: p.x, y: p.y };
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      let first=null,firstT=Infinity;
      for(const obstacle of obstacleList) {
        // Ignore only a collider containing the shooter, never downstream cover.
        if(dist(p.source,obstacle)<obstacle.radius+10)continue;
        const t=segmentHit(previous,p,obstacle,obstacle.radius+2);
        if(t<firstT){firstT=t;first={obstacle};}
      }
      const candidates=p.team==='ally'?enemies:[hero,...allies,castle];
      for(const target of candidates)if(target.hp>0){
        const t=segmentHit(previous,p,target,target===castle?57:20);
        if(t<firstT){firstT=t;first={target};}
      }
      if(first){
        p.x=previous.x+(p.x-previous.x)*firstT;p.y=previous.y+(p.y-previous.y)*firstT;
        if(first.target){hurt(first.target,p.damage,p.source);playSample([['Warrior','Lancer'].includes(first.target.kind)?'impactMetal_light_001.ogg':'impactSoft_medium_000.ogg'],first.target,.25,1.1,0);}else playSample(['impactWood_light_000.ogg'],p,.2,1,0);
        p.life=0;addEffect('Particle FX/Dust_01.png',p.x,p.y,32,.25);
      }
    }

    resolveHeroDamage();
    projectiles = projectiles.filter(p => p.life > 0); enemies = enemies.filter(u => u.hp > 0); allies = allies.filter(u => u.hp > 0);
    for (const d of drops) {
      d.life -= dt;
      const distance = dist(d, hero);
      if (distance < 110) { d.x += (hero.x - d.x) * dt * 8; d.y += (hero.y - d.y) * dt * 8; }
      if (distance < 30) { if (d.type === 'wood') wood += d.value; else gold += d.value; float(`+${d.value}`, hero.x, hero.y - 12); d.life = 0; }
    }
    drops = drops.filter(d => d.life > 0);
    for (const u of [hero, ...allies, ...enemies]) {
      const animState = u.work ? 'Work' : u.stagger > 0 ? 'Hurt' : u.attack > 0 ? 'Attack' : u.moving ? 'Run' : 'Idle';
      if (u.animState !== animState) { u.animState = animState; u.animTime = 0; }
      else if(!(u.impactHold>0))u.animTime = (u.animTime || 0) + dt;
    }
    passiveTimer += dt;
    if (passiveTimer >= 6) { passiveTimer -= 6; wood += 3; gold += 4; float('+3 kayu', villagers[0].x, villagers[0].y, '#dbdca0'); float('+4 emas', villagers[1].x, villagers[1].y); }
    if (castle.hp <= 0 || hero.hp <= 0) { finish(false); return; }
    if (phase === 'battle' && spawned >= waves[waveIndex].count && enemies.length === 0 && (waveIndex<4||bossSpawned)) finishWave();
    uiTimer += dt;
    if (uiTimer > .1) {
      updateUI(); uiTimer = 0;
      const node = hero.attack>0||hero.dash>0||hero.damageCue>0?null:nearestResource(); $('interactionHint').hidden = !node;
      if (node) $('interactionHint').querySelector('span').textContent = `${node.name} · tahan E`;
    }
    if (soundOn && (melodyTimer -= dt) <= 0) { melodyTimer = 2.6; tone([262, 294, 330, 392, 440][Math.floor(elapsed / 2.6) % 5], 1.1, 'sine', .025,undefined,'music'); }
  }
  function updateUI() {
    $('followButton').setAttribute('aria-pressed',String(squadOrder==='follow'));$('guardButton').setAttribute('aria-pressed',String(squadOrder==='guard'));
    $('squadHint').textContent=`${allies.length} sekutu · ${squadOrder==='follow'?'Ikuti penjaga, lindungi sekitarnya':'Jaga halaman kastel, jangan mengejar terlalu jauh'}`;
    $('modeBadge').textContent=settings().name;
    const bossVisible=!!(boss&&boss.hp>0);if($('bossBar').hidden===bossVisible)overlayDirty=true;
    $('bossBar').hidden=!bossVisible;$('arena').classList.toggle('boss-active',bossVisible);
    if(boss&&boss.hp>0){$('bossHealth').style.width=`${boss.hp/boss.maxHp*100}%`;$('bossValue').textContent=`${Math.ceil(boss.hp)} / ${boss.maxHp}`;$("bossIntent").textContent=bossIntentText(boss);}

    const cd=hero.dashCooldown||0,ready=cd<=0;
    $('dashLabel').textContent=hero.riposte>0?'Balasan siap!':ready?'Langkah Embun':`Pulih ${cd.toFixed(1)} dtk`;
    $('dashButton').disabled=state!=='playing';$('dashButton').classList.toggle('cooling-down',!ready);
    $('dashFill').style.width=`${(1-cd/dashCooldown())*100}%`;
    $('touchDash').disabled=state!=='playing';$('touchDash').classList.toggle('cooling-down',!ready);$('touchDash').textContent=ready?'➶':cd.toFixed(1);
    $('campButton').disabled=phase!=='prepare';$('campButton').textContent=phase!=='prepare'?'Perkemahan · jeda':'✦ Upgrade · U';

    $('heroHealth').textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`; $('heroHealthBar').style.width = `${hero.hp/hero.maxHp*100}%`;
    $('castleHealth').textContent = `${Math.ceil(castle.hp)} / ${castle.maxHp}`; $('castleHealthBar').style.width = `${castle.hp/castle.maxHp*100}%`;
    $('goldCount').textContent = gold; $('woodCount').textContent = wood; $('foodCount').textContent = food; $('scoreCount').textContent = String(score).padStart(4, '0');
    const w = waves[waveIndex];
    $('waveCount').textContent = `${phase === 'prepare' ? waveIndex : waveIndex + 1} / 5`;
    $('waveTitle').textContent = phase === 'prepare' ? `Jeda · ${Math.max(0, Math.ceil(waveTimer))} dtk` : `Gelombang ${waveIndex + 1}`;
    $('waveDetail').textContent = `${settings().name} · ${encounters[waveIndex]?.name||w.name}`;
    $('waveProgress').style.width = `${phase === 'prepare' ? (1 - waveTimer / (waveIndex === 0 ? 22 : 15)) * 100 : (spawned - enemies.filter(u=>!u.isBoss).length) / w.count * 100}%`;
    $('enemyCount').textContent = phase === 'prepare' ? `${allies.length} sekutu bersiap` : `${enemies.length + w.count - spawned+(waveIndex===4&&!bossSpawned?1:0)} musuh tersisa`;
    $('phaseHint').textContent = (encounters[waveIndex]?.hint||'U: pilih upgrade · Shift: dash menghindar.')+(phase==='prepare'&&ranks.bastion>0?' Benteng aktif saat kamu dekat kastel.':'');
    $('healButton').title=`Pulihkan hingga ${45+5*ranks.oath} nyawa penjaga dengan 1 bekal. Tombol Q.`;
    const cost = recruitIndex % 4 === 2 ? 55 : 40;
    $('recruitCost').textContent = `${cost} emas · ${allies.length}/8`;
    $('recruitButton').classList.toggle('unavailable', gold < cost || allies.length >= 8);
    $('repairButton').classList.toggle('unavailable', wood < 30 || castle.hp >= castle.maxHp);
    $('healButton').classList.toggle('unavailable', food < 1 || hero.hp >= hero.maxHp);
  }
  function togglePause(force) {
    if (state !== 'playing' && state !== 'paused') return;
    const pause = typeof force === 'boolean' ? force : state === 'playing';
    simulationAccumulator = 0;
    state = pause ? 'paused' : 'playing'; clearCombatInput();
    $('pauseScreen').hidden = !pause; $('pauseButton').textContent = pause ? '▶' : 'Ⅱ';
    $('pauseButton').setAttribute('aria-label', pause ? 'Lanjutkan permainan' : 'Jeda permainan');
    $('interactionHint').hidden = true;
    if (pause) $('resumeButton').focus({ preventScroll: true }); else canvas.focus({ preventScroll: true });
  }
  function advance(dt) {
    if(state!=='playing'){simulationAccumulator=0;return;}
    if(!Number.isFinite(dt)||dt<=0)return;
    simulationAccumulator += Math.min(.1,Math.max(0,dt));
    for(let steps=0;simulationAccumulator+1e-9>=FIXED_STEP&&steps<6&&state==='playing';steps++){
      simulationAccumulator=Math.max(0,simulationAccumulator-FIXED_STEP);update(FIXED_STEP);
    }
  }
  function updatePresentation(dt){
    for(const e of effects){e.life-=dt;e.time+=dt;}compactLiving(effects);
    for(const impact of impacts)impact.life-=dt;compactLiving(impacts);
    for(const f of floaters){f.life-=dt;f.y-=dt*26;}compactLiving(floaters);
    shake=Math.max(0,shake-dt*16);
    if(announcementTimer>0&&(announcementTimer-=dt)<=0){$('announcement').classList.remove('show');overlayDirty=true;}
    if(toastTimer>0&&(toastTimer-=dt)<=0){$('toast').classList.remove('show');overlayDirty=true;}
  }
  function compactLiving(list){let write=0;for(let i=0;i<list.length;i++)if(list[i].life>0)list[write++]=list[i];list.length=write;}
  function frame(time) {
    const dt = lastTime?clamp((time-lastTime)/1000,0,.1):0;lastTime=time;
    if (state !== 'paused' && !document.querySelector('dialog[open]') && state !== 'won' && state !== 'lost') animTime += dt;
    const wasPlaying=state==='playing';advance(dt);
    if(!wasPlaying&&state!=='paused')updatePresentation(dt);
    draw(); requestAnimationFrame(frame);
  }

  // Dialogs stop the battle and resume only if it was running beforehand.
  function openDialog(id) {
    if (document.querySelector('dialog[open]')) return;
    simulationAccumulator = 0;
    pausedForDialog = state === 'playing'; if (pausedForDialog) { state = 'paused'; clearCombatInput(); }
    if (id === 'galleryDialog' && !$('galleryGrid').children.length) renderGallery();
    $(id).showModal();
  }
  for (const id of ['helpDialog', 'galleryDialog', 'campDialog','audioDialog']) {
    $(id).addEventListener('close', () => { if (pausedForDialog) { state = 'playing';clearCombatInput();canvas.focus({ preventScroll: true }); } pausedForDialog = false; });
    $(id).addEventListener('click', e => { if (e.target === $(id)) { const r = $(id).getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $(id).close(); } });
  }
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>setDifficulty(b.dataset.difficulty)));
  $('titleButton').addEventListener('click',showTitle);
  $('followButton').addEventListener('click',()=>{setSquadOrder('follow');canvas.focus({preventScroll:true});});
  $('guardButton').addEventListener('click',()=>{setSquadOrder('guard');canvas.focus({preventScroll:true});});
  $('dashButton').addEventListener('click',()=>{requestDash();canvas.focus({preventScroll:true});});
  $('touchDash').addEventListener('pointerdown',e=>{e.preventDefault();requestDash();});
  $('campButton').addEventListener('click',openCamp);
  $('campReady').addEventListener('click',()=>{waveTimer=Math.min(waveTimer,3);$('campDialog').close();});
  $('helpButton').addEventListener('click', () => openDialog('helpDialog'));
  $('audioSettingsButton').addEventListener('click',()=>{initAudio();updateAudioVolumes();openDialog('audioDialog');});
  $('effectsVolume').addEventListener('input',()=>{effectsVolume=Number($('effectsVolume').value)/100;updateAudioVolumes();});
  $('musicVolume').addEventListener('input',()=>{musicVolume=Number($('musicVolume').value)/100;updateAudioVolumes();});
  $('galleryButton').addEventListener('click', () => openDialog('galleryDialog'));
  let galleryObserver;
  function renderGallery() {
    galleryObserver?.disconnect(); $('galleryGrid').replaceChildren();
    const category = $('galleryCategory').value, query = $('gallerySearch').value.toLowerCase();
    const assets = window.TINY_ASSETS.filter(a => (!category || a.path.startsWith(category + '/')) && a.path.toLowerCase().includes(query));
    $('gallerySummary').textContent = `${assets.length} dari ${window.TINY_ASSETS.length} aset asli · 5 folder utama · 56 folder aset`;
    galleryObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const preview = entry.target, meta = manifest.get(preview.dataset.path);
      loadImage(meta.path).then(im => {
        const g = preview.getContext('2d'); g.imageSmoothingEnabled = false;
        const animated = /Units\/|Particle FX\/|Trees\/Tree|Sheep\/|Bushes\/|Water Foam|Rubber Duck/.test(meta.path);
        const sw = animated ? spriteFrame(meta.path).width : meta.width, sh = meta.height;
        const s = Math.min(90 / sw, 90 / sh); g.drawImage(im, 0, 0, sw, sh, (90 - sw * s) / 2, (90 - sh * s) / 2, sw * s, sh * s);
      }).catch(() => {});
      galleryObserver.unobserve(preview);
    }), { root: $('galleryGrid'), rootMargin: '150px' });
    for (const a of assets) {
      const card = document.createElement('div'); card.className = 'gallery-card';
      const art = document.createElement('div'); art.className = 'gallery-art';
      const preview = document.createElement('canvas'); preview.width = 90; preview.height = 90; preview.dataset.path = a.path; preview.setAttribute('aria-label', a.path); art.append(preview);
      const title = document.createElement('strong'); title.textContent = a.path.split('/').pop().replace('.png', '');
      const folder = document.createElement('small'); folder.textContent = a.path.slice(0, a.path.lastIndexOf('/'));
      card.append(art, title, folder); $('galleryGrid').append(card); galleryObserver.observe(preview);
    }
    if (!assets.length) { const empty = document.createElement('p'); empty.textContent = 'Tidak ada aset yang cocok.'; $('galleryGrid').append(empty); }
  }
  $('gallerySearch').addEventListener('input', renderGallery); $('galleryCategory').addEventListener('change', renderGallery);
  $('startButton').addEventListener('click',()=>startGame());$('restartButton').addEventListener('click',()=>startGame(runSeed));$('restartPauseButton').addEventListener('click',()=>startGame(runSeed));$('newRunButton').addEventListener('click',()=>startGame());
  $('pauseButton').addEventListener('click', () => togglePause()); $('resumeButton').addEventListener('click', () => togglePause(false));
  for (const [id, action] of [['recruitButton', () => recruitUnit()], ['repairButton', repairCastle], ['healButton', healHero]]) {
    $(id).addEventListener('click', () => { action(); if (state === 'playing') canvas.focus({ preventScroll: true }); });
  }
  $('soundButton').addEventListener('click', () => {
    initAudio(); soundOn = !soundOn; $('soundButton').setAttribute('aria-pressed', String(soundOn)); $('soundButton').setAttribute('aria-label', soundOn ? 'Matikan suara' : 'Nyalakan suara');
    if(audioMaster)audioMaster.gain.setTargetAtTime(soundOn?.8:0,audio.currentTime,.02);
    $('soundButton').querySelector('.sound-off').hidden = soundOn; if (soundOn) tone(523, .2);
  });
  $('fullscreenButton').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('gameShell').requestFullscreen(); }
    catch { notify('Layar penuh tidak tersedia di browser ini.'); }
  });
  document.addEventListener('fullscreenchange', resize);
  window.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if ((key === 'p' || key === 'escape') && !e.repeat) { e.preventDefault(); togglePause(); return; }
    if (state !== 'playing') return;
    if((key==='f'||key==='g')&&!e.repeat){e.preventDefault();setSquadOrder(key==='f'?'follow':'guard');return;}
    if(key==='u'&&!e.repeat){e.preventDefault();openCamp();return;}
    if(key==='shift'){e.preventDefault();if(!e.repeat)requestDash();return;}
    const controls = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ', 'e', '1', '2', 'q'];
    if (!controls.includes(key)) return;
    // Native buttons retain keyboard activation when deliberately focused.
    if (key === ' ' && e.target.tagName === 'BUTTON') return;
    e.preventDefault();if(e.repeat&&!keyboardKeys.has(key))return;keyboardInput(key,true);if(key===' '&&!e.repeat)requestAttack();
    if (!e.repeat) { if (key === '1') recruitUnit(); if (key === '2') repairCastle(); if (key === 'q') healHero(); }
  });
  window.addEventListener('keyup', e => keyboardInput(e.key.toLowerCase(),false));
  window.addEventListener('blur', () => { clearCombatInput(); if (state === 'playing') togglePause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(true); });
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||e.button!==0||state!=='playing')return;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointerInput(e.pointerId,' ',true);requestAttack();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointerInput(e.pointerId,null,false));
  function bindTouchControl(button,key){
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='playing')return;button.setPointerCapture(e.pointerId);pointerInput(e.pointerId,key,true);if(key===' ')requestAttack();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>pointerInput(e.pointerId,null,false));
  }
  for(const b of document.querySelectorAll('[data-move]'))bindTouchControl(b,{up:'w',left:'a',down:'s',right:'d'}[b.dataset.move]);
  bindTouchControl($('touchAttack'),' ');bindTouchControl($('touchGather'),'e');

  // Read-only state for meaningful smoke tests and inspecting an active match.
  window.PenjagaPulau = Object.freeze({ snapshot: () => ({ runSeed,encounters:encounters.map(e=>({name:e.name,roster:[...e.roster]})),audio:{decoded:sampleBuffers.size,failed:audioFailures,voices:activeVoices,effectsVolume,musicVolume,enabled:soundOn},combat:{...combatStats,damageBySource:{...combatStats.damageBySource}},difficulty,squadOrder,boss:boss?{ragePending:!!boss.ragePending,hp:boss.hp,maxHp:boss.maxHp,enraged:boss.enraged,action:boss.bossAction?{type:boss.bossAction.type,stage:boss.bossAction.stage,time:boss.bossAction.time}:null}:null, state, phase, wave: waveIndex + 1, waveTimer, spawned, enemies: enemies.map(u => ({ x: u.x, y: u.y, hp: u.hp, kind: u.kind, isBoss:!!u.isBoss, entering: u.entering, hitFlash: u.hitFlash, stagger: u.stagger })), allies: allies.map(u => ({ x: u.x, y: u.y, hp: u.hp, kind: u.kind,formationSlot:u.formationSlot })), hero: { x: hero.x, y: hero.y, hp: hero.hp, hitFlash: hero.hitFlash, stagger: hero.stagger }, impacts: impacts.length, damageDealt, damageTaken, dash: {active:hero.dash||0,cooldown:hero.dashCooldown||0,riposte:hero.riposte||0}, upgrades:{...ranks},upgradeMaxLevel:MAX_UPGRADE_LEVEL,campPurchased:campPurchase===waveIndex, work: hero.work ? {type: hero.work.node.type, elapsed: hero.work.elapsed, duration: hero.work.duration} : null, castleHp: castle.hp, gold, wood, food, score, kills, loadedAssets: [...images.values()].filter(r => r.loaded).length, assetCount: manifest.size }) });
  setDifficulty('normal');
  resize(); preload(); requestAnimationFrame(frame);
})();
