/* Rank/tier transactions and adapters to pure base stats. Skills own temporary effects. */
((M)=>{
  'use strict';
  M.installUpgrading=function({upgrading,host,config,audio,ui,session,combat}){
    const rules=M.UpgradeProgress;
    let key='',cached;
    upgrading.stats=()=>{
      const next=rules.ids.map(id=>session.ranks[id]).join('/');
      if(next!==key||!cached){cached=M.BaseStats.resolve(session.ranks);key=next;}
      return cached;
    };
    for(const name of ['attackCooldown','swingCap','counterBonus','counterWindow','foodCooldown',
      'foodHealing','monkHealing','fortressRadius','primaryDamage','secondaryDamage',
      'swingMoveScale','heroDamageReduction','castleDamageReduction'])upgrading[name]=()=>upgrading.stats()[name];
    upgrading.dashCooldown=()=>upgrading.stats().legacyDashCooldown;
    upgrading.dashImmunity=()=>upgrading.stats().legacyDashImmunity;
    upgrading.milestone=id=>Math.min(2,Math.floor(session.ranks[id]/5));
    upgrading.skillStage=id=>rules.skillStage(session.ranks[id]);
    upgrading.clampMoveScale=value=>Math.max(0,Math.min(.85,value));
    upgrading.clampHeroDamageReduction=value=>Math.max(0,Math.min(.35,value));
    upgrading.clampCastleDamageReduction=value=>Math.max(0,Math.min(.50,value));
    upgrading.applyBaseStats=()=>{
      const stats=upgrading.stats();
      session.hero.maxHp=stats.heroMaxHp;session.castle.maxHp=stats.castleMaxHp;
      session.hero.hp=Math.min(session.hero.hp,stats.heroMaxHp);
      session.castle.hp=Math.min(session.castle.hp,stats.castleMaxHp);
      return stats;
    };
    const context=()=>({campOpen:!!host.$('campDialog').open});
    upgrading.quoteRank=id=>rules.quoteRank(session,id,context());
    upgrading.quoteTier=(id,tierId)=>rules.quoteTier(session,id,tierId,context());
    upgrading.reasonText=quote=>({
      'unknown-upgrade':'Jalur tidak dikenal.','unknown-tier':'Tier tidak dikenal.',
      'invalid-state':'Progres tidak valid.','not-preparation':'Tersedia saat jeda/perkemahan.',
      'max-rank':'Tingkat maksimum 25.','tier-locked':'Buka tier berikutnya terlebih dahulu.',
      'gold-short':'Butuh '+quote.cost+' emas.','already-paid':'Tier ini sudah dibuka.',
      'previous-tier':'Buka tier sebelumnya terlebih dahulu.',
      'required-rank':'Perlu rank '+quote.requiredRank+' pada jalur ini.',
      'boss-required':quote.requiredBossId==='boss-chapter-1'?'Menangkan boss Bab 1 terlebih dahulu.':'Menangkan boss Bab 2 terlebih dahulu.'
    }[quote.reason]||'');
    upgrading.viewUpgrade=id=>{
      const perk=config.upgrades.find(p=>p.id===id);if(!perk)return null;
      const paid=rules.paidTier(session,id),tier=config.UPGRADE_TIERS[paid-1]||config.UPGRADE_TIERS[0];
      const nextTier=config.UPGRADE_TIERS[paid],rank=session.ranks[id],rankQuote=upgrading.quoteRank(id);
      const unlockQuote=nextTier?upgrading.quoteTier(id,nextTier.id):null;
      return {id,rank,tier,cap:tier.cap,skillStage:upgrading.skillStage(id),rankQuote,unlockQuote,
        actionQuote:rank>=tier.cap&&unlockQuote?unlockQuote:rankQuote};
    };
    function feedback(id,text){
      host.$('campFeedback').textContent=text;audio.tone(523,.2,'triangle');ui.renderCamp();ui.updateUI();
      if(host.$('campDialog').open){
        const card=host.$('campCards').querySelector('[data-perk="'+id+'"]');
        (card&&!card.disabled?card:host.$('campCards').querySelector('button:not(:disabled)')||host.$('campReady')).focus({preventScroll:true});
      }
    }
    upgrading.buyUpgrade=function(id){
      const quote=upgrading.quoteRank(id);if(!quote.allowed)return false;
      const before=upgrading.stats(),after=M.BaseStats.resolve({...session.ranks,[id]:quote.targetRank});
      session.gold-=quote.cost;session.ranks[id]=quote.targetRank;session.campPurchase=session.waveIndex;
      upgrading.applyBaseStats();
      if(id==='bastion')session.castle.hp=Math.min(after.castleMaxHp,session.castle.hp+after.castleMaxHp-before.castleMaxHp);
      if(id==='oath')session.hero.hp=Math.min(after.heroMaxHp,session.hero.hp+after.heroMaxHp-before.heroMaxHp);
      const perk=config.upgrades.find(p=>p.id===id),rank=session.ranks[id];
      const bonus=rank===5||rank===10?' Bonus aktif: '+config.upgradeBuffs[id][rank/5-1]:'';
      feedback(id,perk.name+' rank '+rank+' ditempa.'+bonus);
      return true;
    };
    upgrading.unlockTier=function(id,tierId){
      const quote=upgrading.quoteTier(id,tierId);if(!quote.allowed)return false;
      session.gold-=quote.cost;session.paidTierUnlocks[id]=[...session.paidTierUnlocks[id],tierId];
      feedback(id,config.upgrades.find(p=>p.id===id).name+' · Tier '+config.UPGRADE_TIERS.find(t=>t.id===tierId).name+
        ' dibuka. Batas rank '+quote.cap+'.');
      return true;
    };
  };
})(window.PenjagaModules=window.PenjagaModules||{});
