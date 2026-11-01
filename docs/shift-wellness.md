# Shift, kesehatan, dan rencana harian Atlas

## Mulai memakai

1. Buka **Kalender → Impor & kelola shift**, atau **Ruang Saya → Jadwal shift**.
2. Masukkan nama pada baris jadwal dan bulan, lalu unggah foto. Hasil pembacaan belum disimpan: periksa tanggal/kode, koreksi sel yang tidak jelas, lalu tekan **Simpan jadwal yang diperiksa**. Tanggal yang sudah ada diperbarui; tanggal lain dipertahankan.
3. Lampiran Seva Oktober 2026 tersedia sebagai pratinjau transkripsi siap diperiksa. Tidak ada jadwal atau data kesehatan yang otomatis dimasukkan ke akun lain.
4. Atur **Ruang Saya → Kesehatan → Profil & kebiasaan pribadi** sekali, atau ceritakan profil lewat AI. Nilai awal waktu tidur, perjalanan, handover, dan frekuensi latihan adalah usulan yang bisa disesuaikan. Tinggi/berat dan target gizi tidak diisi otomatis.
5. Buka **Rencana hari ini** dari Beranda. Tombol **Sudah makan**, **Sudah latihan**, **Selesai**, **Tunda 30 mnt**, dan **Lewati** mencatat tindakan sebenarnya. Makanan yang dikonfirmasi tanpa rincian disimpan tanpa mengarang kalori; lengkapi melalui Kesehatan bila perlu.

Contoh pesan:

- “Tinggi saya 165 cm, berat 47 kg. Saya ingin menambah berat badan, latihan di rumah, dan biasanya makan dua kali sehari. Simpan profil saya.”
- “Saya tidur enam jam, energi saya dua dari lima. Tadi makan nasi ayam dan tempe 25 ribu. Catat tidur, energi, makanan, dan pengeluarannya.”
- “Tanggal 23 Oktober berubah menjadi shift pagi.”
- “Buat tugas laundry 30 menit, tenaga ringan, tenggat Jumat.”
- “Tandai tugas laundry selesai.”
- “Buat program full body fleksibel untuk latihan di rumah beserta gerakan, set, dan repetisinya.”

Pesan bisa menjalankan beberapa aksi. Kartu hasil aksi menampilkan tindakan yang benar-benar disimpan dan tombol **Batalkan aksi** untuk aksi yang mendukung pembatalan. Riwayat chat menyimpan kartu ini. Pembatalan ditolak bila data sudah berubah setelah aksi tersebut, agar koreksi terbaru tidak tertimpa. Informasi profil dan data terbaru dimuat kembali pada percakapan berikutnya.

## Cara perencana bekerja

- Kode shift mengikuti legenda lampiran: `1` 06–14, `2` 14–22, `3` 22–06 besok, `1&2` 06–22, `2&3` 14–06 besok, `L` libur. Zona waktu memakai profil akun, default Asia/Jakarta.
- Kalender menampilkan acara di semua tanggal yang dilaluinya. Acara manual juga dapat memakai pilihan **Selesai keesokan hari**.
- Perencana melindungi perjalanan sebelum/sesudah kerja, handover setelah shift, tidur, dan agenda tetap. Waktu handover dapat diubah jika kebijakan tempat kerja berbeda.
- Hari libur setelah shift malam menjadi hari pemulihan. Shift panjang, energi rendah, atau catatan tidur kurang dari enam jam menunda latihan. Sesi latihan memakai jeda setidaknya satu tanggal penuh dan target bergulir tujuh hari.
- Program fleksibel yang memiliki gerakan dipakai oleh perencana. Bila belum ada program, tersedia contoh full body A/B dengan gerakan, set, repetisi, dan panduan dasar.
- Maksimal satu tugas disarankan pada hari pemulihan, tiga pada hari lain. Tugas diurutkan berdasarkan tenggat dan disesuaikan dengan slot kosong. Usulan untuk tugas tertunda tidak mengubah tanggal aslinya. Perubahan lewat chat menolak pemindahan tugas tetap dan tanggal setelah tenggat.
- Pengingat makan saat kerja bersifat fleksibel: pengguna tetap menyesuaikan dengan jeda yang diizinkan. Banyaknya makan merupakan alat bantu kebiasaan, bukan ukuran kecukupan energi.
- Target kalori/protein bersifat opsional dan tidak dihitung dari tinggi/berat saja. Angka dari deskripsi/foto diberi label perkiraan; makanan tanpa porsi jelas boleh tanpa angka. Grafik berat menampilkan pengukuran 30 hari terakhir.

## Pengingat

Pengingat aktivitas rencana harian di Kesehatan memeriksa aktivitas saat aplikasi **terbuka dan terlihat**, menghindari waktu tidur, dan menyediakan tindakan cepat di dalam aplikasi. Notifikasi perangkat untuk aktivitas ini memerlukan izin browser.

**Pengingat minum air** memiliki pengaturan tersendiri di Kebiasaan dan Kesehatan. Mode otomatis mengikuti shift serta waktu tidur profil, termasuk tidur singkat sebelum shift malam dan pemulihan setelahnya. Saat tidak ada shift, jam bangun/tidur profil digunakan. Interval awal 120 menit dapat diubah; mode manual juga tersedia. Ini adalah pengaturan kebiasaan, bukan penentuan kebutuhan cairan.

APK menjadwalkan pengingat minum melalui alarm lokal Android untuk 45 hari, sehingga tetap berjalan saat Atlas ditutup dan offline. Perubahan shift/profil memperbarui jadwal saat aplikasi terbuka dan online. Jika sinkronisasi gagal, jadwal tersimpan digunakan sampai masa berlakunya habis, lalu pengingat berhenti sampai Atlas berhasil menyinkronkan lagi. Jadwal otomatis menggunakan zona waktu profil; manual mengikuti jam HP. Browser hanya mengingatkan saat halaman terlihat. Deployment backend dan frontend/APK terbaru diperlukan; tidak ada perubahan schema untuk penyesuaian otomatis ini. Detail batasan izin, hemat baterai, dan force stop tersedia pada README.

## Database dan deployment

Migrasi baru: `db/migrations/20261019_shift_wellness.sql`. Migrasi menambah profil kesehatan, penugasan shift, catatan kesehatan, status rencana, metadata tugas/workout, dan kartu aksi chat. Semua data baru dibatasi ke akun yang login. Tidak ada akun/berat badan/jadwal pribadi yang di-seed ke database.

Deployment Vercel yang sudah memakai `npm run db:migrate` saat build akan menerapkan migrasi sebelum API baru dipublikasikan. Untuk menjalankannya secara manual pada database tujuan:

```bash
npm run db:migrate
npm run build
npm run build --prefix web
```

Jangan mengeksekusi ulang seluruh `db/schema.sql` pada database yang sudah digunakan. Frontend dan backend terbaru harus dipublikasikan bersama. Android memerlukan build dan sinkronisasi aset baru seperti alur pada README.

Pembacaan foto dan chat nyata memerlukan `OPENROUTER_API_KEY` yang valid serta model gratis yang mendukung gambar/tool. Gangguan provider ditampilkan sebagai kesalahan; pratinjau lampiran dan input manual tetap tersedia. Foto impor tidak disimpan ke tabel kesehatan/shift.

## Validasi

```bash
npm test
npm run build
npm run build --prefix web
npm run test:e2e --prefix web
```

Pada Linux dengan Chromium sistem, gunakan `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium` untuk pengujian browser. Pengujian fungsi memakai database/provider tiruan, bukan data produksi. Suite browser mencakup impor dan koreksi jadwal, draft gagal simpan, pencatatan/undo, kalender lintas tengah malam, profil, dan penyelesaian rencana. Suite browser memerlukan izin membuka server lokal di port 5173.
