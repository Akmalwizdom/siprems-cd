# Spesifikasi Komponen User Avatar & Dropdown Menu

## Layout & Styling

### Struktur Display
- **Nama Lengkap**: 
  - Style: **Tebal (font-weight: bold)**
  - Posisi: Di sebelah kiri Avatar
  
- **Email/Role**: 
  - Style: **Teks kecil** dengan warna **abu-abu**
  - Posisi: Di bawah Nama Lengkap

- **Format**: 
  - Gunakan `flex-col` (bertumpuk vertikal)
  - Teks berada di **sebelah kiri Avatar**

### Avatar User
- Bentuk: **Lingkaran**
- Konten: 
  - **Inisial nama**, atau
  - **Foto profil** (jika tersedia)

---

## Interaktivitas (Dropdown Menu)

### Trigger
- **Ketika Avatar diklik**: Munculkan Dropdown Menu
- Dropdown berbentuk **floating card** yang muncul di **bawah Avatar**

### Isi Dropdown

#### 1. Opsi Profile Settings
- Label: **"Profile Settings"**
- Action: **Link ke `/profile`**

#### 2. Divider
- **Garis pemisah** (horizontal line)

#### 3. Tombol Logout
- Label: **"Logout"**
- Style: **Warna merah/danger**

### Behavior
- **Click Outside**: Dropdown harus tertutup jika user klik di luar area dropdown

---

## Logika

### Data User
- Ambil data dari **`AuthContext`**:
  - Nama
  - Email
  - Avatar/Photo URL

### Logout Functionality
- Hubungkan tombol Logout dengan fungsi **`logout()`** dari Firebase

### State Management
- Gunakan state **`isOpen`** untuk mengatur visibilitas dropdown
```typescript
  const [isOpen, setIsOpen] = useState(false);
```

---

## Technical Implementation

### Event Handlers Diperlukan
1. **Toggle Dropdown**: `onClick` pada Avatar
2. **Click Outside Detection**: Untuk menutup dropdown
3. **Logout Handler**: Jalankan `logout()` dan redirect

### Component Structure
```
UserAvatarDropdown
├── Container (flex layout)
│   ├── User Info (flex-col)
│   │   ├── Name (bold)
│   │   └── Email/Role (small, gray)
│   └── Avatar (clickable, circular)
│
└── Dropdown Menu (conditional render based on isOpen)
    ├── Profile Settings (Link)
    ├── Divider
    └── Logout Button (danger style)
```

### Styling Notes
- Gunakan **Tailwind CSS**
- Dropdown: `absolute`, `shadow-lg`, `rounded-lg`
- Avatar: `rounded-full`, `cursor-pointer`
- Implementasi **z-index** yang tepat untuk dropdown