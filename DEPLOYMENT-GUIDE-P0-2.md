# PR-P0-2: Deployment Guide

**Branch**: `fix/pool-p0-2-indexes`
**Status**: Ready for Deployment
**Risk**: Very Low (Zero-downtime deployment)

---

## Quick Overview

This PR adds 3 critical database indexes to resolve pool exhaustion issues by reducing query execution times by 40-60%.

**IMPORTANT**: Does NOT duplicate phase8 indexes
- phase8 already has `idx_matches_live_status` (composite)
- This PR adds COVERING index (more efficient with INCLUDE clause)

**What's included**:
- 1 covering index for live matches endpoint (Priority 1 - CRITICAL)
- 1 index for daily lists settlement job (Priority 2)
- 1 index for subscription dashboard (Priority 3)

**Deployment method**: `CREATE INDEX CONCURRENTLY` (zero-downtime)

---

## Pre-Deployment Checklist

- [ ] Current branch pushed: `fix/pool-p0-2-indexes`
- [ ] Migration file exists: `src/database/migrations/add-pool-optimization-indexes.ts`
- [ ] Verification script exists: `scripts/verify-indexes-p0-2.sql`
- [ ] Database connection available
- [ ] Backup recent (optional - indexes can be dropped easily)

---

## Deployment Steps

### Step 1: Pull Latest Code

```bash
# SSH to VPS
ssh root@142.93.103.128

# Navigate to project
cd /var/www/goalgpt

# Fetch and checkout branch
git fetch origin
git checkout fix/pool-p0-2-indexes
git pull origin fix/pool-p0-2-indexes
```

### Step 2: Run Migration

```bash
# Execute migration (CONCURRENTLY = safe on live database)
npx tsx src/database/migrations/add-pool-optimization-indexes.ts
```

**Expected output**:
```
[info]: [Migration:P0-2] Creating performance indexes (CONCURRENTLY)...
[info]: [Migration:P0-2] Note: Skipping composite index (phase8 already has idx_matches_live_status)
[info]: [Migration:P0-2] Creating idx_ts_matches_live_covering...
[info]: [Migration:P0-2] ✓ idx_ts_matches_live_covering created
[info]: [Migration:P0-2] Creating idx_telegram_daily_lists_settlement_enhanced...
[info]: [Migration:P0-2] ✓ idx_telegram_daily_lists_settlement_enhanced created
[info]: [Migration:P0-2] Creating idx_customer_subscriptions_dashboard...
[info]: [Migration:P0-2] ✓ idx_customer_subscriptions_dashboard created
[info]: [Migration:P0-2] All 3 indexes created successfully
[info]: [Migration:P0-2] Expected impact: 40-60% query speedup on hot paths
[info]: [Migration:P0-2] Migration completed successfully
```

**Duration**: 1-3 minutes (depends on table size)

### Step 3: Verify Indexes Created

```bash
# Verify all indexes exist
psql $DATABASE_URL -f scripts/verify-indexes-p0-2.sql
```

**Expected output**: Should show all 3 indexes with their sizes and query plans using "Index Scan" or "Index-Only Scan"

### Step 4: Test API Performance (Optional)

```bash
# Test live matches endpoint
time curl -s https://partnergoalgpt.com/api/matches/live > /dev/null

# Should complete in 1-2 seconds (previously 15+ seconds)
```

### Step 5: Monitor Logs

```bash
# Watch application logs for any errors
pm2 logs goalgpt-backend --lines 100
```

**What to look for**:
- No database connection errors
- No slow query warnings
- Normal application behavior

---

## Verification Checklist

After deployment, verify:

- [ ] All 3 indexes created successfully
- [ ] No errors in migration logs
- [ ] No errors in application logs
- [ ] `/api/matches/live` responds in <2 seconds
- [ ] No increase in database CPU/memory usage
- [ ] No pool exhaustion errors
- [ ] Application remains responsive
- [ ] No duplicate indexes with phase8

---

## Quick Verification Commands

```bash
# Check index existence (3 new indexes)
psql $DATABASE_URL -c "
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE indexname IN (
  'idx_ts_matches_live_covering',
  'idx_telegram_daily_lists_settlement_enhanced',
  'idx_customer_subscriptions_dashboard'
);
"

# Check index usage (including phase8 for comparison)
psql $DATABASE_URL -c "
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE indexname IN (
  'idx_ts_matches_live_covering',
  'idx_telegram_daily_lists_settlement_enhanced',
  'idx_customer_subscriptions_dashboard',
  'idx_matches_live_status'
)
ORDER BY indexname;
"

# Test query plan for live matches
psql $DATABASE_URL -c "
EXPLAIN ANALYZE
SELECT * FROM ts_matches
WHERE status_id IN (2,3,4,5,7)
ORDER BY match_time DESC
LIMIT 50;
"
```

---

## Rollback Plan (If Needed)

If any issues arise, rollback is simple:

```bash
# SSH to VPS
ssh root@142.93.103.128
cd /var/www/goalgpt

# Connect to database
psql $DATABASE_URL

# Drop indexes (CONCURRENTLY for safety)
DROP INDEX CONCURRENTLY IF EXISTS idx_ts_matches_live_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_telegram_daily_lists_settlement_enhanced;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_subscriptions_dashboard;

# Exit psql
\q

# Switch back to main branch
git checkout main
```

**Recovery Time**: <5 minutes
**Impact**: Live matches queries use phase8's idx_matches_live_status (slower but functional)
**Note**: phase8 indexes remain untouched

---

## Monitoring Post-Deployment

### 1. Query Performance (First 24 Hours)

```bash
# Monitor slow queries
tail -f logs/pm2-out.log | grep -i "slow\|query"

# Test live matches endpoint periodically
watch -n 60 'curl -w "\nTime: %{time_total}s\n" -o /dev/null -s https://partnergoalgpt.com/api/matches/live'
```

### 2. Index Usage Statistics

```sql
-- Run every 6 hours for first 24 hours
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname IN (
  'idx_ts_matches_live_composite',
  'idx_ts_matches_live_covering',
  'idx_telegram_daily_lists_settlement_enhanced',
  'idx_customer_subscriptions_dashboard'
)
ORDER BY idx_scan DESC;
```

### 3. Database Metrics

```bash
# Check database size (should not increase significantly)
psql $DATABASE_URL -c "
SELECT pg_size_pretty(pg_database_size(current_database()));
"

# Check connection pool status (after PR-P0-3)
# Will show improved metrics once monitoring is enhanced
```

---

## Expected Results

### Before Deployment
- `/api/matches/live`: 15+ seconds
- Daily lists settlement: 6-7 seconds
- Dashboard queries: 8-16 seconds total
- Frequent pool exhaustion errors

### After Deployment
- `/api/matches/live`: 1-2 seconds (85-90% improvement)
- Daily lists settlement: 2-3 seconds (50-60% improvement)
- Dashboard queries: 4-8 seconds total (50% improvement)
- Reduced pool exhaustion frequency

---

## Troubleshooting

### Issue: Migration fails with "already exists" error

**Cause**: Indexes already created (idempotent migration)
**Solution**: This is safe - migration will skip existing indexes
**Action**: None required

### Issue: Migration hangs or times out

**Cause**: Database under heavy load
**Solution**:
1. Wait for load to decrease
2. Retry migration
3. Check for long-running queries blocking index creation

**Command to check**:
```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '1 minute';
```

### Issue: Query still uses Seq Scan instead of Index Scan

**Cause**: Query planner may need statistics update
**Solution**:
```sql
ANALYZE ts_matches;
ANALYZE telegram_daily_lists;
ANALYZE customer_subscriptions;
```

### Issue: Application errors after deployment

**Cause**: Unlikely (indexes don't change data)
**Solution**:
1. Check logs for specific error
2. Verify database connection
3. Rollback indexes if needed (see Rollback Plan)

---

## Success Criteria

✅ Deployment successful if:
- All 3 indexes created without errors
- Query plans show "Index Scan" or "Index-Only Scan" instead of "Seq Scan"
- API response times improved by 40-60%
- No new errors in logs
- Application remains stable for 24 hours
- No duplicate indexes with phase8 (verified via pg_indexes)

---

## Next Steps After Successful Deployment

1. **Monitor for 24 hours** - Track query performance and index usage
2. **Update MASTER-APP-GOALGPT-PLAN.md** - Mark PR-P0-2 as completed
3. **Proceed to PR-P0-3** - Implement pool monitoring enhancements
4. **Document results** - Record actual performance improvements

---

## Contact Information

**Deployment Team**: DevOps
**Development Team**: Backend Team
**Database Team**: Database Administrators

**Questions?** Review full documentation:
- PR Description: `PR-P0-2-DESCRIPTION.md`
- Migration Code: `src/database/migrations/add-pool-optimization-indexes.ts`
- Verification Script: `scripts/verify-indexes-p0-2.sql`

---

**Last Updated**: 2026-02-01
**Status**: Ready for Production Deployment
