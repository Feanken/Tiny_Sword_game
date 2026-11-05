/* One ongoing world/run. Receipts identify the run and wave, never a mutable cursor alone. */
((M)=>{
  'use strict';
  M.installCampaign=function({campaign,world,session:s,config,options={},mines,combat,input,renderer,ui,director}){
    campaign.enabled=world.id==='campaign-islands';
    let generation=0,runId='idle',status='idle',chapterIndex=0,cleared=[],killReceipts=new Set(),passiveTicks=0;
    const profile=M.CAMPAIGN;
    campaign.chapter=()=>profile.chapters[chapterIndex];
    campaign.waveId=()=> 'c'+(chapterIndex+1)+'-w'+(s.waveIndex+1);
    campaign.miningRewardOverride=()=>options.economyProfileId==='standard'?null:config.GATHERING_REWARDS.gold;
    campaign.hasBossVictory=id=>profile.chapters.some((chapter,i)=>chapter.bossId===id&&cleared.includes('c'+(i+1)+'-w5'));
    campaign.snapshot=()=>({runId,status,chapterId:campaign.chapter().id,chapterIndex,waveId:campaign.waveId(),
      clearedWaveIds:[...cleared],bossVictories:profile.chapters.filter(c=>campaign.hasBossVictory(c.bossId)).map(c=>c.bossId),
      economyProfileId:options.economyProfileId||'testing',miningOverrideGold:campaign.miningRewardOverride(),
      passiveTicks});
    campaign.receipt=()=>Object.freeze({runId,chapterId:campaign.chapter().id,waveId:campaign.waveId(),attemptId:1});
    campaign.reset=()=>{
      status='idle';chapterIndex=0;cleared=[];killReceipts.clear();passiveTicks=0;
      mines?.reset?.();
      if(campaign.enabled)world.applyChapterPreview('chapter-1');
    };
    function enterChapter(){
      world.applyChapterPreview(campaign.chapter().id);
      s.waveIndex=0;s.spawned=0;s.bossSpawned=false;s.boss=null;s.passiveTimer=0;passiveTicks=0;
      s.encounters=director.makeEncounters((s.runSeed+Math.imul(chapterIndex,2654435761))>>>0);
      s.waveTimer=campaign.chapter().preparationSeconds;
      mines?.enterChapter?.({runId,chapterId:campaign.chapter().id});
    }
    campaign.start=()=>{
      campaign.reset();runId='campaign-'+(++generation)+'-'+s.runSeed.toString(36);status='active';
      Object.assign(s,profile.startingResources);
      M.UpgradeProgress.bindSource(s,{hasBossVictory:campaign.hasBossVictory});
      enterChapter();return campaign.receipt();
    };
    const safeWallet=()=>['gold','wood','food'].every(id=>Number.isSafeInteger(s[id])&&s[id]>=0&&s[id]<Number.MAX_SAFE_INTEGER-100000);
    campaign.claimKill=unit=>{
      if(!campaign.enabled||status!=='active'||s.state!=='playing'||s.phase!=='battle'||unit.hp>0||
        unit.campaignRunId!==runId||unit.waveId!==campaign.waveId()||unit.isBoss||!safeWallet())return 0;
      const key=unit.waveId+':'+unit.combatId;
      if(killReceipts.has(key))return 0;
      killReceipts.add(key);const gold=campaign.chapter().killGold;s.gold+=gold;return gold;
    };
    campaign.passiveTick=()=>{
      if(status!=='active'||s.state!=='playing'||passiveTicks>=profile.passive.maxTicksPerChapter||!safeWallet())return false;
      passiveTicks++;s.gold+=profile.passive.gold;s.wood+=profile.passive.wood;return true;
    };
    campaign.canCompleteWave=()=>status==='active'&&s.state==='playing'&&s.phase==='battle'&&
      s.hero.hp>0&&s.castle.hp>0&&s.spawned===config.waves[s.waveIndex].count&&
      director.arrivalSchedule&&director.departureCursor===director.arrivalSchedule.length&&
      !s.enemies.some(u=>u.hp>0)&&
      (s.waveIndex!==4||s.bossSpawned&&s.boss?.campaignBossId===campaign.chapter().bossId&&s.boss.hp<=0);
    campaign.completeWave=receipt=>{
      const active=campaign.receipt();
      if(!receipt||Object.keys(active).some(key=>receipt[key]!==active[key])||
        cleared.includes(active.waveId)||!campaign.canCompleteWave()||!safeWallet())return {accepted:false};
      const chapter=campaign.chapter(),last=s.waveIndex===4;
      const gold=chapter.waveGold[s.waveIndex]+(last?chapter.bossGold+chapter.chapterGold:0);
      // Commit all rewards and completion together; repeated/stale receipts cannot enter again.
      s.gold+=gold;s.wood+=profile.waveResources.wood;s.food+=profile.waveResources.food;
      s.score+=150+s.waveIndex*50;
      s.hero.hp=Math.min(s.hero.maxHp,s.hero.hp+profile.waveRecovery.heroHp);
      cleared.push(active.waveId);
      if(!last){s.waveIndex++;s.phase='prepare';s.waveTimer=profile.wavePreparationSeconds;}
      else if(chapterIndex===2){status='complete';}
      else{
        chapterIndex++;status='chapter-review';
        s.state='chapter-review';s.phase='review';
        input.clearCombatInput();combat.cancelTripleSlash('chapter-ended');combat.endUpgradeSkills('chapter-ended');
        s.hero.work=null;s.projectiles=[];s.approachSlots.clear();s.engagements.clear();s.combatUnits=[];
        s.allies=s.allies.filter(u=>u.hp>0);
        for(const actor of [s.hero,...s.allies]){
          actor.strike=null;actor.attack=0;actor.combatTarget=null;actor.healTarget=null;actor.route=[];
          actor.stagger=0;actor.knockX=actor.knockY=0;
        }
        enterChapter();
        const recovery=campaign.chapter().recovery;
        s.hero.hp=Math.min(s.hero.maxHp,s.hero.hp+recovery.heroHp);
        s.castle.hp=Math.min(s.castle.maxHp,s.castle.hp+recovery.castleHp);
        renderer.resize?.();
      }
      return {accepted:true,gold,chapterComplete:last,campaignComplete:status==='complete',completedChapterId:chapter.id};
    };
    campaign.beginPreparation=()=>{
      if(status!=='chapter-review'||s.state!=='chapter-review'||s.hero.hp<=0||s.castle.hp<=0)return false;
      status='active';s.state='playing';s.phase='prepare';ui.updateUI();input.clearCombatInput();return true;
    };
    campaign.fail=()=>{
      if(!['active','chapter-review'].includes(status))return false;
      status='lost';return true;
    };
  };
})(window.PenjagaModules=window.PenjagaModules||{});
