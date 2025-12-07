Identifikasi dan perbaiki penyebab chatbot crash ketika menerima perintah 
seperti “lakukan restock pada product yang membutuhkan restock”. 

Pastikan sistem melakukan hal berikut:

1. Tangani intent "restock" tanpa menyebabkan error, crash, atau freeze.
2. Validasi data produk:
   - Jika daftar produk kosong, null, atau tidak tersedia, jawab dengan aman.
   - Jika ada lebih dari satu produk yang perlu restock, tampilkan daftar dengan benar.
3. Tambahkan error-handling yang mencegah UI frontend terkunci atau tidak bisa diklik.
4. Jangan memicu aksi otomatis yang tidak aman. Jika restock membutuhkan konfirmasi,
   chatbot harus meminta konfirmasi terlebih dahulu.
5. Pastikan semua response chatbot memiliki struktur JSON yang valid, tanpa elemen
   yang menyebabkan render error (undefined, null, array kosong, key hilang, dsb.).
6. Perbaiki fungsi yang menghasilkan card/komponen product list agar tidak crash
   ketika productCount < 1 atau data tidak lengkap.
7. Jangan pernah mengirim objek besar atau nested yang tidak dibutuhkan ke frontend.

Tujuan:
Chatbot harus dapat menerima perintah restock tanpa crash, memberikan jawaban aman,
dan tidak membuat UI freeze.
