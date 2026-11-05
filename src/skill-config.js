/* Prototype skill parameters. Prices, tiers and base statistics belong to upgrading. */
((M)=>{
  'use strict';
  const stage=rank=>!Number.isFinite(rank)||rank<10?0:rank<20?1:rank<25?2:3;
  const config={
    stage,
    rhythm:{maxStacks:5,speedPerStack:[0,.02,.025,.03],hold:[0,3,4,5],decayInterval:.6,minCooldown:.30},
    wind:{charges:3,recharge:[0,2.4,2.2,2],gap:.6,duration:.2,immunity:.16,speed:720,buffer:.12},
    counter:{lifetime:4,recoveryMultiplier:[1,1,1.10,1.20],refund:[0,.5,.75,1],refundInternalCooldown:3},
    garrison:{baseCapacity:8,extra:[0,2,4,4],auraRadius:160,auraReduction:.20,totalReductionCap:.35},
    oath:{radius:[0,110,125,140],hps:[0,4,5,6],duration:[0,4,5,6],cooldown:18,heroHealCapPerSecond:.04},
    triple:{cooldown:[0,8,7,6],damageScale:[0,1,1.05,1.10]}
  };
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  M.SkillConfig=freeze(config);
})(window.PenjagaModules=window.PenjagaModules||{});
