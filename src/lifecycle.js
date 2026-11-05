/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installLifecycle = function ({lifecycle, host, world, math, input, audio, renderer, ui, session, director, economy, combat}) {
    lifecycle.showTitle = function showTitle(){
      ui.setEntryWarning('');
      session.collectingHeroDamage=false;session.pendingHeroDamage=null;session.approachSlots.clear();session.engagements.clear();session.combatUnits.length=0;
      session.state='ready';input.clearCombatInput();session.simulationAccumulator=0;
      session.enemies=[];session.allies=[];session.effects=[];session.impacts=[];session.projectiles=[];session.dashTrail=[];session.boss=null;session.bossSpawned=false;
      Object.assign(session.hero,{x:world.heroSpawn.x,y:world.heroSpawn.y,hp:100,maxHp:100,attack:0,dash:0,dashCooldown:0,riposte:0,work:null,facing:1,invuln:0,hitFlash:0,stagger:0,cooldown:0,moving:false,knockX:0,knockY:0});session.castle.hp=session.castle.maxHp=500;session.castle.hitFlash=0;session.orderPulse=0;session.gold=80;session.wood=40;session.food=3;session.score=0;session.waveIndex=0;session.phase='prepare';session.waveTimer=22;for(const id in session.ranks)session.ranks[id]=0;
      session.hero.aimAngle=0;session.hero.swingAngle=0;session.hero.strike=null;
      session.resetSkills();
      ui.toastTimer=0;ui.announcementTimer=0;host.$('toast').classList.remove('show');host.$('announcement').classList.remove('show');host.$('worldCaption').hidden=false;
      host.$('startScreen').hidden=false;host.$('endScreen').hidden=true;host.$('pauseScreen').hidden=true;host.$('battleStatus').hidden=true;host.$('squadBar').hidden=true;host.$('bossBar').hidden=true;host.$('dashButton').hidden=true;host.$('mobileControls').hidden=true;
      document.body.classList.remove('is-playing');host.$('arena').classList.remove('boss-active');ui.setDifficulty(session.difficulty);ui.updateUI();renderer.resize();
    };

    lifecycle.startGame = function startGame(seed, carry) {
      if (!session.initialized) return;
      ui.setEntryWarning('');
      session.runSeed=Number.isInteger(seed)?seed>>>0:Math.floor(Math.random()*4294967296)>>>0;session.encounters=director.makeEncounters(session.runSeed);
      session.gameRandom=math.seededRandom(session.runSeed);
      for(const voice of [...audio.soundVoices]){voice.source.stop();voice.finish();}
      combat.resetCombatStats();
      session.resetForRun();
      if (carry) {
        session.gold = carry.gold;
        Object.assign(session.ranks, carry.ranks);
        Object.assign(session.hero, carry.hero);
        Object.assign(session.castle, carry.castle);
      }
      audio.lastCombatCue.clear();
      world.resetResources();
      ui.pausedForDialog = false; ui.toastTimer = 0;
      host.$('toast').classList.remove('show'); host.$('squadBar').hidden = false;
      input.clearCombatInput(); session.state = 'playing';
      combat.syncSkillRanks();
      host.$('startScreen').hidden = true; host.$('pauseScreen').hidden = true; host.$('endScreen').hidden = true;
      host.$('wavePanel').hidden = false; host.$('scorePanel').hidden = false; host.$('worldCaption').hidden = true;
      host.$('dashButton').hidden = false; host.$('battleStatus').hidden = false; document.body.classList.add('is-playing'); host.$('gameShell').classList.remove('player-hit');
      host.$('mobileControls').hidden = !matchMedia('(pointer:coarse)').matches;
      host.$('pauseButton').textContent = 'Ⅱ'; host.$('pauseButton').setAttribute('aria-label', 'Jeda permainan');
      economy.recruitUnit(true); ui.updateUI(); renderer.resize(); host.canvas.focus({ preventScroll: true });
      ui.announce('Selamat datang, Penjaga.', 'KUMPULKAN BEKAL · SIAPKAN PASUKAN');
      audio.tone(392, .2); audio.tone(523, .3, 'sine', .025);
    };

    lifecycle.finish = function finish(won) {
      combat.cancelTripleSlash(session.hero.hp<=0?'death':'run-ended');
      combat.endUpgradeSkills(session.hero.hp<=0?'death':'run-ended');
      ui.setEntryWarning('');
      session.state = won ? 'won' : 'lost'; input.clearCombatInput();
      host.$('announcement').classList.remove('show'); host.$('interactionHint').hidden = true; host.$('mobileControls').hidden = true;
      if (won) session.score += Math.round(session.castle.hp * 2 + session.hero.hp * 3);
      session.score=Math.round(session.score*director.settings().score);
      if (session.score > ui.best) { ui.best = session.score; try { localStorage.setItem(ui.scoreKey(session.difficulty), String(ui.best)); } catch {} }
      host.$('bestScore').textContent = String(ui.best).padStart(4, '0');
      host.$('resultEyebrow').textContent = won ? 'KERAJAAN TETAP BERDIRI' : 'SETIAP PENJAGA PERNAH TERJATUH';
      host.$('resultIcon').textContent = won ? '♜' : '⚔';
      host.$('resultTitle').textContent = won ? 'Pulau terselamatkan!' : 'Kita coba sekali lagi.';
      host.$('resultDescription').textContent = won ? `Panglima Kelam ditaklukkan pada mode ${director.settings().name}. Rumah ini masih milik kita.` : session.castle.hp <= 0 ? 'Kastel telah runtuh. Rekrut pasukan dan sisakan kayu untuk perbaikan.' : 'Sang penjaga kehabisan tenaga. Gunakan bekal dan tetap dekat sekutu.';
      host.$('finalScore').textContent = session.score; host.$('finalKills').textContent = session.kills; host.$('finalWave').textContent = `${session.waveIndex + 1} / 5`;
      host.$('runLabel').textContent=`Ekspedisi ${session.runSeed.toString(36).toUpperCase().padStart(6,'0')} · ${director.settings().name}`;
      host.$('endScreen').hidden = false; host.$('restartButton').focus({ preventScroll: true }); ui.updateUI();
      audio.tone(won ? 659 : 196, .7, 'triangle', .04, won ? 880 : 98);
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
