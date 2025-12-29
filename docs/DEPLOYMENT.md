# 🚀 Tutorial Deploy Fullstack SIPREMS ke Railway

Tutorial lengkap untuk deploy Frontend, Backend, dan ML Service ke Railway.

---

## 📋 Persiapan Sebelum Deploy

### 1. Pastikan File Konfigurasi Sudah Ada

Cek file-file berikut sudah ada di repository:

| File | Lokasi | Status |
|------|--------|--------|
| `railway.json` | `backend-ts/railway.json` | ✅ Sudah dibuat |
| `railway.json` | `ml-service/railway.json` | ✅ Sudah dibuat |
| `Dockerfile` | `ml-service/Dockerfile` | ✅ Sudah ada |

### 2. Push Semua Perubahan ke GitHub

```bash
git add .
git commit -m "prepare for railway deployment"
git push origin main
```

---

## 🔧 Step 1: Buat Akun Railway

1. Buka [railway.app](https://railway.app)
2. Klik **Login** → pilih **GitHub**
3. Authorize Railway
4. Anda mendapat **$5 credit gratis per bulan**

---

## 🛠️ Step 2: Deploy Backend

### 2.1 Create Empty Project
1. Di dashboard, klik **+ New Project**
2. Pilih **Empty Project**
3. Beri nama project: `siprems`

### 2.2 Add Backend Service
1. Dalam project, klik **+ New**
2. Pilih **GitHub Repo**
3. Pilih repository `siprems` atau `siprems-cd`
4. **PENTING**: Sebelum deploy, klik link **"Add Root Directory"**
5. Isi: `backend-ts`
6. Klik **Deploy**

### 2.3 Configure Build (jika tidak auto-detect)
Pergi ke **Settings** → **Build**:
- Build Command: `npm install && npm run build`
- Watch Paths: `/backend-ts/**`

### 2.4 Configure Start Command
Pergi ke **Settings** → **Deploy**:
- Start Command: `npm start`

### 2.5 Add Environment Variables
Pergi ke tab **Variables**, tambahkan:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres.hnddcambdbftrehbhetb:YA10eYEACRPZuOvh@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://hnddcambdbftrehbhetb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZGRjYW1iZGJmdHJlaGJoZXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MzQ0MTMsImV4cCI6MjA3OTUxMDQxM30.fVU8M1CFosUERkFSQHmXjnhFiuYwQ0VgkKxmqRuXXkM
GEMINI_API_KEY=AIzaSyDj1FdY3Yk6RqcNHt8JLd3xseqYx_0fZh0
ML_SERVICE_URL=http://${{ml-service.RAILWAY_PRIVATE_DOMAIN}}:8001
```

### 2.6 Generate Public URL
1. Pergi ke **Settings** → **Networking**
2. Klik **Generate Domain**
3. Catat URL (contoh: `siprems-backend-xxx.up.railway.app`)

---

## 🐍 Step 3: Deploy ML Service

### 3.1 Add ML Service
1. Dalam project yang sama, klik **+ New**
2. Pilih **GitHub Repo**
3. Pilih repository yang sama
4. **Klik "Add Root Directory"** → isi: `ml-service`
5. Railway akan auto-detect Dockerfile

### 3.2 Rename Service
1. Klik nama service
2. Rename menjadi: `ml-service`

### 3.3 Add Environment Variables
```env
FLASK_ENV=production
PORT=8001
```

### 3.4 Generate Domain (Optional)
Jika perlu akses publik, generate domain di Networking.

---

## 💻 Step 4: Deploy Frontend

### 4.1 Add Frontend Service
1. Klik **+ New** → **GitHub Repo**
2. Pilih repository yang sama
3. **JANGAN** set root directory (biarkan kosong untuk deploy root)
4. Railway akan detect Dockerfile di root

### 4.2 Add Environment Variables
```env
VITE_API_URL=https://[backend-domain].up.railway.app
VITE_FIREBASE_API_KEY=AIzaSyDPZzEoxBztDbrNBedFsS0_AvyITUUajSU
VITE_FIREBASE_AUTH_DOMAIN=siprems-6fa80.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=siprems-6fa80
VITE_FIREBASE_STORAGE_BUCKET=siprems-6fa80.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=428482190168
VITE_FIREBASE_APP_ID=1:428482190168:web:ac3820b03ea2cbb8a0632d
```

### 4.3 Generate Domain
Klik **Settings** → **Networking** → **Generate Domain**

---

## 🔗 Step 5: Update Connections

### 5.1 Update Backend → ML Service
Di Backend service, update variable:
```env
ML_SERVICE_URL=http://ml-service.railway.internal:8001
```

### 5.2 Update Frontend → Backend  
Di Frontend service, update variable dengan URL backend yang di-generate.

### 5.3 Update Firebase Authorized Domains
1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pergi ke **Authentication** → **Settings** → **Authorized domains**
3. Tambahkan semua domain Railway:
   - `siprems-frontend-xxx.up.railway.app`
   - `siprems-backend-xxx.up.railway.app`

---

## ✅ Checklist Final

- [ ] Backend deployed dan berjalan
- [ ] ML Service deployed dan berjalan
- [ ] Frontend deployed dan berjalan
- [ ] Backend bisa connect ke ML Service (internal network)
- [ ] Frontend bisa connect ke Backend (public URL)
- [ ] Firebase domains authorized
- [ ] Database migrations sudah dijalankan di Supabase

---

## 🔧 Troubleshooting

### Error: Could not resolve module
Pastikan Root Directory sudah diset dengan benar sebelum deploy.

### Backend tidak bisa connect ke ML Service
Gunakan internal domain: `http://ml-service.railway.internal:PORT`

### CORS Error
Tambahkan domain frontend ke backend CORS config.

### Build timeout
Free tier memiliki batas build time. Coba upgrade atau optimasi build.

---

## 📊 Estimasi Biaya

| Service | Usage/bulan | Cost |
|---------|-------------|------|
| Frontend | ~100MB RAM | ~$0.50 |
| Backend | ~256MB RAM | ~$1.50 |
| ML Service | ~512MB RAM | ~$2.50 |
| **Total** | | ~$4.50/bulan |

**Kesimpulan**: Dengan free tier $5/bulan, cukup untuk menjalankan semua service dengan usage rendah.
