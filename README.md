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

Pengukuran tambahan: `node game-preview/browser-test.mjs --stress --benchmark-only` mengukur interval frame selama sekitar 15 detik dengan 29 unit tetap aktif, termasuk seluruh pola panglima yang mengamuk. Pada sesi akhir Chrome headless 1440×900 dengan GPU dinonaktifkan, median interval frame 16,7 ms, persentil ke-95 16,8 ms, dan frame terlama 33,4 ms. Dengan 17 efek suara terdekode dan audio aktif, CPU simulasi rata-rata 0,49 ms per langkah, persentil ke-95 1 ms. Render Canvas rata-rata 1,90 ms, persentil ke-95 3,1 ms; sesi pembanding sebelum pemolesan mencatat 7,85 ms dan 13,8 ms. Penurunan rata-rata sekitar 76% adalah hasil sesi pembanding ini, bukan jaminan semua perangkat. Hasil tersimpan di `game-preview/performance.json`, dengan laporan awal di `performance-before-polish.json`. Nyawa unit dinaikkan hanya dalam fixture pengukuran agar semua unit tetap hidup.

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
| Benteng Hidup | 40 emas | Kastel +80 HP, pulih 80; damage penjaga dekat kastel berkurang 2 |
| Sumpah Penjaga | 40 emas | Kapasitas penjaga +15 HP, langsung pulih 15 |

Tombol **Siap bertempur** menutup Perkemahan dan memperpendek sisa persiapan menjadi maksimal tiga detik. **Kembali ke pulau** mempertahankan sisa waktu. Memilih upgrade tidak wajib.

## Komando, Panglima Kelam, dan kesulitan

**F — Ikuti penjaga** menjaga sekutu di sekitar pemain dan mencari musuh dalam radius 320 piksel dari pemain. **G — Jaga kastel** menarik pasukan kembali ke halaman kastel dengan wilayah pertahanan 235 piksel. Perintah berlaku untuk seluruh sekutu, termasuk yang direkrut kemudian; membatalkan serangan tertunda agar perintah segera diikuti. Pemanah tetap menjaga jangkauan dan biarawan merawat unit di wilayah perintahnya. Tombol perintah tersedia di bawah arena untuk ponsel.

Pada pertengahan gelombang kelima, **Panglima Kelam** mendarat dari jalan barat. Ia memilih hantaman, terjangan, atau kipas panah berdasarkan jarak, kerumunan, jalur terjangan, dan perlindungan. Setiap siklus tetap memakai ketiga pola; pola terakhir tidak langsung diulang ketika siklus berganti. Tanda dikunci ke posisi pemain saat persiapan serangan, sehingga bergerak, dash, atau berlindung dapat menyelamatkan pemain. Sesudah setiap serangan, ia memiliki masa pemulihan untuk dibalas. Saat mencapai 50% nyawa, ia menuntaskan serangan dan pemulihan sebelum melakukan transisi mengamuk; fase berikutnya memperpendek jeda antar pola dengan peringatan tetap utuh. Ia tidak bisa dikunci dengan stagger. Kemenangan memerlukan seluruh prajurit dan panglima dikalahkan.

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
- Efek hentakan menahan pose sasaran selama 0,035 detik. Pose dan sapuan pedang penyerang tetap mengikuti jendela damage. Gerakan, cooldown, panah, dan waktu gelombang terus berjalan; tidak ada pembekuan simulasi global.
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

Hasil matriks setelah revisi combat pemain: racikan pedang dan elak Normal masing-masing menang 3/3, pertahanan Normal 2/3; pasukan kecil Santai menang 3/3; pasukan 4 unit Sulit menang 1/3. Tidak ada pertandingan tertahan sampai batas 600 detik. Perubahan gerak dan pilihan sasaran juga mengubah hasil bot; kekalahan tetap dicatat, bukan diatasi dengan bantuan khusus. Hasil ini bukan perkiraan tingkat kemenangan manusia. Rincian serta hash sumber tersimpan di `game-preview/balance-matrix.json`.

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

## Ritme panglima dan pilihan pertahanan

Panglima memiliki dua fase dengan transisi yang terlihat. Ketika nyawanya mencapai setengah, serangan yang sudah diberi tanda tetap diselesaikan beserta seluruh jendela pemulihannya. Setelah itu ia mengambil posisi mengamuk selama 0,9/0,75/0,6 detik pada Santai/Normal/Sulit, tanpa serangan atau perpindahan mendadak. Transisi hanya terjadi satu kali; penyembuhan musuh tidak mengulanginya. Ada jeda 0,35 detik sebelum ia kembali memilih serangan. Transisi tidak memberi kekebalan dan tidak mengunci HP.

| Mode | Pemulihan hantaman | Pemulihan terjangan | Pemulihan panah |
| --- | --- | --- | --- |
| Santai | 1,30 dtk | 1,30 dtk | 1,15 dtk |
| Normal | 1,10 dtk | 1,15 dtk | 1,00 dtk |
| Sulit | 1,00 dtk | 1,05 dtk | 0,90 dtk |

Pada fase mengamuk, pemulihan berkurang 0,1 detik dengan batas bawah 0,85 detik. Bar panglima menunjukkan fase, persiapan transisi, dan hitungan waktu **TERBUKA · PEDANG +30%**. Ketika penjaga berada dalam 160 piksel dari panglima yang pulih, jumlah persiapan serangan melee prajurit biasa dibatasi 1/1/2 pada Santai/Normal/Sulit. Serangan yang sudah berjalan dan panah tetap berbahaya; kesempatan membalas memerlukan posisi yang tepat.

**Benteng Hidup** tetap memberi +80 kapasitas HP kastel dan pemulihan 80 per tingkat. Selama penjaga berada dalam radius 160 piksel dari kastel yang masih berdiri, setiap tingkat juga mengurangi damage masuk sebesar 2, dengan damage minimal 1. Kotak kecil hijau kebiruan di dalam pijakan penjaga menandai perlindungan aktif. Efek diterapkan satu kali setelah penggabungan pukulan bersamaan dan dicatat sebagai `fortressSaved`; keluar radius atau kastel runtuh menonaktifkannya. Perlindungan ini membantu strategi bertahan, dan tetap membutuhkan gerakan serta pengelolaan pasukan.

`node game-preview/boss-balance-test.cjs` menguji transisi tanpa memotong serangan, satu kali mengamuk, durasi pemulihan tiap mode, kesempatan membalas, batas windup prajurit secara nyata, serta jangkauan/penerapan tunggal/reset Benteng Hidup. Laporan pertandingan memakai 14 kasus pembanding dan 15 kasus racikan/pasukan; hasil bot tidak menyatakan tingkat kemenangan manusia.

## Respons pemain dan keterbacaan arena

- Dua frame persiapan pedang, frame kontak, dan frame pemulihan sekarang mengikuti fase serangan: kontak tetap pada 0,16–0,28 detik. Benturan tidak membekukan pose penyerang hingga tertinggal dari hitbox. Busur dan pemeriksaan kontak memakai fungsi sudut yang sama.
- Kecepatan gerak tetap 55% saat bersiap/mengenai, lalu pulih bertahap sampai penuh pada akhir animasi 0,42 detik. Pemain bisa mengganti arah dan kembali memakai pose lari setelah fase kontak. Dash tetap bisa membatalkan serangan; damage, cooldown, dan batas tiga sasaran tetap berlaku.
- Bantuan arah hanya memilih musuh hidup yang dapat dijangkau sapuan melalui jalur terbuka. Musuh di depan diprioritaskan bila perbedaan jaraknya kecil, sehingga arah tidak mudah berbalik karena kerumunan.
- Label **KAMU**, bar nyawa lokal ketika terluka, dan pijakan bergaris gelap digambar di atas kerumunan. Label **BALASAN** dan warna biru kehijauan menandai bonus elak yang masih tersedia. Penanda dijaga agar tidak terpotong di tepi atas layar. Pohon dan bangunan yang menutupi pemain menjadi transparan.
- Musuh yang sedang menyiapkan serangan ke pemain memiliki tanda **!**: lingkaran untuk serangan dekat, segitiga untuk pemanah, disertai bar persiapan. Tanda hilang jika serangan dibatalkan atau sasarannya berubah. Panah kedua kubu memiliki jejak warna berbeda dengan garis gelap.
- Isi area bahaya panglima berada di lantai, sedangkan batasnya digambar di atas unit/efek. Terjangan memperlihatkan lebar tubuh beserta ujung melingkarnya dan titik berhenti yang terkunci. Kipas panah memperlihatkan tiga arah tembakan.
- Damage pemain/yang diterima pemain lebih menonjol. Pukulan pasukan pada sasaran sama digabung selama paling lama 0,12 detik, memakai jumlah HP yang benar-benar hilang. Efek benturan pasukan lebih kecil; batas 35 teks memberi prioritas pada damage penting. Notifikasi berada di sudut dan petunjuk sumber daya disembunyikan saat menyerang, dash, atau baru terluka.

`node game-preview/player-combat-test.cjs` memeriksa kecocokan frame/fase, gerak pemulihan dan arah, bantuan sasaran, penggabungan/prioritas/overkill damage, kepemilikan tanda ancaman, transparansi, dan reset. `node game-preview/browser-test.mjs --stress --readability-only` memeriksa frame aset asli, urutan layer bahaya/pemain, kontrol sentuh, posisi notifikasi, serta menghasilkan pratinjau desktop, ponsel, kerumunan, pepohonan, bangunan, dan tepi map. Uji mesin, combat, taktik, AI tim, panglima, dan 29 pertandingan juga dijalankan ulang.

## Pemolesan combat, indikator, dan ketahanan

Aturan upgrade tetap satu pembelian per jeda dengan batas tiga tingkat. Rencana spesialisasi belum diterapkan; revisi ini berfokus pada sistem combat dan tampilan yang sudah ada.

- Keyboard dan setiap pointer memiliki kepemilikan input sendiri. Melepas satu jari tidak membatalkan jari lain atau keyboard yang masih ditahan. Klik kanan tidak menyerang, kehilangan pointer capture melepas input terkait, dan pengulangan tombol dari sistem operasi tidak menghidupkan kembali serangan setelah jeda. Jeda, dialog, kehilangan fokus, akhir pertandingan, dan reset membersihkan antrean input.
- Ketukan dash menjelang pulih disimpan maksimal 0,12 detik. Ketukan terlalu awal tidak berubah menjadi dash tertunda. Dash mendahului serangan jika kedua antrean siap bersamaan. Ketukan serang pada akhir dash dapat masuk ke buffer serangan 0,14 detik yang sudah ada. Tombol HUD, sentuh, dan Shift memakai permintaan dash yang sama.
- Arah gerak saat tombol serang ditekan ikut menentukan arah awal, lalu arah terkunci selama kontak. Pemeriksaan pedang dilakukan setelah perpindahan pemain pada langkah itu. Bonus balasan yang masih aktif ketika ayunan dimulai dipertahankan sampai kontak ayunan tersebut; pembatalan tidak memperpanjang masa bonus untuk ayunan berikutnya.
- Bar kecil pada penanda pemain menunjukkan pemulihan serangan. Outline tipis dari sprite asli memperjelas tubuh pemain ketika tertutup pasukan. Penanda pemain, status panglima, ancaman, lalu angka damage mendapat ruang menurut prioritas. Teks ringan dapat disembunyikan ketika ruang habis; posisi yang bergeser memiliki garis penghubung atau arah penunjuk yang sesuai.
- Penempatan indikator mempertimbangkan batas kamera dan kotak HUD, notifikasi, serta tombol sentuh. Ukuran indikator dihitung dalam piksel CSS agar tidak mengecil pada perangkat DPR 2. Angka damage diukur ulang hanya ketika teks/font berubah, dan maksimal delapan angka pasukan ringan ditampilkan bersamaan.
- Metadata sprite, pola air, daftar kedalaman scenery, dan koordinat buih pantai disiapkan sekali. Daftar unit untuk render digunakan ulang lalu digabung dengan scenery yang sudah terurut. Objek di luar kamera dilewati. Cache putih dan outline masing-masing dibatasi 32 frame. Resolusi Canvas memakai anggaran sekitar 2,4 juta piksel ketika DPR tinggi, dengan batas bawah skala resolusi 1.
- Profil per fungsi menemukan penggambaran unit sebagai sumber beban utama. `unit-frame-bounds.js` menyimpan batas alpha dari 81 sprite sheet unit asli. Cache memakai salinan frame pada resolusi asli, membuang padding transparan tanpa mengubah jangkar atau meresample piksel. Batasnya 512 frame dan 12 MiB piksel RGBA, dengan penggantian menurut pemakaian terakhir. Tidak ada pembacaan piksel saat combat, termasuk pada `file://`. Metadata dapat dibuat ulang melalui `node game-preview/browser-test.mjs --stress --export-bounds`; PNG asli tetap utuh. Tanpa metadata, renderer memakai seluruh frame sebagai fallback.
- Efek, benturan, dan teks memakai waktu simulasi tetap yang sama dengan combat, termasuk ketika diuji tanpa renderer. Daftarnya dibersihkan dengan pemadatan di tempat. Waktu kosong selama pause/berpindah fokus tidak dikejar saat melanjutkan, dan delta nonfinite tidak merusak accumulator.

Validasi tambahan:

- `node game-preview/combat-polish-test.cjs`: kepemilikan input, buffer/prioritas/expiry dash, serangan setelah dash, pembatalan/reset, balasan yang dimulai tepat waktu, delta tidak valid, replay visual 30/60/120 FPS, pembersihan efek, dan penempatan label.
- `node game-preview/browser-test.mjs --stress --polish-only`: tabrakan indikator/HUD pada kerumunan, ukuran CSS yang sama di DPR 1/2, anggaran piksel, keyboard bersama sentuhan, penolakan repeat setelah pause, jam dialog, dan tombol dash. Uji juga membandingkan piksel frame cache dengan sprite asli, memvalidasi seluruh kotak metadata, serta memeriksa batas dan pencatatan byte saat cache diganti.
- `node game-preview/browser-test.mjs --stress --soak-only`: 72.000 langkah atau 20 menit waktu game yang dipercepat, 29 unit, 20 siklus pause/lanjut, batas efek/cache/formasi, dan perbandingan heap setelah garbage collection. HP besar hanya dipasang dalam fixture pengembangan ini agar seluruh unit bertahan; laporan `stability-soak.json` bukan pertandingan manusia atau pengukuran FPS 20 menit.
- `performance-before-polish.json` menyimpan sesi pembanding sebelum revisi ini dengan seed fixture 77. `performance.json` menyimpan sesi akhir beserta hash game.js; hasil antar sesi tetap dipengaruhi beban komputer.
- Opsi tambahan `--profile-render` pada pengukuran browser mencatat waktu per fungsi beserta hit/miss cache ke `performance-profile.json`. Angkanya menyertakan overhead instrumentasi, sehingga dipisahkan dari pengukuran akhir tanpa instrumentasi per fungsi.

`polish-validation.json` merangkum hash file akhir dan pemeriksaan yang diselesaikan. Pada 24 frame pembanding cache, terdapat 101 piksel berbeda dari 45.099 piksel berisi (sekitar 0,224%, di bawah toleransi uji 0,5% untuk konversi/rasterisasi Canvas). Hasil ini menjaga pemeriksaan visual tetap terukur tanpa mengklaim kesamaan piksel mutlak. Skor 9,5 merupakan sasaran pemolesan tiga fokus tersebut; kenyamanan dan keseruan manusia tetap memerlukan uji bermain.
