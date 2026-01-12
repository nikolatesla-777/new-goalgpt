# Phase 1: Database Migration Execution Guide

> **Status:** ✅ Scripts Ready - Awaiting Staging Test
> **Duration:** 5-7 days
> **Risk Level:** 🔴 HIGH - affects 50K+ users
> **Last Updated:** 2026-01-12

---

## Quick Reference

### Created Files

#### Migration Scripts
- `/src/database/migrations/001-mobile-app-schema.ts` - Creates 17 tables, alters 3
- `/src/database/migrations/002-mobile-app-data.ts` - Initializes user data
- `/scripts/verify-migration.ts` - 9 verification checks
- `/scripts/run-migration.sh` - Automated runner with safety checks

#### What Gets Created

**17 New Tables:**
1. customer_oauth_identities (OAuth provider linking)
2. customer_xp (XP & leveling)
3. customer_xp_transactions (XP history)
4. badges (Badge definitions)
5. customer_badges (User badge unlocks)
6. customer_credits (Virtual currency)
7. customer_credit_transactions (Credit history)
8. customer_ad_views (Rewarded ad tracking)
9. referrals (Referral program)
10. partners (Partner/Bayi program)
11. partner_analytics (Partner stats)
12. match_comments (Match forum)
13. match_comment_likes (Comment likes)
14. customer_daily_rewards (Daily gift tracking)
15. blog_posts (Blog CMS)
16. notification_templates (Push templates)
17. scheduled_notifications (Scheduled push)

**3 Table Alterations:**
- `customer_users` → +google_id, +apple_id, +username, +referral_code
- `customer_subscriptions` → +partner_id, +referral_code, +referral_source
- `ts_prediction_mapped` → +credit_cost, +purchased_by_user_id, +purchased_at

**Data Initialization:**
- XP records for all users (default: 0 points, bronze level)
- Credit records for all users (default: 0 balance)
- VIP welcome bonus (50 credits per VIP user)
- 5 default badges (first_referral, prediction_master, streak_7, first_comment, vip_founder)
- Referral codes (GOAL-XXXXXX format)
- 3 notification templates

---

## Staging Execution (First Time)

### Prerequisites
- [ ] Phase 0 completed
- [ ] Staging database restored from production
- [ ] Data anonymized (`setup-staging-data.sql`)
- [ ] Backend dependencies installed: `npm install`

### Step 1: Run Migration
```bash
cd /Users/utkubozbay/Downloads/GoalGPT/project
./scripts/run-migration.sh staging
```

**Expected Output:**
```
🚀 GoalGPT Migration Runner
================================
Environment: staging
...

📦 Step 1: Running schema migration...
✅ customer_oauth_identities created
✅ customer_xp created
... (15 more tables)
✅ Schema migration completed successfully!

📦 Step 2: Running data migration...
✅ Created XXXX XP records
✅ Created XXXX Credit records
✅ Granted welcome bonus to XX VIP users
✅ Inserted 5 default badges
...

📦 Step 3: Verifying migration...
✅ All users have XP records
✅ All users have Credit records
...
✅ Migration verification PASSED!
```

### Step 2: Manual Verification

```bash
# Connect to staging database
psql -h $STAGING_DB_HOST -U $DB_USER -d $DB_NAME

# Check table counts
SELECT COUNT(*) FROM customer_xp;
SELECT COUNT(*) FROM customer_credits;
SELECT COUNT(*) FROM badges;

# Check VIP bonuses
SELECT COUNT(*) FROM customer_credit_transactions
WHERE transaction_type = 'promotional' AND metadata->>'migration' = 'true';

# Check a sample user
SELECT
  cu.id,
  cu.email,
  cu.referral_code,
  cxp.xp_points,
  cxp.level,
  cc.balance
FROM customer_users cu
LEFT JOIN customer_xp cxp ON cxp.customer_user_id = cu.id
LEFT JOIN customer_credits cc ON cc.customer_user_id = cu.id
LIMIT 5;
```

### Step 3: Test Rollback

```bash
# Test the down migration (rollback)
npx ts-node src/database/migrations/002-mobile-app-data.ts down
npx ts-node src/database/migrations/001-mobile-app-schema.ts down

# Verify tables dropped
psql -h $STAGING_DB_HOST -U $DB_USER -d $DB_NAME -c "\dt customer_xp"
# Should return: "Did not find any relation named customer_xp"

# Re-run migration to confirm idempotency
./scripts/run-migration.sh staging
```

### Step 4: Performance Testing

```bash
# Test query performance
psql -h $STAGING_DB_HOST -U $DB_USER -d $DB_NAME

-- Leaderboard query (should use idx_xp_leaderboard)
EXPLAIN ANALYZE
SELECT cu.name, cxp.xp_points, cxp.level
FROM customer_xp cxp
INNER JOIN customer_users cu ON cu.id = cxp.customer_user_id
ORDER BY cxp.xp_points DESC
LIMIT 100;

-- User lookup (should use unique index)
EXPLAIN ANALYZE
SELECT * FROM customer_xp WHERE customer_user_id = '<some-uuid>';
```

**Expected:** All queries should use indexes, execution time < 100ms

---

## Production Execution

### Pre-Migration Checklist (1 Day Before)

- [ ] Staging migration successful
- [ ] All verification checks passed
- [ ] Rollback tested successfully
- [ ] Team notified
- [ ] Maintenance window scheduled (suggested: Saturday 6:00 AM)
- [ ] User announcement prepared

### Migration Day (Low Traffic Window)

#### 1. Final Backup
```bash
# CRITICAL: Take fresh production backup
./scripts/backup-database.sh production

# Verify backup
ls -lh backups/latest_production.dump
pg_restore --list backups/latest_production.dump | head -20
```

#### 2. Announce Maintenance
```
Subject: [GoalGPT] Scheduled Maintenance - 1 Hour
Duration: 6:00 AM - 7:00 AM
Impact: App may be unavailable briefly
Reason: System improvements and new features
```

#### 3. Run Migration
```bash
# SSH to production VPS
ssh root@142.93.103.128
cd /var/www/goalgpt

# Pull migration code
git pull origin main
npm install
npm run build

# Run migration
./scripts/run-migration.sh production
# Type 'YES' to confirm
```

#### 4. Verify & Monitor
```bash
# Verify migration
npx ts-node scripts/verify-migration.ts

# Restart backend
pm2 restart all

# Check health
curl https://api.goalgpt.com/health

# Monitor logs
pm2 logs --lines 100

# Monitor for 30 minutes
# - Error rate < 0.5%
# - No authentication failures
# - Database queries performant
```

#### 5. Smoke Tests
```bash
# Test authentication endpoints (when Phase 2 ready)
curl -X POST https://api.goalgpt.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "..."}'

# Check database directly
psql -h $PROD_DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT
    (SELECT COUNT(*) FROM customer_users WHERE deleted_at IS NULL) as users,
    (SELECT COUNT(*) FROM customer_xp) as xp_records,
    (SELECT COUNT(*) FROM customer_credits) as credit_records,
    (SELECT COUNT(*) FROM badges) as badges
"
```

---

## Rollback Procedure

### When to Rollback

Rollback immediately if:
- Error rate > 2%
- Database query timeouts
- Authentication failures > 5%
- Foreign key constraint violations
- Data integrity issues

### Rollback Steps

```bash
# 1. Stop backend
pm2 stop all

# 2. Restore from backup
pg_restore \
  -h $PROD_DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -c \
  backups/latest_production.dump

# 3. Restart backend (old code)
git checkout <previous-commit>
npm install
npm run build
pm2 restart all

# 4. Verify
curl https://api.goalgpt.com/health
```

**Rollback Time:** ~15-20 minutes

---

## Troubleshooting

### Issue: Migration fails at table creation

**Cause:** Table already exists from previous attempt

**Solution:**
```bash
# Drop specific table and retry
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "DROP TABLE IF EXISTS customer_xp CASCADE;"
./scripts/run-migration.sh staging
```

### Issue: Foreign key constraint error

**Cause:** customer_users table missing or corrupted

**Solution:**
```bash
# Check customer_users exists
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d customer_users"

# Verify no orphaned records
SELECT COUNT(*) FROM customer_users WHERE deleted_at IS NULL;
```

### Issue: Verification fails - "Users without XP"

**Cause:** Data migration (002) didn't run or partially failed

**Solution:**
```bash
# Re-run data migration only
npx ts-node src/database/migrations/002-mobile-app-data.ts
npx ts-node scripts/verify-migration.ts
```

### Issue: Performance degradation after migration

**Cause:** Indexes not created or need VACUUM ANALYZE

**Solution:**
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

-- Rebuild indexes
REINDEX TABLE customer_xp;
REINDEX TABLE customer_credits;

-- Update statistics
VACUUM ANALYZE customer_xp;
VACUUM ANALYZE customer_credits;
```

---

## Post-Migration

### Immediate (First 2 Hours)

- [ ] Monitor error logs: `pm2 logs`
- [ ] Monitor database CPU/memory
- [ ] Check API response times
- [ ] Test user authentication (when Phase 2 ready)
- [ ] Verify no duplicate XP/credit records

### First 24 Hours

- [ ] Monitor user feedback channels
- [ ] Check crash reports (Sentry when configured)
- [ ] Verify backup restored correctly
- [ ] Document any issues encountered
- [ ] Update team on success

### First Week

- [ ] Analyze query performance
- [ ] Optimize slow queries if any
- [ ] Plan Phase 2 (Backend API development)
- [ ] Remove old migration artifacts if stable

---

## Success Criteria

✅ **All completed when:**
- Migration runs without errors
- Verification script passes all 9 checks
- Zero data loss (50,016 users preserved)
- All VIP users have bonus credits
- Referral codes generated for all users
- Backend restarts successfully
- No error rate increase
- Ready to begin Phase 2

---

**Next Phase:** Phase 2 - Backend API (Auth & Core)

**Estimated Start:** After successful production migration + 1-2 days stabilization
