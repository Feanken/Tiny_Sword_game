# Operasi tambang — Tahap 8

Baseline bersama Chat1: `bd56f28` (main29350d7 + Tahap5 4bf682f + Tahap6 bf9e8be). Branch `codex/campaign-mines`. Kontrak runtime juga diperiksa terhadap campaign Chat1 `283e45d`. Semua implementasi tahap ini berada di berkas baru; file gameplay bersama belum dipasang ulang.

## Parameter dan audit

Audit membaca campaign-economy/design/contract, hasil Tahap5–6 dan campaign-runtime-interface. Baseline masih memakai mining testing10.000, kerja0,9 detik dan gap0,18. Skill/dash membatalkan pekerjaan melalui mekanik existing. Tier/rank/stat/camp tetap dimiliki Chat1. Tidak ada transaksi upgrade skill atau rekrutmen baru.

| Operasi | Syarat pembelian | Harga | Manual standar | Tambahan pasif |
|---|---|---:|---:|---:|
| rock / Batu emas | Awal Bab1 | 0 | 25 | 0 |
| outpost / Pos tambang kecil | Masuk Bab2+, bukti boss Bab1 | 150 | 35 | +6/6 detik |
| mine-house / Rumah tambang | Pos dimiliki, masuk Bab3, bukti boss Bab2 | 250 | 45 | +16/6 detik |

Total pembangunan400 emas. Maksimum20 aksi **seluruh operasi per bab**, bukan per node. Alokasi Bab1:7/7/6 pada gold-01/02/03; Bab2:5/5/4/6 dengan gold-north-01; Bab3:4/4/4/4/4 dengan gold-southwest-01. Kuota tidak bertumpuk antarbab. Maksimum manual standar500/700/900 (2.100 sepanjang kampanye). Produksi tambahan maksimum50 tick/bab:300 untuk pos dan800 untuk rumah bila dibeli sejak awal. Produksi penduduk tetap +4 emas/+3 kayu per6 detik melalui pemilik campaign.

Profil `standard` memakai25/35/45. Profil `user-testing` mengganti **manual saja** dengan nilai eksplisit dari `campaign.miningRewardOverride()`, saat ini10.000. Harga, kuota dan pasif tetap. Installer memilih standard jika accessor mengembalikan null, selain itu user-testing. Profil dikunci per run; reset diperlukan untuk pergantian. `config.GATHERING_REWARDS.gold` tidak diubah. Campaign Chat1 memakai `?economy=standard` untuk standar, testing sebagai default.

## Port

`M.installMines(runtime)` mengikuti pola installer existing. Alokasikan `runtime.mines={}` lebih dahulu; pasang setelah campaign/economy dan sebelum lifecycle dipanggil. Installer tidak memajukan campaign atau merekam kemenangan boss.

| Metode runtime.mines | Hasil dan perilaku |
|---|---|
| `enterChapter({runId,chapterId})` | Receipt `{ok,reason,refilled,goldDelta:0}`. Memeriksa identitas terhadap campaign.snapshot. Bab harus berurutan dan node/topologi sudah aktif. RunId opaque string atau integer, jangan diurai. |
| `update(dt)` | Receipt dengan ticks/goldDelta. Tepat sekali per fixed step aktif, dt detik ≤0,1; delta besar/offline ditolak. |
| `interact(mineId)` | **Boolean**, dipanggil saat pekerjaan E0,9 detik selesai. Memeriksa aktif, HP, jarak≤88, aksi combat, gap, node/kuota dan wallet sebelum memotong satu charge serta memberi emas secara atomik. Tidak membuat timer kerja kedua. |
| `purchaseNextLevel()` | **Boolean**. Memeriksa fase persiapan/review, sumber bukti boss, tahap dan saldo; langsung mengubah bangunan. Tidak mengisi kuota atau mereset fase produksi. |
| `snapshot()` | Salinan data JSON versi1, atau null sebelum run aktif. Tanpa DOM, aktor atau jam dinding. |
| `reset()` | Idempotent; menghapus state operasi/pembelian/ledger/kuota/timer, tanpa mengubah wallet yang dimiliki campaign. |

Tambahan: `status(mineId)` memberikan label/yield/quota/quote pembelian yang berasal dari state aktual; `nodes()` sumber identitas/posisi; `lastReceipt()` detail transaksi terakhir; `panel.open()` membuka panel terpisah; `dispose()` membersihkan panel, listener dan wrapper saat runtime dibuang.

Factory headless `M.createMines({session,world,profile,testingYield,isActive,canPurchase,hasBossVictory})` menyediakan engine yang sama. **Factory mengembalikan receipt pada interact/purchase**, sedangkan installer mengadaptasinya ke boolean sesuai kontrak Chat1. Factory tidak menganggap bab sebagai bukti boss: callback tanpa bukti selalu menolak pembelian. Fixture bab memasok bukti simulasi secara eksplisit.

Pasangan run/bab yang sama tidak mengubah ledger, timer, sisa charge, pembelian atau saldo. Bab lama ditolak, run berbeda membutuhkan reset. Node terkunci tidak mendapat charge sampai babnya aktif. Snapshot menyimpan stageId, profile/override, run/bab, purchases, ledger semua bab (alokasi/sisa/actions/manualGold/passiveGold/ticks/elapsed), dan cooldown gathering. Wallet disimpan terpisah oleh campaign. Restore/save belum diimplementasikan; tidak ada timestamp untuk pendapatan offline.

## Installer dan patch untuk Chat1

Setelah cherry-pick commit tambang, terapkan **patch review terpisah** `patches/campaign-mines.patch`, ditujukan ke `283e45d`. Patch telah lulus `git apply --check` pada checkout Chat1, tanpa diterapkan di sana. Patch hanya:

1. Memuat mines.css serta empat classic scripts sebelum runtime.js.
2. Memakai `M.prepareMineMap(map)` sebelum World dibuat untuk map campaign-islands.
3. Mengambil petunjuk E/yield/kuota dari `mines.status(id)` dan menyaring node habis dari nearestResource.

```powershell
git apply --check patches/campaign-mines.patch
git apply patches/campaign-mines.patch
```

Runtime Chat1 sudah mengalokasikan port, memanggil installMines, enterChapter, reset, update sekali per langkah, serta interact setelah kerja selesai. Pertahankan panggilan itu. **Jangan menambah reward manual lagi** setelah interact; installer sudah mengkreditkan wallet dan floater aktual.

Installer membungkus `economy.updatePassiveIncome`: tick dari operasi menjadi satu jam6 detik dan memanggil `campaign.passiveTick()` sekali per tick. Callback itu tetap pemilik hadiah penduduk. Clock penduduk lama dilewati hanya ketika operasi campaign aktif; non-campaign menggunakan jalur legacy. Jangan memanggil passiveTick kedua kalinya dari update mines. Pending tick dikonsumsi sekali, cap50 diselaraskan, epoch baru meresetnya sekali. Snapshot diambil sesudah langkah simulasi lengkap.

Installer juga memasang panel/tombol **M**, preload seluruh art sebelum preload dasar, hook scenery, dan pembaruan UI. Ia mengembalikan fase pemilik ketika panel ditutup; chapter-review tetap review. Camp placeholder `mineUpgradeButton` Chat1 bisa diarahkan ke `mines.panel.open()` agar biaya/syarat terlihat dalam panel ini. Hindari dua dialog terbuka bersamaan. Saat mengganti runtime, panggil `mines.dispose()` sebelum membuang input/runtime lama; reset/title tidak menghitung ulang produksi.

## Tapak dan visual

`prepareMineMap` membuat salinan definisi, mengubah radius node gold-01 dan collider sumber yang sama menjadi36. Identitas/posisi node dipertahankan. Plot maksimum dicadangkan sejak batu; upgrade tidak mengubah navigasi/topologi, mendorong aktor atau menutup jembatan mendadak. Pasang sebelum World/navigation dibuat; jangan sekadar menggambar rumah di atas collider batu lama13.

Art memakai Tiny Swords asli: Gold Stone1, Blue House1 (pos kecil), Blue House2 (rumah), gold resource dan tool. Batu ditampilkan dari area isi sprite yang memiliki gutter transparan. Ukuran pos66 dan rumah92 world pixel, sampling tajam; culling dan urutan kedalaman tetap melalui source gold-01. Node lain tetap batu dan berbagi operasi. Akses/titik mining serta kedua jembatan diuji pada plot ini. Perubahan layout map berikutnya perlu mengulang tes collision.

## Mencoba

Buka `mines-preview.html` langsung lewat file:// atau HTTP. Fixture bawaan **standar**, mulai80 emas. Tahan E di node, berjalan dengan WASD/panah, M membuka panel, P menjeda. Tombol Bab2/3 mensimulasikan progres berurutan dan membuka wilayah; tidak memberi emas atau bangunan gratis. Dropdown node menyediakan titik mining aman. Dropdown profil memulai fixture baru dan menampilkan override testing secara jelas. Halaman fixture tidak dimuat game normal dan tidak menjalankan15 gelombang.

Tes: `node tests/mines-test.mjs`; `node tests/mines-browser-test.mjs --screenshots artifacts/mines`. Hasil: [mines-checks.md](mines-checks.md).
