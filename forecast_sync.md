**“Perbaiki perhitungan akurasi prediksi pada frontend SIPREMS.
Saat ini akurasi hanya 28% karena frontend menggunakan regressors sintetis dari generate_future_regressors_clean() untuk validasi, bukan regressors asli dari database, sehingga prediksi dan data aktual tidak berada pada domain yang sama.

Tugas kamu:

Modifikasi frontend dan backend agar perhitungan akurasi MAPE menggunakan regressors asli (daily_sales_summary) yang benar-benar digunakan saat training.

Buat endpoint baru di backend: /api/model/accuracy yang:

Mengambil 14 hari terakhir dari daily_sales_summary

Mengambil regressors asli (transactions_count, avg_ticket, items_sold, event_intensity, holiday_intensity, closure_intensity, ds flags, dst.)

Menggunakan scaler_params dari metadata model

Menggunakan pipeline prediksi yang sama seperti training

Mengembalikan train_pred, actual, dan nilai MAPE akurat

Frontend harus menampilkan akurasi berdasarkan endpoint ini, bukan membuat regressors sintetis.

Pisahkan fungsi regressors menjadi:

generate_future_regressors_forecast() — khusus untuk ramalan masa depan

get_regressors_for_validation() — untuk akurasi, wajib memakai data asli

Pastikan akurasi frontend identik dengan hasil model_diagnostics.py

Berikan patch kode lengkap (backend + frontend), termasuk perubahan:

logic.py (jika perlu)

main.py (router)

model_trainer.py (validasi scaler)

smartprediction.jsx (frontend)

Setelah perbaikan, akurasi frontend harus naik mendekati nilai Validation MAPE dari diagnostics.

Gunakan kode yang bersih, aman, dan mengikuti pipeline model SIPREMS yang sudah ada.”**