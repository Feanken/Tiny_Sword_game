# Upgrade tiers dan base stats — API Tahap 5

Baseline main: `29350d7`. Branch: `codex/upgrade-tiers`.
ID tetap blade/rhythm/wind/counter/bastion/oath; rank tetap session.ranks.
Chat 1 memiliki transaksi, progres, base stats dan camp. Chat 2 memiliki perilaku
skill, charge/recharge dash, cooldown skill, efek sementara dan kapasitas garnisun.

## Data dan sumber progres

- session.paidTierUnlocks: record enam ID → array [] / ['tier-2'] /
  ['tier-2','tier-3']. Tidak diturunkan dari rank atau kemenangan boss.
- session.upgradeProgress: {bossVictories:string[]}, sumber lokal default.
- session.progressSource: null atau {hasBossVictory(bossId):boolean}, referensi
  runtime controller kampanye. Tidak termasuk snapshot.
- M.UpgradeProgress.hasBossVictory(session,id), recordBossVictory(session,id),
  bindSource(session,source), snapshot(session), restore(session,snapshot).
- Boss ID: boss-chapter-1, boss-chapter-2, boss-chapter-3. recordBossVictory
  hanya untuk default source/fixture, idempotent dan tidak memberi emas/tier.
  Bila source eksternal terpasang, source tersebut menjadi satu-satunya pembaca
  bukti; record lokal ditolak. Tahap 7 memvalidasi receipt kemenangan sebelum
  merekamnya atau menyediakan hasBossVictory. Arena island/crossroads lama tidak
  dipalsukan menjadi chapter campaign.
- Reset/title/run baru membersihkan rank, pembayaran dan source. Tahap 7 harus
  memasang kembali source untuk run baru/restore. Kegagalan transaksi tidak
  mengubah saldo, rank, pembayaran, HP atau bukti boss.

## Quote dan transaksi

config.UPGRADE_TIERS menyimpan cap 10/20/25, prerequisite rank 10/20, boss Bab 1/2
dan biaya 500/1500. Harga rank model A: harga dasar jalur + 20×(targetRank−1).
Biaya buka tidak mencakup rank berikutnya; dibayar per jalur sekali.

- M.UpgradeProgress.quoteRank(session,id,{campOpen}), quoteTier(session,id,tierId,{campOpen}):
  data murni {allowed,reason,cost,...}; tidak menulis state.
- upgrading.quoteRank(id), quoteTier(id,tierId): memakai konteks camp aktual.
- upgrading.buyUpgrade(id), unlockTier(id,tierId): boolean, validasi lengkap sebelum
  commit. Hanya prepare saat playing atau paused oleh camp yang terbuka.
- upgrading.viewUpgrade(id): rank, tier terbayar, cap, tahap skill dan quote aksi
  berikutnya untuk label/disabled/alasan camp. UI tidak menghitung harga sendiri.
- M.UpgradeProgress.skillStage(rank), upgrading.skillStage(id): 0 sebelum 10,
  1 pada 10–19, 2 pada 20–24, 3 pada 25. Ini berbeda dari milestone bonus 5/10.
- upgrading.milestone(id) tetap bonus existing, dibatasi maksimum 2.

Tier II memerlukan Tier I, rank 10, boss-chapter-1 dan 500 emas. Tier III
memerlukan pembayaran Tier II, rank 20, boss-chapter-2 dan 1500 emas.
Pembayaran tetap sah setelah dibeli; source tidak boleh mencabut pembayaran.
Quote baru tetap memeriksa bukti untuk pembukaan tier berikutnya. Carry/restore
memuat bukti dan pembayaran secara eksplisit, tidak menebaknya dari rank.

## Resolver stat dasar

M.BaseStats.resolve(ranks) adalah fungsi murni; upgrading.stats() membacanya.
Gunakan a=min(r,10), b=min(max(r−10,0),10), c=min(max(r−20,0),5).

| Field / adapter upgrading | Rumus prototipe |
| --- | --- |
| primaryDamage / primaryDamage() | 27+5a+2b+c pada blade |
| secondaryDamage / secondaryDamage() | round(18+3a+b+0.5c) pada blade |
| heroMaxHp, castleMaxHp | 100+15a+8b+4c pada oath; 500+80a+40b+20c pada bastion |
| attackCooldown / attackCooldown() | max(0.30,0.58×(1−0.06min(r,5)−0.03min(max(r−5,0),5))−0.0014b−0.001c) |
| swingCap / swingCap() | 3+min(2,floor(blade/5)) |
| swingMoveScale / swingMoveScale() | 0.55+0.10min(2,floor(rhythm/5)); base maksimum 0.75 |
| heroDamageReduction / heroDamageReduction() | min(0.35,0.02a+0.01b+0.01c) pada bastion |
| castleDamageReduction / castleDamageReduction() | min(0.50,0.04a+0.005(b+c)) |
| fortressRadius / fortressRadius() | min(360,160+20a) |
| counterBonus / counterBonus() | 12+6a+2b+c+8min(2,floor(r/5)) |
| counterWindow / counterWindow() | min(4,2+0.2r) detik |
| foodHealing / foodHealing() | 45+5a+2b+c pada oath |
| foodCooldown / foodCooldown() | maksimum pengurangan milestone 5/10, minimum 1.2 detik |
| monkHealing / monkHealing() | 16+2a+0.5b+0.2c untuk Monk sekutu ke hero |

upgrading.applyBaseStats() menghitung max HP dari rank dan membatasi HP aktual
tanpa full heal. Pembelian oath/bastion memulihkan hanya delta max HP rank baru.
Recompute tidak menumpuk buff. Carry arena existing masih full heal, memakai rumus
yang sama. Diminishing returns ini memang mengubah defense/counter window rank 1–10.

clampMoveScale(value), clampHeroDamageReduction(value), clampCastleDamageReduction(value)
menyediakan batas total 0.85 / 0.35 / 0.50 untuk integrasi efek Chat 2.
Recovery basic boleh kembali ke gerak normal setelah contact berakhir.
Damage dibulatkan sesudah DR dan tetap minimum satu; pukulan normal/boss yang
besar tidak runtuh menjadi satu damage karena rank tinggi.

Adapter dashCooldown()/dashImmunity() hanya fallback legacy yang dibatasi pada
kontribusi rank 10 (minimum 0.75 detik, maksimum 0.20 detik). Ini bukan recharge
skill atau implementasi charge baru. Chat 2 mengganti perilaku skill secara
terpisah; branch ini tidak mengedit input, renderer atau modul skill.

## Load order, fixture, dan batas integrasi

Classic script: config.js → base-stats.js → upgrade-progress.js → expedition.js
→ session/runtime existing. Tambahkan kedua dependency pada fixture yang memakai
upgrading atau carry. GameSession menyimpan data biasa, tanpa dependency DOM.

Fixture tes tests/fixtures/upgrade-progress.js menyediakan bukti boss secara
eksplisit untuk camp normal. Fixture tidak dimuat index.html dan bukan tombol
cheat pada produk. Tidak ada integrasi boss kampanye sebelum Tahap 7.
Stat/transaction quote tidak menghitung stage skill lewat flag bayar; rank
menjadi satu-satunya sumber tahap skill. Aggregate heal cap dan efek skill tetap
menjadi pekerjaan Chat 2. Mining testing tetap mengikuti konfigurasi existing.
