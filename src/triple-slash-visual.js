/* Triple Slash presentation consumes combat snapshots, never writes skill state. */
((M)=>{
  'use strict';
  const colors=['#fff0bd','#bffce7','#e9ffff'];
  function drawSlash(ctx,snapshot,relativeAngle,texture){
    if(snapshot.status!=='active')return null;
    const {origin,angle,reach,radius,halfAngle,backAllowance}=snapshot.hitArea;
    const index=snapshot.slashIndex-1,color=colors[index],phase=snapshot.phase;
    const edge=phase==='windup'?halfAngle:relativeAngle;
    ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(angle);
    ctx.save();M.AimVisual.footprint(ctx,{from:-halfAngle,to:edge,reach,radius,backAllowance});
    ctx.fillStyle=color;ctx.globalAlpha=phase==='windup'?.07:phase==='contact'?.18:.07;ctx.fill();
    ctx.restore();
    // The hit padding is also the VFX clipping boundary; no projectile is invented.
    ctx.save();M.AimVisual.footprint(ctx,{from:-halfAngle,to:edge,reach,radius,backAllowance});ctx.clip();
    if(phase==='windup'){
      ctx.globalAlpha=.5;ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(0,0,reach+radius,-halfAngle,halfAngle);
      ctx.strokeStyle='#102f32';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
    }else{
      const alpha=phase==='contact'?1:.35;
      ctx.lineCap='round';ctx.globalAlpha=alpha*.22;ctx.lineWidth=radius*2;ctx.strokeStyle=color;
      ctx.beginPath();ctx.arc(0,0,reach,Math.max(-halfAngle,edge-.75),edge);ctx.stroke();
      ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(0,0,reach,Math.max(-halfAngle,edge-.75),edge);
      ctx.strokeStyle='#102f32';ctx.lineWidth=index===2?8:6;ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=index===2?4:2.5;ctx.stroke();
      for(let trail=1;trail<=index;trail++){
        ctx.beginPath();ctx.arc(0,0,reach-radius*.5*trail,Math.max(-halfAngle,edge-.65),edge);
        ctx.lineWidth=index===2?2:1.5;ctx.globalAlpha=alpha*(.85-trail*.15);ctx.stroke();
      }
      if(texture&&phase==='contact'){
        const size=texture.height,count=Math.max(1,Math.floor(texture.width/size));
        const progress=(snapshot.slashElapsed-snapshot.contactStart)/(snapshot.contactEnd-snapshot.contactStart);
        const frame=Math.min(count-1,Math.max(1,Math.floor(progress*(count-1))));
        const x=Math.cos(edge)*reach,y=Math.sin(edge)*reach;
        ctx.globalAlpha=.65;ctx.drawImage(texture,frame*size,0,size,size,x-radius,y-radius,radius*2,radius*2);
      }
    }
    ctx.restore();ctx.restore();
    return {sequence:snapshot.sequence,slashIndex:snapshot.slashIndex,phase,origin:{...origin},
      angle,reach,radius,halfAngle,backAllowance,from:-halfAngle,to:edge,color,trails:index+1};
  }
  function drawCancellation(ctx,origin,progress,angle=0){
    const alpha=Math.max(0,1-progress),distance=44+progress*18;
    ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(angle);ctx.globalAlpha=alpha;ctx.lineCap='round';
    for(let i=0;i<3;i++){
      const direction=(i-1)*.55,x=Math.cos(direction)*distance,y=Math.sin(direction)*distance;
      ctx.beginPath();ctx.moveTo(x-4,y-4);ctx.lineTo(x+4,y+4);ctx.moveTo(x+4,y-4);ctx.lineTo(x-4,y+4);
      ctx.strokeStyle='#17312e';ctx.lineWidth=6;ctx.stroke();
      ctx.strokeStyle='#f5bea3';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(0,0,distance,-.85,.85);
    ctx.strokeStyle='#17312e';ctx.lineWidth=4;ctx.stroke();
    ctx.strokeStyle='#f5bea3';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
  }
  M.TripleSlashHud=class TripleSlashHud {
    constructor({host,input,combat,session}){
      Object.assign(this,{host,combat,session});this.button=host.$('tripleSlashButton');
      this.status=host.$('tripleSlashStatus');this.fill=host.$('tripleSlashFill');this.steps=host.$('tripleSlashSteps');
      input.listen(this.button,'click',()=>{combat.requestTripleSlash?.();host.canvas.focus({preventScroll:true});});
    }
    update(snapshot){
      const visible=['playing','paused'].includes(this.session.state),oldHidden=this.button.hidden;
      this.button.hidden=!visible;
      const unlocked=!!snapshot?.unlocked,active=snapshot?.status==='active';
      const cooldown=snapshot?.cooldownRemaining||0,cancelled=snapshot?.status==='cancelled'&&cooldown>0;
      const status=!unlocked?'locked':active?'active':cancelled?'cancelled':cooldown>0?'cooldown':snapshot?.ready?'ready':'busy';
      const changed=this.button.dataset.status!==status||oldHidden!==this.button.hidden;
      this.button.dataset.status=status;
      const label=!unlocked?'Bilah tingkat 10':active?`Tebasan ${snapshot.slashIndex} / 3`:
        cooldown>0?`${cancelled?'Dibatalkan · ':''}${cooldown.toFixed(1)} dtk`:snapshot.ready?'Siap':'Tunggu aksi';
      if(this.status.textContent!==label)this.status.textContent=label;
      this.button.disabled=!visible||this.session.state!=='playing'||!snapshot?.ready||!!document.querySelector('dialog[open]');
      this.button.setAttribute('aria-label','Q, Triple Slash. '+label);
      this.button.title='Q: Triple Slash · Bilah tingkat 10 · Shift membatalkan combo';
      this.fill.style.width=`${!unlocked?0:active?Math.min(1,snapshot.elapsed/snapshot.duration)*100:Math.max(0,1-cooldown/snapshot.cooldown)*100}%`;
      this.steps.hidden=!active;
      [...this.steps.children].forEach((step,index)=>{step.dataset.state=!active?'pending':index+1<snapshot.slashIndex?'done':index+1===snapshot.slashIndex?'active':'pending';});
      return changed;
    }
  };
  M.TripleSlashFx=Object.freeze({drawSlash,drawCancellation});
})(window.PenjagaModules=window.PenjagaModules||{});
