/* Penjaga Pulau: application entry point; system composition lives in src/runtime.js. */
(() => {
  'use strict';
  const M = window.PenjagaModules;
  const runtime = M.createRuntime();
  runtime.ui.attach();
  runtime.input.attach();
  runtime.renderer.attach();
  // Read-only state for meaningful smoke tests and inspecting an active match.
  M.installInspection(runtime);
  runtime.ui.setDifficulty('normal');
  runtime.renderer.resize(); runtime.assets.preload(); requestAnimationFrame(runtime.simulation.frame);
})();
