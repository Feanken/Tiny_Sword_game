/* Contract fixture only; never loaded by a production entry point. */
((M)=>{
  M.tripleSlashVisualFixture=function(overrides={}){
    const active=(overrides.status??'active')==='active';
    const index=overrides.slashIndex??(active?1:0),local=overrides.slashElapsed??(active?.22:0);
    const elapsed=active?(index-1)*.3+local:0;
    return {
      status:'active',sequence:1,cooldownRemaining:active?8-elapsed:0,elapsed,slashIndex:index,
      slashElapsed:local,phase:!active?'idle':local<.16?'windup':local<.28?'contact':'recovery',angle:0,
      counterBonus:0,counterConsumed:false,hitCounts:[0,0,0],cancelReason:null,
      unlocked:true,ready:false,duration:.9,cooldown:8,slashDuration:.3,contactStart:.16,contactEnd:.28,
      ...overrides,
      hitArea:{origin:{x:720,y:400},angle:overrides.angle??0,reach:76,radius:18,halfAngle:1.3,backAllowance:12,...overrides.hitArea}
    };
  };
})(window.PenjagaModules=window.PenjagaModules||{});
