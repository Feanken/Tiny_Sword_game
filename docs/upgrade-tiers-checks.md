# Tahap 5 — audit, tuning, dan verifikasi upgrade

Baseline main 29350d7, branch codex/upgrade-tiers, worktree terpisah.
Acuan campaign-design.md, campaign-contract.md dan campaign-economy.md pada main.
Kontrak API ditulis/di-commit sebelum implementasi: 9e6e453.

## Audit dan keputusan

Baseline menyimpan enam rank pada GameSession dengan batas 10. Harga rank dan
efek bercampur pada upgrading/combat/economy/AI; camp menganggap selalu membeli rank.
Carry hanya menyalin rank dan menghitung HP secara linear. Tidak ada sumber bukti
boss bab atau ledger pembayaran tier. Kampanye tiga bab belum menjadi entry point.

Memperpanjang rumus lama langsung sampai 25 membuat cooldown pedang 0,058 detik,
lebih pendek daripada kontak 0,16–0,28; cooldown dash menjadi negatif. Milestone
berulang setiap lima rank membuat sasaran/DR terus bertambah. DR datar penjaga
meredam hampir semua pukulan menjadi satu. Tahap ini memakai rekomendasi
diminishing returns bagian 6 campaign-economy.md.

- Harga model A dipertahankan: base jalur +20×rank yang dimiliki. Unlock terpisah
  500/1.500 per jalur, satu kali, tidak membeli rank berikutnya.
- Rank tetap session.ranks. Pembayaran disimpan di session.paidTierUnlocks; bukti
  boss dibaca melalui UpgradeProgress. Skill stage hanya dari rank 10/20/25.
- Bonus existing 5/10 dibatasi dua milestone. Tidak ada milestone tambahan 15/20/25.
- Stat dasar dihitung ulang secara murni, tidak ditambahkan kembali saat restore.
  Oath/Bastion yang dibeli memulihkan hanya delta max HP; carry arena tetap full heal.
- Cooldown pedang minimum 0,30 detik. Gerak dasar saat kontak maksimum 75%;
  helper batas total gerak saat kontak 85% disediakan untuk efek Chat 2.
- DR penjaga diganti persentase, maksimum 35%. DR benteng r25 47,5%, batas total 50%.
  Radius perlindungan berhenti pada 360 px. Counter disimpan maksimum empat detik.
- Wind masih memakai adapter cooldown/kebal legacy yang dibatasi kontribusi rank 10,
  sehingga rank tinggi tidak menghasilkan cooldown negatif atau kebal tak terbatas.
  Charge/recharge dan retuning dash/skill adalah tanggung jawab Chat 2.
- Mining manual tetap **10.000**. Hadiah wave/kill, jumlah musuh, rekrut, biaya
  perbaikan dan bekal tidak diubah. Paket hadiah kampanye belum diterapkan.

| Nilai dasar | r10 | r20 | r25 |
| --- | ---: | ---: | ---: |
| Damage utama / sekunder | 77 / 48 | 97 / 58 | 102 / 61 |
| Cooldown serangan | 0,319 | 0,305 | 0,300 |
| HP penjaga / benteng | 250 / 1300 | 330 / 1700 | 350 / 1800 |
| DR penjaga / benteng | 20% / 40% | 30% / 45% | 35% / 47,5% |
| Bekal / Monk ke penjaga | 95 / 36 | 115 / 41 | 120 / 42 |

Kenaikan stat dan perubahan DR/counter window termasuk retuning pada rank 1–10,
bukan klaim kesetaraan numerik penuh dengan baseline. Damage, cleave dan bonus
counter rank 0–10 tetap cocok dengan tes sebelumnya. Pada r25, contoh pukulan 24
menjadi 16 ke penjaga dalam aura; pukulan 13/24 ke benteng menjadi 7/13.

## Struktur dan integrasi

| Modul | Tanggung jawab |
| --- | --- |
| src/config.js | Enam harga dasar, kenaikan rank, definisi cap/prasyarat/biaya tier |
| src/upgrade-progress.js | Resolver bukti boss, quote murni, validasi snapshot/restore dan skill stage |
| src/base-stats.js | Semua rumus stat dasar dari rank, tanpa DOM/skill state |
| src/upgrading.js | Transaksi rank/unlock, adapter stat, penerapan HP dan feedback |
| src/session.js, src/lifecycle.js | Kepemilikan/reset pembayaran dan source, recompute saat mulai/carry |
| src/expedition.js, game.js | Carry eksplisit bukti/pembayaran/rank; validasi sebelum arena maju |
| src/ui.js, layout.css, index.html | Camp rank/tier/cap/skill stage/harga/alasan; dependency classic script |
| src/combat.js, src/economy.js, src/ai.js | Wiring rumus lama ke resolver stat dasar |

Input, renderer, Triple Slash, modul visual dan tuning skill tidak diedit. Wiring
stat di combat/AI mungkin menyentuh baris yang digunakan Chat 2 saat integrasi;
gunakan adapter upgrading.* untuk scalar, lalu terapkan perilaku skill di modul
pemiliknya. Detail helper dan source ada di upgrade-tiers-interface.md.

## Hasil pengujian otomatis

Semua perintah dijalankan dari root worktree dengan Node 24 dan Chrome headless
pada Windows. Browser membuka index.html sebenarnya. Runtime hook hanya untuk
fixture saldo, boss receipt, waktu simulasi dan kondisi deterministik.

| Perintah | Hasil |
| --- | --- |
| node tests/upgrade-tiers-test.mjs | 2.687 checks lulus |
| node tests/upgrade-tiers-browser-test.mjs | 779 checks lulus, HTTP dan file:// |
| node tests/mouse-combat-test.mjs | 823 checks lulus |
| node tests/triple-slash-test.mjs | 80 checks lulus |
| node tests/camera-test.cjs | Lulus |
| node tests/campaign-map-test.mjs | 1.929 checks; 422 traversal lulus |
| node tests/mouse-combat-browser-test.mjs | HTTP DPR2 dan file:// DPR1 lulus |
| node tests/menu-browser-test.mjs | Keyboard, touch, touch-small, touch-landscape lulus |
| node tests/mouse-combat-visual-browser-test.mjs | Tiga viewport/DPR; 49.578 sampel raster/kontak per viewport lulus |
| node tests/triple-slash-visual-browser-test.mjs | Tiga viewport/DPR; 44.817 sampel efek/kontak per viewport lulus |

Tes baru membeli keenam jalur melalui transaksi nyata, mengecek rank
9/10/11/19/20/21/24/25, saldo pas/kurang satu pada seluruh rank dan kedua tier,
prasyarat rank/boss, larangan lompat tier, pembayaran berulang, pemisahan per jalur,
penolakan atomik, tahap skill, konteks camp, source eksternal dan reset.
Snapshot valid/invalid dan carry tidak menebak flag dari rank.

Simulasi menahan Spasi selama 30 detik pada rhythm/blade 11/15/20/25 memakai
Simulation.update asli pada 60 Hz, AI musuh dibekukan untuk sasaran deterministik.
Setiap strike mencapai akhir kontak dan mengenai sasaran satu kali, tanpa
preemption cooldown. Skill existing pada rank 25 menerima tiga damage dasar 102
dan counter 113 hanya sekali. Pengurangan damage, radius, benteng mati, pemulihan
bekal, cast Monk serta mining 10.000 diuji melalui kode runtime nyata.

Browser membeli semua jalur sampai 25 dengan klik camp dan fixture bukti boss.
Pembayaran tidak mengubah rank/tahap skill. Handoff island → crossroads membawa
rank 25, kedua pembayaran dan bukti boss, dengan HP dari resolver. Keyboard Enter,
semua enam kartu dan tombol kembali/siap terjangkau pada 1440×900, 1024×600
dan 960×480. Menu utama/run baru membersihkan semua progres.

Tes lama hanya diadaptasi untuk load dua dependency baru, assertion cap 25 dengan
Tier I tetap 10, serta fixture heal memakai HP sah 50/100 setelah recompute.
Assertion perilaku hit, collision, arah, counter, combo dan reset tetap dijalankan.

## Batas yang tersisa

Belum ada playtest manusia untuk pacing build 25 atau pertandingan kampanye.
Kemampuan membeli dalam arena lama tidak mewakili ekonomi 15 wave, terutama
selama mining testing 10.000 masih aktif. Nilai tabel adalah prototipe.

Kemenangan arena lama tidak dianggap kemenangan boss bab. Bukti tahap ini berasal
dari fixture eksplisit; Tahap 7 harus menyediakan source dari prefix wave/receipt
yang sah, menggabungkan snapshot dengan checkpoint dan wallet, dan memvalidasinya
saat restore. Tidak ada penyimpanan progres antar-refresh pada tahap ini.

Efek skill tahap 2/3, charge dash, temporary buff, kapasitas garnisun dan batas
gabungan healing tetap menunggu branch Chat 2. Pengujian skill di sini adalah
regresi implementasi Tahap 4, bukan verifikasi fitur skill paralel yang belum digabung.
