# Triple Slash — rendering dan HUD Tahap 4

Baseline `f193d59`, branch `codex/triple-slash-visual`. Kontrak Chat 1:
`ab67626:docs/triple-slash-interface.md`, branch `codex/triple-slash-combat`.
Runtime final Chat 1 **4cbc169** digabung melalui **cecc006**. Entry point akhir
memuat `src/triple-slash.js` sebelum combat. Seluruh dependency ada di worktree
ini; tidak ada referensi produksi ke worktree Chat 1 atau fixture.

## Mencoba

Buka `index.html` langsung lewat file:// atau server HTTP. Mulai Ekspedisi atau
Latihan Map 2, lalu naikkan Bilah Bara ke tingkat 10 lewat U pada jeda. Slot Q
berubah dari **Bilah tingkat 10** menjadi **Siap** setelah kembali bermain.
Arahkan mouse, tekan Q, dan perhatikan tiga pips/progres. Shift membatalkan sisa
combo; cooldown tetap terpakai. Bekal memakai H atau tombol Isi tenaga.

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
- Pembatalan menampilkan tiga silang patah dan busur terputus di luar cincin kaki,
  mengikuti sumbu tebasan terakhir, selama 0,24 detik
  presentasi. Umurnya diturunkan dari penurunan cooldown snapshot sejak cancel,
  sehingga ikut membeku saat pause. Tidak ada setTimeout atau timer hit di visual.
- HUD menampilkan Dibatalkan bersama sisa cooldown; cooldown tetap milik combat.
- Q menjadi skill dan H menjadi bekal. Kbd, title dinamis, footer, dan Cara Main
  mengikuti binding ini. Slot disembunyikan di judul/hasil dan pada layout mobile.
- Slot dicadangkan sebagai rectangle overlay agar label/angka tidak menutupi HUD.

`tests/fixtures/triple-slash-visual-fixture.js` mengikuti POJO kontrak. Hanya mode
tes eksplisit `--fixture` yang mengganti port snapshot/command dengan fixture;
mode default menuntut runtime nyata. POJO fixture juga dipakai untuk probe raster
geometri murni. Tidak ada grant rank atau fixture pada entrypoint produksi.

## Hasil pemeriksaan akhir

Dijalankan pada 5 November 2026 setelah integrasi runtime final, Node 24/Chrome:

```powershell
node tests/triple-slash-visual-browser-test.mjs --screenshots docs/triple-slash-screenshots
node tests/triple-slash-visual-browser-test.mjs --fixture
node tests/triple-slash-test.mjs
node tests/mouse-combat-test.mjs
node tests/mouse-combat-browser-test.mjs
node tests/mouse-combat-visual-browser-test.mjs
node tests/camera-test.cjs
node tests/menu-browser-test.mjs
```

Browser suite memakai Chrome lokal, tanpa npm dependency atau jaringan luar;
CHROME_PATH dapat menunjuk executable lain. Profil sementara dibuang setelah tes.
Scene dibuat deterministik: RAF dihentikan, target dipin dan simulation.update
asli dijalankan pada dt=1/60. Gambar merupakan hasil renderer/HP aktual, bukan
playtest manusia atau hasil pertandingan penuh.

| Pemeriksaan | Hasil |
| --- | --- |
| Desktop | 1280×720 DPR 1, 1440×900 DPR 1,25, 1920×1080 DPR 2: lulus |
| Geometri efek | 44.817 sampel tiap viewport, **134.451 total** pada mode aktual. Enam sumbu termasuk non-kardinal × tiga gaya × tiga waktu kontak; raster berwarna cocok dengan combat.swingContact di area bebas. Tepi antialias dilewati |
| Hit aktual | 8 arah × 3 tebasan × 3 viewport = **72 tebasan**. Satu target 60 px di depan menerima 77 per kontak: HP 1000 → 923 → 846 → 769 |
| Urutan | SlashIndex/phase/origin/angle/reach/radius dari snapshot sama dengan metadata gambar; tiga warna/1–2–3 jejak, dan pose Attack2 pada tebasan II, lulus |
| Fixture | Seluruh viewport dan probe geometri juga lulus dalam --fixture. Ini memverifikasi visual sebelum runtime tersedia tanpa mengganti source runtime |
| Unlock/kontrol | Rank 9 menampilkan Bilah tingkat 10 dan menolak Q tanpa heal/food/CD; H memulihkan 45 HP dengan satu bekal. Rank 10 menampilkan Siap |
| HUD command | Tombol Q memanggil port yang sama; dua click berturut tetap satu sequence dan satu cooldown 8 detik |
| Progres/cooldown | Progres dan pips mengikuti state 1/2/3, lalu disembunyikan pada selesai/cancel. Cooldown datang dari snapshot; render berulang tidak memajukan/mengubah state |
| Koreksi arah | Arah terkunci selama kontak. Tebasan berikutnya menerima koreksi maksimal 30° dan gambar memakai sudut hasil koreksi |
| Dash cancel | Sesudah hit I, dash menghapus efek skill dan basic-ghost; hit II/III tidak terjadi. Garis patah muncul singkat lalu hilang; cooldown tetap tersisa |
| Pause/upgrade | Snapshot dan progres membeku. HUD tetap terbaca dengan tombol disabled; menutup dialog dan resume meneruskan runtime |
| Resize | Arena aktif diubah ke 1100×1000 DPR 1,25, 1920×1080 DPR 2, 1280×720; slot di dalam arena, sudut/phase/CD tidak berubah oleh resize |
| Kamera X/Y | Fixture koordinat 4096×3072 memindahkan kamera dan origin saat skill aktif; gambar memakai origin kaki baru, tanpa tick tambahan atau pengujian collision World lama pada koordinat besar |
| Banyak musuh/bangunan | 13 musuh legal di sekitar kastel; target di balik collider tetap 1000 HP. Cap ≤5 per slash, queue impact/floater/label tetap dalam batas existing. Screenshot dievaluasi untuk kontras busur dan label pemain |
| Core | 80 pemeriksaan Triple Slash dan 823 pemeriksaan mouse melee: lulus |
| Browser entry normal | file:// DPR 1 dan HTTP DPR 2, termasuk beli rank 9/10 dari camp, repeat/gate/counter/cancel/cover/restart: lulus |
| Regresi visual Tahap 3 | 49.578 sampel per viewport dan seluruh skenario aim/pose/pause/camera: lulus |
| Regresi lain | Kamera serta menu keyboard/touch/touch-small/touch-landscape, carry emas/keenam rank dan fresh practice: lulus |

Suite visual berakhir dengan **nol exception JavaScript dan nol aset gagal dimuat**.
Screenshot final diambil dari index.html lokal, viewport CSS 1440×900 DPR 1,25.
Detail/HUD memakai clip browser scale 2; sprite asli tidak diedit.

## Screenshot

| Urutan | Area dan pose | HUD |
| --- | --- | --- |
| I — gading | [Tebasan I](triple-slash-screenshots/sequence-1-detail.png) | [Progres 1/3](triple-slash-screenshots/hud-sequence-1.png) |
| II — mint | [Tebasan II](triple-slash-screenshots/sequence-2-detail.png) | [Progres 2/3](triple-slash-screenshots/hud-sequence-2.png) |
| III — putih sian | [Tebasan III](triple-slash-screenshots/sequence-3-detail.png) | [Progres 3/3](triple-slash-screenshots/hud-sequence-3.png) |

| Pemeriksaan | Screenshot |
| --- | --- |
| HUD sebelum/sesudah unlock | [Terkunci](triple-slash-screenshots/hud-locked.png), [Siap](triple-slash-screenshots/hud-ready.png), [Cooldown](triple-slash-screenshots/hud-cooldown.png) |
| Dash membatalkan combo | [Area](triple-slash-screenshots/dash-cancel-detail.png), [HUD](triple-slash-screenshots/hud-cancel.png) |
| Empat arah utama | [Atas](triple-slash-screenshots/direction-up.png), [Bawah](triple-slash-screenshots/direction-down.png), [Kiri](triple-slash-screenshots/direction-left.png), [Kanan](triple-slash-screenshots/direction-right.png) |
| Diagonal/koreksi | [Kiri bawah](triple-slash-screenshots/direction-down-left.png), [Koreksi 30°](triple-slash-screenshots/bounded-turn-detail.png) |
| Kerumunan dekat kastel | [Detail](triple-slash-screenshots/crowd-castle-detail.png), [Arena penuh](triple-slash-screenshots/crowd-castle.png) |
| Dialog upgrade | [HUD di belakang dialog](triple-slash-screenshots/upgrade-dialog.png) |

## Batas visual dan playtest berikutnya

Body Warrior masih hanya dua arah. Pose Attack2 membedakan tebasan II, tetapi tidak
menjadi animasi tubuh atas/bawah/diagonal. Frame kontak tertanam tetap dihindari;
busur dan chevron menjadi acuan arah. Footprint menggambarkan potensi geometri,
sementara cover, cap sasaran dan hit yang sudah terpakai tetap diputuskan combat.
Efek belum menggambar shadow mask dari collider bangunan; HP target cover pada
fixture tetap terlindungi.

Durasi koreksi, jeda recovery 0,02 detik, rasa tiga pose dan keterbacaan angka saat
combat ramai memerlukan playtest manusia. Tidak ada tuning damage, harga, musuh,
mining, rank maksimum atau penyimpanan/carry cooldown yang dilakukan renderer.
