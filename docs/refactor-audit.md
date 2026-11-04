# Audit dan arsitektur refactor

Baseline: `6b60a5e` (`Update 1.3`), working tree awal bersih. Semua perubahan dilakukan di worktree `.worktrees/modular-game`, branch `codex/modular-game`. Checkout `main` dan nilai manual pengguna tidak ditimpa.

## Temuan awal

`game.js` sebelumnya sekitar 1.945 baris, satu IIFE dengan puluhan mutable bindings. Penanganan input, data peta, pembelian, damage, boss, AI, DOM, cache sprite, Web Audio, fixed-step loop dan startup saling mengakses closure yang sama. Tes menjalankan kode asli melalui VM dan menyisipkan instrumentasi berdasarkan marker string. Browser test juga memodifikasi fungsi secara dinamis untuk audit render dan stress.

Perilaku yang dikunci mencakup lima wave dengan encounter seeded, fixed step 1/60, urutan damage aggregation/projectile/cleanup, dan enam jalur upgrade maksimal sepuluh tingkat dengan milestone 5/10. Biaya, kontrol keyboard/pointer/touch, pause/dialog, restart seed, best score per mode, serta offline `file://` tetap sama. Saat integrasi ke `main`, label mining diselaraskan dengan hadiah **+50 emas** dari konfigurasi.

## Tahapan yang selesai

1. Audit struktur, status Git, sumber angka manual dan regresi baseline; tulis kontrak map v1 sebelum ekstraksi.
2. Pisahkan konfigurasi immutable dan state sesi; alokasikan port komponen sebelum instalasi untuk mempertahankan siklus call yang lama secara eksplisit.
3. Ekstraksi berdasarkan tanggung jawab; pertahankan algoritma, angka dan urutan update. Pindahkan damage projectile ke combat, pickup/passive income ke economy, musik ke audio, dan interaction HUD ke UI. Input menyediakan sumbu gerak yang dipakai dash dan loop.
4. Integrasikan data island dan validator dari chat map, gunakan clone World serta cache navigation per runtime. Hilangkan fallback data map dari production.
5. Adaptasi loader tes tanpa mengubah assertion gameplay, tambahkan replay diferensial dan pemeriksaan isolasi map/session/input, lalu jalankan regresi dan browser.

## Struktur akhir

| Lokasi | Tanggung jawab |
| --- | --- |
| `game.js` | Entry point, memasang listener dan memulai preload/frame |
| `src/runtime.js` | Composition root dan urutan instalasi port |
| `src/config.js` | Tabel wave/difficulty/upgrade/audio, konstanta combat/render, reward mining |
| `src/session.js` | `GameSession`: state satu sesi dan reset data pertandingan |
| `maps/island.js`, `maps/validate-map.js` | Definisi map terpisah dan validasi authoring |
| `src/world/world.js` | `World`: validasi/clone definisi, cooldown resource dan adapter entry path |
| `src/input.js` | `InputController`: kepemilikan keyboard/pointer, sumbu gerak, attach/dispose listener |
| `src/combat.js`, `src/boss.js` | Damage, swing/dash, projectile, tekanan serangan dan boss lifecycle |
| `src/ai.js`, `src/navigation.js` | Target/role/formation/healer/evasion, collision, movement dan cache rute |
| `src/director.js` | Encounter seeded, wave, roster dan spawn |
| `src/economy.js`, `src/upgrading.js` | Mining/pickup/rekrut/heal/repair dan aturan harga/buff/milestone |
| `src/renderer.js`, `src/assets.js` | Canvas, terrain, label layout, effects, sprite caches dan preload |
| `src/audio.js` | Audio context, decode, voice budget/release, volume, cue dan musik |
| `src/ui.js`, `src/lifecycle.js` | DOM/HUD/dialog/gallery dan koordinasi mulai/title/hasil |
| `src/inspection.js` | Snapshot diagnostik kompatibel dengan API sebelumnya |
| `src/math.js` | Geometri, seed PRNG dan helper path aset |

Semua modul memakai classic script `defer`, dengan urutan eksplisit di HTML. Tidak ada fetch untuk kode/map, ESM, bundler, dependensi npm, inheritance, atau class game raksasa. `GameSession`, `World`, dan `InputController` dipakai untuk pemilik state/lifecycle. Sistem lain berupa fungsi yang dikomposisikan melalui parameter port; tiap installer hanya mengambil dependensi yang dipakainya. Instance baru mempunyai session, input, cache, dan data World sendiri.

`game-preview/source-loader.cjs` dan `runtime-bindings.json` adalah jembatan sementara untuk instrumentasi tes lama. Accessor mutable dan `__testRuntime` hanya disisipkan oleh loader tes atau interception browser `--stress`; entry point production tidak memasangnya. Oracle `fixtures/baseline-game.js` tidak dimuat oleh HTML dan tidak dipakai gameplay.

## Batas tahap ini

- Engine memilih satu map saat membuat runtime. Belum ada menu pemilihan map, pergantian map dalam sesi, multi-spawn/path scheduler, atau fitur gameplay baru.
- Sebagian dekorasi island dan posisi cadangan AI masih berada di renderer/AI. Ekstensi map authoring untuk dekorasi, collision alternatif dan spawn lebih kaya belum seluruhnya dikonsumsi; lihat `map-contract.md`.
- Sejumlah fungsi combat/lifecycle masih memanggil port DOM/audio/render; ini ekstraksi bertahap dengan perilaku sama, belum simulasi headless murni. Urutan update dipertahankan untuk kesetaraan.
- Renderer dan AI tetap modul terbesar; pembagian lebih lanjut bisa dilakukan setelah kontrak presentation/command yang lebih sempit dibutuhkan.
- `InputController.dispose()` membersihkan input dan listener miliknya. UI/ResizeObserver/RAF/audio belum memiliki satu lifecycle teardown runtime penuh untuk mount/unmount banyak game di halaman yang sama.
- Tes browser yang tersedia memakai Chrome pada path Windows tetap. Browser lain belum diuji.

Hasil perintah dan keterbatasan assertion balance dicatat di `refactor-validation.md`.
