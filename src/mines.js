/* One campaign mine operation. Classic script: no DOM, fetch or wall-clock timers. */
((M)=>{
  'use strict';
  const stages=['rock','outpost','mine-house'],chapters=['chapter-1','chapter-2','chapter-3'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  M.MineParameters=freeze({operationId:'mine-operation',stages,chapters,names:['Batu emas','Pos tambang kecil','Rumah tambang'],
    costs:[0,150,250],yield:[25,35,45],production:[0,6,16],period:6,tickLimit:50,quota:20,harvestSeconds:.9,gapSeconds:.18,
    allocations:{'chapter-1':{'gold-01':7,'gold-02':7,'gold-03':6},
      'chapter-2':{'gold-01':5,'gold-02':5,'gold-03':4,'gold-north-01':6},
      'chapter-3':{'gold-01':4,'gold-02':4,'gold-03':4,'gold-north-01':4,'gold-southwest-01':4}}});
  M.createMines=function({session,world,profile='standard',testingYield=10000,
    isActive=()=>session.state==='playing',canPurchase=()=>session.state==='playing'&&session.phase==='prepare',hasBossVictory=()=>false}={}){
    if(!session||!world)throw new TypeError('Mines requires a session wallet and World.');
    if(!['standard','user-testing'].includes(profile))throw new RangeError('Unknown mine profile.');
    if(!Number.isSafeInteger(testingYield)||testingYield<=0)throw new RangeError('Testing yield must be a positive safe integer.');
    const P=M.MineParameters,all=world.allCollections?.goldNodes||world.goldNodes;
    const nodes=all.map((n,i)=>({...n,id:n.id||world.objectIds?.goldNodes?.[i]}));
    if(nodes.some(n=>!n.id)||new Set(nodes.map(n=>n.id)).size!==nodes.length)throw new TypeError('Mine source identities must be unique.');
    const byId=new Map(nodes.map(n=>[n.id,n]));
    let state;
    const reset=()=>{state={version:1,operationId:P.operationId,profileId:profile,manualOverride:profile==='user-testing'?testingYield:null,
      runId:null,chapterId:null,stageId:'rock',purchases:[],chapters:{},gatherCooldownRemaining:0};};reset();
    const ledger=()=>state.chapters[state.chapterId],level=()=>stages.indexOf(state.stageId);
    const alive=()=>session.hero?.hp>0&&session.castle?.hp>0;
    const active=()=>!!ledger()&&alive()&&session.state==='playing'&&isActive()===true;
    const validWallet=delta=>Number.isSafeInteger(session.gold)&&session.gold>=0&&Number.isSafeInteger(session.gold+delta)&&session.gold+delta>=0;
    const receipt=(ok,reason,extra={})=>({ok,reason,goldDelta:0,...extra});
    const mineActive=id=>byId.has(id)&&(!world.isObjectActive||world.isObjectActive(id));
    function enterChapter({runId,chapterId}={}){
      if(!(typeof runId==='string'&&runId.trim()||Number.isSafeInteger(runId)&&runId>=0)||!chapters.includes(chapterId))return receipt(false,'invalid-identity');
      if(state.runId!==null&&state.runId!==runId)return receipt(false,'run-mismatch');
      if(state.chapters[chapterId])return receipt(chapterId===state.chapterId,chapterId===state.chapterId?'already-entered':'stale-chapter',{refilled:false});
      if(chapters.indexOf(chapterId)!==Object.keys(state.chapters).length)return receipt(false,'chapter-order');
      const allocation=P.allocations[chapterId];
      if(Object.keys(allocation).some(id=>!mineActive(id)))return receipt(false,'world-not-ready');
      state.runId=runId;state.chapterId=chapterId;state.gatherCooldownRemaining=0;
      state.chapters[chapterId]={refillEpoch:chapterId,allocated:clone(allocation),remaining:clone(allocation),actions:0,manualGold:0,
        passiveElapsedSeconds:0,passiveTicks:0,passiveGold:0};
      return receipt(true,null,{refilled:true});
    }
    function status(mineId){
      const l=ledger(),i=level(),next=i+1,chapter=chapters.indexOf(state.chapterId);
      const remaining=l?Object.values(l.remaining).reduce((a,b)=>a+b,0):0;
      const reason=!l?'no-chapter':!alive()?'dead':!active()?'inactive':!mineActive(mineId)?'node-locked':
        !Object.hasOwn(l.remaining,mineId)?'node-locked':!l.remaining[mineId]?'exhausted':null;
      const node=byId.get(mineId),inRange=!!node&&Math.hypot(session.hero.x-node.x,session.hero.y-node.y)<=88;
      return {operationId:P.operationId,stageId:state.stageId,name:P.names[i],level:i,chapterId:state.chapterId,runId:state.runId,
        profileId:profile,manualOverride:state.manualOverride,yield:state.manualOverride??P.yield[i],standardYield:P.yield[i],
        production:P.production[i],period:P.period,passiveTicks:l?.passiveTicks||0,tickLimit:P.tickLimit,
        passiveElapsedSeconds:l?.passiveElapsedSeconds||0,remaining,quota:P.quota,gold:session.gold,
        mineId,nodeRemaining:l?.remaining[mineId]??0,nodeActive:!!l&&mineActive(mineId)&&Object.hasOwn(l.remaining,mineId),
        gatherCooldownRemaining:state.gatherCooldownRemaining,reason,
        canInteract:!reason&&inRange&&state.gatherCooldownRemaining<=1e-9&&!(session.hero.attack>0||session.hero.dash>0||session.hero.stagger>0||session.hero.moving),
        next:next<stages.length?{stageId:stages[next],name:P.names[next],cost:P.costs[next],requiredChapterId:chapters[next],
          chapterUnlocked:chapter>=next,bossUnlocked:hasBossVictory('boss-chapter-'+next)===true,
          allowed:!!l&&alive()&&canPurchase()===true&&chapter>=next&&hasBossVictory('boss-chapter-'+next)===true&&validWallet(-P.costs[next])}:null};
    }
    function interact(mineId){
      const view=status(mineId);
      if(!view.canInteract)return receipt(false,view.reason||'cannot-harvest');
      if(!validWallet(view.yield)||!Number.isSafeInteger(ledger().manualGold+view.yield))return receipt(false,'wallet-overflow');
      const l=ledger();session.gold+=view.yield;l.remaining[mineId]--;l.actions++;l.manualGold+=view.yield;
      state.gatherCooldownRemaining=P.gapSeconds;
      return receipt(true,null,{mineId,goldDelta:view.yield,remaining:view.remaining-1,nodeRemaining:l.remaining[mineId],stageId:state.stageId});
    }
    function purchaseNextLevel(){
      const next=status().next;
      if(!next)return receipt(false,'max-level');
      if(!ledger())return receipt(false,'no-chapter');
      if(!alive()||canPurchase()!==true)return receipt(false,'purchase-closed');
      if(!next.chapterUnlocked)return receipt(false,'chapter-locked');
      if(!next.bossUnlocked)return receipt(false,'boss-locked');
      if(!validWallet(-next.cost))return receipt(false,'insufficient-gold');
      session.gold-=next.cost;state.stageId=next.stageId;
      state.purchases.push({stageId:next.stageId,chapterId:state.chapterId,cost:next.cost});
      return receipt(true,null,{stageId:state.stageId,goldDelta:-next.cost});
    }
    function update(dt){
      // Fixed-step simulation seconds only: reject wall-clock/offline catch-up.
      if(!Number.isFinite(dt)||dt<=0||dt>.1)return receipt(false,'invalid-dt',{ticks:0});
      if(!active())return receipt(false,'inactive',{ticks:0});
      const l=ledger();let elapsed=l.passiveElapsedSeconds+dt;
      const ticks=Math.min(P.tickLimit-l.passiveTicks,Math.floor((elapsed+1e-9)/P.period));
      const gold=ticks*P.production[level()];
      if(!validWallet(gold))return receipt(false,'wallet-overflow',{ticks:0});
      state.gatherCooldownRemaining=Math.max(0,state.gatherCooldownRemaining-dt);
      l.passiveTicks+=ticks;l.passiveGold+=gold;
      elapsed=Math.max(0,elapsed-ticks*P.period);l.passiveElapsedSeconds=l.passiveTicks>=P.tickLimit?0:elapsed;
      session.gold+=gold;return receipt(true,null,{ticks,goldDelta:gold});
    }
    return Object.freeze({enterChapter,update,interact,purchaseNextLevel,snapshot:()=>clone(state),reset,status,
      nodes:()=>nodes.map(n=>({...n}))});
  };
  // Runtime adapter follows docs/campaign-runtime-interface.md (boolean harvest).
  M.installMines=function(ports){
    const {mines,session,world,config,campaign,host,renderer,input,ui,economy}=ports;
    if(!mines||!campaign)throw new TypeError('Allocate mines and campaign ports before installing mines.');
    let engine,panel,lastReceipt=null,resume=null,pendingResidentTicks=0;
    const cleanup=[];
    const domActive=()=>typeof document==='undefined'||!document.hidden&&!document.querySelector('dialog[open]');
    const campaignView=()=>campaign.snapshot?.();
    function initialise(){
      const override=campaign.miningRewardOverride?.();
      if(override!==null&&!Number.isSafeInteger(override))throw new Error('Campaign must resolve the mining profile before entering a chapter.');
      engine=M.createMines({session,world,profile:override===null?'standard':'user-testing',testingYield:override??config.GATHERING_REWARDS.gold,
        isActive:()=>campaign.enabled===true&&campaignView()?.status==='active'&&domActive(),
        hasBossVictory:id=>campaign.hasBossVictory?.(id)===true,
        canPurchase:()=>{
          const status=campaignView()?.status,ownPanel=!!panel?.dialog.open;
          return campaign.enabled===true&&(status==='chapter-review'&&['chapter-review','paused'].includes(session.state)||
            status==='active'&&session.phase==='prepare'&&(session.state==='playing'||session.state==='paused'&&(ownPanel||!!host?.$('campDialog')?.open)));
        }});
    }
    const transact=(method,args)=>{lastReceipt=engine[method](...args);panel?.update();return lastReceipt;};
    Object.assign(mines,{
      enterChapter(identity){
        const cursor=campaignView();
        if(campaign.enabled!==true)return {ok:false,reason:'campaign-disabled',goldDelta:0};
        if(!cursor||cursor.runId!==identity?.runId||cursor.chapterId!==identity?.chapterId)return {ok:false,reason:'campaign-identity-mismatch',goldDelta:0};
        if(!engine)initialise();
        const result=transact('enterChapter',[identity]);if(result.refilled)pendingResidentTicks=0;return result;
      },
      update:dt=>{if(!engine)return {ok:false,reason:'no-chapter',goldDelta:0,ticks:0};const result=engine.update(dt);pendingResidentTicks+=result.ticks||0;return result;},
      interact:id=>{
        if(!engine)return false;const result=transact('interact',[id]);
        if(result.ok){const node=engine.nodes().find(n=>n.id===id);renderer?.float?.(`+${result.goldDelta} emas`,node.x,node.y);ui?.updateUI?.();}
        return result.ok;
      },
      purchaseNextLevel:()=>!!engine&&transact('purchaseNextLevel',[]).ok,
      snapshot:()=>engine?engine.snapshot():null,
      reset(){resume=null;pendingResidentTicks=0;if(panel?.dialog.open)panel.close();engine?.reset();engine=null;lastReceipt=null;if(panel)panel.button.hidden=true;panel?.update();},
      status:id=>engine?.status(id)||null,nodes:()=>engine?.nodes()||[],
      lastReceipt:()=>lastReceipt?clone(lastReceipt):null
    });
    mines.dispose=()=>{resume=null;pendingResidentTicks=0;for(const release of cleanup.splice(0).reverse())release();panel=null;engine=null;lastReceipt=null;};
    // Use one6s clock. Residents still receive rewards through campaign's owner.
    if(economy?.updatePassiveIncome){
      const originalIncome=economy.updatePassiveIncome;
      const updatePassiveIncome=function(dt){
        if(!campaign.enabled||!engine)return originalIncome.call(this,dt);
        if(session.state!=='playing'||campaignView()?.status!=='active'||!domActive())return;
        const ticks=pendingResidentTicks;pendingResidentTicks=0;
        for(let i=0;i<ticks;i++)if(campaign.passiveTick?.()){
          const [wood,gold]=world.villagers||[];
          if(wood)renderer?.float?.('+3 kayu',wood.x,wood.y,'#dbdca0');
          if(gold)renderer?.float?.('+4 emas',gold.x,gold.y);
        }
        session.passiveTimer=engine.status().passiveElapsedSeconds;
      };
      economy.updatePassiveIncome=updatePassiveIncome;cleanup.push(()=>{if(economy.updatePassiveIncome===updatePassiveIncome)economy.updatePassiveIncome=originalIncome;});
    }
    // No UI is required for headless controller tests. Visual installer is optional.
    if(!host||!M.installMinePanel)return;
    if(campaign.enabled&&M.MineVisual&&ports.assets?.preload){
      const originalPreload=ports.assets.preload;
      mines.preloadAssets=()=>Promise.all(M.MineVisual.assetPaths().map(path=>ports.assets.loadImage(path)));
      const preload=async function(...args){await mines.preloadAssets();return originalPreload.apply(this,args);};
      ports.assets.preload=preload;cleanup.push(()=>{if(ports.assets.preload===preload)ports.assets.preload=originalPreload;});
    }
    const facade={status:id=>engine?.status(id)||{name:'Tambang belum aktif',gold:session.gold,yield:0,remaining:0,quota:20,production:0,period:6,passiveTicks:0,tickLimit:50,next:null,profileId:'standard'},
      nodes:()=>engine?.nodes()||[],purchaseNextLevel:()=>engine?transact('purchaseNextLevel',[]):{ok:false,reason:'no-chapter',goldDelta:0}};
    panel=M.installMinePanel({mount:host.$('arena'),mines:facade,onOpen:()=>{
      if(!engine||!['playing','chapter-review'].includes(session.state)||document.querySelector('dialog[open]'))return false;
      resume=session.state;session.state=resume==='playing'?'paused':resume;input?.clearCombatInput?.();return true;
    },onClose:()=>{const hadOwner=resume!==null;if(resume&&(session.state==='paused'||session.state==='chapter-review'))session.state=resume;resume=null;input?.clearCombatInput?.();if(hadOwner)host.canvas.focus({preventScroll:true});},
      onPurchase:result=>{if(result.ok)renderer?.draw?.();}});
    cleanup.push(()=>panel.dispose());
    const originalUI=ui?.updateUI;
    if(originalUI){const updateUI=function(...args){const result=originalUI.apply(this,args);panel.button.hidden=!campaign.enabled||!engine||!['playing','paused','chapter-review'].includes(session.state);panel.update();return result;};
      ui.updateUI=updateUI;cleanup.push(()=>{if(ui.updateUI===updateUI)ui.updateUI=originalUI;});}
    panel.button.hidden=true;
    const onKey=event=>{
      if(event.key.toLowerCase()!=='m'||event.repeat||document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
      if(!panel.button.hidden){event.preventDefault();panel.open();}
    };
    input?.listen?.(window,'keydown',onKey);cleanup.push(()=>window.removeEventListener('keydown',onKey));
    mines.panel=panel;
    if(M.MineVisual&&M.createMineHooks&&renderer?.drawScenery){
      const visual=new M.MineVisual({world,mines:facade,image:path=>ports.assets.img(path)});
      // Facade nodes are available after enterChapter; avoid capturing an empty list.
      const originalDraw=renderer.drawScenery;
      const drawScenery=function(item){
        const source=item.source,primary=engine?.nodes().find(n=>n.id===M.MineVisual.primaryId);
        if(item.type==='gold'&&primary&&source.x===primary.x&&source.y===primary.y){visual.draw(host.ctx,renderer.camera,session.hero);return;}
        return originalDraw.call(this,item);
      };
      renderer.drawScenery=drawScenery;cleanup.push(()=>{if(renderer.drawScenery===drawScenery)renderer.drawScenery=originalDraw;});
    }
  };
})(window.PenjagaModules=window.PenjagaModules||{});
