/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installSimulation = function ({simulation, host, world, config, math, input, audio, renderer, ui, session, director, lifecycle, navigation, ai, economy, combat}) {
    simulation.update = function update(dt) {
      if (session.state !== 'playing') return;
      for (const u of [session.hero, ...session.allies, ...session.enemies]) navigation.keepOnLand(u);
      if (session.castle.hp <= 0 || session.hero.hp <= 0) { lifecycle.finish(false); return; }
      renderer.updatePresentation(dt);
      session.pressureGap=Math.max(0,session.pressureGap-dt);session.rangedPressureGap=Math.max(0,session.rangedPressureGap-dt);session.pressureActive=0;
      for(const u of session.enemies)if(u.hp>0&&(u.strike?.target===session.hero&&u.kind!=='Archer'||u.isBoss&&u.bossAction?.stage==='warning'))session.pressureActive++;
      session.orderPulse=Math.max(0,session.orderPulse-dt);
      session.elapsed += dt; session.gatherCooldown = Math.max(0, session.gatherCooldown - dt); session.hero.cooldown = Math.max(0, session.hero.cooldown - dt); session.hero.attack = Math.max(0, session.hero.attack - dt); session.hero.invuln = Math.max(0, session.hero.invuln - dt);
      session.hero.healCooldown = Math.max(0, session.hero.healCooldown - dt);
      session.hero.dashCooldown=Math.max(0,(session.hero.dashCooldown||0)-dt);session.hero.riposte=Math.max(0,(session.hero.riposte||0)-dt);
      if(session.hero.dashBuffer>0){combat.startDash();session.hero.dashBuffer=Math.max(0,session.hero.dashBuffer-dt);}
      session.dashTrail.forEach(t=>t.life-=dt);session.dashTrail=session.dashTrail.filter(t=>t.life>0);
      const dashing=session.hero.dash>0;
      if(dashing){
        session.hero.dashElapsed+=dt;session.hero.dash=Math.max(0,session.hero.dash-dt);
        session.dashTrail.push({x:session.hero.x,y:session.hero.y,time:session.hero.dashElapsed,facing:session.hero.facing,life:.12});if(session.dashTrail.length>6)session.dashTrail.shift();
        navigation.move(session.hero,session.hero.dashX,session.hero.dashY,dt,720);
      }

      for (const u of [session.hero, ...session.allies, ...session.enemies]) combat.updateReaction(u, dt);
      session.castle.hitFlash = Math.max(0, (session.castle.hitFlash || 0) - dt);
      host.$('gameShell').classList.toggle('player-hit', session.hero.hitFlash > 0);
      const {dx, dy} = input.movement();
      if ((dx || dy) && session.hero.work) { session.hero.work = null; session.gatherCooldown = .2; }
      if((dx||dy)&&!dashing){const length=Math.hypot(dx,dy);session.hero.lastMoveX=dx/length;session.hero.lastMoveY=dy/length;}
      if (!dashing && session.hero.stagger <= 0) navigation.move(session.hero, dx, dy, dt, 185 * combat.heroMoveScale());
      combat.updateHeroSwing(dt);
      input.updateAim();
      session.hero.stepTimer=Math.max(0,(session.hero.stepTimer||0)-dt);if(session.hero.moving&&!dashing&&session.hero.stepTimer<=0){audio.playSample(['footstep_grass_000.ogg','footstep_grass_001.ogg'],session.hero,.16,1,0);session.hero.stepTimer=.32;}
      if (input.keys.has(' ') && session.hero.work) { session.hero.work = null; session.gatherCooldown = .18; }
      economy.updateWork(dt);
      if (input.keys.has(' ') || session.hero.attackBuffer>0) combat.heroAttack();
      session.hero.attackBuffer=Math.max(0,(session.hero.attackBuffer||0)-dt);
      if (input.keys.has('e')) economy.gather();
      for (const s of world.sheep) s.cooldown = Math.max(0, s.cooldown - dt);
      if (session.phase === 'prepare') { session.waveTimer -= dt; if (math.dist(session.hero, session.castle) < 155) session.hero.hp = Math.min(session.hero.maxHp, session.hero.hp + 4 * dt); if (session.waveTimer <= 0) director.startWave(); }
      else director.updateSpawns(dt);
      session.combatUnits.length=0;for(const u of session.allies)session.combatUnits.push(u);for(const u of session.enemies)session.combatUnits.push(u);
      session.engagements.clear();for(const u of session.combatUnits)if(u.hp>0&&u.kind!=='Monk'){const target=u.strike?.target||u.combatTarget;if(target?.hp>0)session.engagements.set(target,(session.engagements.get(target)||0)+1);}
      combat.beginDamageStep();
      for (const u of session.combatUnits) ai.updateUnit(u, dt);
      ai.separateCombatUnits(dt);
      combat.updateProjectiles(dt);

      combat.resolveHeroDamage();
      session.projectiles = session.projectiles.filter(p => p.life > 0); session.enemies = session.enemies.filter(u => u.hp > 0); session.allies = session.allies.filter(u => u.hp > 0);
      economy.collectDrops(dt);
      for (const u of [session.hero, ...session.allies, ...session.enemies]) {
        const animState = u.work ? 'Work' : u.stagger > 0 ? 'Hurt' : u.attack > 0 ? 'Attack' : u.moving ? 'Run' : 'Idle';
        if (u.animState !== animState) { u.animState = animState; u.animTime = 0; }
        else if(!(u.impactHold>0))u.animTime = (u.animTime || 0) + dt;
      }
      economy.updatePassiveIncome(dt);
      if (session.castle.hp <= 0 || session.hero.hp <= 0) { lifecycle.finish(false); return; }
      if (session.phase === 'battle' && session.spawned >= config.waves[session.waveIndex].count && session.enemies.length === 0 && (session.waveIndex<4||session.bossSpawned)) director.finishWave();
      ui.updateInteraction(dt);
      audio.updateMusic(dt);
    };

    simulation.advance = function advance(dt) {
      if(session.state!=='playing'){session.simulationAccumulator=0;return;}
      if(!Number.isFinite(dt)||dt<=0)return;
      session.simulationAccumulator += Math.min(.1,Math.max(0,dt));
      for(let steps=0;session.simulationAccumulator+1e-9>=config.FIXED_STEP&&steps<6&&session.state==='playing';steps++){
        session.simulationAccumulator=Math.max(0,session.simulationAccumulator-config.FIXED_STEP);simulation.update(config.FIXED_STEP);
      }
    };

    simulation.frame = function frame(time) {
      const dt = session.lastTime?math.clamp((time-session.lastTime)/1000,0,.1):0;session.lastTime=time;
      if (session.state !== 'paused' && !document.querySelector('dialog[open]') && session.state !== 'won' && session.state !== 'lost') session.animTime += dt;
      const wasPlaying=session.state==='playing';simulation.advance(dt);
      if(!wasPlaying&&session.state!=='paused')renderer.updatePresentation(dt);
      renderer.draw(); simulation.frameId = requestAnimationFrame(simulation.frame);
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
