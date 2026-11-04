# Hasil validasi refactor

Pengujian dijalankan dari worktree `codex/modular-game` pada Windows dengan Node.js v24.22.1 dan Chrome headless. Baseline berasal dari `6b60a5e`.

| Pemeriksaan | Hasil |
| --- | --- |
| Sepuluh suite regresi Node yang sudah ada | Lulus. Mencakup engine, combat, boss, AI, balance gelombang, milestone 5/10, serta replay 30/60/120 FPS. |
| `node game-preview/refactor-parity-test.cjs` | 936 snapshot identik pada tiga kesulitan. Termasuk mining +50 emas, semua 60 pembelian, dash, combat, perintah sekutu, pause dan restart. |
| `node game-preview/module-integration-test.cjs` | Lulus. Data inti map dan jalan cocok dengan baseline, validasi menolak spawn di luar world, instance memisahkan state/cache, dan input dapat dilepas lalu dipasang kembali. |
| `node game-preview/browser-test.mjs --stress` | Lulus setelah integrasi map. Kontrol desktop dan sentuh, camp, dialog, gallery, combat, 29 unit, serta peluncuran `file://` tanpa exception atau aset hilang. |
| `node game-preview/browser-test.mjs --stress --upgrade-only` | Lulus. Harga kumulatif, fokus keyboard, cap tingkat 10, pause, layout mobile dan reset. |
| `node game-preview/browser-test.mjs --stress --audio-only` | Lulus. Semua 17 sampel terdekode melalui HTTP dan `file://`. Volume efek/musik, mute, batas dan pelepasan voice, serta dialog mobile lulus. |
| `node game-preview/balance-test.cjs` | Seluruh 14 pertandingan menang dan menghasilkan record identik dengan baseline. Assertion lama tentang tiga pola boss tetap gagal di kedua versi. |

Pengujian stress terakhir menjalankan 900 langkah dengan 29 unit. Rata-rata update 2,37 ms dan persentil ke-95 6,30 ms, di bawah batas suite 10 ms dan 20 ms pada mesin uji.

Assertion `balance-test.cjs:14` mengharuskan semua strategi Normal melihat tiga pola boss selesai. Beberapa strategi mengalahkan boss setelah `slam` dan `volley` selesai sementara `charge` baru diperingatkan. Baseline menghasilkan kegagalan yang sama. Perbandingan mencakup seluruh record, termasuk durasi, HP, damage, progres wave, pola boss, dan counter combat.

Setelah menjalankan simulasi penuh, bandingkan `results` yang baru ditulis dengan fixture baseline berikut.

```powershell
node -e "require('node:assert/strict').deepEqual(require('./game-preview/balance-after.json').results, require('./game-preview/fixtures/balance-6b60a5e.json').results)"
```

Untuk mencoba game dari worktree, buka `index.html` atau `Mainkan.cmd`. Browser lain di luar Chrome belum diuji dalam refactor ini.
