/* Penjaga Pulau: classic scripts keep direct file:// loading dependency-free. */
(function (M) {
  "use strict";
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  const config = {};
config.waves = [
    { name: 'Tamu tak diundang', color: 'Red', count: 7, interval: 1.7, types: ['Warrior', 'Warrior', 'Pawn'] },
    { name: 'Hujan panah', color: 'Purple', count: 10, interval: 1.65, types: ['Warrior', 'Archer', 'Lancer'] },
    { name: 'Pasukan matahari', color: 'Yellow', count: 13, interval: 1.5, types: ['Lancer', 'Warrior', 'Archer', 'Monk'] },
    { name: 'Bayangan di dermaga', color: 'Black', count: 16, interval: 1.35, types: ['Warrior', 'Lancer', 'Archer', 'Monk'] },
    { name: 'Pertahanan terakhir', color: 'Black', count: 20, interval: 1.1, types: ['Warrior', 'Lancer', 'Archer', 'Monk', 'Pawn'] },
  ];
config.waveStyles = [
    {name:'Barisan pelindung',hint:'Penombak menahan depan. Cari celah menuju pemanah.',bias:'Lancer'},
    {name:'Sayap pemanah',hint:'Pemanah mengambil sayap. Gunakan penghalang untuk mendekat.',bias:'Archer'},
    {name:'Serbuan bergerak',hint:'Ksatria menekan cepat. Sisakan ruang untuk menghindar.',bias:'Warrior'},
  ];
config.SWING = Object.freeze({ start:.16, end:.28, angle:1.3, reach:76, radius:18, cap:3 });
config.TRIPLE_SLASH = {unlockRank:10,slashes:3,duration:.9,cooldown:8,damageScale:1,targetCap:5,maxTurnRadians:Math.PI/6};
config.HERO_ATTACK = Object.freeze({ duration:.42, cooldown:.58, moveScale:.55 });
config.approachOffsets = Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}));
config.FIXED_STEP = 1 / 60;
config.difficulties = {
    easy:{name:'Santai',hp:.75,damage:.7,speed:.9,interval:1.15,bossHp:480,warning:1.1,score:.8,note:'Musuh lebih ringan. Ruang untuk belajar dash dan meracik upgrade.'},
    normal:{name:'Normal',hp:1,damage:1,speed:1,interval:1,bossHp:650,warning:.9,score:1,note:'Pertahanan seimbang. Keputusan pasukan dan timing menentukan.'},
    hard:{name:'Sulit',hp:1.2,damage:1.25,speed:1.08,interval:.82,bossHp:850,warning:.75,score:1.4,note:'Musuh lebih tangguh, cepat, dan rapat. Maksimalkan elak sempurna.'},
  };
config.bossRecoveryTimes = {easy:{slam:1.3,charge:1.3,volley:1.15},normal:{slam:1.1,charge:1.15,volley:1},hard:{slam:1,charge:1.05,volley:.9}};
config.MAX_UPGRADE_LEVEL = 25;
config.UPGRADE_RANK_STEP = 20;
config.UPGRADE_TIERS = [
  {id:'tier-1',number:1,name:'I',cap:10,requiredRank:0,requiredBossId:null,cost:0},
  {id:'tier-2',number:2,name:'II',cap:20,requiredRank:10,requiredBossId:'boss-chapter-1',cost:500},
  {id:'tier-3',number:3,name:'III',cap:25,requiredRank:20,requiredBossId:'boss-chapter-2',cost:1500}
];
config.upgrades = [
    {id:'blade',name:'Bilah Bara',group:'PEDANG',icon:'⚔',cost:45,description:'Damage utama +5/+2/+1 dan sekunder +3/+1/+0,5 per rank pada Tier I/II/III.'},
    {id:'rhythm',name:'Ritme Tempur',group:'PEDANG',icon:'✦',cost:40,description:'Jeda pedang berkurang bertahap; minimum 0,30 detik agar seluruh kontak selesai.'},
    {id:'wind',name:'Jejak Angin',group:'KELINCAHAN',icon:'➶',cost:35,description:'Stat dash dasar dibatasi aman; tahap skill mengikuti rank 10/20/25.'},
    {id:'counter',name:'Balasan Embun',group:'KELINCAHAN',icon:'◇',cost:35,description:'Bonus balasan memakai diminishing returns; waktu simpan maksimum 4 detik.'},
    {id:'bastion',name:'Benteng Hidup',group:'PERTAHANAN',icon:'♜',cost:40,description:'HP kastel +80/+40/+20 per rank Tier I/II/III. Perlindungan memakai persentase terbatas.'},
    {id:'oath',name:'Sumpah Penjaga',group:'PERTAHANAN',icon:'♡',cost:40,description:'HP +15/+8/+4 per rank Tier I/II/III; bekal dan Monk tumbuh lebih perlahan.'},
  ];
config.upgradeBuffs = {
    blade:['Sapuan mengenai hingga 4 musuh.','Sapuan mengenai hingga 5 musuh.'],
    rhythm:['Kecepatan gerak saat mengayun naik menjadi 65%.','Kecepatan gerak saat mengayun naik menjadi 75%.'],
    wind:['Kebal selama 0,18 detik awal dash.','Kebal selama seluruh 0,20 detik dash.'],
    counter:['Bonus damage balasan tambahan +8.','Bonus damage balasan tambahan menjadi +16.'],
    bastion:['Damage ke kastel berkurang 20%.','Damage ke kastel berkurang 40%.'],
    oath:['Jeda penggunaan bekal menjadi 1,5 detik.','Jeda penggunaan bekal menjadi 1,2 detik.']
  };
config.UNIT_FRAME_BUDGET = 12*1024*1024;
config.badgeOffsets = [[0,0],[-58,15],[58,15],[0,115],[-75,45],[75,45]];
config.threatOffsets = [[0,0],[-22,-10],[22,-10],[-36,-29],[36,-29],[0,-44],[-55,-4],[55,-4]];
config.numberOffsets = [[0,0],[-30,-16],[30,-16],[-55,-32],[55,-32],[0,-50],[-80,-10],[80,-10]];
config.footOffsets = Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*23,Math.sin(i*Math.PI/4)*23]);
config.combatSounds = {hit:[280,90,'square',.08],miss:[190,100,'triangle',.08],hurt:[150,75,'triangle',.12],dodge:[880,1320,'sine',.18],slam:[150,65,'sawtooth',.22],charge:[240,480,'triangle',.18],volley:[720,540,'sine',.18]};
config.combatSamples = {hit:['impactMetal_light_000.ogg','impactMetal_light_001.ogg'],miss:['knifeSlice.ogg','knifeSlice2.ogg'],hurt:['impactSoft_medium_000.ogg'],dodge:['cloth1.ogg','cloth2.ogg'],slam:['impactMetal_heavy_000.ogg'],charge:['drawKnife1.ogg'],volley:['metalClick.ogg'],bow:['cloth2.ogg'],wood:['chop.ogg'],stone:['impactMetal_light_000.ogg'],heal:['handleCoins.ogg']};
  // Gathering amounts used by the economy and mining UI.
  config.GATHERING_REWARDS = {wood: 8, gold: 10000, food: 1};
  M.config = freeze(config);
})(window.PenjagaModules = window.PenjagaModules || {});
