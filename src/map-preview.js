/* Standalone desktop exploration. No wave scheduler or campaign rewards. */
(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  try {
    const M=window.PenjagaModules,world=new M.World(window.PenjagaMaps['campaign-islands']);
    const session=new M.GameSession({world}),math={},navigation={};
    M.installMath({math,session});
    M.installNavigation({navigation,world,config:M.config,math,session,combat:{heroAttackAge:()=>0}});
    const canvas=$('previewCanvas'),ctx=canvas.getContext('2d'),camera=new M.Camera2D(world.width,world.height);
    const images=new Map();
    await Promise.all(M.MapPreviewRenderer.assetPaths(world).map(path => new Promise((resolve,reject) => {
      const image=new Image();image.onload=()=>{images.set(path,image);resolve();};image.onerror=()=>reject(new Error('Asset missing: '+path));image.src=path;
    })));
    const renderer=new M.MapPreviewRenderer(world,images),keys=new Set(),hero=session.hero;
    let chapterId='chapter-1',target=null,pointer=null,pointerWorld=null,time=0,lastTime=0,accumulator=0;
    const controlKeys=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
    session.state='preview';
    function resize() {
      const rect=canvas.getBoundingClientRect();
      camera.resize(rect.width,rect.height);
      const dpr=Math.max(1,Math.min(devicePixelRatio||1,2,Math.sqrt(2400000/(rect.width*rect.height))));
      canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
      ctx.imageSmoothingEnabled=false;
    }
    function safePoint(regionId) {
      const region=renderer.regions.find(r=>r.id===regionId);
      const {bounds}=region,points=[];
      for (const rect of region.rectangles) {
        for (let y=rect.y+16;y<rect.y+rect.height;y+=32) for(let x=rect.x+16;x<rect.x+rect.width;x+=32) {
          if (world.isWalkable(x,y)) points.push({x,y});
        }
      }
      points.sort((a,b)=>Math.hypot(a.x-bounds.x-bounds.width/2,a.y-bounds.y-bounds.height/2)-Math.hypot(b.x-bounds.x-bounds.width/2,b.y-bounds.y-bounds.height/2));
      if (!points.length) throw new Error('No safe inspection point in '+regionId);
      return points[0];
    }
    function place(point) {
      if (!world.isWalkable(point.x,point.y)) throw new Error('Inspection position is not walkable.');
      Object.assign(hero,{x:point.x,y:point.y,moving:false,route:[],routeTimer:0,routeTarget:null,
        progressPosition:{x:point.x,y:point.y},progressTimer:0,stallSeconds:0});
      target=null;keys.clear();camera.follow(hero);canvas.focus({preventScroll:true});
    }
    function refreshChoices() {
      $('regionSelect').replaceChildren(...renderer.regions.map(region => {
        const option=document.createElement('option');option.value=region.id;
        option.textContent=region.theme.label+(world.isRegionActive(region.id)?'':' · terkunci');
        option.disabled=!world.isRegionActive(region.id);return option;
      }));
      document.querySelectorAll('[data-chapter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chapter===chapterId)));
      $('chapterStatus').textContent='Bab '+chapterId.at(-1)+' · '+world.activeRegionIds.filter(id=>id.startsWith('island-')).length+' pulau terbuka';
    }
    function chooseChapter(id) {
      world.applyChapterPreview(id);chapterId=id;
      refreshChoices();place(world.heroSpawn);
    }
    function visitRegion(id) {
      if(!world.isRegionActive(id))throw new Error('Region locked: '+id);
      $('regionSelect').value=id;place(safePoint(id));
    }
    document.querySelectorAll('[data-chapter]').forEach(button=>button.addEventListener('click',()=>chooseChapter(button.dataset.chapter)));
    $('visitRegion').addEventListener('click',()=>visitRegion($('regionSelect').value));
    $('resetPosition').addEventListener('click',()=>place(world.heroSpawn));
    window.addEventListener('keydown',event=>{
      if (/SELECT|INPUT|TEXTAREA/.test(event.target.tagName)) return;
      const key=event.key.toLowerCase();
      if (controlKeys.includes(key)) {event.preventDefault();keys.add(key);target=null;}
    });
    window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur',()=>keys.clear());
    document.addEventListener('visibilitychange',()=>{keys.clear();accumulator=0;lastTime=0;});
    canvas.addEventListener('pointermove',event=>{pointer={x:event.clientX,y:event.clientY};});
    canvas.addEventListener('pointerdown',event=>{
      if (event.button!==0) return;
      pointer={x:event.clientX,y:event.clientY};
      const point=camera.screenToWorld(event.clientX,event.clientY,canvas.getBoundingClientRect());
      target=world.isWalkable(point.x,point.y)?point:null;
      canvas.focus({preventScroll:true});
    });
    const observer=new ResizeObserver(resize);observer.observe(canvas);
    function step(dt) {
      hero.moving=false;
      const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
      if (dx||dy) navigation.move(hero,dx,dy,dt,185);
      else if (target) {
        if (math.dist(hero,target)<5) target=null;
        else navigation.steerMove(hero,target,dt,185);
      }
    }
    function frame(timestamp) {
      const dt=lastTime?Math.min(.1,(timestamp-lastTime)/1000):0;lastTime=timestamp;
      if (!document.hidden) {
        time+=dt;accumulator+=dt;
        for (let count=0;accumulator>=1/60&&count<6;count++) {step(1/60);accumulator-=1/60;}
      }
      camera.follow(hero);
      const rect=canvas.getBoundingClientRect();
      if (pointer) pointerWorld=camera.screenToWorld(pointer.x,pointer.y,rect);
      const scaleX=canvas.width/camera.width,scaleY=canvas.height/camera.height;
      ctx.setTransform(scaleX,0,0,scaleY,-camera.x*scaleX,-camera.y*scaleY);
      renderer.draw(ctx,camera,time,hero);
      if (pointerWorld) {
        ctx.strokeStyle=world.isWalkable(pointerWorld.x,pointerWorld.y)?'#fff1ad':'#ff9b8c';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(pointerWorld.x,pointerWorld.y,7,0,Math.PI*2);ctx.stroke();
      }
      if (target) {ctx.strokeStyle='#ffe2a4';ctx.beginPath();ctx.arc(target.x,target.y,12,0,Math.PI*2);ctx.stroke();}
      renderer.minimap($('previewMinimap'),camera,hero,session.castle);
      const regions=world.floorGeometry.rectangles.filter(r=>hero.x>=r.x&&hero.x<r.x+r.width&&hero.y>=r.y&&hero.y<r.y+r.height);
      const region=regions.find(r=>r.kind==='bridge')||regions[0];
      $('regionBadge').textContent=M.MapPreviewRenderer.theme(region?.regionId||'').label;
      $('coordinateReadout').textContent='Penjaga '+hero.x.toFixed(1)+', '+hero.y.toFixed(1);
      $('mouseReadout').textContent=pointerWorld?'Mouse '+pointerWorld.x.toFixed(1)+', '+pointerWorld.y.toFixed(1):'Arahkan mouse ke map';
      $('viewReadout').textContent='World '+world.width+' × '+world.height+' · View '+Math.round(camera.width)+' × '+camera.height;
      $('castleHealth').textContent=session.castle.hp+' / '+session.castle.maxHp+' HP';
      $('castleMeter').value=session.castle.hp;
      requestAnimationFrame(frame);
    }
    resize();chooseChapter('chapter-1');$('loadStatus').hidden=true;
    window.PenjagaMapPreview=Object.freeze({
      chapter:chooseChapter,
      visit:visitRegion,
      snapshot:()=>({chapterId,activeRegionIds:[...world.activeRegionIds],region:$('regionBadge').textContent,
        hero:{x:hero.x,y:hero.y},castle:{hp:session.castle.hp,maxHp:session.castle.maxHp},
        camera:{x:camera.x,y:camera.y,width:camera.width,height:camera.height},pointerWorld,target,render:{...renderer.stats}})
    });
    requestAnimationFrame(frame);
  } catch (error) {
    $('loadStatus').textContent='Preview gagal dimuat. Pastikan seluruh berkas map dan aset tersedia.';
    console.error(error);
  }
})();
