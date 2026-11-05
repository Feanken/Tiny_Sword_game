# Pemeriksaan tambang Tahap8

Baseline `bd56f28`, branch `codex/campaign-mines`, 5 November2026. Node24.22.1 dan Chrome headless Windows. [Kontrak dan integrasi](mines-interface.md).

- **976 pemeriksaan Node lulus**: saldo pas150/250 dan kurang satu; bukti boss; fase pembelian; pembelian berulang; aksi20/21; kuota/alokasi lintas node; pengulangan identitas bab; run salah/stale/skip; reset; snapshot detached/JSON; standar/testing; overflow; timer/cap pasif; pause/review/menu/loading/death; gate attack/dash/stagger/moving; boolean runtime receipt; shared tick penduduk dan disposal.
- Ekonomi penuh tiga bab diuji: manual standar500/700/900, total2.100; override10.000 tetap maksimum20 aksi/bab; biaya konstruksi150+250. Produksi tambahan pos300/rumah800 dengan cap50 tick. Shared clock membayar outpost6+penduduk4 sekali setiap6 detik; callback income berulang tidak menggandakan tick.
- **Browser file:// dan HTTP lulus**: E memakai kerja0,9 detik; label=saldo aktual; kuota20/21; tiga tingkat; exact-price/button disabled; bab berulang; pause/panel; reset; profil testing10.000; delta offline ditolak; collision dan panel pada1440×900,1280×720,1920×1080 DPR2,1100×900 DPR1,25. Tidak ada exception atau resource gagal dimuat.
- Installer browser dikomposisikan dengan port campaign fixture: lima aset preloaded sebelum loader dasar; pembelian mengganti sprite tanpa tick simulasi; panel mengembalikan fase; dispose memulihkan hook UI/render/asset/ekonomi dan menghapus dialog. Ini uji kontrak fixture, bukan klaim sudah memasang tambang ke campaign15 gelombang Chat1.
- World/navigation riil: satu komponen walkable pada semua tahap; semua node aktif mempunyai titik berdiri mining yang terhubung ke spawn; hero tidak masuk plot. Jembatan utara dua arah113 frame; barat daya dua arah111 frame pada fixed1/60, speed185. Seluruh langkah traversal tetap di tanah. Plot dan collider tidak berubah setelah pembelian. Definisi sumber tidak dimutasi.
- Patch integrasi ke `283e45d` lulus `git apply --check`; shared files Chat1 tidak diubah. Sintaks berkas baru dan patch whitespace diperiksa sebelum commit.

Data mesin: [fixture-results.json](../artifacts/mines/fixture-results.json). Screenshot runtime fixture standar:

| Tahap | Gambar |
|---|---|
| Batu Bab1 | [rock.png](../artifacts/mines/rock.png) |
| Pos Bab2 | [outpost.png](../artifacts/mines/outpost.png) |
| Rumah Bab3 | [mine-house.png](../artifacts/mines/mine-house.png) |
| Panel biaya/syarat | [panel-outpost.png](../artifacts/mines/panel-outpost.png), [panel-mine-house.png](../artifacts/mines/panel-mine-house.png) |

Masih perlu playtest dalam campaign nyata setelah patch dipasang: waktu perjalanan tambang kembali ke benteng saat serangan, daya tarik pembelian terlambat dengan payback150 detik aktif, kepadatan pasukan di cluster emas, serta rasa kuota per node. Pendapatan testing10.000 sengaja tidak mewakili keseimbangan ekonomi standar. Save/restore dan produksi offline tidak ditambahkan.
