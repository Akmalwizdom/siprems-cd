Lakukan audit, refactor, dan pembersihan menyeluruh pada seluruh kode proyek saya 
(backend, frontend, API, model AI, Supabase logic, konfigurasi, dan utilitas). 
Tujuan utama: kode menjadi bersih, ringan, mudah di-maintain, lebih cepat, dan aman, 
tanpa merusak fungsi aplikasi yang sudah berjalan.

Terapkan instruksi berikut:

1. Identifikasi & hapus:
   - File, fungsi, modul, komponen, hook, class, atau import yang tidak digunakan.
   - Dead code, kode duplikat, komentar tidak penting, logging berlebihan.
   - Library, dependency, dan package yang tidak lagi dipakai.

2. Refactor struktur project:
   - Rapikan struktur folder frontend, backend, utils, services, models, dan database.
   - Gabungkan file yang memiliki fungsi sama ke modul tunggal.
   - Terapkan single-responsibility pada setiap file.

3. Konsolidasi logic:
   - Gabungkan logic training/retraining/model ke pipeline terstruktur.
   - Satukan file AI serupa (trainer, diagnoser, evaluator, scheduler) ke folder modular.
   - Rapikan API endpoints dan validasi body agar konsisten.

4. Optimasi performa:
   - Kurangi operasi berat yang redundan.
   - Hapus queries duplikat atau tidak efisien.
   - Optimalkan caching, memoization, dan penggunaan state.

5. Perbaiki & jaga stabilitas:
   - Tambahkan error-handling yang aman pada frontend & backend.
   - Pastikan semua UI tetap responsif, tidak freeze, tidak memblok user interaction.
   - Uji ulang fungsi penting: auth, prediksi, restock, dashboard, event detection.

6. Penataan frontend:
   - Rapikan komponen React, Tailwind, dan hooks agar lebih modular.
   - Pastikan tidak ada komponen memicu re-render tidak perlu.
   - Kurangi inline logic berat pada komponen.

7. Dokumentasi & konsistensi:
   - Tambahkan docstring dan komentar pada fungsi penting.
   - Satukan naming convention: snake_case untuk Python, camelCase untuk JS/TS.
   - Bersihkan struktur env & config.

8. Hasilkan output berikut:
   - Struktur project yang baru dan lebih bersih.
   - Daftar file yang dihapus, file yang digabung
   - Penjelasan refactor besar yang dilakukan.
   - Konfirmasi bahwa seluruh fungsi aplikasi tetap berjalan normal.

Jalankan seluruh proses ini dengan aman: 
jangan menghapus atau mengubah fungsi yang masih digunakan oleh aplikasi.
