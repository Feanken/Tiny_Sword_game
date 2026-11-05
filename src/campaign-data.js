/* Campaign prototype profile. Mining production/transactions belong to mines.js. */
((M)=>{
  'use strict';
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  M.CAMPAIGN=freeze({
    id:'dawn-campaign',mapId:'campaign-islands',wavePreparationSeconds:15,warningLead:5,
    startingResources:{gold:80,wood:40,food:3},
    passive:{interval:6,maxTicksPerChapter:50,gold:4,wood:3},
    waveRecovery:{heroHp:25},waveResources:{wood:15,food:1},
    chapters:[
      {id:'chapter-1',name:'Rumah di Ufuk Barat',paths:['path-west'],newPath:'path-west',
        bossId:'boss-chapter-1',bossPathId:'path-west',preparationSeconds:22,
        waveGold:[350,450,550,650,750],killGold:10,bossGold:500,chapterGold:0,
        recovery:{heroHp:0,castleHp:0},pressure:{hp:1,damage:1,speed:1},
        boss:{name:'Panglima Barat',hp:650,warningScale:1,recoveryScale:1,bias:'slam'}},
      {id:'chapter-2',name:'Bayang dari Utara',paths:['path-west','path-north'],newPath:'path-north',
        bossId:'boss-chapter-2',bossPathId:'path-north',preparationSeconds:30,
        waveGold:[700,900,1100,1300,1500],killGold:15,bossGold:1000,chapterGold:0,
        recovery:{heroHp:50,castleHp:140},pressure:{hp:1.25,damage:1.1,speed:1.03},
        boss:{name:'Panglima Utara',hp:950,warningScale:.95,recoveryScale:1,bias:'volley'}},
      {id:'chapter-3',name:'Tiga Arah Menjelang Fajar',paths:['path-west','path-north','path-southwest'],newPath:'path-southwest',
        bossId:'boss-chapter-3',bossPathId:'path-southwest',preparationSeconds:36,
        waveGold:[1200,1500,1800,2100,2400],killGold:20,bossGold:1500,chapterGold:0,
        recovery:{heroHp:50,castleHp:140},pressure:{hp:1.45,damage:1.2,speed:1.06},
        boss:{name:'Panglima Tiga Arus',hp:1350,warningScale:.9,recoveryScale:.95,bias:'charge'}}
    ]
  });
})(window.PenjagaModules=window.PenjagaModules||{});
