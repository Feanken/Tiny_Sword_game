# Triple Slash — audit dan verifikasi Tahap 4

Branch `codex/triple-slash-combat` memakai integrasi Tahap 3 `f193d59`, termasuk
combat `3ef7dfa` dan renderer 360° `05c96fc`. Main masih `12b7c22` saat
pekerjaan dimulai, sehingga basis branch dipilih dari hasil Tahap 3 tersebut.
Main dan worktree chat lain tidak diubah.

[triple-slash-interface.md](triple-slash-interface.md) ditulis dan dicommit
sebelum implementasi pada `ab67626`. Nama state/port pada kontrak awal tetap.
Kontrak final menambahkan alias inspeksi publik dan penjelasan hitArea terakhir.

## Hasil audit dan implementasi

Q pada baseline memanggil makan bekal. Makan bekal sekarang memakai **H**;
handler input, kbd/title tombol Isi tenaga, tooltip dinamis, panduan dan README
telah disesuaikan. Klik tombol Isi tenaga tetap memanggil fungsi ekonomi yang sama.
Q tidak mengurangi food atau memulihkan HP pada rank 9 maupun 10.

| Bagian | Perubahan |
| --- | --- |
| [src/triple-slash.js](../src/triple-slash.js) | Lifecycle combo terpisah dari combat umum: eligibility, cooldown, tiga fase per tebasan, koreksi arah, pembatalan dan snapshot |
| [src/combat.js](../src/combat.js) | Builder/resolver strike bersama, identity guard, full primary damage untuk skill, counter sekali per combo, integrasi dash/hit dan age untuk renderer |
| [src/input.js](../src/input.js) | Q tanpa buffering/repeat, H menggantikan heal, desiredAimAngle membaca mouse tanpa mengubah lock |
| [src/session.js](../src/session.js), [src/lifecycle.js](../src/lifecycle.js) | State skill dimiliki Session; restart/title reset, akhir pertandingan membatalkan kontak yang belum terjadi |
| [src/config.js](../src/config.js) | Tuning skill baru saja; angka basic melee dan ekonomi lama tetap |
| [src/inspection.js](../src/inspection.js) | Snapshot read-only skill tersedia pada PenjagaPulau.snapshot().skills.tripleSlash |
| [index.html](../index.html), [src/ui.js](../src/ui.js), [README.md](../README.md) | Script klasik sebelum combat dan koreksi petunjuk Q/H; tidak menambahkan HUD skill |

Parameter prototipe adalah blade rank 10, tiga tebasan selama 0,9 detik,
cooldown 8 detik sejak start berhasil, maksimal lima sasaran per tebasan, dan
100% primary melee damage per sasaran. Pada blade 10, tiap hit bernilai 77 sebelum
counter dan modifier boss. Sasaran kedua sampai kelima juga menerima 77.
Basic attack tetap memakai secondary damage lamanya.

Tiap tebasan berlangsung 0,30 detik: windup 0–0,16; contact 0,16–0,28;
recovery 0,28–0,30. Set hit baru dibuat tiap tebasan, sehingga satu sasaran
dapat terkena tiga kali, tetapi hanya sekali pada tiap tebasan.
Counter diambil sekali saat start lalu dikonsumsi pada hit valid pertama,
termasuk jika tebasan pertama miss dan hit pertama baru terjadi pada tebasan kedua.

Mouse dibaca dalam world coordinates melalui konversi kamera Tahap 3.
Tebasan kedua/ketiga mengoreksi maksimal 30° dari sumbu sebelumnya melalui
shortest-angle delta. Koreksi dilakukan sekali pada awal tebasan berikutnya.
Windup/contact dan recovery antartebasan memakai sumbu skill; sesudah combo
berakhir atau dibatalkan, bidikan normal kembali bebas.

Dash yang berhasil dimulai membatalkan seluruh sisa combo tanpa refund cooldown.
Dash yang ditolak karena cooldown tidak membatalkan combo. Hit, death, run-ended,
strike-lost dan invalid-state menutup kontak berikutnya. Resolver juga memeriksa
identitas object strike, sequence combo dan slashIndex, termasuk saat cancel
terjadi di tengah loop beberapa sasaran. Tidak ada timer callback tertunda.

Basic attack/attack buffer ditolak selama combo aktif. Skill ditolak ketika basic
masih dalam strike, recovery atau cooldown. Q yang terus ditahan, auto-repeat dan
keydown duplikat tidak memulai cast baru ketika cooldown selesai; harus ada
penekanan baru. Pause menghentikan seluruh tick skill. Restart menghapus cooldown,
combo, sequence, strike lama dan rank unlock bersama reset run existing.

## Pengujian

Dijalankan dari root worktree:

```powershell
node tests/triple-slash-test.mjs
node tests/mouse-combat-test.mjs
node tests/mouse-combat-browser-test.mjs
node tests/mouse-combat-visual-browser-test.mjs
node tests/camera-test.cjs
node tests/menu-browser-test.mjs
```

Browser memakai Chrome headless lokal; CHROME_PATH dapat mengganti executable.
Tidak ada dependency paket atau layanan eksternal baru.

| Kelompok | Hasil |
| --- | --- |
| Triple Slash headless | 80 pemeriksaan lolos |
| Unlock/gate | Rank 9 ditolak tanpa CD, rank 10 diterima, basic/recovery dan repeat tidak menumpuk |
| Kontak | Tiga kontak terpisah, tepat tiga strike, cap lima, full primary damage, satu hit per sasaran per tebasan |
| Waktu | 0,9 detik total, CD mulai 8 dan tersisa 7,1 setelah combo, update gabungan tetap memproses tiga batas contact |
| Counter | Sekali untuk seluruh combo, termasuk hit pertama pada tebasan kedua |
| Arah | Lock contact, koreksi 30°, seam 170° → −170°, pointer di origin mempertahankan arah |
| Collision/damage | Bangunan memblokir ketiga tebasan, modifier boss existing tetap dipakai |
| Cancel | Dash/hit/death, dash ditolak, strike hilang, sequence salah, resolver strike lama dan cancel di tengah resolver |
| Pause/reset | Pause membekukan seluruh snapshot/timer, resume melanjutkan sisa waktu, reset menghapus state dan unlock |
| Regresi mouse melee | 823 pemeriksaan Tahap 3, lolos |
| Regresi kamera | Clamp, DPR-independent conversion, fixed viewport dan culling, lolos |
| Browser entry normal | file:// DPR 1 dan HTTP DPR 2, seluruh skenario Triple Slash, lolos |
| Regresi visual 360° | 49.578 raster/contact samples per viewport pada 1280×720 DPR 1, 1440×900 DPR 1,25, 1920×1080 DPR 2; lolos |
| Regresi menu | Keyboard, touch, touch-small, touch-landscape, camp dan handoff ekspedisi; lolos |

Browser test membuka index.html normal melalui tombol menu dan start. Rank 9 lalu
10 dibeli memakai tombol camp yang sebenarnya, dengan saldo fixture untuk biaya.
Q pada rank 9 diuji tidak melakukan heal/cast, lalu H diuji mengonsumsi satu food
dan memulihkan 45 HP. Sesudah rank 10, event Q memulai combo, menghasilkan tiga
hit terpisah 89/77/77 pada satu sasaran saat counter rank 0 tersedia (+12 sekali).

Pause dan resume memakai tombol UI normal. Key Q ditahan melewati berakhirnya
cooldown untuk membuktikan tidak ada cast yang diantrekan. Shift membatalkan cast
berikutnya setelah hit pertama; HP sasaran tidak turun lagi meski waktu berjalan
atau resolver lama dipanggil. Pengujian juga memeriksa cap koreksi, penolakan
Q saat basic/recovery, hit interruption, cover bangunan dan restart melalui
restartPauseButton yang benar-benar mereset run.

Scene browser dibuat deterministik dengan menghentikan RAF dan menjalankan
simulation.update(1/60) asli. Sasaran dibuat diam/ber-cooldown panjang untuk
mengukur kontak; movement, knockback, collision, input dan damage tetap memakai
implementasi produksi. Ini bukan hasil pertandingan penuh atau playtest manusia.

## Handoff visual/HUD dan batas prototipe

- Chat 2 membaca combat.tripleSlashSnapshot() atau alias inspeksi publik.
  State memiliki phase, slashIndex, slashElapsed, angle, hitCounts, cooldownRemaining,
  counterConsumed dan cancelReason. hitArea memakai origin kaki dan sudut strike
  yang sama dengan collision, bukan sumbu sprite.
- Renderer Tahap 3 masih dipakai melalui port aim/age existing, sehingga tiga
  ayunan dapat ditampilkan. Branch ini tidak mengubah renderer, AimVisual, kamera,
  gambar, atau menambahkan HUD/cooldown indicator khusus skill.
- Pemilihan 30° adalah keputusan prototipe untuk koreksi terbatas. Durasi,
  recovery 0,02 detik antartebasan dan kemampuan mengarahkan combo perlu dinilai
  manusia bersama visual Chat 2.
- Cooldown/state skill belum disimpan dalam checkpoint kampanye atau dibawa
  lintas arena; run/session baru memakai reset existing.
- Damage 3×77 dan counter masih perlu dinilai bersama encounter/boss normal.
  Ekonomi, mining 10000, jumlah musuh dan upgrade maksimum 10 tidak disetel ulang.
