# Penjaga Pulau

Game 2D sederhana: kendalikan ksatria, kumpulkan sumber daya, dan lindungi Kastel Biru dari **5 gelombang**. Sekali bermain sekitar 5 menit. Antarmuka dan panduan berbahasa Indonesia.

## Mainkan

Klik dua kali **Mainkan.cmd** atau **index.html**. Tidak perlu menginstal dependensi, tidak perlu internet. Gunakan Chrome, Edge, atau Firefox modern.

Alternatif memakai server lokal (Node.js):

```powershell
node server.mjs
```

Lalu buka http://localhost:4173. Hentikan server dengan Ctrl+C. Untuk ponsel/tablet, salin seluruh folder dan sajikan dengan server lokal pilihanmu; tombol sentuh otomatis muncul pada perangkat sentuh. Server bawaan hanya menerima koneksi dari komputer yang menjalankannya.

## Kontrol

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Bergerak |
| Spasi / tahan klik di arena | Serangan pedang ke depan, maksimal tiga sasaran |
| Tahan E dekat sumber daya | Pohon: +8 kayu; tambang: +10 emas; domba: +1 bekal |
| 1 | Rekrut sekutu: pemanah, penombak, biarawan, ksatria; 40 emas, biarawan 55 |
| 2 | Perbaiki kastel +140 nyawa, biaya 30 kayu |
| Q | Pulihkan penjaga +45 nyawa, biaya 1 bekal |
| P / Esc | Jeda / lanjutkan |

- Menang setelah semua musuh pada gelombang kelima dikalahkan.
- Kalah jika nyawa penjaga atau kastel habis.
- Satu pemanah gratis menemanimu sejak awal; maksimal 8 sekutu sekaligus.
- Penduduk mengumpulkan kayu dan emas setiap 6 detik. Musuh juga menjatuhkan sumber daya.
- Domba memberi bekal setiap 12 detik. Sumber pohon dan tambang tidak habis agar permainan tetap sederhana.
- Biarawan sekutu menyembuhkan pasukan dan penjaga. Saat jeda, mendekati kastel memulihkan nyawa perlahan.
- Skor terbaik disimpan di browser jika penyimpanan lokal diizinkan. Suara sintetis opsional dapat dinyalakan dari tombol nada.

## Pemakaian aset

Seluruh gambar berasal dari paket Tiny Swords yang sudah ada di folder ini. Aset asli tidak diubah atau dipindahkan.

| Folder | Pemakaian |
| --- | --- |
| Buildings | Kastel, menara, rumah, barak, biara, dan tempat pemanah; warna biru serta pos empat faksi lawan |
| Units | Animasi lima warna pasukan; ksatria, pemanah, penombak, biarawan, pekerja |
| Terrain | Ubin pulau, laut, pohon, tambang, domba, kayu, emas, makanan, alat, semak, batu, awan, bebek |
| Particle FX | Efek pertempuran, debu, kerusakan bangunan |
| UI Elements | Avatar, kursor, panel kertas, serta seluruh koleksi UI pada galeri |

Galeri di menu menampilkan **semua 410 PNG dari 56 folder aset**, termasuk variasi yang tidak muncul di arena. Tidak semua berkas dimasukkan ke arena agar permainan tetap sederhana dan terbaca. Galeri memuat gambar sesuai kebutuhan.

## Berkas game

- `index.html`, `style.css`, `layout.css`, `game.js`: game HTML5 Canvas tanpa framework.
- `asset-manifest.js`: daftar aset untuk galeri.
- `generate-manifest.cjs`: jalankan `node generate-manifest.cjs` setelah menambahkan PNG baru.
- `server.mjs`: server lokal opsional tanpa dependensi.
- `game-preview/`: hasil pemeriksaan visual dan skrip uji pengembangan.

Hak dan lisensi aset mengikuti paket Tiny Swords aslinya.

## Pemeriksaan pengembangan

`node game-preview/engine-test.cjs` menguji seluruh delapan frame setiap pohon (termasuk frame 192×256), ekonomi, cooldown, timing pukulan, efek benturan dua arah, spawn dari jalan, gerak menyebar dan mengejar pemain, kelima gelombang, kondisi menang/kalah, reset, serta satu pertandingan penuh memakai bot dengan kontrol normal.

`node game-preview/browser-test.mjs` menguji tampilan dan interaksi lewat Chrome headless: kontrol desktop, rekrut, jeda, panduan, pencarian/filter galeri, gelombang nyata, pukulan pemain dan musuh, layout laptop 1366×768, layar penuh, kontrol sentuh, panel hasil di ponsel, serta pemuatan langsung lewat `file://`. Skrip ini membutuhkan Chrome Windows dan port lokal 4175; tidak memakai paket tambahan.

## Revisi pertempuran dan arena

- Pine memakai frame 192×256, pohon berdaun memakai 192×192. Keduanya delapan frame, proporsi dan titik pijak disesuaikan. Pepohonan direnggangkan dari jalan dan menjadi transparan ketika menutupi penjaga.
- Pukulan mengenai sasaran pada bagian ayunan yang sesuai. Sasaran berkedip putih, memercikkan efek benturan, menampilkan angka damage, dan terdorong singkat. Panah juga menghasilkan efek yang sama. Menghindari jangkauan saat musuh bersiap menyerang dapat menggagalkan pukulannya.
- Semua musuh masuk dari dermaga dan jalan barat dalam kelompok kecil. Setelah melewati pintu masuk, pasukan mengambil arah berbeda untuk mengepung pemain.
- Panel gelombang dan skor berada di atas arena. Notifikasi lebih kecil dan tampil di tepi atas; arena, sumber daya, serta tombol aksi menyesuaikan layar laptop, ponsel, dan layar penuh.

## Batas pulau, interaksi, dan kesulitan

- Batas gerak memeriksa area pijakan melingkar dengan jarak aman dari pantai. Gerakan dipecah menjadi langkah kecil; dorongan pukulan dan desakan pasukan memakai aturan yang sama. Posisi di luar batas dipulihkan ke daratan.
- Tahan E dekat pohon atau tambang untuk memainkan animasi kapak/beliung. Domba memakai animasi membawa bekal. Bar progres, debu, dan suara benturan menandai aksi; sumber daya diberikan setelah selesai. Bergerak, menyerang, atau terkena pukulan membatalkan pekerjaan yang belum selesai.
- Pemanah lawan mundur ketika didekati, penombak memiliki jangkauan lebih jauh, dan ksatria merangsek lebih cepat secara berkala. Gelombang lanjut menaikkan nyawa, kecepatan, damage, dan laju kedatangan musuh.
- Pedang kini mengenai maksimal tiga sasaran di depan penjaga, dengan damage lebih kecil pada sasaran tambahan. Gerakan melambat saat mengayun sehingga waktu menyerang lebih berarti.

## Perapian konsistensi permainan

- Tabrakan pohon/bangunan diperiksa sepanjang gerakan; dorongan tidak membalik arah ayunan. Pasukan mencari jalur mengitari penghalang dan dipisahkan perlahan ketika menumpuk.
- Damage pedang mengikuti bagian ayunan yang mengenai sasaran. Serangan jarak dekat tidak menembus penghalang; panah memeriksa seluruh lintasan antar-frame agar tidak melewati sasaran.
- Pemanah berhenti sejenak saat membidik. Animasi menyelesaikan seluruh frame serangan, dan animasi berjalan/diam dimulai dari transisi yang sesuai. Pekerjaan tidak dimulai kembali selama pemain bergerak.
- Bekal memiliki jeda pemakaian 1,8 detik; biarawan sekutu memulihkan 16 HP. Gelombang terakhir berisi 20 musuh agar kenaikan tekanan lebih bertahap.
- Angka damage menampilkan HP yang benar-benar berkurang, diberi jarak vertikal, dan dibatasi jumlahnya. Teks status diperjelas pada layar kecil.

## Ketahanan simulasi

- Panah berhenti pada penghalang atau sasaran pertama sepanjang lintasannya. Pohon dan bangunan tidak lagi dapat ditembus panah.
- Graf navigasi dan komponen daratan dihitung sekali. Pasukan berbagi cache maksimal 32 medan jarak; tujuan di luar jangkauan diproyeksikan ke daratan yang terhubung. Pasukan yang tidak mendapat jalur berhenti aman, mencoba ulang, dan penyerang yang terus terhambat mengalihkan tekanan ke kastel.
- Simulasi menggunakan langkah tetap 60 Hz dengan maksimal enam langkah pengejaran per frame. Jeda menghapus sisa waktu tertunda, sehingga melanjutkan permainan tidak memicu lonjakan gerakan.
- Serangan membatalkan pekerjaan sebelum hadiah diberikan. Terkena pukulan membatalkan ayunan tertunda. Gerakan, serangan, dan interaksi diperiksa dalam uji ulang yang sama pada render 30, 60, dan 120 FPS.
- Efek sementara dibatasi 80 animasi dan 60 benturan agar alokasi tidak terus bertambah saat ramai.
- Jalankan `node game-preview/browser-test.mjs --stress` untuk uji browser biasa ditambah pengukuran 28 unit. Hasil waktu CPU simulasi disimpan dalam `game-preview/performance.json`. Angka ini mengukur simulasi pada komputer penguji, bukan jaminan FPS di semua perangkat.

Pengukuran tambahan: `node game-preview/browser-test.mjs --stress --benchmark-only` juga mengukur interval frame selama sekitar empat detik dengan 28 unit tetap aktif. Pada pengujian Chrome headless 1366×768 dengan GPU dinonaktifkan, cache frame kilatan menurunkan persentil ke-95 interval frame yang teramati dari 50 ms menjadi 16,7 ms; frame terlama dari 83,4 ms menjadi 33,4 ms. CPU simulasi rata-rata sekitar 0,36 ms per langkah. Hasil pengukuran sebelum dan sesudah tersimpan di folder `game-preview`; angka dapat berubah menurut perangkat dan beban komputer. Cache kilatan dibatasi 32 frame dan sprite di luar kamera dilewati.

## Langkah Embun dan Perkemahan

**Shift** (atau tombol panah dash di ponsel) melesat sekitar 144 piksel dalam 0,2 detik mengikuti arah gerak. Tanpa arah yang ditekan, arah gerak terakhir dipakai. Cooldown dasar 2,4 detik. Dash membatalkan kerja dan ayunan tertunda, dapat melepas stagger, dan tetap bertabrakan dengan pohon, bangunan, serta pantai.

Selama 0,16 detik awal dash, pukulan yang masuk dielakkan. Menghindari pukulan saat tidak sedang kebal dari serangan sebelumnya memicu **Elak Sempurna**: selama dua detik, serangan berikutnya yang mengenai musuh mendapat +12 damage pada sasaran utama. Bonus habis setelah satu pukulan berhasil. Jejak bayangan dan bar cooldown membantu membaca posisi serta kesiapan dash.

**U** atau tombol **Pilih upgrade** membuka Perkemahan saat persiapan awal dan setiap jeda. Waktu berhenti selama memilih. Maksimal satu pembelian per jeda, tiga tingkat untuk setiap upgrade, dan seluruh peningkatan direset saat memulai pertandingan baru. Harga naik 20 emas tiap tingkat. Emas tetap dibutuhkan untuk merekrut pasukan, sehingga pilihan penempaan memiliki biaya strategi.

| Upgrade | Harga tingkat pertama | Efek per tingkat |
| --- | --- | --- |
| Bilah Bara | 45 emas | +5 damage utama, +3 damage sasaran tambahan |
| Ritme Tempur | 40 emas | Cooldown serangan -6% dari nilai dasar |
| Jejak Angin | 35 emas | Cooldown dash -0,25 detik |
| Balasan Embun | 35 emas | Bonus balasan +6 damage, jendela balasan +0,5 detik |
| Benteng Hidup | 40 emas | Kapasitas kastel +80 HP, langsung pulih 80 |
| Sumpah Penjaga | 40 emas | Kapasitas penjaga +15 HP, langsung pulih 15 |

Tombol **Siap bertempur** menutup Perkemahan dan memperpendek sisa persiapan menjadi maksimal tiga detik. **Kembali ke pulau** mempertahankan sisa waktu. Memilih upgrade tidak wajib.
