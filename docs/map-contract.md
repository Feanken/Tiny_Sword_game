# Kontrak modul map v1

Kontrak ditetapkan sebelum refactor dari baseline `6b60a5e`. Pemilik integrasi: chat refactor utama. Chat map hanya mengerjakan `maps/island.js` dan definisi map lain; jangan mengubah bootstrap, sistem gameplay, HTML, atau balance.

## Format dan pemuatan

Gunakan **classic script** tanpa import/export ESM, fetch, DOM, atau dependensi runtime. Harus bekerja lewat `file://`. Daftarkan definisi JSON-compatible dalam registry:

```js
window.PenjagaMaps = window.PenjagaMaps || {};
window.PenjagaMaps.island = {
  version: 1,
  id: 'island',
  name: 'Pulau Penjaga',
  width: 1280, height: 704, tileSize: 64,
  rows: { 1: [6, 14] /* salin seluruh mask baseline */ },
  landBounds: { left: 80, right: 1195, top: 80, bottom: 630 },
  heroSpawn: { x: 788, y: 370 },
  castle: { x: 845, y: 310 },
  roadEntry: { x: 110, y: 405 },
  squadGuard: { x: 845, y: 355 },
  allySpawn: { x: 885, y: 355 },
  allyHome: { x: 720, y: 325, width: 120, height: 100 },
  trees: [], goldNodes: [], sheep: [], buildings: [], rocks: [], bushes: [], villagers: []
};
```

Semua koordinat dalam world pixels. `landBounds` memakai batas eksklusif. `rows` berisi rentang kolom inklusif per baris. Array dan objek harus disalin persis dari baseline, tanpa mengubah koordinat, urutan, atau atribut:

- `trees`: objek hasil `.map` baseline, `{x,y,variant,seed,radius,size,resource}`.
- `goldNodes`: `{x,y,variant,radius}`.
- `sheep`: `{x,y,originX,originY,seed,cooldown:0}`; cooldown hanya nilai awal.
- `buildings`: `{x,y,color,name,width,radius,cy}`; `cy` pusat collider.
- `rocks`, `bushes`: tuple `[x,y,variant]` seperti baseline.
- `villagers`: `{x,y,tool,type,facing}`.

`width/height/tileSize` dan spawn di atas wajib ada. Gameplay, wave, statistik unit, harga, dan reward mining berada di luar definisi map. Hadiah dan label mining memakai `GATHERING_REWARDS.gold` di `src/config.js`.

## Kepemilikan runtime

`World` memvalidasi dan melakukan deep clone definisi sebelum runtime membangun terrain, scenery, collider dan navigation. Registry adalah authoring data yang tidak pernah dimutasi. Cooldown domba dimiliki World; cache rute dimiliki komponen navigation pada runtime yang sama. Session menyimpan referensi hero/kastel sendiri. Restart mempertahankan semantik baseline; runtime baru membangun ulang cache navigasi untuk world-nya.

Bootstrap memilih `PenjagaMaps.island`. Modul `maps/island.js` dan `maps/validate-map.js` dari commit `33ee225` pada branch `codex/map-data` sudah terintegrasi. Oracle sebelum refactor tersedia untuk tes di `game-preview/fixtures/baseline-game.js`. Pemilihan map dilakukan saat runtime dibuat.

Ekstensi authoring dari chat map dipertahankan sebagai data. Runtime saat ini memakai `roads[].points` untuk gambar jalan dan satu `paths[0]` untuk arah masuk/keluar lane. Jika `paths` tidak ada, World menyusun adapter jalur lama relatif terhadap `roadEntry`. Field lain seperti beberapa `enemySpawns`, `initialAllies`, konfigurasi collision alternatif, dan seluruh metadata dekorasi belum mengubah gameplay. Dekorasi air/dermaga/awan masih memakai renderer island yang lama. Dukungan runtime atas metadata itu adalah tahap terpisah.

## Kriteria integrasi

1. File final hanya mendaftarkan data dan dapat dimuat sebelum bootstrap lewat script defer.
2. Definisi island deep-equal dengan oracle baseline untuk semua field di atas.
3. Dua World tidak berbagi sheep, collider, array atau cache mutable.
4. Jalankan tes engine, upgrade sepuluh tingkat, replay deterministik dan browser HTTP/file setelah integrasi.

Kontrak ini adalah sumber acuan integrasi; laporkan path/commit modul dari chat map kepada integrator jika selesai sesudah refactor.
