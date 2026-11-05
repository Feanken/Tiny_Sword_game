/* One campaign runtime: chapter boundaries keep World, actors and their owned state. */
(async()=>{
  'use strict';
  const M=window.PenjagaModules;
  const runtime=M.createRuntime({map:window.PenjagaMaps['campaign-islands']});
  const {host,session,lifecycle,simulation,ui,input,renderer}=runtime;
  const menu=M.createMainMenu(runtime),start=lifecycle.startGame,title=lifecycle.showTitle;
  lifecycle.startGame=function(seed){
    if(!session.initialized)return false;
    start(seed);menu.showArena();return true;
  };
  lifecycle.showTitle=function(){title();menu.showMain();};
  host.$('continueButton').hidden=true;
  host.$('restartButton').textContent='Ulangi kampanye dari Bab 1';
  host.$('restartPauseButton').textContent='Ulangi kampanye dari Bab 1';
  host.$('newRunButton').textContent='Kampanye baru';
  host.$('titleButton').textContent='Menu utama';
  host.$('gameShell').dataset.mode='campaign';
  host.$('worldName').textContent='KEPULAUAN PENJAGA';
  ui.attach();input.attach();renderer.attach();M.installInspection(runtime);
  ui.setDifficulty('normal');menu.showMain();renderer.resize();
  simulation.frameId=requestAnimationFrame(simulation.frame);
  await runtime.assets.preload();menu.ready();
})();
