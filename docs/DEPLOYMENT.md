# 🚀 Tutorial Deployment SIPREMS

Tutorial lengkap untuk hosting aplikasi SIPREMS ke platform gratis.

---

## 📋 Overview

| Komponen | Platform | URL Hasil |
|----------|----------|-----------|
| Landing Page | Vercel | `siprems-landing.vercel.app` |
| Frontend | Vercel | `siprems-app.vercel.app` |
| Backend | Railway | `siprems-backend.up.railway.app` |
| ML Service | Railway | `siprems-ml.up.railway.app` |

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

### Step 4: Deploy
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
| `VITE_API_URL` | `https://siprems-backend.up.railway.app` |
| `VITE_FIREBASE_API_KEY` | (dari Firebase Console) |
| `VITE_FIREBASE_AUTH_DOMAIN` | (dari Firebase Console) |
| `VITE_FIREBASE_PROJECT_ID` | (dari Firebase Console) |
| `VITE_FIREBASE_STORAGE_BUCKET` | (dari Firebase Console) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | (dari Firebase Console) |
| `VITE_FIREBASE_APP_ID` | (dari Firebase Console) |

### Step 4: Deploy
Klik **Deploy**.

> ⚠️ **Penting**: Update URL backend setelah deploy Railway!

---

## 3️⃣ Deploy Backend ke Railway

### Step 1: Buat Akun Railway
1. Buka [railway.app](https://railway.app)
2. Sign up dengan **GitHub** (gratis, tanpa kartu kredit)
3. Anda mendapat **$5 credit gratis per bulan**

### Step 2: Create New Project
1. Klik **New Project** → **Deploy from GitHub repo**
2. Pilih repository `siprems-cd`
3. Railway akan auto-detect monorepo

### Step 3: Configure Service
1. Klik service yang muncul → **Settings**
2. Scroll ke **Source**:
   - **Root Directory**: `backend-ts`
3. Scroll ke **Build**:
   - **Build Command**: `npm install && npm run build`
4. Scroll ke **Deploy**:
   - **Start Command**: `npm start`

### Step 4: Environment Variables
Klik **Variables** dan tambahkan:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `${{PORT}}` (Railway auto-assign) |
| `DATABASE_URL` | (URL PostgreSQL dari Supabase) |
| `SUPABASE_URL` | (dari Supabase) |
| `SUPABASE_ANON_KEY` | (dari Supabase) |
| `GEMINI_API_KEY` | (dari Google AI Studio) |
| `ML_SERVICE_URL` | `https://[ml-service-name].up.railway.app` |

### Step 5: Generate Domain
1. Klik **Settings** → **Networking**
2. Klik **Generate Domain**
3. Catat URL (contoh: `siprems-backend.up.railway.app`)

### Step 6: Deploy
Railway akan auto-deploy setiap push ke GitHub.

---

## 4️⃣ Deploy ML Service ke Railway

### Step 1: Add New Service
1. Di project yang sama, klik **+ New** → **GitHub Repo**
2. Pilih repository `siprems-cd` lagi

### Step 2: Configure Service
1. **Settings** → **Source**:
   - **Root Directory**: `ml-service`
2. Railway akan auto-detect **Dockerfile**

### Step 3: Environment Variables
| Key | Value |
|-----|-------|
| `FLASK_ENV` | `production` |
| `PORT` | `${{PORT}}` |

### Step 4: Generate Domain
Klik **Settings** → **Networking** → **Generate Domain**

### Step 5: Update Backend
Kembali ke backend service, update variable:
```
ML_SERVICE_URL = https://[ml-service-domain].up.railway.app
```

---

## 5️⃣ Update API URLs

Setelah semua service deployed:

### Di Vercel (Frontend):
Update environment variable:
```
VITE_API_URL = https://[backend-domain].up.railway.app
```

### Di Landing Page:
Update file `landing-page/src/components/HeroSection.tsx`:
```tsx
<a href="https://[frontend-domain].vercel.app/login">
```

Commit dan push untuk auto-redeploy.

---

## 6️⃣ Database Setup (Supabase)

### Step 1: Buat Project Supabase
1. Buka [supabase.com](https://supabase.com)
2. Create new project (gratis)
3. Catat **Database URL** (Settings → Database → Connection string → URI)

### Step 2: Run Migrations
Di SQL Editor Supabase, jalankan migrations dari `backend-ts/migrations/`

### Step 3: Update Backend
Update `DATABASE_URL` di Railway dengan URL dari Supabase.

---

## ✅ Checklist Final

- [ ] Landing Page deployed ke Vercel
- [ ] Frontend deployed ke Vercel  
- [ ] Backend deployed ke Railway
- [ ] ML Service deployed ke Railway
- [ ] Database setup di Supabase
- [ ] Environment variables configured
- [ ] API URLs updated di semua service
- [ ] Firebase authorized domains updated

---

## 🔧 Troubleshooting

### Railway Credit Habis
- Upgrade ke Hobby plan ($5/bulan) atau
- Buat akun baru untuk reset credit

### CORS Error
Tambahkan domain Vercel ke allowed origins di backend `cors()` config.

### Firebase Auth Error
Tambahkan domain Vercel ke **Authorized Domains** di:
Firebase Console → Authentication → Settings → Authorized Domains

---

## 📱 URL Akhir

| Service | URL |
|---------|-----|
| Landing Page | `https://siprems-landing.vercel.app` |
| Dashboard | `https://siprems-app.vercel.app` |
| Backend API | `https://siprems-backend.up.railway.app` |
| ML Service | `https://siprems-ml.up.railway.app` |
