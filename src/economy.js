/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installEconomy = function ({economy, config, world, math, audio, renderer, ui, session, upgrading,combat}) {
    economy.recruitUnit = function recruitUnit(free = false) {
      if (session.state !== 'playing') return;
      const kind = ['Archer', 'Lancer', 'Monk', 'Warrior'][session.recruitIndex % 4];
      const cost = kind === 'Monk' ? 55 : 40;
      const capacity=combat.allyCapacity();
      if (session.allies.filter(u=>u.hp>0).length >= capacity) { ui.notify(`Pasukan lengkap: maksimal ${capacity} sekutu.`); return false; }
      if (!free && session.gold < cost) { ui.notify(`Butuh ${cost} emas. Kumpulkan di tambang atau kalahkan musuh.`); return; }
      if (!free) session.gold -= cost;
      const hp = kind === 'Lancer' ? 130 : kind === 'Monk' ? 90 : 100;
      const occupied=new Set(session.allies.filter(u=>u.hp>0).map(u=>u.formationSlot));let formationSlot=0;while(occupied.has(formationSlot))formationSlot++;
      session.allies.push({ combatId:++session.combatId, formationSlot, x: world.allySpawn.x + math.rand(-15, 15), y: world.allySpawn.y + math.rand(-10, 10), homeX: world.allyHome.x + math.rand(0, world.allyHome.width), homeY: world.allyHome.y + math.rand(0, world.allyHome.height), kind, color: 'Blue', hp, maxHp: hp, facing: -1, moving: false, attack: 0, cooldown: .2, seed: math.rand(0, 10), speed: 88, team: 'ally', flankSign: session.recruitIndex % 2 ? 1 : -1, hitFlash: 0, stagger: 0, knockX: 0, knockY: 0, strike: null });
      session.recruitIndex++; if (!free) { ui.notify(`${{ Archer: 'Pemanah', Lancer: 'Penombak', Monk: 'Biarawan', Warrior: 'Ksatria' }[kind]} bergabung! (${session.allies.filter(u=>u.hp>0).length}/${capacity} sekutu)`); audio.tone(440, .15, 'triangle'); }
      renderer.addEffect('Particle FX/Dust_01.png', world.allySpawn.x, world.allySpawn.y, 65); ui.updateUI();
      return true;
    };

    economy.repairCastle = function repairCastle() {
      if (session.state !== 'playing') return;
      if (session.castle.hp >= session.castle.maxHp) { ui.notify('Kastel masih dalam kondisi sempurna.'); return; }
      if (session.wood < 30) { ui.notify('Butuh 30 kayu. Dekati pohon lalu tahan E.'); return; }
      session.wood -= 30; session.castle.hp = Math.min(session.castle.maxHp, session.castle.hp + 140); session.score += 15;
      renderer.addEffect(math.blue('Monk', 'Heal_Effect'), session.castle.x, session.castle.y, 220, .8); renderer.float('+140', session.castle.x, session.castle.y - 70, '#d0efa8', true);
      ui.notify('Kastel diperbaiki. Pertahankan rumahmu!'); audio.tone(330, .2, 'triangle', .03, 550); ui.updateUI();
    };

    economy.healHero = function healHero() {
      if (session.state !== 'playing') return;
      if (session.hero.healCooldown > 0) return;
      if (session.hero.hp >= session.hero.maxHp) { ui.notify('Tenagamu masih penuh.'); return; }
      if (session.food < 1) { ui.notify('Bekal habis. Dekati domba lalu tekan E.'); return; }
      const restored = Math.min(upgrading.foodHealing(), session.hero.maxHp - session.hero.hp);session.combatStats.oathHealing+=Math.max(0,restored-45);
      session.hero.work = null;
      session.food--; session.hero.healCooldown = upgrading.foodCooldown(); session.hero.hp += restored; renderer.float(`+${Math.ceil(restored)}`, session.hero.x, session.hero.y, '#c6eea1', true);
      renderer.addEffect(math.blue('Monk', 'Heal_Effect'), session.hero.x, session.hero.y, 140, .8); audio.tone(587, .25); ui.updateUI();
    };

    economy.nearestResource = function nearestResource() {
      let closest = null, distance = 85;
      for (const node of [...world.trees.filter(t => t.resource).map(t => ({ ...t, type: 'wood', name: 'Tebang kayu +8' })), ...world.goldNodes.map(n => ({ ...n, type: 'gold', name: `Tambang emas +${config.GATHERING_REWARDS.gold}` })), ...world.sheep.filter(s => s.cooldown <= 0).map(s => ({ ...s, type: 'food', name: 'Ambil bekal +1', original: s }))]) {
        const d = math.dist(session.hero, node); if (d < distance) { distance = d; closest = node; }
      }
      return closest;
    };

    economy.gather = function gather() {
      if (session.state !== 'playing' || session.gatherCooldown > 0 || session.hero.work || session.hero.attack > 0 || session.hero.stagger > 0 || session.hero.moving || session.hero.dash>0) return;
      const node = economy.nearestResource(); if (!node) return;
      session.hero.work = { node, elapsed: 0, duration: node.type === 'food' ? .7 : .9 };
      session.hero.facing = node.x < session.hero.x ? -1 : 1; session.hero.moving = false;
    };

    economy.updateWork = function updateWork(dt) {
      const work = session.hero.work; if (!work) return;
      if (math.dist(session.hero, work.node) > 88 || session.hero.stagger > 0) { session.hero.work = null; return; }
      const previousTime = work.elapsed;
      work.elapsed += dt;
      if (previousTime < work.duration * .55 && work.elapsed >= work.duration * .55) {
        renderer.addEffect('Particle FX/Dust_01.png', work.node.x, work.node.y - 8, 45, .4);
        audio.combatCue(work.node.type==='gold'?'stone':'wood',work.node);
      }
      if (work.elapsed < work.duration) return;
      const node = work.node; session.hero.work = null; session.gatherCooldown = .18;
      if (node.type === 'food' && node.original.cooldown > 0) return;
      if (node.type === 'wood') { session.wood += config.GATHERING_REWARDS.wood; renderer.float('+8 kayu', node.x, node.y); }
      if (node.type === 'gold') {
        const reward = config.GATHERING_REWARDS.gold;
        session.gold += reward;
        renderer.float(`+${reward} emas`, node.x, node.y);
      }
      if (node.type === 'food') { session.food += config.GATHERING_REWARDS.food; node.original.cooldown = 12; renderer.float('+1 bekal', node.x, node.y); }
      session.score += 5; renderer.addEffect('Particle FX/Dust_01.png', node.x, node.y - 10, 55); audio.tone(node.type === 'gold' ? 740 : 300, .08, 'triangle', .025); ui.updateUI();
    };
    economy.collectDrops = function (dt) {
      for (const d of session.drops) {
        d.life -= dt;
        const distance = math.dist(d, session.hero);
        if (distance < 110) { d.x += (session.hero.x - d.x) * dt * 8; d.y += (session.hero.y - d.y) * dt * 8; }
        if (distance < 30) { if (d.type === 'wood') session.wood += d.value; else session.gold += d.value; renderer.float(`+${d.value}`, session.hero.x, session.hero.y - 12); d.life = 0; }
      }
      session.drops = session.drops.filter(d => d.life > 0);
    };
    economy.updatePassiveIncome = function (dt) {
      session.passiveTimer += dt;
      if (session.passiveTimer >= 6) { session.passiveTimer -= 6; session.wood += 3; session.gold += 4; renderer.float('+3 kayu', world.villagers[0].x, world.villagers[0].y, '#dbdca0'); renderer.float('+4 emas', world.villagers[1].x, world.villagers[1].y); }
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
