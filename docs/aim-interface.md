# Mouse aim interface — Tahap 3, v1

Baseline audit: main `12b7c22`. Branch input/combat: `codex/mouse-combat`.
Dokumen ini ditulis sebelum implementasi. Chat 2 memiliki renderer; jangan menulis
state bidikan dari renderer atau menghitung sudut serangan lagi dari facing.

## Audit dan kepemilikan

Input existing sudah menyimpan pointerScreen/pointerWorld dan memanggil
renderer.screenToWorld(clientX,clientY). Camera2D menangani offset X/Y dan CSS rect,
bukan ukuran backing canvas/DPR. Namun combat masih memilih musuh terdekat lalu
memutar facing kiri/kanan. Hit memakai pusat kaki hero, sedangkan arc renderer lama
berasal dari hero.y−23. Ini harus diselaraskan oleh renderer Tahap 3.

| State / port | Pemilik | Makna |
| --- | --- | --- |
| input.pointerScreen | Input | Posisi client mouse terakhir pada canvas, atau null |
| input.pointerWorld | Input | Proyeksi pointer melalui renderer.screenToWorld; dihitung ulang ketika kamera bergerak |
| input.mouseAimActive | Input | Pernah menerima mouse pada canvas; touch tidak mengaktifkannya |
| input.pointerOverCanvas | Input | Pointer berada pada canvas gameplay, bukan UI di atasnya |
| hero.aimAngle | Input | Arah bidikan efektif, radian world. Terkunci ke strike.angle selama strike hidup |
| hero.strike.angle | Combat | Snapshot sumbu serangan saat dimulai; immutable untuk strike itu |
| hero.swingAngle | Combat | Salinan sudut strike terakhir, untuk recovery/miss visual setelah strike dibersihkan |
| combat.heroAttackOrigin() | Combat, read-only | Titik asal bersama, selalu {x:hero.x,y:hero.y} |
| combat.heroAttackAngle() | Combat, read-only | strike.angle bila hidup; hero.swingAngle untuk ekor visual terakhir |

Sumbu world: 0=kanan, π/2=bawah, ±π=kiri, −π/2=atas. Y positif ke bawah.
Origin mengikuti posisi pemain yang bergerak, seperti hit existing; bukan
snapshot posisi saat klik. Jangan menggeser origin arc ke dada/sprite. Reticle
memakai hero.aimAngle; arc memakai combat.heroAttackAngle().

## Lifecycle dan aturan arah

1. Input mengonversi posisi client dengan renderer.screenToWorld. Ia tidak
   mengubah kamera. input.updateAim() memperbarui bidikan sebelum attack dan
   sesudah gerak/tick strike. Renderer tetap dapat memanggil updatePointerWorld
   setelah kamera follow seperti existing. Port input tersebut menyinkronkan
   bidikan efektif dari proyeksi baru; renderer tidak menulis hero.aimAngle sendiri.
2. Saat attack diterima, combat menyalin hero.aimAngle ke strike.angle dan
   hero.swingAngle. Strike tetap menyimpan elapsed, target, hits dan counterBonus.
3. Seluruh windup dan contact memakai sudut yang sama sampai SWING.end (0,28 s).
   Pointer mentah boleh bergerak; sudut efektif tidak bergeser. Sesudah contact
   selesai, input kembali membaca pointer pada tick yang sama, termasuk recovery.
4. Mouse tepat di origin mempertahankan sudut valid terakhir. Toleransi numerik
   0,001 world pixel menangani round-off konversi kamera dan client coordinate
   PointerEvent Chrome, yang dapat dibulatkan menjadi float CSS pixel.
5. Sebelum mouse pernah digunakan, arah gerak keyboard/touch menjadi fallback;
   tanpa gerak pertahankan arah terakhir. Nilai awal run adalah 0 radian.
6. WASD mengatur translasi saja ketika mouse aktif. Pemain dapat berjalan mundur
   sambil membidik. hero.facing/swingFacing tetap ±1 untuk kompatibilitas sprite;
   keduanya tidak dipakai sebagai sumbu hit.
7. Pause/dialog/blur membersihkan tombol tahan dan buffer existing. Arah valid
   terakhir tetap tersedia. Run baru mereset aimAngle/swingAngle dan strike.

## Geometri untuk Chat 2

Hit memproyeksikan delta target terhadap sumbu strike.angle menjadi forward/side.
Pertahankan gate forward −12 px, reach 76, radius target 18, sapuan ±1,3 radian,
contact 0,16–0,28 s, cap dan damage dari config/upgrading existing.

```js
const origin = combat.heroAttackOrigin();
const axis = combat.heroAttackAngle();
const relative = combat.swingAngle(combat.heroAttackAge()); // API existing
// Chat 2: ctx.translate(origin.x,origin.y); ctx.rotate(axis);
// Arc lokal dari -config.SWING.angle sampai relative, tanpa mirror facing.
```

Angle strike adalah sumber yang sama untuk filter hit dan visual. Recovery/miss
memakai hero.swingAngle agar arc lama tidak mengikuti aim baru. Radius, timing,
warna/cue, sprite dan visual target tetap menjadi tanggung jawab Chat 2.

## Klik UI dan batas integrasi

Klik kiri pada canvas memulai/menahan serangan existing. Tombol, dialog dan overlay
DOM menerima eventnya sendiri, tanpa menembus canvas. Pointer capture yang bergerak
ke atas UI melepas binding mouse attack; Space tetap merupakan binding tersendiri.
Pemeriksaan UI menggunakan hit-testing DOM, bukan koordinat viewport yang dihardcode.

Entry point normal tetap index.html. Preview tiga pulau saat baseline tidak
menjalankan combat; fixture kecil hanya boleh dipakai untuk uji koordinat besar.
Branch ini tidak mengubah renderer.js, camera.js, index.html, balancing atau ekonomi.
Chat 2 menyesuaikan drawHeroSwing ke port di atas dan menguji visual di entry normal.
