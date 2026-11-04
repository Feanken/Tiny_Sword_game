# Prototipe map dan hasil traversal — Tahap 2

Branch `codex/campaign-map`, mulai dari main `6312d36`. Kedua commit acuan
`a011682` dan `cf5d9bc` digabung dengan merge commit sehingga tiga dokumen
Tahap 1 tersedia di branch ini. Kontrak awal preview dicommit terlebih dahulu
sebagai `7b4f360`; kontrak final ada di [map-preview-interface.md](map-preview-interface.md).

## Hasil implementasi

- [maps/campaign-islands.js](../maps/campaign-islands.js): tiga pulau, dua bridge,
  tiga entry path, tiga gate dan empat guard point. Seluruh ID kampanye dipertahankan.
- [maps/floor-geometry.js](../maps/floor-geometry.js): union rectangle lantai
  island mask dan bridge, footprint, cakupan rectangle jitter, dan pemeriksaan
  segmen kontinu. Renderer, collision, validator dan navigasi memakai sumber ini.
- [maps/validate-map.js](../maps/validate-map.js): mendukung v1 dan v2. V2 memeriksa
  ID/reference, mask multi-span, clipping, sambungan bridge, collider terhadap
  objek visual, spawn/jitter/lane/exit, serta konektivitas setiap kondisi bab.
- [src/world/world.js](../src/world/world.js): state wilayah aktif, filtering
  resource/obstacle, indeks wave/boss per path, snapshot lantai dan event topologi.
- [src/navigation.js](../src/navigation.js): geometri v2, rebuild graph, invalidasi
  cache/target/reservasi, dan pelepasan listener. Alur navigasi v1 dipertahankan.

World tetap 2560×1792, tile 64, grid navigasi 32, dan target benteng (1613,950).
Pulau utama diperluas ke localBounds (64,1280,64,768) dengan origin (768,640).
Pohon serta bangunan ditempatkan di tepi area tempur agar jalan menuju gate dan
halaman benteng tidak terhalang. Benteng building-01 tidak berpindah.

Bridge utara memakai centerline (1568,512) → (1568,800). Bridge barat daya memakai
(704,1312) → (832,1312) → (832,1184) → (960,1184). Lebar keduanya 160 px, termasuk
sambungan persegi. Lebar ini lolos fixture dua arah; belum merupakan perbandingan
playtest terhadap lebar 128 px pada sketsa. Tambang barat daya dipindah dari
(384,1536) ke (384,1600) karena collider posisi lama memotong jalur spawn.

| Kondisi | Path aktif | Node walkable | Connected component |
| --- | --- | ---: | ---: |
| chapter-1 | Barat | 575 | 1 |
| chapter-2 | Barat, utara | 789 | 1 |
| chapter-3 | Barat, utara, barat daya | 995 | 1 |

Kondisi di luar tiga set kumulatif ditolak sebelum mutasi. Mengaktifkan set yang
sama adalah no-op. Unlock menghasilkan versi topologi baru, mengosongkan reverse
route cache, rute aktor, target dan reservasi approach/engagement. Preview mundur
memindahkan aktor yang berada di wilayah tertutup ke posisi valid.

## Perbaikan yang ditemukan lewat traversal

Rute lama membuang node awal grid sebelum aktor mencapainya. Aktor yang berdiri
di samping node kemudian dapat memotong sudut collider benteng dan tersangkut.
Sampling segmen berjarak tetap juga dapat melewatkan kontak yang hanya mengiris
lingkaran collider. Kasus reproduksi adalah Monk dari (1616,464) ke (1581,965).

Pada v2, rute menyertakan node awal dan hanya melewati waypoint jika segmen
selanjutnya benar-benar bebas. Gerak ke waypoint dibatasi pada jarak sisanya.
Query segmen membagi lintasan pada semua batas rectangle lantai, memeriksa setiap
interval beserta delapan offset kaki, dan menghitung jarak terdekat ke lingkaran
collider secara analitik. Ini menghindari pendekatan yang mengisi air antarpulau
atau menyatakan segmen bebas hanya karena beberapa titik sampelnya aman.

Repulsion tambahan terhadap obstacle dinonaktifkan pada segmen v2 yang sudah
terbukti bebas. Sebelumnya repulsion dapat mengalahkan arah menuju tujuan yang
valid di dekat bangunan. Passing antarunit dan separation existing tetap dipakai.
Perubahan ini tidak diterapkan pada gerak map v1.

## Cara mengulang pengujian

Jalankan dari root worktree:

```powershell
node tests/campaign-map-test.mjs
node tests/campaign-browser-test.mjs
node tests/menu-browser-test.mjs
```

Test traversal dapat menyimpan detail setiap lintasan melalui
`--report <nama-file.json>`. Browser test memakai Chrome headless lokal;
`CHROME_PATH` dapat menunjuk executable lain yang kompatibel. Tidak ada dependency
paket tambahan. Fixture browser dibuat sementara, bukan preview game pengganti.

Hasil suite traversal adalah 1.929 pemeriksaan terhitung, ditambah assertion
collision setiap frame. Rinciannya:

| Kelompok uji | Cakupan dan hasil |
| --- | --- |
| Lintasan jembatan individual | 44 lintasan: dua bridge × dua arah × 11 profil aktor, lolos |
| Entry AI | 378 lintasan: lima jenis musuh × lima lane × empat sudut jitter dan titik tengah × tiga path, ditambah boss tiap path, lolos |
| Titik jaga | 132 perpindahan berarah antar-empat guard point untuk 11 profil, lolos |
| Pendekatan benteng | Dari setiap guard point ke guard-castle, tersedia |
| Traffic | 4 sekutu dan 4 musuh berlawanan arah pada masing-masing bridge, semuanya sampai |
| Wilayah terkunci | Titik island terkunci, bridge belum aktif, serta gerak cepat 720 px/detik tetap tertahan |
| Invalidasi | Cache, reservasi dan target lama hilang; snapshot lama tetap stabil; unsubscribe/no-op/rejected transition sesuai kontrak |
| Validator negatif | 13 definisi cacat ditolak, termasuk bridge putus/diagonal, lane terhalang, salah collider, ally spawn terkunci dan data malformed |
| Kompatibilitas v1 | island dan crossroads valid; hasil collision dibandingkan pada kisi titik dengan validator existing |

Profil aktor menggunakan player, Pawn/Warrior/Archer/Lancer/Monk musuh, boss, serta
Warrior/Archer/Lancer/Monk sekutu. Statistik unit diambil dari factory runtime
existing; player berjalan 185 px/detik, sekutu 88, musuh Normal wave pertama
Pawn 75, Lancer 59, lainnya 66, dan boss 62. Mining tetap 10000, enam upgrade
existing dan cap 10 tidak berubah. Tier ekonomi/skill Tahap 1 belum diaktifkan.

Uji browser kontrak lolos lewat HTTP lokal dan file:// untuk tiga kondisi bab,
query lantai dan invalidasi topologi. Regresi menu existing lolos pada keyboard,
touch, touch-small dan touch-landscape, termasuk handoff ekspedisi lama.
Browser test kontrak tidak memuat renderer kampanye atau menilai visual pantai.

## Waktu perpindahan antargate

Angka berikut adalah detik simulasi pada dt=1/60, aktor tunggal, tanpa musuh,
serangan, dash, knockback atau pekerjaan mining. Tujuan dianggap tercapai pada
jarak kurang dari 4 px. Masing-masing arah diuji; pasangan berikut simetris pada
fixture ini. Pengendalian pemain dipandu otomatis melalui gerak yang sama,
bukan pengukuran waktu respons manusia terhadap keyboard.

| Pasangan | Pemain | Sekutu 88 px/detik | Lancer musuh 59 px/detik |
| --- | ---: | ---: | ---: |
| Benteng ↔ barat | 0,983 | 2,050 | 3,067 |
| Benteng ↔ utara | 0,450 | 0,933 | 1,383 |
| Benteng ↔ barat daya | 2,333 | 4,883 | 7,283 |
| Barat ↔ utara | 0,650 | 1,350 | 2,017 |
| Barat ↔ barat daya | 1,333 | 2,800 | 4,183 |
| Utara ↔ barat daya | 1,983 | 4,150 | 6,200 |

## Waktu dari spawn ke gate

Semua keberangkatan dimulai pada t=0. Ini waktu berjalan sampai exit radius 22 px,
belum termasuk jarak menuju benteng, pertempuran, intersepsi atau pengaturan
jadwal keberangkatan. Rentang mencakup lima lane dan jitter; boss memakai lane 0.

| Path | Pawn | Warrior/Archer/Monk | Lancer | Boss |
| --- | ---: | ---: | ---: | ---: |
| Barat | 7,117–7,267 | 8,083–8,250 | 9,033–9,233 | 8,650 |
| Utara | 11,333–11,483 | 12,867–13,050 | 14,400–14,600 | 13,750 |
| Barat daya | 15,083–15,233 | 17,133–17,300 | 19,183–19,367 | 18,317 |

Perbedaan ini harus menjadi masukan scheduler kedatangan pada tahap berikutnya.
Branch ini tidak mengubah count/roster, menambah delay wave, atau membuat paket
arrival baru untuk kampanye.

## Traffic dan lokasi perlambatan

Fixture memakai empat sekutu dan empat musuh dalam slot terpisah 32 px, berjalan
dua arah. Bridge utara diuji dari sekitar (1568,464) menuju guard-north dan
sebaliknya; barat daya dari (672,1312) ke (1008,1184) dan sebaliknya.
Setiap tujuan mempunyai offset slot sendiri. Passing dan pairwise separation
berasal dari navigation/AI existing; aktor tidak menyerang.

| Bridge | Kedatangan seluruh 8 aktor | Delta terlambat terbesar terhadap aktor tunggal | Area padat teramati |
| --- | ---: | ---: | --- |
| Utara | 8,517 detik | +0,883 detik | Sel X 1536–1600/Y 896–960 dan X 1472–1536/Y 768–832 |
| Barat daya | 6,717 detik | +0,684 detik | Sel X 768–832/Y 1216–1280 dan X 960–1024/Y 1216–1280 |

Sel berukuran 64 px dicatat ketika aktor memiliki sedikitnya dua tetangga dalam
45 px dan kemajuan ke tujuan kurang dari 35% langkah dasarnya. Utara mencatat
0,200 dan 0,183 detik-aktor pada dua sel tersebut; barat daya 0,183 dan 0,017.
Itu penumpukan lokal singkat, bukan durasi macet seluruh rombongan. Tidak ada
aktor yang memenuhi detektor stall existing atau mencapai timeout.

Delta dapat negatif karena separation mendorong aktor, lookahead mengubah
lintasan, dan ambang selesai grup 8 px berbeda dari ambang individual 4 px.
Angka ini menggambarkan fixture; jangan menggunakannya sebagai penalti tetap.

## Batas hasil dan pekerjaan Chat 2

- Chat 2 masih memasang preview, kamera X/Y dan terrain renderer. Entry index.html
  tetap menjalankan game existing sampai integrasi tersebut dilakukan.
- Tiga bab di sini adalah kondisi topologi preview. Boss unlock, save, ekonomi,
  skill baru dan kampanye 15 wave belum dijalankan.
- Preview mundur harus menghentikan/reset scheduler aktif lebih dahulu; World
  tidak membatalkan keberangkatan director atau mengubah progres.
- Guard point tersedia sebagai data/query. Perintah F/G existing masih memakai
  anchor lama; pemilihan guard melalui HUD bukan bagian tahap ini.
- Seluruh aktor memakai model kaki existing radius 23 dengan delapan sampel,
  termasuk boss. Separation antartubuh bersifat lunak, sehingga overlap visual
  masih mungkin dan perlu diperiksa setelah renderer tersedia.
- Traffic yang diuji berjumlah delapan aktor tanpa combat. Tekanan tiga jalur,
  pasukan lebih besar, fight di tikungan, projectile/knockback dalam rombongan,
  performa frame dengan aset penuh, dan keterbacaan warning perlu playtest berikutnya.
- Kelayakan waktu rotasi saat bertarung dan rasa kontrol keyboard/mouse tetap
  memerlukan playtest manusia. Waktu simulasi di atas hanya batas traversal dasar.
