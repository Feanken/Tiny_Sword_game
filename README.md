# Penjaga Pulau

Klik dua kali **Mainkan.cmd** atau buka **index.html** di browser. Seluruh aset tersedia offline. Biarkan struktur folder tetap utuh.

- **Mulai Ekspedisi** membuka persiapan Pulau Embun → Pulau Dua Arah. Pilih kesulitan dan tekan **Berangkat** untuk memulai Map 1. Menangkan lima gelombang lalu pilih **Lanjut ke Pulau Dua Arah**.
- Emas dan keenam rank upgrade dibawa. HP penjaga dan benteng dipulihkan sesuai upgrade. Kayu, bekal, dan sekutu mengikuti kondisi awal Map 2.
- **Latihan Map 2** membuka persiapan arena dua jalur. Pilih kesulitan lalu **Berangkat** untuk memulai dengan bekal awal dan rank nol.
- **Pengaturan** dan **Cara Main** membuka dialog. **Galeri Aset** tersedia sebagai pilihan sekunder. **Kembali** atau Esc dari persiapan mengembalikan menu utama.
- Ekspedisi berlangsung dalam satu halaman. Memuat ulang halaman memulai sesi baru.

Folder gambar dipertahankan karena dipakai oleh permainan dan galeri aset. Audio sudah tertanam di audio-pack.js. Kredit audio ada di folder credits.

Slot desktop **Q — Triple Slash** menampilkan syarat Bilah tingkat 10, progres tiga
tebasan dan cooldown. Visual/HUD serta hasil tes ada di
[docs/triple-slash-visual.md](docs/triple-slash-visual.md).

Bidikan desktop: arahkan mouse di arena untuk membidik 360°, lalu klik kiri atau
tahan Spasi untuk menyerang. WASD/panah tetap menggerakkan pemain; chevron di tanah
menunjukkan arah efektif. Arah strike terkunci sampai kontak selesai. Audit pose,
hasil uji dan screenshot ada di [docs/mouse-combat-visual.md](docs/mouse-combat-visual.md).

Pada Bilah Bara tingkat 10, **Q** mengaktifkan **Triple Slash**: tiga tebasan
selama 0,9 detik dengan cooldown 8 detik. Arah dapat dikoreksi maksimal 30° pada
tebasan berikutnya. Dash membatalkan sisa combo tanpa mengembalikan cooldown.
Makan bekal sekarang memakai **H**; tombol Isi tenaga tetap dapat diklik.
Kontrak skill untuk visual/HUD ada di [docs/triple-slash-interface.md](docs/triple-slash-interface.md).

Skill desktop tingkat 10: **Rhythm** membangun lima lapis kecepatan serang saat hit;
**Wind** membuka tiga charge dash serial (Shift); **Counter** menyimpan satu balasan
4 detik setelah elak sempurna; **Bastion** menambah dua slot rekrut berbayar;
**R — Sumpah Penjaga** membuat zona pemulihan pemain dan sekutu. **H** tetap bekal,
**2** tetap perbaikan benteng dengan kayu. HUD menunjukkan charge, lapis, balasan,
kapasitas serta cooldown Q/R. Game normal masih dibatasi tingkat 10.
Perkembangan tingkat 20/25 diuji melalui fixture, tanpa cheat pada halaman game.
Parameter, titik integrasi Tahap 5 dan hasil uji:
[kontrak skill](docs/upgrade-skills-interface.md), [pemeriksaan](docs/upgrade-skills-checks.md).

Preview map tiga pulau untuk desktop: buka **preview-map.html** langsung di browser
(`file://` juga didukung). Pilih Bab 1/2/3, jelajahi dengan WASD/panah atau klik
tanah. Pilihan wilayah menyediakan titik aman untuk inspeksi. Panduan dan hasil
pemeriksaan ada di [docs/map-preview-checks.md](docs/map-preview-checks.md).
