# Ekonomi dan progres kampanye — Tahap 1

Audit terhadap commit `6312d36`, repo Penjaga Pulau, 4 November 2026. Fokus perhitungan dan playtest desktop. Dokumen ini membedakan **kode saat ini**, **ekstrapolasi rumus**, dan **usulan**. Semua anggaran memakai emas sebagai satuan.

Draft `docs/campaign-design.md` dan `docs/campaign-contract.md` di branch Chat 1 `codex/campaign-design` sudah dibaca. Draft itu masih membatasi rank pada 10 dan mulai dari skill dash/riposte existing. **Perhitungan ini mengikuti brief terbaru, cap 10/20/25 dan enam konsep skill**, sehingga bagian tersebut perlu disinkronkan sebelum implementasi. Struktur tiga pulau/jembatan dan ID bab dari Chat 1 dapat memakai profile ekonomi ini.

## Keputusan awal yang disarankan

Gunakan 3 bab × 5 gelombang dengan harga rank saat ini sebagai model A untuk playtest pertama. Pertahankan biaya unlock yang diminta, 500 untuk Tier II dan 1.500 untuk Tier III, masing-masing dibayar **per jalur**. Dengan model ini, dua jalur tingkat 25 membutuhkan 17.750–18.125 emas. Contoh termahal adalah Bilah Bara dan Benteng Hidup.

Untuk membiayainya sebelum pertarungan terakhir, model A mengusulkan 23.300 emas terjamin sepanjang kampanye, termasuk 80 emas awal. Sebanyak 19.000 sudah diperoleh sebelum gelombang 5 Bab 3. Dua jalur utama termahal dan tiga rekrut berbayar per bab menghabiskan 18.530, sehingga masih tersisa 470 tanpa mining, pendapatan pasif, atau pickup loot.

Ini **perubahan besar pada hadiah**. Proyeksi tiga bab dengan hadiah kode sekarang hanya memberi 2.168 emas terjamin. Model A menaikkannya sekitar 10,75 kali. Dengan pasif dan anggaran loot konservatif, perbandingannya 3.173 menjadi 24.305, sekitar 7,66 kali. Tambang dan durasi yang lebih panjang tidak cukup menutup selisih tersebut pada tempo kampanye singkat. Alternatif harga rank yang lebih landai dibahas terpisah di bawah.

## 1. Audit kode saat ini

| Komponen | Angka dan perilaku kode saat ini |
| --- | --- |
| Struktur ekspedisi | Dua map, `island → crossroads`. Setiap arena memakai lima gelombang. Tiga bab belum tersedia. |
| Musuh reguler | 7, 10, 13, 16, 20 per gelombang, total 66 per arena. Panglima menambah satu musuh pada gelombang terakhir. |
| Hadiah gelombang | 30, 40, 50, 60, 70 emas, total 250. Juga +15 kayu, +1 bekal, dan pemulihan penjaga hingga 25 HP per gelombang. |
| Hadiah kill | Musuh reguler langsung memberi 6 emas, boss 50 emas, termasuk kill oleh sekutu. Masing-masing juga menjatuhkan resource senilai 5 dengan peluang sekitar 70% emas dan 30% kayu. |
| Pickup | Resource bertahan 18 detik, ditarik dalam radius 110 dan dipungut dalam radius 30 dari penjaga. Loot di tanah tidak sama dengan saldo terjamin. |
| Mining emas | **10.000 emas per aksi sukses**, berasal dari `GATHERING_REWARDS.gold`. Durasi kerja 0,9 detik dan jeda 0,18 detik. Tambang tidak habis dan tidak mempunyai tingkatan ekonomi. |
| Mining kayu/bekal | +8 kayu per kerja 0,9 detik. Domba +1 bekal per kerja 0,7 detik dan cooldown domba 12 detik. |
| Pendapatan pasif | +4 emas dan +3 kayu setiap 6 detik simulasi aktif, berlaku pada persiapan dan pertempuran. Tiga batu emas tidak menggandakan pendapatan ini. |
| Rekrutmen | Archer/Lancer/Warrior 40, Monk 55. Siklus Archer → Lancer → Monk → Warrior. Rekrut gratis pertama adalah Archer, sehingga tiga pembelian awal adalah Lancer 40, Monk 55, Warrior 40. Kapasitas hidup 8. |
| Kondisi awal | 80 emas, 40 kayu, 3 bekal, satu Archer gratis. Penjaga 100 HP, benteng 500 HP sebelum upgrade. |
| Harga upgrade | Harga dasar jalur + 20 × rank yang sudah dimiliki. Rank maksimum 10. Camp memperbolehkan beberapa pembelian selama jeda. |
| Perbaikan/pemulihan | Benteng +140 HP seharga 30 kayu. Bekal memulihkan hingga `45 + 5 × oath` HP. Monk sekutu memulihkan `16 + 2 × oath` pada penjaga dengan cooldown 3 detik. |
| Handoff | Emas dan rank dibawa, HP dipenuhi sesuai rank. Kayu, bekal dan sekutu dimulai ulang. Unlock tier, tingkat tambang dan milestone boss belum menjadi state perjalanan. |

Sumber audit adalah [konfigurasi](../src/config.js), [ekonomi](../src/economy.js), [director](../src/director.js), [combat](../src/combat.js), [session](../src/session.js), [upgrade](../src/upgrading.js), dan [ekspedisi](../src/expedition.js). Bonus skor kemenangan terpisah dari emas.

Nilai mining 10.000 adalah fakta pada baseline ini, bukan +50 dari versi lama. Satu aksi sudah membiayai satu jalur tingkat 25 beserta unlock menurut ekstrapolasi harga. Dua aksi memberi 20.000 emas dalam sekitar 2,16 detik kerja+jeda ideal. Angka tersebut perlu dinormalisasi sebelum menilai pacing ekonomi.

### Proyeksi baseline tanpa mining manual

Asumsikan tiap bab mengulang roster 66 musuh dan satu boss, dengan 300 detik simulasi aktif. Ini asumsi anggaran, bukan pengukuran durasi pertandingan. Persiapan bawaan 22 + 4 × 15 = 82 detik termasuk di dalamnya, sementara dialog camp/jeda tidak dihitung. Tombol Siap bertempur dapat memperpendek persiapan.

| Sumber | Per bab | Tiga bab |
| --- | ---: | ---: |
| Gelombang | 250 | 750 |
| Kill reguler | 396 | 1.188 |
| Boss langsung | 50 | 150 |
| Emas awal, hanya sekali | — | 80 |
| Total terjamin | 696 | **2.168 termasuk emas awal** |
| Pasif, 50 tick × 4 | 200 | 600 |
| Anggaran pickup konservatif | 135 | 405 |
| Anggaran total | 1.031 | **3.173 termasuk emas awal** |

Anggaran loot menggunakan 27 drop emas terambil per bab × 5. Dari 66 musuh reguler, peluang emas 70% dan asumsi pickup 60% menghasilkan 27,72 drop, lalu dibulatkan turun. Drop boss diabaikan karena permainan dapat berakhir sebelum dipungut. Nilai aktual berupa kelipatan lima dan bergantung posisi pemain. Pemasukan tanpa mining pada dua arena yang benar-benar tersedia sekarang lebih kecil daripada proyeksi tiga bab ini.

## 2. Biaya tingkat 1–25 dan syarat tier

Model A mempertahankan rumus harga kode. Untuk pembelian rank baru `n`, harga `P(n) = b + 20(n−1)`. Jumlah biaya rank hingga `N` adalah `S(N) = N×b + 10N(N−1)`. Biaya unlock ditambahkan ke jumlah tersebut.

| Jalur | b | Rank 1–10, kode | Rank 11–20, ekstrapolasi | Unlock II | Rank 21–25, ekstrapolasi | Unlock III | Total hingga 20 | Total hingga 25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bilah Bara / blade | 45 | 1.350 | 3.350 | 500 | 2.425 | 1.500 | 5.200 | 9.125 |
| Ritme Tempur / rhythm | 40 | 1.300 | 3.300 | 500 | 2.400 | 1.500 | 5.100 | 9.000 |
| Jejak Angin / wind | 35 | 1.250 | 3.250 | 500 | 2.375 | 1.500 | 5.000 | 8.875 |
| Balasan Embun / counter | 35 | 1.250 | 3.250 | 500 | 2.375 | 1.500 | 5.000 | 8.875 |
| Benteng Hidup / bastion | 40 | 1.300 | 3.300 | 500 | 2.400 | 1.500 | 5.100 | 9.000 |
| Sumpah Penjaga / oath | 40 | 1.300 | 3.300 | 500 | 2.400 | 1.500 | 5.100 | 9.000 |
| Keenam jalur | — | **7.750** | **19.750** | **3.000** | **14.375** | **9.000** | **30.500** | **53.875** |

Jumlah keenam jalur hingga 20 dihitung langsung dari setiap jalur pada tabel, yaitu **30.500**. Harga satu rank baru pada rentang II adalah `b+200` sampai `b+380`, lalu pada rentang III `b+400` sampai `b+480`. Unlock tidak menggantikan harga rank 11 atau 21.

Aturan usulan yang mengikuti brief berlaku per jalur.

- Tier I membatasi rank pada 10.
- Rank 10 dan boss Bab 1 yang sudah dikalahkan mengizinkan pembayaran 500 sekali untuk menaikkan batas ke 20.
- Rank 20 dan boss Bab 2 yang sudah dikalahkan mengizinkan pembayaran 1.500 sekali untuk menaikkan batas ke 25.
- Skill terbuka saat rank mencapai 10, berkembang saat 20 dan 25. Pembayaran unlock sendiri belum memberikan tahap skill berikutnya.
- Membuka kedua tier pada dua jalur memerlukan 4.000 emas. Membuka keduanya pada semua jalur memerlukan 12.000.

Model B sebagai alternatif harga memakai `P(n)=b+5(n−1)`, dengan unlock tetap 500/1.500. Blade 25 menjadi 4.625 dan Bastion 25 menjadi 4.500, total 9.125. Dua jalur matang dapat memakai anggaran kampanye sekitar 12–14 ribu dengan hadiah yang disusun ulang sebelum boss terakhir. Model ini mengurangi harga rank secara besar, termasuk tingkat 1–10. Semua tabel skenario berikut memakai **model A**, sehingga angka dari kedua model tidak dapat dicampur.

## 3. Usulan pemasukan model A

### Hadiah tetap per bab

Jumlah musuh tetap 66 reguler per bab untuk perhitungan ini. Pembagian jumlah di banyak pintu masuk mempertahankan total tersebut. Roster, rute, boss dan durasi final mengikuti desain Chat 1.

| Bab | W1 | W2 | W3 | W4 | W5 | Total gelombang | Emas/kill reguler | Total kill | Bonus boss | Total terjamin bab |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 350 | 450 | 550 | 650 | 750 | 2.750 | 10 | 660 | 500 | **3.910** |
| 2 | 700 | 900 | 1.100 | 1.300 | 1.500 | 5.500 | 15 | 990 | 1.000 | **7.490** |
| 3 | 1.200 | 1.500 | 1.800 | 2.100 | 2.400 | 9.000 | 20 | 1.320 | 1.500 | **11.820** |
| Total | | | | | | **17.250** | | **2.970** | **3.000** | **23.220** |

Tambah 80 emas awal sekali menjadi **23.300**. Pendapatan ini sama pada Santai, Normal dan Sulit untuk prototipe, sedangkan pengali combat dan skor kesulitan dapat diuji terpisah.

| Komponen anggaran | Bab 1 | Bab 2 | Bab 3 | Kampanye |
| --- | ---: | ---: | ---: | ---: |
| Hadiah terjamin | 3.910 | 7.490 | 11.820 | 23.220 |
| Emas awal | 80 | 0 | 0 | 80 |
| Pasif bawaan, 300 detik/bab | 200 | 200 | 200 | 600 |
| Pickup konservatif | 135 | 135 | 135 | 405 |
| Tambahan produksi tambang usulan | 0 | 300 | 800 | 1.100 |
| Total bruto untuk skenario | **4.325** | **8.125** | **12.955** | **25.405** |

Biaya pembangunan tambang masih harus dikurangkan. Mining manual adalah tambahan opsional dan bernilai nol pada tabel skenario.

### Bukti waktu belanja sebelum boss terakhir

Hadiah W5 Bab 3, kill 20 pasukannya, dan bonus boss berjumlah `2.400+400+1.500=4.300`. Angka itu baru tersedia pada atau setelah pertarungan terakhir. Anggaran yang bisa dipakai di persiapan W5 adalah **19.000 emas terjamin**.

`19.000 − (9.125+9.000) − 3×135 = 470`.

Dengan demikian, dua jalur termahal bisa mencapai 25 sebelum boss terakhir tanpa menunggu produksi atau pickup. Ini bukti kemampuan membeli, bukan bukti bahwa build tersebut cukup kuat untuk menang.

Untuk anggaran lengkap, asumsikan persiapan W5 Bab 3 tercapai pada detik aktif 220. Bab 3 sudah memberi 7.520 emas terjamin dari empat gelombang dan 46 kill, 144 pasif, 576 produksi rumah tambang, serta 95 loot konservatif dari 19 drop. Totalnya **8.335**. Sisa pemasukan Bab 3 yang datang kemudian adalah **4.620** dan tidak dipakai membuktikan kematangan build sebelum boss.

## 4. Tambang batu → pos → rumah tambang

Seluruh angka berikut adalah usulan. Perlakukan satu operasi tambang per arena sebagai satu sumber ekonomi dengan satu ID, walaupun ada tiga batu secara visual. Kuota dan produksi dibagi oleh ketiga node, sehingga tiga batu tidak menghasilkan tiga pabrik otomatis.

| Tahap | Ketersediaan | Belanja emas | Tambahan pasif di atas +4/6 detik bawaan | Manual per aksi | Kuota manual per bab |
| --- | --- | ---: | ---: | ---: | ---: |
| Batu | Awal Bab 1 | 0 | 0 | 25 | 20 aksi, maksimum 500 |
| Pos | Boss Bab 1 dikalahkan, camp Bab 2 | 150 | +6 setiap 6 detik | 35 | 20 aksi, maksimum 700 |
| Rumah tambang | Boss Bab 2 dikalahkan, pos dimiliki, camp Bab 3 | 250 tambahan | +16 setiap 6 detik | 45 | 20 aksi, maksimum 900 |

Total belanja hingga rumah adalah **400**, bukan 250. Pada 300 detik Bab 2 dan 3, tambahan pasifnya 300+800=1.100, sehingga keuntungan bersih kampanye 700. Payback pos adalah 150 detik. Payback upgrade rumah dihitung dari selisih +10/6 detik terhadap pos, juga 150 detik. Pembelian terlambat menjelang akhir bab mempunyai nilai ekonomi lebih rendah.

Usulkan pemindahan tingkat tambang antar-bab sebagai bagian perjalanan. Pada desain world berkelanjutan Chat 1, operasi yang sudah dibangun tetap ada. Nilai pasif yang dijanjikan baru mulai ketika bangunan aktif. Tabel mengasumsikan pembelian di awal bab, kuota manual baru per bab, dan maksimum 50 tick ekonomi per bab agar menahan satu musuh tidak menjadi strategi penghasil emas tanpa batas.

Draft map Chat 1 menambah `gold-north-01` dan `gold-southwest-01`. Kuota 20 aksi adalah total operasi untuk satu bab. Alokasi awal per ID dapat memakai 7/7/6 pada tiga batu utama di Bab 1, 5/5/4/6 pada tiga batu dan tambang utara di Bab 2, lalu 4/4/4/4/4 pada kelima node di Bab 3. Produksi otomatis juga tetap satu total operasi. Memberikan kuota penuh dan produksi penuh kepada setiap node memerlukan anggaran lain.

Sepuluh aksi manual per bab menambah 250+350+450=1.050 emas dan sekitar 32,4 detik kerja+jeda ideal sepanjang kampanye. Dua puluh aksi menambah maksimum 2.100. Perjalanan dan kerja yang batal menambah waktu aktual. Semua skenario utama memakai **nol aksi manual**.

Denah Chat 1 memperkirakan perjalanan 4,4 detik satu arah ke tambang utara dan 7,6 detik ke barat daya sebelum obstacle. Sepuluh aksi berarti sekitar 19,6 detik perjalanan pulang-pergi dan kerja di utara, atau 26 detik di barat daya. Usulkan persiapan bab 22/30/36 detik serta persiapan antar-wave 15 detik, dengan pilihan Siap bertempur. Angka perjalanan masih perkiraan geometri. Model 300 detik/bab sudah memasukkan persiapan ini.

Bangunan tambang memakai emas pada model ini. Biaya kayu tambahan belum dibebankan, karena kayu juga membiayai perbaikan benteng. Satu biaya kayu yang ditambahkan nanti harus masuk kembali ke anggaran perbaikan, posisi tambang, dan waktu berjalan.

## 5. Anggaran tiga pola bermain

Urutan vektor rank adalah **blade, rhythm, wind, counter, bastion, oath**. Rekrutmen awal tetap satu Archer gratis per bab. Emas awal 80 diberikan sekali per ekspedisi. Rank target akhir Bab 1/2 boleh diselesaikan pada camp persiapan bab berikutnya setelah hadiah boss dibukukan. Target akhir Bab 3 pada tabel sudah harus terjangkau di persiapan W5, bukan dibeli sesudah menang.

Asumsi rekrutmen tabel mengikuti reset arena prototipe sekarang. Draft world berkelanjutan Chat 1 mengusulkan sekutu hidup dan semua resource ikut dibawa. Kebijakan itu perlu dipilih secara eksplisit. Rincian survivor-carry di bawah memberi pembanding, sementara tabel mempertahankan biaya reset yang sudah bisa diaudit terhadap kode.

| Pola | Bab | Target rank | Belanja upgrade pada tahap ini, termasuk unlock | Rekrut | Tambang | Sisa saldo |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Dua jalur utama | 1 | 10,0,0,0,10,0 | 2.650 | 135 | 0 | **1.540** |
| Dua jalur utama | 2 | 20,4,4,4,20,4 | 8.730 | 135 | 150 | **650** |
| Dua jalur utama | 3 | 25,5,5,5,25,5 | 8.295 | 135 | 250 | **4.925** |
| Menyebar | 1 | 5,5,5,5,5,5 | 2.375 | 270 | 0 | **1.680** |
| Menyebar | 2 | 10,10,10,10,10,10 | 5.375 | 270 | 150 | **4.010** |
| Menyebar | 3 | 20,20,10,10,20,10 | 11.450 | 270 | 250 | **4.995** |
| Fokus pasukan | 1 | 5,5,5,5,10,5 | 3.275 | 565 | 0 | **485** |
| Fokus pasukan | 2 | 5,5,5,5,20,10 | 4.700 | 660 | 150 | **3.100** |
| Fokus pasukan | 3 | 5,5,10,5,25,20 | 8.575 | 740 | 250 | **6.490** |

Saldo adalah sisa yang dibawa setelah pendapatan bruto bab dan belanja bab tersebut, bukan tambahan emas baru. Rank target adalah rencana belanja, bukan paket upgrade gratis saat transisi.

| Ringkasan | Dua jalur utama | Menyebar | Fokus pasukan |
| --- | ---: | ---: | ---: |
| Upgrade total | 19.675 | 19.200 | 16.550 |
| Rekrut total | 405 | 810 | 1.965 |
| Tambang total | 400 | 400 | 400 |
| Total belanja | **20.480** | **20.410** | **18.915** |
| Sisa sebelum W5 Bab 3 | **305** | **375** | **1.870** |
| Sisa sesudah kampanye | **4.925** | **4.995** | **6.490** |

Rincian pasukan mengikuti siklus kode. Pola dua jalur membeli tiga unit per bab, 135 emas, sehingga ada empat sekutu bila semuanya hidup. Pola menyebar membeli enam unit per bab, 270 emas, sehingga ada tujuh sekutu. Pola pasukan mengasumsikan usulan kapasitas 10/12/14 dan membeli 9/11/13 unit selain Archer gratis, seharga 390/485/565. Empat pengganti akibat korban menambah 175 per bab, menghasilkan 565/660/740 pada tabel. Pengganti hanya direkrut setelah slot kosong. Totalnya 45 rekrut berbayar, termasuk 12 pengganti.

Pada pola pasukan, prioritaskan Bastion hingga membuka slot sebelum mengisi garnisun. Target Oath/utility lain dapat menyusul. Pada pola dua jalur, empat jalur pendukung tingkat 5 adalah belanja opsional. Tanpa pickup, pangkas setidaknya satu rank pendukung bila saldo sebelum boss kurang, sementara bukti dua jalur utama tetap memakai pemasukan terjamin.

Keenam jalur tingkat 20 memerlukan **30.500**, dan keenam jalur tingkat 25 memerlukan **53.875**, sebelum rekrutmen/tambang. Anggaran ini mendukung spesialisasi dan pilihan pasukan. Saldo fokus pasukan yang lebih besar juga menunjukkan bahwa harga rekrut 40/55 menjadi murah dibanding upgrade akhir. Uji jumlah korban dan kekuatan garnisun dahulu sebelum menambah ongkos rekrut.

Jika sekutu hidup dibawa, profil pasukan dengan empat korban per bab hanya memerlukan 13/6/6 rekrut berbayar, total 25, untuk mengisi kapasitas 10/12/14. Dengan siklus jenis unit terus berjalan dan tanpa Archer gratis tambahan, biayanya 565/270/255, total **1.090**, atau 875 lebih rendah. Saldo akhirnya menjadi **7.365** dengan asumsi lain sama. Profil menyebar harus memperlakukan belanja rekrut sebagai cadangan pengganti ketika cap penuh, bukan memaksa pembelian enam unit baru tiap bab. Pembawaan sekutu memperbesar cadangan emas dan kekuatan awal bab, sehingga hasil tempurnya perlu diuji terpisah.

## 6. Audit rumus combat tingkat 11–25

Kode membatasi rank pada 10. Kolom 11–25 berikut hanya menunjukkan akibat menaikkan batas tanpa mengganti rumus.

| Rumus lama | r10, tersedia | r11, ekstrapolasi | r15 | r20 | r25 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cooldown pedang, detik | 0,319 | 0,3016 | 0,232 | 0,145 | 0,058 |
| Cooldown dash, detik | 0,75 | 0,67 | 0,35 | −0,05 | −0,45 |
| Damage utama | 77 | 82 | 102 | 127 | 152 |
| HP penjaga | 250 | 265 | 325 | 400 | 475 |
| HP benteng | 1.300 | 1.380 | 1.700 | 2.100 | 2.500 |
| Pengurangan damage benteng | 40% | 40% | 60% | 80% | 100% sebelum batas minimum 1 damage |
| Pengurangan tetap damage penjaga dekat benteng | 20 | 22 | 30 | 40 | 50 |
| Radius perlindungan | 360 | 380 | 460 | 560 | 660 |
| Cooldown bekal, detik | 1,2 | 1,2 | 0,9 | 0,6 | 0,3 |

Rumus cooldown pedang saat ini adalah `0.58 × (1 − .06×min(5,r) − .03×max(0,r−5))`. Hit window tetap pada detik 0,16–0,28. Pada r20, cooldown sudah lebih pendek daripada awal hit window. Menahan Spasi dapat memulai ayunan baru sebelum ayunan sebelumnya sempat mengenai sasaran, sehingga pembagian damage/cooldown bukan estimasi DPS yang sah.

Pengurangan damage penjaga saat ini adalah pengurangan tetap, dengan minimum satu damage. Di Normal, pukulan reguler gelombang terakhir berkisar 18 damage, atau 21 untuk Lancer. Bastion r10 sudah dapat meredamnya menjadi 1. Pukulan boss Normal 22/24/27 menjadi 2/4/7. Pada r15 semuanya dapat menjadi 1. Pengurangan benteng memakai `floor(r/5)×20%`, sehingga r25 juga menerima satu damage per pukulan.

Bonus lain yang ikut membesar adalah jumlah sasaran ayunan `3+floor(blade/5)`, kecepatan gerak saat ayunan `.55+.1×floor(rhythm/5)`, bonus counter `12+6r+8×floor(r/5)`, dan durasi counter `2+.5r`. Pada r25, hasilnya 8 sasaran, gerak 105% sebelum interpolasi, bonus counter 202, serta penyimpanan counter 14,5 detik. Durasi dash tetap 0,2 detik walaupun rumus kebalnya melewati nilai itu.

### Usulan batas dan diminishing returns

Untuk suatu jalur, definisikan `a=min(r,10)`, `b=min(max(r−10,0),10)`, dan `c=min(max(r−20,0),5)`. Semua hasil dihitung dari rank dan status, sehingga memuat ulang arena tidak menambahkan buff lagi.

| Komponen | Rumus/aturan usulan |
| --- | --- |
| Damage utama | `27 + 5a + 2b + c`. |
| Damage sekunder | `round(18 + 3a + b + .5c)`. |
| HP penjaga | `100 + 15a + 8b + 4c`. |
| HP benteng | `500 + 80a + 40b + 20c`. |
| Cooldown pedang | `max(.30, .58×(1−.06×min(r,5)−.03×min(max(r−5,0),5))−.0014b−.001c)`. |
| Gerak saat ayunan | Batasi pada 85% gerak normal, termasuk efek Irama Baja. |
| Sasaran normal | Batasi milestone lama pada `min(2,floor(r/5))`, sehingga ayunan normal maksimum lima sasaran. |
| DR penjaga dekat benteng | Ganti pengurangan tetap dengan `min(.35,.02a+.01b+.01c)`. Total DR dari semua buff dibatasi 35%. |
| DR benteng | `min(.50,.04a+.005(b+c))`, lalu minimum satu damage setelah pembulatan. |
| Radius perlindungan | `min(360,160+20a)`. |
| Bonus counter dasar | `12+6a+2b+c+8×min(2,floor(r/5))`. Durasi simpan `min(4,2+.2r)` detik. |
| Bekal | Pemulihan `45+5a+2b+c`, cooldown minimum 1,2 detik. |
| Monk ke penjaga | Pemulihan `16+2a+.5b+.2c` per cast, cooldown 3 detik. |

| Titik rank usulan | r10 | r11 | r15 | r20 | r25 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cooldown pedang, detik | 0,319 | 0,3176 | 0,312 | 0,305 | 0,300 |
| Damage utama | 77 | 79 | 87 | 97 | 102 |
| HP penjaga | 250 | 258 | 290 | 330 | 350 |
| HP benteng | 1.300 | 1.340 | 1.500 | 1.700 | 1.800 |
| DR penjaga | 20% | 21% | 25% | 30% | 35% |
| DR benteng | 40% | 40,5% | 42,5% | 45% | 47,5% |

Perubahan perlindungan penjaga adalah retuning, termasuk pada rank 1–10. Pada r25, pukulan boss Normal 24 menjadi sekitar 16 damage dengan pembulatan akhir, sehingga telegraph masih perlu dihindari. Batas cooldown 0,30 menyisakan hit window penuh, dan jeda antarayunan melebihi stagger musuh reguler 0,12 detik. Nilai ini tetap perlu diuji bersama posisi dan serangan banyak musuh.

Pertahankan pemeriksaan garis pandang, dash yang bertabrakan dengan pantai/penghalang, buffer input 0,12 detik, serta invulnerability 0,45 detik sesudah terkena pukulan sebagai titik kontrol playtest. Boss saat ini mempunyai warning Normal 0,9 detik, recovery dasar 1–1,15 detik, minimum 0,85 detik, pengali damage sekutu 55% ketika tertutup, dan bonus damage penjaga 30% ketika recovery. Rumus baru perlu diuji di jendela tersebut. Damage sekutu tetap 17 untuk panah dan 18 untuk pukulan sebelum modifier boss.

## 7. Perkembangan enam konsep skill

Nama dan konsep mengikuti brief. Angka aktivasi berikut merupakan **rekomendasi ekonomi/combat untuk playtest**, yang perlu diselaraskan dengan kontrak skill Chat 1. Tahap skill adalah 0 sebelum rank 10, lalu 1/2/3 pada rank 10/20/25. Fungsi milestone setiap lima rank yang lama perlu dipisahkan dari tahap skill baru.

| Jalur / konsep | Tingkat 10 | Tingkat 20 | Tingkat 25 | Batas yang diuji |
| --- | --- | --- | --- | --- |
| Blade — Triple Slash | Tiga ayunan berurutan selama sekitar 0,9 detik, tiap hit 100% damage utama, cooldown 8 detik | Tiap hit 105%, cooldown 7 detik | Tiap hit 110%, cooldown 6 detik | Maksimum lima sasaran tiap ayunan. Bonus counter hanya sekali. Dash dapat membatalkan sisa combo dengan cooldown skill tetap terpakai. |
| Rhythm — Irama Baja | Mode 3 detik, gerak ayunan hingga 80%, tahan satu stagger biasa | Mode 4 detik, gerak hingga 82,5% | Mode 5 detik, gerak hingga 85% | Cooldown 12 detik, cooldown pedang tetap ≥0,30. Damage dan knockback masih berlaku, serangan boss tetap dapat menginterupsi. |
| Wind — tiga charge dash | Kapasitas tiga charge, recharge serial 2,4 detik per charge | Recharge 2,2 detik | Recharge 2 detik | Jarak antar-start dash ≥0,6 detik, kebal maksimum 0,16 dari durasi 0,2 detik, tanpa refund charge karena kill. |
| Counter — Pembaca Celah | Tanda recovery musuh dan indikator counter yang siap | Bonus counter dasar +10% bila serangan balasan masuk pada recovery | Bonus counter dasar +20% pada recovery | Pengali hanya pada komponen bonus counter. Konsumsi satu counter pada hit valid pertama, waktu simpan maksimum 4 detik. |
| Bastion — kapasitas garnisun | Tambahan dua slot, total 10 | Tambahan empat slot, total 12 | Tambahan enam slot, total 14 | Rekrut tetap berbayar dan slot terisi unit hidup. Slot baru tidak menciptakan pasukan gratis. |
| Oath — zona pemulihan | Radius 110, 4 HP/detik selama 4 detik | Radius 125, 5 HP/detik selama 5 detik | Radius 140, 6 HP/detik selama 6 detik | Cooldown 18 detik. Satu zona, berlaku pada penjaga/sekutu. Pemulihan benteng tetap melalui kayu. |

Charge dash tiga buah merupakan persediaan burst. Recharge berjalan serial, sehingga tiga dash tidak kembali sekaligus. Kebal maksimum 0,16 dan jeda start 0,6 menyisakan setidaknya 0,4 detik tanpa dash di antara pemakaian. Pergantian dari cooldown tunggal rank 10 menjadi sistem charge perlu diperlakukan sebagai retuning tersendiri.

Untuk menghindari penumpukan banyak Monk dan zona, usulkan batas gabungan pemulihan pasif/Monk/zona ke penjaga sebesar 4% maxHP per detik. Bekal tetap dihitung terpisah karena mengonsumsi resource. Pada r25, batas tersebut 14 HP/detik. Tetap uji suplai domba dan bekal, karena sumber bekal sekarang dapat digunakan berulang.

Garnisun 14 juga meningkatkan DPS dan biaya simulasi. Penambahan slot tidak cukup dinilai dari emas. Target awal uji adalah boss masih memperagakan ketiga pola dan bertahan sekitar 20–35 detik pada build matang yang dimainkan dengan baik. Bila burst menghapus satu boss dalam satu recovery, tinjau koefisien skill serta pengali recovery bersama Chat 1.

## 8. Implikasi kontrak progres bagi Chat 1

Kebutuhan ekonomi yang perlu diakomodasi kontrak teknis adalah urutan tiga ID bab/map, identitas boss yang sudah dikalahkan, rank 0–25, unlock II/III per jalur, serta tingkat operasi tambang. Emas akhir dibawa sekali, termasuk reward boss/gelombang yang sudah dibukukan. State tier tidak dapat disimpulkan hanya dari rank 10 atau 20, sebab pemain mungkin belum membayar unlock.

Pemetaan ke draft profile Chat 1 berikut menghindari pemasukan ganda.

| Parameter profile | Isian/kebutuhan usulan ekonomi |
| --- | --- |
| `economy.startingResources` | `{gold:80, wood:40, food:3}`, sekali pada kampanye baru. |
| `economy.waveReward.cN-wM` | Emas sesuai 15 sel tabel hadiah, kayu 15 dan bekal 1 per wave seperti baseline. |
| `economy.bossReward.boss-chapter-N` | Emas 500/1.000/1.500, resource lain nol. |
| `economy.chapterReward.chapter-N` | Wallet nol eksplisit. Hadiah bab sudah tercakup pada wave dan boss. |
| `economy.upgradeCost.<upgradeId>` | Perlu 25 Wallet berindeks target rank, menggantikan array 10 pada draft. |
| `progression.tierCap.tier-1/2/3` | 10/20/25, dengan transaksi unlock berbayar per jalur dan flag pembayarannya. |
| `economy.skillUnlock.<skillId>` | Skill rank 10/20/25 tidak menarik harga emas tambahan. Bentuk akses harus dapat merujuk rank. |
| `economy.mineYield.<mineId>` | Yield mengikuti tingkat operasi 25/35/45. Kontrak perlu tingkat operasi bersama dan produksi otomatis. |
| `economy.mineCharges.<mineId>` | Bagi kuota total 20 sesuai alokasi node, bukan 20 per node. |
| Rekrut dan penduduk | Biaya 40/55, pasif `{gold:4,wood:3,food:0}` setiap 6 detik, ditambah produksi operasi tambang terpisah. |
| Timing | Bab 22/30/36 detik, antar-wave 15, kerja tambang 0,9 dan gap 0,18 detik. |

Kontrak juga perlu sumber reward kill reguler per bab sebesar 10/15/20. Boss menerima bonus boss sekali, bukan bonus boss ditambah bounty reguler. Reward wave, boss dan chapter memakai ledger key terpisah. Kolom total terjamin memakai 66 bounty reguler dan satu bonus boss, lalu chapter reward nol.

Gunakan camp persiapan bab berikutnya untuk membelanjakan hasil bab sebelumnya. Pemain dapat melengkapi rank 10/20 lalu membayar unlock pada camp itu. Bedakan flag boss dikalahkan dengan status menang bab supaya kekalahan atau callback berulang tidak memberikan bonus boss maupun unlock dua kali.

Asumsi utama tabel memakai pemulihan penuh dan kondisi awal kayu/bekal/sekutu dari prototipe dua arena. Bila dipertahankan, pemulihan penuh dapat dinyatakan sebagai tambahan 350 HP penjaga dan 1.800 HP benteng pada profile recovery, kemudian dibatasi ke maxHP aktual dari rank. Bila usulan Chat 1 membawa HP aktual dan survivor-carry dipilih, ganti kebijakan recovery dan pakai pembanding biaya pasukan di bagian 5. Tingkat tambang dan unlock perlu ikut dibawa, sementara timer produksi direset dan tidak menghitung waktu loading, menu, dialog, atau halaman ditutup.

## 9. Skenario verifikasi dan playtest desktop

| Skenario | Kriteria penerimaan |
| --- | --- |
| Audit baseline | Konfigurasi mining terbaca 10.000, roster 66+1, reward gelombang 250, dan cap rank 10. Angka tersebut dicatat sebelum menerapkan usulan. |
| Harga dan unlock | Cek pembelian rank 10/11/20/21/25, saldo persis cukup dan kurang satu emas. Gate 500/1.500 hanya ditarik sekali pada jalur yang memenuhi syarat boss dan rank. |
| Progres boss | Rank 10 tanpa kemenangan boss Bab 1 menahan Tier II. Boss Bab 2 tanpa rank 20 menahan Tier III. Kekalahan dan pemanggilan akhir berulang tidak memberi reward ulang. |
| Fokus dua jalur, tanpa tambang | Nol mining manual, nol bangunan, nol pickup, tiga rekrut per bab. Dua jalur termahal mencapai 25 di persiapan W5 Bab 3 dengan saldo minimum 470 menurut roster model A. |
| Tiga profil | Jalankan sembilan baris anggaran dengan urutan beli yang legal. Saldo akhir model adalah 4.925 / 4.995 / 6.490. Pastikan hadiah terakhir tidak membiayai pembelian sebelum boss. |
| Sensitivitas | Ulangi pickup 0%, 60%, 100%, bab 180/300/360 detik, dan korban dua kali lipat. Pendapatan terjamin tidak berubah karena waktu. Tambang memakai tick aktual sampai batas 50. |
| Tambang | Satu ID ekonomi meski tiga batu. Cek 20/21 aksi, pembangunan terlambat, carry tingkat, pause/loading, dan batas tick. Bayar rumah 250 sebagai upgrade setelah pos 150. |
| Pedang 11–25 | Tahan Spasi pada rank 11/15/20/25 selama 30 detik. Serangan tetap mempunyai kontak pada 0,16–0,28, cooldown ≥0,30, dan combo tidak menumpuk counter. |
| Charge dan defense | Habiskan tiga dash lalu tahan tombol. Recharge serial, start gap ≥0,6, iframe ≤0,16. Boss 24 damage masih menimbulkan sekitar 16 pada DR35%, benteng tidak menerima satu damage untuk semua serangan. |
| Heal dan garnisun | Uji 14 sekutu dengan beberapa Monk dan satu zona, bekal terpisah, benteng rusak, serta perekrutan saat cap penuh. Pemulihan dan jumlah unit mengikuti batas yang dipilih. |
| Boss/build matang | Uji 15 pasangan jalur dan profil pasukan. Catat waktu kill, pola yang sempat keluar, damage yang dihindari, dan apakah pemain masih perlu membaca warning. |
| Performa desktop | Catat p95 waktu simulasi dan frame pada mesin target, termasuk 14 sekutu, boss, gelombang reguler maksimum, proyektil dan zona. Sasaran awal p95 simulasi <4 ms dan p95 frame ≤20 ms pada layar 60 Hz. |

Perhitungan harga, subtotal per bab, saldo profil, ambang sebelum boss, dan tabel rumus diperiksa dengan Node.js memakai nilai konfigurasi baseline. Dokumen ini belum merupakan hasil pertandingan kampanye yang dijalankan, karena tiga bab dan skill baru masih rancangan.

## Kesimpulan untuk keputusan Tahap 1

Biaya 500/1.500 per jalur dapat dipakai, dengan konsekuensi yang jelas. Pada model harga rank sekarang, sasaran dua jalur matang memerlukan kenaikan hadiah besar dan penempatan sebagian besar uang sebelum boss terakhir. Mengandalkan pasif lama untuk menutup kekurangan dua jalur beserta rekrutmen akan menambah sekitar enam jam waktu simulasi. Rekomendasi tempo awal tetap sekitar 15 menit aktif untuk tiga bab, lalu disetel melalui playtest.

Pilih satu kurva harga dan satu paket hadiah untuk eksperimen pertama. Model A di dokumen ini mempertahankan harga rank dan mengubah pemasukan. Model B mengurangi kenaikan harga rank, kemudian memerlukan paket hadiah tersendiri. Keduanya memerlukan normalisasi mining 10.000, aturan tier yang persisten, dan penggantian rumus 11–25 yang saat ini tidak aman.
