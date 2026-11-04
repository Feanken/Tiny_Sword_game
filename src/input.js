/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";

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
    input.updatePointerWorld = function () {
      if (input.pointerScreen) input.pointerWorld = renderer.screenToWorld(input.pointerScreen.x, input.pointerScreen.y);
    };
    const trackPointer = event => {
      input.pointerScreen = {x:event.clientX, y:event.clientY};
      input.updatePointerWorld();
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
      const controls = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ', 'e', '1', '2', 'q'];
      if (!controls.includes(key)) return;
      // Native buttons retain keyboard activation when deliberately focused.
      if (key === ' ' && e.target.tagName === 'BUTTON') return;
      e.preventDefault();if(e.repeat&&!input.keyboardKeys.has(key))return;input.keyboardInput(key,true);if(key===' '&&!e.repeat)combat.requestAttack();
      if (!e.repeat) { if (key === '1') economy.recruitUnit(); if (key === '2') economy.repairCastle(); if (key === 'q') economy.healHero(); }
    });
    input.listen(window, 'keyup', e => input.keyboardInput(e.key.toLowerCase(),false));
    input.listen(window, 'blur', () => { input.clearCombatInput(); if (session.state === 'playing') ui.togglePause(true); });
    input.listen(document, 'visibilitychange', () => { if (document.hidden && session.state === 'playing') ui.togglePause(true); });
    input.listen(host.canvas, 'pointerdown',e=>{
      trackPointer(e);
      if(e.pointerType!=='mouse'||e.button!==0||session.state!=='playing')return;
      host.canvas.focus({preventScroll:true});host.canvas.setPointerCapture(e.pointerId);input.pointerInput(e.pointerId,' ',true);combat.requestAttack();
    });
    input.listen(host.canvas, 'pointermove', trackPointer);
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
