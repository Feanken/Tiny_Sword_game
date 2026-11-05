/* Read-only presentation. Every duration and footprint comes from combat. */
((M)=>{
  'use strict';
  M.UpgradeSkillHud=class {
    constructor({host,input,combat,session}){
      Object.assign(this,{host,combat,session});
      this.button=host.$('oathButton');this.passives=host.$('passiveSkills');
      input.listen(this.button,'click',()=>{combat.requestOath();host.canvas.focus({preventScroll:true});});
    }
    update(view){
      const visible=['playing','paused'].includes(this.session.state),hidden=!visible;
      const changed=this.button.hidden!==hidden;
      this.button.hidden=hidden;this.passives.hidden=hidden;
      const o=view.oath,zone=o.zone;
      const label=!o.stage?'Sumpah tingkat 10':zone?`Zona ${zone.remaining.toFixed(1)} dtk`:o.cooldownRemaining>0?`Pulih ${o.cooldownRemaining.toFixed(1)} dtk`:o.ready?'Siap':'Tunggu aksi';
      this.button.dataset.status=!o.stage?'locked':zone?'active':o.ready?'ready':'cooldown';
      this.button.disabled=!visible||!o.ready||!!document.querySelector('dialog[open]');
      this.host.$('oathStatus').textContent=label;
      this.host.$('oathStage').textContent=o.stage?['','I','II','III'][o.stage]:'';
      this.host.$('oathFill').style.width=`${!o.stage?0:zone?zone.remaining/zone.duration*100:(1-o.cooldownRemaining/o.cooldown)*100}%`;
      this.button.setAttribute('aria-label','R, Sumpah Penjaga. '+label);
      this.host.$('rhythmStatus').textContent=view.stages.rhythm?`Irama ${view.rhythm.stacks}/5 · ${view.rhythm.attackCooldown.toFixed(2)} dtk`:'Irama · tingkat 10';
      [...this.host.$('rhythmStacks').children].forEach((pip,i)=>pip.dataset.active=String(i<view.rhythm.stacks));
      this.host.$('counterStatus').textContent=!view.stages.counter?'Celah · tingkat 10':view.counter.ready?`Balasan · ${view.counter.remaining.toFixed(1)} dtk`:'Celah · elak sempurna';
      this.host.$('counterStatus').dataset.ready=String(view.counter.ready);
      this.host.$('garrisonStatus').textContent=`Garnisun ${this.session.allies.filter(u=>u.hp>0).length}/${view.garrison.capacity}${view.garrison.auraUnlocked?' · aura 160':''}`;
      this.passives.title=`Irama: bonus nominal +${Math.round(view.rhythm.speedBonus*100)}%, cooldown nyata ${view.rhythm.attackCooldown.toFixed(3)} dtk (batas kontak). Celah: pemulihan skill dibatasi jeda internal ${view.counter.refundRemaining.toFixed(1)} dtk. Aura hanya dekat benteng hidup.`;
      return changed;
    }
  };
  function circle(ctx,x,y,r,color,dashed=false){
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color+'18';ctx.fill();
    ctx.setLineDash(dashed?[5,7]:[]);ctx.lineWidth=4;ctx.strokeStyle='#102c30c0';ctx.stroke();
    ctx.lineWidth=1.5;ctx.strokeStyle=color;ctx.stroke();ctx.setLineDash([]);
  }
  M.drawUpgradeSkillGround=function({ctx,view,session,camera,drawHeal}){
    if(!['playing','paused'].includes(session.state))return;
    ctx.save();
    const zone=view.oath.zone;
    if(zone&&camera.intersects(zone.x-zone.radius,zone.y-zone.radius,zone.radius*2,zone.radius*2)){
      circle(ctx,zone.x,zone.y,zone.radius,'#c0f3b0');
      ctx.beginPath();ctx.arc(zone.x,zone.y,zone.radius-5,-Math.PI/2,-Math.PI/2+Math.PI*2*zone.remaining/zone.duration);
      ctx.strokeStyle='#e4ffd1';ctx.lineWidth=3;ctx.stroke();
      drawHeal(zone.x,zone.y,46,zone.duration-zone.remaining);
      ctx.fillStyle='#f1ffdb';ctx.strokeStyle='#14352e';ctx.lineWidth=3;ctx.font='bold 10px Segoe UI';ctx.textAlign='center';
      ctx.strokeText('SUMPAH',zone.x,zone.y+8);ctx.fillText('SUMPAH',zone.x,zone.y+8);
    }
    const castle=session.castle,r=view.garrison.radius;
    if(view.garrison.auraUnlocked&&castle.hp>0&&camera.intersects(castle.x-r,castle.y-r,r*2,r*2))circle(ctx,castle.x,castle.y,r,'#a9d7fa',true);
    ctx.restore();
  };
})(window.PenjagaModules=window.PenjagaModules||{});
