# STAGING TEST PLAN - POST-P1 TECHNICAL DEBT

**Date**: 2026-02-02
**Environment**: Staging (staging.goalgpt.com)
**PRs to Test**: P1A, P1B, P1C
**Estimated Time**: 4-6 hours

---

## 🎯 OBJECTIVES

1. Verify all 3 PRs work correctly in staging
2. Validate performance improvements
3. Test rollback procedures
4. Identify any issues before production
5. Generate confidence for production deployment

---

## 📋 PRE-TEST CHECKLIST

### Environment Setup
- [ ] Staging environment accessible
- [ ] Database connection working
- [ ] Redis available (for future P1D testing)
- [ ] Monitoring tools ready (logs, pool stats)
- [ ] Backup of staging database taken

### Access Required
```bash
# SSH access
ssh root@staging.goalgpt.com

# Database access
psql $DATABASE_URL

# Monitoring
curl http://staging.goalgpt.com/health
curl http://staging.goalgpt.com/health/pool
```

### Test Data Requirements
- [ ] At least 100 active users
- [ ] At least 10 active badges
- [ ] At least 20 live matches
- [ ] At least 50 scheduled notifications

---

## 🧪 TEST SUITE 1: PR-P1A (MIGRATION SAFETY)

**Status**: ✅ Already deployed to main
**Time**: 30 minutes

### Test 1.1: Verify CONCURRENTLY Indexes

**Objective**: Confirm all indexes were created with CONCURRENTLY

```bash
# SSH to staging
ssh root@staging.goalgpt.com

# Connect to database
psql $DATABASE_URL

# Run verification query
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND indexdef LIKE '%CONCURRENTLY%'
ORDER BY tablename, indexname;
```

**Expected Result**:
- Should show 20+ indexes created by pr-p1a-add-concurrent-indexes.ts
- All should have CONCURRENTLY in indexdef

### Test 1.2: Verify FK Indexes

```sql
-- Check FK indexes exist
SELECT
  indexname,
  tablename
FROM pg_indexes
WHERE indexname IN (
  'idx_customer_oauth_identities_customer_user_id',
  'idx_customer_subscriptions_customer_user_id',
  'idx_customer_daily_rewards_customer_user_id'
)
ORDER BY indexname;
```

**Expected Result**:
- All 3 FK indexes should exist
- Used for cascade delete performance

### Test 1.3: CI Validation Script

```bash
# Exit psql, back to staging shell
cd /var/www/goalgpt

# Run migration validator
npm run validate:migrations
```

**Expected Result**:
```
🔍 Validating migration files for production safety...

Found 50+ migration files to validate

⏭️  Skipping legacy file: 001-mobile-app-schema.ts
⏭️  Skipping legacy file: phase8-performance-indexes.ts

✅ All migration files are production-safe!
All CREATE INDEX statements use CONCURRENTLY.
```

### Test 1.4: Test Migration Safety (No Locks)

```bash
# Create a test migration to verify no locks
cd /var/www/goalgpt

# Check for locks during index creation
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE granted = false;"
```

**Expected Result**:
- 0 rows (no locks)

**✅ PR-P1A Test Complete**: All indexes use CONCURRENTLY, CI validation works

---

## 🧪 TEST SUITE 2: PR-P1B (N+1 QUERY ELIMINATION)

**Branch**: `feat/pr-p1b-n+1-elimination`
**Time**: 2-3 hours

### Setup

```bash
cd /var/www/goalgpt

# Backup current code
git branch backup-before-p1b-test

# Checkout PR-P1B branch
git fetch origin
git checkout feat/pr-p1b-n+1-elimination

# Install dependencies
npm install

# Restart services
pm2 restart goalgpt-api
```

### Test 2.1: Daily Reward Reminders (10,001 → 2 queries)

**Enable Feature Flag**:
```bash
export USE_OPTIMIZED_DAILY_REWARDS=true
pm2 restart goalgpt-api
```

**Run Job Manually**:
```bash
# Enable query logging
export LOG_QUERIES=true

# Run job
npm run job:dailyRewardReminders

# Or if no npm script exists, run directly:
npx tsx -e "
import { runDailyRewardReminders } from './src/jobs/dailyRewardReminders.job';
runDailyRewardReminders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
"
```

**Check Logs**:
```bash
# Check for optimized indicator
tail -f logs/combined.log | grep "Daily Reward"

# Expected output:
# ✅ Optimized: Sent 25 reminders (2 queries total)
# Daily Reward Reminders: Sent 25 reminder(s) in 3500ms
```

**Verify Query Count**:
```bash
# Count queries in logs (if LOG_QUERIES=true)
grep "SELECT.*customer_daily_rewards" logs/combined.log | wc -l

# Expected: 1 query (window function query)
# Before: 10,001 queries (1 per user + 1 initial)
```

**Performance Verification**:
```bash
# Check execution time in job logs
grep "duration_ms" logs/combined.log | grep "Daily Reward" | tail -1

# Expected: <5000ms (5 seconds)
# Before: 45000ms (45 seconds)
```

**✅ Test 2.1 Pass Criteria**:
- [ ] Logs show "✅ Optimized: Sent N reminders (2 queries total)"
- [ ] Execution time <5 seconds
- [ ] All users received notifications
- [ ] No errors in logs

### Test 2.2: Badge Auto-Unlock (100K+ → ~10 queries)

**Enable Feature Flag**:
```bash
export USE_OPTIMIZED_BADGE_UNLOCK=true
pm2 restart goalgpt-api
```

**Run Job Manually**:
```bash
# Run badge auto-unlock job
npm run job:badgeAutoUnlock

# Or directly:
npx tsx -e "
import { runBadgeAutoUnlock } from './src/jobs/badgeAutoUnlock.job';
runBadgeAutoUnlock().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
"
```

**Check Logs**:
```bash
tail -f logs/combined.log | grep "Badge Auto-Unlock"

# Expected output:
# ✅ Batch unlocked: referral_master for 15 users (~1 queries)
# Badge Auto-Unlock: Processed 5 badges, unlocked 32 new badges in 8500ms
```

**Performance Verification**:
```bash
# Check execution time
grep "Badge Auto-Unlock" logs/combined.log | grep "duration_ms" | tail -1

# Expected: <10000ms (10 seconds)
# Before: 120000ms (120 seconds)
```

**✅ Test 2.2 Pass Criteria**:
- [ ] Logs show "✅ Batch unlocked" messages
- [ ] Execution time <10 seconds
- [ ] Badges correctly unlocked in database
- [ ] No duplicate badge unlocks (ON CONFLICT works)

### Test 2.3: Scheduled Notifications (SELECT * → SELECT specific)

**Enable Feature Flag**:
```bash
export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=true
pm2 restart goalgpt-api
```

**Create Test Notification**:
```sql
-- Insert test notification
INSERT INTO scheduled_notifications (
  id,
  title_tr,
  body_tr,
  target_audience,
  scheduled_at,
  status,
  created_at
) VALUES (
  gen_random_uuid(),
  'Test Notification',
  'This is a test notification from staging',
  'all',
  NOW() - INTERVAL '1 minute',
  'pending',
  NOW()
);
```

**Run Job**:
```bash
npm run job:scheduledNotifications
```

**Check Logs**:
```bash
tail -f logs/combined.log | grep "Scheduled Notifications"

# Expected output:
# Found 1 notification(s) to send
# Notification sent: <uuid> (250/250 delivered)
# Scheduled Notifications: Processed 1 notification(s) in 1200ms
```

**Verify Memory Usage**:
```bash
# Check memory usage during job
ps aux | grep node | grep goalgpt-api

# Expected: Memory should not spike significantly
# Before: SELECT * loaded all columns including large JSONB
# After: Only 7 specific columns loaded
```

**✅ Test 2.3 Pass Criteria**:
- [ ] Notification sent successfully
- [ ] Memory usage stable
- [ ] Only needed columns fetched
- [ ] No errors in logs

### Test 2.4: Rollback Test (Feature Flag Disable)

**Objective**: Verify rollback works in 30 seconds

```bash
# Disable all optimizations
export USE_OPTIMIZED_DAILY_REWARDS=false
export USE_OPTIMIZED_BADGE_UNLOCK=false
export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=false

# Restart
pm2 restart goalgpt-api

# Run daily rewards again
npm run job:dailyRewardReminders

# Check logs
tail -f logs/combined.log | grep "Daily Reward"

# Expected output:
# ❌ Legacy: Sent 25 reminders (26 queries)
```

**Verify Legacy Path**:
```bash
# Should see legacy warning
grep "❌ Legacy:" logs/combined.log | tail -5
```

**Re-enable Optimizations**:
```bash
export USE_OPTIMIZED_DAILY_REWARDS=true
export USE_OPTIMIZED_BADGE_UNLOCK=true
export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=true
pm2 restart goalgpt-api
```

**✅ Test 2.4 Pass Criteria**:
- [ ] Rollback completed in <30 seconds
- [ ] Legacy path executed correctly
- [ ] Re-enabling optimizations works
- [ ] No data corruption during rollback

**✅ PR-P1B Test Complete**: All jobs optimized, feature flags work, rollback tested

---

## 🧪 TEST SUITE 3: PR-P1C (CONCURRENCY CONTROL)

**Branch**: `feat/pr-p1c-concurrency-control`
**Time**: 2-3 hours

### Setup

```bash
cd /var/www/goalgpt

# Backup current code
git branch backup-before-p1c-test

# Checkout PR-P1C branch
git fetch origin
git checkout feat/pr-p1c-concurrency-control

# Install dependencies
npm install

# Restart with conservative limits
export MATCH_ENRICHER_CONCURRENCY=50
export MATCH_WATCHDOG_CONCURRENCY=15
pm2 restart goalgpt-api
```

### Test 3.1: Monitor Pool Stats (Baseline)

**Objective**: Establish baseline before testing

```bash
# Watch pool stats in real-time
watch -n 5 'curl -s http://staging.goalgpt.com/health/pool | jq'
```

**Expected Baseline**:
```json
{
  "total": 20,
  "active": 8,
  "idle": 12,
  "waiting": 0,
  "utilization": "40%"
}
```

**Record Baseline**: Active connections should be <50% of total

### Test 3.2: Match Enricher Service (Fire-and-Forget Fixed)

**Trigger Match Enrichment**:
```bash
# Make API call that triggers match enrichment
curl http://staging.goalgpt.com/api/matches/live | jq '.matches | length'

# Check logs for bounded concurrency
tail -f logs/combined.log | grep "✅ Fetched"

# Expected output:
# ✅ Fetched home team 123: Manchester United
# ✅ Fetched away team 456: Liverpool FC
# ✅ Fetched logo for home team: 789
```

**Verify No Fire-and-Forget**:
```bash
# Check for error tracking
grep "Failed to fetch" logs/combined.log | tail -10

# Should see errors properly logged, not silently swallowed
```

**Monitor Pool During Enrichment**:
```bash
# Pool should not spike above limit
watch -n 2 'curl -s http://staging.goalgpt.com/health/pool | jq .active'

# Expected: active ≤ 50 (MATCH_ENRICHER_CONCURRENCY limit)
```

**✅ Test 3.2 Pass Criteria**:
- [ ] Logs show "✅ Fetched" indicators
- [ ] Errors properly logged (not silently swallowed)
- [ ] Pool active connections ≤ configured limit
- [ ] No promise leaks (check heap size)

### Test 3.3: Match Watchdog Job (Unbounded Promise.all Fixed)

**Wait for Watchdog to Run**:
```bash
# Watchdog runs every 30 seconds
# Wait and watch logs
tail -f logs/combined.log | grep "Watchdog"

# Expected output:
# [Watchdog] Global Sweep: Processing 45 active live matches.
# (no unbounded Promise.all messages)
```

**Monitor Pool During Watchdog**:
```bash
# Pool should stay bounded during sweep
watch -n 1 'curl -s http://staging.goalgpt.com/health/pool | jq'

# Expected: active ≤ 15 (MATCH_WATCHDOG_CONCURRENCY limit)
# Before: Could spike to 90+ during large sweeps
```

**Check Concurrency Limit Enforcement**:
```bash
# Enable debug logging to see concurrency info
export LOG_LEVEL=debug
pm2 restart goalgpt-api

# Watch for concurrent operation messages
tail -f logs/combined.log | grep -i "concurrent"
```

**✅ Test 3.3 Pass Criteria**:
- [ ] Watchdog processes all live matches
- [ ] Pool active connections ≤ 15
- [ ] No pool exhaustion events
- [ ] All matches reconciled correctly

### Test 3.4: Load Test (Stress Test)

**Objective**: Verify pool stays bounded under load

**Create Load**:
```bash
# Make 50 concurrent API requests
for i in {1..50}; do
  curl -s http://staging.goalgpt.com/api/matches/live > /dev/null &
done

# Monitor pool during load
watch -n 1 'curl -s http://staging.goalgpt.com/health/pool | jq'
```

**Expected Behavior**:
```json
{
  "total": 20,
  "active": 12,  // Should stay <50% even under load
  "idle": 8,
  "waiting": 0,
  "utilization": "60%"
}
```

**Before P1C**: Active would spike to 18-19 (90%+)
**After P1C**: Active stays <50% due to bounded concurrency

**Check for Pool Exhaustion**:
```bash
# Check logs for pool exhaustion errors
grep -i "pool exhausted\|timeout acquiring" logs/combined.log | tail -10

# Expected: 0 results (no pool exhaustion)
```

**✅ Test 3.4 Pass Criteria**:
- [ ] Pool utilization stays <60% under load
- [ ] No pool exhaustion errors
- [ ] All requests processed successfully
- [ ] Response times reasonable

### Test 3.5: Optimize Concurrency Limits

**Reduce Limits (Test Lower Concurrency)**:
```bash
# Reduce to recommended levels
export MATCH_ENRICHER_CONCURRENCY=10
export MATCH_WATCHDOG_CONCURRENCY=5
pm2 restart goalgpt-api

# Monitor for 15 minutes
watch -n 5 'curl -s http://staging.goalgpt.com/health/pool | jq'
```

**Expected Behavior**:
```json
{
  "active": 5,  // Even lower utilization
  "idle": 15,
  "waiting": 0,
  "utilization": "25%"
}
```

**Verify No Performance Degradation**:
```bash
# Watchdog should still process quickly
tail -f logs/combined.log | grep "Watchdog.*completed"

# Match enrichment should still work
curl http://staging.goalgpt.com/api/matches/live | jq '.matches[0].home_team'
```

**✅ Test 3.5 Pass Criteria**:
- [ ] Pool utilization <30% with optimized limits
- [ ] No performance degradation
- [ ] All jobs complete successfully
- [ ] Response times unchanged

### Test 3.6: Rollback Test (Disable Concurrency Limits)

**Objective**: Verify rollback to unbounded

```bash
# Set limits to 999 (effectively unbounded)
export MATCH_ENRICHER_CONCURRENCY=999
export MATCH_WATCHDOG_CONCURRENCY=999
pm2 restart goalgpt-api

# Monitor pool (should behave like before)
watch -n 5 'curl -s http://staging.goalgpt.com/health/pool | jq'
```

**Expected Behavior**:
- Pool utilization may increase (no longer bounded)
- System still works, just less optimized

**Re-enable Optimizations**:
```bash
export MATCH_ENRICHER_CONCURRENCY=10
export MATCH_WATCHDOG_CONCURRENCY=5
pm2 restart goalgpt-api
```

**✅ Test 3.6 Pass Criteria**:
- [ ] Rollback completed in <30 seconds
- [ ] System works with limit=999
- [ ] Re-enabling optimizations works
- [ ] No errors during rollback

**✅ PR-P1C Test Complete**: Concurrency bounded, pool safe, rollback tested

---

## 📊 COMBINED INTEGRATION TEST

**Objective**: Test all 3 PRs working together

### Setup All Optimizations

```bash
cd /var/www/goalgpt
git checkout feat/pr-p1c-concurrency-control

# Enable all optimizations
export USE_OPTIMIZED_DAILY_REWARDS=true
export USE_OPTIMIZED_BADGE_UNLOCK=true
export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=true
export MATCH_ENRICHER_CONCURRENCY=10
export MATCH_WATCHDOG_CONCURRENCY=5

pm2 restart goalgpt-api
```

### Run All Jobs

```bash
# Run all optimized jobs in sequence
npm run job:dailyRewardReminders
npm run job:badgeAutoUnlock
npm run job:scheduledNotifications

# Monitor pool throughout
watch -n 2 'curl -s http://staging.goalgpt.com/health/pool | jq'
```

### Monitor for 1 Hour

```bash
# Let system run for 1 hour with all optimizations
# Monitor:
# 1. Pool stats every 5 minutes
# 2. Job execution every 30 seconds
# 3. Error logs continuously

# Set up monitoring
while true; do
  echo "=== $(date) ==="
  curl -s http://staging.goalgpt.com/health/pool | jq
  echo "Active jobs:"
  pm2 list
  echo "Recent errors:"
  tail -10 logs/error.log
  echo ""
  sleep 300  # Every 5 minutes
done
```

### Verify Stability

**After 1 Hour**:
- [ ] No pool exhaustion events
- [ ] All jobs completed successfully
- [ ] Pool utilization <50%
- [ ] No memory leaks (heap stable)
- [ ] No errors in logs

---

## 🎯 SUCCESS CRITERIA

### PR-P1A
- [x] All indexes use CONCURRENTLY
- [x] CI validation works
- [x] No locks during migrations
- [x] FK indexes exist

### PR-P1B
- [ ] dailyRewardReminders: 2 queries, <5s execution
- [ ] badgeAutoUnlock: ~10 queries, <10s execution
- [ ] scheduledNotifications: memory stable
- [ ] Feature flags work
- [ ] Rollback works in 30s

### PR-P1C
- [ ] Pool utilization <50%
- [ ] Fire-and-forget eliminated
- [ ] Unbounded Promise.all eliminated
- [ ] Error tracking 100%
- [ ] Rollback works in 30s

### Combined
- [ ] All optimizations work together
- [ ] System stable for 1+ hour
- [ ] No regressions
- [ ] Ready for production

---

## 📋 POST-TEST CHECKLIST

### Documentation
- [ ] Record all test results
- [ ] Screenshot pool stats
- [ ] Save execution time metrics
- [ ] Document any issues found

### Cleanup
```bash
# Restore original state if needed
cd /var/www/goalgpt
git checkout main
pm2 restart goalgpt-api
```

### Report Generation
Create file: `STAGING-TEST-RESULTS.md` with:
- Test execution date/time
- All test results (pass/fail)
- Performance metrics
- Issues found (if any)
- Recommendations for production

---

## 🚀 NEXT STEPS AFTER STAGING

1. **If All Tests Pass**:
   - Schedule production rollout (Week 2-3)
   - Prepare rollback procedures
   - Notify stakeholders

2. **If Issues Found**:
   - Document issues
   - Fix in respective PR branches
   - Re-test in staging
   - Update documentation

---

**Estimated Total Time**: 4-6 hours
**Recommended**: Run during business hours with team available
**Prerequisites**: Staging environment ready, backup taken, monitoring tools ready

