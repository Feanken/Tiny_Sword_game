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
    return waves.map((w,index)=>{
      const style=waveStyles[Math.floor(random()*waveStyles.length)],roster=[];
      for(let i=0;i<w.count;i++)roster.push(w.types[i%w.types.length]);
      if(index>0){
        // Shuffle equal-size authored rosters, then exchange one fighter only.
        for(let i=roster.length-1;i>1;i--){const j=1+Math.floor(random()*i);[roster[i],roster[j]]=[roster[j],roster[i]];}
        const swap=roster.findIndex((kind,i)=>i>1&&kind==='Warrior');
        if(swap>=0)roster[swap]=style.bias;
        roster[0]='Warrior';
      }
      const lanes=[-1,0,1,-2,2];if(index>0)for(let i=4;i>0;i--){const j=Math.floor(random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
      return {name:index===0?w.name:style.name,hint:index===0?'Jaga jarak, baca ayunan musuh, lalu balas.':style.hint,roster,lanes,interval:w.interval};
    });
  }
  let state = 'loading', phase = 'prepare', waveIndex = 0, waveTimer = 22, spawned = 0, spawnTimer = 0;
  let gold = 80, wood = 40, food = 3, score = 0, kills = 0, recruitIndex = 0;
  let elapsed = 0, animTime = 0, gatherCooldown = 0, passiveTimer = 0, uiTimer = 0, announcementTimer = 0, toastTimer = 0, shake = 0;
  let enemies = [], allies = [], effects = [], floaters = [], drops = [], projectiles = [], impacts = [];
  const SWING = Object.freeze({ start:.16, end:.28, angle:1.3, reach:76, radius:18, cap:3 });
  const approachOffsets = Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}));
  const approachSlots = new Map(), combatUnits = [];
  const engagements=new Map();
  let combatId=0, pressureActive=0, pressureGap=0, collectingHeroDamage=false, pendingHeroDamage=null;
  const combatStats={};
  function resetCombatStats(){
    Object.assign(combatStats,{swings:0,hits:0,misses:0,interruptions:0,cancels:0,bufferedInputs:0,healingDone:0,healingWasted:0,stalls:0,blockedSeconds:0,mergedHits:0,pressureDeferrals:0,maxWindups:0,damageTaken:0,allyEvades:0,allyHazardHits:0,roleIntercepts:0,repositions:0});
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
    enemies.push(boss);announce('Panglima Kelam','BACA TANDANYA · HINDARI · BALAS');return true;
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
  function updateBoss(u,dt){
    if(!u.enraged&&u.hp<=u.maxHp*.5){u.enraged=true;announce('Panglima mengamuk!','TEMPO MENINGKAT · TETAP BACA TANDANYA');}
    u.abilityCooldown-=dt;
    const action=u.bossAction;
    if(action){
      action.time-=dt;u.moving=false;
      if(action.stage==='warning'&&action.time<=0){
        if(action.type==='slam'){
          for(const target of [hero,...allies,castle])if(target.hp>0&&dist(target,action.target)<105)hurt(target,Math.round(24*settings().damage),u);
          addEffect('Particle FX/Explosion_02.png',action.target.x,action.target.y,160,.5,20);shake=3;
          action.stage='recovery';action.time=action.recoveryDuration=.95;
        }else if(action.type==='volley'){
          const angle=Math.atan2(action.target.y-u.y,action.target.x-u.x);
          for(const offset of [-.22,0,.22]){fireArrow(u,{x:u.x+Math.cos(angle+offset)*300,y:u.y+Math.sin(angle+offset)*300});projectiles[projectiles.length-1].damage=Math.round(22*settings().damage);}
          action.stage='recovery';action.time=action.recoveryDuration=.85;
        }else {action.stage='charge';action.time=.45;}
      }else if(action.stage==='charge'){
        const previous={x:u.x,y:u.y},remaining=action.chargeEnd.distance-action.traveled;
        const step=Math.min(action.chargeSpeed*dt,Math.max(0,remaining));
        if(step>0){
          const next=action.traveled+step,x=action.origin.x+action.dx*next,y=action.origin.y+action.dy*next;
          if(positionFits(x,y)){u.x=x;u.y=y;action.traveled=next;u.moving=true;}else action.time=0;
        }
        if(dist(previous,u)>.001)for(const target of [hero,...allies,castle])if(target.hp>0&&!action.hit.has(target)&&Number.isFinite(segmentHit(previous,u,target,target===castle?62:36))&&(target===castle||clearPath(u,target))){hurt(target,Math.round(27*settings().damage),u);action.hit.add(target);}
        if(action.time<=0||action.traveled>=action.chargeEnd.distance-.001){action.stage='recovery';action.time=action.recoveryDuration=.95;}
      }else if(action.stage==='recovery'&&action.time<=0){u.bossAction=null;u.abilityCooldown=u.enraged?.4:.65;}
      return;
    }
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
    state='ready';keys.clear();pointerAttack=false;hero.attackBuffer=0;simulationAccumulator=0;
    enemies=[];allies=[];effects=[];impacts=[];projectiles=[];dashTrail=[];boss=null;bossSpawned=false;
    Object.assign(hero,{x:788,y:370,hp:100,maxHp:100,attack:0,dash:0,dashCooldown:0,riposte:0,work:null,facing:1,invuln:0,hitFlash:0,stagger:0,cooldown:0,moving:false,knockX:0,knockY:0});castle.hp=castle.maxHp=500;castle.hitFlash=0;orderPulse=0;gold=80;wood=40;food=3;score=0;waveIndex=0;phase='prepare';waveTimer=22;for(const id in ranks)ranks[id]=0;
    toastTimer=0;announcementTimer=0;$('toast').classList.remove('show');$('announcement').classList.remove('show');$('worldCaption').hidden=false;
    $('startScreen').hidden=false;$('endScreen').hidden=true;$('pauseScreen').hidden=true;$('battleStatus').hidden=true;$('squadBar').hidden=true;$('bossBar').hidden=true;$('dashButton').hidden=true;$('mobileControls').hidden=true;
    document.body.classList.remove('is-playing');$('arena').classList.remove('boss-active');setDifficulty(difficulty);updateUI();resize();
  }
  const ranks = { blade:0, rhythm:0, wind:0, counter:0, bastion:0, oath:0 };
  const upgrades = [
    {id:'blade',name:'Bilah Bara',group:'PEDANG',icon:'⚔',cost:45,description:'Damage sasaran utama +5, sasaran tambahan +3 per tingkat.'},
    {id:'rhythm',name:'Ritme Tempur',group:'PEDANG',icon:'✦',cost:40,description:'Jeda antarserangan berkurang 6% per tingkat.'},
    {id:'wind',name:'Jejak Angin',group:'KELINCAHAN',icon:'➶',cost:35,description:'Cooldown dash berkurang 0,25 detik per tingkat.'},
    {id:'counter',name:'Balasan Embun',group:'KELINCAHAN',icon:'◇',cost:35,description:'Bonus balasan elak sempurna +6 damage dan durasi +0,5 detik per tingkat.'},
    {id:'bastion',name:'Benteng Hidup',group:'PERTAHANAN',icon:'♜',cost:40,description:'Kapasitas nyawa kastel +80 dan langsung pulih 80 per tingkat.'},
    {id:'oath',name:'Sumpah Penjaga',group:'PERTAHANAN',icon:'♡',cost:40,description:'Kapasitas nyawa penjaga +15 dan langsung pulih 15 per tingkat.'},
  ];
  function dashCooldown() { return 2.4 - ranks.wind * .25; }
  function startDash() {
    if(state!=='playing'||hero.hp<=0||hero.dash>0||hero.dashCooldown>0)return false;
    let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    let dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    if(!dx&&!dy){dx=hero.lastMoveX??hero.facing;dy=hero.lastMoveY??0;}
    const length=Math.hypot(dx,dy);hero.dashX=dx/length;hero.dashY=dy/length;
    hero.dash=.2;hero.dashCooldown=dashCooldown();hero.dashElapsed=0;hero.dashPerfect=false;
    cancelHeroSwing(false);hero.impactHold=0;hero.attackBuffer=0;hero.work=null;hero.attack=0;hero.stagger=0;hero.knockX=0;hero.knockY=0;
    if(Math.abs(dx)>.1)hero.facing=dx>0?1:-1;
    addEffect('Particle FX/Dust_01.png',hero.x,hero.y,55);if(!playSample(['cloth1.ogg','cloth2.ogg'],hero,.4,1.3,2))tone(360,.14,'triangle',.025,720);return true;
  }
  function renderCamp() {
    $('campGold').textContent=gold;
    $('campRound').textContent=`JEDA ${waveIndex+1} / 5`;
    $('campRule').textContent=campPurchase===waveIndex?'Penempaan selesai. Pilihan berikutnya terbuka setelah gelombang ini.':'Satu penempaan setiap jeda. Pilih kekuatanmu; sisakan emas untuk pasukan.';
    $('campCards').replaceChildren();
    for(const perk of upgrades){
      const level=ranks[perk.id],cost=perk.cost+level*20,button=document.createElement('button');
      button.className='perk-card';button.dataset.perk=perk.id;
      button.disabled=level>=3||campPurchase===waveIndex||gold<cost||phase!=='prepare';
      button.innerHTML=`<span class="perk-category">${perk.group}<span>${'◆'.repeat(level)}${'◇'.repeat(3-level)}</span></span><span class="perk-icon" aria-hidden="true">${perk.icon}</span><strong>${perk.name}</strong><span class="perk-description">${perk.description}</span><span class="perk-price">${level>=3?'TINGKAT MAKSIMAL':`${cost} emas <span>Tingkat ${level+1} →</span>`}</span>`;
      button.addEventListener('click',()=>buyUpgrade(perk.id));$('campCards').append(button);
    }
    $('campBuild').textContent=upgrades.filter(p=>ranks[p.id]).map(p=>`${p.name} ${ranks[p.id]}`).join(' · ')||'Belum ada penempaan. Setiap pilihan membentuk cara bertarungmu.';
  }
  function buyUpgrade(id) {
    const perk=upgrades.find(p=>p.id===id);
    if(!perk||phase!=='prepare'||campPurchase===waveIndex||ranks[id]>=3||!(state==='playing'||(state==='paused'&&$('campDialog').open)))return false;
    const cost=perk.cost+ranks[id]*20;if(gold<cost)return false;
    gold-=cost;ranks[id]++;campPurchase=waveIndex;
    if(id==='bastion'){castle.maxHp+=80;castle.hp=Math.min(castle.maxHp,castle.hp+80);}
    if(id==='oath'){hero.maxHp+=15;hero.hp=Math.min(hero.maxHp,hero.hp+15);}
    if(id==='wind')hero.dashCooldown=Math.min(hero.dashCooldown,dashCooldown());
    $('campFeedback').textContent=`${perk.name} tingkat ${ranks[id]} ditempa. Berlaku hingga pertandingan selesai.`;
    tone(523,.2,'triangle');renderCamp();updateUI();return true;
  }
  function openCamp(){
    if(state!=='playing'&&state!=='paused')return;
    if(phase!=='prepare'){notify('Perkemahan dibuka saat jeda gelombang.');return;}
    $('campFeedback').textContent='';renderCamp();openDialog('campDialog');$('campCards').querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  }
  let best = 0, terrainCanvas, lastTime = 0, pausedForDialog = false, initialized = false;
  let scale = 1, cameraX = 0, cameraY = 0, viewW = W, viewH = H, pointerAttack = false;
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
    const rect = $('arena').getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    scale = canvas.height / H; viewH = H; viewW = canvas.width / scale;
    ctx.imageSmoothingEnabled = false;
  }
  new ResizeObserver(resize).observe($('arena'));

  function spriteFrame(path, time = 0, fps = 9, once = false) {
    const meta = manifest.get(path);
    // All four trees have eight 192px-wide frames; pine frames are 256px tall.
    const isTree = /\/Trees\/Tree[1-4]\.png$/.test(path);
    const width = isTree ? 192 : meta.height, height = meta.height;
    const count = Math.max(1, Math.floor(meta.width / width));
    const tick = Math.max(0, Math.floor(time * fps));
    const index = once ? Math.min(count - 1, tick) : tick % count;
    return { x: index * width, width, height, count, anchorY: isTree ? (height === 256 ? .95 : .87) : .79 };
  }
  function drawSprite(path, x, y, size, time = animTime, fps = 9, facing = 1, alpha = 1, once = false, flash = false) {
    if(x+size<cameraX||x-size>cameraX+viewW||y+size<cameraY||y-size>cameraY+viewH)return;
    const im = img(path); if (!im) return;
    const frame = spriteFrame(path, time, fps, once), width = size * frame.width / frame.height;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1); ctx.globalAlpha = alpha;
    if (flash) {
      const key=path+':'+frame.x;let white=flashFrames.get(key);
      if(!white){
        white=document.createElement('canvas');white.width=frame.width;white.height=frame.height;
        const g=white.getContext('2d');g.drawImage(im,frame.x,0,frame.width,frame.height,0,0,frame.width,frame.height);
        g.globalCompositeOperation='source-in';g.fillStyle='#fff';g.fillRect(0,0,frame.width,frame.height);
        if(flashFrames.size>=32)flashFrames.delete(flashFrames.keys().next().value);
        flashFrames.set(key,white);
      }
      ctx.drawImage(white,-width/2,-size*frame.anchorY,width,size);
    } else ctx.drawImage(im, frame.x, 0, frame.width, frame.height, -width / 2, -size * frame.anchorY, width, size);
    ctx.restore();
  }
  function drawImageAt(path, x, y, width, alpha = 1) {
    const im = img(path); if (!im) return;
    const height = im.height / im.width * width;
    ctx.globalAlpha = alpha; ctx.drawImage(im, Math.round(x - width / 2), Math.round(y - height), width, height); ctx.globalAlpha = 1;
  }
  function healthBar(x, y, hp, max, color, width = 35) {
    ctx.fillStyle = '#173327cc'; ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
    ctx.fillStyle = color; ctx.fillRect(x - width / 2, y, width * clamp(hp / max, 0, 1), 3);
  }
  function bossPose(u){
    const a=u.bossAction;
    if(!a)return {path:unitPath('Black','Warrior',u.moving?'Run':'Idle'),age:u.animTime||0,fps:9,once:false};
    const warning=a.stage==='warning',recover=a.stage==='recovery',age=warning?a.duration-a.time:recover?(a.recoveryDuration||.95)-a.time:.45-a.time;
    const action=a.type==='volley'?'Shoot':a.type==='charge'?(a.stage==='charge'?'Run':'Guard'):'Attack2';
    const path=unitPath('Black',a.type==='volley'?'Archer':'Warrior',action);
    if(recover&&age>.2)return {path:unitPath('Black','Warrior','Idle'),age,fps:5,once:false};
    const duration=warning?a.duration:.3,progress=warning?age/duration*.6:.6+Math.min(1,age/.2)*.4;
    return {path,age:action==='Run'?age:progress,fps:action==='Run'?16:spriteFrame(path).count,once:action!=='Run'};
  }
  function drawUnit(u, isHero = false) {
    if(!isHero){
      ctx.save();ctx.translate(u.x,u.y-3);ctx.strokeStyle=u.team==='enemy'?'#ffc49b':'#b8e5df';ctx.lineWidth=1.5;
      ctx.beginPath();if(u.team==='enemy'){ctx.moveTo(-6,0);ctx.lineTo(0,6);ctx.lineTo(6,0);}else ctx.ellipse(0,0,7,3,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    if(isHero&&hero.dash>0){drawSprite(blue('Warrior','Run'),u.x,u.y,136,hero.dashElapsed,14,u.facing,1);ctx.strokeStyle='#b9f4df';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(u.x,u.y-4,23,10,0,0,Math.PI*2);ctx.stroke();return;}
    if (isHero && hero.work) {
      const work = hero.work, progress = clamp(work.elapsed / work.duration, 0, 1);
      const action = work.node.type === 'wood' ? 'Interact Axe' : work.node.type === 'gold' ? 'Interact Pickaxe' : 'Idle Meat';
      drawSprite(blue('Pawn', action), u.x, u.y, 136, work.elapsed, spriteFrame(blue('Pawn', action)).count / work.duration, u.facing, 1, true);
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
    if (isHero) {
      ctx.strokeStyle = '#f5df9a99'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(u.x, u.y - 4, 21, 9, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const pose=u.isBoss?bossPose(u):null;
    const path=pose?.path||unitPath(color,kind,action),age=pose?pose.age:u.impactHold>0?u.impactAge:u.attack>0?(u.attackDuration||.4)-u.attack:(u.animTime||0);
    const fps=pose?pose.fps:u.attack>0?spriteFrame(path).count/(u.attackDuration||.4):9,once=pose?pose.once:u.attack>0;
    drawSprite(path,u.x,u.y,size,age,fps,u.facing,alpha,once);
    if (u.hitFlash > 0) drawSprite(path,u.x,u.y,size,age,fps,u.facing,Math.min(.92,u.hitFlash/.15),once,true);
    if (u.attack > 0 && age > (isHero?SWING.start:.07) && age < (isHero?SWING.end:.29) && !['Archer', 'Monk'].includes(kind)) {
      ctx.save(); ctx.translate(u.x, u.y - 23); ctx.scale(u.facing, 1);
      ctx.strokeStyle = isHero ? '#fff1c7cc' : u.team === 'enemy' ? '#ffc49ba8' : '#d4f5ddb0';
      ctx.lineWidth = isHero ? 4 : 3; ctx.lineCap = 'round';
      const progress=isHero?clamp((age-SWING.start)/(SWING.end-SWING.start),0,1):(age-.07)/.22;
      ctx.beginPath();ctx.arc(0,0,isHero?SWING.reach:kind==='Lancer'?77:43,isHero?-SWING.angle:-1.45,isHero?-SWING.angle+2*SWING.angle*progress:1.45*progress);ctx.stroke();ctx.restore();
    }
    if (!u.isBoss && ((!isHero && u.hp < u.maxHp) || (isHero && u.hitFlash > 0))) healthBar(u.x, u.y - 55, u.hp, u.maxHp, u.team === 'enemy' ? '#ef9a7a' : '#a9dda9', isHero ? 43 : 35);
    if(u.isBoss){
      const a=u.bossAction,open=a?.stage==='recovery';ctx.fillStyle=open?'#cbffce':'#f4cc92';ctx.font='bold 11px Segoe UI';ctx.textAlign='center';
      ctx.fillText(open?'TERBUKA':a?.stage==='warning'?({slam:'! HANTAM',charge:'>> TERJANG',volley:'||| PANAH'}[a.type]):'PANGLIMA KELAM',u.x,u.y-95);
      if(open){ctx.strokeStyle='#cbffce';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(u.x,u.y,35,12,0,0,Math.PI*2);ctx.stroke();}
    }
    if(isHero){
      if(hero.damageCue>0){const a=hero.damageDirection+Math.PI;ctx.save();ctx.translate(u.x,u.y-24);ctx.rotate(a);ctx.fillStyle='#ffbaa1';ctx.beginPath();ctx.moveTo(43,0);ctx.lineTo(32,-7);ctx.lineTo(32,7);ctx.closePath();ctx.fill();ctx.restore();}
      if(hero.dodgeCue>0){ctx.strokeStyle='#b5f5e4';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(u.x,u.y-75);ctx.lineTo(u.x+10,u.y-65);ctx.lineTo(u.x,u.y-55);ctx.lineTo(u.x-10,u.y-65);ctx.closePath();ctx.stroke();}
      if(hero.missCue>0){ctx.save();ctx.translate(u.x,u.y-23);ctx.scale(u.facing,1);ctx.strokeStyle='#e8e8d566';ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(0,0,SWING.reach,-SWING.angle,SWING.angle);ctx.stroke();ctx.restore();}
    }
    if (isHero) { ctx.fillStyle = '#e9dda7'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('KAMU', u.x, u.y - 70); }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!initialized) { ctx.fillStyle = '#4c9cab'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    cameraX = viewW >= W ? (W - viewW) / 2 : clamp((state === 'ready' ? 790 : hero.x) - viewW / 2, 0, W - viewW);
    cameraY = 0;
    ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, -cameraY * scale);
    ctx.fillStyle = ctx.createPattern(img(terrain('Tileset/Water Background color')), 'repeat');
    ctx.fillRect(cameraX, 0, viewW, viewH);
    if (shake > 0 && !reducedMotion) ctx.translate((Math.random()*2-1)*shake,(Math.random()*2-1)*shake);
    ctx.drawImage(terrainCanvas, 0, 0);
    // Animated white water follows each exposed shoreline tile.
    ctx.globalAlpha = .32 + Math.sin(animTime * 1.7) * .1;
    const foam = img(terrain('Tileset/Water Foam'));
    if (foam) for (const [rstr, [left, right]] of Object.entries(rows)) {
      const r = Number(rstr);
      for (let c = left; c <= right; c++) if (!land(c, r + 1)) {
        const frame = Math.floor(animTime * 7) % 16;
        ctx.drawImage(foam, frame * 192 + 64, 128, 64, 64, c * 64, (r + 1) * 64 - 1, 64, 28);
      }
    }
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
    if(boss?.hp>0&&boss.bossAction?.stage==='warning'){
      const a=boss.bossAction;ctx.save();ctx.fillStyle='#ed75582e';ctx.strokeStyle='#ffb37b';ctx.lineWidth=3;ctx.setLineDash([8,5]);
      if(a.type==='slam'){ctx.beginPath();ctx.arc(a.target.x,a.target.y,105,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#ffe8ac';ctx.lineWidth=4;ctx.beginPath();ctx.arc(a.target.x,a.target.y,105,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-a.time/a.duration));ctx.stroke();}
      else{ctx.translate(a.origin.x,a.origin.y);ctx.rotate(Math.atan2(a.dy,a.dx));if(a.type==='charge'){const length=a.chargeEnd.distance;ctx.fillRect(0,-36,length,72);ctx.strokeRect(0,-36,length,72);ctx.beginPath();ctx.moveTo(length,-40);ctx.lineTo(length,40);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(500,-112);ctx.lineTo(500,112);ctx.closePath();ctx.fill();ctx.stroke();}}
      ctx.restore();
    }
    const renderables = [];
    for (const t of trees) renderables.push({ y: t.y, draw: () => {
      const behind = state !== 'ready' && hero.y < t.y - 4 && hero.y > t.y - t.size + 15 && Math.abs(hero.x - t.x) < 42;
      drawSprite(terrain(`Resources/Wood/Trees/Tree${t.variant}`), t.x, t.y, t.size, animTime + t.seed, 5, 1, behind ? .44 : 1);
    } });
    for (const n of goldNodes) renderables.push({ y: n.y, draw: () => drawImageAt(terrain(`Resources/Gold/Gold Stones/Gold Stone ${n.variant}`), n.x, n.y, 64) });
    for (const [x, y, i] of bushes) renderables.push({ y, draw: () => drawSprite(terrain(`Decorations/Bushes/Bushe${i}`), x, y, 75, animTime + i, 5) });
    for (const b of buildings) renderables.push({ y: b.y - 9, draw: () => {
      drawImageAt(`Buildings/${b.color} Buildings/${b.name}.png`, b.x, b.y, b.width);
      if (b.name === 'Castle') {
        if (castle.hitFlash > 0) { ctx.save(); ctx.filter = 'brightness(0) invert(1)'; drawImageAt(`Buildings/${b.color} Buildings/${b.name}.png`, b.x, b.y, b.width, .6); ctx.restore(); }
        if (castle.hp < castle.maxHp) healthBar(b.x, b.y - 160, castle.hp, castle.maxHp, '#a7d7bd', 85);
        if (castle.hp < 230) drawSprite('Particle FX/Fire_01.png', b.x - 48, b.y - 55, 65);
        if (castle.hp < 100) drawSprite('Particle FX/Fire_02.png', b.x + 49, b.y - 63, 77);
      }
    } });
    for (const s of sheep) renderables.push({ y: s.y, draw: () => drawSprite(terrain(`Resources/Meat/Sheep/${state === 'playing' && Math.sin(elapsed + s.seed) > .4 ? 'Sheep_Grass' : 'Sheep_Idle'}`), s.x, s.y, 77, animTime + s.seed, 6, Math.sin(animTime * .13 + s.seed) > 0 ? 1 : -1) });
    for (const v of villagers) renderables.push({ y: v.y, draw: () => drawSprite(blue('Pawn', `Interact ${v.tool}`), v.x, v.y, 104, animTime, 8, v.facing) });
    for (const u of [...enemies, ...allies]) if (u.hp > 0) renderables.push({ y: u.y, draw: () => drawUnit(u) });
    renderables.push({ y: hero.y, draw: () => drawUnit(hero, true) });
    renderables.sort((a, b) => a.y - b.y).forEach(r => r.draw());
    for (const p of projectiles) {
      const arrow = img(`Units/${p.color} Units/Archer/Arrow.png`);
      if (arrow) { ctx.save(); ctx.translate(p.x, p.y - 22); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.drawImage(arrow, -21, -21, 42, 42); ctx.restore(); }
    }
    for (const e of effects) drawSprite(e.path, e.x, e.y, e.size, e.time, e.fps, 1, Math.min(1, e.life * 3));
    for (const hit of impacts) {
      const progress = 1 - hit.life / hit.duration;
      ctx.save(); ctx.translate(hit.x, hit.y); ctx.globalAlpha = Math.min(1, hit.life * 7);
      ctx.strokeStyle = hit.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 5 + progress * 17, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const angle = hit.angle + i * Math.PI * 2 / 7, radius = 6 + progress * 29;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .75;
        ctx.strokeStyle = i % 2 ? '#fff8d8' : hit.color; ctx.lineWidth = i % 2 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(x * .55, y * .55); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    }
    for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.font = `bold ${f.large ? 17 : 12}px Segoe UI`; ctx.textAlign = 'center'; ctx.strokeStyle = '#142c23'; ctx.lineWidth = 4; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
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
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function addEffect(path, x, y, size = 90, life = .55, fps = 14) { if(effects.length>=80)effects.shift(); effects.push({ path, x, y, size, life, time: 0, fps }); }
  function float(text, x, y, color = '#f4d790', large = false) {
    let fy = y - 30;
    for (let attempts = 0; attempts < 5; attempts++) {
      if (!floaters.some(f => Math.abs(f.x - x) < 40 && Math.abs(f.y - fy) < 18)) break;
      fy -= 18;
    }
    floaters.push({ text, x, y: fy, life: large ? .8 : .9, color, large });
    if (floaters.length > 35) floaters.shift();
  }
  function notify(text) { $('toast').textContent = text; $('toast').classList.add('show'); toastTimer = 3; }
  function announce(title, subtitle) {
    $('announcement').replaceChildren(document.createTextNode(title));
    const small = document.createElement('small'); small.textContent = subtitle; $('announcement').append(small);
    $('announcement').classList.add('show'); announcementTimer = 2.5;
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
    if (Math.abs(dx) > .1 && !(entity.attack > 0) && !(entity.stagger > 0)) entity.facing = dx > 0 ? 1 : -1;
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
    resetCombatStats();combatId=0;pressureActive=0;pressureGap=0;approachSlots.clear();engagements.clear();combatUnits.length=0;collectingHeroDamage=false;pendingHeroDamage=null;lastCombatCue.clear();
    Object.assign(hero,{impactHold:0,damageCue:0,dodgeCue:0,missCue:0,lastDamageTime:-99,stepTimer:0});
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
    keys.clear(); pointerAttack = false; hero.attackBuffer=0; state = 'playing';
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
    state = won ? 'won' : 'lost'; keys.clear(); pointerAttack = false; hero.attackBuffer=0;
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
    const lane = (plan?.lanes||[-1,0,1,-2,2])[spawned % 5];
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
    const restored = Math.min(45, hero.maxHp - hero.hp);
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
    if (node.type === 'gold') { gold += 10; float('+10 emas', node.x, node.y); }
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
    impacts.push({ x: target.x, y: target.y - (target === castle ? 40 : 27), angle, color: target === hero || target.team === 'ally' ? '#ff977d' : '#ffdb86', life: .3, duration: .3 });
    float(`−${Math.ceil(appliedDamage)}`, target.x, target.y - (target === castle ? 45 : 10), target === hero ? '#ffbaa1' : '#fff1c5', true);
    if (target === hero) {
      hero.invuln = .45;hero.damageDirection=angle;hero.damageCue=.35; shake = Math.max(shake, 3); $('gameShell').classList.add('player-hit');combatCue('hurt');
    } else if (target === castle) { playSample(['impactWood_heavy_000.ogg'],castle,.55,.85,2);shake = Math.max(shake, 2); addEffect('Particle FX/Explosion_02.png', castle.x + rand(-45, 45), castle.y - 20, 65, .35, 24); }
    else if (source === hero) { shake = Math.max(shake, 1.5);holdImpactPose(hero);if(!hero.strike||hero.strike.hits.size===1)combatCue('hit',target); }
    if(target!==castle&&!target.isBoss)holdImpactPose(target);
    if (target !== castle && !target.isBoss) {
      if (target === hero) {cancelHeroSwing(true);hero.work = null;hero.attackBuffer=0;}
      const force = target.kind === 'Lancer' ? 140 : target === hero ? 195 : 255;
      target.knockX = Math.cos(angle) * force; target.knockY = Math.sin(angle) * force;
      target.stagger = target === hero ? .09 : .12;
      target.strike = null;
      target.attack = 0;
    }
    if (target.hp <= 0 && target.team === 'enemy' && !target.dead) {
      releaseApproach(target);approachSlots.delete(target);
      target.dead = true; kills++; score += target.isBoss?500:25 + waveIndex * 5; gold += target.isBoss?50:6;
      addEffect('Particle FX/Explosion_01.png', target.x, target.y - 9, 75);
      drops.push({ x: target.x, y: target.y, type: gameRandom() > .7 ? 'wood' : 'gold', life: 18, value: 5 });
      tone(320, .075, 'triangle', .02, 540);
    } else if (target.hp <= 0 && target.team === 'ally' && !target.dead) { releaseApproach(target);approachSlots.delete(target);target.dead = true; addEffect('Particle FX/Dust_02.png', target.x, target.y, 70); }
    target.hp = Math.max(0, target.hp);
  }
  function heroAttack() {
    if (state !== 'playing' || hero.cooldown > 0 || hero.stagger > 0 || hero.dash > 0) return;
    hero.attackBuffer = 0;
    hero.work = null;
    hero.attack = hero.attackDuration = .42; hero.cooldown = .58*(1-ranks.rhythm*.06);
    const targets = enemies.filter(e => e.hp > 0 && dist(hero, e) < 94 && clearPath(hero,e)).sort((a, b) => dist(hero, a) - dist(hero, b));
    if (targets.length) hero.facing = targets[0].x < hero.x ? -1 : 1;
    hero.strike = { elapsed:0, facing:hero.facing, target:targets[0]||null, hits:new Set() };
    combatStats.swings++;
    tone(380, .1, 'triangle', .018, 110);
  }
  function cancelHeroSwing(interrupted){
    if(hero.strike){combatStats[interrupted?'interruptions':'cancels']++;hero.strike=null;}
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
    const from=-SWING.angle+2*SWING.angle*clamp((previous-SWING.start)/(SWING.end-SWING.start),0,1);
    const to=-SWING.angle+2*SWING.angle*clamp((current-SWING.start)/(SWING.end-SWING.start),0,1);
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
        const primary=s.hits.size===0,bonus=primary&&hero.riposte>0?12+ranks.counter*6:0;
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
    if(state!=='playing'||hero.dash>0)return;
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
    if(u.team!=='enemy'||target!==hero||u.kind==='Archer')return true;
    const limit=difficulty==='easy'?2:difficulty==='hard'?4:3;
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
      const capacity=u.team==='ally'?16:12,healed=Math.min(wounded.maxHp-wounded.hp,capacity);
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
      if (u.cooldown <= 0) { u.attack = u.attackDuration = .72; u.cooldown = 1.6; u.strike = { timer: .31, target, range: 225 }; }
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
    pressureGap=Math.max(0,pressureGap-dt);pressureActive=0;
    for(const u of enemies)if(u.hp>0&&(u.strike?.target===hero&&u.kind!=='Archer'||u.isBoss&&u.bossAction?.stage==='warning'))pressureActive++;
    orderPulse=Math.max(0,orderPulse-dt);
    elapsed += dt; gatherCooldown = Math.max(0, gatherCooldown - dt); hero.cooldown = Math.max(0, hero.cooldown - dt); hero.attack = Math.max(0, hero.attack - dt); hero.invuln = Math.max(0, hero.invuln - dt);
    hero.healCooldown = Math.max(0, hero.healCooldown - dt);
    hero.dashCooldown=Math.max(0,(hero.dashCooldown||0)-dt);hero.riposte=Math.max(0,(hero.riposte||0)-dt);
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
    updateHeroSwing(dt);
    const dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    const dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    if ((dx || dy) && hero.work) { hero.work = null; gatherCooldown = .2; }
    if((dx||dy)&&!dashing){const length=Math.hypot(dx,dy);hero.lastMoveX=dx/length;hero.lastMoveY=dy/length;}
    if (!dashing && hero.stagger <= 0) move(hero, dx, dy, dt, 185 * (hero.attack > 0 ? .55 : 1));
    hero.stepTimer=Math.max(0,(hero.stepTimer||0)-dt);if(hero.moving&&!dashing&&hero.stepTimer<=0){playSample(['footstep_grass_000.ogg','footstep_grass_001.ogg'],hero,.16,1,0);hero.stepTimer=.32;}
    if ((keys.has(' ') || pointerAttack) && hero.work) { hero.work = null; gatherCooldown = .18; }
    updateWork(dt);
    if (keys.has(' ') || pointerAttack || hero.attackBuffer>0) heroAttack();
    hero.attackBuffer=Math.max(0,(hero.attackBuffer||0)-dt);
    if (keys.has('e')) gather();
    for (const s of sheep) s.cooldown = Math.max(0, s.cooldown - dt);
    if (phase === 'prepare') { waveTimer -= dt; if (dist(hero, castle) < 155) hero.hp = Math.min(hero.maxHp, hero.hp + 4 * dt); if (waveTimer <= 0) startWave(); }
    else {
      spawnTimer -= dt;
      if (spawned < waves[waveIndex].count && spawnTimer <= 0) {
        const batch = Math.min(3, waves[waveIndex].count - spawned);
        for (let i = 0; i < batch; i++) spawnEnemy();
        spawnTimer = waves[waveIndex].interval * 1.9*settings().interval;
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
      const node = nearestResource(); $('interactionHint').hidden = !node;
      if (node) $('interactionHint').querySelector('span').textContent = `${node.name} · tahan E`;
    }
    if (soundOn && (melodyTimer -= dt) <= 0) { melodyTimer = 2.6; tone([262, 294, 330, 392, 440][Math.floor(elapsed / 2.6) % 5], 1.1, 'sine', .025,undefined,'music'); }
  }
  function updateUI() {
    $('followButton').setAttribute('aria-pressed',String(squadOrder==='follow'));$('guardButton').setAttribute('aria-pressed',String(squadOrder==='guard'));
    $('squadHint').textContent=`${allies.length} sekutu · ${squadOrder==='follow'?'Ikuti penjaga, lindungi sekitarnya':'Jaga halaman kastel, jangan mengejar terlalu jauh'}`;
    $('modeBadge').textContent=settings().name;
    $('bossBar').hidden=!(boss&&boss.hp>0);$('arena').classList.toggle('boss-active',!!(boss&&boss.hp>0));
    if(boss&&boss.hp>0){$('bossHealth').style.width=`${boss.hp/boss.maxHp*100}%`;$('bossValue').textContent=`${Math.ceil(boss.hp)} / ${boss.maxHp}`;const a=boss.bossAction;$('bossIntent').textContent=a?.stage==='warning'?({slam:'HANTAMAN · KELUAR DARI LINGKARAN',charge:'TERJANGAN · HINDARI JALURNYA',volley:'HUJAN PANAH · CARI PERLINDUNGAN'}[a.type])+` · ${Math.max(0,a.time).toFixed(1)} dtk`:a?.stage==='recovery'?'TERBUKA · DAMAGE PEDANG +30%':boss.enraged?'MENGAMUK · BERSIAP MENGHINDAR':'GARDA AKTIF · SERANGAN SEKUTU TEREDAM';}

    const cd=hero.dashCooldown||0,ready=cd<=0;
    $('dashLabel').textContent=hero.riposte>0?'Balasan siap!':ready?'Langkah Embun':`Pulih ${cd.toFixed(1)} dtk`;
    $('dashButton').disabled=state!=='playing'||!ready;
    $('dashFill').style.width=`${(1-cd/dashCooldown())*100}%`;
    $('touchDash').disabled=state!=='playing'||!ready;$('touchDash').textContent=ready?'➶':cd.toFixed(1);
    $('campButton').disabled=phase!=='prepare';$('campButton').textContent=phase!=='prepare'?'Perkemahan · jeda':campPurchase===waveIndex?'Penempaan selesai · U':'✦ Pilih upgrade · U';

    $('heroHealth').textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`; $('heroHealthBar').style.width = `${hero.hp/hero.maxHp*100}%`;
    $('castleHealth').textContent = `${Math.ceil(castle.hp)} / ${castle.maxHp}`; $('castleHealthBar').style.width = `${castle.hp/castle.maxHp*100}%`;
    $('goldCount').textContent = gold; $('woodCount').textContent = wood; $('foodCount').textContent = food; $('scoreCount').textContent = String(score).padStart(4, '0');
    const w = waves[waveIndex];
    $('waveCount').textContent = `${phase === 'prepare' ? waveIndex : waveIndex + 1} / 5`;
    $('waveTitle').textContent = phase === 'prepare' ? `Jeda · ${Math.max(0, Math.ceil(waveTimer))} dtk` : `Gelombang ${waveIndex + 1}`;
    $('waveDetail').textContent = `${settings().name} · ${encounters[waveIndex]?.name||w.name}`;
    $('waveProgress').style.width = `${phase === 'prepare' ? (1 - waveTimer / (waveIndex === 0 ? 22 : 15)) * 100 : (spawned - enemies.filter(u=>!u.isBoss).length) / w.count * 100}%`;
    $('enemyCount').textContent = phase === 'prepare' ? `${allies.length} sekutu bersiap` : `${enemies.length + w.count - spawned+(waveIndex===4&&!bossSpawned?1:0)} musuh tersisa`;
    $('phaseHint').textContent = phase === 'prepare' ? encounters[waveIndex]?.hint||'U: pilih upgrade · Shift: dash menghindar.' : 'Musuh mendekat. Rumahmu membutuhkanmu.';
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
    state = pause ? 'paused' : 'playing'; keys.clear(); pointerAttack = false; hero.attackBuffer=0;
    $('pauseScreen').hidden = !pause; $('pauseButton').textContent = pause ? '▶' : 'Ⅱ';
    $('pauseButton').setAttribute('aria-label', pause ? 'Lanjutkan permainan' : 'Jeda permainan');
    $('interactionHint').hidden = true;
    if (pause) $('resumeButton').focus({ preventScroll: true }); else canvas.focus({ preventScroll: true });
  }
  function advance(dt) {
    if(state!=='playing'){simulationAccumulator=0;return;}
    simulationAccumulator += Math.min(.1,Math.max(0,dt));
    for(let steps=0;simulationAccumulator+1e-9>=FIXED_STEP&&steps<6&&state==='playing';steps++){
      simulationAccumulator=Math.max(0,simulationAccumulator-FIXED_STEP);update(FIXED_STEP);
    }
  }
  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000, .1) || .016; lastTime = time;
    if (state !== 'paused' && !document.querySelector('dialog[open]') && state !== 'won' && state !== 'lost') animTime += dt;
    advance(dt);
    if (state !== 'paused') {
      for (const e of effects) { e.life -= dt; e.time += dt; }
      effects = effects.filter(e => e.life > 0);
      for (const impact of impacts) impact.life -= dt;
      impacts = impacts.filter(impact => impact.life > 0);
      for (const f of floaters) { f.life -= dt; f.y -= dt * 26; } floaters = floaters.filter(f => f.life > 0);
      shake = Math.max(0, shake - dt * 16);
      if ((announcementTimer -= dt) <= 0) $('announcement').classList.remove('show');
      if ((toastTimer -= dt) <= 0) $('toast').classList.remove('show');
    }
    draw(); requestAnimationFrame(frame);
  }

  // Dialogs stop the battle and resume only if it was running beforehand.
  function openDialog(id) {
    if (document.querySelector('dialog[open]')) return;
    simulationAccumulator = 0;
    pausedForDialog = state === 'playing'; if (pausedForDialog) { state = 'paused'; keys.clear(); pointerAttack = false; hero.attackBuffer=0; }
    if (id === 'galleryDialog' && !$('galleryGrid').children.length) renderGallery();
    $(id).showModal();
  }
  for (const id of ['helpDialog', 'galleryDialog', 'campDialog','audioDialog']) {
    $(id).addEventListener('close', () => { if (pausedForDialog) { state = 'playing'; canvas.focus({ preventScroll: true }); } pausedForDialog = false; });
    $(id).addEventListener('click', e => { if (e.target === $(id)) { const r = $(id).getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $(id).close(); } });
  }
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>setDifficulty(b.dataset.difficulty)));
  $('titleButton').addEventListener('click',showTitle);
  $('followButton').addEventListener('click',()=>{setSquadOrder('follow');canvas.focus({preventScroll:true});});
  $('guardButton').addEventListener('click',()=>{setSquadOrder('guard');canvas.focus({preventScroll:true});});
  $('dashButton').addEventListener('click',()=>{startDash();canvas.focus({preventScroll:true});});
  $('touchDash').addEventListener('pointerdown',e=>{e.preventDefault();startDash();});
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
    if(key==='shift'){e.preventDefault();if(!e.repeat)startDash();return;}
    const controls = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ', 'e', '1', '2', 'q'];
    if (!controls.includes(key)) return;
    // Native buttons retain keyboard activation when deliberately focused.
    if (key === ' ' && e.target.tagName === 'BUTTON') return;
    e.preventDefault(); keys.add(key);if(key===' '&&!e.repeat)requestAttack();
    if (!e.repeat) { if (key === '1') recruitUnit(); if (key === '2') repairCastle(); if (key === 'q') healHero(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); pointerAttack = false; hero.attackBuffer=0; if (state === 'playing') togglePause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(true); });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; if (state === 'playing') { canvas.focus({ preventScroll: true }); pointerAttack = true; requestAttack(); canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointerup', () => { pointerAttack = false; }); canvas.addEventListener('pointercancel', () => { pointerAttack = false; });
  for (const b of document.querySelectorAll('[data-move]')) {
    const key = { up: 'w', left: 'a', down: 's', right: 'd' }[b.dataset.move];
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (state === 'playing') keys.add(key); });
    const release = () => keys.delete(key); b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  }
  for (const [id, key] of [['touchAttack', ' '], ['touchGather', 'e']]) {
    const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (state === 'playing') {keys.add(key);if(key===' ')requestAttack();} });
    const release = () => keys.delete(key); b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  }

  // Read-only state for meaningful smoke tests and inspecting an active match.
  window.PenjagaPulau = Object.freeze({ snapshot: () => ({ runSeed,encounters:encounters.map(e=>({name:e.name,roster:[...e.roster]})),audio:{decoded:sampleBuffers.size,failed:audioFailures,voices:activeVoices,effectsVolume,musicVolume,enabled:soundOn},combat:{...combatStats,damageBySource:{...combatStats.damageBySource}},difficulty,squadOrder,boss:boss?{hp:boss.hp,maxHp:boss.maxHp,enraged:boss.enraged,action:boss.bossAction?{type:boss.bossAction.type,stage:boss.bossAction.stage,time:boss.bossAction.time}:null}:null, state, phase, wave: waveIndex + 1, waveTimer, spawned, enemies: enemies.map(u => ({ x: u.x, y: u.y, hp: u.hp, kind: u.kind, isBoss:!!u.isBoss, entering: u.entering, hitFlash: u.hitFlash, stagger: u.stagger })), allies: allies.map(u => ({ x: u.x, y: u.y, hp: u.hp, kind: u.kind,formationSlot:u.formationSlot })), hero: { x: hero.x, y: hero.y, hp: hero.hp, hitFlash: hero.hitFlash, stagger: hero.stagger }, impacts: impacts.length, damageDealt, damageTaken, dash: {active:hero.dash||0,cooldown:hero.dashCooldown||0,riposte:hero.riposte||0}, upgrades:{...ranks},campPurchased:campPurchase===waveIndex, work: hero.work ? {type: hero.work.node.type, elapsed: hero.work.elapsed, duration: hero.work.duration} : null, castleHp: castle.hp, gold, wood, food, score, kills, loadedAssets: [...images.values()].filter(r => r.loaded).length, assetCount: manifest.size }) });
  setDifficulty('normal');
  resize(); preload(); requestAnimationFrame(frame);
})();
