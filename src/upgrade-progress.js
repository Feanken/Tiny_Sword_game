/* Pure quotes and a replaceable boss-evidence source. No DOM or skill effects. */
((M)=>{
  'use strict';
  const ids=Object.freeze(M.config.upgrades.map(p=>p.id));
  const bosses=Object.freeze(['boss-chapter-1','boss-chapter-2','boss-chapter-3']);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const exactKeys=v=>object(v)&&Object.keys(v).length===ids.length&&ids.every(id=>Object.hasOwn(v,id));
  const tier=id=>M.config.UPGRADE_TIERS.find(t=>t.id===id);
  function paidTier(session,id){
    const paid=session.paidTierUnlocks?.[id];
    return Array.isArray(paid)?paid.length+1:0;
  }
  function validState(session){
    if(!exactKeys(session.ranks)||!exactKeys(session.paidTierUnlocks))return false;
    return ids.every(id=>{
      const rank=session.ranks[id],paid=session.paidTierUnlocks[id];
      return Number.isInteger(rank)&&rank>=0&&Array.isArray(paid)&&paid.length<=2&&
        paid.every((value,i)=>value===M.config.UPGRADE_TIERS[i+1].id)&&
        rank<=M.config.UPGRADE_TIERS[paid.length].cap&&
        (!paid.length||rank>=M.config.UPGRADE_TIERS[paid.length].requiredRank);
    });
  }
  function hasBossVictory(session,id){
    if(!bosses.includes(id))return false;
    if(session.progressSource){
      try{return session.progressSource.hasBossVictory(id)===true;}catch{return false;}
    }
    return Array.isArray(session.upgradeProgress?.bossVictories)&&session.upgradeProgress.bossVictories.includes(id);
  }
  function recordBossVictory(session,id){
    if(!bosses.includes(id)||session.progressSource||hasBossVictory(session,id))return false;
    session.upgradeProgress.bossVictories.push(id);return true;
  }
  function bindSource(session,source){
    if(source!==null&&(!source||typeof source.hasBossVictory!=='function'))return false;
    session.progressSource=source;return true;
  }
  function rankPrice(id,targetRank){
    const perk=M.config.upgrades.find(p=>p.id===id);
    return perk&&Number.isInteger(targetRank)&&targetRank>=1&&targetRank<=M.config.MAX_UPGRADE_LEVEL?
      perk.cost+M.config.UPGRADE_RANK_STEP*(targetRank-1):null;
  }
  const contextAllowed=(session,options)=>session.phase==='prepare'&&
    (session.state==='playing'||session.state==='paused'&&options.campOpen===true);
  function commonReason(session,id,options){
    if(!ids.includes(id))return 'unknown-upgrade';
    if(!validState(session)||!Number.isSafeInteger(session.gold)||session.gold<0)return 'invalid-state';
    if(!contextAllowed(session,options))return 'not-preparation';
    return null;
  }
  function quoteRank(session,id,options={}){
    let reason=commonReason(session,id,options);
    const rank=session.ranks?.[id],currentTier=M.config.UPGRADE_TIERS[paidTier(session,id)-1];
    const cost=rankPrice(id,rank+1);
    if(!reason){
      if(rank>=M.config.MAX_UPGRADE_LEVEL)reason='max-rank';
      else if(rank>=currentTier.cap)reason='tier-locked';
      else if(session.gold<cost)reason='gold-short';
    }
    return {action:'rank',id,rank,targetRank:rank+1,cost,cap:currentTier?.cap,allowed:!reason,reason};
  }
  function quoteTier(session,id,tierId,options={}){
    let reason=commonReason(session,id,options);const target=tier(tierId),current=paidTier(session,id);
    if(!reason){
      if(!target||target.number===1)reason='unknown-tier';
      else if(current>=target.number)reason='already-paid';
      else if(current!==target.number-1)reason='previous-tier';
      else if(session.ranks[id]!==target.requiredRank)reason='required-rank';
      else if(!hasBossVictory(session,target.requiredBossId))reason='boss-required';
      else if(session.gold<target.cost)reason='gold-short';
    }
    return {action:'tier',id,tierId,cost:target?.cost,cap:target?.cap,
      requiredRank:target?.requiredRank,requiredBossId:target?.requiredBossId,allowed:!reason,reason};
  }
  function snapshot(session){
    return {ranks:Object.fromEntries(ids.map(id=>[id,session.ranks[id]])),
      paidTierUnlocks:Object.fromEntries(ids.map(id=>[id,[...session.paidTierUnlocks[id]]])),
      bossVictories:bosses.filter(id=>hasBossVictory(session,id))};
  }
  function validSnapshot(value){
    if(!object(value)||!validState(value)||!Array.isArray(value.bossVictories)||
      new Set(value.bossVictories).size!==value.bossVictories.length||value.bossVictories.some(id=>!bosses.includes(id)))return false;
    return ids.every(id=>value.paidTierUnlocks[id].every(paid=>value.bossVictories.includes(tier(paid).requiredBossId)));
  }
  function restore(session,value){
    if(!validSnapshot(value))return false;
    const copy=JSON.parse(JSON.stringify(value));
    Object.assign(session.ranks,copy.ranks);session.paidTierUnlocks=copy.paidTierUnlocks;
    session.upgradeProgress={bossVictories:copy.bossVictories};session.progressSource=null;
    return true;
  }
  const skillStage=rank=>rank>=25?3:rank>=20?2:rank>=10?1:0;
  M.UpgradeProgress=Object.freeze({ids,bosses,paidTier,validState,hasBossVictory,recordBossVictory,bindSource,
    rankPrice,quoteRank,quoteTier,snapshot,validSnapshot,restore,skillStage});
})(window.PenjagaModules=window.PenjagaModules||{});
