/* Stage 2 map prototype. Classic script; statistics/economy stay in config.js. */
((root) => {
  'use strict';
  const base=root.PenjagaMaps?.island;
  if(!base)throw new Error('Load maps/island.js before campaign-islands.js.');
  const copy=value=>JSON.parse(JSON.stringify(value));
  const offset={x:768,y:640};
  const main='island-main',north='island-north',southwest='island-southwest';
  const map=copy(base);
  Object.assign(map,{
    version:2,id:'campaign-islands',name:'Tiga Pulau Penjaga',width:2560,height:1792,
    regions:[
      {id:main,kind:'island',origin:offset,localBounds:{left:64,right:1280,top:64,bottom:768},
        maskRows:{1:[[4,15]],2:[[2,18]],3:[[1,19]],4:[[1,19]],5:[[1,19]],6:[[1,19]],
          7:[[1,19]],8:[[1,19]],9:[[1,19]],10:[[2,18]],11:[[4,16]]}},
      {id:north,kind:'island',origin:{x:1344,y:0},localBounds:{left:64,right:704,top:64,bottom:576},
        maskRows:{1:[[3,8]],2:[[1,9]],3:[[1,10]],4:[[1,10]],5:[[1,10]],6:[[1,9]],7:[[2,8]],8:[[3,7]]}},
      {id:southwest,kind:'island',origin:{x:128,y:1152},localBounds:{left:64,right:640,top:64,bottom:576},
        maskRows:{1:[[5,8]],2:[[3,9]],3:[[1,9]],4:[[1,9]],5:[[1,9]],6:[[1,9]],7:[[1,8]],8:[[2,7]]}},
      {id:'bridge-north',kind:'bridge',connects:[main,north],width:160,
        centerline:[{x:1568,y:512},{x:1568,y:800}]},
      {id:'bridge-southwest',kind:'bridge',connects:[main,southwest],width:160,
        centerline:[{x:704,y:1312},{x:832,y:1312},{x:832,y:1184},{x:960,y:1184}]}
    ],
    previewChapters:{
      'chapter-1':[main],
      'chapter-2':[main,north,'bridge-north'],
      'chapter-3':[main,north,southwest,'bridge-north','bridge-southwest']
    },
    defaultGuardPointId:'guard-castle',
    heroSpawn:{x:1556,y:1010},castle:{x:1613,y:950},squadGuard:{x:1613,y:995},
    allySpawn:{x:1653,y:995},allyHome:{x:1488,y:1000,width:120,height:80},
    guardPoints:[
      {id:'guard-castle',regionId:main,position:{x:1613,y:995},label:'Benteng'},
      {id:'guard-west',regionId:main,position:{x:1433,y:1035},label:'Barat'},
      {id:'guard-north',regionId:main,requiredRegionIds:[north,'bridge-north'],position:{x:1533,y:965},label:'Utara'},
      {id:'guard-southwest',regionId:main,requiredRegionIds:[southwest,'bridge-southwest'],position:{x:1198,y:1120},label:'Barat daya'}
    ],
    gates:[
      {id:'gate-west',regionId:main,position:{x:1433,y:1035},guardPointId:'guard-west'},
      {id:'gate-north',regionId:main,position:{x:1533,y:965},guardPointId:'guard-north'},
      {id:'gate-southwest',regionId:main,position:{x:1198,y:1120},guardPointId:'guard-southwest'}
    ],
    objectRegions:{},decorations:[]
  });
  delete map.rows;delete map.landBounds;
  // Move source identities once, then open corridors by placing props at the edges.
  const treePoints=[
    [944,864],[976,1248],[1040,1312],[1120,1344],[1200,1344],
    [1184,816],[1264,816],[1344,816],[1408,784],
    [1968,960],[1968,1136],[1936,1312],[1808,1376],[1728,1344],
    [1280,1344],[1360,1344],[1440,1344],[1512,1344],
    [1456,304],[1936,336],[512,1664]
  ];
  map.trees=base.trees.map((t,i)=>({...copy(t),x:treePoints[i][0],y:treePoints[i][1]}));
  const buildings=[
    [1613,947,890],[1488,842,824],[1824,856,836],[1920,1088,1064],
    [1752,1208,1185],[1904,1216,1192],[1816,1320,1301],[1600,1312,1292],
    [1904,256,235],[1856,416,398],[576,1536,1518],[384,1408,1385]
  ];
  map.buildings=base.buildings.map((b,i)=>({...copy(b),x:buildings[i][0],y:buildings[i][1],cy:buildings[i][2]}));
  map.goldNodes=base.goldNodes.map(n=>({...copy(n),x:n.x+offset.x,y:n.y+offset.y}));
  map.goldNodes.push({x:1808,y:352,variant:2,radius:13},{x:384,y:1600,variant:2,radius:13});
  map.objectIds.goldNodes.push('gold-north-01','gold-southwest-01');
  map.sheep=base.sheep.map(s=>({...copy(s),x:s.x+offset.x,y:s.y+offset.y,originX:s.originX+offset.x,originY:s.originY+offset.y}));
  for(const key of ['rocks','bushes'])map[key]=base[key].map(([x,y,v])=>[x+offset.x,y+offset.y,v]);
  map.villagers=base.villagers.map(v=>({...copy(v),x:v.x+offset.x,y:v.y+offset.y}));
  for(const [key,ids] of Object.entries(map.objectIds))ids.forEach((id,i)=>{
    map.objectRegions[id]=key==='buildings'&&i>=8?(i<10?north:southwest):
      key==='trees'&&i>=18?(i<20?north:southwest):
      key==='goldNodes'&&i>=3?(i===3?north:southwest):main;
  });
  const path=(id,points,entryLaneOffset,exitLaneOffset,requiredRegionIds,label)=>({
    id:'path-'+id,roadId:'road-'+id,points:points.map(([x,y])=>({x,y})),
    entryLaneOffset,exitLaneOffset,exitRadius:22,gateId:'gate-'+id,requiredRegionIds,warningLabel:label
  });
  map.paths=[
    path('west',[[878,1045],[999,1042],[1118,1033],[1278,1050],[1433,1035]],
      {x:0,y:7},{x:0,y:13},[main],'Barat'),
    path('north',[[1664,128],[1664,384],[1568,512],[1568,800],[1536,896],[1533,965]],
      {x:7,y:0},{x:13,y:0},[main,north,'bridge-north'],'Utara'),
    path('southwest',[[256,1600],[448,1472],[704,1312],[832,1312],[832,1184],[960,1184],[1198,1120]],
      {x:0,y:7},{x:0,y:13},[main,southwest,'bridge-southwest'],'Barat daya')
  ];
  map.roadEntry=copy(map.paths[0].points[0]);
  map.roads=map.paths.map(p=>({id:p.roadId,requiredRegionIds:copy(p.requiredRegionIds),
    points:[...p.points.map(v=>[v.x,v.y]),[map.squadGuard.x,map.squadGuard.y]]}));
  map.enemySpawns=map.paths.flatMap(p=>['wave','boss'].map(role=>({
    id:'spawn-'+p.id.slice(5)+'-'+role,role,pathId:p.id,...copy(p.points[0]),
    jitter:role==='boss'?{x:[0,0],y:[0,0]}:{x:[-3,3],y:[-3,3]},
    lanes:role==='boss'?[0]:[-1,0,1,-2,2]
  })));
  map.obstacles=[
    ...map.trees.map((t,i)=>({id:'obstacle-tree-'+(i+1),sourceId:map.objectIds.trees[i],x:t.x,y:t.y-4,radius:t.radius})),
    ...map.goldNodes.map((n,i)=>({id:'obstacle-gold-'+(i+1),sourceId:map.objectIds.goldNodes[i],x:n.x,y:n.y,radius:n.radius})),
    ...map.buildings.map((b,i)=>({id:'obstacle-building-'+(i+1),sourceId:map.objectIds.buildings[i],x:b.x,y:b.cy,radius:b.radius}))
  ];
  root.PenjagaMaps['campaign-islands']=map;
})(typeof window==='object'?window:globalThis);
