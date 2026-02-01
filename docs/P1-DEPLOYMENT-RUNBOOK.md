# P1 JOB STAGGER - PRODUCTION ROLLOUT RUNBOOK

**Date**: 2026-02-01
**Branch**: `feat/job-stagger-p1` (ready, pushed to origin)
**Implementation**: ✅ COMPLETE (26/26 tests passing)
**Status**: READY FOR STAGING ROLLOUT

---

## QUICK START GUIDE

### Prerequisites
- SSH access to staging and production servers
- Database credentials (for SQL analysis)
- GitHub CLI (`gh`) installed
- Required permissions for deployment

### Phase Overview
1. **Staging Baseline** (24h) - Establish metrics with stagger OFF
2. **Staging Stagger** (72h) - Validate improvement with stagger ON
3. **Prod Baseline** (6-12h) - Deploy code to prod, stagger OFF
4. **Prod Stagger** (Active) - Enable in prod, monitor 7 days

### Risk Level
**VERY LOW** - Feature-flagged, instant rollback (30 seconds)

---

## PHASE 1: STAGING BASELINE (24 Hours)

### Objective
Establish baseline metrics before enabling stagger.

### Commands

**Deploy to staging:**
```bash
cd /Users/utkubozbay/Downloads/GoalGPT/project
./scripts/deploy-and-verify.sh staging-baseline root@staging.goalgpt.com
```

**Monitor (every 2-6 hours):**
```bash
ssh root@staging.goalgpt.com
cd /var/www/goalgpt

# Check job execution
tail -f logs/combined.log | grep -E "(Job started|Job completed)"

# Check pool utilization
grep "PoolMonitor" logs/combined.log | tail -20

# Record baseline metrics
grep "✅ Job completed" logs/combined.log | wc -l > reports/phase1_job_count.txt
grep "PoolMonitor" logs/combined.log | grep -oP 'utilization \K[0-9.]+(?=%)' > reports/phase1_pool_util.txt
```

### Success Criteria
- ✅ All 8 high-frequency jobs executing normally
- ✅ Pool utilization baseline documented (expect 80-95% peaks)
- ✅ Zero new job failures from deployment

---

## PHASE 2: STAGING STAGGER ON (72 Hours)

### Objective
Enable stagger and validate 8x pool reduction.

### Commands

**Deploy stagger:**
```bash
./scripts/deploy-and-verify.sh staging-stagger root@staging.goalgpt.com
```

**CRITICAL - First 30 minutes validation:**
```bash
ssh root@staging.goalgpt.com
cd /var/www/goalgpt
bash scripts/first-30min-validation.sh
```

**Schedule KPI checkpoints (every 6h for 72h):**
```bash
ssh root@staging.goalgpt.com
crontab -e
# Add: 0 */6 * * * cd /var/www/goalgpt && bash scripts/kpi-checkpoint.sh
```

**Run SQL analysis (daily for 3 days):**
```bash
# Day 1
ssh root@staging.goalgpt.com
psql $DATABASE_URL -f sql/p1-analysis.sql -o reports/phase2_day1.txt

# Repeat for Day 2 and Day 3
```

### Success Criteria
- ✅ Peak pool utilization drops to <50% (from 80-95%)
- ✅ Average job duration improves by ≥20%
- ✅ Concurrent jobs reduced to ≤2 (from 8)
- ✅ NO increase in job error rate
- ✅ Lock skip count reduces by ≥50%

### Rollback (if needed)
```bash
./scripts/rollback-stagger.sh root@staging.goalgpt.com
```

---

## PHASE 3: PROD BASELINE (6-12 Hours)

### Objective
Deploy code to production with stagger disabled.

### Commands

**Deploy to production:**
```bash
./scripts/deploy-and-verify.sh prod-baseline root@142.93.103.128
```

**Monitor (every hour for 6-12h):**
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt

# Verify stagger disabled
grep "Job stagger" logs/combined.log | tail -1
# Expected: "⏸️ Job stagger disabled"

# Record baseline
bash scripts/kpi-checkpoint.sh
```

### Success Criteria
- ✅ Zero job failures from deployment
- ✅ All jobs executing normally
- ✅ Baseline metrics documented

---

## PHASE 4: PROD STAGGER ON (7 Days Active Monitoring)

### Objective
Enable stagger in production, monitor for sustained improvement.

### Commands

**Enable stagger:**
```bash
./scripts/deploy-and-verify.sh prod-stagger root@142.93.103.128
```

**CRITICAL - First 30 minutes validation:**
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt
bash scripts/first-30min-validation.sh
```

**If validation fails:**
```bash
./scripts/rollback-stagger.sh root@142.93.103.128
```

**Schedule monitoring (every 6h for 7 days):**
```bash
ssh root@142.93.103.128
crontab -e
# Add: 0 */6 * * * cd /var/www/goalgpt && bash scripts/kpi-checkpoint.sh
```

**Daily SQL analysis (Days 1, 2, 3, 7):**
```bash
ssh root@142.93.103.128
psql $DATABASE_URL -f sql/p1-analysis.sql -o reports/prod_day1.txt
# Repeat for days 2, 3, 7
```

### Success Criteria (Day 7)
- ✅ Sustained pool utilization <50%
- ✅ Job duration improvement sustained (≥20%)
- ✅ Error rate unchanged or improved
- ✅ Zero stagger-related incidents

---

## ROLLBACK PROCEDURES

### Emergency Rollback (30 seconds)
```bash
# From any machine with SSH access
./scripts/rollback-stagger.sh root@<server>

# Verify rollback
ssh root@<server>
grep "Job stagger disabled" /var/www/goalgpt/logs/combined.log | tail -1
```

### Per-Job Rollback
```bash
# If one job is problematic, disable stagger for that job only
ssh root@<server>
nano /var/www/goalgpt/.env
# Add/change: JOB_STAGGER_<JOBNAME>=0
pm2 reload ecosystem.config.js
```

---

## MONITORING TOOLS

### Quick Health Check
```bash
ssh root@<server>
cd /var/www/goalgpt

# Job status
grep "Job started" logs/combined.log | tail -10

# Pool utilization
grep "PoolMonitor" logs/combined.log | tail -5

# Recent errors
tail -20 logs/error.log

# Verify stagger status
grep "Job stagger" logs/combined.log | tail -1
```

### Log Patterns
```bash
# All job starts with timing
grep "🔄 Job started" logs/combined.log | awk '{print $2, $NF}'

# Pool utilization over time
grep "PoolMonitor" logs/combined.log | grep -oP 'utilization \K[0-9.]+(?=%)'

# Slow queries
grep "\[DB\] Slow query" logs/combined.log

# Job failures
grep "❌ Job failed" logs/combined.log

# Lock skips
grep "skipped_lock" logs/combined.log
```

---

## KPI THRESHOLDS

| KPI | Baseline | Target | Alert |
|-----|----------|--------|-------|
| Pool Utilization (Avg) | 75-85% | <40% | >60% |
| Pool Utilization (Max) | 95%+ | <50% | >70% |
| Job Duration | [Baseline] | -30% | No improvement |
| Concurrent Jobs | 8 | 1 | >3 |
| Error Rate | [Baseline] | No change | +5% |
| Lock Skips | [Baseline] | -80% | +10% |

---

## ROLLBACK TRIGGERS (ABORT IF)

- ❌ Job error rate increases by >5%
- ❌ Pool utilization stays >70%
- ❌ Jobs fail to execute at expected offsets
- ❌ Collision warnings detected
- ❌ Concurrent jobs still >3
- ❌ Any database errors related to metadata

---

## EXPECTED IMPROVEMENTS

### Pool Utilization
- **Before**: 85-95% peak (8 jobs at :00)
- **After**: <40% average (1 job per second)
- **Reduction**: 8x improvement

### Job Duration
- **Before**: [Baseline per job]
- **After**: -30% average (reduced contention)

### Concurrent Execution
- **Before**: 8 jobs simultaneously
- **After**: 1-2 jobs max

### Lock Contention
- **Before**: [Baseline skip count]
- **After**: -80% reduction

---

## OFFSET DISTRIBUTION

**Every-Minute Jobs:**
- `:00s` - Referral Tier 2 Processor
- `:15s` - Referral Tier 3 Processor
- `:30s` - Scheduled Notifications
- `:45s` - Live Stats Sync

**Every-5-Minute Jobs:**
- `:05s` - Badge Auto-Unlock
- `:25s` - Prediction Matcher

**Every-10-Minute Jobs:**
- `:10s` - Stuck Match Finisher
- `:40s` - Telegram Settlement

**Collision Check**: ✅ PASSED (all unique offsets)

---

## FILES REFERENCE

### Scripts
- `scripts/deploy-and-verify.sh` - Universal deployment script
- `scripts/first-30min-validation.sh` - Critical validation checklist
- `scripts/kpi-checkpoint.sh` - 6-hourly KPI tracking
- `scripts/rollback-stagger.sh` - Emergency rollback

### SQL
- `sql/p1-analysis.sql` - Before/after comparison queries

### Reports
- `reports/phase1_*.txt` - Baseline metrics
- `reports/phase2_*.txt` - Stagger validation metrics
- `reports/kpi_*.txt` - Checkpoint reports

---

## SUPPORT & ESCALATION

### If Issues Detected
1. **Immediate**: Run rollback script
2. **Within 5 min**: Verify rollback successful
3. **Within 30 min**: Analyze logs and identify root cause
4. **Before retry**: Fix issue, validate in staging first

### Common Issues & Solutions

**Issue**: Jobs still at :00 seconds
- **Cause**: Stagger not applied
- **Fix**: Check `.env` has `JOB_STAGGER_ENABLED=true`, restart PM2

**Issue**: High pool utilization persists
- **Cause**: Offset collision or job overlap
- **Fix**: Check logs for collision warnings, adjust offsets

**Issue**: Job failures increase
- **Cause**: Metadata logging issue or DB error
- **Fix**: Check error logs, verify DB schema, rollback if persistent

**Issue**: Slow query count increases
- **Cause**: Unrelated to stagger
- **Fix**: Investigate specific queries, may need index optimization

---

## TIMELINE

- **Day 1**: Phase 1 (Staging Baseline) - Deploy, monitor 24h
- **Day 2-4**: Phase 2 (Staging Stagger) - Enable, validate 72h
- **Day 5**: Phase 3 (Prod Baseline) - Deploy to prod, monitor 12h
- **Day 6**: Phase 4 (Prod Stagger) - Enable, critical 30min validation
- **Day 6-12**: Active monitoring (6h checkpoints)
- **Day 13+**: Passive monitoring (weekly checks)

**Total Duration**: ~12 days from start to completion

---

## SUCCESS DECLARATION

P1 rollout is considered successful when:

1. ✅ All 4 phases completed without rollback
2. ✅ Production running with stagger for 7+ days
3. ✅ All KPI targets met consistently
4. ✅ Zero stagger-related incidents
5. ✅ Team trained on monitoring and rollback procedures

After success declaration:
- Update production documentation
- Archive runbook and reports
- Schedule P2 planning (if applicable)

---

**READY TO EXECUTE**: Start with Phase 1 (Staging Baseline)
