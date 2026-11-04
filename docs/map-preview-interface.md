# Map preview interface — Tahap 2, v1

Pemilik map/World/navigation: branch `codex/campaign-map`. Chat 2 memiliki kamera,
renderer dan pemasangan preview. Dokumen ini ditulis sebelum perubahan runtime.
Acuan: `a011682` (desain) dan `cf5d9bc` (ekonomi), keduanya sudah digabung.
Statistik, angka ekonomi dan enam upgrade existing tidak berubah pada tahap ini.

## Memuat prototipe

Gunakan classic script lokal, tanpa fetch/import, untuk HTTP dan file://:

1. `maps/island.js` (sumber aset/objek pulau utama).
2. `maps/floor-geometry.js` (geometri murni, tanpa DOM).
3. `maps/campaign-islands.js`.
4. `maps/validate-map.js`.
5. `src/world/world.js` dan modul runtime existing.

Definisi tersedia di `window.PenjagaMaps['campaign-islands']`. Buat World melalui
`new window.PenjagaModules.World(definition)`. World kampanye mulai pada Bab 1.
Map 1/Map 2 existing tetap bisa dimuat dengan urutan script lamanya.

## Sumber geometri bersama

- `world.floorGeometry`: snapshot lantai **aktif**, immutable.
- `world.allFloorGeometry`: seluruh pulau/jembatan, untuk pratinjau wilayah terkunci.
- Keduanya menyediakan `rectangles` dan `contains(x,y)`.
- `floorGeometry.segmentFits(a,b,world.activeObstacles)` memeriksa seluruh segmen
  beserta footprint dan collider, bukan sampling titik berjarak tetap. World,
  validator dan navigation memakai geometri lantai yang sama.
- Rectangle: `{x,y,width,height,regionId,kind:'island'|'bridge'}`, koordinat global.
  Rectangle boleh overlap: render sebagai union/path fill, bukan outline per rectangle.
- `contains` memeriksa lantai saja. `world.isWalkable(x,y)` juga memeriksa footprint
  kaki dan obstacle aktif; navigasi memakai predicate yang sama. Lantai jembatan
  tidak menjadi cover proyektil. `world.activeObstacles` adalah collider aktif.
- Island mask dipotong localBounds; bridge memakai segmen ortogonal dan sambungan
  persegi. Renderer tidak membuat mask walkable atau bentuk jembatan alternatif.
- `world.isRegionActive(id)` memeriksa unlock. `world.activeRegionIds` adalah array
  immutable. `world.objectRegions[sourceId]` menentukan wilayah suatu objek.
  `world.isObjectActive(sourceId)` digunakan untuk filtering interaksi/scenery.
- `world.allCollections` menyimpan array seluruh objek sebelum filtering. Sidecar
  `objectIds[collection][i]` mengacu pada array ini. `world.trees`, goldNodes,
  buildings, dan koleksi runtime lainnya hanya memuat objek aktif. Jangan memakai
  indeks array aktif untuk mencari ID pada sidecar seluruh dunia.
- Map v2 tidak mempunyai rows/landBounds v1. Gunakan floorGeometry untuk terrain,
  coastline dan bridge; jangan membuat rows fallback yang mengisi laut antarpulau.

## Mengganti bab untuk preview

```js
const world = new PenjagaModules.World(PenjagaMaps['campaign-islands']);
const stop = world.onTopologyChange(({version, activeRegionIds}) => {
  // Rebuild cache terrain/scenery dan clamp kamera. Jangan jalankan aturan reward.
});
world.applyChapterPreview('chapter-2');
// Alternatif controller kampanye: world.applyOpenRegions([...regionIds]).
stop(); // Saat pemilik listener dibuang.
```

| Preview | Wilayah kumulatif | Jalur aktif |
| --- | --- | --- |
| chapter-1 | island-main | path-west |
| chapter-2 | island-main, island-north, bridge-north | path-west, path-north |
| chapter-3 | Seluruh pulau dan kedua bridge | Ditambah path-southwest |

`applyChapterPreview` mengizinkan maju/mundur untuk inspeksi; ini bukan progres boss.
`applyOpenRegions` menerima tepat salah satu set di atas, urutan input bebas.
ID/kombinasi tidak valid ditolak sebelum state berubah. Set yang sama adalah no-op.
Set baru menaikkan `world.topologyVersion` sekali dan memberitahu listener secara
sinkron setelah lantai, collider dan indeks path/spawn aktif sudah siap.

Navigation otomatis rebuild graph ketika mendapat event itu: cache reverse route,
rute/target aktor, approach slots dan engagement reservations dibuang. Aktor yang
berada di lantai yang ditutup oleh preview dikembalikan ke posisi valid; tidak
dibiarkan di air. Perubahan preview dilakukan di antara tick simulasi.
Preview harus menghentikan/reset scheduler wave terlebih dahulu bila akan menutup
jalur yang mempunyai keberangkatan tertunda. API geometri ini tidak mereset director,
wallet atau progres boss. Pemakaian normal kampanye hanya membuka wilayah pada
boundary bab; kontrol maju/mundur adalah fasilitas inspeksi Chat 2.

`world.entryPaths`, `waveSpawns`, `bossSpawns` (Map keyed by pathId) dan
`wavePathIds` memuat jalur aktif. `world.bossSpawn` tetap alias kompatibilitas ke
boss spawn jalur pertama. `world.path(id)` / `world.guardPoint(id)` mengembalikan
definisi aktif atau undefined. Gate/guard point memakai ID dari kontrak kampanye.
Guard utara/barat daya mempunyai requiredRegionIds tambahan agar pilihan titik
jaga dapat mengikuti arah yang telah dibuka, meskipun posisinya di pulau utama.
`world.allEntryPaths`, allWaveSpawns dan allBossSpawns tersedia untuk menggambar
jalur terkunci. `navigation.dispose()` melepas listener jika preview dibuang.

## Penyesuaian terhadap sketsa Tahap 1

World tetap 2560×1792 dan benteng tetap (1613,950). Pulau utama diperlebar ke
localBounds (64,1280,64,768); mask final berada pada definisi map. Collider bangunan
dan pohon ditata ulang di tepi arena. Dua jembatan memakai lebar 160 px, dengan
centerline yang sama seperti sketsa. Tambang barat daya dipindah ke (384,1600)
agar lane spawn tidak memotong collidernya. ID sumber tetap sama.

## Batas kepemilikan

Branch ini tidak memasang preview pada index.html, tidak mengubah kamera/rendering,
tidak menjalankan 15 wave atau reward/unlock boss. Chat 2 memakai kontrak ini untuk
wiring preview dan menambahkan dependency script di entrypoint-nya. Geometri,
World dan navigation diuji headless; hasil traversal dan titik kemacetan dicatat
di `docs/campaign-map-traversal.md` setelah pengujian.
