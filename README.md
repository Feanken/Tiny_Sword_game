# Penjaga Pulau

Game 2D sederhana: kendalikan ksatria, kumpulkan sumber daya, dan lindungi Kastel Biru dari **5 gelombang**. Sekali bermain sekitar 3–5 menit. Antarmuka dan panduan berbahasa Indonesia.

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
| Shift | Dash; elak tepat waktu untuk bonus balasan |
| U | Pilih satu upgrade saat jeda gelombang |
| F / G | Sekutu mengikuti penjaga / menjaga kastel |
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
- Skor terbaik disimpan di browser jika penyimpanan lokal diizinkan. Efek suara rekaman dan musik opsional dapat dinyalakan dari tombol nada. Tombol pengaturan suara memisahkan volume efek dan musik.

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
- `Audio/`, `audio-pack.js`: 17 efek suara lokal dan payload offline; sumber serta hash berkas tercatat di `Audio/sources.json`.

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
- Jalankan `node game-preview/browser-test.mjs --stress` untuk uji browser biasa ditambah pengukuran 29 unit: 20 prajurit, 8 sekutu, dan panglima yang mengamuk pada mode Sulit. Ketiga pola panglima harus selesai dijalankan. Hasil waktu CPU simulasi disimpan dalam `game-preview/performance-simulation.json`. Angka ini mengukur simulasi pada komputer penguji, bukan jaminan FPS di semua perangkat.

Pengukuran tambahan: `node game-preview/browser-test.mjs --stress --benchmark-only` mengukur interval frame selama sekitar 15 detik dengan 29 unit tetap aktif, termasuk seluruh pola panglima yang mengamuk. Pada pengujian Chrome headless 1440×900 dengan GPU dinonaktifkan, median interval frame 16,7 ms, persentil ke-95 16,8 ms, dan frame terlama 50,1 ms. Dengan 17 efek suara terdekode dan audio aktif, CPU simulasi rata-rata sekitar 0,54 ms per langkah pada sesi ini, persentil ke-95 1 ms. Hasil disimpan di `game-preview/performance.json`; angka dapat berubah menurut perangkat dan beban komputer. Nyawa unit dinaikkan hanya dalam fixture pengukuran agar semua unit tetap hidup. Cache kilatan dibatasi 32 frame dan sprite di luar kamera dilewati.

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

## Komando, Panglima Kelam, dan kesulitan

**F — Ikuti penjaga** menjaga sekutu di sekitar pemain dan mencari musuh dalam radius 320 piksel dari pemain. **G — Jaga kastel** menarik pasukan kembali ke halaman kastel dengan wilayah pertahanan 235 piksel. Perintah berlaku untuk seluruh sekutu, termasuk yang direkrut kemudian; membatalkan serangan tertunda agar perintah segera diikuti. Pemanah tetap menjaga jangkauan dan biarawan merawat unit di wilayah perintahnya. Tombol perintah tersedia di bawah arena untuk ponsel.

Pada pertengahan gelombang kelima, **Panglima Kelam** mendarat dari jalan barat. Ia memilih hantaman, terjangan, atau kipas panah berdasarkan jarak, kerumunan, jalur terjangan, dan perlindungan. Setiap siklus tetap memakai ketiga pola; pola terakhir tidak langsung diulang ketika siklus berganti. Tanda dikunci ke posisi pemain saat persiapan serangan, sehingga bergerak, dash, atau berlindung dapat menyelamatkan pemain. Sesudah setiap serangan, ia memiliki masa pemulihan untuk dibalas. Pada 50% nyawa ia mengamuk dan memperpendek jeda antar pola, tetapi tetap memberi peringatan. Ia tidak bisa dikunci dengan stagger. Kemenangan memerlukan seluruh prajurit dan panglima dikalahkan.

Jalur terjangan dipotong pada pohon, bangunan, atau pantai pertama. Panglima bergerak lurus sampai ujung tanda; desakan pasukan tidak menggeser titik awalnya. Kecepatan dikunci saat tanda muncul, termasuk jika ia mulai mengamuk sebelum terjangan berlangsung.

Garda panglima mengurangi damage sekutu menjadi 55% saat ia belum terbuka. Saat pemulihan, damage sekutu kembali penuh dan pedang penjaga mendapat +30%; status di bar panglima menandai kesempatan membalas. Jeda antar pola dipersingkat tanpa mengurangi lama peringatan atau menambah HP panglima. Dash dan balasan sempurna membantu memanfaatkan celah ini.

| Mode | HP musuh | Damage musuh | Kecepatan | Interval kedatangan | HP panglima | Peringatan pola | Pengali skor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Santai | ×0,75 | ×0,70 | ×0,90 | ×1,15 | 480 | 1,10 detik | ×0,8 |
| Normal | ×1 | ×1 | ×1 | ×1 | 650 | 0,90 detik | ×1 |
| Sulit | ×1,20 | ×1,25 | ×1,08 | ×0,82 | 850 | 0,75 detik | ×1,4 |

Kesulitan dipilih sebelum mulai dan dikunci sepanjang pertandingan. Rekor disimpan terpisah untuk setiap mode. Setelah menang atau kalah, **Ganti kesulitan** mengembalikan pemain ke layar pilihan. Rekor lama sebelum pembagian mode dibaca sebagai rekor Normal.

Sekutu mempertahankan posisi formasinya ketika anggota lain gugur. Rekrutan baru mengambil posisi kosong sehingga anggota yang bertahan tidak berganti tujuan hanya karena urutan daftar berubah.

## Pemeriksaan strategi

`node game-preview/balance-test.cjs` menjalankan 14 pertandingan lengkap dengan angka acak yang dapat diulang: empat kebijakan kontrol pada tiga seed Normal, serta kebijakan dash/balasan pada Santai dan Sulit. Tidak ada perubahan nyawa, emas, cooldown, atau AI untuk membantu bot. `--verify` memeriksa hasil terakhir tanpa mengulang simulasi.

Pada tiga seed Normal, panglima menyelesaikan ketiga pola untuk setiap kebijakan. Pengujian memeriksa bahwa investasi upgrade mempercepat rata-rata pertarungan dibanding kebijakan dasar, serta dash mengurangi total damage panglima yang diterima. Menghindar kadang memperpanjang pertarungan karena pemain meninggalkan jangkauan pedang. Angka setiap pertandingan tersedia di JSON hasil. Pengukuran ini membandingkan kontrol otomatis; rasa sulit dan kenyamanan tetap memerlukan uji pemain.

`game-preview/balance-before.json` menyimpan hasil sebelum penyesuaian tempo/garda; `balance-after.json` menyimpan hasil terbaru. Kebijakan balasan hanya ditambahkan pada pengukuran terbaru, sehingga tidak semua kasus memiliki pasangan sebelum/sesudah.

## Penyempurnaan combat

- Ketukan Spasi, klik, atau tombol serang sentuh dapat disimpan selama 0,14 detik ketika cooldown hampir selesai. Ketukan berlaku satu kali, kedaluwarsa jika terlalu awal, dan dibatalkan oleh dash, damage, jeda, atau reset. Menahan tombol tetap menyerang berulang. Input serangan segera membatalkan pekerjaan.
- Pedang hanya membantu menghadap sasaran yang jalurnya terbuka. Musuh di balik pohon tidak mengalihkan arah ayunan otomatis.
- Sekutu dan musuh mempertahankan sasaran yang masih relevan, lalu beralih ketika lawan lain jauh lebih dekat, sasaran gugur, atau sasaran keluar wilayah perintah.
- Pemanah mengutamakan sasaran dengan jalur tembak terbuka. Jika tertutup, mereka mencari jalan; jalur diperiksa lagi saat anak panah dilepas. Arah panah dihitung dari titik kemunculannya agar sesuai pemeriksaan tabrakan.
- Unit jarak dekat yang terhalang pohon atau bangunan mencari jalan meskipun sasaran sudah berada dalam radius serangan.

`node game-preview/combat-test.cjs` memeriksa ketukan, kedaluwarsa, pembatalan, kestabilan sasaran, arah pedang, gerak mengitari penghalang, dan tembakan. `node game-preview/browser-test.mjs --stress --combat-only` memeriksa ketukan singkat melalui event keyboard, mouse, serta sentuhan di Chrome.

## Sapuan, tekanan pasukan, dan kejelasan pertempuran

- Pedang menyapu sudut −1,3 sampai +1,3 radian di depan penjaga pada 0,16–0,28 detik ayunan. Pemeriksaan mencakup lintasan antar-langkah simulasi, mengikuti busur visual dengan jangkauan bilah 76 piksel dan toleransi tubuh 18 piksel. Setiap sasaran hanya terkena sekali dan maksimal tiga sasaran sepanjang satu ayunan. Masa pemulihan tidak memberikan damage.
- Efek hentakan menahan pose karakter selama 0,035 detik. Gerakan, cooldown, panah, dan waktu gelombang terus berjalan; tidak ada pembekuan simulasi global.
- Pasukan jarak dekat mengambil posisi dari delapan titik pendekatan yang dibagi per sasaran. Reservasi diperiksa ulang paling sering setiap 0,3 detik, dilepas saat pergantian sasaran/perintah atau kematian, dan dibersihkan saat reset. Kedua kubu dipisahkan secara lembut tanpa membuat penjaga terkurung tabrakan tubuh.
- Persiapan serangan melee prajurit biasa ke penjaga dibatasi 2/3/4 untuk Santai/Normal/Sulit, dengan jeda awal antarserangan. Peringatan panglima ikut mengurangi kuota serangan berikutnya. Tembakan dan pertarungan melawan sekutu tetap berlangsung.
- Jika beberapa serangan mengenai penjaga dalam satu langkah simulasi, damage terbesar diterapkan satu kali, lalu kekebalan 0,45 detik berlaku. Damage tidak dijumlahkan. Untuk nilai sama, panglima mendapat prioritas sumber, lalu ID unit yang tetap. Elak sempurna diperiksa sebelum penggabungan.
- Biarawan menilai urgensi nyawa, pemulihan efektif, jarak, dan damage baru diterima. Keputusan disimpan hingga 0,2 detik. Penyembuhan memerlukan jalur terbuka; biarawan mencoba menjauh dari ancaman dekat saat cooldown.
- Panglima memakai pose hantaman, bersiap menerjang, dan membidik yang berbeda dari aset asli. Masa pemulihan memiliki tanda cincin dan teks **TERBUKA**. Tiga pola memiliki suara berbeda.
- Pukulan berhasil, meleset, terkena damage, dan elak sempurna memiliki umpan balik berbeda. Indikator arah menunjukkan asal damage, bentuk pijakan membedakan kubu, dan tanda penting tetap tersedia tanpa suara. Efek rekaman dan nada berbagi batas 12 suara aktif; node audio dilepas setelah selesai.

`PenjagaPulau.snapshot().combat` menampilkan jumlah ayunan, kontak, meleset, terputus, dibatalkan, input tersimpan, penyembuhan efektif/terbuang, kejadian terhambat, damage bersamaan, serta damage menurut sumber. `blockedSeconds` adalah akumulasi waktu unit yang rutenya terhambat, bukan durasi macet seluruh game. Counter hanya disimpan dalam memori pertandingan dan direset ketika mulai lagi; tidak dikirim ke layanan luar. Laporan 14 pertandingan menyertakan counter ini dan hash sumber yang diuji.

Uji combat juga memeriksa jendela sapuan, deduplikasi hit, batas cleave, kontrol saat benturan, urutan damage bersamaan, prioritas penyembuhan, reservasi posisi, batas tekanan, pose panglima, dan reset. `node game-preview/browser-test.mjs --stress --preview-only` menghasilkan pratinjau ketiga pose dan menguji batas/pembersihan node audio.

## Taktik pasukan dan variasi ekspedisi

- Ksatria serta penombak dapat beralih melindungi pemanah dan biarawan yang terancam. Penombak menjaga jarak ujung senjata ketika cooldown; pemanah mengutamakan sasaran pendukung yang terbuka dan mencari posisi tembak dari beberapa sudut. Keputusan perlindungan disimpan sekitar 0,22 detik, posisi tembak sekitar 0,3 detik.
- Sekutu membaca area bahaya panglima setelah reaksi 0,1–0,17 detik. Mereka dapat membatalkan ayunan, keluar melalui jalur yang bisa dilalui, dan menahan posisi aman sampai serangan selesai. Pemanah dan biarawan tetap dapat menjalankan peran dari tempat aman. Tidak ada kekebalan tersembunyi; terlambat menghindar tetap bisa terkena damage.
- Titik menghindar yang masih aman dipakai ulang agar sekutu tidak zigzag karena terus memilih tujuan baru. Sekutu tetap mengikuti batas komando Ikuti/Jaga kastel. Biarawan musuh yang kehilangan pasukan berkumpul kembali di jalan tengah, sehingga tidak mundur tanpa akhir ke pojok pulau.
- Gelombang pertama tetap menjadi pengenalan. Gelombang berikutnya memakai variasi barisan pelindung, sayap pemanah, dan serbuan bergerak, dengan urutan serta jalur masuk berbeda. Jumlah musuh tetap 7/10/13/16/20 ditambah panglima; tidak ada perubahan damage atau HP secara acak.
- **Ulangi ekspedisi** mengulang seed yang sama, termasuk susunan dan posisi awal pasukan. **Ekspedisi baru** membuat seed baru. Perubahan kosmetik dan suara tidak mengubah generator acak simulasi. Nomor ekspedisi tampil di hasil; petunjuk komposisi berikutnya muncul saat persiapan.

`node game-preview/tactics-test.cjs` memeriksa variasi 30 seed, pengulangan ekspedisi, pemilihan pola adaptif, penghindaran nyata ketiga pola tanpa kekebalan, kestabilan posisi aman, perlindungan pendukung, posisi pemanah, batas pantai, dan perilaku biarawan terakhir.

`node game-preview/balance-matrix.cjs` menambah 15 pertandingan pada tiga seed: racikan pedang/elak/pertahanan dengan 4 sekutu di Normal, 2 sekutu di Santai, serta 4 sekutu di Sulit. Bot matriks menghindari ayunan prajurit biasa dan peringatan panglima; bot pembanding 14 pertandingan memakai kebijakan yang dijelaskan dalam laporannya. Semua memakai input normal tanpa tambahan HP, emas, atau perubahan AI.

Hasil matriks terakhir: setiap racikan Normal menang 3/3; pasukan kecil Santai menang 3/3; pasukan 4 unit Sulit menang 2/3. Tidak ada pertandingan tertahan sampai batas 600 detik. Ini menunjukkan beberapa susunan layak dan Sulit lebih menekan pada bot tersebut, bukan perkiraan tingkat kemenangan manusia. Rincian serta hash sumber tersimpan di `game-preview/balance-matrix.json`.

## Audio lokal

Efek berasal dari [RPG Audio](https://kenney.nl/assets/rpg-audio) dan [Impact Sounds](https://kenney.nl/assets/impact-sounds) oleh Kenney. Paket lokal mencakup sapuan, benturan logam/tubuh/kayu, gesekan kain, langkah rumput, serta suara interaksi. Musik latar dan beberapa notifikasi tetap sintetis. Semua efek didekode sekali saat suara diaktifkan, memakai stereo menurut posisi, pelemahan menurut jarak, compressor, dan prioritas peringatan di atas langkah kaki.

Volume efek dan musik tersimpan terpisah di browser. Mute berlaku melalui master gain; efek yang gagal didekode memakai bunyi cadangan. `audio-pack.js` menyimpan data lokal sehingga `index.html` tetap dapat dimainkan langsung melalui `file://` tanpa koneksi internet.

`node game-preview/browser-test.mjs --stress --audio-only` memeriksa 17 berkas terdekode, energi/durasi sampel, volume terpisah, mute, batas dan pelepasan 12 suara, layout ponsel, serta decode offline. `--replay-only` memeriksa tombol ulangi/ekspedisi baru dan panel hasil ponsel. Untuk membangun ulang payload audio, jalankan `python game-preview/import-audio.py --download`; langkah pengembangan ini membutuhkan internet.

## Pengembangan AI tim

- Musuh dan sekutu membagi sasaran menggunakan jumlah penyerang yang sudah terlibat. Menyelamatkan unit pendukung tetap mendapat prioritas; unit tidak berpindah sasaran hanya karena perubahan jarak kecil. Daftar keterlibatan dihitung sekali per langkah simulasi dan dipakai bersama.
- Pasukan mengikuti aturan berpapasan ke kanan, dengan pemeriksaan ruang di dekatnya. Penyesuaian ini bekerja saat mengikuti jalur navigasi maupun bergerak langsung; pemisahan tubuh tetap lembut agar penjaga dapat keluar dari kerumunan.
- Batas wilayah komando sekutu diperiksa sebelum melepas serangan tertunda. Sekutu yang keluar wilayah membatalkan ayunan/tembakan dan kembali. Mengubah F/G juga membersihkan tujuan menghindar, mundur, perlindungan, dan penyembuhan sebelumnya.
- Posisi formasi mencari titik daratan alternatif jika titik utama tertutup pohon, bangunan, atau pantai. Posisi anggota yang bertahan tetap tidak berubah karena anggota lain gugur.
- Pemanah dan biarawan kedua kubu dapat melangkah ke samping untuk menghindari panah lawan yang terlihat mendekat. Pemeriksaan memiliki interval reaksi; panah yang sudah terlalu dekat tetap bisa mengenai unit. Tidak ada tambahan kekebalan.
- Biarawan mengutamakan pemulihan efektif pada pasien yang dapat segera dijangkau, serta memilih perlindungan saat mundur. Tujuan mundur disimpan singkat agar gerak tidak zigzag karena menghitung ulang setiap frame.

`node game-preview/team-ai-test.cjs` memeriksa pembagian sasaran, prioritas perlindungan, pembatalan tembakan di luar wilayah, reset tujuan setelah komando, penyembuhan yang terjangkau, penghindaran panah nyata beserta reaksi terlambat, lalu lintas berlawanan arah, serta posisi formasi dekat bangunan/pantai. Uji ini melengkapi `tactics-test.cjs`, `combat-test.cjs`, pengujian mesin, 29 pertandingan otomatis, dan pengukuran browser 29 unit dengan audio aktif.
