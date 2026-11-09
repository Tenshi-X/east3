# Atlas pribadi

Atlas sekarang membatasi login dan setiap API ke akun pemilik. Pendaftaran
ditutup pada handler Express, Vercel, dan Netlify yang memakai handler bersama.
Data akun lama tetap disimpan; perubahan ini tidak menghapus akun atau catatan.

## Aktivasi

1. Jalankan `npm run db:migrate` atau deploy backend melalui konfigurasi Vercel
   yang menjalankan migrasi otomatis. Migrasi `20261110_personal_atlas.sql`
   menetapkan pemilik hanya bila database sudah berisi tepat satu akun. Tidak
   ada mekanisme akun pertama yang login menjadi pemilik.
2. Bila ada beberapa akun, isi `ATLAS_OWNER_USER_ID` dengan UUID akun pribadi
   yang sudah ada pada environment backend. Alternatifnya, isi
   `ATLAS_OWNER_EMAIL` dengan email akun tersebut. UUID diprioritaskan bila
   kedua variabel diisi. Tanpa konfigurasi atau baris `atlas_owner` yang cocok,
   semua akun ditolak. Pengaturan di Vercel perlu redeploy.
3. Deploy backend dan web bersama. Untuk Android jalankan
   `npm run android:prepare --prefix web`, lalu build APK versi 1.1.0
   (`versionCode 6`). APK lama tidak berisi plugin biometrik, suara, backup,
   dan pengingat aktivitas yang baru.

## Pemakaian

- **Beranda:** check-in durasi tidur dan energi memperbarui perencana yang
  sudah melindungi shift, perjalanan, waktu tidur, pemulihan dan agenda tetap.
  Ritme bangun dihitung dari rentang tidur rencana lintas tengah malam; tanggal
  transaksi dan catatan tetap memakai tanggal kalender, sehingga laporan lama
  tidak bergeser. Check-in tidak menggeser agenda tetap.
- **Ruang Saya → Pribadi:** isi tempat tinggal, alat, kebiasaan makan, target
  dan gaya komunikasi. Tidak ada profil kesehatan atau nominal keuangan dari
  percakapan lama yang otomatis dimasukkan. Kesehatan dan shift tetap memakai
  halaman serta data yang sudah ada.
- **Memori:** tambah, ubah, hapus, dan pilih apakah setiap catatan boleh menjadi
  konteks AI. Profil memiliki pilihan berbagi sendiri. AI mengusulkan memori
  melalui kartu yang bisa diperiksa/diedit sebelum tombol **Simpan memori**.
  Menyimpan ulang kartu yang sama tidak menggandakan catatan. Data yang sudah
  dikirim pada percakapan sebelumnya tetap merupakan bagian riwayat percakapan.
- **Project:** simpan tujuan, satu langkah berikutnya, durasi, tenaga dan
  tenggat. **Masukkan ke rencana hari ini** membuat tugas biasa yang dibaca
  perencana; tidak memaksa slot di waktu kerja/tidur. Project yang ditunda tidak
  dapat membuat tugas baru. Tugas yang sudah dimasukkan tetap perlu diselesaikan
  atau dihapus pada rencana.
- **Uang:** perkiraan saldo memakai saldo awal seluruh kantong ditambah semua
  transaksi tercatat, termasuk yang tanpa kantong. Tagihan bulan berjalan yang
  belum terbayar, termasuk yang terlambat dalam bulan ini, dicadangkan jika
  jatuh tempo sebelum gajian berikutnya. Gaji masa depan dan lembur estimasi
  tidak dimasukkan sebagai saldo. Tanggal bulanan mengikuti akhir bulan bila
  tanggal pilihan tidak ada. Hari gajian dianggap awal siklus berikutnya.
- **Pembayaran:** konfirmasi nominal dan tanggal aktual sebelum mencatat
  pengeluaran tagihan atau pemasukan lembur. Pembayaran yang sudah dicatat
  manual perlu direkonsiliasi lebih dahulu agar tidak dicatat dua kali. Satu
  tagihan per periode dan satu penerimaan per lembur diproses secara atomik.
- **Lembur:** isi gaji dasar, pembagi, batas jam, pengali dan tambahan per sesi.
  Nilai awal adalah pengaturan yang bisa diubah, bukan penetapan hak lembur.
  Setiap catatan menyimpan salinan rumus, sehingga mengubah pengaturan tidak
  mengubah estimasi historis.
- **Evaluasi:** ringkasan tujuh tanggal terakhir menggunakan catatan nyata.
  Hari tanpa data tidur tidak dianggap nol jam; perubahan berat memerlukan
  setidaknya dua pengukuran. Hitungan tugas selesai adalah tugas bertanggal
  dalam periode, bukan waktu klik penyelesaiannya.
- **Catat cepat:** pilih pengeluaran, tugas, catatan, makanan, energi atau
  tidur. Input suara mengisi draf yang masih harus diperiksa/disimpan. Browser
  membutuhkan dukungan SpeechRecognition; APK memakai pengenal suara perangkat.
  Pengenalan suara dapat memerlukan jaringan dan layanan perangkat.
- **Offline:** antrean lokal dibatasi 100 catatan per akun, dengan UUID yang
  sama saat dikirim ulang. Sinkronisasi berlangsung saat aplikasi dibuka atau
  koneksi kembali. Kesalahan validasi tetap terlihat dan dapat dicoba ulang atau
  dihapus. Jangan hapus data browser/aplikasi sebelum antrean terkirim. Profil,
  backup, chat AI dan halaman lama tetap membutuhkan API; ini bukan salinan
  offline penuh database.
- **Kunci APK:** aktifkan melalui Profil setelah konfirmasi keamanan Android.
  Android 11+ memakai BiometricPrompt dengan biometrik kuat atau kunci layar;
  Android yang lebih lama memakai konfirmasi kunci layar. Ketika aktif, aplikasi
  mengunci kembali setelah berpindah ke latar belakang dan mencegah screenshot.
  Kunci ini menutup tampilan; pembatasan akun pada API tetap berlaku terpisah.
- **Backup:** ekspor JSON tidak menyertakan tabel pengguna, hash kata sandi,
  token, API key atau embedding. Android memakai pemilih lokasi penyimpanan.
  Pemulihan memerlukan konfirmasi, akun yang sama dan relasi yang dimiliki akun
  tersebut. Pemulihan menggabungkan data dalam satu transaksi; baris dengan ID
  sama diperbarui, data lain dipertahankan. Batas 4,5 MB dan 40.000 baris.

Pengingat aktivitas APK memakai jadwal tersinkron dari perencana hingga hari
berikutnya. Buka aplikasi untuk memperbarui jadwal setelah perubahan shift atau
agenda dari perangkat lain. Alarm yang kedaluwarsa tidak dikirim. Izin notifikasi,
penghemat baterai dan force stop dapat memengaruhi pengiriman. Pengingat minum
45 hari tetap memakai mekanisme yang sudah ada.

## Validasi

Jalankan `npm test`, `npm run build`, `npm run build --prefix web`, dan
`npm run test:e2e --prefix web`. Android: `assembleDebug testDebugUnitTest lintDebug`.
Biometrik, pemilih file, pengenal suara dan notifikasi saat layar terkunci tetap
memerlukan pengujian pada HP fisik. Pengujian otomatis tidak memakai akun produksi.

### Hasil pemeriksaan implementasi, 10 November 2026

| Pemeriksaan | Hasil dan bukti |
| --- | --- |
| Backend | PASS: 101 tes, termasuk batas pemilik, token akun lain, perhitungan gajian/lembur, pengiriman ulang, pembayaran ganda dan relasi backup. Setelah penyempurnaan konteks AI, 43 tes personal/regresi terkait dijalankan lagi dan lulus. |
| Browser | PASS: 78 tes Playwright, termasuk 12 alur personal baru, kegagalan simpan, pemulihan draf, tema, navigasi, dan regresi fitur lama. API dan jembatan Android disimulasikan. |
| Tampilan | PASS: seluruh tab personal diperiksa pada lebar 320 px di kedua tema; screenshot ponsel gelap dan desktop terang diperiksa. Fokus keyboard terlihat dan tidak ada overflow horizontal pada pemeriksaan ini. Komponen, warna dan ikon mengikuti arah Atlas yang sudah ada. |
| Build | PASS: pemeriksaan TypeScript backend dan build produksi frontend. |
| Android | PASS kompilasi Java seluruh sumber aplikasi terhadap SDK 36 dan dependensi cache lokal, termasuk plugin keamanan, suara, backup dan penerima pengingat. |

Migrasi langsung belum berhasil: koneksi Neon dari lingkungan pengembangan
menghasilkan `ENOTFOUND`. Tidak ada data produksi yang dimasukkan atau diubah
oleh migrasi yang gagal tersebut. Jalankan migrasi pada koneksi database yang
tersedia atau melalui build API Vercel.

Build APK penuh beserta unit test/lint Gradle belum selesai karena akses tulis
ke cache Gradle pengguna ditolak. Kompilasi Java langsung tidak menggantikan
pemeriksaan lint, pengemasan APK, atau pengujian perangkat nyata.
