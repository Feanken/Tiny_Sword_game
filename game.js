/* Entry point for the two-arena expedition and standalone Map 2 practice. */
(() => {
  'use strict';
  const M = window.PenjagaModules;
  const practiceLink = new URLSearchParams(location.search).get('map') === 'crossroads';
  const expedition = new M.Expedition();

  async function launch(mapId, {mode = 'expedition', request = null, seed, difficulty = 'normal', previous, autoStart = false} = {}) {
    const runtime = M.createRuntime({map: window.PenjagaMaps[mapId]});
    const {audio, host, input, lifecycle, renderer, session, simulation, ui} = runtime;
    const menu = M.createMainMenu(runtime);
    const continueButton = host.$('continueButton');
    const restartButton = host.$('restartButton');
    const lifecycleStart = lifecycle.startGame;
    const startGame = (seed, carry) => {
      lifecycleStart(seed, carry);
      menu.showArena();
    };
    const showTitle = lifecycle.showTitle;
    const finish = lifecycle.finish;
    let arena = request;
    let nextArena = null;

    if (previous) {
      cancelAnimationFrame(previous.simulation.frameId);
      previous.input.dispose();
      previous.renderer.detach();
      previous.ui.galleryObserver?.disconnect();
      host.$('galleryGrid').replaceChildren();
      audio.soundOn = previous.audio.soundOn;
      audio.effectsVolume = previous.audio.effectsVolume;
      audio.musicVolume = previous.audio.musicVolume;
      if (previous.audio.audio) {
        previous.audio.audio.close().catch(() => {});
        if (audio.soundOn) audio.initAudio();
      }
      host.$('campCards').replaceChildren();
      host.$('loadingProgress').style.width = '0%';
      host.$('loadingTrack').hidden = false;
      host.$('startButton').disabled = true;
      host.$('startLabel').textContent = 'Memuat pulau…';
      host.$('endScreen').hidden = true;
      host.$('worldName').textContent = runtime.world.name.toUpperCase();
      host.$('islandTitle').textContent = (mapId === 'island' ? '01 / ' : '02 / ') + runtime.world.name.toUpperCase();
      lifecycle.showTitle();
      session.state = 'loading';
    }

    lifecycle.showTitle = function () {
      if (mode === 'expedition' && mapId !== 'island') {
        return launch('island', {difficulty: session.difficulty, previous: runtime});
      }
      nextArena = null;
      arena = null;
      continueButton.hidden = true;
      showTitle();
      menu.showMain();
    };

    lifecycle.startGame = function (requestedSeed) {
      if (!session.initialized) return;
      if (session.state === 'ready') {
        const selected = menu.selectedMode;
        const target = selected === 'practice' ? 'crossroads' : 'island';
        if (selected !== mode || target !== mapId) {
          return launch(target, {
            mode: selected,
            request: selected === 'expedition' ? expedition.startNew() : null,
            seed: requestedSeed,
            difficulty: session.difficulty,
            previous: runtime,
            autoStart: true
          });
        }
      }
      if (mode === 'expedition' && mapId !== 'island' && session.state !== 'paused') {
        return launch('island', {request: expedition.startNew(), seed: requestedSeed, difficulty: session.difficulty, previous: runtime});
      }
      if (mode === 'expedition' && mapId === 'island' && session.state !== 'paused') arena = expedition.startNew();
      nextArena = null;
      continueButton.hidden = true;
      restartButton.hidden = false;
      startGame(requestedSeed, arena?.carry);
    };

    lifecycle.finish = function (won) {
      if (session.state !== 'playing') return;
      finish(won);
      if (!arena) return;
      const result = expedition.finishArena({
        runId: arena.runId, arenaIndex: arena.arenaIndex, mapId: arena.mapId,
        outcome: won ? 'won' : 'lost', gold: session.gold, ranks: session.ranks
      });
      nextArena = result.nextArena;
      if (nextArena) {
        host.$('resultDescription').textContent = 'Pulau pertama aman. Bawa emas dan upgrade ke Pulau Dua Arah.';
        continueButton.hidden = false;
        restartButton.hidden = true;
        continueButton.focus({preventScroll: true});
      } else if (result.status === 'completed') {
        host.$('resultTitle').textContent = 'Ekspedisi selesai!';
      }
    };

    input.listen(continueButton, 'click', () => {
      if (!nextArena) return;
      const pending = nextArena;
      nextArena = null;
      continueButton.hidden = true;
      launch(pending.mapId, {request: pending, seed: session.runSeed, difficulty: session.difficulty, previous: runtime});
    });
    ui.attach();
    input.attach();
    renderer.attach();
    M.installInspection(runtime);
    ui.setDifficulty(difficulty);
    host.$('gameShell').dataset.mode = mode;
    restartButton.textContent = mode === 'practice' ? 'Ulangi latihan' : 'Ulangi ekspedisi';
    host.$('newRunButton').textContent = mode === 'practice' ? 'Latihan baru' : 'Ekspedisi baru';
    host.$('titleButton').textContent = 'Menu utama';
    menu.showMain();
    if (practiceLink && !previous) menu.showSetup('practice');
    renderer.resize();
    simulation.frameId = requestAnimationFrame(simulation.frame);
    await runtime.assets.preload();
    menu.ready();
    if ((request || autoStart) && session.initialized) {
      continueButton.hidden = true;
      restartButton.hidden = false;
      startGame(seed, request?.carry);
    }
  }

  launch(practiceLink ? 'crossroads' : 'island', {mode: practiceLink ? 'practice' : 'expedition'});
})();
