# Triple Slash — rendering dan HUD Tahap 4

Baseline `f193d59`, branch `codex/triple-slash-visual`. Kontrak Chat 1:
`ab67626:docs/triple-slash-interface.md`, branch `codex/triple-slash-combat`.

## Keputusan visual

Kontrak menetapkan tiga kontak melee maju pada area SWING existing: reach 76,
radius 18, forward allowance −12, sapuan ±1,3 radian. Setiap tebasan berjalan
0,30 detik, kontak 0,16–0,28, total combo 0,90. Visual memakai origin kaki saat
ini dan sudut aktual setiap tebasan. Koreksi sudut antar-tebasan mengikuti combat;
renderer tidak membaca mouse mentah untuk memutar skill. Tidak ada proyektil atau
jarak tambahan di luar area hit kontrak.

Urutan I memakai satu busur gading, II memakai busur mint berjejak tipis ganda,
III memakai busur putih sian lebih tebal dengan dua garis dalam. Warna, jumlah
garis dan pips HUD membedakan urutan tanpa mengubah lebar collider. Setiap fill,
busur serta tekstur dipotong oleh footprint yang sama dengan geometri SWING.

Paket Particle FX telah diperiksa. Water Splash dipakai sebagai tekstur aksen
putih/mint pada kepala tebasan; tidak ada slash sprite mandiri. Dust/Explosion
existing tetap menangani dash/hit. Ikon silang pedang memakai Icon_05 existing.
Pose bersih Attack2 dipakai untuk tebasan kedua; I/III memakai Attack1. Hanya dua
frame anticipation masing-masing dipakai, sehingga sapuan horizontal tertanam
tetap dilewati. PNG asli tidak dimodifikasi, badan tetap tajam dan tegak.

## Kepemilikan dan wiring

- `src/triple-slash-visual.js` menyediakan `TripleSlashFx.drawSlash`, cancellation
  cue, dan controller `TripleSlashHud`. Semua menerima snapshot/port combat.
- Renderer membaca `combat.tripleSlashSnapshot()` sekali per draw, memakai
  hitArea dan `combat.swingAngle(slashElapsed)`. Hanya status active yang menggambar
  skill; completed/cancelled tidak dapat menghidupkan tebasan berikutnya.
- Renderer menghindari double draw basic swing untuk strike berjenis triple-slash.
  Cache jenis attack hanya metadata presentasi, bukan state skill.
- Slot desktop Q menampilkan syarat Bilah tingkat 10, Siap, cooldown, atau progres
  1–2–3. Tombol memanggil `combat.requestTripleSlash()`, tanpa menulis timer atau rank.
- Pembatalan menampilkan tiga garis patah dan lingkaran terputus selama 0,24 detik
  presentasi. Umurnya diturunkan dari penurunan cooldown snapshot sejak cancel,
  sehingga ikut membeku saat pause. Tidak ada setTimeout atau timer hit di visual.
- HUD menampilkan Dibatalkan bersama sisa cooldown; cooldown tetap milik combat.
- Q menjadi skill dan H menjadi bekal. Kbd, title dinamis, footer, dan Cara Main
  mengikuti binding ini. Slot disembunyikan di judul/hasil dan pada layout mobile.
- Slot dicadangkan sebagai rectangle overlay agar label/angka tidak menutupi HUD.

`tests/fixtures/triple-slash-visual-fixture.js` mengikuti POJO kontrak dan hanya
dimuat oleh tes eksplisit `--fixture`; tidak ada grant rank atau fixture pada
entrypoint produksi. Hasil uji aktual dan screenshot akhir dicatat setelah
commit runtime Chat 1 diintegrasikan.
