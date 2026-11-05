/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installCombat = function (ports) {
    const {combat, host, config, math, input, audio, renderer, session, director, upgrading, navigation, ai,campaign}=ports;
    combat.resetCombatStats = function resetCombatStats(){
      Object.assign(session.combatStats,{swings:0,hits:0,misses:0,interruptions:0,cancels:0,bufferedInputs:0,healingDone:0,healingWasted:0,stalls:0,blockedSeconds:0,mergedHits:0,pressureDeferrals:0,maxWindups:0,damageTaken:0,allyEvades:0,allyHazardHits:0,roleIntercepts:0,repositions:0,fortressSaved:0});
      Object.assign(session.combatStats,{rangedDeferrals:0,maxRangedWindups:0,oathHealing:0});
      session.combatStats.damageBySource={Warrior:0,Lancer:0,Archer:0,Pawn:0,boss:0,unknown:0};
    };

    combat.heroCounterReady = () => !!combat.captureCounter().token;

    combat.heroMoveScale = function heroMoveScale(){
      const movement=upgrading.clampMoveScale(upgrading.swingMoveScale());return movement+(1-movement)*math.clamp((combat.heroAttackAge()-config.SWING.end)/Math.max(.02,(session.hero.attackDuration||config.HERO_ATTACK.duration)-config.SWING.end),0,1);
    };

    combat.updateReaction = function updateReaction(entity, dt) {
      entity.impactHold=Math.max(0,(entity.impactHold||0)-dt);
      entity.damageCue=Math.max(0,(entity.damageCue||0)-dt);entity.dodgeCue=Math.max(0,(entity.dodgeCue||0)-dt);entity.missCue=Math.max(0,(entity.missCue||0)-dt);
      entity.hitFlash = Math.max(0, (entity.hitFlash || 0) - dt);
      entity.stagger = Math.max(0, (entity.stagger || 0) - dt);
      if (Math.hypot(entity.knockX || 0, entity.knockY || 0) > 5) {
        const speed = Math.hypot(entity.knockX, entity.knockY);
        const facing = entity.facing;
        navigation.move(entity, entity.knockX, entity.knockY, dt, speed);
        entity.facing = facing;
        const decay = Math.exp(-19 * dt); entity.knockX *= decay; entity.knockY *= decay;
      }
    };

    combat.hurt = function hurt(target, amount, source) {
      if(target.hp<=0||!Number.isFinite(amount)||amount<=0)return 0;
      if(target===session.hero&&combat.isDashImmune()){
        if(!session.hero.dashPerfect&&session.hero.invuln<=0){session.hero.dashPerfect=true;combat.onPerfectDodge();session.hero.dodgeCue=.35;renderer.float('ELAK SEMPURNA',session.hero.x,session.hero.y-30,'#b5f5e4',true);audio.combatCue('dodge');}
        return 0;
      }
      if (target === session.hero && session.hero.invuln > 0) return 0;
      if(target===session.hero&&session.collectingHeroDamage){
        if(session.pendingHeroDamage)session.combatStats.mergedHits++;
        if(!session.pendingHeroDamage||amount>session.pendingHeroDamage.amount||amount===session.pendingHeroDamage.amount&&combat.damagePriority(source)<combat.damagePriority(session.pendingHeroDamage.source))session.pendingHeroDamage={amount,source};
        return 0;
      }
      const incomingAmount=amount;
      if(target===session.hero&&session.ranks.bastion>0&&session.castle.hp>0&&math.dist(session.hero,session.castle)<=upgrading.fortressRadius()){const guarded=Math.max(1,Math.round(amount*(1-upgrading.clampHeroDamageReduction(upgrading.heroDamageReduction()))));session.combatStats.fortressSaved+=amount-guarded;amount=guarded;}
      if(target.isBoss){
        const open=target.bossAction?.stage==='recovery';
        if(source?.team==='ally')amount=Math.max(1,Math.round(amount*(open?1:.55)));
        else if(source===session.hero&&open)amount=Math.max(1,Math.round(amount*1.3));
      }
      if(target===session.castle)amount=Math.max(1,Math.round(amount*(1-upgrading.clampCastleDamageReduction(upgrading.castleDamageReduction()))));
      amount=Math.max(1,Math.round(combat.applySkillResistance(target,amount,incomingAmount)));
      const appliedDamage = Math.min(target.hp, amount);
      if(target.team==='ally'&&source?.isBoss)session.combatStats.allyHazardHits++;
      if (source === session.hero && target.team === 'enemy') session.damageDealt += appliedDamage;
      if (target === session.hero) session.damageTaken += appliedDamage;
      if(target===session.hero){
        session.combatStats.damageTaken+=appliedDamage;
        const key=source?.isBoss?'boss':source?.kind||'unknown';
        session.combatStats.damageBySource[key]=(session.combatStats.damageBySource[key]||0)+appliedDamage;
      }
      target.hp -= amount;
      if(source===session.hero&&target.team==='enemy')combat.onHeroSkillHit(appliedDamage);
      target.lastDamageTime=session.elapsed;
      target.hitFlash = .18;
      const angle = source ? Math.atan2(target.y - source.y, target.x - source.x) : math.rand(0, Math.PI * 2);
      if(session.impacts.length>=60)session.impacts.shift();
      session.impacts.push({ x: target.x, y: target.y - (target === session.castle ? 40 : 27), angle, color: target === session.hero || target.team === 'ally' ? '#ff977d' : '#ffdb86', life: .3, duration: .3, prominent:target===session.hero||source===session.hero||target===session.castle });
      renderer.floatDamage(target,appliedDamage,source);
      if (target === session.hero) {
        session.hero.invuln = .45;session.hero.damageDirection=angle;session.hero.damageCue=.35; session.shake = Math.max(session.shake, 3); host.$('gameShell').classList.add('player-hit');audio.combatCue('hurt');
      } else if (target === session.castle) { audio.playSample(['impactWood_heavy_000.ogg'],session.castle,.55,.85,2);session.shake = Math.max(session.shake, 2); renderer.addEffect('Particle FX/Explosion_02.png', session.castle.x + math.rand(-45, 45), session.castle.y - 20, 65, .35, 24); }
      else if (source === session.hero) { session.shake = Math.max(session.shake, 1.5);if(!session.hero.strike||session.hero.strike.hits.size===1)audio.combatCue('hit',target); }
      if(target!==session.castle&&!target.isBoss)combat.holdImpactPose(target);
      if (target !== session.castle && !target.isBoss) {
        if (target === session.hero) {combat.cancelHeroSwing(true,target.hp<=0?'death':'hit');if(target.hp<=0)combat.endUpgradeSkills('death');session.hero.work = null;session.hero.attackBuffer=0;session.hero.dashBuffer=0;}
        const force = target.kind === 'Lancer' ? 140 : target === session.hero ? 195 : 255;
        target.knockX = Math.cos(angle) * force; target.knockY = Math.sin(angle) * force;
        target.stagger = target === session.hero ? .09 : .12;
        target.strike = null;
        target.attack = 0;
      }
      if (target.hp <= 0 && target.team === 'enemy' && !target.dead) {
        ai.releaseApproach(target);session.approachSlots.delete(target);
        target.dead = true; session.kills++; session.score += target.isBoss?500:25 + session.waveIndex * 5; if(campaign?.enabled)campaign.claimKill(target);else session.gold += target.isBoss?50:6;
        renderer.addEffect('Particle FX/Explosion_01.png', target.x, target.y - 9, source===session.hero?70:45,source===session.hero?.45:.3);
        session.drops.push({ x: target.x, y: target.y, type: session.gameRandom() > .7 ? 'wood' : 'gold', life: 18, value: 5 });
        audio.tone(320, .075, 'triangle', .02, 540);
      } else if (target.hp <= 0 && target.team === 'ally' && !target.dead) { ai.releaseApproach(target);session.approachSlots.delete(target);target.dead = true; renderer.addEffect('Particle FX/Dust_02.png', target.x, target.y, 70); }
      target.hp = Math.max(0, target.hp);
      return appliedDamage;
    };

    combat.heroAttack = function heroAttack() {
      if (session.hero.hp<=0||session.hero.skills.tripleSlash.status==='active'||session.state !== 'playing' || session.hero.cooldown > 0 || session.hero.stagger > 0 || session.hero.dash > 0) return;
      const angle=input.updateAim();
      session.hero.attackBuffer = 0;
      session.hero.work = null;
      session.hero.cooldown=combat.attackCooldown();
      combat.createHeroStrike({angle,duration:Math.min(config.HERO_ATTACK.duration,session.hero.cooldown)});
    };

    combat.createHeroStrike = function createHeroStrike({angle,duration,kind='basic',comboSequence,slashIndex,counterBonus,counterToken}) {
      session.hero.attack=session.hero.attackDuration=duration;
      const target=combat.heroAttackTarget(angle);
      session.hero.swingFacing=session.hero.facing;session.hero.swingEmpowered=session.hero.riposte>0;session.hero.missCue=0;
      const counter=combat.captureCounter();
      session.hero.strike = { kind,comboSequence,slashIndex,elapsed:0, facing:session.hero.facing, target, hits:new Set(),counterBonus:counterBonus??counter.bonus,counterToken:counterToken??counter.token };
      Object.defineProperty(session.hero.strike,'angle',{value:angle,enumerable:true});
      session.hero.swingAngle=angle;
      session.hero.swingEmpowered=combat.counterHitBonus(session.hero.strike,null)>0;
      session.combatStats.swings++;
      audio.tone(380, .1, 'triangle', .018, 110);
    };

    combat.heroAttackOrigin = () => ({x:session.hero.x,y:session.hero.y});
    combat.heroAttackAngle = () => session.hero.strike?.angle ?? session.hero.swingAngle;

    combat.heroAttackTarget = function heroAttackTarget(angle=session.hero.aimAngle){
      let target=null,cost=Infinity;
      const origin=combat.heroAttackOrigin();
      for(const e of session.enemies){
        if(e.hp<=0)continue;
        const forward=(e.x-origin.x)*Math.cos(angle)+(e.y-origin.y)*Math.sin(angle),d=math.dist(origin,e),score=d+(forward>=0?0:12);
        if(d>config.SWING.reach+config.SWING.radius||score>=cost||!combat.swingContact({angle},e,config.SWING.start,config.SWING.end))continue;
        target=e;cost=score;
      }
      return target;
    };

    combat.cancelHeroSwing = function cancelHeroSwing(interrupted,reason=interrupted?'hit':'invalid-state'){
      if(session.hero.skills.tripleSlash.status==='active'){combat.cancelTripleSlash(reason);return;}
      if(session.hero.strike){session.combatStats[interrupted?'interruptions':'cancels']++;session.hero.strike=null;}
      session.hero.swingEmpowered=false;session.hero.missCue=0;
    };

    combat.holdImpactPose = function holdImpactPose(u){
      u.impactAge=u.attack>0?(u.attackDuration||.4)-u.attack:(u.animTime||0);u.impactHold=.035;
    };

    combat.damagePriority = function damagePriority(source){return (source?.isBoss?-100000:0)+(source?.combatId||0);};

    combat.beginDamageStep = function beginDamageStep(){session.collectingHeroDamage=true;session.pendingHeroDamage=null;};

    combat.resolveHeroDamage = function resolveHeroDamage(){
      session.collectingHeroDamage=false;
      const hit=session.pendingHeroDamage;session.pendingHeroDamage=null;
      if(hit)combat.hurt(session.hero,hit.amount,hit.source);
    };

    combat.swingContact = function swingContact(strike,target,previous,current){
      const origin=combat.heroAttackOrigin(),x=target.x-origin.x,y=target.y-origin.y;
      const dx=x*Math.cos(strike.angle)+y*Math.sin(strike.angle),dy=-x*Math.sin(strike.angle)+y*Math.cos(strike.angle),d2=x*x+y*y;
      if(dx < -12||d2>(config.SWING.reach+config.SWING.radius)**2)return false;
      const angle=Math.atan2(dy,dx),padding=Math.asin(Math.min(1,config.SWING.radius/Math.max(1,Math.sqrt(d2))));
      const from=combat.swingAngle(previous),to=combat.swingAngle(current);
      return angle+padding>=from&&angle-padding<=to&&navigation.clearPath(origin,target);
    };

    combat.isCurrentHeroStrike = function isCurrentHeroStrike(s) {
      if(!s||session.state!=='playing'||session.hero.hp<=0||session.hero.strike!==s)return false;
      const skill=session.hero.skills.tripleSlash;
      return s.kind==='triple-slash'?skill.status==='active'&&s.comboSequence===skill.sequence&&s.slashIndex===skill.slashIndex:skill.status!=='active';
    };
    combat.heroPrimaryDamage = () => upgrading.primaryDamage();
    combat.resolveHeroStrike = function resolveHeroStrike(s,previous,current){
      if(!combat.isCurrentHeroStrike(s))return;
      const skill=session.hero.skills.tripleSlash,isSkill=s.kind==='triple-slash';
      const cap=isSkill?config.TRIPLE_SLASH.targetCap:upgrading.swingCap();
      if(current>=config.SWING.start&&previous<=config.SWING.end&&s.hits.size<cap){
        // Sorting remains bounded by the existing 21-enemy encounter cap.
        const contacts=session.enemies.filter(e=>e.hp>0&&!s.hits.has(e)&&combat.swingContact(s,e,previous,current));
        contacts.sort((a,b)=>(a===s.target?-1:b===s.target?1:math.dist(session.hero,a)-math.dist(session.hero,b)));
        for(const target of contacts){
          if(s.hits.size>=cap||!combat.isCurrentHeroStrike(s))break;
          const primary=s.hits.size===0,bonus=(isSkill?!skill.counterConsumed:primary)?combat.counterHitBonus(s,target):0;
          s.hits.add(target);session.combatStats.hits++;
          if(isSkill)skill.hitCounts[s.slashIndex-1]=s.hits.size;
          const applied=combat.hurt(target,(isSkill?Math.round(combat.heroPrimaryDamage()*skill.damageScale):primary?combat.heroPrimaryDamage():upgrading.secondaryDamage?.()??18+session.ranks.blade*3)+bonus,session.hero);
          if(bonus&&applied>0){combat.consumeCounter(s);s.counterApplied=true;if(isSkill)skill.counterConsumed=true;renderer.float('BALASAN!',session.hero.x,session.hero.y-25,'#f8d68b',true);}
        }
      }
    };
    combat.finishHeroStrike = function finishHeroStrike(s) {
      if(session.hero.strike!==s)return;
      if(!s.hits.size){session.combatStats.misses++;session.hero.missCue=.18;audio.combatCue('miss');}
      session.hero.strike=null;
    };
    combat.updateHeroSwing = function updateHeroSwing(dt){
      if(session.state!=='playing'||!Number.isFinite(dt)||dt<=0)return;
      if(combat.updateTripleSlash(dt))return;
      const s=session.hero.strike;if(!s)return;
      const previous=s.elapsed;s.elapsed+=dt;
      combat.resolveHeroStrike(s,previous,s.elapsed);
      if(s.elapsed>=config.SWING.end)combat.finishHeroStrike(s);
    };

    combat.fireArrow = function fireArrow(u, target) {
      audio.combatCue('bow',u);
      const origin={x:u.x,y:u.y-5},d=Math.max(1,math.dist(origin,target));
      session.projectiles.push({ ...origin, vx: (target.x - origin.x) / d * 360, vy: (target.y - origin.y) / d * 360, color: u.color, team: u.team, target, source: u, damage: u.team === 'ally' ? 17 : Math.round((10 + session.waveIndex * 2)*director.settings().damage), life: 1.4 });
    };

    combat.requestAttack = function requestAttack() {
      if(session.state!=='playing'||session.hero.skills.tripleSlash.status==='active')return;
      host.$('interactionHint').hidden=true;
      if(session.hero.work){session.hero.work=null;session.gatherCooldown=Math.max(session.gatherCooldown,.18);}
      session.hero.attackBuffer=.14;
      if(session.hero.cooldown>0)session.combatStats.bufferedInputs++;
      combat.heroAttack();
    };

    combat.swingAngle = age => -config.SWING.angle+2*config.SWING.angle*math.clamp((age-config.SWING.start)/(config.SWING.end-config.SWING.start),0,1);

    combat.heroAttackAge = () => session.hero.skills.tripleSlash.status==='active'?session.hero.skills.tripleSlash.slashElapsed:
      session.hero.attack>0 ? (session.hero.attackDuration||config.HERO_ATTACK.duration)-session.hero.attack : config.HERO_ATTACK.duration;
    combat.updateProjectiles = function (dt) {
      for (const p of session.projectiles) {
        const previous = { x: p.x, y: p.y };
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        let first=null,firstT=Infinity;
        for(const obstacle of navigation.obstacleList) {
          // Ignore only a collider containing the shooter, never downstream cover.
          if(math.dist(p.source,obstacle)<obstacle.radius+10)continue;
          const t=math.segmentHit(previous,p,obstacle,obstacle.radius+2);
          if(t<firstT){firstT=t;first={obstacle};}
        }
        const candidates=p.team==='ally'?session.enemies:[session.hero,...session.allies,session.castle];
        for(const target of candidates)if(target.hp>0){
          const t=math.segmentHit(previous,p,target,target===session.castle?57:20);
          if(t<firstT){firstT=t;first={target};}
        }
        if(first){
          p.x=previous.x+(p.x-previous.x)*firstT;p.y=previous.y+(p.y-previous.y)*firstT;
          if(first.target){combat.hurt(first.target,p.damage,p.source);audio.playSample([['Warrior','Lancer'].includes(first.target.kind)?'impactMetal_light_001.ogg':'impactSoft_medium_000.ogg'],first.target,.25,1.1,0);}else audio.playSample(['impactWood_light_000.ogg'],p,.2,1,0);
          p.life=0;renderer.addEffect('Particle FX/Dust_01.png',p.x,p.y,32,.25);
        }
      }
    };
    M.installTripleSlash(ports);
    M.installUpgradeSkills(ports);
  };
})(window.PenjagaModules = window.PenjagaModules || {});
