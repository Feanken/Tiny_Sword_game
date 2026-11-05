# Campaign runtime dan port tambang — Tahap 7/8

Baseline bersama: main 29350d7 + Tahap 5 4bf682f + Tahap 6 bf9e8be.
Branch codex/campaign-playable menggabungkan ketiganya sebelum implementasi campaign.
ID kampanye dawn-campaign, map campaign-islands; chapter-1/chapter-2/chapter-3; wave c1-w1 sampai
c3-w5; boss-chapter-1/2/3. Tidak ada perubahan ID dari campaign-contract.md.

## Pemilik dan pemasangan

Campaign/director/lifecycle/menu/reward/HUD bab milik Chat 1.
Chat 2 memiliki src/mines.js, transaksi, stage operasi, kuota dan produksi tambang.
Tidak ada implementasi tambang kedua pada campaign.

Classic script src/mines.js dapat dimuat sebelum runtime.js.
Gunakan M.installMines(ports) mengikuti pola installer existing. runtime.mines
dialokasikan sebelum installer lain, dan installer mines dipanggil setelah campaign
serta economy; panggilan lifecycle baru berlangsung setelah semua installer selesai.
Jika modul belum tersedia, port kosong tidak memberi hasil/produksi emas pada campaign.

Port yang dipanggil integrator:

- mines.reset(): run baru/title; idempotent, hapus state operasi milik run lama.
- mines.enterChapter({runId,chapterId}): setelah topologi/progres bab siap.
  runId adalah string opaque per run, chapterId string di atas. Ini menyelaraskan
  kontrak campaign-contract.md; jangan mengubah runId menjadi angka.
  Panggilan ulang pasangan yang sama tidak mereset kuota/tick atau memberi bonus.
- mines.update(dt): tepat satu kali per fixed step aktif; tidak pada pause/dialog,
  transisi bab, kalah, menang atau menu. dt detik.
- mines.interact(mineId): setelah kerja E selesai 0,9 detik melalui economy.updateWork.
  mineId adalah ID node, bukan mine-operation. Module melakukan transaksi dan
  validasi aktif/kuota; boolean sukses. Module tidak perlu menambah timer kerja kedua.
- mines.purchaseNextLevel(): tombol pembangunan camp; module memvalidasi camp,
  bukti boss, stage dan saldo. Seluruh harga/penolakan milik module.
- mines.snapshot(): data salinan untuk inspeksi/checkpoint berikutnya.

Node ID dari world.allCollections.goldNodes/objectIds.goldNodes tetap gold-01,
gold-02, gold-03, gold-north-01, gold-southwest-01; gunakan node.id jika ada.
world.isObjectActive(id) dan world.goldNodes menyediakan node terbuka saat ini.

## Progres dan ekonomi

runtime.campaign.snapshot() menyediakan runId, status, chapterId, chapterIndex,
waveId, clearedWaveIds, bossVictories, economyProfileId, miningOverrideGold.
campaign.hasBossVictory(bossId) hanya true sesudah wave boss benar-benar selesai
dengan semua musuh habis dan kedua pembela hidup. UpgradeProgress.bindSource
menghubungkan source ini; tambang boleh memakai campaign.hasBossVictory.

config.GATHERING_REWARDS.gold = 10000 dipertahankan sebagai override testing.
Campaign profile standar tidak mengubah nilai itu. Baca campaign.miningRewardOverride():
angka 10000 pada profil testing default, null pada profil standar.
URL ?economy=standard memilih standar untuk playtest; selain itu testing.
Override hanya mengganti hasil manual yang sah, bukan melewati kuota atau biaya.

Stat, charge dan skill Tahap 5–6 sudah digabung. Antar-bab memakai satu World/session:
wallet, rank, paidTierUnlocks, HP aktual dan sekutu hidup tetap. Tidak memanggil
resetForRun/resetSkills atau merekrut Archer gratis lagi. Transisi membekukan tick;
cooldown/charge bertahan, efek serangan/zona sementara dihentikan saat bab selesai.
Pemulihan eksplisit dan hadiah bab diterapkan sekali pada boundary.

Tahap 7 tidak membuat save/load. Snapshot di atas adalah port, bukan save terverifikasi.
