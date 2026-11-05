/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  // PointerEvent client coordinates can round to float CSS pixels in browsers.
  const AIM_CENTER_EPSILON = .001;

  M.InputController = class InputController {
    constructor() { this.listeners = []; this.attached = false; }
    listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      this.listeners.push(() => target.removeEventListener(type, listener, options));
    }
    dispose() {
      this.listeners.splice(0).forEach(remove => remove());
      this.clearCombatInput();
      this.attached = false;
    }
  };
  M.installInput = function ({input, session, combat, host, ui, ai, economy, renderer}) {
    input.pointerScreen = null;
    input.pointerWorld = null;
    input.mouseAimActive = false;
    input.pointerOverCanvas = false;
    const projectPointer = function () {
      if (input.pointerScreen) input.pointerWorld = renderer.screenToWorld(input.pointerScreen.x, input.pointerScreen.y);
    };
    const desiredAim = function () {
      const hero=session.hero;
      let angle=Number.isFinite(hero.aimAngle)?hero.aimAngle:0;
      if(input.mouseAimActive){
        const point=input.pointerOverCanvas&&input.pointerWorld;
        if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y)){
          const origin=combat.heroAttackOrigin(),dx=point.x-origin.x,dy=point.y-origin.y;
          if(Math.hypot(dx,dy)>AIM_CENTER_EPSILON)angle=Math.atan2(dy,dx);
        }
      }else{
        const {dx,dy}=input.movement();
        if(dx||dy)angle=Math.atan2(dy,dx);
      }
      return angle;
    };
    input.desiredAimAngle = function desiredAimAngle() { projectPointer();return desiredAim(); };
    const syncAim = function () {
      const hero=session.hero,skill=hero.skills.tripleSlash;
      const angle=hero.strike?.angle ?? (skill.status==='active'?skill.angle:desiredAim());
      hero.aimAngle=angle;
      const horizontal=Math.cos(angle);
      if(Math.abs(horizontal)>1e-9)hero.facing=horizontal>0?1:-1;
      return angle;
    };
    input.updateAim = function updateAim() {
      projectPointer();
      return syncAim();
    };
    input.updatePointerWorld = function updatePointerWorld() {
      projectPointer();
      // The existing renderer calls this after camera.follow. Keep a stationary
      // cursor aligned with the new view, without letting rendering own the aim.
      if(session.state==='playing')syncAim();
    };
    const pointerOnCanvas=event=>document.elementFromPoint(event.clientX,event.clientY)===host.canvas;
    const releaseMouseAttack=event=>{
      input.pointerInput(event.pointerId,null,false);
      if(!input.keyboardKeys.has(' '))session.hero.attackBuffer=0;
      if(host.canvas.hasPointerCapture(event.pointerId))host.canvas.releasePointerCapture(event.pointerId);
    };
    const trackPointer = event => {
      if(event.pointerType!=='mouse')return;
      input.pointerOverCanvas=pointerOnCanvas(event);
      if(!input.pointerOverCanvas){releaseMouseAttack(event);return;}
      input.mouseAimActive=true;
      input.pointerScreen = {x:event.clientX, y:event.clientY};
      if(session.state==='playing')input.updateAim();else input.updatePointerWorld();
    };
    input.syncInputKey = function syncInputKey(key){
      if(input.keyboardKeys.has(key)||[...input.pointerBindings.values()].includes(key))input.keys.add(key);else input.keys.delete(key);
    };

    input.keyboardInput = function keyboardInput(key,down){
      if(down)input.keyboardKeys.add(key);else input.keyboardKeys.delete(key);input.syncInputKey(key);
    };

    input.pointerInput = function pointerInput(id,key,down){
      const previous=input.pointerBindings.get(id);input.pointerBindings.delete(id);
      if(down)input.pointerBindings.set(id,key);
      if(previous)input.syncInputKey(previous);if(key)input.syncInputKey(key);
    };

    input.clearCombatInput = function clearCombatInput(){
      input.keys.clear();input.keyboardKeys.clear();input.pointerBindings.clear();session.hero.attackBuffer=0;session.hero.dashBuffer=0;session.lastTime=0;
    };

    input.bindTouchControl = function bindTouchControl(button,key){
      input.listen(button, 'pointerdown',e=>{e.preventDefault();if(session.state!=='playing')return;button.setPointerCapture(e.pointerId);input.pointerInput(e.pointerId,key,true);if(key===' ')combat.requestAttack();});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])input.listen(button, event,e=>input.pointerInput(e.pointerId,null,false));
    };

    input.keys = new Set();

    input.keyboardKeys = new Set();

    input.pointerBindings = new Map();

      input.attach = function () {
        if (input.attached) return;
        input.attached = true;
    input.listen(host.$('dashButton'), 'click',()=>{combat.requestDash();host.canvas.focus({preventScroll:true});});
    input.listen(host.$('touchDash'), 'pointerdown',e=>{e.preventDefault();combat.requestDash();});
    input.listen(window, 'keydown', e => {
      if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if ((key === 'p' || key === 'escape') && !e.repeat) { e.preventDefault(); ui.togglePause(); return; }
      if (session.state !== 'playing') return;
      if((key==='f'||key==='g')&&!e.repeat){e.preventDefault();ai.setSquadOrder(key==='f'?'follow':'guard');return;}
      if(key==='u'&&!e.repeat){e.preventDefault();ui.openCamp();return;}
      if(key==='shift'){e.preventDefault();if(!e.repeat)combat.requestDash();return;}
      if(key==='q'){
        e.preventDefault();
        if(!e.repeat&&!input.keyboardKeys.has(key)){input.keyboardInput(key,true);combat.requestTripleSlash();}
        return;
      }
      const controls = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ', 'e', '1', '2', 'h'];
      if (!controls.includes(key)) return;
      // Native buttons retain keyboard activation when deliberately focused.
      if (key === ' ' && e.target.tagName === 'BUTTON') return;
      e.preventDefault();if(e.repeat&&!input.keyboardKeys.has(key))return;input.keyboardInput(key,true);if(key===' '&&!e.repeat)combat.requestAttack();
      if (!e.repeat) { if (key === '1') economy.recruitUnit(); if (key === '2') economy.repairCastle(); if (key === 'h') economy.healHero(); }
    });
    input.listen(window, 'keyup', e => input.keyboardInput(e.key.toLowerCase(),false));
    input.listen(window, 'blur', () => { input.clearCombatInput(); if (session.state === 'playing') ui.togglePause(true); });
    input.listen(document, 'visibilitychange', () => { if (document.hidden && session.state === 'playing') ui.togglePause(true); });
    input.listen(host.canvas, 'pointerdown',e=>{
      trackPointer(e);
      if(e.pointerType!=='mouse'||e.button!==0||!input.pointerOverCanvas||session.state!=='playing'||document.querySelector('dialog[open]'))return;
      host.canvas.focus({preventScroll:true});host.canvas.setPointerCapture(e.pointerId);input.pointerInput(e.pointerId,' ',true);combat.requestAttack();
    });
    input.listen(host.canvas, 'pointermove', trackPointer);
    input.listen(host.canvas, 'pointerenter', trackPointer);
    input.listen(host.canvas, 'pointerleave',e=>{
      if(e.pointerType!=='mouse')return;
      input.pointerOverCanvas=false;releaseMouseAttack(e);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])input.listen(host.canvas, event,e=>input.pointerInput(e.pointerId,null,false));
    for(const b of document.querySelectorAll('[data-move]'))input.bindTouchControl(b,{up:'w',left:'a',down:'s',right:'d'}[b.dataset.move]);
    input.bindTouchControl(host.$('touchAttack'),' ');
    input.bindTouchControl(host.$('touchGather'),'e');
      };
    input.movement = function () {
      return {
        dx: Number(input.keys.has('d') || input.keys.has('arrowright')) - Number(input.keys.has('a') || input.keys.has('arrowleft')),
        dy: Number(input.keys.has('s') || input.keys.has('arrowdown')) - Number(input.keys.has('w') || input.keys.has('arrowup'))
      };
    };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
