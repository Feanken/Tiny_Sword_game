/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installBossSystem = function ({bossSystem, world, config, math, audio, renderer, ui, session, director, navigation, ai, combat}) {
    bossSystem.traceCharge = function traceCharge(origin,dx,dy,length){
      let traveled=0;
      while(traveled<length){
        const next=Math.min(length,traveled+2),x=origin.x+dx*next,y=origin.y+dy*next;
        if(!navigation.positionFits(x,y))break;
        traveled=next;
      }
      return {x:origin.x+dx*traveled,y:origin.y+dy*traveled,distance:traveled};
    };

    bossSystem.spawnBoss = function spawnBoss(){
      if(session.waveIndex!==4||session.bossSpawned)return false;
      session.bossSpawned=true;const hp=director.settings().bossHp;
      const spawn = world.bossSpawn, path = world.entryPaths.get(spawn.pathId);
      const lane = spawn.lanes[0];
      session.boss={combatId:++session.combatId,x:spawn.x + lane * path.entryLaneOffset.x,y:spawn.y + lane * path.entryLaneOffset.y,kind:'Warrior',color:'Black',hp,maxHp:hp,facing:1,moving:false,attack:0,cooldown:1,seed:0,speed:62*director.settings().speed,team:'enemy',entering:true,lane,pathId:spawn.pathId,entryWaypoint:1,flankSign:1,isBoss:true,hitFlash:0,stagger:0,knockX:0,knockY:0,bossAction:null,abilityCooldown:.5,pattern:0,patternMask:0,lastPattern:-1,enraged:false};
      session.enemies.push(session.boss);session.spawnTimer=Math.max(session.spawnTimer,session.difficulty==='easy'?2.2:session.difficulty==='hard'?1.4:1.8);
      ui.announce('Panglima Kelam','BACA TANDANYA · HINDARI · BALAS');return true;
    };

    bossSystem.chooseBossPattern = function chooseBossPattern(u,target){
      if(u.patternMask===7)u.patternMask=0;
      const d=math.dist(u,target),charge=bossSystem.traceCharge(u,(target.x-u.x)/Math.max(1,d),(target.y-u.y)/Math.max(1,d),252);
      let clustered=0;for(const f of [session.hero,...session.allies])if(f.hp>0&&math.dist(f,target)<105)clustered++;
      const scores=[(d<115?7:2)+Math.min(3,clustered),charge.distance>Math.min(d,130)?(d>115?7:2):-2,d>150&&ai.shotClear(u,target)?8:3];
      let selected=-1,score=-Infinity;
      for(let i=0;i<3;i++)if(!(u.patternMask&(1<<i))){const value=scores[i]-(u.lastPattern===i?20:0);if(value>score){selected=i;score=value;}}
      u.patternMask|=1<<selected;u.lastPattern=selected;u.pattern++;
      return ['slam','charge','volley'][selected];
    };

    bossSystem.recoverBoss = function recoverBoss(u,action){
      action.stage='recovery';action.time=action.recoveryDuration=Math.max(.85,config.bossRecoveryTimes[session.difficulty][action.type]-(u.enraged?.1:0));
    };

    bossSystem.bossIntentText = function bossIntentText(u){
      const a=u.bossAction,time=a?Math.max(0,a.time).toFixed(1):'0';
      if(a?.stage==='rally')return `FASE II · MENGAMUK · ${time} dtk`;
      if(a?.stage==='recovery')return `TERBUKA · PEDANG +30% · ${time} dtk`;
      if(a?.stage==='warning')return ({slam:'HANTAMAN · KELUAR DARI LINGKARAN',charge:'TERJANGAN · HINDARI JALURNYA',volley:'HUJAN PANAH · CARI PERLINDUNGAN'}[a.type])+` · ${time} dtk`;
      return u.enraged?'FASE II · BERSIAP MENGHINDAR':'FASE I · GARDA AKTIF';
    };

    bossSystem.beginBossRage = function beginBossRage(u){
      u.enraged=true;u.ragePending=false;u.moving=false;
      const duration=session.difficulty==='easy'?.9:session.difficulty==='normal'?.75:.6;
      u.bossAction={type:'rally',stage:'rally',time:duration,duration};
      ui.notify('Panglima mengamuk! Bersiap untuk tempo yang lebih cepat.');audio.combatCue('charge',u);
    };

    bossSystem.updateBoss = function updateBoss(u,dt){
      if(!u.enraged&&u.hp<=u.maxHp*.5)u.ragePending=true;
      u.abilityCooldown-=dt;
      const action=u.bossAction;
      if(action){
        action.time-=dt;u.moving=false;
        if(action.stage==='rally'){
          if(action.time<=0){u.bossAction=null;u.abilityCooldown=.35;}
        }else if(action.stage==='warning'&&action.time<=0){
          if(action.type==='slam'){
            for(const target of [session.hero,...session.allies,session.castle])if(target.hp>0&&math.dist(target,action.target)<105)combat.hurt(target,Math.round(24*director.settings().damage),u);
            renderer.addEffect('Particle FX/Explosion_02.png',action.target.x,action.target.y,160,.5,20);session.shake=3;
            bossSystem.recoverBoss(u,action);
          }else if(action.type==='volley'){
            const angle=Math.atan2(action.target.y-u.y,action.target.x-u.x);
            for(const offset of [-.22,0,.22]){combat.fireArrow(u,{x:u.x+Math.cos(angle+offset)*300,y:u.y+Math.sin(angle+offset)*300});session.projectiles[session.projectiles.length-1].damage=Math.round(22*director.settings().damage);}
            bossSystem.recoverBoss(u,action);
          }else {action.stage='charge';action.time=.45;}
        }else if(action.stage==='charge'){
          const previous={x:u.x,y:u.y},remaining=action.chargeEnd.distance-action.traveled;
          const step=Math.min(action.chargeSpeed*dt,Math.max(0,remaining));
          if(step>0){
            const next=action.traveled+step,x=action.origin.x+action.dx*next,y=action.origin.y+action.dy*next;
            if(navigation.positionFits(x,y)){u.x=x;u.y=y;action.traveled=next;u.moving=true;}else action.time=0;
          }
          if(math.dist(previous,u)>.001)for(const target of [session.hero,...session.allies,session.castle])if(target.hp>0&&!action.hit.has(target)&&Number.isFinite(math.segmentHit(previous,u,target,target===session.castle?62:36))&&(target===session.castle||navigation.clearPath(u,target))){combat.hurt(target,Math.round(27*director.settings().damage),u);action.hit.add(target);}
          if(action.time<=0||action.traveled>=action.chargeEnd.distance-.001)bossSystem.recoverBoss(u,action);
        }else if(action.stage==='recovery'&&action.time<=0){u.bossAction=null;u.abilityCooldown=u.enraged?.4:.65;}
        return;
      }
      if(u.ragePending){bossSystem.beginBossRage(u);return;}
      const target=math.dist(u,session.hero)>430&&math.dist(u,session.castle)<160?session.castle:session.hero;
      if(math.dist(u,target)>220){navigation.steerMove(u,target,dt);return;}
      if(u.abilityCooldown>0){if(math.dist(u,target)>100)navigation.steerMove(u,target,dt,u.speed*.65);else u.moving=false;return;}
      const type=bossSystem.chooseBossPattern(u,target),length=Math.max(1,math.dist(u,target));
      u.facing=target.x<u.x?-1:1;u.moving=false;
      u.bossAction={type,stage:'warning',time:director.settings().warning,duration:director.settings().warning,target:{x:target.x,y:target.y},origin:{x:u.x,y:u.y},dx:(target.x-u.x)/length,dy:(target.y-u.y)/length,hit:new Set()};
      audio.combatCue(type,u);
      if(type==='charge'){const a=u.bossAction;a.chargeSpeed=u.enraged?650:560;a.chargeEnd=bossSystem.traceCharge(a.origin,a.dx,a.dy,a.chargeSpeed*.45);a.traveled=0;}
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
