/* Test-only combat fixture. Load after the normal game; no production entrypoint. */
((root)=>{
  root.createLargeWorldAimFixture=function(canvas){
    const M=root.PenjagaModules,noop=()=>{};
    const map=JSON.parse(JSON.stringify(root.PenjagaMaps.island));
    Object.assign(map,{id:'aim-coordinate-fixture',name:'Aim coordinate fixture',width:2560,height:1792,
      landBounds:{left:0,right:2560,top:0,bottom:1792},
      rows:Object.fromEntries(Array.from({length:28},(_,i)=>[i,[0,39]])),heroSpawn:{x:1613,y:995}});
    const world=new M.World(map),session=new M.GameSession({world}),camera=new M.Camera2D(map.width,map.height);
    camera.resize(canvas.getBoundingClientRect().width,canvas.getBoundingClientRect().height);camera.follow(session.hero);
    const rt={world,session,config:M.config,math:{},input:new M.InputController(),combat:{},upgrading:{},navigation:{},
      host:{canvas,$:()=>({hidden:false,classList:{add:noop}})},ui:{},ai:{releaseApproach:noop},
      economy:{},director:{},audio:{tone:noop,combatCue:noop,playSample:noop},
      renderer:{screenToWorld:(x,y)=>camera.screenToWorld(x,y,canvas.getBoundingClientRect()),
        addEffect:noop,float:noop,floatDamage:noop}};
    for(const name of ['Math','Input','Navigation','Upgrading','Combat'])M['install'+name](rt);
    session.resetForRun();session.state='playing';rt.combat.resetCombatStats();
    return {...rt,camera,setPointer(x,y){
      rt.input.mouseAimActive=true;rt.input.pointerOverCanvas=true;
      rt.input.pointerScreen={x,y};rt.input.updateAim();
    }};
  };
})(window);
