# Mouse combat — Tahap 3

Branch `codex/mouse-combat`, baseline main `12b7c22`. Kontrak
[aim-interface.md](aim-interface.md) dicommit sebelum implementasi pada `fc9c29b`.
Renderer dimiliki Chat 2; perubahan branch ini hanya input, combat, state/reset,
tick sinkronisasi bidikan, dokumentasi dan tes.

## Audit dan perubahan

| Modul | Baseline | Hasil |
| --- | --- | --- |
| [src/input.js](../src/input.js) | Menyimpan pointer client/world tetapi combat tidak membacanya. Klik kiri canvas memakai binding attack existing | Bidikan memakai renderer.screenToWorld. Pointer dibedakan dari touch, WASD tidak memutar mouse aim, dan pointer di atas UI melepas hold mouse |
| [src/combat.js](../src/combat.js) | Musuh terdekat memutar facing; hit memakai sumbu kiri/kanan | Target dipilih hanya dalam cone bidikan. Strike menyimpan angle readonly, hit memakai proyeksi forward/side terhadap angle itu |
| [src/session.js](../src/session.js), [src/lifecycle.js](../src/lifecycle.js) | Belum memiliki sudut bidikan/strike untuk reset | aimAngle/swingAngle dimulai dari 0 dan strike dibersihkan pada run/title baru |
| [src/simulation.js](../src/simulation.js) | Gerak dan hit window berjalan tanpa sinkronisasi arah mouse | updateAim sesudah gerak/update strike mengunci arah selama strike dan membebaskannya pada akhir contact |
| src/renderer.js, src/camera.js | Camera2D sudah mendukung offset X/Y dan CSS rect; arc lama memakai facing dan offset Y−23 | Tidak diedit. Chat 2 memakai origin/angle port dari kontrak untuk menyelaraskan visual |

Origin hit tetap posisi kaki hero saat ini. Berjalan selama windup/contact
menggeser origin bersama pemain, tetapi tidak mengubah sudut strike. Windup dan
contact terkunci sampai 0,28 detik; recovery boleh mengikuti mouse lagi.
hero.swingAngle tetap menyimpan sudut lama untuk ekor visual dan miss.

Port input.updatePointerWorld yang sudah dipanggil renderer sesudah camera.follow
juga menyinkronkan arah efektif melalui Input. Dengan begitu pointer diam tidak
menyimpan selisih kamera satu frame. Pointerenter memperbarui aim saat canvas
kembali berada di bawah cursor sesudah overlay UI ditutup, tanpa meminta attack.

Aturan yang tetap: forward gate −12 px, reach 76, radius target 18, sapuan ±1,3
radian, contact 0,16–0,28 detik, cooldown, damage utama/sekunder, cap sasaran,
milestone rank 5/10, Set satu hit per sasaran, counter snapshot dan collision.
config.js, upgrading.js, economy.js, navigation.js, camera.js dan index.html
tidak berubah. Mining manual tetap 10000.

Serangan kiri sekarang memakai rotasi sumbu world yang sama dengan semua arah,
bukan mirror horizontal untuk menentukan hit. Musuh di belakang yang lebih dekat
tidak menarik bidikan. Space/hold klik, WASD/panah, Shift dan kontrol lainnya tetap
tersedia. Sebelum mouse pernah digunakan, arah gerak menjadi fallback bidikan.

## Pengujian yang dijalankan

Dari root worktree:

```powershell
node tests/mouse-combat-test.mjs
node tests/mouse-combat-browser-test.mjs
node tests/camera-test.cjs
node tests/menu-browser-test.mjs
```

Browser test memakai Chrome headless lokal dan `CHROME_PATH` bila diperlukan.
Tidak ada paket baru atau dependency jaringan eksternal.

| Tes | Hasil |
| --- | --- |
| Combat headless, port runtime asli | 823 pemeriksaan lolos |
| Rotasi | 72 sumbu tiap 5°, termasuk seam ±π, target depan/belakang, batas jarak dan pinggir sapuan |
| Lock/recovery | Snapshot angle tidak dapat ditulis ulang, pointer tidak mengubah contact, bidikan efektif kembali saat contact selesai dan ekor visual tetap memakai sudut strike lama |
| Pusat pemain | Pusat tepat, noise subpixel, dan gerak pointer di luar toleransi numerik |
| Gerak | Berjalan mundur tidak memutar strike; origin hit mengikuti translasi hero |
| Damage/upgrades | Rank blade 0–10, cap pada 5/10, damage utama/sekunder, satu hit pada target tunggal meskipun cap belum penuh |
| Counter | Bonus rank 0/5/10 dan konsumsi satu kali pada hit utama |
| Collision | Dua endpoint legal di sisi bangunan tidak berarti garis hit bebas; movement di tepi air tetap ditahan |
| Camera existing | Fixed viewport, clamp X/Y, round trip screen/world, culling: lolos |
| Entry normal, file:// DPR 1 | Klik menu → mulai game, 8 arah lewat event mouse nyata, hold attack, perubahan arah setelah contact, WASD mundur, UI/drag, bangunan, tepi air dan kamera bergeser: lolos |
| Entry normal, HTTP DPR 2 | Cakupan yang sama pada index.html melalui server lokal: lolos |
| Fixture dunia besar | Input/combat/navigation dan Camera2D asli pada world 2560×1792, offset X/Y dan pointer diam setelah kamera bergerak: lolos |
| Regresi menu existing | Keyboard, touch, touch-small, touch-landscape, dialog, handoff ekspedisi dan fresh practice: lolos |

Browser combat test membuka index.html normal dan menggunakan tombol menu yang
sebenarnya. Hook DevTools hanya mengambil runtime dan membuat scene deterministik:
RAF dihentikan, unit sasaran dibuat diam, kemudian simulation.update(1/60) asli
dijalankan. Input, hit, collision dan event UI tidak diganti mock. Tes ini bukan
hasil pertandingan penuh atau pengukuran rasa kontrol manusia.

Fixture [large-world-aim.js](../tests/fixtures/large-world-aim.js) hanya dimuat oleh
tes. Ia membuat map datar terpisah dari salinan definisi map v1, dengan koordinat
besar dan port runtime asli. Tidak ada entrypoint produksi atau renderer game
kedua yang ditambahkan. Preview tiga pulau pada baseline masih tanpa combat.

## Temuan dan handoff untuk Chat 2

- PointerEvent Chrome dapat membulatkan client coordinates menjadi float CSS
  pixel. Toleransi awal 0,000001 world pixel tidak cukup pada titik pusat pemain
  dalam browser nyata. Toleransi final 0,001 world pixel lolos pada DPR 1 dan 2.
  Ini guard numerik, bukan snap arah atau aim assist.
- Perubahan viewport harus menunggu resize selesai sebelum menilai clamp kamera.
  Tes mengukur camera.width terhadap bounding rect, bukan menebak offset.
- Target ilegal di air dipindahkan oleh keepOnLand pada tick normal. Karena itu
  scene browser tepi air memakai musuh legal di belakang pemain untuk menguji
  arah dan batas gerak. Headless contact test juga memeriksa ray melee ke air.
- Arc renderer lama masih horizontal dengan origin hero.y−23 pada branch ini.
  Chat 2 harus menggantinya dengan combat.heroAttackOrigin() dan
  combat.heroAttackAngle(), tanpa mirror facing. hero.aimAngle hanya untuk bidikan
  efektif, bukan ekor serangan lama.
- Reticle, animasi delapan arah, z-order arc, cue visual counter dan penyelarasan
  art perlu diuji pada renderer Chat 2. Branch ini belum memverifikasi kesetaraan
  visual atau melakukan playtest manusia dengan banyak musuh.
