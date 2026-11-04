/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installDirector = function ({director, world, config, math, audio, renderer, ui, session, lifecycle, bossSystem}) {
    const timing = world.arrivalTiming;
    const directionLabel = id => world.entryPaths.get(id).warningLabel || id;
    const enemySpeed = (kind, waveIndex) =>
      ((kind === 'Lancer' ? 59 : kind === 'Pawn' ? 75 : 66) + waveIndex * 5) * director.settings().speed;

    function estimateTravel(pathId, spawn, lane, speed) {
      const path = world.entryPaths.get(pathId);
      let previous = {
        x: spawn.x + lane * path.entryLaneOffset.x,
        y: spawn.y + lane * path.entryLaneOffset.y
      };
      let distance = 0;
      for (let i = 1; i < path.points.length; i++) {
        const point = path.points[i];
        const next = i === path.points.length - 1 ? {
          x: point.x + lane * path.exitLaneOffset.x,
          y: point.y + lane * path.exitLaneOffset.y
        } : point;
        distance += math.dist(previous, next);
        previous = next;
      }
      return Math.max(0, distance - path.exitRadius) / speed;
    }

    function scheduleArrivals(plan, waveIndex) {
      const alternating = waveIndex < timing.alternatingWaves;
      // Keep the second wave's 5/5 split while alternating complete groups.
      const counts = waveIndex === 1 && plan.roster.length === 10 ?
        [3, 3, 2, 2] : plan.groups.map(group => group.count);
      const gap = alternating ? timing.alternatingGap : timing.pairedGap;
      const events = [];
      let start = 0;
      for (const [packet, count] of counts.entries()) {
        const slotsByPath = new Map();
        for (let slot = start; slot < start + count; slot++) {
          const direction = alternating ? packet : slot;
          const pathId = world.wavePathIds[direction % world.wavePathIds.length];
          if (!slotsByPath.has(pathId)) slotsByPath.set(pathId, []);
          slotsByPath.get(pathId).push(slot);
        }
        for (const [pathId, slots] of slotsByPath) {
          const spawn = world.waveSpawns.get(pathId);
          const firstTravel = Math.min(...slots.map(slot =>
            estimateTravel(pathId, spawn, plan.spawnLanes[slot], enemySpeed(plan.roster[slot], waveIndex))));
          const arrival = packet * gap;
          events.push({packet, pathId, slots, arrival, departure: arrival - firstTravel});
        }
        start += count;
      }
      const offset = timing.firstDeparture - Math.min(...events.map(event => event.departure));
      for (const event of events) {
        event.departure += offset;
        event.arrival += offset;
      }
      return events.sort((a, b) => a.departure - b.departure);
    }
    director.makeEncounters = function makeEncounters(seed){
      const random=math.seededRandom(seed);
      const deck=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
      return config.waves.map((w,index)=>{
        const styleIndex=index<4?deck[Math.max(0,index-1)]:(deck[2]+1+Math.floor(random()*2))%3;
        const style=config.waveStyles[styleIndex],roster=[];
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
        for(const g of groups)g.delay=w.interval*1.9*(index===0?1:math.clamp(g.threat/average,.85,1.15));
        return {name:index===0?w.name:style.name,hint:index===0?'Jaga jarak, baca ayunan musuh, lalu balas.':style.hint,roster:ordered,lanes,spawnLanes,groups,interval:w.interval};
      });
    };

    director.startWave = function startWave() {
      session.phase = 'battle'; session.spawned = 0; session.spawnTimer = .3;
      if (timing) {
        director.arrivalSchedule = scheduleArrivals(session.encounters[session.waveIndex], session.waveIndex);
        director.waveStartedAt = session.elapsed;
        director.departureCursor = 0;
        director.bossEntry = null;
      }
      const w = config.waves[session.waveIndex];
      ui.announce(`Gelombang ${session.waveIndex + 1}`, (session.encounters[session.waveIndex]?.name||w.name).toUpperCase());
      audio.tone(220, .25, 'triangle', .04, 330);
    };

    director.finishWave = function finishWave() {
      ui.setEntryWarning('');
      const reward = 30 + session.waveIndex * 10;
      session.gold += reward; session.wood += 15; session.food += 1; session.score += 150 + session.waveIndex * 50;
      session.hero.hp = Math.min(session.hero.maxHp, session.hero.hp + 25);
      if (session.waveIndex === config.waves.length - 1) { lifecycle.finish(true); return; }
      session.waveIndex++; session.phase = 'prepare'; session.waveTimer = 15;
      ui.announce('Gelombang ditaklukkan!', `+${reward} EMAS · +15 KAYU · +1 BEKAL`);
      audio.tone(523, .2); setTimeout(() => audio.tone(659, .3), 160);
    };

    director.spawnEnemy = function spawnEnemy(pathId = world.wavePathIds[0], slot = session.spawned) {
      const w = config.waves[session.waveIndex],plan=session.encounters[session.waveIndex],kind=plan?.roster[slot%w.count]||w.types[slot%w.types.length];
      const spawn = world.waveSpawns.get(pathId), path = world.entryPaths.get(pathId);
      if (!spawn || !path) throw new Error('Unknown wave entry: ' + pathId);
      const plannedLane = plan?.spawnLanes?.[slot]??(plan?.lanes||[-1,0,1,-2,2])[slot % 5];
      const lane = spawn.lanes.includes(plannedLane) ? plannedLane : spawn.lanes[slot % spawn.lanes.length];
      const jitter = ([min, max]) => min === max ? min : math.rand(min, max);
      const entry = {
        x: spawn.x + jitter(spawn.jitter.x) + lane * path.entryLaneOffset.x,
        y: spawn.y + jitter(spawn.jitter.y) + lane * path.entryLaneOffset.y
      };
      const baseHp = ({ Warrior: 62, Archer: 43, Lancer: 82, Monk: 48, Pawn: 38 }[kind]) + session.waveIndex * 9;
      const hp=Math.round(baseHp*director.settings().hp);
      session.enemies.push({ combatId:++session.combatId, x: entry.x, y: entry.y, kind, color: session.waveIndex === 4 ? ['Red', 'Purple', 'Yellow', 'Black'][slot % 4] : w.color, hp, maxHp: hp, facing: 1, moving: false, attack: 0, cooldown: math.rand(.1, .6), seed: math.rand(0, 10), speed: enemySpeed(kind, session.waveIndex), team: 'enemy', entering: true, lane, flankAngle: slot * 2.399963 + session.waveIndex * .8, flankSign: slot % 2 ? -1 : 1, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
      renderer.addEffect('Particle FX/Dust_02.png', entry.x, entry.y, 48); session.spawned++;
      const enemy = session.enemies[session.enemies.length - 1]; enemy.chargeCooldown = 2; enemy.charge = 0;
      enemy.pathId = pathId;
      enemy.entryWaypoint = 1;
      if (path.points[1].x < spawn.x) enemy.facing = -1;
    };

    function updateScheduledSpawns() {
      const time = session.elapsed - director.waveStartedAt;
      const events = director.arrivalSchedule;
      while (director.departureCursor < events.length && events[director.departureCursor].departure <= time) {
        const {pathId, slots} = events[director.departureCursor++];
        for (const slot of slots) director.spawnEnemy(pathId, slot);
      }
      const finalWave = session.waveIndex === config.waves.length - 1;
      if (finalWave && !director.bossEntry && session.spawned >= Math.ceil(config.waves[session.waveIndex].count / 2)) {
        const spawn = world.bossSpawn;
        const departure = time + 1.25;
        const arrival = departure + estimateTravel(spawn.pathId, spawn, spawn.lanes[0], 62 * director.settings().speed);
        director.bossEntry = {departure, arrival};
      }
      const bossEntry = director.bossEntry;
      if (bossEntry && time >= bossEntry.departure && !session.bossSpawned) bossSystem.spawnBoss();

      const visible = arrival => time >= arrival - timing.warningLead && time < arrival + .35;
      const paths = new Set(events.filter(event => visible(event.arrival)).map(event => event.pathId));
      const labels = world.wavePathIds.filter(id => paths.has(id)).map(directionLabel);
      if (bossEntry && visible(bossEntry.arrival)) labels.push('Panglima ' + directionLabel(world.bossSpawn.pathId));
      ui.setEntryWarning(labels.join(' · '));
    }

    director.updateSpawns = function (dt) {
      if (timing) { updateScheduledSpawns(); return; }
      const wave = config.waves[session.waveIndex];
      const plan = session.encounters[session.waveIndex];
      const packet = () => plan?.groups?.find(g => session.spawned >= g.start && session.spawned < g.start + g.count);
      session.spawnTimer -= dt;
      if (session.spawned < wave.count && session.spawnTimer <= 0) {
        const group = packet();
        const batch = Math.min(group ? group.start + group.count - session.spawned : 3, wave.count - session.spawned);
        for (let i = 0; i < batch; i++) director.spawnEnemy();
        session.spawnTimer = (group?.delay || wave.interval * 1.9) * director.settings().interval;
      }

      if (session.waveIndex === config.waves.length - 1 && session.spawned >= Math.ceil(wave.count / 2) && !session.bossSpawned) {
        bossSystem.spawnBoss();
      }
    };

    director.settings = ()=>config.difficulties[session.difficulty];
  };
})(window.PenjagaModules = window.PenjagaModules || {});
