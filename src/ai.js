/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installAi = function ({ai, world, config, math, renderer, ui, session, director, navigation, bossSystem, combat}) {
    ai.setSquadOrder = function setSquadOrder(order){
      if(session.state!=='playing'||!['follow','guard'].includes(order))return false;
      session.squadOrder=order;session.orderPulse=1.2;
      for(const u of session.allies){ai.releaseApproach(u);u.combatTarget=null;u.protectTarget=null;u.roleThink=0;u.evadeAction=null;u.evadeGoal=null;u.retreatGoal=null;u.repositionGoal=null;u.targetThink=0;u.arrowEvade=0;u.arrowGoal=null;u.arrowThink=0;u.supportThink=0;u.supportGoal=null;u.healTarget=null;u.healThink=0;u.strike=null;u.attack=0;u.route=[];u.routeTimer=0;u.stallSeconds=0;u.blockedSeconds=0;}
      ui.notify(order==='follow'?'Sekutu mengikuti penjaga dan melindungi sekitarmu.':'Sekutu kembali menjaga halaman kastel.');ui.updateUI();return true;
    };

    ai.squadAnchor = function squadAnchor(){return session.squadOrder==='guard'?{...world.squadGuard}:session.hero;};

    ai.squadHome = function squadHome(u){
      const slot=Number.isInteger(u.formationSlot)?u.formationSlot:0,angle=slot*2.399963,anchor=ai.squadAnchor();
      for(const radius of [session.squadOrder==='guard'?95:65,40])for(let i=0;i<8;i++){
        const a=angle+i*Math.PI/4,p={x:anchor.x+Math.cos(a)*radius,y:anchor.y+Math.sin(a)*50+20};
        if(navigation.positionFits(p.x,p.y))return p;
      }
      return navigation.positionFits(anchor.x,anchor.y)?{x:anchor.x,y:anchor.y}:{x:u.x,y:u.y};
    };

    ai.shotClear = function shotClear(source,target) {
      const origin={x:source.x,y:source.y-5};
      const hit=math.segmentHit(origin,target,target,target===session.castle?57:20);
      return navigation.obstacleList.every(o=>math.dist(source,o)<o.radius+10||math.segmentHit(origin,target,o,o.radius+2)>hit);
    };

    ai.combatTarget = function combatTarget(u,candidates,limit) {
      let best=null,bestCost=Infinity,bestVisible=null,visibleCost=Infinity,currentCost=Infinity,currentVisible=false;
      for(const target of candidates){
        const d=math.dist(u,target);if(target.hp<=0||d>=limit)continue;
        let bias=0;
        if(u.team){
          if(u.kind==='Archer')bias=target.kind==='Monk'?-28:target.kind==='Archer'?-14:0;
          else if(u.kind==='Warrior')bias=['Monk','Archer'].includes(target.kind)?-22:0;
          else if(u.kind==='Lancer')bias=target.strike?.target?.team===u.team?-40:['Warrior','Pawn'].includes(target.kind)?-18:0;
          if(target===u.protectTarget)bias-=55;
          else bias+=Math.max(0,(session.engagements.get(target)||0)-(u.combatTarget===target?1:0))*16;
        }
        const cost=Math.max(1,d+bias),visible=u.kind!=='Archer'||ai.shotClear(u,target);
        if(cost<bestCost){best=target;bestCost=cost;}
        if(visible&&cost<visibleCost){bestVisible=target;visibleCost=cost;}
        if(target===u.combatTarget){currentCost=cost;currentVisible=visible;}
      }
      const chosen=bestVisible||best,cost=bestVisible?visibleCost:bestCost;
      if(!u.combatTarget||currentCost===Infinity||currentCost>cost*1.25+12||bestVisible&&!currentVisible){
        if(u.combatTarget)session.engagements.set(u.combatTarget,Math.max(0,(session.engagements.get(u.combatTarget)||0)-1));
        u.combatTarget=chosen;if(chosen)session.engagements.set(chosen,(session.engagements.get(chosen)||0)+1);
      }
      return u.combatTarget;
    };

    ai.updateRole = function updateRole(u,dt){
      u.roleThink=(u.roleThink||0)-dt;if(u.roleThink>0)return;
      u.roleThink=.22+(u.combatId%3)*.025;u.protectTarget=null;
      if(!['Warrior','Lancer'].includes(u.kind))return;
      const friends=u.team==='ally'?session.allies:session.enemies,opponents=u.team==='ally'?session.enemies:[session.hero,...session.allies];
      let closest=Infinity;
      for(const f of friends)if(f.hp>0&&['Archer','Monk'].includes(f.kind)&&math.dist(u,f)<150){
        for(const t of opponents)if(t.hp>0&&math.dist(t,f)<95&&math.dist(u,t)<210){const d=math.dist(t,f);if(d<closest){closest=d;u.protectTarget=t;}}
      }
    };

    ai.bossDangerAt = function bossDangerAt(point,padding=14){
      const a=session.boss?.hp>0?session.boss.bossAction:null;if(!a||!['warning','charge'].includes(a.stage))return false;
      if(a.type==='slam')return math.dist(point,a.target)<105+padding;
      if(a.type==='charge')return Number.isFinite(math.segmentHit(a.origin,a.chargeEnd,point,36+padding));
      const angle=Math.atan2(a.dy,a.dx);
      for(const offset of [-.22,0,.22])if(Number.isFinite(math.segmentHit(a.origin,{x:a.origin.x+Math.cos(angle+offset)*500,y:a.origin.y+Math.sin(angle+offset)*500},point,20+padding)))return true;
      return false;
    };

    ai.evadeBoss = function evadeBoss(u,dt){
      if(u.team!=='ally')return false;
      const a=session.boss?.hp>0?session.boss.bossAction:null;
      if(!a||!['warning','charge'].includes(a.stage)){u.evadeAction=null;u.evadeGoal=null;return false;}
      if(u.evadeAction!==a){u.evadeAction=a;u.evadeDelay=.1+(u.combatId%3)*.035;u.evadeGoal=null;u.evadeThink=0;u.evadedThisAction=false;}
      u.evadeDelay-=dt;if(u.evadeDelay>0)return false;
      const dangerous=ai.bossDangerAt(u);
      if(!dangerous){
        u.evadeGoal=null;
        if(u.evadedThisAction&&!['Archer','Monk'].includes(u.kind)){u.moving=false;return true;}
        return false;
      }
      u.evadeThink=(u.evadeThink||0)-dt;
      let needsGoal=!u.evadeGoal;
      if(u.evadeThink<=0){u.evadeThink=.18;if(u.evadeGoal&&(!navigation.positionFits(u.evadeGoal.x,u.evadeGoal.y)||ai.bossDangerAt(u.evadeGoal,22)||!navigation.clearPath(u,u.evadeGoal)))needsGoal=true;}
      if(needsGoal){
        let best=null,cost=Infinity;const anchor=ai.squadAnchor(),leash=session.squadOrder==='guard'?235:320;
        for(const radius of [48,88,128,164])for(const v of config.approachOffsets){
          const p={x:u.x+v.x*radius,y:u.y+v.y*radius};
          if(ai.bossDangerAt(p,22)||math.dist(p,anchor)>leash||!navigation.positionFits(p.x,p.y)||!navigation.clearPath(u,p))continue;
          const score=radius+math.dist(p,anchor)*.04;if(score<cost){cost=score;best=p;}
        }
        if(best&&!u.evadedThisAction){session.combatStats.allyEvades++;u.evadedThisAction=true;}
        u.evadeGoal=best;u.evadeThink=.18;
      }
      if(!u.evadeGoal)return false;
      u.strike=null;u.attack=0;ai.releaseApproach(u);navigation.steerMove(u,u.evadeGoal,dt,u.speed*1.4);return true;
    };

    ai.tacticalRetreat = function tacticalRetreat(u,target,distance=76){
      const angle=Math.atan2(u.y-target.y,u.x-target.x),anchor=ai.squadAnchor(),leash=session.squadOrder==='guard'?235:320;
      let best=null,score=-Infinity;
      for(const radius of [distance,distance*.5])for(const offset of [0,.65,-.65,1.25,-1.25,Math.PI/2,-Math.PI/2]){
        const p={x:u.x+Math.cos(angle+offset)*radius,y:u.y+Math.sin(angle+offset)*radius};
        if(!navigation.positionFits(p.x,p.y)||!navigation.clearPath(u,p)||u.team==='ally'&&(math.dist(p,anchor)>leash||ai.bossDangerAt(p)))continue;
        const visible=ai.shotClear(p,target),cover=u.kind==='Monk'?(visible?0:55):(visible?35:0);
        const value=math.dist(p,target)+cover-Math.abs(offset)*8;
        if(value>score){score=value;best=p;}
      }
      return best;
    };

    ai.evadeProjectile = function evadeProjectile(u,dt){
      if(!['Archer','Monk'].includes(u.kind))return false;
      u.arrowThink=(u.arrowThink||0)-dt;u.arrowEvade=Math.max(0,(u.arrowEvade||0)-dt);
      if(u.arrowThink<=0){
        u.arrowThink=.12+(u.combatId%3)*.02;
        let incoming=null,soonest=Infinity;
        for(const p of session.projectiles){
          if(p.life<=0||p.team===u.team||math.dist(p,u)>140)continue;
          const end={x:p.x+p.vx*.35,y:p.y+p.vy*.35},time=math.segmentHit(p,end,u,23);
          if(time<soonest){incoming=p;soonest=time;}
        }
        if(incoming){
          const length=Math.hypot(incoming.vx,incoming.vy),px=-incoming.vy/length,py=incoming.vx/length;
          let goal=null,cost=Infinity;
          for(const side of [-1,1]){
            const p={x:u.x+px*side*44,y:u.y+py*side*44};
            if(!navigation.positionFits(p.x,p.y)||!navigation.clearPath(u,p)||u.team==='ally'&&(math.dist(p,ai.squadAnchor())>(session.squadOrder==='guard'?235:320)||ai.bossDangerAt(p)))continue;
            const score=math.dist(p,ai.squadAnchor());if(score<cost){goal=p;cost=score;}
          }
          if(goal){u.arrowGoal=goal;u.arrowEvade=.3;u.strike=null;u.attack=0;}
        }
      }
      if(u.arrowEvade>0&&u.arrowGoal){navigation.steerMove(u,u.arrowGoal,dt,u.speed*1.1);return true;}
      return false;
    };

    ai.firingPosition = function firingPosition(u,target){
      const angle=Math.atan2(u.y-target.y,u.x-target.x),anchor=ai.squadAnchor(),leash=session.squadOrder==='guard'?235:320;
      let best=null,cost=Infinity;
      for(const offset of [0,.55,-.55,1.1,-1.1]){
        const p={x:target.x+Math.cos(angle+offset)*185,y:target.y+Math.sin(angle+offset)*185};
        if(!navigation.positionFits(p.x,p.y)||!ai.shotClear(p,target)||u.team==='ally'&&(math.dist(p,anchor)>leash||ai.bossDangerAt(p)))continue;
        const score=math.dist(u,p)+(navigation.clearPath(u,p)?0:90);if(score<cost){cost=score;best=p;}
      }
      return best;
    };

    ai.releaseApproach = function releaseApproach(u){
      const slots=session.approachSlots.get(u.approachTarget);
      if(slots?.[u.approachSlot]===u)slots[u.approachSlot]=null;
      u.approachTarget=null;u.approachSlot=-1;
    };

    ai.approachPoint = function approachPoint(u,target,range){
      const radius=Math.min(68,range*.78);
      let slots=session.approachSlots.get(target);
      if(!slots){slots=Array(8).fill(null);session.approachSlots.set(target,slots);}
      if(u.approachTarget!==target){ai.releaseApproach(u);u.approachTarget=target;u.approachThink=0;}
      if((u.approachThink||0)<=0||u.approachSlot<0){
        let best=-1,cost=Infinity;
        for(let i=0;i<8;i++){
          if(slots[i]&&slots[i].hp<=0)slots[i]=null;
          if(slots[i]&&slots[i]!==u)continue;
          const p=config.approachOffsets[i],x=target.x+p.x*radius,y=target.y+p.y*radius;
          if(!navigation.positionFits(x,y))continue;
          const score=(x-u.x)**2+(y-u.y)**2-(i===u.approachSlot?400:0);
          if(score<cost){best=i;cost=score;}
        }
        if(best>=0){if(slots[u.approachSlot]===u)slots[u.approachSlot]=null;u.approachSlot=best;slots[best]=u;}
        u.approachThink=.3;
      }
      const p=config.approachOffsets[u.approachSlot];
      return p?{x:target.x+p.x*radius,y:target.y+p.y*radius}:target;
    };

    ai.mayStartMelee = function mayStartMelee(u,target){
      if(u.team!=='enemy'||target!==session.hero)return true;
      if(u.kind==='Archer'){
        const bossThreat=session.boss?.hp>0&&['warning','charge'].includes(session.boss.bossAction?.stage);
        const limit=Math.max(1,(session.difficulty==='easy'?1:session.difficulty==='hard'?3:2)-(bossThreat?1:0));
        let active=0;for(const e of session.enemies)if(e!==u&&e.hp>0&&e.kind==='Archer'&&e.strike?.target===session.hero)active++;
        if(active>=limit||session.rangedPressureGap>0){session.combatStats.rangedDeferrals++;return false;}
        session.rangedPressureGap=session.difficulty==='hard'?.1:.16;session.combatStats.maxRangedWindups=Math.max(session.combatStats.maxRangedWindups,active+1);return true;
      }
      let limit=session.difficulty==='easy'?2:session.difficulty==='hard'?4:3;
      if(session.boss?.hp>0&&session.boss.bossAction?.stage==='recovery'&&math.dist(session.hero,session.boss)<160)limit=session.difficulty==='hard'?2:1;
      if(session.pressureActive>=limit||session.pressureGap>0){session.combatStats.pressureDeferrals++;return false;}
      session.pressureActive++;session.pressureGap=session.difficulty==='hard'?.08:.12;
      session.combatStats.maxWindups=Math.max(session.combatStats.maxWindups,session.pressureActive);return true;
    };

    ai.separateCombatUnits = function separateCombatUnits(dt){
      for(let i=0;i<session.combatUnits.length;i++)for(let j=i+1;j<session.combatUnits.length;j++){
        const a=session.combatUnits[i],b=session.combatUnits[j];if(a.hp<=0||b.hp<=0||a.entering||b.entering)continue;
        const dx=a.x-b.x,dy=a.y-b.y,min=a.team===b.team?31:26,d2=dx*dx+dy*dy;
        if(d2>=min*min)continue;
        const d=Math.sqrt(d2),angle=(a.combatId||i)+(b.combatId||j)*2.399963;
        const force=(min-d)*Math.min(.25,dt*5),px=(d>.01?dx/d:Math.cos(angle))*force,py=(d>.01?dy/d:Math.sin(angle))*force;
        if(!a.isBoss)navigation.translateEntity(a,px*(b.isBoss?2:1),py*(b.isBoss?2:1));
        if(!b.isBoss)navigation.translateEntity(b,-px*(a.isBoss?2:1),-py*(a.isBoss?2:1));
      }
    };

    ai.healingTarget = function healingTarget(u,friends){
      let best=null,bestScore=-Infinity,ready=null,readyScore=-Infinity;
      for(const f of friends){
        if(f===u||f.hp<=0||f.hp>=f.maxHp)continue;
        if(u.team==='ally'&&math.dist(f,ai.squadAnchor())>(session.squadOrder==='guard'?235:320))continue;
        const d=math.dist(u,f);if(d>220)continue;
        const missing=f.maxHp-f.hp,urgency=1-f.hp/f.maxHp;
        const score=urgency*urgency*120+Math.min(missing,u.team==='ally'?16:12)*2-d*.04+(session.elapsed-(f.lastDamageTime??-99)<2?15:0);
        if(score>bestScore){bestScore=score;best=f;}
        if(d<140&&ai.shotClear(u,f)&&(missing>=8||urgency>.5)&&score>readyScore){ready=f;readyScore=score;}
      }
      return ready||best;
    };

    ai.updateHealer = function updateHealer(u,dt){
      u.healThink=(u.healThink||0)-dt;
      if(u.healThink<=0||u.healTarget&&(u.healTarget.hp<=0||u.healTarget.hp>=u.healTarget.maxHp)){
        u.healTarget=ai.healingTarget(u,u.team==='ally'?[session.hero,...session.allies]:session.enemies);u.healThink=.2;
        u.healThreat=math.nearest(u,u.team==='ally'?session.enemies:[session.hero,...session.allies],100);
        if(u.team==='enemy'){
          let front=null,d=Infinity;for(const f of session.enemies)if(f.hp>0&&!f.entering&&['Warrior','Lancer'].includes(f.kind)&&math.dist(u,f)<d){front=f;d=math.dist(u,f);}
          if(front){const distance=Math.max(1,math.dist(front,session.hero));u.supportHome={x:front.x+(front.x-session.hero.x)/distance*80,y:front.y+(front.y-session.hero.y)/distance*80};}
          else u.supportHome={x:620,y:410};
        }
      }
      const wounded=u.healTarget,home=u.team==='ally'?ai.squadHome(u):u.supportHome||u;
      if(wounded&&math.dist(u,wounded)<140&&u.cooldown<=0&&ai.shotClear(u,wounded)){
        const base=u.team==='ally'?16:12,capacity=base+(u.team==='ally'&&wounded===session.hero?session.ranks.oath*2:0),healed=Math.min(wounded.maxHp-wounded.hp,capacity);
        if(wounded===session.hero)session.combatStats.oathHealing+=Math.max(0,healed-base);
        wounded.hp+=healed;session.combatStats.healingDone+=healed;session.combatStats.healingWasted+=capacity-healed;
        u.attack=u.attackDuration=.45;u.cooldown=u.team==='ally'?3:4.5;u.moving=false;
        renderer.addEffect(math.blue('Monk','Heal_Effect'),wounded.x,wounded.y,110,.7);renderer.float(`+${Math.ceil(healed)}`,wounded.x,wounded.y,'#ceefa0');return;
      }
      const threat=u.healThreat;
      if(threat?.hp>0&&math.dist(u,threat)<80&&u.cooldown>0){
        u.supportThink=(u.supportThink||0)-dt;
        if(u.supportThink<=0||u.supportThreat!==threat){u.supportGoal=ai.tacticalRetreat(u,threat,65);u.supportThink=.24;u.supportThreat=threat;}
        const retreat=u.supportGoal;
        if(retreat){navigation.steerMove(u,retreat,dt);return;}
      }
      if(wounded&&u.team==='ally'&&ai.bossDangerAt(wounded)){u.moving=false;return;}
      if(wounded&&(!ai.shotClear(u,wounded)||math.dist(u,wounded)>100))navigation.steerMove(u,wounded,dt);
      else if(!wounded&&math.dist(u,home)>35)navigation.steerMove(u,home,dt);
      else u.moving=false;
    };

    ai.updateUnit = function updateUnit(u, dt) {
      u.approachThink=(u.approachThink||0)-dt;
      u.repositionThink=(u.repositionThink||0)-dt;
      u.attack = Math.max(0, u.attack - dt); u.cooldown -= dt;
      u.chargeCooldown = (u.chargeCooldown || 0) - dt; u.charge = Math.max(0, (u.charge || 0) - dt);
      if (u.hp <= 0) return;
      const anchor=ai.squadAnchor(),leash=session.squadOrder==='guard'?235:320;
      if(u.team==='ally'&&math.dist(u,anchor)>leash){
        ai.releaseApproach(u);u.combatTarget=null;u.strike=null;u.attack=0;u.evadeGoal=null;
        if(u.stagger>0){u.moving=false;return;}
        navigation.steerMove(u,ai.squadHome(u),dt,u.speed*1.15);return;
      }
      if(!u.isBoss&&!u.entering){ai.updateRole(u,dt);if(u.stagger<=0&&(ai.evadeBoss(u,dt)||ai.evadeProjectile(u,dt)))return;}
      if (u.strike) {
        u.strike.timer -= dt;
        if (u.strike.timer <= 0) {
          const strike = u.strike; u.strike = null;
          if (strike.target.hp > 0 && math.dist(u, strike.target) <= strike.range && (u.kind === 'Archer' || ((strike.target.x - u.x) * u.facing >= -12 && (strike.target === session.castle || navigation.clearPath(u, strike.target))))) {
            if (u.kind === 'Archer') {if(ai.shotClear(u,strike.target))combat.fireArrow(u, strike.target);}
            else combat.hurt(strike.target, strike.damage, u);
          }
        }
      }
      if (u.stagger > 0) { u.moving = false; return; }
      if (u.strike) { u.moving = false; return; }
      if (u.entering && navigation.followEntry(u, dt)) return;
      if(u.isBoss){bossSystem.updateBoss(u,dt);return;}
      if (u.kind === 'Monk') {
        ai.updateHealer(u,dt);
        return;
      }
      const target = u.team === 'enemy' && (u.blockedSeconds > 2 || u.stallSeconds > 3) ? session.castle : u.team === 'ally' ? ai.combatTarget(u, session.enemies.filter(e=>math.dist(e,anchor)<=leash),leash+150) : ai.combatTarget(u, [session.hero, ...session.allies],u.kind==='Archer'?240:200) || (math.dist(u, session.castle) < 130 && math.dist(u, session.hero) > 420 ? session.castle : session.hero);
      if(u.approachTarget&&u.approachTarget!==target)ai.releaseApproach(u);
      if (!target) { ai.releaseApproach(u);if (math.dist(u, ai.squadHome(u)) > 30) navigation.steerMove(u, ai.squadHome(u), dt); else u.moving = false; return; }
      const d = math.dist(u, target), range = u.kind === 'Archer' ? 225 : target === session.castle ? 88 : u.kind === 'Lancer' ? 91 : 51;
      const blocked=u.kind==='Archer'?!ai.shotClear(u,target):target!==session.castle&&d<=range&&!navigation.clearPath(u,target);
      if(blocked){
        if(u.kind==='Archer'&&u.repositionThink<=0){u.repositionGoal=ai.firingPosition(u,target);u.repositionThink=.3;if(u.repositionGoal)session.combatStats.repositions++;}
        navigation.steerMove(u,u.kind==='Archer'&&u.repositionGoal||target,dt);return;
      }
      if (u.kind === 'Archer' && d < (u.team==='ally'?110:145) && !u.strike) {
        if(u.repositionThink<=0||!u.retreatGoal){u.retreatGoal=ai.tacticalRetreat(u,target);u.repositionThink=.24;}
        if(u.retreatGoal)navigation.steerMove(u,u.retreatGoal,dt,u.speed*.95);else u.moving=false;u.facing=target.x<u.x?-1:1;
        if (u.cooldown <= 0&&ai.mayStartMelee(u,target)) { u.attack = u.attackDuration = .72; u.cooldown = 1.6; u.strike = { timer: .31, target, range: 225 }; }
        return;
      }
      if(u.kind==='Lancer'&&d<49&&u.cooldown>.25){const retreat=ai.tacticalRetreat(u,target,28);if(retreat){navigation.steerMove(u,retreat,dt,u.speed*.8);u.facing=target.x<u.x?-1:1;return;}}
      if (u.team === 'enemy' && u.kind === 'Warrior' && d > 100 && d < 250 && u.chargeCooldown <= 0) { u.charge = .65; u.chargeCooldown = 3.8; renderer.addEffect('Particle FX/Dust_01.png', u.x, u.y, 42); }
      if (d > range) {
        const aim = u.kind==='Archer'||target===session.castle?target:ai.approachPoint(u,target,range);
        if(u.team==='ally'&&u.kind!=='Archer'&&ai.bossDangerAt(aim)){u.moving=false;return;}
        navigation.steerMove(u, navigation.canStand(aim.x, aim.y) ? aim : target, dt, u.speed * (u.charge > 0 ? 1.5 : 1));
      } else {
        u.moving = false; if (u.attack <= 0) u.facing = target.x < u.x ? -1 : 1;
        if (u.cooldown <= 0&&ai.mayStartMelee(u,target)) {
          if(target===u.protectTarget)session.combatStats.roleIntercepts++;
          u.attack = u.attackDuration = u.kind === 'Archer' ? .72 : .4; u.cooldown = u.kind === 'Archer' ? 1.6 : u.team === 'ally' ? .9 : Math.max(.85, 1.25 - session.waveIndex * .08);
          u.strike = { timer: u.kind === 'Archer' ? .31 : u.kind === 'Lancer' ? .24 : .2, target, range, damage: u.team === 'ally' ? 18 : Math.round(((target === session.castle ? 13 : u.kind === 'Lancer' ? 13 : 10) + session.waveIndex * 2)*director.settings().damage) };
        }
      }
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
