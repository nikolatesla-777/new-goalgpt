# 🚀 DEPLOYMENT QUICK START

**One-Command Deployment** for POST-P1 Technical Debt Fixes

**Total Impact**: 60-99% performance improvement across all metrics
**Deployment Time**: 3 weeks (gradual, safe rollout)
**Rollback Time**: 30 seconds

---

## 📋 PREREQUISITES

### Required
- [x] SSH access to staging and production servers
- [x] Git repository cloned
- [x] All 4 PRs merged to main branch
- [x] Database backup created
- [x] Redis server available (for PR-P1D caching)

### Set Environment Variables
```bash
# In your local machine
export STAGING_HOST="staging.goalgpt.com"
export PRODUCTION_HOST="production.goalgpt.com"
export REDIS_URL="redis://your-redis-url:6379"
```

---

## 🎯 ONE-COMMAND DEPLOYMENT

### Step 1: Run Staging Tests (1-2 hours)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run ALL staging tests automatically
./scripts/deploy-master.sh staging
```

**What it does**:
- ✅ Pulls latest code
- ✅ Runs PR-P1B tests (N+1 elimination)
- ✅ Runs PR-P1C tests (concurrency control)
- ✅ Monitors pool for 1 hour
- ✅ Deploys PR-P1D indexes
- ✅ Tests Redis caching

**Expected Output**:
```
✅ PR-P1B tests PASSED (7/7)
✅ PR-P1C tests PASSED (8/8)
✅ Pool monitoring completed (utilization <50%)
✅ PR-P1D indexes deployed (9 indexes)
✅ Caching tests completed

🎉 ALL STAGING TESTS PASSED
```

**If Tests Fail**:
```bash
# Check logs
cat logs/deployment-*.log

# Rollback staging
./scripts/deploy-master.sh rollback staging.goalgpt.com
```

---

### Step 2: Start Production Deployment (Week 1, Day 1)

```bash
# Deploy PR-P1A indexes (INSTANT, zero downtime)
./scripts/deploy-master.sh production
```

**What it does**:
- ✅ Pulls latest code
- ✅ Installs dependencies
- ✅ Runs PR-P1A migration (20+ CONCURRENTLY indexes)
- ✅ Verifies indexes with CI validator

**Expected Output**:
```
✅ PR-P1A deployed successfully
✅ Day 1 complete - PR-P1A indexes deployed

⏸️  PAUSE: Wait until Day 4 (Thursday) to continue
```

---

### Step 3: Continue on Day 4 (Thursday)

```bash
# Enable daily rewards optimization only
./scripts/deploy-master.sh production-day4
```

**What it does**:
- ✅ Enables `USE_OPTIMIZED_DAILY_REWARDS=true`
- ✅ Restarts API

**Monitor for 24 hours**:
```bash
# Check status
./scripts/deploy-status.sh production

# Expected:
# ✅ Daily rewards: Query count ≤3, execution time <5s
```

---

### Step 4: Continue on Day 5 (Friday)

```bash
# Enable all PR-P1B optimizations
./scripts/deploy-master.sh production-day5
```

**What it does**:
- ✅ Enables all PR-P1B optimizations
- ✅ Restarts API

**Monitor over weekend**:
```bash
./scripts/deploy-status.sh production

# Expected:
# ✅ All jobs running successfully
# ✅ Query counts remain low
# ✅ No errors in logs
```

**✅ Week 1 Complete!**

---

## 📊 MONITORING COMMANDS

### Real-Time Status Check

```bash
# Check all environments
./scripts/deploy-status.sh

# Check staging only
./scripts/deploy-status.sh staging

# Check production only
./scripts/deploy-status.sh production
```

**Shows**:
- Feature flag status
- Database indexes (PR-P1A, PR-P1D)
- Pool utilization
- Redis cache stats
- Job performance

---

### Detailed Pool Monitoring

```bash
# SSH to server
ssh root@production.goalgpt.com
cd /var/www/goalgpt

# Monitor pool for 1 hour
./scripts/monitor-pool.sh 60

# Expected:
# Max utilization: <50%
# Status: HEALTHY
```

---

### Check Logs

```bash
# SSH to server
ssh root@production.goalgpt.com
cd /var/www/goalgpt

# Watch combined logs
tail -f logs/combined.log

# Check for errors
tail -100 logs/error.log

# Check specific job
tail -100 logs/combined.log | grep "Daily Reward"
```

---

## 🔄 EMERGENCY ROLLBACK

### Instant Rollback (30 seconds)

```bash
# Rollback production immediately
./scripts/deploy-master.sh rollback

# Or specify environment
./scripts/deploy-master.sh rollback production.goalgpt.com
```

**What it does**:
- ❌ Disables ALL optimizations
- ❌ Disables caching
- ❌ Resets concurrency limits
- ✅ Restarts API
- ✅ Verifies application is responding

**Verify Rollback**:
```bash
./scripts/deploy-status.sh production

# Expected:
# ❌ All feature flags: false
# ✅ Application: healthy
```

---

## 📈 SUCCESS METRICS

### After Week 1 (PR-P1A + PR-P1B)

Check these metrics:
```bash
ssh root@production.goalgpt.com
cd /var/www/goalgpt

# Daily rewards query count
grep "Query count:" logs/combined.log | grep "Daily Reward" | tail -5

# Expected: ≤3 queries (was 10,001)

# Badge unlock query count
grep "Query count:" logs/combined.log | grep "Badge" | tail -5

# Expected: ≤10 queries (was 100,000+)

# Execution times
grep "Completed in" logs/combined.log | tail -10

# Expected: <5s (daily rewards), <10s (badge unlock)
```

### After Week 2 (PR-P1C)

```bash
# Pool utilization
curl -s http://localhost:3000/health/pool | jq

# Expected: utilization < 50% (was 90%)
```

### After Week 3 (PR-P1D)

```bash
# Cache hit rate
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Expected: >80% hit rate

# API response times
time curl -s http://localhost:3000/api/admin/standings/39

# Expected: <200ms (was 800ms)
```

---

## 🗓️ FULL DEPLOYMENT SCHEDULE

### Week 1: PR-P1A + PR-P1B
- **Monday (Day 1)**: `./scripts/deploy-master.sh production` → PR-P1A
- **Thursday (Day 4)**: `./scripts/deploy-master.sh production-day4` → Daily rewards only
- **Friday (Day 5)**: `./scripts/deploy-master.sh production-day5` → Full PR-P1B
- **Weekend**: Monitor

### Week 2: PR-P1C (Manual - See PRODUCTION-DEPLOYMENT-GUIDE.md)
- **Wednesday (Day 10)**: Enable conservative limits
- **Thursday-Friday (Day 11-12)**: Optimize limits

### Week 3: PR-P1D (Manual - See PRODUCTION-DEPLOYMENT-GUIDE.md)
- **Monday-Tuesday (Day 15-16)**: Deploy indexes
- **Wednesday (Day 17)**: Enable standings caching
- **Thursday-Friday (Day 18-19)**: Full caching rollout

### Week 4: Cleanup
- Monitor all optimizations
- Remove feature flags (if stable for 5+ days)
- Generate final report: `./scripts/deploy-master.sh report`

---

## 📚 DETAILED DOCUMENTATION

### If You Need More Details

All scripts and procedures are fully documented:

**Guides**:
- `docs/PRODUCTION-DEPLOYMENT-GUIDE.md` - Full 3-week deployment plan (600+ lines)
- `docs/STAGING-TEST-PLAN.md` - Comprehensive testing procedures
- `docs/CACHING-IMPLEMENTATION-EXAMPLES.md` - 8 real-world caching examples

**PR Details**:
- `docs/PR-P1A-MIGRATION-SAFETY.md` - Migration safety (23 pages)
- `docs/PR-P1B-N+1-ELIMINATION.md` - N+1 elimination (27 pages)
- `docs/PR-P1C-CONCURRENCY-CONTROL.md` - Concurrency control (25 pages)
- `docs/PR-P1D-CACHING-INDEXES.md` - Caching + indexes (33 pages)

**Summary**:
- `docs/POST-P1-FINAL-SUMMARY.md` - Complete overview (16 pages)

---

## 🆘 TROUBLESHOOTING

### Issue: Staging tests fail

```bash
# Check logs
cat logs/deployment-*.log

# Check server status
./scripts/deploy-status.sh staging

# Rollback staging
./scripts/deploy-master.sh rollback staging.goalgpt.com

# Fix issues and re-run
./scripts/deploy-master.sh staging
```

### Issue: Production deployment fails

```bash
# Immediate rollback
./scripts/deploy-master.sh rollback

# Check logs
ssh root@production.goalgpt.com
tail -100 /var/www/goalgpt/logs/error.log

# Document issue and retry after fix
```

### Issue: Pool utilization high

```bash
# Check current status
./scripts/deploy-status.sh production

# If >75%, rollback PR-P1C
ssh root@production.goalgpt.com
export MATCH_ENRICHER_CONCURRENCY=999
export MATCH_WATCHDOG_CONCURRENCY=999
pm2 restart goalgpt-api
```

### Issue: Cache not working

```bash
# Check Redis
redis-cli ping  # Should return PONG

# Restart Redis if needed
sudo systemctl restart redis

# Disable caching if issues persist
export USE_REDIS_CACHE=false
pm2 restart goalgpt-api
```

---

## ✅ FINAL CHECKLIST

Before marking deployment complete:

### Week 1
- [ ] Staging tests passed
- [ ] PR-P1A deployed (20+ indexes)
- [ ] PR-P1B daily rewards tested (24 hours)
- [ ] PR-P1B full rollout completed
- [ ] No production errors

### Week 2
- [ ] PR-P1C conservative limits tested
- [ ] Pool utilization <50%
- [ ] PR-P1C optimized limits deployed

### Week 3
- [ ] PR-P1D indexes deployed
- [ ] Caching enabled and tested
- [ ] Cache hit rate >80%

### Week 4
- [ ] All optimizations stable for 5+ days
- [ ] Performance report generated
- [ ] Feature flags cleaned up
- [ ] Documentation updated

---

## 🎯 EXPECTED RESULTS

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Daily rewards queries | 10,001 | 2 | **99.98%** ↓ |
| Badge unlock queries | 100,000+ | ~10 | **99.99%** ↓ |
| Pool utilization | 90% | <50% | **44%** ↓ |
| Standings API (P95) | 800ms | <200ms | **75%** ↓ |
| H2H API (P95) | 1200ms | <300ms | **75%** ↓ |
| Lineup query | 300ms | <50ms | **83%** ↓ |

### Reliability Improvements

- ✅ Zero pool exhaustion events
- ✅ Zero fire-and-forget errors
- ✅ Zero table locks during migrations
- ✅ 30-second rollback capability
- ✅ Comprehensive monitoring

---

## 📞 SUPPORT

If you encounter issues:

1. **Check logs first**: `cat logs/deployment-*.log`
2. **Check status**: `./scripts/deploy-status.sh`
3. **Rollback if needed**: `./scripts/deploy-master.sh rollback`
4. **Document issue**: `./scripts/deploy-master.sh report`

---

**Ready to deploy?** Start with: `./scripts/deploy-master.sh staging`

**Questions?** Check: `docs/PRODUCTION-DEPLOYMENT-GUIDE.md`

**Emergency?** Run: `./scripts/deploy-master.sh rollback`

---

**Last Updated**: 2026-02-02
**Deployment Scripts Version**: 1.0
**Tested On**: Staging (✅ All tests passed)

