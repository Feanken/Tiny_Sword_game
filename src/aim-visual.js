/* Ground-space combat drawing. All angles are radians, clockwise from world +X. */
((M) => {
  'use strict';
  const facing = (angle, fallback=1) => !Number.isFinite(angle)||Math.abs(Math.cos(angle)) < .08 ? fallback : Math.cos(angle) < 0 ? -1 : 1;

  // The sector plus two forward strips expresses the angular radius padding.
  // Clipping supplies the radial limit and the small allowance behind the origin.
  function footprint(ctx, {from,to,reach,radius,backAllowance=12}) {
    const range=reach+radius;
    ctx.beginPath();ctx.arc(0,0,range,0,Math.PI*2);ctx.clip();
    ctx.beginPath();ctx.rect(-backAllowance,-range,range+backAllowance,range*2);ctx.clip();
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,range,from,to);ctx.closePath();
    for(const angle of [from,to]) {
      const x=Math.cos(angle),y=Math.sin(angle),px=-y*radius,py=x*radius;
      ctx.moveTo(-px,-py);ctx.lineTo(x*range-px,y*range-py);
      ctx.lineTo(x*range+px,y*range+py);ctx.lineTo(px,py);ctx.closePath();
    }
  }

  function drawIndicator(ctx,{origin,angle,reach,radius,cssScale=1,paused=false}) {
    const size=Math.max(1,1/cssScale),distance=reach+radius-8;
    ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(angle);
    ctx.globalAlpha=paused?.45:.95;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(distance-9*size,-6*size);ctx.lineTo(distance,0);ctx.lineTo(distance-9*size,6*size);
    ctx.strokeStyle='#112b32';ctx.lineWidth=6*size;ctx.stroke();
    ctx.strokeStyle='#fff2bf';ctx.lineWidth=2*size;ctx.stroke();ctx.restore();
  }

  function indicatorBounds({origin,angle,reach,radius,cssScale=1}) {
    const size=Math.max(1,1/cssScale),distance=reach+radius-8-4.5*size;
    return {x:origin.x+Math.cos(angle)*distance,y:origin.y+Math.sin(angle)*distance,w:28*size,h:28*size};
  }

  function drawSwing(ctx,visual) {
    const {origin,angle,age,start,end,halfAngle,reach,radius,empowered=false,missCue=0}=visual;
    if(age<0||(age>end+.08&&missCue<=0))return null;
    const windup=age<start,active=age<=end;
    const edge=visual.relativeAngle;
    const alpha=windup?.12:active?.16:Math.max(0,1-(age-end)/.08)*.1;
    const from=-halfAngle,to=windup?halfAngle:edge;
    const shape={from,to,reach,radius,backAllowance:visual.backAllowance??12};
    const color=missCue>0?'#e0e8e3':empowered?'#b5fff0':'#fff1ba';
    ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(angle);
    ctx.save();footprint(ctx,shape);ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.fill();ctx.restore();
    // A dashed outer boundary previews potential reach during anticipation.
    if(windup||missCue>0) {
      ctx.save();ctx.globalAlpha=windup?.65:Math.min(.45,missCue*3);ctx.setLineDash([3,6]);
      ctx.beginPath();ctx.arc(0,0,reach+radius,-halfAngle,halfAngle);
      ctx.strokeStyle='#112b32';ctx.lineWidth=4;ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    } else {
      // The blade head has the same diameter as combat's contact padding.
      ctx.save();ctx.beginPath();ctx.arc(0,0,reach+radius,0,Math.PI*2);ctx.clip();
      ctx.globalAlpha=active?.22:Math.max(0,1-(age-end)/.08)*.12;
      ctx.lineCap='butt';ctx.strokeStyle=color;ctx.lineWidth=radius*2;
      ctx.beginPath();ctx.arc(0,0,reach,Math.max(-halfAngle,edge-.65),edge);ctx.stroke();
      ctx.globalAlpha=active?1:Math.max(0,1-(age-end)/.08);
      ctx.lineCap='round';ctx.beginPath();ctx.arc(0,0,reach,Math.max(-halfAngle,edge-.65),edge);
      ctx.strokeStyle='#112b32';ctx.lineWidth=6;ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.stroke();
      ctx.rotate(edge);ctx.beginPath();ctx.moveTo(reach-12,0);ctx.lineTo(reach,0);
      ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(reach,0,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.restore();
    }
    ctx.restore();
    return {origin:{...origin},angle,age,phase:windup?'windup':active?'active':missCue>0?'miss':'recovery',from,to,reach,radius};
  }
  M.AimVisual=Object.freeze({facing,footprint,drawIndicator,indicatorBounds,drawSwing});
})(window.PenjagaModules=window.PenjagaModules||{});
