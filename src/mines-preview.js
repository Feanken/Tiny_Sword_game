/* Explicit chapter fixture. Does not own or replace the gameplay campaign. */
(async()=>{
  'use strict';
  const $=id=>document.getElementById(id),M=window.PenjagaModules;
  try{
    const definition=M.prepareMineMap(window.PenjagaMaps['campaign-islands']),world=new M.World(definition);
    const session={state:'loading',phase:'prepare',gold:80,wood:40,hero:{...world.heroSpawn,hp:100,maxHp:100,facing:1},castle:{...world.castle,hp:500},gameRandom:Math.random,combatStats:{},allies:[],enemies:[],combatUnits:[],approachSlots:new Map()};
    const math={},navigation={};M.installMath({math,session});M.installNavigation({world,session,math,navigation,config:M.config,combat:{heroAttackAge:()=>0}});
    const canvas=$('mineCanvas'),ctx=canvas.getContext('2d'),camera=new M.Camera2D(world.width,world.height),images=new Map();
    const paths=[...new Set([...M.MapPreviewRenderer.assetPaths(world),...M.MineVisual.assetPaths()])];
    await Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images.set(path,image);resolve();};image.onerror=()=>reject(new Error('Missing mine asset '+path));image.src=path;})));
    const renderer=new M.MapPreviewRenderer(world,images),keys=new Set();
    let mines,panel,visual,hooks,unhook,run=0,time=0,last=0,accumulator=0,work=null,hiddenPause=false;
    const active=()=>!document.hidden&&!document.querySelector('dialog[open]');
    function nearest(){let found=null,distance=85;for(const node of world.goldNodes){const candidate=hooks.resource(node);if(!candidate)continue;const d=math.dist(session.hero,node);if(d<distance){distance=d;found=candidate;}}return found;}
    function readouts(){
      const view=mines.status();$('mineGold').textContent=session.gold;
      $('mineStageCaption').textContent=view.name;$('mineChapterCaption').textContent='Bab '+view.chapterId.at(-1)+' · '+view.yield+' emas / aksi';
      const profile=view.profileId==='standard'?'PROFIL STANDAR':'TESTING · OVERRIDE '+view.manualOverride+' EMAS';
      $('mineProfileCaption').textContent=profile;$('mineProfileBadge').textContent=profile;
      $('mineQuotaReadout').textContent='Kuota operasi: '+view.remaining+' / 20 aksi tersisa';
      $('minePassiveReadout').textContent='Tambahan pasif: +'+view.production+' / 6 detik · tick '+view.passiveTicks+' / 50';
      const hint=nearest();$('mineHint').textContent=session.state==='paused'?'Dijeda · waktu tambang berhenti':work?'Tahan posisi sampai mining selesai':hint?'Tahan E · '+hint.name:'Dekati node aktif atau pilih titik mining aman';
      document.querySelectorAll('[data-mine-chapter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mineChapter===view.chapterId)));
      $('minePause').textContent=session.state==='paused'?'Lanjutkan · P':'Jeda · P';
      $('mineWork').hidden=!work;if(work){$('mineWorkLabel').textContent=work.node.mineId;$('mineWorkProgress').value=work.elapsed;}
      panel.update();
    }
    function draw(){camera.follow(session.hero);const sx=canvas.width/camera.width,sy=canvas.height/camera.height;
      ctx.setTransform(sx,0,0,sy,-camera.x*sx,-camera.y*sy);renderer.draw(ctx,camera,time,session.hero);readouts();}
    function feedback(result){$('mineFeedback').textContent=result.ok?(result.goldDelta?`${result.goldDelta>0?'+':''}${result.goldDelta} emas`:'Identitas bab sama: kuota dan transaksi dipertahankan.'):'Ditolak: '+result.reason;}
    function visit(id){
      const node=mines.nodes().find(n=>n.id===id);if(!node||!mines.status(id).nodeActive)return false;
      const choices=[];for(const r of [58,68,78])for(let i=0;i<24;i++){const angle=Math.PI/2+i*Math.PI/12,p={x:node.x+Math.cos(angle)*r,y:node.y+Math.sin(angle)*r};if(navigation.positionFits(p.x,p.y))choices.push(p);}
      if(!choices.length)throw new Error('No safe mining position for '+id);
      Object.assign(session.hero,{...choices[0],moving:false});keys.clear();work=null;$('mineNode').value=id;camera.follow(session.hero);draw();canvas.focus();return true;
    }
    function nodeChoices(){
      $('mineNode').replaceChildren(...mines.nodes().filter(n=>mines.status(n.id).nodeActive).map(n=>{const o=document.createElement('option');o.value=n.id;o.textContent=n.id;return o;}));
    }
    function chapter(id){
      const index=M.MineParameters.chapters.indexOf(id),current=M.MineParameters.chapters.indexOf(mines.snapshot().chapterId);
      let result;if(index<=current){result=mines.enterChapter({runId:'mine-fixture-'+run,chapterId:id});}
      else for(let i=current+1;i<=index;i++){const next=M.MineParameters.chapters[i];world.applyChapterPreview(next);result=mines.enterChapter({runId:'mine-fixture-'+run,chapterId:next});if(!result.ok)break;work=null;keys.clear();}
      feedback(result);nodeChoices();draw();return result;
    }
    function reset(profile=$('mineProfile').value){
      if(panel?.dialog.open)panel.close();panel?.dispose();unhook?.();mines?.reset();run++;
      session.state='playing';session.gold=80;session.wood=40;work=null;keys.clear();last=0;accumulator=0;$('mineProfile').value=profile;
      world.applyChapterPreview('chapter-1');
      mines=M.createMines({session,world,profile,testingYield:M.config.GATHERING_REWARDS.gold,isActive:active,
        hasBossVictory:id=>M.MineParameters.chapters.indexOf(mines?.snapshot().chapterId)>=Number(id.at(-1)),
        canPurchase:()=>session.phase==='prepare'&&(session.state==='playing'||session.state==='paused'&&panel?.dialog.open)});
      mines.enterChapter({runId:'mine-fixture-'+run,chapterId:'chapter-1'});
      visual=new M.MineVisual({world,mines,image:path=>images.get(path)});
      hooks=M.createMineHooks({world,mines,visual,onHarvest:feedback});unhook=hooks.installPreview(renderer);
      panel=M.installMinePanel({mount:$('minePanelMount'),mines,onOpen:()=>{
        if(session.state!=='playing')return false;session.state='paused';keys.clear();last=0;accumulator=0;return true;
      },onClose:()=>{session.state='playing';keys.clear();last=0;accumulator=0;canvas.focus();},onPurchase:()=>draw()});
      nodeChoices();visit('gold-01');$('mineFeedback').textContent='Fixture baru · 80 emas · profil '+profile;
    }
    function pause(){if(panel.dialog.open)return;session.state=session.state==='playing'?'paused':'playing';keys.clear();last=0;accumulator=0;draw();}
    function step(dt){
      if(session.state!=='playing'||!active())return;
      time+=dt;const hero=session.hero,dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),
        dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
      hero.moving=false;if(dx||dy){work=null;navigation.move(hero,dx,dy,dt,185);}
      // One shared economy tick: the mine operation plus existing residents, once.
      const result=mines.update(dt);if(result.ok&&result.ticks){session.gold+=4*result.ticks;session.wood+=3*result.ticks;}
      if(work){
        if(math.dist(hero,work.node)>88){work=null;return;}
        work.elapsed+=dt;if(work.elapsed+1e-9>=M.MineParameters.harvestSeconds){const node=work.node;work=null;hooks.harvest(node);}
      }
      if(!work&&keys.has('e')&&mines.status().gatherCooldownRemaining<=1e-9){const node=nearest();if(node)work={node,elapsed:0};}
    }
    function resize(){const rect=canvas.getBoundingClientRect();camera.resize(rect.width,rect.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.imageSmoothingEnabled=false;}
    let frameId;function frame(stamp){const dt=last?Math.min(.1,(stamp-last)/1000):0;last=stamp;
      if(session.state==='playing'&&active()){accumulator+=dt;for(let n=0;n<6&&accumulator+1e-9>=1/60;n++){step(1/60);accumulator=Math.max(0,accumulator-1/60);}}
      else accumulator=0;draw();frameId=requestAnimationFrame(frame);}
    $('mineVisit').addEventListener('click',()=>visit($('mineNode').value));$('minePause').addEventListener('click',pause);
    $('mineReset').addEventListener('click',()=>reset());$('mineProfile').addEventListener('change',()=>reset());
    document.querySelectorAll('[data-mine-chapter]').forEach(button=>button.addEventListener('click',()=>chapter(button.dataset.mineChapter)));
    window.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
      const key=event.key.toLowerCase();if(['m','p'].includes(key)&&!event.repeat){event.preventDefault();if(key==='m')panel.open();else pause();return;}
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e'].includes(key)){event.preventDefault();if(session.state==='playing')keys.add(key);}});
    window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(session.state==='playing'){hiddenPause=true;session.state='paused';}last=0;accumulator=0;});
    document.addEventListener('visibilitychange',()=>{keys.clear();last=0;accumulator=0;if(document.hidden&&session.state==='playing'){hiddenPause=true;session.state='paused';}});
    window.addEventListener('focus',()=>{if(hiddenPause){hiddenPause=false;last=0;}});
    new ResizeObserver(resize).observe(canvas);resize();reset();
    window.MinePreview={world,session,navigation,camera,renderer,images,canvas,get mines(){return mines;},get panel(){return panel;},
      reset,chapter,visit,pause,step,draw,stop:()=>cancelAnimationFrame(frameId),
      snapshot:()=>({mine:mines.snapshot(),view:mines.status(),gold:session.gold,wood:session.wood,state:session.state,hero:{x:session.hero.x,y:session.hero.y},work:work?{id:work.node.mineId,elapsed:work.elapsed}:null})};
    frameId=requestAnimationFrame(frame);
  }catch(error){$('mineHint').textContent='Fixture gagal: '+error.message;console.error(error);}
})();
