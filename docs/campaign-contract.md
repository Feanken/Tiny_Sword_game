# Kontrak data kampanye — versi rancangan 1

Dokumen pasangan [campaign-design.md](campaign-design.md) ini mengacu pada audit `6312d36`. Tipe dan contoh berikut adalah kontrak untuk tahap implementasi. Registry campaign, map v2, profile ekonomi, skill, mine, dan checkpoint belum diimplementasikan oleh Tahap 1.

## 1. Konvensi dan pemilik data

- Definisi dimuat dengan classic script lokal. Gunakan registry seperti `window.PenjagaCampaigns` dan `window.PenjagaMaps` sehingga HTTP dan `file://` tetap didukung. Hindari fetch untuk membaca JSON konfigurasi.
- Semua definisi dan snapshot harus JSON-compatible. Fungsi, DOM, Map, Set, referensi aktor dan cache hanya berada pada runtime.
- ID adalah string stabil dan case-sensitive. Array yang mempunyai urutan gameplay tidak boleh disortir saat serialize.
- Authoring menggunakan world pixel, kecuali `maskRows` yang menggunakan indeks tile. Waktu simulasi memakai detik. Biaya, resource dan charge memakai bilangan bulat aman.
- UI memakai nomor bab/wave mulai dari 1. Runtime lama boleh mengadaptasi wave lokal menjadi indeks 0–4. Save menyimpan ID, lalu menurunkan indeks dari definisi.
- Definisi campaign/profile immutable. GameSession memiliki wallet, ranks, aktor, cooldown dan state tambang. Campaign memiliki progres wave. World memiliki geometri dan topologi aktif. Checkpoint menyalin data yang diperlukan dari para pemilik tersebut.

### ID yang dibekukan

| Jenis | ID |
| --- | --- |
| Kampanye dan map baru | `dawn-campaign`, `campaign-islands` |
| Bab | `chapter-1`, `chapter-2`, `chapter-3` |
| Wave | `c1-w1` sampai `c1-w5`, `c2-w1` sampai `c2-w5`, `c3-w1` sampai `c3-w5` |
| Pulau | `island-main`, `island-north`, `island-southwest` |
| Jembatan | `bridge-north`, `bridge-southwest` |
| Jalur | `path-west`, `path-north`, `path-southwest` |
| Gate | `gate-west`, `gate-north`, `gate-southwest` |
| Titik jaga | `guard-castle`, `guard-west`, `guard-north`, `guard-southwest` |
| Benteng | `blue-fortress`, dengan object sumber `building-01` |
| Upgrade, memakai ID existing | `blade`, `rhythm`, `wind`, `counter`, `bastion`, `oath` |
| Tier | `tier-1`, `tier-2`, `tier-3` |
| Skill existing | `dash`, `riposte` |
| Tambang | `gold-01`, `gold-02`, `gold-03`, `gold-north-01`, `gold-southwest-01` |
| Operasi tambang | `mine-operation`; stage `rock`, `outpost`, `mine-house` |
| Definisi boss | `boss-chapter-1`, `boss-chapter-2`, `boss-chapter-3` |

ID lama `island` dan `crossroads` tetap dikenal oleh adapter migrasi. Jalur `path-west` dan `path-north` dipakai kembali pada map kampanye. Campaign menu tidak menjadikan dua map lama sebagai dua bab terpisah.

## 2. Parameter bernama untuk Chat 2

```ts
type Wallet = { gold: number; wood: number; food: number };
type ParamRef<T> = { $param: string }; // T menjelaskan tipe nilai yang diharapkan.
type ParameterProfile = {
  id: string;
  version: number;
  values: Record<string, unknown>;
};
```

`$param` menunjuk satu key persis pada registry nilai. Resolver tidak menjalankan ekspresi JavaScript atau interpolasi string. Profile yang terpilih harus lengkap sebelum kampanye dimulai. Ref yang belum terisi menghasilkan error konfigurasi yang menyebut key tersebut, bukan angka nol atau fallback tersembunyi.

| Key / pola key | Tipe nilai | Pemakai |
| --- | --- | --- |
| `economy.startingResources` | Wallet | Kampanye baru |
| `economy.waveReward.<waveId>` | Wallet | Satu reward untuk wave yang selesai |
| `economy.bossReward.<bossId>` | Wallet | Satu reward untuk boss yang selesai |
| `economy.chapterReward.<chapterId>` | Wallet | Satu reward untuk bab yang selesai |
| `economy.chapterRecovery.<chapterId>` | `{heroHp:number,castleHp:number}`, jumlah tambahan, dibatasi max HP | Masuk bab tersebut. Bab 1 memakai kondisi awal |
| `economy.upgradeCost.<upgradeId>` | Array progression.maxRank Wallet, indeks targetRank−1 | Pembelian setiap rank |
| `progression.maxRank`, `progression.tierCap.tier-1`, `progression.tierCap.tier-2`, `progression.tierCap.tier-3` | Integer, cap meningkat, cap akhir sama dengan maxRank | Pembatas tier |
| `economy.tierUnlock.<upgradeId>.<tierId>` | Wallet | Unlock per jalur; profile tanpa biaya mengisi Wallet nol eksplisit |
| `progression.skillStages.<skillId>` | Array rank pemicu yang meningkat | Tahap skill dari rank |
| `economy.skillUnlock.<skillId>` | Wallet | Skill berjenis purchase bila kelak ditambahkan |
| `economy.mineCharges.<mineId>` | Record chapterId → integer charge | Alokasi tambang per bab |
| `economy.mineManualBudget.<operationId>` | Record chapterId → integer charge | Jumlah kuota operasi, harus sama dengan total alokasi node aktif |
| `economy.recruitCost.<kind>` | Wallet | Archer, Lancer, Monk, Warrior |
| `economy.castleRepairCost`, `economy.heroMealCost` | Wallet | Perbaikan dan makan |
| `economy.gatherYield.wood`, `economy.gatherYield.food` | Integer resource per pekerjaan selesai | Sumber daya existing selain tambang emas |
| `economy.enemyLoot.<kind>` | `{goldWeight:number,woodWeight:number,value:number,lifeSeconds:number}` | Loot musuh existing; label dan pickup memakai value yang sama |
| `economy.killReward.<chapterId>.<kind>` | Wallet | Bounty langsung musuh biasa; terpisah dari pickup |
| `economy.waveRecovery.<waveId>` | `{heroHp:number,castleHp:number}` | Pemulihan sesudah wave; terpisah dari pemulihan masuk bab |
| `economy.castleRepairHp`, `economy.heroMealHpByRank` | Integer HP / array maxRank+1 integer HP untuk rank oath 0–maxRank | Besar pemulihan aktual dan label |
| `economy.maxAllies` | Integer positif | Kapasitas dasar; adapter skill garnisun menurunkan cap efektif |
| `economy.passiveReward` | Wallet | Penduduk |
| `economy.passivePeriodSeconds` | Angka positif dalam detik | Periode penduduk selama dunia berjalan |
| `timing.chapterPreparationSeconds.<chapterId>`, `timing.wavePreparationSeconds` | Angka positif dalam detik | Persiapan bab dan antar-wave |
| `timing.mineHarvestSeconds`, `timing.mineHarvestGapSeconds` | Angka positif / nonnegatif dalam detik | Pekerjaan menambang |
| `timing.arrivals.<waveId>` | ArrivalProfile, didefinisikan di bagian 5 | Penjadwalan kedatangan dan warning |
| `combat.wave.<waveId>` | WaveCombatProfile | Jumlah biasa, komposisi dan pengali stat |
| `combat.boss.<bossId>` | BossCombatProfile | Archetype dan tuning boss |
| `combat.skill.<skillId>` | Skill tuning sesuai adapter combat, termasuk tahap/charge bila ada | Kemampuan existing dan skill yang disepakati |
| `economy.mineBuildCost.<operationId>.<stageId>` | Wallet | Pembangunan/upgrade operasi |
| `economy.mineYieldByStage.<operationId>`, `economy.mineProductionByStage.<operationId>` | Record stageId → integer emas / Wallet per tick | Yield manual dan produksi operasi |
| `economy.productionTickLimit.<chapterId>` | Integer nonnegatif | Budget tick produksi per bab |

Placeholder `<...>` di tabel adalah notasi dokumentasi. Definisi authoring menyimpan key penuh, misalnya `economy.waveReward.c2-w1`. Profile dapat dihasilkan Chat 2 dari spreadsheet/perhitungan, lalu diubah menjadi classic script lokal.

Wallet tidak menerima nilai negatif, NaN, Infinity, pecahan atau string angka. Jumlah hadiah dan harga ditentukan Chat 2. Urutan reward adalah wave, boss, lalu chapter. Subtransaksi memakai key deterministik dari run/wave dan jenis reward, lalu dikomit bersama clearedWaveIds. Prefix wave tetap menjadi satu-satunya ledger persisten. Jika satu profile memasukkan hadiah boss ke hadiah chapter, komponen yang lain harus berupa Wallet nol secara eksplisit agar tidak terjadi hadiah ganda.

Baseline saat ini mempunyai mining 10000 dan sejumlah biaya/reward inline. Tahap implementasi memindahkan sumber angka ke profile secara eksplisit. Nilai baseline tersebut tidak otomatis menjadi default kampanye, dan perubahan profile tidak dilakukan dalam dokumen ini.

Chat 2 cf5d9bc memakai nama ref draft untuk yield per node, tetapi rekomendasinya mempunyai yield menurut tingkat operasi bersama. Kontrak ini memakai `economy.mineYieldByStage.<operationId>` sebagai sumber tunggal. Profile ekonomi perlu mengekspor bentuk itu, `progression.maxRank`, biaya unlock per jalur, serta array rank sepanjang maksimum yang disepakati. Tabel ekonomi bukan file konfigurasi yang dapat langsung dimuat.

Bounty langsung memakai `economy.killReward.<chapterId>.<kind>` sekali per aktor biasa yang mati pada attempt aktif. Boss tidak menerima bounty biasa di samping `economy.bossReward.<bossId>`. Loot pickup tetap terpisah. Reward boss dibukukan pada penyelesaian wave, bukan saat boss mati sementara wave masih berlangsung.

## 3. Campaign dan progres

```ts
type UpgradeId = 'blade' | 'rhythm' | 'wind' | 'counter' | 'bastion' | 'oath';
type ChapterId = 'chapter-1' | 'chapter-2' | 'chapter-3';
type WaveId = string;
type RegionId = string;
type Difficulty = 'easy' | 'normal' | 'hard';
type Phase = 'chapter-review' | 'chapter-prepare' | 'wave-prepare' |
  'battle' | 'paused' | 'lost' | 'campaign-complete';

type ChapterDefinition = {
  id: ChapterId;
  waveIds: WaveId[];                 // Tepat lima, urutan tetap.
  openRegionIds: RegionId[];         // Daftar kumulatif, termasuk bridge.
  activePathIds: string[];
  availableTierId: 'tier-1' | 'tier-2' | 'tier-3';
  bossId: string;
  bossPathId: string;
  chapterReward: ParamRef<Wallet>;
  recovery: ParamRef<{heroHp:number; castleHp:number}>;
};
type CampaignDefinition = {
  version: 1;
  id: 'dawn-campaign';
  mapId: 'campaign-islands';
  mapVersion: 2;
  parameterProfileId: string;
  startingResources: ParamRef<Wallet>;
  chapters: ChapterDefinition[];     // Tepat tiga.
};
type CampaignProgress = {
  runId: string;
  seed: number;                     // uint32
  difficulty: Difficulty;
  clearedWaveIds: WaveId[];          // Prefix urutan 15 wave, tanpa duplikasi.
  cursor: {chapterId:ChapterId; waveId:WaveId} | null;
  status: 'active' | 'lost' | 'completed';
};
```

`Phase` milik campaign berbeda dari `session.state` dan `session.phase` lama. Adapter mengizinkan tick dunia hanya pada chapter-prepare, wave-prepare dan battle; dua fase prepare dipetakan ke mekanika prepare existing. Paused menyimpan fase asal di memori dan kembali ke fase itu saat resume. Dialog camp menyimpan fase asal juga. Load memulihkan fase dari boundary dan prepare.kind, tanpa menyimpan status DOM atau dialog.

Contoh definisi chapter menunjukkan unlock kumulatif. Dua chapter lainnya memakai bentuk yang sama.

```json
{
  "id": "chapter-2",
  "waveIds": ["c2-w1", "c2-w2", "c2-w3", "c2-w4", "c2-w5"],
  "openRegionIds": ["island-main", "island-north", "bridge-north"],
  "activePathIds": ["path-west", "path-north"],
  "availableTierId": "tier-2",
  "bossId": "boss-chapter-2",
  "bossPathId": "path-north",
  "chapterReward": {"$param": "economy.chapterReward.chapter-2"},
  "recovery": {"$param": "economy.chapterRecovery.chapter-2"}
}
```

Bab 1 membuka `island-main`, memakai `path-west` dan `tier-1`. Bab 3 membuka ketiga pulau beserta kedua bridge, memakai ketiga jalur dan `tier-3`. Usulan jalur boss per bab adalah barat, utara, lalu barat daya sehingga wilayah baru diperkenalkan melalui jalurnya. Seluruh path boss wajib aktif pada bab tersebut.

`clearedWaveIds` adalah sumber fakta keberhasilan dan pemberian hadiah. Bab selesai, wilayah terbuka dan tier yang tersedia untuk dibuka diturunkan dari prefix itu serta chapter yang sedang ditinjau. Unlock yang sudah dibayar per jalur disimpan tersendiri; rank saja tidak membuktikan pembayaran. Save tidak menyimpan salinan rank milestone atau flag wilayah yang bisa bertentangan.

Saat wave selesai, controller menerima receipt `{runId,chapterId,waveId,attemptId,outcome}`. Receipt diterima hanya untuk attempt aktif. Hasil kedaluwarsa atau receipt kedua dari wave yang sama tidak mengubah progres/wallet. Pada tick ketika HP penjaga atau benteng habis bersamaan dengan musuh terakhir, kekalahan diproses lebih dahulu.

Pemulihan wave memakai `economy.waveRecovery.<waveId>`. Pemulihan masuk bab memakai `chapter.recovery` milik bab tujuan, diterapkan sekali dalam transaksi unlock sebelum checkpoint review ditulis. Load review tidak menjalankannya ulang. Bab 1 memakai HP awal existing tanpa tambahan recovery.

## 4. Map, pulau, bridge dan guard point

```ts
type Point = {x:number; y:number};
type IslandRegion = {
  id: RegionId;
  kind: 'island';
  origin: Point;                    // Kelipatan tileSize.
  maskRows: Record<string, [number, number][]>;
  localBounds: {left:number; right:number; top:number; bottom:number};
};
type BridgeRegion = {
  id: RegionId;
  kind: 'bridge';
  connects: [RegionId, RegionId];
  centerline: Point[];              // Segmen horizontal/vertikal.
  width: number;
};
type GuardPoint = {
  id: string;
  regionId: RegionId;
  position: Point;
  label: string;
};
type GateDefinition = {
  id: string;
  regionId: RegionId;
  position: Point;
  guardPointId: string;
};
type CampaignMapDefinition = {
  version: 2;
  id: 'campaign-islands';
  width: number;
  height: number;
  tileSize: number;
  regions: (IslandRegion | BridgeRegion)[];
  gates: GateDefinition[];
  guardPoints: GuardPoint[];
  defaultGuardPointId: 'guard-castle';
  heroSpawn: Point;
  castle: Point;
  fortress: {id:'blue-fortress'; buildingId:'building-01'};
  objectRegions: Record<string, RegionId>;
  paths: SpawnPath[];
  enemySpawns: EnemySpawn[];
  // trees, goldNodes, sheep, buildings, rocks, bushes, villagers,
  // objectIds, roads dan obstacles mengikuti struktur yang sudah ada.
};
```

`maskRows` memakai baris dan kolom lokal terhadap origin region. Setiap baris boleh mempunyai beberapa rentang inklusif yang terurut dan tidak saling menumpuk. Mask dipotong dengan localBounds eksklusif seperti landBounds lama; pulau utama mempertahankan bounds sumber (80,1195,80,630) sebelum translasi. Query daratan menggunakan union semua island aktif dan lantai bridge aktif. Sebuah bridge aktif hanya jika tercantum di chapter dan kedua pulau ujungnya aktif.

Koordinat objek, collider, jalan, spawn dan waypoint pada hasil definisi akhir selalu global. Builder authoring menerjemahkan konten pulau utama satu kali dengan offset (+768,+640). Runtime tidak menerjemahkan ulang koordinat tersebut memakai origin region.

objectRegions menghubungkan setiap object ID sumber dengan pulau pemiliknya. Collider dan interaksi resource hanya aktif bila region pemilik terbuka. Scenery wilayah terkunci boleh dirender sebagai pratinjau gelap, tetapi tidak dapat dikumpulkan atau menjadi target. Obstacle turunan mengikuti region sourceId. Field allySpawn, allyHome, initialAllies, collision, terrainStyle dan metadata authoring existing tetap disediakan pada map v2 untuk adapter runtime.

Lantai bridge dibentuk dari union persegi panjang selebar `width` di setiap segmen dan sambungan persegi pada belokannya. Renderer dan navigasi memakai hasil geometri yang sama. Lantai bridge tidak menahan panah. Cover hanya berasal dari obstacle eksplisit. Bridge tidak memiliki HP atau biaya pembangunan pada rancangan awal, pembukaannya mengikuti kemenangan bab.

Map v1 tetap dapat dibaca melalui adapter saat migrasi. Array `rows[r] = [left,right]` lama dinormalisasi menjadi mask satu region dengan localBounds dari landBounds. Map v2 tidak bisa diberikan langsung ke validator v1.

World menyediakan port yang dibutuhkan tahap berikutnya.

```ts
interface CampaignWorldPort {
  topologyVersion: number;
  applyOpenRegions(regionIds: RegionId[]): void;
  isWalkable(x:number, y:number): boolean;
  guardPoint(id:string): GuardPoint;
  path(id:string): SpawnPath;
}
```

Perubahan topologi hanya dilakukan pada boundary bab. Navigasi menghitung ulang node/edge/component, mengosongkan reverse fields dan route aktor. Penyimpanan field rute perlu menyertakan versi topologi agar rute lama tidak dipakai setelah unlock. Footprint, seluruh rentang jitter, lane dan segmen bridge harus lolos validasi terhadap union daratan aktif.

Perintah sekutu memakai `{mode:'follow'}` atau `{mode:'guard',pointId:string}`. `guard-castle` adalah default. HUD mouse memilih titik jaga yang sudah aktif. F/G mempertahankan peran follow/guard yang ada. Ally leash, formasi dan regroup memakai anchor terpilih.

## 5. Spawn path, wave dan kedatangan

```ts
type SpawnPath = {
  id: string;
  roadId: string;
  points: Point[];
  entryLaneOffset: Point;
  exitLaneOffset: Point;
  exitRadius: number;
  gateId: string;
  requiredRegionIds: RegionId[];
  warningLabel: string;
};
type EnemySpawn = {
  id: string;
  role: 'wave' | 'boss';
  pathId: string;
  x: number; y: number;
  jitter: {x:[number,number]; y:[number,number]};
  lanes: number[];
};
type WaveCombatProfile = {
  enemyCount: number;
  rosterWeights: Record<string, number>;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
};
type BossCombatProfile = {
  archetypeId: string;
  afterSpawnFraction: number;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
};
type ArrivalProfile = {
  mode: 'staggered' | 'synchronized';
  directionCycle: string[][];        // Path ID per target kedatangan.
  packetSize: number;
  targetGapSeconds: number;
  firstDepartureSeconds: number;
  warningLeadSeconds: number;
  warningTailSeconds: number;
};
type WaveDefinition = {
  id: WaveId;
  chapterId: ChapterId;
  combat: ParamRef<WaveCombatProfile>;
  arrivals: ParamRef<ArrivalProfile>;
  reward: ParamRef<Wallet>;
  boss: null | {
    id: string;
    profile: ParamRef<BossCombatProfile>;
    reward: ParamRef<Wallet>;
  };
};
```

Contoh satu wave menghindari nominal ekonomi yang belum disepakati.

```json
{
  "id": "c2-w1",
  "chapterId": "chapter-2",
  "combat": {"$param": "combat.wave.c2-w1"},
  "arrivals": {"$param": "timing.arrivals.c2-w1"},
  "reward": {"$param": "economy.waveReward.c2-w1"},
  "boss": null
}
```

Setiap chapter mempunyai tepat lima WaveDefinition. Hanya wave terakhir yang mempunyai boss dan ID-nya harus sama dengan `chapter.bossId`. `enemyCount` menghitung musuh biasa. Boss adalah satu aktor tambahan, seperti perilaku sekarang. `afterSpawnFraction` adalah nilai profile combat dalam rentang (0,1], dan tidak dipatok oleh dokumen ini.

Map menyediakan satu spawn wave dan satu spawn boss per path, dengan ID spawn unik. World mengindeksnya berdasarkan pasangan role/pathId. Boss memilih entry melalui chapter.bossPathId; aturan global satu boss spawn pada World lama harus diganti. Gate berada pada endpoint path di pulau utama; warning memakai GateDefinition, dan titik jaga harus terhubung ke gate tersebut. Lane/exit radius tetap menentukan kapan aktor menyerahkan kendali ke combat.

Rencana yang sudah dibangkitkan memakai bentuk berikut.

```ts
type PlannedDeparture = {
  id: string;
  pathId: string;
  slots: number[];                  // Indeks roster yang unik.
  arrivalAtSeconds: number;
  departAtSeconds: number;
};
type WavePlan = {
  waveId: WaveId;
  roster: string[];
  lanes: number[];
  departures: PlannedDeparture[];
};
```

Roster dan lane dibangkitkan deterministik dari seed run serta ID chapter/wave. Stream perencanaan/spawn dipisahkan dari loot/combat agar perubahan urutan keberangkatan tidak mengubah jatah roster. Pada reload wave-start, rencana dan stream dibangun dari awal dengan identitas yang sama.

Scheduler mengalokasikan setiap slot roster tepat sekali. Semua path harus aktif pada chapter dan seluruh `requiredRegionIds` terbuka. Untuk setiap target kedatangan, perkiraan travel dihitung dari path, lane, exit radius dan kecepatan roster. Keberangkatan dihitung dari target arrival dikurangi travel anggota tercepat kelompok, lalu seluruh jadwal digeser bersama agar keberangkatan paling awal memenuhi `firstDepartureSeconds`.

`staggered` memakai satu arah tiap entri cycle. `synchronized` boleh memakai dua atau tiga path dalam satu entri cycle. Sisa slot ditempatkan secara deterministik, tanpa menambah musuh agar habis dibagi jumlah arah. Boss memakai `chapter.bossPathId`, profile kecepatan sendiri dan warning arrival sendiri.

Sebelum combat AI mengambil alih, unit harus melewati waypoint berurutan dan mencapai gate di pulau utama. Mengganti chapter, pause atau membuka dialog tidak boleh memajukan jam arrival. Tampilan “perkiraan tiba” merupakan estimasi, karena stagger, collision dan intersepsi pemain dapat mengubah waktu aktual.

## 6. Upgrade dan skill

```ts
type UpgradeTier = {
  id: 'tier-1' | 'tier-2' | 'tier-3';
  availableFromChapter: ChapterId;
  maxRank: ParamRef<number>;
};
type UpgradeDefinition = {
  id: UpgradeId;
  maxRank: ParamRef<number>;
  existingMilestones: [5, 10];
  costByTargetRank: ParamRef<Wallet[]>;
  tierUnlockCosts: Record<'tier-2'|'tier-3', ParamRef<Wallet>>;
  effectAdapterId: string;
};
type SkillDefinition = {
  id: string;
  activation: {kind:'input'; controlId:string} |
    {kind:'event'; eventId:string} | {kind:'passive'};
  access: {kind:'grant'; chapterId:ChapterId} |
    {kind:'purchase'; chapterId:ChapterId; cost:ParamRef<Wallet>} |
    {kind:'rank'; upgradeId:UpgradeId; thresholds:ParamRef<number[]>};
  derivedFromUpgradeId: UpgradeId;
  tuning: ParamRef<Record<string, number>>;
  effectAdapterId: string;
};
```

Contoh menggunakan ID yang sudah ada.

```json
{
  "upgrade": {
    "id": "wind",
    "maxRank": {"$param": "progression.maxRank"},
    "existingMilestones": [5, 10],
    "costByTargetRank": {"$param": "economy.upgradeCost.wind"},
    "tierUnlockCosts": {
      "tier-2": {"$param": "economy.tierUnlock.wind.tier-2"},
      "tier-3": {"$param": "economy.tierUnlock.wind.tier-3"}
    },
    "effectAdapterId": "existing-wind"
  },
  "skill": {
    "id": "dash",
    "activation": {"kind": "input", "controlId": "dash"},
    "access": {"kind": "grant", "chapterId": "chapter-1"},
    "derivedFromUpgradeId": "wind",
    "tuning": {"$param": "combat.skill.dash"},
    "effectAdapterId": "existing-dash"
  }
}
```

`riposte` memakai event `perfect-dodge`, grant pada chapter-1, sumber upgrade `counter` dan tuning `combat.skill.riposte`. Kedua grant tersebut tidak membebankan biaya unlock. Bentuk rank mendukung konsep skill Chat 2: tahap diturunkan dari rank jalur dan `progression.skillStages.<skillId>`. Tidak ada biaya skill terpisah kecuali access.kind=purchase. Enam konsep, ID skill baru, binding dan tuning perlu difinalkan bersama sebelum menjadi konten aktif.

Stat adapter tetap menghubungkan `blade` ke damage/cleave, `rhythm` ke tempo dan gerak swing, `wind` ke dash, `counter` ke balasan, `bastion` ke benteng/proteksi, dan `oath` ke HP/pemulihan. Bonus existing rank 5/10 dihitung dari rank dan tidak otomatis diulang setiap lima rank di atas 10. Save tidak menyimpan salinan bonus aktif, tahap skill atau max HP.

Cap tier yang sudah dibuka pada jalur membatasi pembelian berikutnya. Tier I aktif sejak awal; untuk Tier II/III, chapter yang sesuai harus tersedia, rank mencapai cap tier sebelumnya, tier sebelumnya dimiliki, dan biaya unlock dibayar sekali. Wallet dan paidTierUnlocks berubah bersama; membayar unlock tidak menambah rank atau tahap skill. Restore memvalidasi urutan pembayaran dan rank terhadap cap jalur yang sah.

Validasi memerlukan 0 < cap I < cap II < cap III = progression.maxRank, dengan maxRank setidaknya 10 agar milestone existing tetap tersedia. Nilai harus berasal dari profile Chat 2. Usulan ekonomi cf5d9bc memakai 10/20/25, sedangkan runtime baseline hanya mendukung 10. Profile lebih tinggi wajib memasang adapter stat/skill yang mendukung seluruh rentang dan batas aman cooldown; validator menolak profile 25 dengan adapter legacy. Penentuan cap/retuning adalah keputusan yang masih perlu disepakati.

Transaksi pembelian menguji phase camp yang sah, akses chapter/tier, cap rank dan saldo seluruh resource sebelum mutasi. Upgrade tersedia pada review bab serta persiapan bab/wave, termasuk dialog yang mem-pause persiapan. Upgrade tetap ditolak saat battle. Wallet dan rank berubah bersama. Profile biaya yang tidak ada menghasilkan error konfigurasi. Label, tombol disable dan transaksi memakai resolver biaya yang sama.

## 7. Tambang

```ts
type MineDefinition = {
  id: string;
  sourceObjectId: string;
  regionId: RegionId;
  operationId: string;
  resource: 'gold';
  chargesByChapter: ParamRef<Record<ChapterId, number>>;
  harvestSeconds: ParamRef<number>;
  harvestGapSeconds: ParamRef<number>;
};
type MineState = {
  remainingCharges: number;
  refillEpoch: ChapterId;
};
type MineOperationDefinition = {
  id: 'mine-operation';
  initialStageId: 'rock';
  stages: {
    id: 'rock'|'outpost'|'mine-house';
    availableFromChapter: ChapterId;
    previousStageId: string|null;
    buildCost: ParamRef<Wallet>;
  }[];
  manualBudgetByChapter: ParamRef<Record<ChapterId, number>>;
  yieldByStage: ParamRef<Record<string, number>>;
  productionByStage: ParamRef<Record<string, Wallet>>;
};
type MineOperationState = {stageId:'rock'|'outpost'|'mine-house'};
```

Contoh satu tambang baru.

```json
{
  "id": "gold-north-01",
  "sourceObjectId": "gold-north-01",
  "regionId": "island-north",
  "operationId": "mine-operation",
  "resource": "gold",
  "chargesByChapter": {"$param": "economy.mineCharges.gold-north-01"},
  "harvestSeconds": {"$param": "timing.mineHarvestSeconds"},
  "harvestGapSeconds": {"$param": "timing.mineHarvestGapSeconds"}
}
```

Definisi main memakai source ID `gold-01`, `gold-02`, `gold-03` dari sidecar map saat ini. Posisi berasal dari gold node, bukan diduplikasi dalam MineDefinition.

Tahan E memulai pekerjaan bila region aktif, masih ada charge, jarak dan status aksi memenuhi aturan kerja. Pembatalan karena bergerak, menyerang, dash atau terkena hit tidak memberikan reward. Pause membekukan pekerjaan sampai resume, sedangkan aturan cancel lainnya mengikuti adapter existing. Pada selesai kerja, validasi ulang eligibility lalu kurangi satu charge dan tambah yield pada transaksi yang sama. Yield di-resolve dari operasi dan stage saat transaksi; label petunjuk dan floater memakai hasil resolver yang sama.

Refill dijalankan sekali saat memasuki bab, untuk mine dalam region yang sudah terbuka. Nilai charge diganti dengan alokasi chapter tersebut. `refillEpoch` mencegah refill kedua akibat pemanggilan transisi berulang. Mine di wilayah terkunci belum mempunyai state yang dapat dikumpulkan.

Node utama, utara dan barat daya tergabung dalam mine-operation. Total charge seluruh node aktif harus sama dengan manualBudgetByChapter, sehingga menambah node tidak menggandakan kuota. Stage operasi dibawa antarbab. Membeli outpost/mine-house memerlukan chapter yang sesuai dan stage sebelumnya, mengurangi Wallet sekali serta tidak mengisi ulang charge. Harga/yield/produksi memakai ref penuh, misalnya `economy.mineBuildCost.mine-operation.outpost` dan `economy.mineYieldByStage.mine-operation`. Tidak ada angka biaya atau yield yang ditetapkan di sini.

Produksi otomatis dibayarkan sekali per operasi pada tick ekonomi yang sama dengan penduduk, memakai `economy.passivePeriodSeconds`. Batas jumlah tick per bab berasal dari `economy.productionTickLimit.<chapterId>`, diterapkan pada penduduk dan operasi bersama agar menahan musuh tidak menghasilkan pendapatan tanpa batas. Sisa timer dan hitungan tick disimpan; ganti stage tidak me-reset keduanya. Masuk chapter baru mereset epoch/tick sekali. Review, pause dan aplikasi tertutup tidak menghasilkan tick.

Stage operasi adalah dukungan kontrak terhadap usulan Chat 2 cf5d9bc, bukan bangunan yang sudah ditambahkan pada map. UI pembelian dan visual bangunan, cap produksi, serta kebijakan refill menunggu persetujuan paket ekonomi.

## 8. Checkpoint

### Bentuk snapshot

```ts
type Boundary = 'chapter-review' | 'prepare-start' | 'wave-start' | 'campaign-complete';
type AllySnapshot = {
  entityId: string;
  kind: 'Warrior' | 'Archer' | 'Lancer' | 'Monk';
  hp: number;
  position: Point;
  formationSlot: number;
  home: Point;
  flankSign: -1 | 1;
  cooldownRemainingSeconds: number;
};
type DropSnapshot = {
  id: string;
  position: Point;
  type: 'gold' | 'wood';
  value: number;
  lifeRemainingSeconds: number;
};
type CheckpointSnapshot = {
  schemaVersion: 1;
  campaignId: 'dawn-campaign';
  campaignVersion: number;
  mapId: 'campaign-islands';
  mapVersion: 2;
  parameterProfile: {id:string; version:number};
  runId: string;
  revision: number;
  savedAt: string;                    // ISO UTC, hanya metadata.
  boundary: Boundary;
  seed: number;
  difficulty: Difficulty;
  clearedWaveIds: WaveId[];
  cursor: {chapterId:ChapterId; waveId:WaveId} | null;
  prepare: null | {kind:'chapter'|'wave'; remainingSeconds:number};
  wallet: Wallet;
  ranks: Record<UpgradeId, number>;
  paidTierUnlocks: Record<UpgradeId, ('tier-2'|'tier-3')[]>;
  hero: {hp:number; position:Point; foodCooldownSeconds:number};
  castle: {hp:number};
  allies: AllySnapshot[];
  nextAllySerial: number;
  recruitIndex: number;
  skills: Record<string, {
    cooldownRemainingSeconds:number;
    charges?: {available:number; rechargeRemainingSeconds:number; startGapRemainingSeconds:number};
  }>;
  mines: Record<string, MineState>;
  mineOperations: Record<string, MineOperationState>;
  sheep: Record<string, {position:Point; cooldownRemainingSeconds:number}>;
  drops: DropSnapshot[];
  nextDropSerial: number;
  economyTimers: {
    epoch:ChapterId; chapterTickCount:number;
    passiveElapsedSeconds:number; gatherCooldownRemainingSeconds:number;
  };
  simulationElapsedSeconds: number;
  rngStates: Record<string, number>; // State uint32 setiap stream PRNG runtime.
  squadOrder: {mode:'follow'} | {mode:'guard'; pointId:string};
  score: number;
  kills: number;
};
```

Snapshot memuat nilai runtime yang sudah resolved, bukan ParamRef atau rumus. Resource, HP, rank, pembayaran unlock, stage operasi dan charge disalin bersama. Max HP, tier yang tersedia menurut chapter, wilayah terbuka, milestone, tahap skill, jumlah wave global, geometri, nav graph dan cache diturunkan lagi dari versi definisi yang sesuai. Pembayaran unlock tidak diturunkan dari rank.

Checkpoint tidak menyimpan musuh hidup, projectile, route, target pointer, serangan tertunda atau referensi objek. Efek visual, attack buffer, pekerjaan panen parsial, dash aktif dan jendela riposte dibersihkan pada boundary. Normalisasi yang sama diterapkan pada sesi langsung sebelum snapshot dibuat, sehingga load tidak memberi hasil yang berbeda. Cooldown yang masih berjalan disimpan agar memuat ulang tidak langsung memberi dash/makanan gratis.

Drop yang belum dipungut disimpan dengan posisi, nilai dan sisa umur, bukan langsung diuangkan atau dihapus saat kemenangan. Timer income, cooldown domba dan urutan recruit juga dipulihkan; ketiganya memengaruhi ekonomi. Drop/sekutu mempunyai ID unik dalam run, dan serial generator tidak boleh dipakai ulang. PRNG harus dapat di-serialize. Stream rencana wave dibangkitkan ulang dari seed/ID, sedangkan stream loot dan runtime lain dilanjutkan dari rngStates, tanpa mengambil sampel baru saat restore.

### Kapan checkpoint dibuat dan dipakai

| Boundary | Momen tulis | Perilaku lanjut |
| --- | --- | --- |
| `chapter-review` | Kampanye baru, atau sesudah wave 5, reward dan unlock diterapkan. Pembelian panel pada review memperbarui snapshot sesudah transaksi | Kembali ke review bab yang sama. Dunia tetap beku sampai pemain mulai persiapan |
| `prepare-start` | Awal persiapan bab atau sesudah wave 1–4 selesai dan reward diterapkan | Ulang dari awal persiapan tersebut. Resource dan pembelian sesudah snapshot ikut diulang |
| `wave-start` | Persiapan berakhir, sebelum tick combat/spawn pertama | Mulai kembali wave yang sama dari t=0 dengan wallet, rank dan alokasi mine yang telah difinalkan |
| `campaign-complete` | Setelah reward terakhir dan hasil final diterapkan | Buka hasil kampanye. Cursor null, tidak menjalankan wave tambahan |

Selama persiapan yang berjalan tidak dibuat autosave per panen. Jika pemain keluar sebelum wave-start, seluruh perubahan sesudah prepare-start diulang bersama. Dengan begitu, mining atau pembelian tidak dapat digandakan dengan menggabungkan snapshot lama dan saldo baru. UI perlu menjelaskan batas penyimpanan ini.

Retry setelah kekalahan menggunakan checkpoint tersimpan terakhir. Sesi yang kalah tidak menimpa checkpoint yang masih dapat dicoba ulang. Restore mengganti state secara utuh. Ia tidak menambahkan wallet, rank atau receipt dari snapshot ke sesi yang sudah berjalan.

### Protokol transisi dan storage

1. Bekukan simulation tick pada boundary dan selesaikan satu transaksi reward/unlock di memori. Daftar wave selesai sekaligus menjadi ledger reward. Reward wave/boss/chapter diberikan pada saat wave ditandai selesai, termasuk boss yang mati sebelum musuh terakhir.
2. Untuk wave-start, simpan kondisi persiapan yang sudah final sebelum menjalankan tick pertama. Untuk pergantian bab, bangun state tujuan yang lengkap sebelum menampilkan review.
3. Bentuk candidate snapshot, validasi keseluruhan, lalu encode satu dokumen JSON.
4. Ganti satu key `penjaga-pulau-campaign-v1` melalui adapter storage. Satu blob menyatukan cursor dan wallet sehingga tidak muncul cursor baru dengan saldo lama.
5. Bila storage gagal, pertahankan sesi in-memory dan checkpoint durable sebelumnya. UI menandai penyimpanan gagal. Jangan menampilkan status “tersimpan” untuk candidate itu.
6. Saat load, parse dan validasi sebelum mengubah world/session. Setelah semua valid, terapkan active regions, bangun navigasi, buat aktor dari data, hitung stat turunan dan pulihkan boundary. Attempt combat baru mendapat token baru, dengan seed rencana wave yang sama.

`savedAt` tidak memajukan timer atau menghasilkan pendapatan saat aplikasi ditutup. LocalStorage dapat ditolak pada `file://`, sehingga adapter harus menangkap error. Skor terbaik dan pengaturan audio memakai key existing, terpisah dari checkpoint kampanye.

Asumsi MVP adalah satu slot lokal dan satu sesi penulis. Sinkronisasi cloud, save lintas perangkat dan penggabungan perubahan beberapa tab memerlukan rancangan tersendiri.

### Validasi sebelum load

- Versi schema, campaign, map dan parameter profile harus dikenali. Pergantian versi membutuhkan migrator eksplisit. Save dari versi mendatang ditolak tanpa dihapus.
- Cursor harus sesuai prefix `clearedWaveIds`. Aktif memerlukan cursor, kampanye selesai memerlukan 15 wave selesai dan cursor null. Wave yang sedang dimulai belum tercatat sebagai selesai.
- Wilayah, guard point dan mine harus sesuai chapter yang diturunkan. State mine terkunci, refill epoch masa depan dan slot formasi duplikat ditolak.
- Ranks dan paidTierUnlocks harus mempunyai tepat enam ID existing; rank berada dalam cap tier jalur yang sah. Urutan unlock, prerequisite rank dan chapter harus cocok. Milestone/max HP dihitung ulang. Stage operasi tambang harus tersedia pada chapter yang bersangkutan.
- Wallet, score, kills, charge, serial dan revision berupa integer aman nonnegatif. HP dan cooldown harus finite dan dalam rentang definisi.
- Timer passive harus berada dalam periode income, hitungan tick tidak melebihi budget, umur drop dalam lifetime profile, dan semua state PRNG berupa uint32. Skill charge/recharge valid menurut kapasitas dan aturan serial adapter. ID domba/drop harus dikenal/unik dan posisi berada pada world aktif.
- HP penjaga/benteng pada checkpoint aktif lebih dari nol. Semua posisi harus valid pada topologi hasil unlock. Posisi di water/collider ditolak dengan pesan migrasi yang jelas, bukan teleport diam-diam.
- Entity ID sekutu unik dan archetype dikenali. Batas jumlah sekutu mengikuti profile yang dipakai.
- `prepare` hanya terisi pada prepare-start dan menyatakan jenis persiapan yang benar. Boundary wave-start tidak mengembalikan waktu persiapan. Boundary terminal tidak memuat musuh atau attempt aktif.
- Blob rusak atau belum kompatibel tetap dipertahankan untuk diagnosis. Menu menawarkan mulai baru secara eksplisit, bukan menimpa otomatis.

## 9. Dependensi implementasi dan pengujian kontrak

Kontrak membagi pekerjaan menjadi empat aliran yang dapat berjalan paralel setelah ID dan boundary disepakati.

| Aliran | Hasil yang disediakan | Interface untuk aliran lain |
| --- | --- | --- |
| Map/navigation | Definisi v2, validator, query walkable dan invalidasi topologi | Region ID, Path ID, Gate ID, GuardPoint dan source mine ID |
| Ekonomi/progres — Chat 2 | Profile parameter bertipe, harga rank, yield/charge dan cap tier | ParameterProfile dengan versi serta seluruh ref wajib |
| Campaign/checkpoint | Cursor, receipt idempotent, serializer, migrator dan storage adapter | CampaignProgress, CheckpointSnapshot dan transaksi boundary |
| Desktop UI/combat integration | HUD bab/arah, camp bertier, input guard point, kamera dan skill adapter | Snapshot read-only serta command port yang memvalidasi phase |

Penerimaan kontrak mencakup unresolved ref ditolak, enam upgrade ID tidak berubah, 15 wave unik, satu boss per bab, serta jatah spawn tepat setelah dibagi ke 1/2/3 arah. Uji save harus membandingkan wallet/ranks/charge sebelum dan sesudah reload, menolak receipt ganda, dan memastikan reload wave-start memakai rencana yang sama.

Uji geometri harus memeriksa setiap status unlock, seluruh lane/jitter, lintasan jalan/dash/knockback di kedua bridge, pergerakan sekutu dan reachability ke benteng. Uji desktop memastikan HUD arah tetap terbaca ketika gate berada di luar kamera, termasuk saat tiga arah mempunyai waktu tiba bersamaan.
