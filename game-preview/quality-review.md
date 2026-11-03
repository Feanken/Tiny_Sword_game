# Penilaian setelah pengembangan taktik, ekspedisi, dan audio

Angka berikut adalah penilaian internal untuk lingkup game 2D sederhana ini. Tes membuktikan perilaku serta batas teknis, bukan ukuran universal kesenangan pemain.

| Bagian | Sebelum | Setelah | Perubahan dan bukti |
| --- | --- | --- | --- |
| AI musuh | 7,5 | 8 | Perlindungan pendukung, sasaran sesuai peran, posisi pemanah, penombak menjaga jarak, biarawan terakhir kembali ke jalan. Diperiksa dalam tactics-test dan pertandingan penuh. |
| AI sekutu | 7,5 | 8 | Menghindari tiga pola panglima dengan waktu reaksi, tidak kembali masuk bahaya, tetap mengikuti komando. Uji juga memastikan sekutu terlambat tetap terkena damage. |
| Panglima | 7,5 | 8 | Memilih pola menurut jarak/kerumunan/penghalang, memakai ketiga pola per siklus, tidak mengulang pola terakhir langsung. Peringatan dan sasaran terkunci tetap berlaku. |
| Keseimbangan | 7 | 8 | 14 pertandingan pembanding dan 15 matriks racikan/jumlah pasukan selesai. Tiga racikan Normal dengan empat sekutu menang 9/9; dua sekutu Santai menang 3/3; empat sekutu Sulit menang 1/3. Dua kekalahan Sulit termasuk hasil pengujian yang diharapkan. |
| Audio | 6,5 | 8 | 17 efek rekaman, stereo/jarak, compressor, prioritas peringatan, dua volume tersimpan, mute, batas 12 suara dan cleanup. Decode serta kontrol diverifikasi di HTTP dan file://. Musik masih berupa melodi sintetis sederhana. |
| Variasi bermain ulang | 6,5 | 8 | Tiga gaya komposisi, urutan/jalur bervariasi, jumlah dan statistik dasar tetap. Ulangi seed yang sama atau mulai ekspedisi baru; 30 seed dan tombol UI diperiksa. |

## Validasi

- `engine-test.cjs`: ekonomi, lima gelombang, tabrakan, input, komando, kondisi menang/kalah, dan replay 30/60/120 FPS.
- `combat-test.cjs`: sapuan, timing, sumber damage, penyembuhan, tekanan pasukan, dan reset.
- `tactics-test.cjs`: taktik baru, bahaya panglima, komposisi seed, pengulangan, dan regresi biarawan terakhir.
- `balance-after.json`: 14 pertandingan memakai kontrol biasa, termasuk perbandingan tanpa upgrade dan tanpa dash.
- `balance-matrix.json`: 15 pertandingan tambahan memakai dash terhadap prajurit serta panglima. Semua mode memakai bot yang sama dalam matriks ini; hasilnya bukan perkiraan tingkat kemenangan manusia.
- Browser: kontrol desktop/sentuh, layout, suara online/offline, tiga pose panglima, ulangi/ekspedisi baru, dan 29 unit aktif.
- Pengukuran 29 unit dengan audio aktif: rata-rata CPU simulasi sekitar 0,59 ms per langkah; interval frame median 16,7 ms dan persentil ke-95 16,8 ms pada komputer penguji. `performance.json` menyimpan angka lengkap.

Tidak ada penambahan HP, uang, atau perubahan AI khusus untuk membantu bot pertandingan. Fixture performa memakai HP besar agar 29 unit tetap hidup selama pengukuran; fixture ini hanya disuntikkan oleh skrip browser pengembangan.

## Sumber efek suara

- Kenney, [RPG Audio](https://kenney.nl/assets/rpg-audio).
- Kenney, [Impact Sounds](https://kenney.nl/assets/impact-sounds).

Daftar berkas terpilih dan hash terdapat di `Audio/sources.json`. Audio dikirim bersama proyek; permainan tidak mengunduh aset dari internet.
