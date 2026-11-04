/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installUi = function ({ui, host, world, config, input, assets: assetStore, renderer, session, director, upgrading, bossSystem, audio, lifecycle, ai, economy}) {
    ui.scoreKey = id => 'penjaga-pulau-best-' + (world.id === 'island' ? id : world.id + '-' + id);
    ui.setDifficulty = function setDifficulty(id){
      if(!config.difficulties[id]||!['loading','ready'].includes(session.state))return false;
      session.difficulty=id;
      try{ui.best=Number(localStorage.getItem(ui.scoreKey(id)))||(world.id==='island'&&id==='normal'?Number(localStorage.getItem('penjaga-pulau-best')):0)||0;}catch{ui.best=0;}
      host.$('bestScore').textContent=String(ui.best).padStart(4,'0');host.$('difficultyNote').textContent=director.settings().note;
      document.querySelectorAll('[data-difficulty]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.difficulty===id)));
      return true;
    };

    ui.renderCamp = function renderCamp() {
      host.$('campGold').textContent=session.gold;
      host.$('campRound').textContent=`JEDA ${session.waveIndex+1} / 5`;
      host.$('campRule').textContent='Beli berkali-kali selama emas cukup. Setiap jalur maksimal 10 tingkat; sisakan emas untuk pasukan.';
      host.$('campCards').replaceChildren();
      for(const perk of config.upgrades){
        const level=session.ranks[perk.id],cost=perk.cost+level*20,button=document.createElement('button');
        button.className='perk-card';button.dataset.perk=perk.id;
        button.disabled=level>=config.MAX_UPGRADE_LEVEL||session.gold<cost||session.phase!=='prepare';
        button.innerHTML=`<span class="perk-category">${perk.group}<span>${level} / ${config.MAX_UPGRADE_LEVEL}</span></span><span class="perk-icon" aria-hidden="true">${perk.icon}</span><strong>${perk.name}</strong><span class="perk-description">${perk.description}<span class="perk-milestone ${level>=5?'active':''}">V · ${level>=5?'AKTIF · ':''}${config.upgradeBuffs[perk.id][0]}</span><span class="perk-milestone ${level>=10?'active':''}">X · ${level>=10?'AKTIF · ':''}${config.upgradeBuffs[perk.id][1]}</span></span><span class="perk-price">${level>=config.MAX_UPGRADE_LEVEL?'TINGKAT 10 / 10':`${cost} emas <span>Tingkat ${level+1} →</span>`}</span>`;
        button.addEventListener('click',()=>upgrading.buyUpgrade(perk.id));host.$('campCards').append(button);
      }
      host.$('campBuild').textContent=config.upgrades.filter(p=>session.ranks[p.id]).map(p=>`${p.name} ${session.ranks[p.id]}`).join(' · ')||'Belum ada penempaan. Setiap pilihan membentuk cara bertarungmu.';
    };

    ui.openCamp = function openCamp(){
      if(session.state!=='playing'&&session.state!=='paused')return;
      if(session.phase!=='prepare'){ui.notify('Perkemahan dibuka saat jeda gelombang.');return;}
      host.$('campFeedback').textContent='';ui.renderCamp();ui.openDialog('campDialog');host.$('campCards').querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    };

    ui.notify = function notify(text) { host.$('toast').textContent = text; host.$('toast').classList.add('show');ui.toastTimer=3;renderer.overlayDirty=true; };

    ui.announce = function announce(title, subtitle) {
      host.$('announcement').replaceChildren(document.createTextNode(title));
      const small = document.createElement('small'); small.textContent = subtitle; host.$('announcement').append(small);
      host.$('announcement').classList.add('show');ui.announcementTimer=2.5;renderer.overlayDirty=true;
    };

    ui.entryWarning = '';
    ui.setEntryWarning = function (directions) {
      const message = directions ? 'Musuh mendekat · ' + directions : '';
      if (message === ui.entryWarning) return;
      ui.entryWarning = message;
      const warning = host.$('entryWarning');
      warning.hidden = !message;
      warning.textContent = message;
      renderer.overlayDirty = true;
    };

    ui.updateUI = function updateUI() {
      host.$('followButton').setAttribute('aria-pressed',String(session.squadOrder==='follow'));host.$('guardButton').setAttribute('aria-pressed',String(session.squadOrder==='guard'));
      host.$('squadHint').textContent=`${session.allies.length} sekutu · ${session.squadOrder==='follow'?'Ikuti penjaga, lindungi sekitarnya':'Jaga halaman kastel, jangan mengejar terlalu jauh'}`;
      host.$('modeBadge').textContent=director.settings().name;
      const bossVisible=!!(session.boss&&session.boss.hp>0);if(host.$('bossBar').hidden===bossVisible)renderer.overlayDirty=true;
      host.$('bossBar').hidden=!bossVisible;host.$('arena').classList.toggle('boss-active',bossVisible);
      if(session.boss&&session.boss.hp>0){host.$('bossHealth').style.width=`${session.boss.hp/session.boss.maxHp*100}%`;host.$('bossValue').textContent=`${Math.ceil(session.boss.hp)} / ${session.boss.maxHp}`;host.$("bossIntent").textContent=bossSystem.bossIntentText(session.boss);}

      const cd=session.hero.dashCooldown||0,ready=cd<=0;
      host.$('dashLabel').textContent=session.hero.riposte>0?'Balasan siap!':ready?'Langkah Embun':`Pulih ${cd.toFixed(1)} dtk`;
      host.$('dashButton').disabled=session.state!=='playing';host.$('dashButton').classList.toggle('cooling-down',!ready);
      host.$('dashFill').style.width=`${(1-cd/upgrading.dashCooldown())*100}%`;
      host.$('touchDash').disabled=session.state!=='playing';host.$('touchDash').classList.toggle('cooling-down',!ready);host.$('touchDash').textContent=ready?'➶':cd.toFixed(1);
      host.$('campButton').disabled=session.phase!=='prepare';host.$('campButton').textContent=session.phase!=='prepare'?'Perkemahan · jeda':'✦ Upgrade · U';

      host.$('heroHealth').textContent = `${Math.ceil(session.hero.hp)} / ${session.hero.maxHp}`; host.$('heroHealthBar').style.width = `${session.hero.hp/session.hero.maxHp*100}%`;
      host.$('castleHealth').textContent = `${Math.ceil(session.castle.hp)} / ${session.castle.maxHp}`; host.$('castleHealthBar').style.width = `${session.castle.hp/session.castle.maxHp*100}%`;
      host.$('goldCount').textContent = session.gold; host.$('woodCount').textContent = session.wood; host.$('foodCount').textContent = session.food; host.$('scoreCount').textContent = String(session.score).padStart(4, '0');
      const w = config.waves[session.waveIndex];
      host.$('waveCount').textContent = `${session.phase === 'prepare' ? session.waveIndex : session.waveIndex + 1} / 5`;
      host.$('waveTitle').textContent = session.phase === 'prepare' ? `Jeda · ${Math.max(0, Math.ceil(session.waveTimer))} dtk` : `Gelombang ${session.waveIndex + 1}`;
      host.$('waveDetail').textContent = `${director.settings().name} · ${session.encounters[session.waveIndex]?.name||w.name}`;
      host.$('waveProgress').style.width = `${session.phase === 'prepare' ? (1 - session.waveTimer / (session.waveIndex === 0 ? 22 : 15)) * 100 : (session.spawned - session.enemies.filter(u=>!u.isBoss).length) / w.count * 100}%`;
      host.$('enemyCount').textContent = session.phase === 'prepare' ? `${session.allies.length} sekutu bersiap` : `${session.enemies.length + w.count - session.spawned+(session.waveIndex===4&&!session.bossSpawned?1:0)} musuh tersisa`;
      host.$('phaseHint').textContent = (session.encounters[session.waveIndex]?.hint||'U: pilih upgrade · Shift: dash menghindar.')+(session.phase==='prepare'&&session.ranks.bastion>0?' Benteng aktif saat kamu dekat kastel.':'');
      host.$('healButton').title=`Pulihkan hingga ${45+5*session.ranks.oath} nyawa penjaga dengan 1 bekal. Tombol Q.`;
      const cost = session.recruitIndex % 4 === 2 ? 55 : 40;
      host.$('recruitCost').textContent = `${cost} emas · ${session.allies.length}/8`;
      host.$('recruitButton').classList.toggle('unavailable', session.gold < cost || session.allies.length >= 8);
      host.$('repairButton').classList.toggle('unavailable', session.wood < 30 || session.castle.hp >= session.castle.maxHp);
      host.$('healButton').classList.toggle('unavailable', session.food < 1 || session.hero.hp >= session.hero.maxHp);
    };

    ui.togglePause = function togglePause(force) {
      if (session.state !== 'playing' && session.state !== 'paused') return;
      const pause = typeof force === 'boolean' ? force : session.state === 'playing';
      session.simulationAccumulator = 0;
      session.state = pause ? 'paused' : 'playing'; input.clearCombatInput();
      host.$('pauseScreen').hidden = !pause; host.$('pauseButton').textContent = pause ? '▶' : 'Ⅱ';
      host.$('pauseButton').setAttribute('aria-label', pause ? 'Lanjutkan permainan' : 'Jeda permainan');
      host.$('interactionHint').hidden = true;
      if (pause) host.$('resumeButton').focus({ preventScroll: true }); else host.canvas.focus({ preventScroll: true });
    };

    ui.openDialog = function openDialog(id) {
      if (document.querySelector('dialog[open]')) return;
      session.simulationAccumulator = 0;
      ui.pausedForDialog = session.state === 'playing'; if (ui.pausedForDialog) { session.state = 'paused'; input.clearCombatInput(); }
      if (id === 'galleryDialog' && !host.$('galleryGrid').children.length) ui.renderGallery();
      host.$(id).showModal();
    };

    ui.renderGallery = function renderGallery() {
      ui.galleryObserver?.disconnect(); host.$('galleryGrid').replaceChildren();
      const category = host.$('galleryCategory').value, query = host.$('gallerySearch').value.toLowerCase();
      const assets = window.TINY_ASSETS.filter(a => (!category || a.path.startsWith(category + '/')) && a.path.toLowerCase().includes(query));
      host.$('gallerySummary').textContent = `${assetStore.length} dari ${window.TINY_ASSETS.length} aset asli · 5 folder utama · 56 folder aset`;
      ui.galleryObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const preview = entry.target, meta = assetStore.manifest.get(preview.dataset.path);
        assetStore.loadImage(meta.path).then(im => {
          const g = preview.getContext('2d'); g.imageSmoothingEnabled = false;
          const animated = /Units\/|Particle FX\/|Trees\/Tree|Sheep\/|Bushes\/|Water Foam|Rubber Duck/.test(meta.path);
          const sw = animated ? renderer.spriteFrame(meta.path).width : meta.width, sh = meta.height;
          const s = Math.min(90 / sw, 90 / sh); g.drawImage(im, 0, 0, sw, sh, (90 - sw * s) / 2, (90 - sh * s) / 2, sw * s, sh * s);
        }).catch(() => {});
        ui.galleryObserver.unobserve(preview);
      }), { root: host.$('galleryGrid'), rootMargin: '150px' });
      for (const a of assets) {
        const card = document.createElement('div'); card.className = 'gallery-card';
        const art = document.createElement('div'); art.className = 'gallery-art';
        const preview = document.createElement('canvas'); preview.width = 90; preview.height = 90; preview.dataset.path = a.path; preview.setAttribute('aria-label', a.path); art.append(preview);
        const title = document.createElement('strong'); title.textContent = a.path.split('/').pop().replace('.png', '');
        const folder = document.createElement('small'); folder.textContent = a.path.slice(0, a.path.lastIndexOf('/'));
        card.append(art, title, folder); host.$('galleryGrid').append(card); ui.galleryObserver.observe(preview);
      }
      if (!assetStore.length) { const empty = document.createElement('p'); empty.textContent = 'Tidak ada aset yang cocok.'; host.$('galleryGrid').append(empty); }
    };

    ui.uiTimer = 0;

    ui.announcementTimer = 0;

    ui.toastTimer = 0;

    ui.best = 0;

    ui.pausedForDialog = false;

    ui.galleryObserver = undefined;

    if (world.id === 'island') {
      try { ui.best = Number(localStorage.getItem('penjaga-pulau-best')) || 0; } catch { /* private/file contexts may deny storage */ }
    }

    host.$('bestScore').textContent = String(ui.best).padStart(4, '0');

      ui.attach = function () {
    host.$('gameShell').dataset.map = world.id;
    const crossroads = world.id === 'crossroads';
    host.$(crossroads ? 'mapCrossroadsLink' : 'mapIslandLink').setAttribute('aria-current', 'page');
    if (crossroads) {
      host.$('worldName').textContent = world.name.toUpperCase();
      host.$('islandTitle').textContent = '02 / ' + world.name.toUpperCase();
    }
    for (const id of ['helpDialog', 'galleryDialog', 'campDialog','audioDialog']) {
      input.listen(host.$(id), 'close', () => { if (ui.pausedForDialog) { session.state = 'playing';input.clearCombatInput();host.canvas.focus({ preventScroll: true }); } ui.pausedForDialog = false; });
      input.listen(host.$(id), 'click', e => { if (e.target === host.$(id)) { const r = host.$(id).getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) host.$(id).close(); } });
    }
    document.querySelectorAll('[data-close]').forEach(b => input.listen(b, 'click', () => host.$(b.dataset.close).close()));
    document.querySelectorAll('[data-difficulty]').forEach(b=>input.listen(b, 'click',()=>ui.setDifficulty(b.dataset.difficulty)));
    input.listen(host.$('titleButton'), 'click',lifecycle.showTitle);
    input.listen(host.$('followButton'), 'click',()=>{ai.setSquadOrder('follow');host.canvas.focus({preventScroll:true});});
    input.listen(host.$('guardButton'), 'click',()=>{ai.setSquadOrder('guard');host.canvas.focus({preventScroll:true});});
    input.listen(host.$('campButton'), 'click',ui.openCamp);
    input.listen(host.$('campReady'), 'click',()=>{session.waveTimer=Math.min(session.waveTimer,3);host.$('campDialog').close();});
    input.listen(host.$('helpButton'), 'click', () => ui.openDialog('helpDialog'));
    input.listen(host.$('audioSettingsButton'), 'click',()=>{audio.initAudio();audio.updateAudioVolumes();ui.openDialog('audioDialog');});
    input.listen(host.$('effectsVolume'), 'input',()=>{audio.effectsVolume=Number(host.$('effectsVolume').value)/100;audio.updateAudioVolumes();});
    input.listen(host.$('musicVolume'), 'input',()=>{audio.musicVolume=Number(host.$('musicVolume').value)/100;audio.updateAudioVolumes();});
    input.listen(host.$('galleryButton'), 'click', () => ui.openDialog('galleryDialog'));
    input.listen(host.$('gallerySearch'), 'input', ui.renderGallery);
    input.listen(host.$('galleryCategory'), 'change', ui.renderGallery);
    input.listen(host.$('startButton'), 'click',()=>lifecycle.startGame());
    input.listen(host.$('restartButton'), 'click',()=>lifecycle.startGame(session.runSeed));
    input.listen(host.$('restartPauseButton'), 'click',()=>lifecycle.startGame(session.runSeed));
    input.listen(host.$('newRunButton'), 'click',()=>lifecycle.startGame());
    input.listen(host.$('pauseButton'), 'click', () => ui.togglePause());
    input.listen(host.$('resumeButton'), 'click', () => ui.togglePause(false));
    for (const [id, action] of [['recruitButton', () => economy.recruitUnit()], ['repairButton', economy.repairCastle], ['healButton', economy.healHero]]) {
      input.listen(host.$(id), 'click', () => { action(); if (session.state === 'playing') host.canvas.focus({ preventScroll: true }); });
    }
    input.listen(host.$('soundButton'), 'click', () => {
      audio.initAudio(); audio.soundOn = !audio.soundOn; host.$('soundButton').setAttribute('aria-pressed', String(audio.soundOn)); host.$('soundButton').setAttribute('aria-label', audio.soundOn ? 'Matikan suara' : 'Nyalakan suara');
      if(audio.audioMaster)audio.audioMaster.gain.setTargetAtTime(audio.soundOn?.8:0,audio.audio.currentTime,.02);
      host.$('soundButton').querySelector('.sound-off').hidden = audio.soundOn; if (audio.soundOn) audio.tone(523, .2);
    });
    input.listen(host.$('fullscreenButton'), 'click', async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await host.$('gameShell').requestFullscreen(); }
      catch { ui.notify('Layar penuh tidak tersedia di browser ini.'); }
    });
    input.listen(document, 'fullscreenchange', renderer.resize);
      };
    ui.updateInteraction = function (dt) {
      ui.uiTimer += dt;
      if (ui.uiTimer > .1) {
        ui.updateUI(); ui.uiTimer = 0;
        const node = session.hero.attack>0||session.hero.dash>0||session.hero.damageCue>0?null:economy.nearestResource(); host.$('interactionHint').hidden = !node;
        if (node) host.$('interactionHint').querySelector('span').textContent = `${node.name} · tahan E`;
      }
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
