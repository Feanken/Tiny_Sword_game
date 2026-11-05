/* Test-only boss receipts. Not loaded by index.html; never infers payment from rank. */
((scope)=>{
  'use strict';
  scope.giveUpgradeBossEvidence=(runtime,...bossIds)=>{
    for(const id of bossIds){
      if(!scope.PenjagaModules.UpgradeProgress.recordBossVictory(runtime.session,id))
        throw new Error('Fixture cannot record boss evidence: '+id);
    }
    runtime.ui.renderCamp();
  };
})(window);
