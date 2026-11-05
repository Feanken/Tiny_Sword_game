/* Skill state and behavior. One simulation clock; snapshots/rendering never tick it. */
((M)=>{
  'use strict';
  M.createUpgradeSkillState=()=>({
    clock:0,rhythm:{stacks:0,quiet:0,decay:0},
    wind:{capacity:1,charges:1,rechargeRemaining:0,rechargeDuration:2.4,gapRemaining:0},
    counter:{token:0,consumedToken:0,expiresAt:0,refundRemaining:0},
    oath:{sequence:0,cooldownRemaining:0,zone:null},healing:[],endedReason:null
  });
  M.installUpgradeSkills=function({combat,config,session,input,upgrading,navigation,renderer,audio,math}){
    const C=M.SkillConfig,stage=id=>C.stage(session.ranks[id]),state=()=>session.hero.skills.upgrade;
    const windProfile=()=>{
      const s=stage('wind'),rank=Math.max(0,Math.min(9,session.ranks.wind));
      return {stage:s,capacity:s?C.wind.charges:1,recharge:s?C.wind.recharge[s]:Math.max(.75,2.4-Math.min(5,rank)*.25-Math.max(0,rank-5)*.08),
        gap:s?C.wind.gap:0,immunity:s?C.wind.immunity:.16+Math.floor(rank/5)*.02};
    };
    combat.syncSkillRanks=function(){
      const s=state(),profile=windProfile(),d=s.wind;
      if(profile.capacity!==d.capacity){d.charges=Math.min(profile.capacity,d.charges+Math.max(0,profile.capacity-d.capacity));d.capacity=profile.capacity;}
      if(profile.recharge!==d.rechargeDuration){d.rechargeRemaining=d.rechargeDuration>0?d.rechargeRemaining/d.rechargeDuration*profile.recharge:0;d.rechargeDuration=profile.recharge;}
      if(d.charges>=d.capacity)d.rechargeRemaining=0;
      if(!stage('rhythm'))Object.assign(s.rhythm,{stacks:0,quiet:0,decay:0});
      if(!stage('counter')){s.counter.expiresAt=0;session.hero.riposte=0;}
      if(!stage('oath'))s.oath.zone=null;
    };
    combat.skillStage=stage;
    combat.attackCooldown=()=>{
      const s=stage('rhythm'),stacks=s?state().rhythm.stacks:0;
      return Math.max(C.rhythm.minCooldown,config.SWING.end+config.FIXED_STEP,upgrading.attackCooldown()/(1+stacks*C.rhythm.speedPerStack[s]));
    };
    combat.allyCapacity=(base=C.garrison.baseCapacity)=>base+C.garrison.extra[stage('bastion')];
    combat.garrisonAuraActive=unit=>stage('bastion')===3&&session.castle.hp>0&&unit.hp>0&&
      (unit===session.hero||unit.team==='ally')&&math.dist(unit,session.castle)<=C.garrison.auraRadius;
    combat.applySkillResistance=(unit,amount,original)=>{
      if(!combat.garrisonAuraActive(unit)||unit===session.castle)return amount;
      const budget=Math.max(0,amount-original*(1-C.garrison.totalReductionCap));
      return Math.max(1,amount-Math.min(amount*C.garrison.auraReduction,budget));
    };
    combat.restorePassiveHp=function(unit,requested){
      if(unit.hp<=0||requested<=0||!Number.isFinite(requested))return 0;
      let amount=Math.min(requested,Math.max(0,unit.maxHp-unit.hp));
      if(unit===session.hero&&stage('oath')){
        const s=state();s.healing=s.healing.filter(event=>event.time>s.clock-1+1e-9);
        amount=Math.min(amount,Math.max(0,unit.maxHp*C.oath.heroHealCapPerSecond-s.healing.reduce((sum,event)=>sum+event.amount,0)));
        if(amount>0){const last=s.healing.at(-1);if(last?.time===s.clock)last.amount+=amount;else s.healing.push({time:s.clock,amount});}
      }
      unit.hp+=amount;return amount;
    };
    combat.isEnemyRecovering=unit=>unit?.team==='enemy'&&unit.hp>0&&
      (unit.isBoss?unit.bossAction?.stage==='recovery':unit.attack>0&&!unit.strike);
    combat.captureCounter=()=>{
      const c=state().counter;
      return stage('counter')&&c.expiresAt>state().clock+1e-9&&c.token!==c.consumedToken?
        {token:c.token,bonus:upgrading.counterBonus()}:{token:0,bonus:0};
    };
    combat.counterHitBonus=(strike,target)=>{
      const c=state().counter,s=stage('counter');
      if(!s||!strike.counterToken||c.token!==strike.counterToken||c.consumedToken===c.token||c.expiresAt<=state().clock+1e-9)return 0;
      return Math.round(strike.counterBonus*(combat.isEnemyRecovering(target)?C.counter.recoveryMultiplier[s]:1));
    };
    combat.consumeCounter=function(strike){
      const s=state(),c=s.counter;if(!strike.counterToken||c.token!==strike.counterToken||c.consumedToken===c.token)return;
      c.consumedToken=c.token;c.expiresAt=0;session.hero.riposte=0;
      if(c.refundRemaining<=0){
        const refund=C.counter.refund[stage('counter')];
        session.hero.skills.tripleSlash.cooldownRemaining=Math.max(0,session.hero.skills.tripleSlash.cooldownRemaining-refund);
        s.oath.cooldownRemaining=Math.max(0,s.oath.cooldownRemaining-refund);
        c.refundRemaining=C.counter.refundInternalCooldown;
      }
    };
    combat.onPerfectDodge=function(){
      if(!stage('counter'))return;
      const s=state(),c=s.counter;c.token++;c.expiresAt=s.clock+C.counter.lifetime;
      session.hero.riposte=C.counter.lifetime;
    };
    combat.onHeroSkillHit=function(amount){
      if(amount<=0||!stage('rhythm'))return;
      const r=state().rhythm;r.stacks=Math.min(C.rhythm.maxStacks,r.stacks+1);r.quiet=0;r.decay=0;
    };
    combat.dashSnapshot=()=>{
      const p=windProfile(),d=state().wind,capacity=p.capacity,charges=Math.min(capacity,d.charges);
      const nextUse=Math.max(d.gapRemaining,charges>0?0:d.rechargeRemaining);
      return {...d,capacity,charges,stage:p.stage,recharge:p.recharge,immunity:p.immunity,gap:p.gap,nextUse,
        ready:session.state==='playing'&&session.hero.hp>0&&charges>0&&d.gapRemaining<=1e-9&&session.hero.dash<=0&&session.hero.stagger<=0};
    };
    combat.startDash=function(){
      if(session.state!=='playing'||session.hero.hp<=0)return false;
      combat.syncSkillRanks();const d=state().wind,p=windProfile();
      if(session.hero.dash>0||session.hero.stagger>0||d.charges<=0||d.gapRemaining>1e-9)return false;
      let {dx,dy}=input.movement();
      if(!dx&&!dy){dx=session.hero.lastMoveX??session.hero.facing;dy=session.hero.lastMoveY??0;}
      const length=Math.hypot(dx,dy)||1;
      d.charges--;d.gapRemaining=p.gap;if(d.rechargeRemaining<=0)d.rechargeRemaining=p.recharge;
      Object.assign(session.hero,{dashX:dx/length,dashY:dy/length,dash:C.wind.duration,dashElapsed:0,dashPerfect:false,
        impactHold:0,attackBuffer:0,dashBuffer:0,work:null,attack:0,stagger:0,knockX:0,knockY:0});
      combat.cancelHeroSwing(false,'dash');
      if(Math.abs(dx)>.1)session.hero.facing=dx>0?1:-1;
      session.hero.dashCooldown=combat.dashSnapshot().nextUse;
      renderer.addEffect('Particle FX/Dust_01.png',session.hero.x,session.hero.y,55);
      if(!audio.playSample(['cloth1.ogg','cloth2.ogg'],session.hero,.4,1.3,2))audio.tone(360,.14,'triangle',.025,720);
      return true;
    };
    combat.requestDash=function(){
      if(session.state!=='playing'||session.hero.dash>0||session.hero.hp<=0)return false;
      combat.syncSkillRanks();session.hero.dashBuffer=combat.dashSnapshot().nextUse<=C.wind.buffer?C.wind.buffer:0;
      return combat.startDash();
    };
    combat.isDashImmune=()=>session.hero.dash>0&&session.hero.dashElapsed<=windProfile().immunity+1e-9;
    combat.updateDash=function(dt){
      if(session.state!=='playing'||session.hero.hp<=0)return false;
      if(session.hero.dashBuffer>0){combat.startDash();session.hero.dashBuffer=Math.max(0,session.hero.dashBuffer-dt);}
      session.dashTrail=session.dashTrail.filter(t=>(t.life-=dt)>0);
      const moving=session.hero.dash>0;
      if(moving){
        session.hero.dashElapsed+=dt;session.hero.dash=Math.max(0,session.hero.dash-dt);
        session.dashTrail.push({x:session.hero.x,y:session.hero.y,time:session.hero.dashElapsed,facing:session.hero.facing,life:.12});
        if(session.dashTrail.length>6)session.dashTrail.shift();
        navigation.move(session.hero,session.hero.dashX,session.hero.dashY,dt,C.wind.speed);
      }
      return moving;
    };
    combat.requestOath=function(){
      const s=state().oath,t=stage('oath'),h=session.hero;
      if(!t||session.state!=='playing'||h.hp<=0||h.dash>0||h.stagger>0||s.zone||s.cooldownRemaining>1e-9)return false;
      s.sequence++;s.cooldownRemaining=C.oath.cooldown;
      s.zone={x:h.x,y:h.y,radius:C.oath.radius[t],hps:C.oath.hps[t],duration:C.oath.duration[t],remaining:C.oath.duration[t],stage:t};
      h.work=null;return true;
    };
    combat.endUpgradeSkills=function(reason){
      const s=state();s.endedReason=reason;Object.assign(s.rhythm,{stacks:0,quiet:0,decay:0});
      s.counter.expiresAt=0;s.oath.zone=null;session.hero.riposte=0;session.hero.dash=0;session.hero.dashBuffer=0;session.dashTrail=[];
    };
    combat.updateSkillState=function(dt){
      if(session.state!=='playing'||!Number.isFinite(dt)||dt<=0)return;
      if(session.hero.hp<=0){combat.endUpgradeSkills('death');return;}
      combat.syncSkillRanks();const s=state(),d=s.wind,r=s.rhythm,t=stage('rhythm');s.clock+=dt;
      d.gapRemaining=Math.max(0,d.gapRemaining-dt);
      if(d.charges<d.capacity){
        d.rechargeRemaining-=dt;
        while(d.charges<d.capacity&&d.rechargeRemaining<=1e-9){d.charges++;if(d.charges<d.capacity)d.rechargeRemaining+=d.rechargeDuration;else d.rechargeRemaining=0;}
      }
      if(t&&r.stacks){
        const before=r.quiet;r.quiet+=dt;r.decay+=Math.max(0,r.quiet-C.rhythm.hold[t])-Math.max(0,before-C.rhythm.hold[t]);
        while(r.stacks>0&&r.decay+1e-9>=C.rhythm.decayInterval){r.stacks--;r.decay-=C.rhythm.decayInterval;}
      }
      s.counter.refundRemaining=Math.max(0,s.counter.refundRemaining-dt);
      session.hero.riposte=Math.max(0,s.counter.expiresAt-s.clock);session.hero.dashCooldown=combat.dashSnapshot().nextUse;
      if(session.hero.strike?.counterToken&&!session.hero.strike.counterApplied&&!combat.counterHitBonus(session.hero.strike,null))session.hero.swingEmpowered=false;
      s.oath.cooldownRemaining=Math.max(0,s.oath.cooldownRemaining-dt);
      if(s.oath.zone){
        const zone=s.oath.zone,seconds=Math.min(dt,zone.remaining);
        for(const unit of new Set([session.hero,...session.allies]))if(unit.hp>0&&math.dist(unit,zone)<=zone.radius)combat.restorePassiveHp(unit,zone.hps*seconds);
        zone.remaining=Math.max(0,zone.remaining-dt);if(zone.remaining<=1e-9)s.oath.zone=null;
      }
      s.healing=s.healing.filter(event=>event.time>s.clock-1+1e-9);
    };
    combat.skillsSnapshot=()=>{
      const s=state(),r=stage('rhythm'),o=stage('oath');
      return {stages:Object.fromEntries(['blade','rhythm','wind','counter','bastion','oath'].map(id=>[id,stage(id)])),
        rhythm:{...s.rhythm,maxStacks:C.rhythm.maxStacks,speedBonus:s.rhythm.stacks*C.rhythm.speedPerStack[r],attackCooldown:combat.attackCooldown()},
        wind:combat.dashSnapshot(),counter:{ready:!!combat.captureCounter().token,remaining:Math.max(0,s.counter.expiresAt-s.clock),refundRemaining:s.counter.refundRemaining},
        garrison:{capacity:combat.allyCapacity(),auraUnlocked:stage('bastion')===3,radius:C.garrison.auraRadius,reduction:C.garrison.auraReduction},
        oath:{...s.oath,zone:s.oath.zone?{...s.oath.zone}:null,stage:o,cooldown:C.oath.cooldown,
          ready:!!o&&session.state==='playing'&&session.hero.hp>0&&!s.oath.zone&&s.oath.cooldownRemaining<=1e-9&&session.hero.dash<=0&&session.hero.stagger<=0},endedReason:s.endedReason};
    };
  };
})(window.PenjagaModules=window.PenjagaModules||{});
