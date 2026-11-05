# Bidikan dan visual serangan desktop — Tahap 3

Basis: main `12b7c22`. Branch visual: `codex/mouse-combat-visual`.
Kontrak input/combat: `codex/mouse-combat@fc9c29b:docs/aim-interface.md`.

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
  `combat.heroAttackAngle()`, `heroAttackAge()` dan konfigurasi SWING. Ia tidak
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

Hasil gabungan, screenshot dan hash dependensi diperbarui setelah commit runtime
Chat 1 tersedia. Entry point tetap `index.html`, mendukung file:// dan HTTP.
