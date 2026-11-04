/* Entry point for the two-arena expedition and standalone Map 2 practice. */
(() => {
  'use strict';
  const M = window.PenjagaModules;
  const practice = new URLSearchParams(location.search).get('map') === 'crossroads';
  const expedition = practice ? null : new M.Expedition();
  const initialMap = practice ? 'crossroads' : 'island';

  async function launch(mapId, {request = null, seed, difficulty = 'normal', previous} = {}) {
    const runtime = M.createRuntime({map: window.PenjagaMaps[mapId]});
    const {audio, host, input, lifecycle, renderer, session, simulation, ui} = runtime;
    const continueButton = host.$('continueButton');
    const restartButton = host.$('restartButton');
    const startGame = lifecycle.startGame;
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
      host.$('mapIslandLink').removeAttribute('aria-current');
      host.$('mapCrossroadsLink').removeAttribute('aria-current');
      host.$('worldName').textContent = runtime.world.name.toUpperCase();
      host.$('islandTitle').textContent = (mapId === 'island' ? '01 / ' : '02 / ') + runtime.world.name.toUpperCase();
      lifecycle.showTitle();
      session.state = 'loading';
    }

    if (expedition && mapId !== initialMap) {
      lifecycle.showTitle = () => launch(initialMap, {difficulty: session.difficulty, previous: runtime});
    }

    lifecycle.startGame = function (requestedSeed) {
      if (!session.initialized) return;
      if (expedition && mapId !== initialMap && session.state !== 'paused') {
        return launch(initialMap, {request: expedition.startNew(), seed: requestedSeed, difficulty: session.difficulty, previous: runtime});
      }
      if (expedition && (mapId === initialMap && session.state !== 'paused')) arena = expedition.startNew();
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
    renderer.resize();
    simulation.frameId = requestAnimationFrame(simulation.frame);
    await runtime.assets.preload();
    if (request && session.initialized) {
      continueButton.hidden = true;
      restartButton.hidden = false;
      startGame(seed, request.carry);
    }
  }

  launch(initialMap);
})();
