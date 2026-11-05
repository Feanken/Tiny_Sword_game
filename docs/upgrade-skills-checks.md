# Hasil pemeriksaan Tahap 6

Branch `codex/upgrade-skills`, baseline `main@29350d7`. Parameter dan titik merge: [upgrade-skills-interface.md](upgrade-skills-interface.md). Semua perintah dijalankan dari root worktree pada5 November2026, Node24.22.1 dan Chrome desktop headless Windows. Tidak mengambil implementasi tier atau transaksi Chat1.

## Hasil

| Pemeriksaan | Hasil |
|---|---|
| `node tests/upgrade-skills-test.mjs` | **232 pemeriksaan lulus**. Enam batas rank9/10/19/20/24/25, gates, damage stage,3 kontak, five stacks/decay, floor kontak, serial charge/iframe/collision, perfect dodge/token/expiry/ICD/refund, counter sekali percombo, zona/tepi radius/heal cap, damage/death/restart, aura, kapasitas dan biaya. |
| `node tests/upgrade-skills-browser-test.mjs --screenshots artifacts/upgrade-skills` | **file:// dan HTTP lulus**. Rank9/10/19/20/24/25, input Q/R/H/Shift, pause dan camp, delapan arah kontak rank25, tiga kontak/counter sekali, zona tetap saat bergerak/kamera, resize, death/restart dan HUD judul. Tidak ada exception atau resource gagal dimuat. Pembelian rank11 tetap ditolak. |
| Ukuran desktop pada uji skill | 1280×720 DPR1,1440×900 DPR1,25,1920×1080 DPR2,1100×1000 DPR1. Slot Q/R, pasif dan dash berada dalam arena dan tidak saling menutup. Notifikasi rekrut dipindahkan dari slot Q ke tengah bawah. |
| `node tests/mouse-combat-test.mjs` | **823 pemeriksaan lulus**,72 sudut, lock/recovery, gerak berlawanan, origin, cap/cover/air/kamera. Ekspektasi counter disesuaikan dengan gate baru rank10. |
| `node tests/triple-slash-test.mjs` | **80 pemeriksaan lulus**, tiga kontak/cap, counter, koreksi sudut, cancellation, pause/reset. Fixture memakai token nyata, bukan menulis mirror riposte/dashCooldown. |
| `node tests/mouse-combat-browser-test.mjs` | **file:// DPR1 dan HTTP DPR2 lulus**: input normal, hold/lock, UI/drag, cover/air, kamera bergeser, large-world fixture, pembelian Blade9→10, Q/H dan restart. Titik klik kamera dipindah ke bagian kanvas yang tidak tertutup slot R baru. |
| `node tests/triple-slash-visual-browser-test.mjs` | **Tiga ukuran desktop lulus**;44.817 sampel footprint/kontak per ukuran,8 arah×3 tebasan, HUD, kamera X/Y, dialog dan dash cancel. |
| `node tests/menu-browser-test.mjs` | **Keyboard, touch, touch-small, touch-landscape lulus**. Mode ekspedisi/latihan, dialog, difficulty, HUD dan carry emas/rank tetap bekerja. Fokus implementasi Tahap6 tetap desktop. |
| `node tests/map-preview-browser-test.mjs` | **file:// tiga ukuran dan HTTP lulus**. Bab1/2/3, safe placement, kamera, input, culling, collision dan jembatan dua arah. |
| `node tests/campaign-map-test.mjs` | **1.929 pemeriksaan lulus**,422 traversal,132 perpindahan gate,13 definisi tidak valid ditolak. Harness memakai hook skill riil untuk kapasitas/heal. |
| Sintaks dan patch | `node --check` semua `src/*.js`; `git diff --check` lulus. |

Uji browser menginjeksi rank melalui DevTools saja. Tidak ada loader fixture, query cheat atau tombol rank25 pada `index.html`. Preview atlas tetap hanya untuk map. Game normal memakai rank maksimum10 sampai integrasi Tahap5.

## Biaya pasukan dan biaya simulasi

Siklus rekrut tetap Archer40, Lancer40, Monk55, Warrior40. Dengan Archer awal gratis:

| Bastion | Kapasitas hidup | Unit berbayar | Biaya isi penuh |
|---|---:|---:|---:|
| 9 | 8 | 7 | 310 emas |
| 10/19 | 10 | 9 | 390 emas |
| 20/24/25 | 12 | 11 | 485 emas |

Unit mati membebaskan slot; percobaan di atas cap (termasuk free) tidak menambah unit atau memotong emas. Rank25 memberi aura, bukan slot lagi. Jika tanpa Archer gratis, biaya total8/10/12 unit adalah350/430/525 emas.

Benchmark memanggil **simulasi riil** dengan AI, navigasi, separation, projectiles, heal dan skill state pada Map1. Seed723,21 musuh dan8/12 sekutu direkrut normal,900 langkah fixed1/60,120 langkah pemanasan dibuang. HP fixture diperbesar agar populasi tetap penuh. Mengukur waktu host Node/VM, tanpa renderer/GPU dan bukan jaminan FPS perangkat pemain. Hasil tersimpan di [fixture-results.json](../artifacts/upgrade-skills/fixture-results.json).

| Populasi | Sampel | Mean | p95 | Maks |
|---|---:|---:|---:|---:|
| 8 sekutu+21 musuh | 780 | 3,731ms | 8,223ms | 12,546ms |
| 12 sekutu+21 musuh | 780 | 13,493ms | 23,206ms | 26,863ms |

Kapasitas12 tidak menghasilkan NaN, unit di air atau overflow, tetapi p95 melampaui anggaran16,67ms untuk60FPS bahkan sebelum render. Perlu profiling desktop nyata pada kepadatan tinggi sebelum rilis kampanye. Tidak mengubah AI/navigasi atau memangkas jumlah pasukan di tahap ini. Browser sudah memeriksa rendering12 sekutu dan kombinasi skill, namun benchmark di atas tidak mengklaim pengukuran frame rendering penuh.

## Screenshot dan batas playtest

Semua gambar diambil dari runtime nyata dengan fixture rank25, zona R, aura benteng, lima lapis Irama, counter siap dan12 sekutu; angka HP/emas fixture bukan balancing kampanye final.

- [1280×720](../artifacts/upgrade-skills/skills-1280x720.png)
- [1440×900 DPR1,25](../artifacts/upgrade-skills/skills-1440x900.png)
- [1920×1080 DPR2](../artifacts/upgrade-skills/skills-1920x1080.png)

Masih perlu playtest: manfaat Irama ketika cooldown dasar sudah menyentuh0,30s, aura hero yang berbagi plafon DR35%, tingkat kebal0,16s/jeda dash0,60s, cadence refund counter, pemulihan bersama Monk+zona, serta kepadatan12 pasukan. Semua parameter berada dalam satu modul; tidak menumpuk stat saat dialog dibuka, rank disinkronkan ulang atau run dimulai lagi. Kampanye15 gelombang, checkpoint dan integrasi tier belum diaktifkan di branch ini.
