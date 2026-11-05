# Bidikan dan visual serangan desktop — Tahap 3

Basis: main `12b7c22`. Branch visual: `codex/mouse-combat-visual`.
Kontrak input/combat: `codex/mouse-combat@fc9c29b:docs/aim-interface.md`.
Commit runtime Chat 1 **3ef7dfa** digabung melalui **05c96fc**. Seluruh berkas
produksi sekarang lokal pada worktree ini; screenshot akhir diambil dari
`index.html` hasil gabungan, tanpa merujuk ke worktree lain.

## Mencoba

Buka `index.html` lewat file:// atau server HTTP, pilih Mulai Ekspedisi atau Latihan
Map 2, lalu Berangkat. Gerakkan mouse di arena: chevron menunjukkan arah bidikan.
Klik kiri atau tahan Spasi untuk menyerang. WASD/panah menggerakkan pemain tanpa
mengubah arah mouse aim. U membuka upgrade pada jeda; P menjeda.

## Audit dan keputusan pose

Renderer lama memakai `hero.y−23` sebagai pusat arc, sementara hit berpusat di
koordinat kaki `(hero.x,hero.y)`. Arc hanya dicerminkan oleh swingFacing ±1;
ketebalan garis 3,5 px tidak menunjukkan radius kontak 18 px. Sprite Warrior Blue
Attack1/Attack2 masing-masing berisi empat frame horizontal. Frame kontak dan
recovery sudah memuat sapuan putih ke samping. Memutar seluruh sprite ke sudut
strike akan memiringkan kepala, badan dan bayangan kaki.

Visual baru memakai badan yang tetap tegak, cermin kiri/kanan berdasarkan sudut
bidikan efektif, serta sapuan terpisah pada bidang world. Dua frame anticipation
Attack1 yang bersih dipakai untuk pose angkat/siap pedang. Frame dengan sapuan
horizontal tertanam dilewati agar tidak menyatakan arah hit kedua. Saat bergerak
sesudah kontak, badan kembali ke Run existing. PNG asli tidak dimodifikasi;
imageSmoothingEnabled tetap false, posisi sprite dibulatkan seperti renderer lama.

Tidak tersedia torso Warrior menghadap belakang/depan, serangan vertikal atau
diagonal, maupun animasi langkah mundur. Arah atas/bawah disampaikan oleh indikator
dan efek world, sementara badan masih 2-arah. Langkah mundur memakai Run dengan
badan menghadap bidikan; gerak kaki belum menjadi backpedal khusus. Mengangkat
pedang menggantikan pose kontak lengkap; ini kompromi aset, bukan animasi 8-arah.

## Integrasi renderer

- `src/aim-visual.js` adalah classic script lokal yang dimuat sebelum renderer.
  `AimVisual.drawSwing(ctx, visual)` menerima origin dan angle eksplisit; helper
  tidak membaca atau menulis state input/combat.
- `renderer.drawHeroSwing()` membaca `combat.heroAttackOrigin()`,
  `combat.heroAttackAngle()`, `heroAttackAge()`, `combat.swingAngle(age)` dan
  konfigurasi SWING. Ia tidak
  membentuk sumbu serangan dari facing atau mouse mentah.
- `renderer.drawAimIndicator()` membaca `hero.aimAngle`. Indikator berupa satu
  chevron dengan garis gelap dan inti terang; warnanya tetap terbaca pada tanah
  terang/gelap. Chevron adalah petunjuk arah, bukan penentu target yang akan kena.
- Badan menggunakan cos(aimAngle) untuk cermin kiri/kanan. Di sekitar sumbu vertikal
  (|cos|<0,08), arah badan sebelumnya dipertahankan untuk menghindari flip kecil.
  Cache arah badan ini milik renderer, tanpa mutasi hero.facing atau hero.aimAngle.
- Penataan label mencadangkan ruang chevron sebelum menaruh label KAMU, ancaman,
  dan angka combat. Ini mencegah bidikan atas menyatu dengan penunjuk label pemain.
- Selama strike hidup, aimAngle efektif dan sudut arc mengikuti kontrak lock.
  Setelah kontak, indikator/badan dapat mengikuti bidikan baru; ekor arc tetap
  memakai sudut strike terakhir dari port combat.

## Geometri dan timing

| Parameter | Nilai dari combat existing |
| --- | ---: |
| Origin | Posisi kaki pemain saat ini, mengikuti geraknya |
| Reach | 76 world px |
| Radius kontak | 18 px; diameter visual pita 36 px |
| Batas radial | 94 px |
| Forward minimum | −12 px pada sumbu strike |
| Sapuan | −1,3 sampai +1,3 radian relatif terhadap sumbu strike |
| Windup | 0–0,16 detik |
| Kontak | 0,16–0,28 detik |
| Afterimage visual | Maksimum 0,08 detik setelah kontak; tidak menambah hit |

Footprint menggambar union sektor dan strip pada kedua ray batas, lalu memotong
hasilnya terhadap lingkaran radius 94 serta gate forward −12. Ini mewakili padding
angular asin(radius/distance) yang dipakai combat. Windup menampilkan potensi
sapuan samar; saat kontak, isi menunjukkan bagian yang sudah disapu dan kepala
pedang bergerak mengikuti progress yang sama. Warna mint menandai empowerment;
miss memakai garis putus abu-abu existing. Hit tetap diputuskan oleh combat,
termasuk cover/navigation.clearPath, cap sasaran dan sasaran yang sudah terkena.
Gambar footprint adalah area geometris potensial; tidak menjanjikan damage ke
seluruh unit di dalamnya atau menembus cover.

Indikator disembunyikan di judul, hasil akhir, dialog, dan saat bekerja. Saat pause
biasa ia meredup dan mengikuti sudut efektif terakhir yang dibekukan oleh input.
Efek tidak menggunakan jam renderer untuk menambah usia strike. Kamera, CSS rect
dan DPR ditangani oleh transform world existing, tanpa offset dada atau mirror
pada efek 360°.

## Pemeriksaan

Pemeriksaan akhir pada 5 November 2026, Node 24 dan Chrome desktop:

```powershell
node tests/mouse-combat-visual-browser-test.mjs --screenshots docs/mouse-combat-screenshots
node tests/mouse-combat-test.mjs
node tests/mouse-combat-browser-test.mjs
node tests/camera-test.cjs
node tests/menu-browser-test.mjs
```

`CHROME_PATH` dapat menunjuk executable Chrome lain. Tidak diperlukan npm install
atau koneksi jaringan luar. Browser test memakai profil sementara dan event mouse/
keyboard nyata dari DevTools. RAF dihentikan agar scene dan usia strike dapat
dikendalikan: musuh diletakkan diam, combat/simulation asli tetap dipakai.
Ini uji deterministik visual/hit, bukan hasil pertandingan penuh atau playtest rasa
kontrol manusia.

| Pemeriksaan | Hasil akhir |
| --- | --- |
| Desktop | 1280×720 DPR 1, 1440×900 DPR 1,25, dan 1920×1080 DPR 2: lulus |
| Raster vs hit | 49.578 sampel per viewport, **148.734 total**; 12 sumbu termasuk sudut non-kardinal/seam ±π dan lima usia kontak. Interior/exterior solid raster footprint cocok dengan combat.swingContact; pixel tepi antialias dilewati |
| Damage aktual | Delapan arah × tiga viewport: 24 strike. Sasaran 60 px di depan menerima 27 damage; sasaran di belakang dan 104 px di luar jangkauan tidak terkena. Windup tidak memberi damage |
| Gerak berlawanan | Jalan ke kiri sambil membidik kanan mempertahankan facing badan kanan. Attack sambil berjalan memakai origin kaki yang bergerak, tanpa mengubah sumbu strike |
| Lock/recovery | Pointer bergeser selama strike tidak mengubah indikator/arc/badan. Setelah kontak, indikator boleh berubah sementara afterimage/miss tetap memakai sumbu lama |
| Pause/upgrade | Usia efek membeku saat pause. Chevron disembunyikan di dialog. Beli Blade dan tutup upgrade: input kembali, tidak ada afterimage kedaluwarsa |
| Kamera X/Y | Fixture koordinat 4096×3072 cukup besar untuk kedua sumbu pada semua aspek. Pointer diam dan indikator tetap cocok sesudah kamera bergerak. Fixture tidak dipakai sebagai arena playable dan tidak menjalankan collision World lama pada koordinat besar |
| Resize | Arena yang sama diubah ke 1100×1000 DPR 1,25, 1920×1080 DPR 2, lalu 1280×720; proyeksi mouse tetap cocok dan backing canvas valid |
| Keterbacaan | Probe path-only pada latar #c5c78b dan #10263b mendeteksi inti terang serta outline gelap. Label pemain tidak menutupi indikator pada seluruh arah uji |
| Sprite | Frame kontak horizontal tertanam tidak dipakai, imageSmoothingEnabled=false setelah resize, cermin kiri/kanan mengikuti arah efektif |
| Combat headless | Suite Chat 1: 823 pemeriksaan/72 sumbu, damage/rank/cap/counter/cover/air/reset: lulus |
| Entry normal | Suite Chat 1 pada index.html hasil gabungan: file:// DPR 1 dan HTTP DPR 2, hold/UI/drag/cover/air/kamera: lulus |
| Kamera existing | Clamp, skala viewport terpisah dari world, konversi bolak-balik dan culling: lulus |
| Regresi menu | Keyboard desktop, touch, touch-small, touch-landscape, dialog, latihan, carry emas/keenam rank serta fresh expedition: lulus |

Suite browser visual berakhir dengan **nol exception JavaScript dan nol aset gagal
dimuat**. Port visual tidak mengubah config, harga, cooldown, damage, cap atau buff.
Screenshot diambil pada viewport CSS 1440×900, DPR 1,25. Berkas detail memakai clip
browser scale 2; tidak mengubah PNG sprite asli.

## Evaluasi pose dan screenshot

| Kondisi | Penilaian | Screenshot detail |
| --- | --- | --- |
| Atas | Chevron berada di atas kepala, label KAMU berpindah ke samping. Arc naik dari origin kaki; torso tetap horizontal | [Atas](mouse-combat-screenshots/strike-up-detail.png) |
| Bawah | Chevron terpisah dari kaki dan area kontak terlihat di depan pemain. Tidak ada pose torso frontal khusus | [Bawah](mouse-combat-screenshots/strike-down-detail.png) |
| Diagonal kanan atas | Body dicerminkan kanan; busur tidak dikuantisasi menjadi horizontal/vertikal | [Diagonal](mouse-combat-screenshots/strike-up-right-detail.png) |
| Diagonal kiri bawah | Body dicerminkan kiri; footprint/timing sama setelah rotasi | [Diagonal](mouse-combat-screenshots/strike-down-left-detail.png) |
| Jalan mundur sambil menyerang | Body tetap menghadap kanan, origin efek mengikuti gerak ke kiri. Kaki masih memakai Run biasa | [Mundur](mouse-combat-screenshots/backward-attack-detail.png) |
| Recovery dan bidikan baru | Chevron kiri terpisah dari ekor strike kanan yang memudar | [Recovery](mouse-combat-screenshots/recovery-new-aim.png) |

Screenshot penuh delapan arah juga tersedia dalam folder yang sama dengan nama
`strike-right/down-right/down/down-left/left/up-left/up/up-right.png`.

Keterbatasan yang tetap: posisi pedang pada frame badan bersih tidak selalu sejajar
sempurna dengan arah bidikan, terutama atas/bawah. Busur dan chevron menjadi acuan
arah dan kontak. Renderer menggambar geometri potensial, belum menggambar bayangan
cover pada footprint; combat tetap menolak target di balik cover. Rasa backpedal,
kepadatan efek dalam rombongan, serta kecukupan gesture antisipasi perlu playtest
manusia. Sprite Warrior tambahan yang memiliki pose atas/bawah/diagonal diperlukan
untuk mengganti kompromi dua arah ini.
