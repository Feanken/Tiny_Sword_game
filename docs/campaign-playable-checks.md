# Kampanye playable — Tahap 7

Branch codex/campaign-playable, worktree terpisah dari main. Baseline bersama
Chat 2 adalah bd56f28: main 29350d7 + Tier 25 4bf682f + Skills bf9e8be.
Core playable: 283e45d. Acuan desain dan ekonomi tetap dokumen pada repository.

## Audit dan integrasi Tahap 5–6

Main belum berisi transaksi Tahap 5 atau skill Tahap 6. Kedua branch digabung dahulu.
Konflik diselesaikan dengan getter base stats Tahap 5, lalu hook efek sementara
Tahap 6. DR akhir dibulatkan sesudah aura; cap gabungan tetap 35%. Dash memakai
charge Tahap 6, bukan clamp mirror cooldown legacy pada transaksi Wind. Rank
berhasil dibeli/restore menghitung base HP lalu syncSkillRanks secara idempotent.

Fixture lama disesuaikan dengan damage skill stage3 110%, token counter sebenarnya
dan cap pemulihan pasif; assertion cap normal menjadi 25 dengan Tier I tetap10.
Input dan modul skill tidak ditulis ulang dalam implementasi kampanye. Perubahan
di berkas tersebut pada diff terhadap main berasal dari merge Tahap 6.

Renderer game normal masih menganggap world.rows satu pulau, sedangkan preview
sudah memakai union lantai. Terrain world v2 kini memakai MapPreviewRenderer
yang sama. Aktivasi World membangun ulang lantai, terrain dan scenery aktif
serta cache navigasi. Seluruh aset wilayah dimuat sebelum game siap, sehingga
membuka jembatan tidak membutuhkan jaringan atau reload.

## Perilaku yang dipasang

Mulai Ekspedisi membuat satu runtime/world campaign-islands untuk dawn-campaign.
Benteng tetap di pulau utama; tidak ada pergantian arena atau teleport antarbab.

| Bab | Wave | Jalur | Boss dan tekanan Normal |
| --- | --- | --- | --- |
| chapter-1 | c1-w1…c1-w5 | Barat | Panglima Barat,650 HP, bias slam; pengali reguler HP/damage/speed 1/1/1 |
| chapter-2 | c2-w1…c2-w5 | Barat+utara | Panglima Utara,950 HP, bias volley; 1,25/1,10/1,03 |
| chapter-3 | c3-w1…c3-w5 | Barat+utara+barat daya | Panglima Tiga Arus,1350 HP, bias charge; 1,45/1,20/1,06 |

Archetype, aset, telegraph, enrage dan tiga pola boss existing dipakai ulang.
Bias memberi +2 pada pemilihan pola, bukan menghapus pola lain. Warning boss
Normal berturut-turut0,9/0,855/0,81 detik; recovery Bab3 ×0,95 tetap floor0,85.
Difficulty masih memakai pengali existing. Parameter berada di src/campaign-data.js.

Jatah reguler per bab tetap7/10/13/16/20, total66 dan satu boss. Scheduler menargetkan
waktu tiba pada ujung entry path/gate pertahanan, lalu menghitung keberangkatan
setiap slot dari kecepatan jenis unit dan lane. Arah baru diperkenalkan satu paket
lebih dahulu; wave awal bergantian, lalu dua arah berpasangan. Bab3 wave3 memakai
pasangan; wave4–5 memakai tiga arah. Gap target6,5/7/8 detik sesuai pola.
Paket boleh berangkat dalam urutan berbeda agar tiba serentak; tidak menambah unit.

Peringatan DOM memakai label arah dan lead5 detik sebelum target gate. Ia tetap
terlihat tanpa menggambar gate di kamera. Layar desktop pendek memakai posisi
fixed di atas viewport; ukuran biasa memakai overlay arena. Atlas preview tetap
tersedia dari menu dan preview-map.html. URL lama ?map=crossroads membuka persiapan
kampanye Bab1, tidak memberi jalan pintas unlock.

Wave selesai hanya bila prefix/cursor sesuai, seluruh event scheduler diluncurkan,
jumlah spawn tepat, musuh hidup nol dan kedua pembela hidup. Wave5 juga memerlukan
boss bab yang benar sudah mati. Boss mati ketika pasukan masih tersisa belum memberi
bukti tier atau reward boss. Receipt run/chapter/wave/attempt mengunci hasil;
callback berulang/stale tidak memberi hadiah maupun skor ulang.

## Ekonomi dan carry

Harga rank/unlock tetap Tahap5. Model A campaign-economy dipakai untuk bounty dan
reward, tanpa menggandakan bonus boss menjadi bounty langsung.

| Bab | Gold wave | Bounty reguler | Boss | Chapter tambahan | Total pasti |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 2750 | 66×10 | 500 | 0 | 3910 |
| 2 | 5500 | 66×15 | 1000 | 0 | 7490 |
| 3 | 9000 | 66×20 | 1500 | 0 | 11820 |

Total terjamin23.300 termasuk80 awal. Wave juga +15 kayu/+1 bekal/+25 HP penjaga,
sesuai parameter eksplisit. Pasif dasar +4 emas/+3 kayu per6 detik dibatasi50 tick
per bab, sesuai model ekonomi. Loot existing tetap opsional dan bukan total pasti.

Wallet, rank, pembayaran tier, HP aktual dan semua sekutu hidup tetap. Siklus
rekrut tidak direset; satu Archer gratis hanya di awal kampanye. Posisi aktor valid
dipertahankan. Serangan, pekerjaan dan reservasi dibersihkan ketika bab selesai;
charge/cooldown bertahan dan membeku pada review. Efek zona/rhythm/counter aktif
diakhiri melalui hook Tahap6. Tidak ada isi ulang skill gratis pada boundary.

Pemulihan masuk Bab2/Bab3: tambahan50 HP hero dan140 HP benteng, dibatasi max HP;
sekutu tidak dipulihkan. Ini menggantikan full heal arena lama. Wave5 tetap memberi
25 HP wave, sehingga tambahan hero maksimum pada boundary75. Pemulihan hanya
diterapkan sekali. Review terbuka setelah wilayah dibuka; pemain menekan mulai
persiapan, lalu boleh U untuk camp. Penempaan upgrade tersedia setelah tombol persiapan; panel tambang mengikuti modul Chat2.
Persiapan bab22/30/36 detik, jeda wave15 detik.

Perbandingan survivor-carry: dokumen ekonomi memperkirakan fokus pasukan dengan
empat korban/bab membutuhkan25 rekrut berbayar senilai1090, dibanding45 rekrut
senilai1965 pada reset arena; penghematan875. Tahap6 memilih cap12 pada rank25,
bukan14 pada usulan awal, sehingga angka875 hanya pembanding anggaran, bukan
hasil simulasi branch ini. Bot tanpa korban memakai tiga rekrut berbayar total135;
reset empat unit tiap bab akan membutuhkan405, selisih270 sebelum faktor lain.

Nilai pengguna config.GATHERING_REWARDS.gold tetap **10000**. Default memakai
profil testing dengan override manual10000; ?economy=standard menghasilkan override
null. Transaksi/kuota/build/produksi tambang sepenuhnya milik src/mines.js Chat 2.
Runtime menyediakan port dan boundary/tick/interaksi, tanpa tambang alternatif.
Jika modul belum terpasang, mining campaign tidak menghasilkan emas palsu/fallback.
Pengujian Normal di bawah tidak menggunakan tambang.

## Pengujian

Semua hasil otomatis, bukan playtest manusia. Chrome headless pada Windows,
Node24. Browser membuka index.html normal melalui HTTP dan file://.

| Perintah | Hasil |
| --- | --- |
| node tests/campaign-playable-test.mjs | 1258 checks lulus; dua kampanye lengkap dengan fixture lethal damage, loss tiap bab, bukti boss/tier, ekonomi pasti, reset, duplikasi dan port mines |
| node tests/campaign-arrivals-test.mjs | 321.232 checks;270 traversal lulus |
| node tests/campaign-playable-browser-test.mjs --screenshots artifacts/campaign-playable | 111 checks HTTP/file://; menu/dialog/keyboard, mouse world,15 wave fixture, review/carry, unlock, warning3arah, restart |
| node tests/menu-browser-test.mjs | Alias suite menu kampanye di atas, lulus |
| node tests/camera-test.cjs | Lulus |
| node tests/mouse-combat-test.mjs | 823 checks lulus |
| node tests/triple-slash-test.mjs | 80 checks lulus |
| node tests/upgrade-tiers-test.mjs | 2695 checks lulus setelah penyelarasan Tahap6 |
| node tests/upgrade-skills-test.mjs | 232 checks lulus |
| node tests/upgrade-tiers-browser-test.mjs | 771 checks HTTP/file:// lulus |
| node tests/upgrade-skills-browser-test.mjs | HTTP/file://;rank9/10/19/20/24/25,8arah,4desktop,pause/reset lulus |
| node tests/mouse-combat-browser-test.mjs | HTTP/file:// lulus |
| node tests/mouse-combat-visual-browser-test.mjs | 3viewport;49.578 sampel/viewport lulus |
| node tests/triple-slash-visual-browser-test.mjs | 3viewport;44.817 sampel/viewport lulus |
| node tests/map-preview-browser-test.mjs | File/HTTP;3viewport dan jembatan dua arah tetap lulus |

Suite combat/visual/tier browser lama kini secara eksplisit memasang fixture pulau
asli melalui hook DevTools; bukan jalur menu produksi. Ini mempertahankan scene
cover/air/koordinat untuk regresi. Suite campaign-playable-browser menguji map
kampanye nyata dari Mulai Ekspedisi. Suite menu lama dua-arena digantikan suite
menu kampanye; tidak ada klaim bahwa ekspedisi dua-arena masih menjadi alur produk.

Traversal menguji Warrior/Lancer/Archer/Pawn/Monk, lane−2/0/2, wave1/3/5 pada
semua kondisi wilayah yang terbuka. Isolasi memakai kecepatan Normal Bab1 sebagai
acuan geometri; pengali bab diuji oleh kampanye penuh. Setiap langkah memeriksa
posisi dan segmen legal, termasuk belokan. Jadwal diuji untuk jumlah/keunikan slot,
jalur aktif, pengenalan arah baru, pasangan dan target tiga arah serentak.

| Entry path | Sampel | Waktu ke gate (detik) | Deviasi absolut terbesar dari estimasi |
| --- | ---: | --- | ---: |
| Barat | 135 | 5,633–9,217 | 0,085 |
| Utara | 90 | 8,983–14,533 | 0,042 |
| Barat daya | 45 | 11,967–19,250 | 0,135 |

Angka rute adalah unit terisolasi, bukan jaminan tanpa antrean saat perang. Geometri
jembatan existing tidak diubah. Rebuild membuka wilayah pada boundary dan menghapus
rute/reservasi melalui listener World yang sama.

## Pertandingan statistik Normal

Perintah: node tests/campaign-normal-playtest.mjs 723.
Hasil mentah: artifacts/campaign-playable/normal-seed-723.json.

Bot memakai AI, navigation, collision, combat, boss dan transaksi normal pada
60Hz. Tidak ada forced kill, tambahan saldo/HP, penghapusan cooldown, mining atau
percepatan timer persiapan. Input mouse/gerak disimulasikan bot; rendering dan audio
diganti stub pada run ini. Ini berbeda dari fixture15wave yang mematikan musuh
dengan damage besar untuk memeriksa protokol.

- Menang15 wave,201 kill (198 reguler+3 boss),879,77 detik aktif ≈14m40s.
- Bab2 mulai persiapan253,73s; Bab3 556,15s. Review dilanjutkan bot segera.
- Rank akhir blade25/rhythm5/wind3/counter0/bastion25/oath10.
- Empat sekutu hidup, tiga rekrut berbayar sepanjang run; bekal digunakan0,
  perbaikan0. Gold akhir4453, kayu976, bekal18.
- Boss Bab1/2/3 sempat memulai2/2/3 pola. Seed ini belum menunjukkan seluruh
  repertoar boss awal sebelum mati.
- p95 simulasi headless3,538ms pada host ini; bukan pengukuran frame browser/render.

## Batas dan handoff

Pacing manusia, berbagai build/seed/difficulty dan antrean perang ramai belum
tercakup oleh satu bot. Bot membaca telegraph dengan presisi dan menghindar otomatis;
hasil tanpa korban/kehabisan bekal tidak berarti kampanye manusia sudah seimbang.
Boss awal yang hanya sempat dua pola dan cadangan emas survivor perlu ditinjau
pada playtest manusia sebelum menaikkan tekanan atau mengubah ekonomi.

Layar desktop pendek masih dapat menggulir halaman; warning dijaga tetap terlihat.
Touch bukan fokus Tahap7. Save/load, retry checkpoint dan pemulihan timer skill
dari save belum dibuat. Refresh/restart memulai seluruh kampanye dari Bab1.

src/mines.js tetap pekerjaan paralel Chat2, bukan kode yang disalin dari worktree
belum di-commit. Port diuji dengan spy, boolean receipt dan tanpa double award.
Pasang classic script tambang sebelum runtime.js saat modul itu digabung, lalu
jalankan regresi integrasi tambang pada kedua profil. Format runId string opaque
serta chapter-1/2/3 tertulis di campaign-runtime-interface.md; chapter ID tidak berubah.
