/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  M.installRenderer = function ({renderer, host, world, config, math, assets: assetStore, ui, session, upgrading, navigation, ai, combat, input}) {
    renderer.camera = new M.Camera2D(world.width, world.height);
    renderer.tripleHud = new M.TripleSlashHud({host,input,combat,session});
    renderer.skillHud = new M.UpgradeSkillHud({host,input,combat,session});
    renderer.screenToWorld = (x, y) => renderer.camera.screenToWorld(x, y, host.canvas.getBoundingClientRect());
    renderer.reserveLabel = function reserveLabel(x,y,w,h,owner){
      if(renderer.labelCount>=renderer.labelPool.length)return null;
      const r=renderer.labelPool[renderer.labelCount++];Object.assign(r,{x,y,w,h,owner});return r;
    };

    renderer.refreshOverlayRects = function refreshOverlayRects(){
      renderer.overlayDirty=false;renderer.overlayRects.length=0;
      const arena=host.canvas.getBoundingClientRect();
      const add=el=>{if(el.hidden)return;const r=el.getBoundingClientRect();if(r.width&&r.height)renderer.overlayRects.push({x:r.left-arena.left,y:r.top-arena.top,w:r.width,h:r.height});};
      add(host.$('bossBar'));add(host.$('dashButton'));add(host.$('tripleSlashButton'));add(host.$('oathButton'));add(host.$('passiveSkills'));add(host.$('entryWarning'));
      for(const id of ['toast','announcement'])if(host.$(id).classList.contains('show'))add(host.$(id));
      if(!host.$('mobileControls').hidden)for(const el of host.$('mobileControls').querySelectorAll('button'))add(el);
    };

    renderer.beginLabelLayout = function beginLabelLayout(){
      if(renderer.overlayDirty)renderer.refreshOverlayRects();renderer.labelCount=0;
      for(const r of renderer.overlayRects)renderer.reserveLabel(renderer.cameraX+(r.x+r.w/2)/renderer.cssScale,renderer.cameraY+(r.y+r.h/2)/renderer.cssScale,r.w/renderer.cssScale,r.h/renderer.cssScale,'hud');
    };

    renderer.placeLabel = function placeLabel(owner,x,y,w,h,offsets,required=false){
      const gap=3/renderer.cssScale,pad=4/renderer.cssScale;
      let best=-1,bestCost=Infinity,bestX=x,bestY=y;
      for(let i=-1;i<offsets.length;i++){
        const preferred=owner===session.hero?0:owner.labelSlot??0,slot=i<0?preferred:i;if(i>=0&&slot===preferred)continue;
        const offset=offsets[slot],cx=math.clamp(x+offset[0],renderer.cameraX+pad+w/2,renderer.cameraX+renderer.viewW-pad-w/2),cy=math.clamp(y+offset[1],renderer.cameraY+pad+h/2,renderer.cameraY+renderer.viewH-pad-h/2);
        let cost=0;for(let j=0;j<renderer.labelCount;j++){const r=renderer.labelPool[j],dx=(r.w+w)/2+gap-Math.abs(cx-r.x),dy=(r.h+h)/2+gap-Math.abs(cy-r.y);if(dx>0&&dy>0)cost+=dx*dy;}
        if(cost<bestCost){best=slot;bestCost=cost;bestX=cx;bestY=cy;}if(cost===0)break;
      }
      if(bestCost>0&&!required)return null;
      owner.labelSlot=best;return renderer.reserveLabel(bestX,bestY,w,h,owner);
    };

    renderer.layoutHeroMarker = function layoutHeroMarker(){
      const s=math.clamp(.8/renderer.cssScale,1,1.6),width=combat.heroCounterReady()?66:44;
      return renderer.placeLabel(session.hero,session.hero.x,session.hero.y-82-9*s,width*s,30*s,config.badgeOffsets,true);
    };

    renderer.makeTerrain = function makeTerrain() {
      const c = document.createElement('canvas'); c.width = world.width; c.height = world.height;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const tilemap = assetStore.img(math.terrain('Tileset/Tilemap_color1'));
      g.fillStyle = '#4c9cab'; g.fillRect(0, 0, world.width, world.height);
      const water = assetStore.img(math.terrain('Tileset/Water Background color'));
      if (water) { g.fillStyle = g.createPattern(water, 'repeat'); g.fillRect(0, 0, world.width, world.height); }
      // Seeded details stay fixed rather than flickering between frames.
      let seed = 8453;
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      g.fillStyle = '#b2e6df33';
      for (let i = 0; i < 185; i++) { const x = random() * world.width, y = random() * world.height; g.fillRect(x, y, 5 + random() * 20, 2); }
      for (const [rstr, [left, right]] of Object.entries(world.rows)) {
        const r = Number(rstr);
        for (let col = left; col <= right; col++) {
          const x = col * world.tileSize, y = r * world.tileSize;
          g.fillStyle = '#296b7666'; g.fillRect(x - 4, y + 20, 72, 64);
          if (!navigation.land(col, r + 1)) g.drawImage(tilemap, 384, 256, 64, 64, x, y + 37, 64, 43);
        }
      }
      for (const [rstr, [left, right]] of Object.entries(world.rows)) {
        const r = Number(rstr);
        for (let col = left; col <= right; col++) {
          const sx = col === left ? 0 : col === right ? 128 : 64;
          const sy = !navigation.land(col, r - 1) ? 0 : !navigation.land(col, r + 1) ? 128 : 64;
          g.drawImage(tilemap, sx, sy, 64, 64, col * world.tileSize, r * world.tileSize, world.tileSize, world.tileSize);
        }
      }
      // Well-trodden roads connect the outposts with the blue settlement.
      const roads = (world.roads || []).map(road => road.points);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const points of roads) {
        g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.strokeStyle = '#7eaa5d'; g.lineWidth = 43; g.stroke();
        g.strokeStyle = '#b9bd79'; g.lineWidth = 33; g.stroke();
        g.strokeStyle = '#c4c78b'; g.lineWidth = 24; g.stroke();
      }
      // A visible landing jetty feeds a single road into the island.
      g.fillStyle = '#275f5d66'; g.fillRect(23, 392, 106, 45);
      g.fillStyle = '#684f3b'; g.fillRect(25, 386, 102, 4); g.fillRect(25, 420, 102, 5);
      for (let x = 28; x < 126; x += 11) {
        g.fillStyle = x % 2 ? '#c5a16b' : '#b8915c'; g.fillRect(x, 386, 9, 39);
        g.fillStyle = '#ead39a55'; g.fillRect(x + 1, 389, 2, 30);
        g.fillStyle = '#72533b'; g.fillRect(x + 3, 389, 2, 2); g.fillRect(x + 3, 417, 2, 2);
      }
      g.fillStyle = '#775b3e'; g.fillRect(119, 362, 5, 33); g.fillRect(119, 420, 5, 30);
      for (let i = 0; i < 170; i++) {
        const x = random() * world.width, y = random() * world.height;
        if (!navigation.onLand(x, y)) continue;
        g.fillStyle = ['#d9d78b', '#e5e2a0', '#679d53', '#9fbc63'][i % 4];
        g.fillRect(x, y, 2, 2); if (i % 3 === 0) g.fillRect(x + 3, y + 2, 2, 2);
      }
      return c;
    };

    renderer.resize = function resize() {
      const rect = host.$('arena').getBoundingClientRect();
      if(rect.width<=0||rect.height<=0)return;
      const dpr = Math.max(1,Math.min(window.devicePixelRatio || 1,2,Math.sqrt(2400000/(rect.width*rect.height))));
      host.canvas.width = Math.round(rect.width * dpr); host.canvas.height = Math.round(rect.height * dpr);
      renderer.camera.resize(rect.width, rect.height);
      renderer.scale = host.canvas.height / renderer.camera.height;
      renderer.cssScale = rect.height / renderer.camera.height;
      renderer.viewH = renderer.camera.height;
      renderer.viewW = renderer.camera.width;
      renderer.overlayDirty = true;
      host.ctx.imageSmoothingEnabled = false;
    };

    renderer.spriteInfo = function spriteInfo(path){
      let info=renderer.spriteMetadata.get(path);if(info)return info;
      const meta = assetStore.manifest.get(path);
      // All four trees have eight 192px-wide frames; pine frames are 256px tall.
      const isTree = /\/Trees\/Tree[1-4]\.png$/.test(path);
      const width = isTree ? 192 : meta.height, height = meta.height;
      info={width,height,count:Math.max(1,Math.floor(meta.width/width)),anchorY:isTree?(height===256?.95:.87):.79};
      renderer.spriteMetadata.set(path,info);return info;
    };

    renderer.spriteFrame = function spriteFrame(path, time = 0, fps = 9, once = false) {
      const info=renderer.spriteInfo(path),{width,height,count,anchorY}=info;
      const tick = Math.max(0, Math.floor(time * fps));
      const index = once ? Math.min(count - 1, tick) : tick % count;
      return { x:index*width,width,height,count,anchorY };
    };

    renderer.whiteFrame = function whiteFrame(path,frameX,info){
      const key=path+':'+frameX;let white=renderer.flashFrames.get(key);if(white)return white;
      white=document.createElement('canvas');white.width=info.width;white.height=info.height;
      const g=white.getContext('2d');g.drawImage(assetStore.img(path),frameX,0,info.width,info.height,0,0,info.width,info.height);
      g.globalCompositeOperation='source-in';g.fillStyle='#fff';g.fillRect(0,0,info.width,info.height);
      if(renderer.flashFrames.size>=32)renderer.flashFrames.delete(renderer.flashFrames.keys().next().value);
      renderer.flashFrames.set(key,white);return white;
    };

    renderer.unitFrame = function unitFrame(path,frameX,info){
      const key=path+':'+frameX;let frame=renderer.unitFrames.get(key);
      if(frame){renderer.unitFrames.delete(key);renderer.unitFrames.set(key,frame);return frame;}
      const bounds=window.TINY_UNIT_BOUNDS?.[path]?.[frameX/info.width]||[0,0,info.width,info.height];
      const [left,top,width,height]=bounds,image=document.createElement('canvas');image.width=width;image.height=height;
      image.getContext('2d').drawImage(assetStore.img(path),frameX+left,top,width,height,0,0,width,height);
      frame={image,x:left,y:top,bytes:image.width*image.height*4};
      while(renderer.unitFrames.size>=512||renderer.unitFrameBytes+frame.bytes>config.UNIT_FRAME_BUDGET){const oldest=renderer.unitFrames.keys().next().value;renderer.unitFrameBytes-=renderer.unitFrames.get(oldest).bytes;renderer.unitFrames.delete(oldest);}
      renderer.unitFrames.set(key,frame);renderer.unitFrameBytes+=frame.bytes;return frame;
    };

    renderer.drawSprite = function drawSprite(path, x, y, size, time = session.animTime, fps = 9, facing = 1, alpha = 1, once = false, flash = false) {
      if(x+size<renderer.cameraX||x-size>renderer.cameraX+renderer.viewW||y+size<renderer.cameraY||y-size>renderer.cameraY+renderer.viewH)return;
      const im = assetStore.img(path); if (!im) return;
      const frame=renderer.spriteInfo(path),tick=Math.max(0,Math.floor(time*fps)),frameX=(once?Math.min(frame.count-1,tick):tick%frame.count)*frame.width,width=size*frame.width/frame.height;
      host.ctx.save(); host.ctx.translate(Math.round(x), Math.round(y)); host.ctx.scale(facing, 1); host.ctx.globalAlpha = alpha;
      if (flash) {
        const white=renderer.whiteFrame(path,frameX,frame);
        host.ctx.drawImage(white,-width/2,-size*frame.anchorY,width,size);
      } else if(path.startsWith('Units/')){
        const cached=renderer.unitFrame(path,frameX,frame),ratio=size/frame.height;
        host.ctx.drawImage(cached.image,-width/2+cached.x*ratio,-size*frame.anchorY+cached.y*ratio,cached.image.width*ratio,cached.image.height*ratio);
      } else host.ctx.drawImage(im, frameX, 0, frame.width, frame.height, -width / 2, -size * frame.anchorY, width, size);
      host.ctx.restore();
    };

    renderer.drawImageAt = function drawImageAt(path, x, y, width, alpha = 1) {
      const im = assetStore.img(path); if (!im) return;
      const height = im.height / im.width * width;
      if(x+width/2<renderer.cameraX||x-width/2>renderer.cameraX+renderer.viewW||y<renderer.cameraY||y-height>renderer.cameraY+renderer.viewH)return;
      host.ctx.globalAlpha = alpha; host.ctx.drawImage(im, Math.round(x - width / 2), Math.round(y - height), width, height); host.ctx.globalAlpha = 1;
    };

    renderer.drawScenery = function drawScenery(item){
      if(!renderer.camera.intersects(item.x-210,item.y-300,420,340))return;
      const s=item.source;
      if(item.type==='tree')renderer.drawSprite(item.path,s.x,s.y,s.size,session.animTime+s.seed,5,1,renderer.sceneryCoversHero(s.x,s.y,s.size*(s.variant<3?.75:1),s.size)?.32:1);
      else if(item.type==='gold')renderer.drawImageAt(item.path,s.x,s.y,64);
      else if(item.type==='bush')renderer.drawSprite(item.path,item.x,item.y,75,session.animTime+item.seed,5);
      else if(item.type==='sheep')renderer.drawSprite(session.state==='playing'&&Math.sin(session.elapsed+s.seed)>.4?item.grass:item.idle,s.x,s.y,77,session.animTime+s.seed,6,Math.sin(session.animTime*.13+s.seed)>0?1:-1);
      else if(item.type==='villager')renderer.drawSprite(item.path,s.x,s.y,104,session.animTime,8,s.facing);
      else{
        const meta=assetStore.manifest.get(item.path);
        renderer.drawImageAt(item.path,s.x,s.y,s.width,renderer.sceneryCoversHero(s.x,s.y,s.width,s.width*meta.height/meta.width)?.45:1);
        if(s.name==='Castle'){
          if(session.castle.hitFlash>0){host.ctx.save();host.ctx.filter='brightness(0) invert(1)';renderer.drawImageAt(item.path,s.x,s.y,s.width,.6);host.ctx.restore();}
          if(session.castle.hp<session.castle.maxHp)renderer.healthBar(s.x,s.y-160,session.castle.hp,session.castle.maxHp,'#a7d7bd',85);
          if(session.castle.hp<230)renderer.drawSprite('Particle FX/Fire_01.png',s.x-48,s.y-55,65);
          if(session.castle.hp<100)renderer.drawSprite('Particle FX/Fire_02.png',s.x+49,s.y-63,77);
        }
      }
    };

    renderer.healthBar = function healthBar(x, y, hp, max, color, width = 35) {
      host.ctx.fillStyle = '#173327cc'; host.ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
      host.ctx.fillStyle = color; host.ctx.fillRect(x - width / 2, y, width * math.clamp(hp / max, 0, 1), 3);
    };

    renderer.bossPose = function bossPose(u){
      const a=u.bossAction;
      if(!a)return {path:math.unitPath('Black','Warrior',u.moving?'Run':'Idle'),age:u.animTime||0,fps:9,once:false};
      if(a.stage==='rally')return {path:math.unitPath('Black','Warrior','Guard'),age:a.duration-a.time,fps:6,once:true};
      const warning=a.stage==='warning',recover=a.stage==='recovery',age=warning?a.duration-a.time:recover?(a.recoveryDuration||.95)-a.time:.45-a.time;
      const action=a.type==='volley'?'Shoot':a.type==='charge'?(a.stage==='charge'?'Run':'Guard'):'Attack2';
      const path=math.unitPath('Black',a.type==='volley'?'Archer':'Warrior',action);
      if(recover&&age>.2)return {path:math.unitPath('Black','Warrior','Idle'),age,fps:5,once:false};
      const duration=warning?a.duration:.3,progress=warning?age/duration*.6:.6+Math.min(1,age/.2)*.4;
      return {path,age:action==='Run'?age:progress,fps:action==='Run'?16:renderer.spriteFrame(path).count,once:action!=='Run'};
    };

    renderer.heroPose = function heroPose(){
      const age=combat.heroAttackAge();
      if(age>=config.SWING.end&&session.hero.moving)return {path:math.blue('Warrior','Run'),age:age-config.SWING.end,fps:11,once:false};
      const action=renderer.tripleView?.status==='active'&&renderer.tripleView.slashIndex===2?'Attack2':'Attack1';
      const path=math.blue('Warrior',action),count=renderer.spriteFrame(path).count;
      // Contact/recovery frames bake in a horizontal slash. Keep the clean poses
      // upright and let the world-space sweep represent the actual strike.
      const clean=Math.min(2,count),frame=age<config.SWING.start?Math.min(clean-1,Math.floor(age/config.SWING.start*clean)):age<config.SWING.end?clean-1:0;
      return {path,age:frame,fps:1,once:true};
    };

    renderer.sceneryCoversHero = function sceneryCoversHero(x,y,width,height){
      return session.state!=='ready'&&session.hero.y<y-4&&session.hero.y>y-height+18&&Math.abs(session.hero.x-x)<width*.38;
    };

    renderer.drawHeroSwing = function drawHeroSwing(){
      renderer.lastSwingVisual=null;
      if(renderer.tripleView?.status==='active'||renderer.presentedAttackKind==='triple-slash')return;
      if(!['playing','paused'].includes(session.state)||session.hero.hp<=0||
        (session.hero.attack<=0&&session.hero.missCue<=0)||!combat.heroAttackAngle)return;
      const age=combat.heroAttackAge();
      renderer.lastSwingVisual=M.AimVisual.drawSwing(host.ctx,{
        origin:combat.heroAttackOrigin(),angle:combat.heroAttackAngle(),age,relativeAngle:combat.swingAngle(age),
        start:config.SWING.start,end:config.SWING.end,halfAngle:config.SWING.angle,
        reach:config.SWING.reach,radius:config.SWING.radius,
        empowered:session.hero.swingEmpowered,missCue:session.hero.missCue
      });
    };

    renderer.drawTripleSlash = function drawTripleSlash(){
      renderer.lastTripleSlashVisual=null;renderer.lastTripleCancelVisual=null;
      const view=renderer.tripleView;
      if(!view||!['playing','paused'].includes(session.state)||session.hero.hp<=0)return;
      if(view.status==='active'){
        const h=view.hitArea,r=h.reach+h.radius;
        if(renderer.camera.intersects(h.origin.x-r,h.origin.y-r,r*2,r*2))
          renderer.lastTripleSlashVisual=M.TripleSlashFx.drawSlash(host.ctx,view,combat.swingAngle(view.slashElapsed),assetStore.img('Particle FX/Water Splash.png'));
      }
      if(view.status==='cancelled'){
        if(renderer.tripleCancel?.sequence!==view.sequence)renderer.tripleCancel={sequence:view.sequence,cooldown:view.cooldownRemaining,origin:{...view.hitArea.origin},angle:view.hitArea.angle};
        const age=Math.max(0,renderer.tripleCancel.cooldown-view.cooldownRemaining);
        if(age<.24){
          M.TripleSlashFx.drawCancellation(host.ctx,renderer.tripleCancel.origin,age/.24,renderer.tripleCancel.angle);
          renderer.lastTripleCancelVisual={origin:{...renderer.tripleCancel.origin},angle:renderer.tripleCancel.angle,reason:view.cancelReason,age};
        }
      }else renderer.tripleCancel=null;
    };

    renderer.aimVisual = function aimVisual(){
      if(!['playing','paused'].includes(session.state)||session.hero.hp<=0||session.hero.work||
        !Number.isFinite(session.hero.aimAngle)||document.querySelector('dialog[open]'))return null;
      return {origin:combat.heroAttackOrigin(),angle:session.hero.aimAngle,
        reach:config.SWING.reach,radius:config.SWING.radius,cssScale:renderer.cssScale,paused:session.state==='paused'};
    };

    renderer.drawAimIndicator = function drawAimIndicator(){
      renderer.lastAimVisual=renderer.aimVisual();
      if(renderer.lastAimVisual)M.AimVisual.drawIndicator(host.ctx,renderer.lastAimVisual);
    };

    renderer.reserveAimIndicator = function reserveAimIndicator(){
      const visual=renderer.aimVisual();if(!visual)return;
      const r=M.AimVisual.indicatorBounds(visual);
      renderer.reserveLabel(r.x,r.y,r.w,r.h,'aim-indicator');
    };

    renderer.heroFacing = function heroFacing(){
      renderer.heroBodyFacing=M.AimVisual.facing(session.hero.aimAngle,renderer.heroBodyFacing??session.hero.facing);
      return renderer.heroBodyFacing;
    };

    renderer.drawHeroSprite = function drawHeroSprite(path,size,age,fps,facing,once=false){
      Object.assign(renderer.heroSprite,{path,size,age,fps,facing,once});renderer.drawSprite(path,session.hero.x,session.hero.y,size,age,fps,facing,1,once);
    };

    renderer.drawHeroOutline = function drawHeroOutline(){
      if(!['playing','paused'].includes(session.state)||!renderer.heroSprite.path||!assetStore.img(renderer.heroSprite.path))return;
      let covered=false;
      for(const units of [session.enemies,session.allies])for(const u of units)if(u.hp>0&&u.y>session.hero.y-8&&u.y<session.hero.y+58&&Math.abs(u.x-session.hero.x)<42)covered=true;
      if(!covered)return;
      const p=renderer.heroSprite,info=renderer.spriteInfo(p.path),tick=Math.max(0,Math.floor(p.age*p.fps)),frameX=(p.once?Math.min(info.count-1,tick):tick%info.count)*info.width,key=p.path+':'+frameX;
      let outline=renderer.heroOutlines.get(key);
      if(!outline){
        const mask=renderer.whiteFrame(p.path,frameX,info);outline=document.createElement('canvas');outline.width=info.width+8;outline.height=info.height+8;
        const g=outline.getContext('2d');for(const [x,y] of [[-3,0],[3,0],[0,-3],[0,3],[-2,-2],[2,-2],[-2,2],[2,2]])g.drawImage(mask,4+x,4+y);
        g.globalCompositeOperation='source-in';g.fillStyle='#fff0b5';g.fillRect(0,0,outline.width,outline.height);g.globalCompositeOperation='destination-out';g.drawImage(mask,4,4);
        if(renderer.heroOutlines.size>=32)renderer.heroOutlines.delete(renderer.heroOutlines.keys().next().value);renderer.heroOutlines.set(key,outline);
      }
      const ratio=p.size/info.height;host.ctx.save();host.ctx.translate(Math.round(session.hero.x),Math.round(session.hero.y));host.ctx.scale(p.facing,1);host.ctx.globalAlpha=.88;
      host.ctx.drawImage(outline,-info.width*ratio/2-4*ratio,-p.size*info.anchorY-4*ratio,outline.width*ratio,outline.height*ratio);host.ctx.restore();
    };

    renderer.drawHeroMarker = function drawHeroMarker(){
      if(!['playing','paused'].includes(session.state)||session.hero.hp<=0)return;
      const s=math.clamp(.8/renderer.cssScale,1,1.6),counter=combat.heroCounterReady(),color=counter||session.hero.dash>0?'#aef8ea':session.hero.damageCue>0?'#ffb59d':'#f5dfa3';
      host.ctx.save();host.ctx.translate(session.hero.x,session.hero.y);
      host.ctx.beginPath();host.ctx.ellipse(0,-4,22,10,0,0,Math.PI*2);host.ctx.strokeStyle='#173327';host.ctx.lineWidth=5;host.ctx.stroke();host.ctx.strokeStyle=color;host.ctx.lineWidth=2;host.ctx.stroke();
      if(session.ranks.bastion>0&&session.castle.hp>0&&math.dist(session.hero,session.castle)<=upgrading.fortressRadius()){host.ctx.fillStyle='#b5f5e4';host.ctx.fillRect(-3,-7,6,6);}
      if(session.hero.damageCue>0){host.ctx.save();host.ctx.translate(0,-24);host.ctx.rotate(session.hero.damageDirection+Math.PI);host.ctx.beginPath();host.ctx.moveTo(46,0);host.ctx.lineTo(32,-8);host.ctx.lineTo(32,8);host.ctx.closePath();host.ctx.fillStyle='#ffb59d';host.ctx.strokeStyle='#173327';host.ctx.lineWidth=3;host.ctx.stroke();host.ctx.fill();host.ctx.restore();}
      const marker=session.hero.markerLayout||renderer.layoutHeroMarker(),markerY=marker.y+9*s;
      const below=markerY>session.hero.y-45;
      if(Math.abs(marker.x-session.hero.x)>20||Math.abs(markerY-(session.hero.y-82))>20){host.ctx.beginPath();host.ctx.moveTo(0,below?-20:-65);host.ctx.lineTo(marker.x-session.hero.x,markerY-session.hero.y+(below?-18:6)*s);host.ctx.strokeStyle='#173327';host.ctx.lineWidth=3;host.ctx.stroke();host.ctx.strokeStyle=color;host.ctx.lineWidth=1;host.ctx.stroke();}
      host.ctx.translate(marker.x-session.hero.x,markerY-session.hero.y);host.ctx.scale(s,s);
      const width=counter?66:44;
      host.ctx.fillStyle='#173327ed';host.ctx.fillRect(-width/2,-18,width,18);host.ctx.strokeStyle=color;host.ctx.lineWidth=1;host.ctx.strokeRect(-width/2,-18,width,18);
      host.ctx.font='bold 11px Segoe UI';host.ctx.textAlign='center';host.ctx.fillStyle=color;host.ctx.fillText(counter?'BALASAN':'KAMU',0,-6);
      if(session.hero.cooldown>0){host.ctx.fillStyle='#ffffff26';host.ctx.fillRect(-width/2+2,-3,width-4,2);host.ctx.fillStyle=color;host.ctx.fillRect(-width/2+2,-3,(width-4)*math.clamp(1-session.hero.cooldown/combat.attackCooldown(),0,1),2);}
      host.ctx.beginPath();host.ctx.moveTo(-4,below?-19:1);host.ctx.lineTo(4,below?-19:1);host.ctx.lineTo(0,below?-24:6);host.ctx.closePath();host.ctx.fill();
      if(session.hero.hp<session.hero.maxHp)renderer.healthBar(0,below?4:-23,session.hero.hp,session.hero.maxHp,session.hero.hp/session.hero.maxHp<.3?'#ffb59d':'#bde6b1',width-4);
      host.ctx.restore();
    };

    renderer.playerThreat = function playerThreat(u){
      if(u.hp<=0||u.team!=='enemy'||u.isBoss||u.strike?.target!==session.hero)return null;
      const duration=u.kind==='Archer'?.31:u.kind==='Lancer'?.24:.2;
      return {progress:math.clamp(1-u.strike.timer/duration,0,1),ranged:u.kind==='Archer'};
    };

    renderer.drawPlayerThreats = function drawPlayerThreats(){
      if(!['playing','paused'].includes(session.state))return;
      const s=math.clamp(.8/renderer.cssScale,1,1.6);renderer.threatOrder.length=0;
      for(const u of session.enemies)if(renderer.playerThreat(u)&&renderer.camera.intersects(u.x-30,u.y-180,60,210))renderer.threatOrder.push(u);
      renderer.threatOrder.sort((a,b)=>a.strike.timer-b.strike.timer||a.combatId-b.combatId);
      for(const u of renderer.threatOrder){if(u.labelAction!==u.strike){u.labelAction=u.strike;u.labelSlot=0;}const threat=renderer.playerThreat(u),r=renderer.placeLabel(u,u.x,u.y-66,20*s,28*s,config.threatOffsets);if(!r)continue;
        if(Math.abs(r.x-u.x)>8||Math.abs(r.y-(u.y-66))>8){host.ctx.beginPath();host.ctx.moveTo(u.x,u.y-49);host.ctx.lineTo(r.x,r.y+12*s);host.ctx.strokeStyle='#173327';host.ctx.lineWidth=3;host.ctx.stroke();host.ctx.strokeStyle='#ffd6a0';host.ctx.lineWidth=1;host.ctx.stroke();}
        host.ctx.save();host.ctx.translate(r.x,r.y-2*s);host.ctx.scale(s,s);
        host.ctx.fillStyle='#31251ded';host.ctx.strokeStyle='#ffd6a0';host.ctx.lineWidth=1.5;
        host.ctx.beginPath();if(threat.ranged){host.ctx.moveTo(0,-9);host.ctx.lineTo(8,6);host.ctx.lineTo(-8,6);host.ctx.closePath();}else host.ctx.arc(0,0,8,0,Math.PI*2);host.ctx.fill();host.ctx.stroke();
        host.ctx.font='bold 12px Segoe UI';host.ctx.fillStyle='#fff1c5';host.ctx.textAlign='center';host.ctx.fillText('!',0,4);
        host.ctx.fillStyle='#31251d';host.ctx.fillRect(-9,10,18,3);host.ctx.fillStyle='#ffd6a0';host.ctx.fillRect(-9,10,18*threat.progress,3);host.ctx.restore();
      }
    };

    renderer.drawCombatNumbers = function drawCombatNumbers(){
      renderer.floaterOrder.length=0;for(const f of session.floaters)if(renderer.camera.intersects(f.x-50,f.y-80,100,100))renderer.floaterOrder.push(f);
      renderer.floaterOrder.sort((a,b)=>b.priority-a.priority||b.life-a.life);
      let minor=0;
      for(const f of renderer.floaterOrder){
        if(f.priority===0&&++minor>8)continue;
        const s=f.priority>=2?math.clamp(.8/renderer.cssScale,1,1.35):1,size=(f.fontSize||(f.large?17:12))*s,font=`bold ${size}px Segoe UI`;
        host.ctx.font=font;
        if(f.measuredText!==f.text||f.measuredFont!==font){f.textWidth=host.ctx.measureText(f.text).width;f.measuredText=f.text;f.measuredFont=font;}
        const r=renderer.placeLabel(f,f.x,f.y-size*.35,f.textWidth+6,size+5,config.numberOffsets,f.priority===3);if(!r)continue;
        f.layoutX=r.x;f.layoutY=r.y;
        host.ctx.globalAlpha=Math.min(1,f.life*4)*(f.priority===0?.7:1);host.ctx.textAlign='center';host.ctx.strokeStyle='#142c23';host.ctx.lineWidth=f.priority>=2?4:3;
        host.ctx.strokeText(f.text,r.x,r.y+size*.35);host.ctx.fillStyle=f.color;host.ctx.fillText(f.text,r.x,r.y+size*.35);
      }
      host.ctx.globalAlpha=1;
    };

    renderer.drawBossStatus = function drawBossStatus(){
      if(!session.boss||session.boss.hp<=0)return;
      const a=session.boss.bossAction,open=a?.stage==='recovery',s=math.clamp(.8/renderer.cssScale,1,1.5);
      const text=open?'TERBUKA':a?.stage==='rally'?'MENGAMUK':a?.stage==='warning'?({slam:'! HANTAM',charge:'>> TERJANG',volley:'||| PANAH'}[a.type]):session.boss.enraged?'PANGLIMA · FASE II':'PANGLIMA · FASE I';
      host.ctx.font=`bold ${11*s}px Segoe UI`;
      const r=renderer.placeLabel(session.boss,session.boss.x,session.boss.y-95,host.ctx.measureText(text).width+8,17*s,config.numberOffsets);if(!r)return;
      host.ctx.textAlign='center';host.ctx.strokeStyle='#173327';host.ctx.lineWidth=4;host.ctx.strokeText(text,r.x,r.y+4*s);host.ctx.fillStyle=open?'#cbffce':'#f4cc92';host.ctx.fillText(text,r.x,r.y+4*s);
    };

    renderer.drawBossDanger = function drawBossDanger(overlay=false){
      const a=session.boss?.hp>0?session.boss.bossAction:null;if(a?.stage!=='warning')return;
      const progress=math.clamp(1-a.time/a.duration,0,1);
      host.ctx.save();host.ctx.fillStyle='#ed75582b';host.ctx.lineJoin='round';host.ctx.lineCap='round';
      if(a.type==='slam'){host.ctx.translate(a.target.x,a.target.y);host.ctx.beginPath();host.ctx.arc(0,0,105,0,Math.PI*2);}
      else{
        host.ctx.translate(a.origin.x,a.origin.y);host.ctx.rotate(Math.atan2(a.dy,a.dx));host.ctx.beginPath();
        if(a.type==='charge'){
          const length=a.chargeEnd.distance;host.ctx.moveTo(0,-36);host.ctx.lineTo(length,-36);host.ctx.arc(length,0,36,-Math.PI/2,Math.PI/2);host.ctx.lineTo(0,36);host.ctx.arc(0,0,36,Math.PI/2,Math.PI*1.5);host.ctx.closePath();
        }else{host.ctx.moveTo(0,0);host.ctx.lineTo(Math.cos(.22)*500,-Math.sin(.22)*500);host.ctx.lineTo(Math.cos(.22)*500,Math.sin(.22)*500);host.ctx.closePath();}
      }
      if(!overlay){host.ctx.fill();host.ctx.restore();return;}
      // Keep the narrow boundary above scenery; the translucent floor remains below units.
      host.ctx.strokeStyle='#402b24c9';host.ctx.lineWidth=6;host.ctx.stroke();host.ctx.strokeStyle='#ffd4a0';host.ctx.lineWidth=2;host.ctx.setLineDash([8,5]);host.ctx.stroke();host.ctx.setLineDash([]);
      host.ctx.strokeStyle='#fff0c4';host.ctx.lineWidth=3;
      if(a.type==='slam'){host.ctx.beginPath();host.ctx.arc(0,0,105,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);host.ctx.stroke();}
      else if(a.type==='charge'){
        const length=a.chargeEnd.distance;host.ctx.beginPath();host.ctx.moveTo(length,-40);host.ctx.lineTo(length,40);host.ctx.stroke();
        if(length>18){host.ctx.beginPath();host.ctx.moveTo(Math.max(0,length-18),-12);host.ctx.lineTo(length,0);host.ctx.lineTo(Math.max(0,length-18),12);host.ctx.stroke();}
        host.ctx.beginPath();host.ctx.moveTo(0,-36);host.ctx.lineTo(length*progress,-36);host.ctx.stroke();
      }else{
        for(const angle of [-.22,0,.22]){host.ctx.beginPath();host.ctx.moveTo(0,0);host.ctx.lineTo(Math.cos(angle)*500,Math.sin(angle)*500);host.ctx.strokeStyle='#ffd4a077';host.ctx.lineWidth=1.5;host.ctx.stroke();}
        host.ctx.beginPath();host.ctx.arc(0,0,48,-.22,-.22+.44*progress);host.ctx.strokeStyle='#fff0c4';host.ctx.lineWidth=4;host.ctx.stroke();
      }
      host.ctx.restore();
    };

    renderer.drawUnit = function drawUnit(u, isHero = false) {
      const facing=isHero?renderer.heroFacing():u.facing;
      if(!isHero&&!renderer.camera.intersects(u.x-190,u.y-200,380,240))return;
      if(!isHero){
        host.ctx.save();host.ctx.translate(u.x,u.y-3);host.ctx.strokeStyle=u.team==='enemy'?'#ffc49b':'#b8e5df';host.ctx.lineWidth=1.5;
        host.ctx.beginPath();if(u.team==='enemy'){host.ctx.moveTo(-6,0);host.ctx.lineTo(0,6);host.ctx.lineTo(6,0);}else host.ctx.ellipse(0,0,7,3,0,0,Math.PI*2);host.ctx.stroke();host.ctx.restore();
      }
      if(isHero&&session.hero.dash>0){renderer.drawHeroSprite(math.blue('Warrior','Run'),136,session.hero.dashElapsed,14,facing);return;}
      if (isHero && session.hero.work) {
        const work = session.hero.work, progress = math.clamp(work.elapsed / work.duration, 0, 1);
        const action = work.node.type === 'wood' ? 'Interact Axe' : work.node.type === 'gold' ? 'Interact Pickaxe' : 'Idle Meat';
        renderer.drawHeroSprite(math.blue('Pawn',action),136,work.elapsed,renderer.spriteInfo(math.blue('Pawn',action)).count/work.duration,facing,true);
        renderer.healthBar(u.x, u.y - 63, progress, 1, '#eed18b', 49);
        host.ctx.fillStyle = '#fff1c5'; host.ctx.font = 'bold 10px Segoe UI'; host.ctx.textAlign = 'center';
        host.ctx.fillText(work.node.type === 'wood' ? 'MENEBANG' : work.node.type === 'gold' ? 'MENAMBANG' : 'MENGAMBIL BEKAL', u.x, u.y - 72);
        host.ctx.strokeStyle = '#f4d88baa'; host.ctx.lineWidth = 2; host.ctx.beginPath(); host.ctx.ellipse(work.node.x, work.node.y, 24, 10, 0, 0, Math.PI * 2); host.ctx.stroke();
        return;
      }
      const kind = isHero ? 'Warrior' : u.kind, color = isHero ? 'Blue' : u.color;
      const action = u.isBoss&&u.bossAction?.stage==='warning'?'Attack2':u.attack > 0 ? ({ Warrior: 'Attack1', Archer: 'Shoot', Lancer: 'Right_Attack', Monk: 'Heal', Pawn: 'Idle' }[kind]) : u.moving ? 'Run' : 'Idle';
      const size = u.isBoss?188:kind === 'Lancer' ? (isHero ? 194 : 178) : isHero ? 136 : 113;
      const alpha = u.invuln > 0 && !u.hitFlash && Math.floor(session.animTime * 13) % 2 ? .75 : 1;
      const pose=u.isBoss?renderer.bossPose(u):isHero&&u.attack>0?renderer.heroPose():null;
      const path=pose?.path||math.unitPath(color,kind,action),age=pose?pose.age:u.impactHold>0?u.impactAge:u.attack>0?(u.attackDuration||.4)-u.attack:(u.animTime||0);
      const fps=pose?pose.fps:u.attack>0?renderer.spriteFrame(path).count/(u.attackDuration||.4):9,once=pose?pose.once:u.attack>0;
      if(isHero)renderer.drawHeroSprite(path,size,age,fps,facing,once);else renderer.drawSprite(path,u.x,u.y,size,age,fps,facing,alpha,once);
      if (u.hitFlash > 0) renderer.drawSprite(path,u.x,u.y,size,age,fps,facing,Math.min(.92,u.hitFlash/.15),once,true);
      if (!isHero && u.attack > 0 && age > .07 && age < .29 && !['Archer', 'Monk'].includes(kind)) {
        host.ctx.save(); host.ctx.translate(u.x, u.y - 23); host.ctx.scale(u.facing, 1);
        host.ctx.strokeStyle = u.team === 'enemy' ? '#ffc49ba8' : '#d4f5ddb0';
        host.ctx.lineWidth = 3; host.ctx.lineCap = 'round';
        const progress=(age-.07)/.22;
        host.ctx.beginPath();host.ctx.arc(0,0,kind==='Lancer'?77:43,-1.45,1.45*progress);host.ctx.stroke();host.ctx.restore();
      }
      if (!u.isBoss && !isHero && u.hp < u.maxHp && (u.hitFlash>0||math.dist(u,session.hero)<240) && !renderer.playerThreat(u)) renderer.healthBar(u.x, u.y - 55, u.hp, u.maxHp, u.team === 'enemy' ? '#ef9a7a' : '#a9dda9', 35);
      if(u.isBoss){
        const a=u.bossAction,open=a?.stage==='recovery';
        if(open){host.ctx.strokeStyle='#cbffce';host.ctx.lineWidth=3;host.ctx.beginPath();host.ctx.ellipse(u.x,u.y,35,12,0,0,Math.PI*2);host.ctx.stroke();}
        if(a?.stage==='rally'){host.ctx.strokeStyle='#ffb37b';host.ctx.lineWidth=3;host.ctx.setLineDash([5,4]);host.ctx.beginPath();host.ctx.ellipse(u.x,u.y,35+18*(1-a.time/a.duration),14,0,0,Math.PI*2);host.ctx.stroke();host.ctx.setLineDash([]);}
      }
    };

    renderer.draw = function draw() {
      host.ctx.setTransform(1, 0, 0, 1, 0, 0); host.ctx.clearRect(0, 0, host.canvas.width, host.canvas.height);
      if (!session.initialized) { host.ctx.fillStyle = '#4c9cab'; host.ctx.fillRect(0, 0, host.canvas.width, host.canvas.height); return; }
      renderer.camera.follow(session.state === 'ready' ? world.heroSpawn : session.hero);
      renderer.cameraX = renderer.camera.x;
      renderer.cameraY = renderer.camera.y;
      input.updatePointerWorld();
      renderer.tripleView=combat.tripleSlashSnapshot?.()||null;
      if(renderer.tripleHud.update(renderer.tripleView))renderer.overlayDirty=true;
      renderer.skillView=combat.skillsSnapshot();
      if(renderer.skillHud.update(renderer.skillView))renderer.overlayDirty=true;
      if(session.hero.strike)renderer.presentedAttackKind=session.hero.strike.kind||'basic';
      if(session.state==='ready'||session.state==='loading')renderer.presentedAttackKind='basic';
      const scaleX=host.canvas.width/renderer.viewW;
      host.ctx.setTransform(scaleX, 0, 0, renderer.scale, -renderer.cameraX * scaleX, -renderer.cameraY * renderer.scale);
      if(!renderer.waterPattern)renderer.waterPattern=host.ctx.createPattern(assetStore.img(math.terrain('Tileset/Water Background color')),'repeat');
      host.ctx.fillStyle = renderer.waterPattern;
      host.ctx.fillRect(renderer.cameraX, renderer.cameraY, renderer.viewW, renderer.viewH);
      if (session.shake > 0 && !renderer.reducedMotion) host.ctx.translate((Math.random()*2-1)*session.shake,(Math.random()*2-1)*session.shake);
      host.ctx.drawImage(renderer.terrainCanvas, 0, 0);
      // Animated white water follows each exposed shoreline tile.
      host.ctx.globalAlpha = .32 + Math.sin(session.animTime * 1.7) * .1;
      const foam = assetStore.img(math.terrain('Tileset/Water Foam'));
      if(foam){const frame=Math.floor(session.animTime*7)%16;for(const [x,y] of renderer.shoreTiles)if(renderer.camera.intersects(x,y,64,28))host.ctx.drawImage(foam,frame*192+64,128,64,64,x,y,64,28);}
      host.ctx.globalAlpha = 1;
      [[98, 284, 1], [1216, 510, 2], [360, 659, 3], [1160, 156, 4]].forEach(([x, y, i]) => renderer.drawImageAt(math.terrain(`Decorations/Rocks in the Water/Water Rocks_0${i}`), x, y, 65));
      const duck = assetStore.img(math.terrain('Decorations/Rubber Duck/Rubber duck'));
      if (duck) { const i = Math.floor(session.animTime * 4) % 3; host.ctx.drawImage(duck, i * 32, 0, 32, 32, 1036 + Math.sin(session.animTime * .24) * 22, 53 + Math.sin(session.animTime * 1.8) * 2, 30, 30); }
      // Stumps and little rocks keep the forest floor varied.
      renderer.drawImageAt(math.terrain('Resources/Wood/Trees/Stump 1'), 373, 496, 48);
      renderer.drawImageAt(math.terrain('Resources/Wood/Trees/Stump 3'), 522, 211, 45);
      for (const [x, y, i] of world.rocks) renderer.drawImageAt(math.terrain(`Decorations/Rocks/Rock${i}`), x, y, 39);
      for (const d of session.drops) renderer.drawSprite(math.terrain(`Resources/${d.type === 'wood' ? 'Wood/Wood Resource/Wood Resource' : 'Gold/Gold Resource/Gold_Resource'}`), d.x, d.y + Math.sin(session.animTime * 4 + d.x) * 3, d.type === 'wood' ? 44 : 58);
      for(const trail of session.dashTrail)renderer.drawSprite(math.blue('Warrior','Run'),trail.x,trail.y,136,trail.time,14,trail.facing,trail.life*2);
      if(session.orderPulse>0){const anchor=ai.squadAnchor();host.ctx.strokeStyle='#c3e8c099';host.ctx.lineWidth=2;host.ctx.setLineDash([5,5]);host.ctx.beginPath();host.ctx.ellipse(anchor.x,anchor.y,70,30,0,0,Math.PI*2);host.ctx.stroke();host.ctx.setLineDash([]);}
      renderer.drawBossDanger();
      M.drawUpgradeSkillGround({ctx:host.ctx,view:renderer.skillView,session,camera:renderer.camera,
        drawHeal:(x,y,size,age)=>renderer.drawSprite(math.blue('Monk','Heal_Effect'),x,y,size,age,10)});
      renderer.renderUnits.length=0;
      for(const u of session.enemies)if(u.hp>0)renderer.renderUnits.push(u);
      for(const u of session.allies)if(u.hp>0)renderer.renderUnits.push(u);
      renderer.renderUnits.push(session.hero);renderer.renderUnits.sort((a,b)=>a.y-b.y);
      let sceneryIndex=0;
      for(const u of renderer.renderUnits){while(sceneryIndex<renderer.sceneryItems.length&&renderer.sceneryItems[sceneryIndex].y<=u.y)renderer.drawScenery(renderer.sceneryItems[sceneryIndex++]);renderer.drawUnit(u,u===session.hero);}
      while(sceneryIndex<renderer.sceneryItems.length)renderer.drawScenery(renderer.sceneryItems[sceneryIndex++]);
      for (const p of session.projectiles) {
        const arrow = assetStore.img(`Units/${p.color} Units/Archer/Arrow.png`);
        if (arrow) {
          host.ctx.save(); host.ctx.translate(p.x, p.y - 22); host.ctx.rotate(Math.atan2(p.vy, p.vx));
          host.ctx.beginPath();host.ctx.moveTo(-20,0);host.ctx.lineTo(7,0);host.ctx.lineCap='round';host.ctx.strokeStyle='#183127';host.ctx.lineWidth=5;host.ctx.stroke();
          host.ctx.strokeStyle=p.team==='enemy'?'#ffd0a0':'#b4e8e6';host.ctx.lineWidth=2;host.ctx.stroke();
          host.ctx.drawImage(arrow, -21, -21, 42, 42); host.ctx.restore();
        }
      }
      for (const e of session.effects) renderer.drawSprite(e.path, e.x, e.y, e.size, e.time, e.fps, 1, Math.min(1, e.life * 3));
      for (const hit of session.impacts) {
        const progress = 1 - hit.life / hit.duration;
        host.ctx.save(); host.ctx.translate(hit.x, hit.y); host.ctx.globalAlpha = Math.min(1, hit.life * 7);
        const prominent=hit.prominent!==false,rays=prominent?7:3;
        host.ctx.globalAlpha*=prominent?1:.55;host.ctx.strokeStyle = hit.color; host.ctx.lineWidth = prominent?2.5:1.5;
        host.ctx.beginPath(); host.ctx.arc(0, 0, 5 + progress * (prominent?17:9), 0, Math.PI * 2); host.ctx.stroke();
        for (let i = 0; i < rays; i++) {
          const angle = hit.angle + i * Math.PI * 2 / rays, radius = 6 + progress * (prominent?29:14);
          const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .75;
          host.ctx.strokeStyle = i % 2 ? '#fff8d8' : hit.color; host.ctx.lineWidth = i % 2 ? 3 : 2;
          host.ctx.beginPath(); host.ctx.moveTo(x * .55, y * .55); host.ctx.lineTo(x, y); host.ctx.stroke();
        }
        host.ctx.restore();
      }
      renderer.drawHeroSwing();
      renderer.drawTripleSlash();
      if(renderer.skillView.stages.counter)for(const enemy of session.enemies){
        if(!combat.isEnemyRecovering(enemy)||!renderer.camera.intersects(enemy.x-12,enemy.y-62,24,24))continue;
        host.ctx.save();host.ctx.translate(enemy.x,enemy.y-51);host.ctx.rotate(Math.PI/4);
        host.ctx.fillStyle='#e7efb8';host.ctx.strokeStyle='#15352c';host.ctx.lineWidth=2;
        host.ctx.fillRect(-4,-4,8,8);host.ctx.strokeRect(-4,-4,8,8);host.ctx.restore();
      }
      renderer.drawBossDanger(true);
      renderer.drawHeroOutline();
      renderer.beginLabelLayout();renderer.reserveAimIndicator();session.hero.markerLayout=renderer.layoutHeroMarker();
      renderer.drawBossStatus();
      renderer.drawPlayerThreats();
      renderer.drawCombatNumbers();
      host.ctx.globalAlpha = 1;
      if (session.state === 'playing' && session.phase === 'battle') {
        host.ctx.fillStyle = '#233d31dc'; host.ctx.fillRect(76, 446, 100, 23);
        host.ctx.fillStyle = '#f2cc93'; host.ctx.font = 'bold 8px Segoe UI'; host.ctx.textAlign = 'center'; host.ctx.fillText('JALUR PENYERANG →', 126, 461);
      }
      // Translucent clouds drift across the sea and treetops.
      const cloud = assetStore.img(math.terrain('Decorations/Clouds/Clouds_01'));
      if (cloud && !renderer.reducedMotion) {
        host.ctx.globalAlpha = .13;
        host.ctx.drawImage(cloud, (session.animTime * 7 % 1700) - 320, 52, 365, 162);
        host.ctx.drawImage(cloud, 1020 - (session.animTime * 4 % 1700), 516, 280, 124);
        host.ctx.globalAlpha = 1;
      }
      renderer.drawHeroMarker();
      renderer.drawAimIndicator();
    };

    renderer.addEffect = function addEffect(path, x, y, size = 90, life = .55, fps = 14) { if(session.effects.length>=80)session.effects.shift(); session.effects.push({ path, x, y, size, life, time: 0, fps }); };

    renderer.float = function float(text, x, y, color = '#f4d790', large = false, priority=1) {
      let fy = y - 30;
      for (let attempts = 0; attempts < 3; attempts++) {
        if (!session.floaters.some(f => f.priority>=priority&&Math.abs(f.x - x) < 40 && Math.abs(f.y - fy) < 18)) break;
        fy -= 18;
      }
      const f={ text, x, y: fy, life: large ? .8 : .9, color, large, priority };
      if(session.floaters.length>=35){
        let least=0;for(let i=1;i<session.floaters.length;i++)if(session.floaters[i].priority<session.floaters[least].priority)least=i;
        if(session.floaters[least].priority>priority)return null;
        session.floaters.splice(least,1);
      }
      session.floaters.push(f);return f;
    };

    renderer.floatDamage = function floatDamage(target,amount,source){
      const priority=target===session.hero?3:source===session.hero||target===session.castle?2:0;
      const existing=session.floaters.find(f=>f.target===target&&f.priority===priority&&session.elapsed<f.mergeUntil);
      if(existing){existing.amount+=amount;existing.text=`−${Math.ceil(existing.amount)}`;return;}
      const color=target===session.hero||target===session.castle?'#ffb59d':source===session.hero?'#fff0ac':'#dfdfc8';
      const direction=source===session.hero?session.hero.swingFacing||session.hero.facing:target===session.hero?-session.hero.facing:1;
      const f=renderer.float(`−${Math.ceil(amount)}`,target.x+direction*(priority>=2?28:10),target.y-(target===session.castle?45:priority>=2?25:5),color,priority>=2,priority);
      if(f)Object.assign(f,{target,amount,mergeUntil:session.elapsed+.12,fontSize:target===session.hero?20:priority>=2?17:11});
    };

    renderer.updatePresentation = function updatePresentation(dt){
      for(const e of session.effects){e.life-=dt;e.time+=dt;}renderer.compactLiving(session.effects);
      for(const impact of session.impacts)impact.life-=dt;renderer.compactLiving(session.impacts);
      for(const f of session.floaters){f.life-=dt;f.y-=dt*26;}renderer.compactLiving(session.floaters);
      session.shake=Math.max(0,session.shake-dt*16);
      if(ui.announcementTimer>0&&(ui.announcementTimer-=dt)<=0){host.$('announcement').classList.remove('show');renderer.overlayDirty=true;}
      if(ui.toastTimer>0&&(ui.toastTimer-=dt)<=0){host.$('toast').classList.remove('show');renderer.overlayDirty=true;}
    };

    renderer.compactLiving = function compactLiving(list){let write=0;for(let i=0;i<list.length;i++)if(list[i].life>0)list[write++]=list[i];list.length=write;};

    renderer.flashFrames = new Map();

    renderer.terrainCanvas = undefined;

    renderer.scale = 1;

    renderer.cssScale = 1;

    renderer.cameraX = 0;

    renderer.cameraY = 0;

    renderer.viewW = renderer.camera.width;

    renderer.viewH = renderer.camera.height;

    renderer.overlayDirty = true;

    renderer.spriteMetadata = new Map();

    renderer.heroOutlines = new Map();

    renderer.unitFrames = new Map();

    renderer.unitFrameBytes = 0;

    renderer.heroSprite = {path:null,size:136,age:0,fps:9,facing:1,once:false};

    renderer.waterPattern = null;

    renderer.labelPool = Array.from({length:80},()=>({x:0,y:0,w:0,h:0,owner:null}));

    renderer.overlayRects = [];

    renderer.threatOrder = [];

    renderer.floaterOrder = [];

    renderer.labelCount = 0;

    renderer.sceneryItems = [
      ...world.trees.map(t=>({type:'tree',source:t,x:t.x,y:t.y,path:math.terrain(`Resources/Wood/Trees/Tree${t.variant}`)})),
      ...world.goldNodes.map(n=>({type:'gold',source:n,x:n.x,y:n.y,path:math.terrain(`Resources/Gold/Gold Stones/Gold Stone ${n.variant}`)})),
      ...world.bushes.map(([x,y,i])=>({type:'bush',x,y,seed:i,path:math.terrain(`Decorations/Bushes/Bushe${i}`)})),
      ...world.buildings.map(b=>({type:'building',source:b,x:b.x,y:b.y-9,path:`Buildings/${b.color} Buildings/${b.name}.png`})),
      ...world.sheep.map(s=>({type:'sheep',source:s,x:s.x,y:s.y,idle:math.terrain('Resources/Meat/Sheep/Sheep_Idle'),grass:math.terrain('Resources/Meat/Sheep/Sheep_Grass')})),
      ...world.villagers.map(v=>({type:'villager',source:v,x:v.x,y:v.y,path:math.blue('Pawn',`Interact ${v.tool}`)}))
    ].sort((a,b)=>a.y-b.y);

    renderer.renderUnits = [];

    renderer.shoreTiles = [];

    renderer.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    for(const [rstr,[left,right]] of Object.entries(world.rows)){const r=Number(rstr);for(let c=left;c<=right;c++)if(!navigation.land(c,r+1))renderer.shoreTiles.push([c*64,(r+1)*64-1]);}

      renderer.attach = function () {
        const observer = new ResizeObserver(renderer.resize);
        observer.observe(host.$('arena'));
        renderer.detach = () => observer.disconnect();
      };
  };
})(window.PenjagaModules = window.PenjagaModules || {});
