# Penilaian dan bukti setelah pengembangan combat, taktik, ekspedisi, dan audio

Angka berikut adalah penilaian internal untuk lingkup game 2D sederhana ini. Tes membuktikan perilaku serta batas teknis, bukan ukuran universal kesenangan pemain.

| Bagian | Sebelum | Setelah | Perubahan dan bukti |
| --- | --- | --- | --- |
| AI musuh | 8 | 9 | Pembagian sasaran bersama, prioritas perlindungan pendukung, penghindaran panah yang terlihat, dan gerak berpapasan. Diperiksa dalam team-ai-test, tactics-test dan pertandingan penuh. |
| AI sekutu | 8 | 9 | Komando diperiksa sebelum serangan dilepas, tujuan lama dibersihkan, formasi memilih daratan alternatif, penyembuhan efektif diprioritaskan, dan pendukung menghindari panah. Uji reaksi terlambat tetap memberi damage. |
| Panglima | 8 | 9 | Memilih pola menurut jarak/kerumunan/penghalang, memakai ketiga pola per siklus, tidak mengulang pola terakhir langsung. Peringatan dan sasaran terkunci tetap berlaku. Transisi mengamuk menunggu pemulihan selesai, dengan jeda serta indikator fase yang jelas. |
| Keseimbangan | 8 | 9 | 14 pertandingan pembanding, 15 matriks racikan, dan audit 56 sebelum/sesudah selesai. Matriks terbaru: tiga racikan Normal masing-masing 3/3, Santai 3/3, Sulit 2/3. Audit lima seed: pertahanan aktif 4/5 menjadi 5/5, menjaga kastel dengan sortie 5/5 menjadi 3/5, Sulit 2/5 menjadi 3/5. Kekalahan dicatat. Penilaian internal tetap memerlukan uji manusia. |
| Audio | 6,5 | 8 | 17 efek rekaman, stereo/jarak, compressor, prioritas peringatan, dua volume tersimpan, mute, batas 12 suara dan cleanup. Decode serta kontrol diverifikasi di HTTP dan file://. Musik masih berupa melodi sintetis sederhana. |
| Variasi bermain ulang | 6,5 | 8 | Tiga gaya komposisi, urutan/jalur bervariasi, jumlah dan statistik dasar tetap. Ulangi seed yang sama atau mulai ekspedisi baru; 30 seed dan tombol UI diperiksa. |

## Validasi

- `combat-polish-test.cjs`: input dari beberapa sumber, dash menjelang pulih, serangan di akhir dash, bonus balasan saat awal ayunan, reset/pause, delta invalid, clock simulasi yang sama untuk combat dan efek, serta penempatan label.
- Browser `--stress --polish-only`: indikator menghindari HUD dan satu sama lain, ukuran yang konsisten pada DPR 1/2, keyboard/sentuh bersamaan, repeat setelah pause, dialog, dan anggaran resolusi Canvas.
- Browser `--stress --soak-only`: 20 menit waktu simulasi dipercepat dengan 29 unit, 20 siklus jeda/lanjut, batas cache/efek, dan heap setelah garbage collection. Ini uji ketahanan, bukan pengganti bermain 20 menit pada perangkat nyata.
- `player-combat-test.cjs`: frame persiapan/kontak/pemulihan, gerak yang pulih bertahap, arah yang terkunci saat kontak, bantuan sasaran yang dapat dipukul, angka damage/prioritas/overkill, tanda ancaman dan transparansi.
- Browser `--stress --readability-only`: pratinjau frame asli, kerumunan, balasan, pepohonan/bangunan, tepi map, notifikasi ponsel, dan urutan layer tanda bahaya serta pemain.
- `engine-test.cjs`: ekonomi, lima gelombang, tabrakan, input, komando, kondisi menang/kalah, dan replay 30/60/120 FPS.
- `combat-test.cjs`: sapuan, timing, sumber damage, penyembuhan, tekanan pasukan, dan reset.
- `tactics-test.cjs`: taktik baru, bahaya panglima, komposisi seed, pengulangan, dan regresi biarawan terakhir.
- `balance-after.json`: 14 pertandingan memakai kontrol biasa, termasuk perbandingan tanpa upgrade dan tanpa dash.
- `balance-matrix.json`: 15 pertandingan tambahan memakai dash terhadap prajurit serta panglima. Semua mode memakai bot yang sama dalam matriks ini; hasilnya bukan perkiraan tingkat kemenangan manusia.
- Browser: kontrol desktop/sentuh, layout, suara online/offline, tiga pose panglima, ulangi/ekspedisi baru, dan 29 unit aktif.
- Pengukuran akhir setelah revisi gelombang, 29 unit dan audio aktif: CPU simulasi rata-rata 0,63 ms/p95 1,3 ms; render Canvas rata-rata 1,98 ms/p95 3,1 ms; interval frame median 16,7 ms/p95 16,8 ms/maksimum 50 ms. Angka bergantung pada sesi/perangkat. Data lengkap dan hash kode ada di `performance.json`.

Tidak ada penambahan HP, uang, atau perubahan AI khusus untuk membantu bot pertandingan. Fixture performa memakai HP besar agar 29 unit tetap hidup selama pengukuran; fixture ini hanya disuntikkan oleh skrip browser pengembangan.

## Sumber efek suara

- Kenney, [RPG Audio](https://kenney.nl/assets/rpg-audio).
- Kenney, [Impact Sounds](https://kenney.nl/assets/impact-sounds).

Daftar berkas terpilih dan hash terdapat di `Audio/sources.json`. Audio dikirim bersama proyek; permainan tidak mengunduh aset dari internet.

## Target pemolesan tiga fokus

Combat pemain, keterbacaan visual, dan performa/kestabilan dikerjakan dengan sasaran kualitas 9,5; angka itu bukan hasil pengukuran kesenangan manusia. Bukti teknis mencakup input dari beberapa sumber, antrean/cancel dan bonus balasan, pemeriksaan tabrakan indikator/HUD serta DPR, pembandingan piksel sprite, cache LRU dengan batas 512 frame/12 MiB, tujuh suite logika, 29 pertandingan, dan sesi simulasi 20 menit. `polish-checks.json` mencatat pemeriksaan piksel/layout/kontrol, sedangkan `stability-soak.json` mencatat 20 pause/resume, 29 unit yang tetap hidup, dan perubahan heap sekitar 2,8 MiB setelah garbage collection. HP besar hanya dipasang pada fixture ketahanan. Aturan upgrade/spesialisasi tetap ditahan.

## Revisi racikan dan gelombang

Benteng Hidup memperluas area per tingkat; Sumpah Penjaga meningkatkan efisiensi bekal dan biarawan. Penembak membagi waktu persiapan, dengan ruang respons ketika panglima memberi tanda. Paket pasukan memiliki pengawal/pendukung dan jeda berbobot. Setiap ekspedisi memuat ketiga gaya, dengan seed/replay tetap deterministik. `wave-balance-test.cjs` memeriksa 500 seed dan tekanan/efek pemulihan yang benar-benar dijalankan. `director-audit.json` membandingkan kebijakan yang sama pada sumber sebelum/sesudah; percobaan pengendali yang gagal tetap disimpan. Angka kemenangan bot bukan peluang kemenangan pemain manusia.

Audit akhir juga menemukan tradeoff: strategi pertahanan kastel dengan sortie/menghindari panah menang 3/5 pada susunan baru, dibanding 5/5 sebelumnya. Pertahanan aktif naik 4/5 menjadi 5/5, sedangkan manfaat nominal aura/pemulihan meningkat. Semua penurunan tetap dicatat; hasil ini tidak dipakai untuk menjamin skor atau tingkat kesulitan manusia.
