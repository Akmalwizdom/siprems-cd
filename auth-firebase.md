# Spesifikasi Sistem Otentikasi Firebase dengan React & TypeScript

Bertindaklah sebagai Senior React Developer dengan spesialisasi TypeScript.

Saya ingin membangun sistem otentikasi menggunakan Firebase.

## Tujuan Utama
Membuat sistem login/register yang aman dengan manajemen state global, di mana halaman Login berada di Root URL (`/`) dan Dashboard di (`/dashboard`).

---

## Spesifikasi Teknis

### 1. Tech Stack
- React
- TypeScript
- React Router Dom 
- Firebase Auth

### 2. Fitur
- Sign In dengan Email/Password
- Sign In dengan Google (Gunakan **Popup method**)
- Sign Up
- Logout

### 3. Strict Typing
Gunakan interface/types yang tepat (jangan terlalu banyak menggunakan `any`).

---

## Tolong buatkan kode-kode berikut:

### 1. 
* Inisialisasi app dan export `auth` instance.

### 2. 
* Buat Context Provider untuk mengelola user session.
* Gunakan `onAuthStateChanged` untuk memantau status login.
* Sediakan state `loading` agar aplikasi tidak flickering saat mengecek status login.
* Export custom hook `useAuth()` agar mudah dipanggil.

### 3. 
* **PrivateRoute**: Digunakan untuk membungkus Dashboard. Jika user belum login, redirect ke `/`.
* **PublicRoute**: Digunakan untuk membungkus Halaman Login. PENTING: Jika user sudah login dan mencoba akses rute ini (root `/`), redirect otomatis ke `/dashboard`.

### 4. 
* Implementasikan routing dengan struktur:
  * Path `/` -> Menggunakan `PublicRoute` (Menampilkan Login Page).
  * Path `/dashboard` -> Menggunakan `PrivateRoute` (Menampilkan Dashboard).

---

## Firebase Configuration Template

## Error Handling Requirements

### Harus Handle:
- [ ] Invalid email format
- [ ] Password too weak
- [ ] Email already in use
- [ ] Wrong password
- [ ] User not found
- [ ] Google popup blocked
- [ ] Network errors
- [ ] Firebase errors

### Display:
- [ ] Error messages untuk setiap case
- [ ] Loading indicators
- [ ] Success notifications

## Security Considerations

### Best Practices:
- [ ] Jangan hardcode Firebase config di production
- [ ] Gunakan environment variables (`.env`)
- [ ] Implement proper error messages (jangan expose sensitive info)
- [ ] Add rate limiting consideration
- [ ] Implement password strength indicator

## UI/UX Requirements

### Form Validation:
- [ ] Real-time validation
- [ ] Clear error messages
- [ ] Disabled state saat loading
- [ ] Success feedback

### Navigation:
- [ ] Smooth transitions
- [ ] No flash of wrong content
- [ ] Loading states saat check auth
- [ ] Proper redirect handling

## Catatan Penting
Tolong pastikan kodenya bersih (clean code) dan type-safe.