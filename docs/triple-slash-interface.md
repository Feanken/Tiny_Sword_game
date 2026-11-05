# Triple Slash — interface Tahap 4, v1

Basis: integrasi Tahap 3 `f193d59`, termasuk combat `3ef7dfa` dan
[aim-interface.md](aim-interface.md). Main masih `12b7c22` saat worktree dibuat.
Kontrak ditulis sebelum implementasi pada branch `codex/triple-slash-combat`.
Input/combat/state dimiliki Chat 1; Chat 2 membaca state untuk visual dan HUD.

## Audit kontrol dan parameter prototipe

Q existing memanggil economy.healHero (makan bekal). Q menjadi Triple Slash;
makan bekal pindah ke **H**, termasuk kbd/title tombol dan panduan kontrol.
Klik kiri/Spasi tetap basic attack, Shift tetap dash. Tidak ada tombol skill baru
pada branch combat ini; Chat 2 mengerjakan visual/HUD.

Parameter config.TRIPLE_SLASH: unlockRank=10 pada jalur blade, slashes=3,
duration=0.9 detik, cooldown=8 detik, damageScale=1, targetCap=5,
maxTurnRadians=π/6 (30° per koreksi). Statistik/ekonomi lain tidak berubah.

## State dan kepemilikan

GameSession memiliki hero.skills.tripleSlash. Combat adalah satu-satunya penulis
state selama run; reset/title membuat state baru.

```ts
type TripleSlashState = {
  status: 'idle'|'active'|'completed'|'cancelled';
  sequence: number;                 // Bertambah hanya pada start yang diterima.
  cooldownRemaining: number;         // Detik simulasi, tidak memakai Date.now().
  elapsed: number;                   // Waktu combo 0..0.9.
  slashIndex: number;                // 0 saat idle; 1,2,3 sesudah start.
  slashElapsed: number;              // Waktu lokal 0..0.3.
  phase: 'idle'|'windup'|'contact'|'recovery';
  angle: number;                     // Sumbu terakhir, radian world.
  counterBonus: number;              // Snapshot saat combo dimulai.
  counterConsumed: boolean;
  hitCounts: [number,number,number];  // Maksimum 5 masing-masing.
  cancelReason: null|'dash'|'hit'|'death'|'run-ended'|'strike-lost'|'invalid-state';
};
```

Unlock diturunkan dari ranks.blade≥10, tidak disimpan sebagai flag terpisah.
completed/cancelled tetap tersedia untuk HUD sampai start berikutnya atau reset.
Cooldown terus turun pada status terminal ketika permainan berjalan.

## Fase dan sudut setiap tebasan

| Waktu lokal tebasan | phase | Aturan |
| --- | --- | --- |
| 0 ≤ t < 0.16 | windup | Buat strike baru dan kunci sudutnya |
| 0.16 ≤ t < 0.28 | contact | Jalankan hit yang sama dengan basic melee |
| 0.28 ≤ t < 0.30 | recovery | Strike contact sudah ditutup; belum boleh basic attack |

Tiga periode dimulai pada waktu combo 0, 0.30 dan 0.60; selesai pada 0.90.
Titik batas contact 0.28 tetap diselesaikan sebelum strike dibersihkan.
Tidak ada setTimeout yang dapat menghidupkan kembali tebasan setelah cancel.

Tebasan pertama memakai input.updateAim() melalui konversi kamera Tahap 3.
Tebasan kedua/ketiga membaca input.desiredAimAngle(), yaitu arah pointer world
tanpa lock strike, lalu membatasi shortest-angle delta dari sumbu sebelumnya
ke ±30°. Koreksi hanya dilakukan sekali saat tebasan berikutnya dimulai.
Mouse di origin mempertahankan arah terakhir sesuai toleransi Tahap 3.

hero.aimAngle tetap memakai sumbu skill selama combo aktif, termasuk recovery
antartebasan; tidak melompat ke mouse yang belum lolos batas koreksi.
Sesudah complete/cancel, bidikan bebas mengikuti mouse lagi.

## Strike dan area hit bersama

hero.strike tetap merupakan strike contact yang sedang hidup, dengan field
existing elapsed, angle (readonly), facing, target, hits:Set dan counterBonus.
Field tambahan: kind='basic'|'triple-slash', comboSequence dan slashIndex pada
strike skill. Set hits baru dibuat untuk setiap tebasan. Jangan menyimpan daftar
target kedua di renderer atau mengubah angle strike.

Combat memakai builder/resolver strike bersama. Resolver menolak strike yang
sudah dibatalkan/diganti, sequence lama, atau slashIndex yang tidak lagi aktif.
Jarak, forward allowance −12 px, SWING.reach=76, radius=18, sapuan ±1.3 radian,
navigation.clearPath dan combat.hurt (termasuk boss modifier) tetap digunakan.

Setiap hit skill memberi 100% primary melee damage (27+5×rank blade), termasuk
sasaran kedua sampai kelima. Ini berbeda dari secondary damage basic; tidak
mengganti damage basic. Counter yang disnapshot saat start ditambahkan hanya
pada hit valid pertama di seluruh combo, lalu counterConsumed=true dan riposte
dikonsumsi. Jika tebasan pertama miss, bonus dapat dipakai pada tebasan berikutnya.

Origin tetap combat.heroAttackOrigin() = posisi kaki pemain saat ini. Sumbu visual
tetap combat.heroAttackAngle(). hero.swingAngle menyimpan sumbu tebasan terakhir
untuk ekor visual. combat.heroAttackAge() memberikan slashElapsed ketika skill aktif,
agar renderer existing dapat menggunakan timing contact yang sama.

## Port untuk input, visual dan HUD

- combat.requestTripleSlash(): boolean; start atomik, tanpa buffering Q.
- combat.cancelTripleSlash(reason): boolean; tidak mengembalikan cooldown.
- combat.tripleSlashSnapshot(): POJO salinan, aman dibaca renderer/HUD.
  Memuat seluruh field state, unlocked, ready, duration, cooldown, slashDuration,
  contactStart/contactEnd, dan hitArea {origin,angle,reach,radius,halfAngle,backAllowance}.
- input.desiredAimAngle(): arah mouse mentah yang valid, tanpa mengubah lock.
- Port aim Tahap 3 tetap dipakai, tidak dibuat transform kamera baru.

State berada pada Session; installer src/triple-slash.js hanya mengatur lifecycle
skill dan dipasang oleh installCombat. Muat classic script lokal itu sebelum
src/combat.js, termasuk pada fixture combat. Tidak memakai fetch/import.

## Gate, pembatalan, pause dan reset

Start ditolak bila rank kurang, cooldown tersisa, game tidak playing, hero mati,
dash/stagger aktif, atau basic attack masih dalam strike/recovery/cooldown.
Reject tidak mengonsumsi cooldown atau mengubah sequence. Q auto-repeat atau Q
yang masih ditahan tidak memulai combo kedua; perlu keyup lalu penekanan baru.

Cooldown 8 detik terpakai segera ketika start diterima. Basic attack dan buffer-nya
ditolak selama combo aktif. Hold basic setelah combo selesai dapat memulai serangan
normal baru; tidak menjadi bagian combo yang lama.

Dash yang berhasil dimulai membatalkan combo dengan reason=dash. Dash yang gagal
karena cooldown tidak membatalkan skill. Hit yang menginterupsi memakai reason=hit;
kematian memakai death; akhir pertandingan memakai run-ended. Hilangnya strike
di luar penutupan contact memakai strike-lost; identitas/phase tak cocok memakai
invalid-state. Cancel membersihkan strike/attack/buffer dan menutup semua kontak
berikutnya. Cooldown, hitCounts dan hasil cancel tetap tersimpan untuk HUD.

Pause/dialog/blur membekukan tick sehingga cooldown dan semua fase berhenti.
Tidak ada pemasukan timer dari render atau waktu aplikasi ditutup.
Restart dan kembali ke judul mereset seluruh state skill, sequence dan cooldown.
Cooldown ini belum menjadi bagian save/carry kampanye yang dirancang pada Tahap 1.
