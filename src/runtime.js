/* Composition root. Ports are allocated before installation to support explicit cycles. */
(function (M) {
  'use strict';
  function selectedMap() {
    const playtest = window.location && new URLSearchParams(window.location.search).get('map') === 'crossroads';
    return (playtest && window.PenjagaMaps.crossroads) || window.PenjagaMaps.island;
  }
  M.createRuntime = function ({map = selectedMap()} = {}) {
    const $ = id => document.getElementById(id);
    const canvas = $('gameCanvas');
    const world = new M.World(map);
    const session = new M.GameSession({world});
    const runtime = {
      host: {$, canvas, ctx: canvas.getContext('2d')},
      config: M.config, world, session, input: new M.InputController(),
      math: {}, assets: {}, audio: {}, renderer: {}, ui: {}, director: {},
      lifecycle: {}, upgrading: {}, navigation: {}, bossSystem: {}, ai: {}, economy: {}, combat: {}, simulation: {}
    };
    // Each installer destructures only the ports it uses. State belongs to its component.
    for (const name of ['math', 'input', 'assets', 'audio', 'navigation', 'renderer', 'ui', 'director', 'lifecycle', 'upgrading', 'bossSystem', 'ai', 'economy', 'combat', 'simulation']) {
      M['install' + name[0].toUpperCase() + name.slice(1)](runtime);
    }
    runtime.combat.resetCombatStats();
    return runtime;
  };
})(window.PenjagaModules = window.PenjagaModules || {});
