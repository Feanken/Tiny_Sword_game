# Preview tiga pulau — kamera dan rendering Tahap 2

## Membuka preview

Buka `preview-map.html` di browser desktop dengan klik dua kali. Seluruh script,
stylesheet dan PNG lokal; tidak memerlukan server, fetch, module import, atau
flag keamanan browser. Halaman yang sama dapat dilayani melalui HTTP. Game/menu
lama tetap melalui `index.html`.

- Bab 1 membuka Pulau Embun; utara dan barat daya ditandai terkunci.
- Bab 2 membuka Bukit Utara dan Jembatan Utara.
- Bab 3 membuka Pesisir Barat Daya dan jembatan berbeloknya.
- WASD/panah berjalan menggunakan navigasi game. Klik tanah aktif untuk menuju
  titik itu. Klik air/wilayah terkunci membatalkan tujuan.
- Pilih wilayah lalu **Ke titik aman** untuk inspeksi cepat. **Kembali ke benteng**
  menempatkan penjaga pada heroSpawn. Pergantian bab juga memakai titik awal aman.
- Panel menampilkan identitas wilayah, koordinat penjaga/mouse, ukuran viewport,
  minimap, dan benteng 500/500 HP. Benteng tidak menerima serangan di preview ini.

Ini mode eksplorasi. Pemilihan bab maju/mundur memakai API preview World; tidak
menyelesaikan boss, memberikan hadiah, menyimpan progres, atau menjalankan 15 wave.
Stat/economy dari dokumen Tahap 1 belum diaktifkan.

## Titik integrasi untuk Chat 1

Implementasi mengikuti `docs/map-preview-interface.md`. Sumber rancangan yang
dibaca: `codex/campaign-design@a011682` dan `codex/campaign-economy@cf5d9bc`.

| Berkas | Tanggung jawab / kontrak |
| --- | --- |
| `src/camera.js` | `PenjagaModules.Camera2D(width,height,viewHeight=704)`. `resize(cssWidth,cssHeight)`, `follow(actor)`, `screenToWorld`, `worldToScreen`, `intersects`. Semua koordinat kamera dalam world pixel. |
| `src/renderer.js`, `src/input.js` | Kamera game existing memakai kelas sama. `renderer.screenToWorld(clientX,clientY)` dan `input.pointerWorld` tersedia; pointer diam dihitung ulang setiap draw setelah kamera mengikuti pemain. |
| `src/map-preview-renderer.js` | Cache terrain dari `allFloorGeometry.rectangles`; union lantai tanpa mask daratan kedua. Tekstur pulau utama/utara/barat daya memakai Tilemap_color1/5/4. Jembatan memakai plank di dalam geometri bridge yang sama. Jalan memakai allCollections.roads. |
| `src/map-preview.js` | Membuat World/GameSession dan menginstal navigasi existing. Bab memakai `applyChapterPreview`; gerak memakai `navigation.move/steerMove`, validitas memakai `world.isWalkable`. Tidak membuat algoritme collision atau AI baru. |
| `preview-map.html` | Entry point terpisah, urutan classic script sesuai kontrak. |

Renderer berlangganan `onTopologyChange` untuk membangun ulang cache dan scenery.
Pemuatan aset memakai **allCollections**, bukan koleksi aktif Bab 1, sehingga semua
aset siap saat wilayah dibuka. Identitas scenery memakai objectIds asli terhadap
allCollections sebelum filtering isObjectActive; indeks koleksi aktif tidak dipakai
untuk mencari identitas. Arsiran wilayah terkunci mengurangi union lantai aktif,
agar cap jembatan yang overlap tidak menggelapkan tanah yang masih bisa dilalui.

Viewport memiliki tinggi tetap **704 world pixel**, lebarnya mengikuti aspek canvas.
World 2560×1792 tidak menentukan zoom. Kamera clamp X/Y pada batas world; bila
viewport lebih besar dari world, world dipusatkan pada sumbu tersebut. Konversi
mouse memakai CSS bounding rect, sehingga tidak bergantung DPR. Preview memakai
transform X/Y terpisah untuk menghindari error pembulatan backbuffer satu pixel.

Terrain dibangun sekali per topologi; setiap frame hanya bagian cache yang terlihat
disalin. Scenery dan sprite memakai culling bounding box dua sumbu; label wilayah
di luar viewport dilewati. Minimap memang menunjukkan seluruh world, tanpa mengubah
skala arena utama.

API inspeksi halaman: `PenjagaMapPreview.chapter('chapter-3')`,
`PenjagaMapPreview.visit('island-north')`, `PenjagaMapPreview.snapshot()`.
Snapshot mengembalikan bab, wilayah aktif, posisi, kamera, koordinat mouse, tujuan,
kondisi benteng, serta jumlah objek yang digambar/dilewati. API ini hanya ada pada
halaman preview.

## Pemeriksaan

Jalankan dari root worktree dengan Node 24 dan Chrome desktop:

```powershell
node tests/camera-test.cjs
node tests/map-preview-browser-test.mjs --screenshots docs/map-preview-screenshots
node tests/menu-browser-test.mjs
```

`CHROME_PATH` dapat menunjuk instalasi Chrome lain. Browser test menggunakan
profil sementara sendiri dan DevTools; tidak memerlukan npm dependency.

| Pemeriksaan | Hasil pada preview awal, diperiksa ulang setelah integrasi final |
| --- | --- |
| Kamera mandiri | 3 ukuran world × 3 aspek desktop × 3 posisi, clamp X/Y, proyeksi bolak-balik, culling dua sumbu lulus. |
| File lokal | 1280×720 DPR 1, 1440×900 DPR 1, 1920×1080 DPR 2; Bab 1/2/3, posisi aman, benteng, wilayah terkunci, identitas objek, dan skala karakter lulus. |
| Input | Keyboard nyata melalui DevTools, klik tanah, klik air ditolak, dan koordinat pointer diam setelah kamera bergerak. |
| Tepi daratan | Titik walkable paling utara/selatan/barat/timur diperiksa pada tiga ukuran layar; penjaga tetap terlihat dan kamera clamp. |
| Jembatan utara | Dua arah, 92 tick per arah pada 60 Hz, jarak akhir <5 px; tidak pernah keluar dari world.isWalkable. |
| Jembatan barat daya | Dua arah, melewati kedua tikungan, 120 tick per arah pada 60 Hz, jarak akhir <5 px; tidak pernah keluar dari world.isWalkable. |
| Collision | Titik air dan pusat obstacle ditolak; rute menuju pulau yang ditutup tidak dibuat. |
| Culling | Painted + culled = objek aktif, culled >0; scenery terkunci tidak masuk daftar objek. |
| Regresi game/menu | Keyboard desktop dan tiga viewport sentuh lulus, termasuk carry emas/keenam rank, HP, mode latihan dan ekspedisi baru. |

Durasi lintasan di atas hanya garis tengah jembatan, bukan waktu perjalanan dari
tambang ke benteng. Traversal di-render secara bertahap untuk memeriksa kamera
ketika menyeberang. Pengukuran ramai pasukan dan gate-to-gate mengikuti laporan
`campaign-map-traversal.md` milik Chat 1, bukan angka lintasan jembatan ini.

Screenshot 1440×900 tersedia di `docs/map-preview-screenshots/`: kondisi benteng
Bab 1/2/3, pulau utara/barat daya, dan kedua jembatan. Inspeksi visual mencakup
perbedaan atlas, sambungan lantai, occlusion sprite, label wilayah dan arsiran.

Poin playtest berikutnya: kenyamanan bidang pandang 704 px ketika bertempur dari
beberapa arah, keterbacaan jalan di atas plank, dan overlap visual cap jembatan
dengan bangunan benteng. Tidak ada perubahan collider untuk merapikan gambar.
