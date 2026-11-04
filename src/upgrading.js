/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installUpgrading = function ({upgrading, host, config, audio, ui, session}) {
    upgrading.attackCooldown = function attackCooldown(){return config.HERO_ATTACK.cooldown*(1-Math.min(5,session.ranks.rhythm)*.06-Math.max(0,session.ranks.rhythm-5)*.03);};

    upgrading.swingCap = function swingCap(){return config.SWING.cap+upgrading.milestone('blade');};

    upgrading.counterBonus = function counterBonus(){return 12+session.ranks.counter*6+upgrading.milestone('counter')*8;};

    upgrading.dashImmunity = function dashImmunity(){return .16+upgrading.milestone('wind')*.02;};

    upgrading.foodCooldown = function foodCooldown(){return 1.8-upgrading.milestone('oath')*.3;};

    upgrading.dashCooldown = function dashCooldown(){return 2.4-Math.min(5,session.ranks.wind)*.25-Math.max(0,session.ranks.wind-5)*.08;};

    upgrading.fortressRadius = function fortressRadius(){return 160+session.ranks.bastion*20;};

    upgrading.buyUpgrade = function buyUpgrade(id) {
      const perk=config.upgrades.find(p=>p.id===id);
      if(!perk||session.phase!=='prepare'||session.ranks[id]>=config.MAX_UPGRADE_LEVEL||!(session.state==='playing'||(session.state==='paused'&&host.$('campDialog').open)))return false;
      const cost=perk.cost+session.ranks[id]*20;if(session.gold<cost)return false;
      session.gold-=cost;session.ranks[id]++;session.campPurchase=session.waveIndex;
      if(id==='bastion'){session.castle.maxHp+=80;session.castle.hp=Math.min(session.castle.maxHp,session.castle.hp+80);}
      if(id==='oath'){session.hero.maxHp+=15;session.hero.hp=Math.min(session.hero.maxHp,session.hero.hp+15);}
      if(id==='wind')session.hero.dashCooldown=Math.min(session.hero.dashCooldown,upgrading.dashCooldown());
      host.$('campFeedback').textContent=`${perk.name} tingkat ${session.ranks[id]} ditempa.${session.ranks[id]%5===0?' Bonus aktif: '+config.upgradeBuffs[id][session.ranks[id]/5-1]:' Berlaku hingga pertandingan selesai.'}`;
      audio.tone(523,.2,'triangle');ui.renderCamp();ui.updateUI();
      if(host.$('campDialog').open){const card=host.$('campCards').querySelector('[data-perk="'+id+'"]');(card&&!card.disabled?card:host.$('campCards').querySelector('button:not(:disabled)')||host.$('campReady')).focus({preventScroll:true});}
      return true;
    };

    upgrading.milestone = id=>Math.floor(session.ranks[id]/5);
  };
})(window.PenjagaModules = window.PenjagaModules || {});
