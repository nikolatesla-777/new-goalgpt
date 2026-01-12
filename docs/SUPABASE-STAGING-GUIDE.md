# Supabase Staging Environment Setup Guide

> **Duration:** ~30-60 minutes
> **Cost:** Free (Supabase free tier)
> **Last Updated:** 2026-01-12

---

## Step 1: Create Staging Project on Supabase

### 1.1 Go to Supabase Dashboard
1. Open browser: https://supabase.com/dashboard
2. Login with your account
3. Click **"New Project"** button

### 1.2 Fill Project Details
```
Organization: [Your organization]
Name: goalgpt-staging
Database Password: [Generate strong password - SAVE THIS!]
Region: Europe (eu-central-1) - SAME AS PRODUCTION
Pricing Plan: Free
```

⏱️ **Wait 2-3 minutes** for project to be created.

### 1.3 Get Database Credentials

When project is ready:

1. Go to **Project Settings** (⚙️ icon, bottom left)
2. Click **Database** tab
3. Scroll to **Connection Info** section
4. Find **Connection pooling** (with "Transaction" mode)

Copy these values:
```
Host: aws-X-eu-central-1.pooler.supabase.com
Database name: postgres
Port: 6543
User: postgres.XXXXXXXXXXXXXXXX
Password: [Your database password]
```

---

## Step 2: Save Staging Credentials

### 2.1 Create `.env.staging` file

```bash
cd /Users/utkubozbay/Downloads/GoalGPT/project
nano .env.staging
```

Paste this and **REPLACE VALUES**:
```bash
# STAGING ENVIRONMENT
# Database Configuration (Supabase Staging)
DB_HOST=aws-X-eu-central-1.pooler.supabase.com  # CHANGE THIS
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.XXXXXXXXXXXXXXXX  # CHANGE THIS
DB_PASSWORD=your_staging_password_here  # CHANGE THIS

# Full Database URL (update with values above)
DATABASE_URL=postgres://postgres.XXXXXXXXXXXXXXXX:your_staging_password_here@aws-X-eu-central-1.pooler.supabase.com:6543/postgres

# Server Configuration
PORT=3000
NODE_ENV=staging

# TheSports API (same as production)
THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=3205e4f6efe04a03f0055152c4aa0f37
THESPORTS_API_USER=goalgpt

# JWT Secret (different from production for safety)
JWT_SECRET=staging_jwt_secret_for_testing_only_2026
JWT_EXPIRES_IN=7d

# API Security
PREDICTION_API_KEY=staging_api_key_for_testing
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# WebSocket
WS_PORT=3001

# Bypass auth for staging
BYPASS_AUTH=true
```

Save file: `Ctrl+O`, `Enter`, `Ctrl+X`

### 2.2 Test Connection

```bash
# Test staging connection
psql "postgres://postgres.XXXXXXXXXXXXXXXX:your_staging_password_here@aws-X-eu-central-1.pooler.supabase.com:6543/postgres" -c "SELECT NOW();"
```

Expected output:
```
              now
-------------------------------
 2026-01-12 15:30:45.123456+00
(1 row)
```

✅ **If you see timestamp, connection works!**

---

## Step 3: Backup Production Database

```bash
cd /Users/utkubozbay/Downloads/GoalGPT/project

# This uses credentials from .env (production)
./scripts/backup-database.sh production
```

**Expected output:**
```
🗄️  GoalGPT Database Backup
================================
Environment: production
...
✅ Backup completed successfully!
File: backups/backup_production_20260112_XXXXXX.dump
Size: ~2.3GB
```

**Verify backup:**
```bash
ls -lh backups/latest_production.dump
```

---

## Step 4: Restore to Staging

### 4.1 Use Staging Credentials

```bash
# Set staging environment variables temporarily
export STAGING_DB_HOST="aws-X-eu-central-1.pooler.supabase.com"  # YOUR VALUE
export STAGING_DB_USER="postgres.XXXXXXXXXXXXXXXX"  # YOUR VALUE
export STAGING_DB_PASSWORD="your_staging_password_here"  # YOUR VALUE
export STAGING_DB_NAME="postgres"
export STAGING_DB_PORT="6543"
```

### 4.2 Restore Backup

```bash
pg_restore \
  -h $STAGING_DB_HOST \
  -p $STAGING_DB_PORT \
  -U $STAGING_DB_USER \
  -d $STAGING_DB_NAME \
  -c \
  -v \
  backups/latest_production.dump
```

**When prompted, enter staging password.**

⏱️ **This will take 10-20 minutes** (2.3GB data)

**Expected output:**
```
pg_restore: creating TABLE "public.customer_users"
pg_restore: creating TABLE "public.ts_matches"
...
pg_restore: processing data for table "public.customer_users"
...
```

### 4.3 Verify Restore

```bash
psql \
  -h $STAGING_DB_HOST \
  -p $STAGING_DB_PORT \
  -U $STAGING_DB_USER \
  -d $STAGING_DB_NAME \
  -c "SELECT COUNT(*) FROM customer_users WHERE deleted_at IS NULL;"
```

**Expected:** ~49,000-50,000 users

---

## Step 5: Anonymize Staging Data

**⚠️ CRITICAL:** This makes staging safe to use (removes real user data)

```bash
psql \
  -h $STAGING_DB_HOST \
  -p $STAGING_DB_PORT \
  -U $STAGING_DB_USER \
  -d $STAGING_DB_NAME \
  -f scripts/setup-staging-data.sql
```

**Expected output:**
```
🔐 Anonymizing customer_users...
✅ Anonymized XXXX users
💳 Removing payment data from subscriptions...
✅ Cleaned XXXX subscription records
...
✅ STAGING DATA SETUP COMPLETE
Total Users: 1000
```

**Verify anonymization:**
```bash
psql \
  -h $STAGING_DB_HOST \
  -p $STAGING_DB_PORT \
  -U $STAGING_DB_USER \
  -d $STAGING_DB_NAME \
  -c "SELECT email, is_staging FROM customer_users LIMIT 5;"
```

**Expected:**
```
            email            | is_staging
-----------------------------+------------
 test_user_123@goalgpt-staging.com | t
 test_user_456@goalgpt-staging.com | t
```

✅ **All emails anonymized, is_staging = true**

---

## Step 6: Update Scripts to Use Staging

### 6.1 Modify `run-migration.sh`

```bash
nano scripts/run-migration.sh
```

Find line ~18:
```bash
# Load environment
if [ -f .env ]; then
```

Change to:
```bash
# Load environment
if [ "$ENVIRONMENT" == "staging" ] && [ -f .env.staging ]; then
    export $(grep -v '^#' .env.staging | xargs)
elif [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 7: Run Migration on Staging

```bash
cd /Users/utkubozbay/Downloads/GoalGPT/project

# Now this will use .env.staging
./scripts/run-migration.sh staging
```

**Expected flow:**
```
🚀 GoalGPT Migration Runner
================================
Environment: staging
...

📋 Migration Plan:
  1. Schema migration (001-mobile-app-schema.ts)
  2. Data migration (002-mobile-app-data.ts)
  3. Verification (verify-migration.ts)

▶️  Start migration? (yes/no): yes

🔄 Starting migration...
================================

📦 Step 1: Running schema migration...
✅ customer_oauth_identities created
✅ customer_xp created
✅ customer_credits created
... (17 tables total)
✅ Schema migration completed successfully!

📦 Step 2: Running data migration...
✅ Created 1000 XP records
✅ Created 1000 Credit records
✅ Granted welcome bonus to XX VIP users
✅ Inserted 5 default badges
✅ Data migration completed in X.XXs

📦 Step 3: Verifying migration...
✅ All users have XP records
✅ All users have Credit records
✅ All VIP users received welcome bonus
✅ 5 badges created
✅ All users have referral codes
✅ No orphaned records found
✅ All 17 tables exist
✅ All altered columns exist
✅ Migration verification PASSED!

================================
✅ Migration completed successfully!
```

---

## Step 8: Manual Verification (Optional)

```bash
# Connect to staging
psql \
  -h $STAGING_DB_HOST \
  -p $STAGING_DB_PORT \
  -U $STAGING_DB_USER \
  -d $STAGING_DB_NAME

# Check tables
\dt customer_*

# Check sample data
SELECT
  cu.email,
  cu.referral_code,
  cxp.xp_points,
  cxp.level,
  cc.balance
FROM customer_users cu
LEFT JOIN customer_xp cxp ON cxp.customer_user_id = cu.id
LEFT JOIN customer_credits cc ON cc.customer_user_id = cu.id
LIMIT 5;

# Exit
\q
```

---

## Step 9: Test Rollback (Optional but Recommended)

```bash
# Test rollback
npx ts-node src/database/migrations/002-mobile-app-data.ts down
npx ts-node src/database/migrations/001-mobile-app-schema.ts down

# Verify tables dropped
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "\dt customer_xp"
# Should say: "Did not find any relation"

# Re-run migration
./scripts/run-migration.sh staging

# Should work again without errors
```

---

## Troubleshooting

### Issue: "connection refused"
**Solution:** Check Supabase project is active (not paused), verify credentials

### Issue: "permission denied"
**Solution:** Make sure using connection pooler credentials (port 6543), not direct connection (port 5432)

### Issue: "pg_restore: error: could not execute query: ERROR:  must be owner"
**Solution:** Add `-c` flag to pg_restore (already in script above)

### Issue: Restore takes too long (>30 min)
**Solution:** Normal for 2.3GB. Check network speed, or use smaller dataset (restore only last month's data)

---

## Success Checklist

- [ ] Staging project created on Supabase
- [ ] `.env.staging` file created with correct credentials
- [ ] Connection tested successfully
- [ ] Production backup created
- [ ] Backup restored to staging
- [ ] Data anonymized (emails like test_user_*)
- [ ] Migration ran successfully
- [ ] Verification passed (all checks ✅)
- [ ] Sample queries return expected data
- [ ] Rollback tested (optional)

---

## Next Steps

✅ **Staging ready!**

**Now you can:**
1. Run migration on production with confidence
2. Test backend API endpoints (Phase 2)
3. Test mobile app with staging backend

**To run on production:**
```bash
# Make sure to backup first!
./scripts/backup-database.sh production

# Then migrate
./scripts/run-migration.sh production
```

---

## Quick Reference

### Switch between environments

**Use staging:**
```bash
cp .env.staging .env
```

**Use production:**
```bash
cp .env.production .env  # (if you saved original as .env.production)
```

**Or use environment variable:**
```bash
# Staging
NODE_ENV=staging DATABASE_URL="postgres://staging..." npm start

# Production
NODE_ENV=production DATABASE_URL="postgres://production..." npm start
```

---

**Questions? Check `/docs/PHASE-1-MIGRATION-GUIDE.md` for detailed troubleshooting.**
