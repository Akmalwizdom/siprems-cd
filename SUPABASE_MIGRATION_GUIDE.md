# Supabase Migration Guide

This guide walks you through migrating from local Docker PostgreSQL to Supabase cloud database.

---

## Prerequisites

1. **Create a Supabase Project**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Click "New Project"
   - Fill in project name and password
   - Wait for the project to be provisioned (~2 minutes)

2. **Install Supabase CLI** (Optional but recommended)
   ```bash
   npm install -g supabase
   # or
   brew install supabase/tap/supabase
   ```

---

## Step 1: Get Supabase Credentials

### From Supabase Dashboard:

1. **Project URL and API Keys:**
   - Navigate to: `https://app.supabase.com/project/YOUR_PROJECT/settings/api`
   - Copy:
     - `Project URL` (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
     - `anon public` key
     - `service_role` secret key

2. **Database Connection String (Transaction Mode):**
   - Navigate to: `https://app.supabase.com/project/YOUR_PROJECT/settings/database`
   - Scroll to **Connection Pooler** section
   - Select **Transaction Mode** (port 6543)
   - Copy the connection string:
     ```
     postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
   - Replace `[YOUR-PASSWORD]` with your project database password

---

## Step 2: Update Environment Variables

Update `backend/.env` with your Supabase credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key

# Database Connection String - TRANSACTION MODE (Connection Pooler)
DATABASE_URL=postgresql://postgres.xxxxx:your_password@aws-0-region.pooler.supabase.com:6543/postgres

# Gemini API Key
GEMINI_API_KEY=AIzaSyAijX_7tW8FN9_x3sfeVmVGGJ_K1Pjh8g0
```

---

## Step 3: Deploy Schema to Supabase

### Option A: Using Supabase Dashboard (Recommended for First-Time)

1. Go to: `https://app.supabase.com/project/YOUR_PROJECT/editor`
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `init.sql` file
5. Paste into the SQL Editor
6. Click **RUN** (or press Ctrl/Cmd + Enter)
7. Verify tables and views are created in the **Table Editor**

### Option B: Using Supabase CLI

1. **Login to Supabase:**
   ```bash
   supabase login
   ```

2. **Link to Your Project:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   (Get project ref from: `https://app.supabase.com/project/YOUR_PROJECT/settings/general`)

3. **Run Migration:**
   ```bash
   supabase db push --db-url "postgresql://postgres.xxxxx:[PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" < init.sql
   ```

### Option C: Using psql Command Line

```bash
psql "postgresql://postgres.xxxxx:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" -f init.sql
```

---

## Step 4: Verify Schema Deployment

Run this query in Supabase SQL Editor to verify:

```sql
-- Check all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check all views
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';

-- Verify data integrity function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'validate_data_integrity';
```

Expected tables:
- `products`
- `transactions`
- `transaction_items`
- `calendar_events`
- `sales_forecasts`

Expected views:
- `daily_sales_summary`
- `product_daily_sales`
- `category_sales_summary`

---

## Step 5: Seed Initial Data (Optional)

If you have existing data to migrate:

### Option A: Export from Local and Import

1. **Export from local Docker PostgreSQL:**
   ```bash
   docker exec -t siprems-db-1 pg_dump -U user -d siprems_db --data-only --inserts > data_dump.sql
   ```

2. **Import to Supabase:**
   ```bash
   psql "postgresql://postgres.xxxxx:[PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" -f data_dump.sql
   ```

### Option B: Run Seed Script (if available)

If you have a seed script (e.g., `backend/seed_smart.py`):

1. Update `backend/.env` with Supabase credentials
2. Run the seed script:
   ```bash
   cd backend
   python seed_smart.py
   ```

---

## Step 6: Update Docker Compose

The `docker-compose.yml` has been updated to:
- Remove local PostgreSQL service
- Connect backend to Supabase via environment variables
- Remove postgres volumes

To apply changes:

```bash
# Stop current containers
docker-compose down -v

# Rebuild and start (will use Supabase now)
docker-compose up --build
```

---

## Step 7: Test Connection

1. **Start the backend:**
   ```bash
   docker-compose up backend
   ```

2. **Check logs for successful connection:**
   ```bash
   docker-compose logs backend
   ```
   Look for successful startup without database connection errors.

3. **Test API endpoint:**
   ```bash
   curl http://localhost:8000/health
   # or whatever health check endpoint exists
   ```

4. **Verify data access:**
   Test a query that reads from `daily_sales_summary` view to ensure the backend can access Supabase.

---

## Troubleshooting

### Connection Timeout
- Verify you're using the **Connection Pooler URL** (port 6543, Transaction Mode)
- Check firewall settings
- Ensure Supabase project is not paused

### Authentication Failed
- Double-check password in DATABASE_URL
- Ensure no special characters are URL-encoded in the connection string

### Tables Not Found
- Verify schema deployment in Step 3
- Check you're connected to the correct Supabase project
- Run the verification queries from Step 4

### SSL Connection Issues
If you encounter SSL errors, add this to your DATABASE_URL:
```
?sslmode=require
```

---

## Rollback Plan

If you need to rollback to local PostgreSQL:

1. Restore original `docker-compose.yml`:
   ```bash
   git checkout docker-compose.yml
   ```

2. Restore original `backend/db.py`:
   ```bash
   git checkout backend/db.py
   ```

3. Update `backend/.env` to use local connection:
   ```env
   DATABASE_URL=postgresql://user:password@db:5432/siprems_db
   ```

4. Restart containers:
   ```bash
   docker-compose up --build
   ```

---

## Benefits of This Migration

✅ **Scalable:** Supabase Connection Pooler handles high concurrency  
✅ **Reliable:** Built-in backups and point-in-time recovery  
✅ **Secure:** Automatic SSL, Row Level Security available  
✅ **Cost-Effective:** Free tier includes 500MB database  
✅ **Future-Ready:** Easy to add Supabase Auth, Realtime, Storage later

---

## Next Steps (Optional)

- **Enable Row Level Security (RLS):** For multi-tenant data isolation
- **Add Supabase Auth:** Replace custom authentication with Supabase Auth
- **Use Supabase Client:** Migrate from raw SQL to `@supabase/supabase-js` for better type safety
- **Enable Realtime:** Subscribe to database changes for live updates
- **Configure Backups:** Set up daily backups in Supabase dashboard

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **Project Dashboard:** https://app.supabase.com
