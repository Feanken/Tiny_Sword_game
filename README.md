# Penjaga Pulau

Klik dua kali **Mainkan.cmd** atau buka **index.html** di browser. Seluruh aset tersedia offline. Biarkan struktur folder tetap utuh.

- **Mulai Ekspedisi** membuka kampanye Bab 1: satu dunia tiga pulau, benteng tetap di pulau utama. Tiga bab masing-masing lima gelombang, dengan boss pada wave kelima.
- Emas, kayu, bekal, rank, tier berbayar, HP aktual dan sekutu hidup dibawa. Bab 2 membuka utara; Bab 3 membuka barat daya. Layar review membekukan dunia sampai pemain memulai persiapan. Pemulihan masuk bab adalah +50 HP penjaga/+140 HP benteng, dibatasi max HP.
- **Atlas Tiga Pulau** membuka preview-map.html untuk pengujian topologi Bab 1/2/3. URL lama ?map=crossroads membuka persiapan kampanye Bab 1.
- **Pengaturan** dan **Cara Main** membuka dialog. **Galeri Aset** tersedia sebagai pilihan sekunder. **Kembali** atau Esc dari persiapan mengembalikan menu utama.
- Ekspedisi berlangsung dalam satu halaman. Memuat ulang halaman memulai sesi baru.

Folder gambar dipertahankan karena dipakai oleh permainan dan galeri aset. Audio sudah tertanam di audio-pack.js. Kredit audio ada di folder credits.

Perkemahan (**U**, saat jeda) mendukung enam jalur hingga rank 25. Tier I membatasi
rank pada 10. Pembukaan Tier II memerlukan rank 10, kemenangan boss Bab 1 dan
500 emas per jalur; Tier III memerlukan rank 20, kemenangan boss Bab 2 dan
1.500 emas per jalur. Harga rank dibayar terpisah. Bukti boss diberikan setelah seluruh wave terakhir bab selesai, bukan hanya saat boss mati.
Kontrak progres/stat dan cara menguji fixture tersedia di
[docs/upgrade-tiers-interface.md](docs/upgrade-tiers-interface.md) dan
[docs/upgrade-tiers-checks.md](docs/upgrade-tiers-checks.md).

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
kapasitas serta cooldown Q/R. Rank 20/25 dapat dicapai melalui camp dan tier kampanye.
Parameter, titik integrasi Tahap 5 dan hasil uji:
[kontrak skill](docs/upgrade-skills-interface.md), [pemeriksaan](docs/upgrade-skills-checks.md).

Preview map tiga pulau untuk desktop: buka **preview-map.html** langsung di browser
(`file://` juga didukung). Pilih Bab 1/2/3, jelajahi dengan WASD/panah atau klik
tanah. Pilihan wilayah menyediakan titik aman untuk inspeksi. Panduan dan hasil
pemeriksaan ada di [docs/map-preview-checks.md](docs/map-preview-checks.md).

Kampanye dapat dibuka langsung melalui index.html (file://) atau HTTP. URL
`index.html?economy=standard` menonaktifkan override mining testing untuk profil
standar. Tanpa parameter, override pengguna 10.000 tetap dipertahankan. Modul
tambang Tahap 8 tetap memiliki transaksi/kuota; kontraknya ada di
[docs/campaign-runtime-interface.md](docs/campaign-runtime-interface.md).
Audit, hasil kampanye otomatis dan batas playtest ada di
[docs/campaign-playable-checks.md](docs/campaign-playable-checks.md).
Save/load belum tersedia; refresh dan restart memulai kampanye baru dari Bab 1.
