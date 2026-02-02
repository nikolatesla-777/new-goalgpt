# STAGING TESTING - QUICK START GUIDE

**Date**: 2026-02-02
**Environment**: Staging
**Time Required**: 4-6 hours

---

## 🚀 QUICK START (TL;DR)

```bash
# SSH to staging
ssh root@staging.goalgpt.com
cd /var/www/goalgpt

# Run automated tests (recommended)
./scripts/test-staging-pr-p1b.sh   # Test N+1 elimination (30 min)
./scripts/test-staging-pr-p1c.sh   # Test concurrency control (30 min)

# Monitor pool for 1 hour
./scripts/monitor-pool.sh 60
```

---

## 📁 TEST SCRIPTS AVAILABLE

### 1. PR-P1B Test Script (N+1 Query Elimination)
**File**: `scripts/test-staging-pr-p1b.sh`
**Duration**: ~30 minutes
**What it tests**:
- Daily reward reminders (10,001 → 2 queries)
- Badge auto-unlock (100K+ → ~10 queries)
- Scheduled notifications (memory usage)
- Feature flag rollback

**Run**:
```bash
./scripts/test-staging-pr-p1b.sh
```

**Expected Output**:
```
====================================
PR-P1B STAGING TEST
====================================

✓ PASS: Daily rewards using optimized path
✓ PASS: Query count ≤ 3 (actual: 2)
✓ PASS: Execution time < 5s (actual: 3500ms)
✓ PASS: Badge unlock using batch insert
✓ PASS: Execution time < 10s (actual: 8500ms)
✓ PASS: Scheduled notifications job completed
✓ PASS: Rollback to legacy path successful

====================================
TEST SUMMARY
====================================
Passed: 7
Failed: 0

✓ ALL TESTS PASSED

PR-P1B is ready for production!
```

---

### 2. PR-P1C Test Script (Concurrency Control)
**File**: `scripts/test-staging-pr-p1c.sh`
**Duration**: ~30 minutes
**What it tests**:
- Pool utilization (<50%)
- Match enricher bounded concurrency
- Match watchdog bounded concurrency
- Load testing (50 concurrent requests)
- Concurrency limit optimization
- Rollback

**Run**:
```bash
./scripts/test-staging-pr-p1c.sh
```

**Expected Output**:
```
====================================
PR-P1C STAGING TEST
====================================

✓ PASS: Pool utilization < 60% (actual: 40%)
✓ PASS: Match enricher using bounded concurrency
✓ PASS: Pool active connections ≤ 50 (actual: 12)
✓ PASS: Match watchdog executed
✓ PASS: Pool active ≤ 15 after watchdog (actual: 8)
✓ PASS: Pool utilization < 70% under load (actual: 55%)
✓ PASS: Pool utilization < 50% with optimized limits (actual: 25%)
✓ PASS: Rollback completed

====================================
TEST SUMMARY
====================================
Passed: 8
Failed: 0

✓ ALL TESTS PASSED

PR-P1C is ready for production!
```

---

### 3. Pool Monitoring Script
**File**: `scripts/monitor-pool.sh`
**Duration**: Configurable (default: 30 min)
**What it monitors**:
- Active connections
- Idle connections
- Waiting connections
- Pool utilization %
- Status (HEALTHY/WARNING/CRITICAL)

**Run**:
```bash
# Monitor for 30 minutes (default)
./scripts/monitor-pool.sh

# Monitor for 1 hour
./scripts/monitor-pool.sh 60

# Monitor for 4 hours
./scripts/monitor-pool.sh 240
```

**Expected Output**:
```
====================================
DATABASE POOL MONITOR
====================================
Duration: 60 minutes
Interval: 5 seconds
Started: 2026-02-02 10:30:00

Time                 Active     Idle       Waiting    Utilization     Status
------------------------------------------------------------------------------------
2026-02-02 10:30:00  8          12         0          40%             HEALTHY
2026-02-02 10:30:05  7          13         0          35%             HEALTHY
2026-02-02 10:30:10  12         8          0          60%             WARNING
...

====================================
MONITORING SUMMARY
====================================
Duration: 60 minutes
Total checks: 720
Max active connections: 12
Max utilization: 60%
Warnings: 15

✓ EXCELLENT: Pool utilization stayed below 50%
```

---

## 📝 MANUAL TESTING STEPS

If you prefer manual testing, follow these steps:

### Step 1: Verify PR-P1A (Already Deployed)

```bash
# Check indexes use CONCURRENTLY
psql $DATABASE_URL -c "
  SELECT indexname, tablename
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    AND indexdef LIKE '%CONCURRENTLY%'
  LIMIT 20;
"

# Run CI validator
npm run validate:migrations
```

### Step 2: Test PR-P1B

```bash
# Checkout branch
git fetch origin
git checkout feat/pr-p1b-n+1-elimination
npm install

# Enable optimizations
export USE_OPTIMIZED_DAILY_REWARDS=true
export USE_OPTIMIZED_BADGE_UNLOCK=true
export USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS=true
pm2 restart goalgpt-api

# Run jobs
npm run job:dailyRewardReminders
npm run job:badgeAutoUnlock

# Check logs
tail -100 logs/combined.log | grep "✅ Optimized:"
```

### Step 3: Test PR-P1C

```bash
# Checkout branch
git checkout feat/pr-p1c-concurrency-control
npm install

# Set concurrency limits
export MATCH_ENRICHER_CONCURRENCY=10
export MATCH_WATCHDOG_CONCURRENCY=5
pm2 restart goalgpt-api

# Monitor pool
watch -n 5 'curl -s http://localhost:3000/health/pool | jq'

# Trigger match enrichment
curl http://localhost:3000/api/matches/live

# Wait for watchdog (runs every 30s)
sleep 35

# Check logs
tail -100 logs/combined.log | grep "Watchdog"
```

---

## ✅ SUCCESS CRITERIA CHECKLIST

### PR-P1B
- [ ] Query count: 10,001 → 2 (dailyRewardReminders)
- [ ] Query count: 100K+ → ~10 (badgeAutoUnlock)
- [ ] Execution time: <5s (dailyRewardReminders)
- [ ] Execution time: <10s (badgeAutoUnlock)
- [ ] Memory stable (scheduledNotifications)
- [ ] Feature flags work correctly
- [ ] Rollback works in 30 seconds

### PR-P1C
- [ ] Pool utilization <50%
- [ ] Max concurrent ≤ configured limit
- [ ] Match enricher: no fire-and-forget
- [ ] Match watchdog: bounded concurrency
- [ ] Load test: pool stays <70%
- [ ] Optimized limits: pool <50%
- [ ] Rollback works in 30 seconds

### Combined
- [ ] All jobs run successfully
- [ ] No errors in logs
- [ ] Pool stable for 1+ hour
- [ ] No memory leaks
- [ ] Ready for production

---

## 🐛 TROUBLESHOOTING

### Issue: Test script fails to run

**Solution**:
```bash
# Make sure scripts are executable
chmod +x scripts/*.sh

# Check if jq is installed (required for JSON parsing)
which jq || apt-get install -y jq

# Check if curl is installed
which curl || apt-get install -y curl
```

### Issue: Pool stats endpoint not responding

**Solution**:
```bash
# Check if API is running
pm2 list

# Restart API
pm2 restart goalgpt-api

# Check logs for errors
tail -50 logs/error.log
```

### Issue: Jobs not running

**Solution**:
```bash
# Check if job files exist
ls -la src/jobs/*.job.ts

# Run job directly with tsx
npx tsx -e "
import { runDailyRewardReminders } from './src/jobs/dailyRewardReminders.job';
runDailyRewardReminders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
"
```

### Issue: Feature flags not working

**Solution**:
```bash
# Verify env vars are set
echo $USE_OPTIMIZED_DAILY_REWARDS
echo $MATCH_ENRICHER_CONCURRENCY

# Make sure to restart after setting env vars
pm2 restart goalgpt-api

# Check if features.ts is imported correctly
grep "FEATURE_FLAGS" src/jobs/dailyRewardReminders.job.ts
```

---

## 📊 RESULTS DOCUMENTATION

After testing, create file: `docs/STAGING-TEST-RESULTS.md`

**Template**:
```markdown
# STAGING TEST RESULTS

**Date**: 2026-02-02
**Tester**: [Your Name]
**Duration**: 4 hours

## PR-P1B Results
- dailyRewardReminders: ✅ PASS (2 queries, 3.5s)
- badgeAutoUnlock: ✅ PASS (8 queries, 8.2s)
- scheduledNotifications: ✅ PASS (memory stable)
- Rollback: ✅ PASS (30s)

## PR-P1C Results
- Pool utilization: ✅ PASS (max 48%)
- Match enricher: ✅ PASS (bounded)
- Match watchdog: ✅ PASS (bounded)
- Load test: ✅ PASS (55% under load)
- Rollback: ✅ PASS (30s)

## Issues Found
- None

## Recommendation
✅ Ready for production deployment
```

---

## 🚀 NEXT STEPS AFTER TESTING

1. **If All Tests Pass**:
   ```bash
   # Document results
   vim docs/STAGING-TEST-RESULTS.md

   # Notify team
   echo "All staging tests passed! Ready for production."

   # Schedule production deployment
   # Week 2: Deploy PR-P1B (gradual rollout)
   # Week 3: Deploy PR-P1C (gradual rollout)
   ```

2. **If Tests Fail**:
   ```bash
   # Document failures
   vim docs/STAGING-TEST-FAILURES.md

   # Rollback to main
   git checkout main
   pm2 restart goalgpt-api

   # Create GitHub issues for failures
   # Fix issues in respective PR branches
   # Re-test in staging
   ```

---

## 📞 SUPPORT

If you encounter issues:
1. Check `docs/STAGING-TEST-PLAN.md` for detailed steps
2. Review `docs/PR-P1B-N+1-ELIMINATION.md` for PR-P1B details
3. Review `docs/PR-P1C-CONCURRENCY-CONTROL.md` for PR-P1C details
4. Check logs: `tail -100 logs/combined.log`
5. Check errors: `tail -100 logs/error.log`

---

**Estimated Time**: 4-6 hours
**Prerequisites**: Staging access, database backup, monitoring tools
**Recommended**: Run during business hours with team available
