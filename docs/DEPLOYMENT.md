# 🚀 Tutorial Deployment SIPREMS

Tutorial lengkap untuk hosting aplikasi SIPREMS ke platform gratis.

---

## 📋 Overview

| Komponen | Platform | URL Hasil |
|----------|----------|-----------|
| Landing Page | Vercel | `siprems-landing.vercel.app` |
| Frontend | Vercel | `siprems-app.vercel.app` |
| Backend | Render | `siprems-backend.onrender.com` |
| ML Service | Render | `siprems-ml.onrender.com` |

---

## 1️⃣ Deploy Landing Page ke Vercel

### Step 1: Buat Akun Vercel
1. Buka [vercel.com](https://vercel.com)
2. Klik **Sign Up** → pilih **Continue with GitHub**
3. Authorize Vercel untuk akses GitHub

### Step 2: Import Project
1. Di dashboard Vercel, klik **Add New** → **Project**
2. Pilih repository `siprems-cd`
3. Pada **Root Directory**, klik **Edit** dan pilih `landing-page`
4. Framework Preset: **Vite** (otomatis terdeteksi)

### Step 3: Configure Build
```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Step 4: Environment Variables
Tidak diperlukan untuk landing page.

### Step 5: Deploy
Klik **Deploy** dan tunggu hingga selesai (~2 menit).

> ✅ Landing page akan tersedia di: `https://[project-name].vercel.app`

---

## 2️⃣ Deploy Frontend (Dashboard) ke Vercel

### Step 1: Create New Project
1. Di Vercel, klik **Add New** → **Project**
2. Pilih repository yang sama `siprems-cd`
3. **Root Directory**: biarkan kosong (root folder)

### Step 2: Configure Build
```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Step 3: Environment Variables
Klik **Environment Variables** dan tambahkan:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://siprems-backend.onrender.com` |
| `VITE_FIREBASE_API_KEY` | (dari Firebase Console) |
| `VITE_FIREBASE_AUTH_DOMAIN` | (dari Firebase Console) |
| `VITE_FIREBASE_PROJECT_ID` | (dari Firebase Console) |
| `VITE_FIREBASE_STORAGE_BUCKET` | (dari Firebase Console) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | (dari Firebase Console) |
| `VITE_FIREBASE_APP_ID` | (dari Firebase Console) |

### Step 4: Deploy
Klik **Deploy**.

> ⚠️ **Penting**: Update URL backend setelah deploy Render!

---

## 3️⃣ Deploy Backend ke Render

### Step 1: Buat Akun Render
1. Buka [render.com](https://render.com)
2. Sign up dengan GitHub

### Step 2: Create Web Service
1. Klik **New** → **Web Service**
2. Connect repository `siprems-cd`
3. Konfigurasi:

| Setting | Value |
|---------|-------|
| **Name** | `siprems-backend` |
| **Region** | Singapore (atau terdekat) |
| **Root Directory** | `backend-ts` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

### Step 3: Environment Variables
Tambahkan environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | (URL PostgreSQL dari Supabase/Neon) |
| `ML_SERVICE_URL` | `https://siprems-ml.onrender.com` |
| `GEMINI_API_KEY` | (dari Google AI Studio) |
| `FIREBASE_PROJECT_ID` | (dari Firebase Console) |

### Step 4: Deploy
Klik **Create Web Service**.

> ⏱️ Build pertama memakan waktu ~5-10 menit.

---

## 4️⃣ Deploy ML Service ke Render

### Step 1: Create Web Service
1. Klik **New** → **Web Service**
2. Connect repository yang sama

### Step 2: Konfigurasi Docker
| Setting | Value |
|---------|-------|
| **Name** | `siprems-ml` |
| **Region** | Singapore |
| **Root Directory** | `ml-service` |
| **Runtime** | Docker |
| **Instance Type** | Free |

### Step 3: Environment Variables
| Key | Value |
|-----|-------|
| `FLASK_ENV` | `production` |
| `PORT` | `10000` |

### Step 4: Deploy
Klik **Create Web Service**.

---

## 5️⃣ Update API URLs

Setelah semua service deployed, update environment variables:

### Di Vercel (Frontend):
```
VITE_API_URL = https://siprems-backend.onrender.com
```

### Di Render (Backend):
```
ML_SERVICE_URL = https://siprems-ml.onrender.com
```

### Di Landing Page:
Update file `landing-page/src/components/HeroSection.tsx`:
```tsx
<a href="https://siprems-app.vercel.app/login">
```

Commit dan push perubahan untuk auto-redeploy.

---

## 6️⃣ Database Setup (Supabase)

### Step 1: Buat Project Supabase
1. Buka [supabase.com](https://supabase.com)
2. Create new project
3. Catat **Database URL** (Settings → Database)

### Step 2: Run Migrations
Jalankan migrations dari folder `backend-ts/migrations`:
```sql
-- Copy dan jalankan di SQL Editor Supabase
```

### Step 3: Update Backend
Update `DATABASE_URL` di Render dengan URL dari Supabase.

---

## ✅ Checklist Final

- [ ] Landing Page deployed ke Vercel
- [ ] Frontend deployed ke Vercel  
- [ ] Backend deployed ke Render
- [ ] ML Service deployed ke Render
- [ ] Database setup di Supabase
- [ ] Environment variables configured
- [ ] API URLs updated
- [ ] Firebase authorized domains updated (tambahkan domain Vercel)

---

## 🔧 Troubleshooting

### Backend Cold Start Lambat
Render free tier sleep setelah 15 menit inaktif. Solusi:
- Gunakan [UptimeRobot](https://uptimerobot.com) untuk ping setiap 14 menit

### CORS Error
Tambahkan domain Vercel ke allowed origins di backend.

### Firebase Auth Error
Tambahkan domain Vercel ke **Authorized Domains** di Firebase Console → Authentication → Settings.

---

## 📱 URL Akhir

| Service | URL |
|---------|-----|
| Landing Page | `https://siprems-landing.vercel.app` |
| Dashboard | `https://siprems-app.vercel.app` |
| API Docs | `https://siprems-backend.onrender.com/api` |
