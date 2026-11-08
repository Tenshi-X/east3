# Workout dan jogging

Workout memiliki bagian Mingguan, Gerakan, Laporan, dan Program. Catatan dan
program lama dipertahankan di Program.

## Perilaku

- Pola awal: Senin workout A, Selasa jogging, Rabu workout B, Kamis istirahat,
  Jumat workout C, Sabtu jogging, Minggu istirahat. Mulai dua set, workout
  sekitar 30 menit, jogging santai sekitar 20 menit.
- Slot menggunakan perencana harian: kerja, perjalanan, handover, acara, tidur,
  dan energi diperhitungkan. Setelah shift malam atau pada shift panjang,
  pemulihan didahulukan. Target tidak dipaksakan bila slot kurang. Sesi kekuatan
  memiliki jeda minimal 48 jam, termasuk dari sesi nyata minggu sebelumnya.
- Hari tanpa shift diberi keterangan. Minggu dimulai Senin dan riwayat tidak
  direset. Checklist istirahat menyimpan salinan rencana. Hari aktif diselesaikan
  dengan durasi aktual, bukan durasi yang disarankan.
- Timer berbasis timestamp mengecualikan jeda, menyimpan draf per akun, dan
  menyediakan timer istirahat. UUID klien unik per akun mencegah sesi ganda
  setelah pengulangan penyimpanan.
- GPS memakai Geolocation watchPosition tanpa peta atau Google Maps. Jitter,
  akurasi buruk, loncatan, timestamp lama, dan gap lebih dari 30 detik diabaikan.
  Koordinat tidak disimpan atau dikirim ke server. Input jarak manual tersedia.
- Jogging dijeda saat aplikasi masuk latar belakang atau layar dikunci.
  WorkoutScreenPlugin mempertahankan layar Android selama timer; web memakai
  Screen Wake Lock jika tersedia. Belum ada layanan background GPS.
- Ilustrasi lokal Everkinetic memakai CC BY-SA 4.0. Glute bridge memakai gambar
  Wikimedia CC BY-SA 3.0 melalui internet. Sumber dan lisensi ada di panduan
  dan web/public/exercises/NOTICE.md. Langkah tetap tersedia jika gambar gagal.
- Laporan menghitung sesi, hari aktif, durasi, set, jarak, dan perbandingan
  minggu sebelumnya. Pace menggunakan total detik / total kilometer sesi jogging
  yang memiliki jarak. Istirahat tidak dihitung sebagai latihan.

## Aktivasi

Jalankan `npm run db:migrate`, lalu deploy backend dan frontend. Migrasi
20261108_workout_tracking.sql menambah kolom sesi dan workout_checkins tanpa
menghapus catatan. db/schema.sql juga diperbarui untuk instalasi baru.
Android memerlukan `npm run android:prepare --prefix web` dan APK baru.
Konfigurasi Vercel yang ada menjalankan `npm run db:migrate` otomatis saat build
backend; langkah manual diperlukan bila deployment tidak memakai konfigurasi itu.

Pada sesi pengembangan 8 November 2026, migrasi belum diterapkan karena koneksi
database gagal ENOTFOUND. Build APK Gradle terhalang cache/loopback lingkungan.
WorkoutScreenPlugin dan MainActivity berhasil dikompilasi langsung dengan javac
terhadap SDK Android 36, Capacitor, dan dependensi Android yang tersedia.
Jarak GPS, konsumsi baterai, dan perilaku layar perlu diuji pada ponsel nyata.

## Arah tampilan dan pemeriksaan

Perencana latihan pribadi pengguna shift, mengikuti tema Material Atlas.
ENERGY 1 / RHYTHM 2 / MOTION 0. Durasi besar memusatkan perhatian pada sesi;
urutan tanggal menjadi pola utama. Warna menandai hari ini dan tindakan utama.
Gambar dua posisi menjelaskan gerakan dengan ruang gambar yang sudah ditetapkan.

- PASS logika: 81 tes Node, termasuk shift, pemulihan, GPS, pace, kepemilikan,
  pengulangan simpan, dan regresi fitur sebelumnya.
- PASS build: TypeScript backend, build produksi frontend, dan kompilasi dua
  kelas Java yang diubah.
- PASS alur workout browser: checklist, panduan, timer/jeda, set, gagal simpan,
  GPS bergerak/ditolak, jeda latar belakang, pemulihan sesi, dan laporan lama.
- PASS regresi browser lengkap: 59 tes Playwright, termasuk halaman lama,
  pengingat minum, autentikasi, tema, keuangan, dan seluruh alur workout baru.
- PASS visual: tangkapan layar mingguan, panduan, laporan, desktop, tema gelap
  dan terang diperiksa. Viewport 320/390/768/1280 tidak memiliki overflow.
- PASS fungsi/sumber: handler tindakan, kondisi kosong/gagal, modal Escape,
  statistik dari catatan tersimpan, dan atribusi serta lisensi ilustrasi.

Pengujian browser menggunakan API tiruan, tanpa menulis akun produksi.
