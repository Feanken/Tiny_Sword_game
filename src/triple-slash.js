/* Triple Slash lifecycle. Session owns state; combat owns shared hit resolution. */
((M)=>{
  'use strict';
  M.installTripleSlash=function({combat,config,input,session,upgrading}){
    const tuning=config.TRIPLE_SLASH,period=tuning.duration/tuning.slashes,epsilon=1e-9;
    const state=()=>session.hero.skills.tripleSlash;
    const active=()=>state().status==='active';
    const canStart=()=>session.state==='playing'&&session.hero.hp>0&&session.ranks.blade>=tuning.unlockRank&&
      !active()&&state().cooldownRemaining<=epsilon&&(session.hero.dash||0)<=0&&session.hero.stagger<=0&&
      session.hero.cooldown<=0&&session.hero.attack<=0&&!session.hero.strike;
    function beginSlash(s){
      s.phase='windup';s.slashElapsed=0;
      input.updateAim();
      combat.createHeroStrike({angle:s.angle,duration:period,kind:'triple-slash',
        comboSequence:s.sequence,slashIndex:s.slashIndex,
        counterBonus:s.counterConsumed?0:s.counterBonus,counterToken:s.counterConsumed?0:s.counterToken});
    }
    combat.requestTripleSlash=function requestTripleSlash(){
      if(!canStart())return false;
      const s=state(),angle=input.updateAim(),stage=M.SkillConfig.stage(session.ranks.blade),counter=combat.captureCounter();
      Object.assign(s,{status:'active',sequence:s.sequence+1,cooldownRemaining:M.SkillConfig.triple.cooldown[stage],
        stage,damageScale:M.SkillConfig.triple.damageScale[stage],cooldownDuration:M.SkillConfig.triple.cooldown[stage],
        elapsed:0,slashIndex:1,slashElapsed:0,phase:'windup',angle,
        counterBonus:counter.bonus,counterToken:counter.token,
        counterConsumed:false,hitCounts:[0,0,0],cancelReason:null});
      session.hero.attackBuffer=0;session.hero.work=null;
      beginSlash(s);
      return true;
    };
    combat.cancelTripleSlash=function cancelTripleSlash(reason){
      const s=state();if(s.status!=='active')return false;
      const reasons=['dash','hit','death','run-ended','strike-lost','invalid-state'];
      s.cancelReason=reasons.includes(reason)?reason:'invalid-state';
      s.status='cancelled';s.phase='idle';
      session.combatStats[reason==='hit'||reason==='death'?'interruptions':'cancels']++;
      session.hero.strike=null;session.hero.attack=0;session.hero.attackBuffer=0;
      session.hero.swingEmpowered=false;session.hero.missCue=0;
      input.updateAim();
      return true;
    };
    combat.updateTripleSlash=function updateTripleSlash(dt){
      if(session.state!=='playing'||!Number.isFinite(dt)||dt<=0)return active();
      const s=state(),wasActive=s.status==='active',sequence=s.sequence;
      s.cooldownRemaining=Math.max(0,s.cooldownRemaining-dt);
      if(!wasActive)return false;
      if(session.hero.hp<=0){combat.cancelTripleSlash('death');return true;}
      if(session.ranks.blade<tuning.unlockRank){combat.cancelTripleSlash('invalid-state');return true;}
      let remaining=dt;
      while(remaining>epsilon&&s.status==='active'&&state()===s&&s.sequence===sequence){
        if(!['windup','contact','recovery'].includes(s.phase)){combat.cancelTripleSlash('invalid-state');break;}
        const strike=session.hero.strike;
        if(s.phase!=='recovery'){
          if(!strike){combat.cancelTripleSlash('strike-lost');break;}
          if(strike.kind!=='triple-slash'||strike.comboSequence!==s.sequence||strike.slashIndex!==s.slashIndex){
            combat.cancelTripleSlash('invalid-state');break;
          }
        }else if(strike){combat.cancelTripleSlash('invalid-state');break;}
        const end=s.phase==='windup'?config.SWING.start:s.phase==='contact'?config.SWING.end:period;
        const step=Math.min(remaining,Math.max(0,end-s.slashElapsed)),previous=s.slashElapsed;
        s.slashElapsed+=step;remaining-=step;
        if(Math.abs(s.slashElapsed-end)<=epsilon)s.slashElapsed=end;
        s.elapsed=Math.min(tuning.duration,(s.slashIndex-1)*period+s.slashElapsed);
        session.hero.attack=Math.max(0,period-s.slashElapsed);
        if(strike){
          strike.elapsed=s.slashElapsed;
          combat.resolveHeroStrike(strike,previous,s.slashElapsed);
          if(state()!==s||s.status!=='active'||s.sequence!==sequence)break;
        }
        if(s.slashElapsed<end-epsilon)continue;
        if(s.phase==='windup')s.phase='contact';
        else if(s.phase==='contact'){
          combat.finishHeroStrike(strike);s.phase='recovery';
        }else if(s.slashIndex<tuning.slashes){
          const desired=input.desiredAimAngle(),delta=Math.atan2(Math.sin(desired-s.angle),Math.cos(desired-s.angle));
          const turn=Math.max(-tuning.maxTurnRadians,Math.min(tuning.maxTurnRadians,delta));
          s.angle=Math.atan2(Math.sin(s.angle+turn),Math.cos(s.angle+turn));
          s.slashIndex++;beginSlash(s);
        }else{
          s.status='completed';s.phase='idle';s.elapsed=tuning.duration;
          session.hero.attack=0;session.hero.strike=null;
          input.updateAim();
        }
      }
      return true;
    };
    combat.tripleSlashSnapshot=function tripleSlashSnapshot(){
      const s=state();
      const currentStage=M.SkillConfig.stage(session.ranks.blade);
      return {...s,stage:currentStage,activeStage:s.stage,hitCounts:[...s.hitCounts],unlocked:session.ranks.blade>=tuning.unlockRank,ready:canStart(),
        duration:tuning.duration,cooldown:s.cooldownRemaining>0||active()?s.cooldownDuration:M.SkillConfig.triple.cooldown[currentStage],slashDuration:period,
        contactStart:config.SWING.start,contactEnd:config.SWING.end,
        hitArea:{origin:combat.heroAttackOrigin(),angle:s.angle,reach:config.SWING.reach,
          radius:config.SWING.radius,halfAngle:config.SWING.angle,backAllowance:12}};
    };
  };
})(window.PenjagaModules=window.PenjagaModules||{});
