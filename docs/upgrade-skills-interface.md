# Tahap 6 — kontrak perilaku skill desktop

Baseline `main@29350d7` (Tahap 4). Audit mencakup `combat`, `triple-slash`, `input`, `simulation`, `upgrading`, `ai`, `economy`, `session`, kontrak bidikan/Triple Slash, dan `campaign-economy.md`. Kontrak Tahap 5 diperiksa dari `codex/upgrade-tiers@4bf682f` tanpa mengambil transaksi atau UI perkemahannya. Game normal tetap `MAX_UPGRADE_LEVEL=10`. Rank 11–25 hanya ada dalam fixture tes.

## Kepemilikan dan pemasangan

- Chat 1: harga, transaksi, tier/boss, stat dasar, `applyBaseStats`, perkemahan.
- Tahap 6: `src/skill-config.js` (parameter beku), `src/upgrade-skills.js` (state dan perilaku), `src/skill-visual.js`, `skill-hud.css`, hook combat/simulasi/HUD. Tidak mengubah `game.js`, `config.js`, atau `upgrading.js`.
- Classic scripts: muat `skill-config.js` dan `upgrade-skills.js` sebelum `session.js`; `skill-visual.js` sebelum `renderer.js`; stylesheet setelah `triple-slash.css`. Tanpa fetch/import/build, HTTP dan `file://` tetap tersedia. Preview atlas hanya membutuhkan dua modul pertama untuk factory session.
- `installCombat(ports)` memasang Triple Slash lalu Upgrade Skills. Port `combat` tetap dialokasikan sebelum installer agar referensi siklik aman.
- `session.ranks` satu-satunya sumber rank. ID: `blade`, `rhythm`, `wind`, `counter`, `bastion`, `oath`. Stage: `<10=0`, `10–19=1`, `20–24=2`, `25=3` (rank valid disediakan transaksi).
- Setelah pembelian/perubahan rank, panggil `combat.syncSkillRanks()` sekali setelah base stats. Metode idempotent; tick/permintaan dash juga memanggilnya. Perubahan kapasitas 1→3 hanya menambah dua charge baru sekali. Tidak mengisi ulang charge pada pembukaan menu atau menghitung ulang stat.

## API runtime

| API | Kontrak |
|---|---|
| `combat.updateSkillState(dt)` | Sekali pada awal langkah simulasi aktif; dt detik, fixed step 1/60. Tick charge/irama/counter/zona/R. Tidak dipanggil dari render atau update UI. |
| `combat.updateDash(dt)` | Sekali sesudah timer hero dan sebelum gerak biasa. Mengembalikan apakah gerak dash mengambil frame; tidak bergerak saat pause/dead. |
| `combat.requestDash()` / `requestOath()` | Boolean sukses. R tidak dibuffer; Shift buffer 0,12 detik hanya jika hampir siap. |
| `combat.attackCooldown()` | Gabungkan cooldown dasar pemilik stat dengan Irama; floor `max(.30, SWING.end+FIXED_STEP)`. Gunakan untuk serangan/HUD. |
| `combat.allyCapacity(base=8)` | `base + [0,2,4,4][stage(bastion)]`; rekrut menghitung unit hidup dan tetap memotong biaya normal. |
| `combat.restorePassiveHp(unit, amount)` | Mengembalikan heal aktual. Dipakai zona, Monk sekutu, pemulihan dekat benteng. Menolak unit mati; cap hero bersama saat Oath terbuka. Bekal terpisah. |
| `combat.applySkillResistance(unit, amount, original)` | Setelah perlindungan dasar. Aura hidup untuk hero/sekutu dekat benteng; maksimum tambahan sampai DR total35%. Tidak mengubah benteng. |
| `combat.skillsSnapshot()` / `dashSnapshot()` | Salinan nilai untuk HUD, renderer, inspeksi; tidak mengubah timer/state. `oath.zone` disalin. |
| `combat.endUpgradeSkills(reason)` | Bersihkan efek sementara, counter, zona, dash/trail pada death/finish. Tidak mereset cooldown. |

State berada di `session.hero.skills.upgrade`; Triple Slash tetap di `skills.tripleSlash`. `resetSkills`/`resetForRun` membuat state baru, tidak mengubah objek global atau memasang multiplier permanen. Rank dan emas dibawa ekspedisi seperti sebelumnya; cooldown, stacks, charge, zona dan counter **tidak dibawa antar-arena** (keputusan prototipe). Arena baru mengisi kapasitas dash dari rank yang dibawa pada sync pertama. Tidak ada save/sequence kampanye baru.

`hero.dashCooldown` dan `hero.riposte` hanya proyeksi kompatibilitas. Menulisnya tidak memberikan charge atau token. Hapus decrement dash/riposte lama dari loop simulasi; jangan panggil `upgrading.dashCooldown()` atau `dashImmunity()` untuk perilaku aktif. Chat 1 perlu menghapus clamp mirror dash lama dari transaksi Wind dan menyelaraskan teks milestone perkemahan (khususnya iframe lama0,20→0,16). Pembelian normal/emas/boss gate tetap milik Chat 1.

## Parameter prototipe

| Skill | Rank10–19 | Rank20–24 | Rank25 |
|---|---|---|---|
| Triple Slash / Q | 3 kontak, 100%, CD8s | 105%, CD7s | 110%, CD6s |
| Irama Baja / pasif | +2% speed/lapis, tahan3s | +2,5%, tahan4s | +3%, tahan5s |
| Tiga Bayang / Shift | 3 charge, serial2,4s | serial2,2s | serial2s |
| Pembaca Celah / pasif | Bonus dasar counter, refund0,5s | bonus×1,10 saat recovery, refund0,75s | bonus×1,20 saat recovery, refund1s |
| Panji Garnisun / pasif | +2 slot, total10 | +4 slot, total12 | total12 + aura20%, radius160 |
| Sumpah Penjaga / R | radius110,4HP/s,4s | radius125,5HP/s,5s | radius140,6HP/s,6s |

Ketentuan bersama:

- Irama maksimum5 lapis. Hit hero yang benar-benar mengurangi HP musuh menambah satu lapis (termasuk tiap target Triple Slash). Setelah hold berakhir, hilang satu lapis per0,6s; hit baru memperbarui hold. Tidak memberi stagger immunity atau cooldown aktif seperti usulan ekonomi lama. Rumus cooldown `max(.30, contactEnd+fixedStep, base/(1+bonus))`. Membuka menu tidak menambah lapis.
- Dash: durasi0,20s, kecepatan720, iframe0,16s, interval start≥0,60s, tanpa kill/refund charge. Sebelum Wind10, dash dasar tetap satu charge dengan recharge rank0–9 dari rumus lama; tiga-charge skill terkunci. Collision tetap melalui `navigation.move`.
- Perfect dodge hanya dihitung sekali per dash dan bila tidak dilindungi invuln sesudah terkena hit. Counter baru aktif rank10. Satu token, simpan4s, dikonsumsi pada hit valid pertama; bonus pada komponen counter saja. Tidak dapat disimpan tanpa batas dengan memulai combo sebelum expiry. Combo yang meleset tidak menghabiskannya. Refund hanya Q/R, ICD3s; token dodge baru tidak mereset ICD. Marker diamond menunjukkan musuh recovery ketika Counter terbuka. Boss memakai recovery yang sudah ada; reguler memakai `attack>0 && !strike`.
- Triple tetap tiga kontak selama0,9s, cap5 sasaran/kontak, origin kaki hidup, sudut strike immutable, koreksi maksimal30° antartebasan. Stage/scale/cooldown dicatat saat cast; base damage diambil melalui getter dasar. Bonus counter maksimum sekali per combo. Damage `round(primaryDamage*scale)+counter` sebelum modifier boss. Dash/hit/death membatalkan sisa kontak tanpa refund CD.
- Aura hanya hero/sekutu hidup dalam160 dari benteng hidup. DR aura20% dengan plafon gabungan35%; benteng tidak mendapat aura. Untuk kompatibilitas sebelum Tahap5, perlindungan dasar yang sudah lebih kuat tidak diturunkan oleh hook ini.
- Oath CD18s sejak cast, satu zona tetap pada posisi cast, radius world yang sama dengan indikator tanah. Tidak menyembuhkan musuh, unit mati atau benteng. Hero passive heal dari zona+Monk+prepare dibatasi4% maxHP aktual per rolling1s saat Oath terbuka; bekal H bukan pasif. Sekutu tidak memakai cap hero. Zona hilang pada death/finish; pause membekukan zona dan cooldown.

## Titik merge Tahap 5

`primaryDamage()`, `secondaryDamage()`, `swingMoveScale()` dan `monkHealing()` memakai getter baru jika ada, fallback ke baseline bila belum. Saat menyelesaikan konflik base defense pada `combat.hurt`, pertahankan hitung DR/stat dasar milik Tahap5 dan panggil `applySkillResistance` **sesudahnya**, membawa damage masuk sebelum base DR sebagai argumen `original`. Pertahankan `restorePassiveHp` pada Monk dan prepare; food tetap memakai getter dasar Tahap5 serta jalur konsumsi normal.

Jangan menerapkan persentase aura dua kali (misalnya memasukkannya ke resolver dan hook combat). Jangan memasukkan kecepatan Irama ke base stat permanen; `combat.attackCooldown` sudah menggabungkannya. Sinkronkan garrison cap jika Tahap5 menambah getter kapasitas dasar. Camp UI harus menjelaskan skill pasif dan R, namun berkas camp/transaksi sengaja tidak disentuh di branch ini.

```js
// Seusai transaksi rank/restore yang berhasil, dengan urutan ini:
upgrading.applyBaseStats();
combat.syncSkillRanks();
// Tick active: updateSkillState → timer hero → updateDash → gerak/swing → AI.
// Reset arena: resetForRun → terapkan carry → syncSkillRanks.
```

Checkpoint Tahap7 belum ditentukan untuk timer skill. Jangan memakai `resetSkills()` untuk sekadar menutup menu atau menerapkan ulang stat. Jika restore di tengah arena diperlukan nanti, tetapkan kebijakan cooldown/charge secara eksplisit terlebih dahulu; kontrak carry lama hanya meresetnya saat arena baru.

## Batas keseimbangan yang perlu playtest

Cooldown dasar usulan Tahap5 r10=.319/r20=.305/r25=.300 membuat lima lapis Irama mencapai floor .30 (bonus efektif maksimum≈6,3%/1,7%/0%). Di rank25, peningkatan attack speed tidak mempercepat kontak lagi. Ini keputusan menjaga kontak lengkap, bukan klaim pasif sudah seimbang; tuning berikutnya perlu memberi ruang pada cooldown dasar atau mengubah manfaat pasif bersama pemilik stat. Tidak menurunkan floor diam-diam.

Dengan DR dasar hero Tahap5 yang sudah35% pada rank25, aura tidak menambah perlindungan hero melewati plafon itu; sekutu tetap memperoleh20%. Tinjau kegunaan aura hero bersama pemilik stat saat playtest tanpa menambahkan multiplier permanen kedua.

Fixture rank25 di baseline memakai rumus dasar lama; damage/HP/DR tinggi pada fixture bukan keseimbangan kampanye final. Aura dan bonus temporer diuji terpisah dari rumus dasar baru. Tambang10.000 emas/aksi, harga upgrade dan hadiah gelombang belum diubah. Biaya penuh dengan Archer awal gratis: cap8=310, cap10=390, cap12=485 emas; total bila semua unit dibeli:350/430/525 emas. Tidak ada unit gratis dari skill.

## Verifikasi

Jalankan `node tests/upgrade-skills-test.mjs`, `node tests/mouse-combat-test.mjs`, dan `node tests/triple-slash-test.mjs`. Fixture mencakup batas rank9/10/19/20/24/25, kontak, expiry, serial recharge, pause, death/restart, kombinasi, cap dan biaya, serta benchmark real AI/navigation21 musuh dengan8/12 sekutu. Browser: `node tests/upgrade-skills-browser-test.mjs --screenshots artifacts/upgrade-skills` (Chrome desktop). Hasil dan batas pengukuran dicatat di `upgrade-skills-checks.md`.
