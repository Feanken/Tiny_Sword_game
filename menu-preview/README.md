# Handoff aset dan CSS menu

Branch `codex/menu-visual` memakai baseline `3046dd7` dari repo `D:\YANG CORPORATE\Studying\CyberSecurity Basic\Terraform\Penjaga Pulau`. Aset dan stylesheet melanjutkan pekerjaan `25c58a2` dari repo sebelumnya. Berkas production yang disediakan adalah `menu.css` dan dua WebP di `assets/menu/`.

Pasang stylesheet sesudah stylesheet game yang sudah ada.

```html
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="layout.css">
<link rel="stylesheet" href="menu.css">
```

CSS memakai kontrak `#startScreen`, `.menu-main`, `.menu-setup`, dan `.menu-actions`. Tombol utama dapat memakai class `primary-button`, atribut `data-primary`, atau ID `startButton`. Tombol tambahan `menu-secondary`, pilihan `difficulty-picker`, dan catatan `difficulty-note` mengikuti draft HTML Chat 2. Panel dan layar ditampilkan atau disembunyikan melalui atribut `hidden`.

Desktop memakai menu di kiri dan gambar di kanan. Pada lebar sampai 900 piksel, gambar vertikal muncul di atas menu. Ponsel landscape memakai versi desktop dengan ukuran contain agar benteng utuh. Layar pendek dapat digulir sampai tombol terakhir. Font memakai Georgia dan font sistem lokal. Browser memuat satu gambar sesuai breakpoint dan orientasi.

`fixture.html` memperagakan judul “Jaga Pulau Sampai Fajar”, pilihan utama, panel persiapan, dan perpindahan panel khusus fixture. Screenshot menguji fixture ini. Chat 2 menangani pemasangan ke `index.html`, teks final, dan logika menu production.

## Mencoba fixture

Buka `menu-preview/fixture.html` langsung melalui `file://`. Untuk HTTP, jalankan `python -m http.server 4173 --bind 127.0.0.1` dari root worktree dan buka [fixture HTTP](http://127.0.0.1:4173/menu-preview/fixture.html).

Untuk mengulang pemeriksaan dan menyimpan screenshot, jalankan berikut dari folder game.

```powershell
node menu-preview/check.mjs --output menu-preview/screenshots
```

Skrip memakai Node.js 22 atau lebih baru dan Chrome di path Windows bawaan. Variabel `CHROME_PATH` dapat menunjuk executable Chrome lain.

## Hasil QA

| Viewport | Protokol | Hasil |
| --- | --- | --- |
| 1920 × 1080 | HTTP | Menu kiri, benteng kanan, fokus keyboard dan panel persiapan lulus |
| 1366 × 768 | file | Judul dua baris dan tombol muat di area gelap |
| 1280 × 520 | file | Posisi gambar menjaga bagian atas benteng. Semua pilihan terjangkau melalui scroll dan Tab |
| 820 × 1180 | file | Ilustrasi atas dan menu bawah lulus |
| 390 × 844 | file | Benteng dan penjaga utuh, empat tombol utama serta tautan galeri terlihat |
| 320 × 640 | file | Benteng utuh pada posisi awal, tombol terakhir terjangkau dengan scroll |
| 320 × 568 | file | Seluruh pilihan utama dan persiapan terjangkau dengan scroll dan keyboard |
| 844 × 390 | file | Ilustrasi panorama tetap utuh pada panel atas, seluruh pilihan terjangkau |

Pada semua ukuran, pemeriksaan memverifikasi tombol utama minimal 48 piksel, tanpa overflow horizontal, outline fokus 3 piksel, aktivasi keyboard menuju panel persiapan, atribut `hidden`, serta ketiadaan exception dan resource 404. Tab diuji sampai setiap pilihan utama, galeri, kesulitan, pilihan pulau, aksi mulai, dan tombol kembali. Mode file memuat seluruh stylesheet dan gambar secara lokal tanpa request HTTP. Pemeriksaan jaringan memastikan hanya satu versi ilustrasi dimuat untuk viewport tersebut.

Gambar sumber dan crop diperiksa secara visual. Screenshot desktop, fokus, ponsel dan setup juga diperiksa setelah render. Pengujian ini memakai Chromium desktop dengan emulasi viewport. Perilaku browser ponsel fisik dan kecocokan terhadap mockup asli masih perlu diperiksa setelah mockup tersedia.
