# P1 ROLLOUT - QUICK CHECKLIST

## PHASE 1: STAGING BASELINE ⏱️ 24h

### Deploy
```bash
./scripts/deploy-and-verify.sh staging-baseline root@staging.goalgpt.com
```

### Monitor (every 6h)
- [ ] Jobs executing normally
- [ ] Pool utilization logged
- [ ] No new errors

### Record Baseline
```bash
ssh root@staging.goalgpt.com
cd /var/www/goalgpt
grep "✅ Job completed" logs/combined.log | wc -l > reports/phase1_job_count.txt
grep "PoolMonitor" logs/combined.log | grep -oP 'utilization \K[0-9.]+(?=%)' > reports/phase1_pool_util.txt
```

---

## PHASE 2: STAGING STAGGER ⏱️ 72h

### Deploy
```bash
./scripts/deploy-and-verify.sh staging-stagger root@staging.goalgpt.com
```

### CRITICAL: First 30 Minutes
```bash
ssh root@staging.goalgpt.com
cd /var/www/goalgpt
bash scripts/first-30min-validation.sh
```

**IF FAILS → ROLLBACK:**
```bash
./scripts/rollback-stagger.sh root@staging.goalgpt.com
```

### Schedule Monitoring
```bash
ssh root@staging.goalgpt.com
crontab -e
# Add: 0 */6 * * * cd /var/www/goalgpt && bash scripts/kpi-checkpoint.sh
```

### Daily SQL Analysis
```bash
# Day 1, 2, 3
ssh root@staging.goalgpt.com
psql $DATABASE_URL -f sql/p1-analysis.sql -o reports/phase2_day<N>.txt
```

### Success Criteria (after 72h)
- [ ] Pool utilization <50% (was 80-95%)
- [ ] Job duration -30%
- [ ] Concurrent jobs ≤2 (was 8)
- [ ] No error rate increase
- [ ] Lock skips -80%

---

## PHASE 3: PROD BASELINE ⏱️ 6-12h

### Deploy
```bash
./scripts/deploy-and-verify.sh prod-baseline root@142.93.103.128
```

### Monitor (every hour)
- [ ] Jobs executing normally
- [ ] Stagger disabled confirmed
- [ ] No new errors

### Record Baseline
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt
bash scripts/kpi-checkpoint.sh
```

---

## PHASE 4: PROD STAGGER ⏱️ 7 days

### Deploy
```bash
./scripts/deploy-and-verify.sh prod-stagger root@142.93.103.128
```

### CRITICAL: First 30 Minutes (HANDS-ON)
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt
bash scripts/first-30min-validation.sh
```

**IF FAILS → ROLLBACK IMMEDIATELY:**
```bash
./scripts/rollback-stagger.sh root@142.93.103.128
```

### Schedule Monitoring
```bash
ssh root@142.93.103.128
crontab -e
# Add: 0 */6 * * * cd /var/www/goalgpt && bash scripts/kpi-checkpoint.sh
```

### Daily Checks (Days 1, 2, 3, 7)
```bash
ssh root@142.93.103.128
psql $DATABASE_URL -f sql/p1-analysis.sql -o reports/prod_day<N>.txt
```

### Success Criteria (Day 7)
- [ ] Pool utilization <50% sustained
- [ ] Job duration improvement sustained
- [ ] Error rate stable
- [ ] Zero incidents
- [ ] All monitoring healthy

---

## ROLLBACK DECISION TREE

```
Issue detected?
├─ Yes → Severity?
│  ├─ CRITICAL (jobs failing, pool >90%, errors)
│  │  └─ ROLLBACK IMMEDIATELY
│  │     ./scripts/rollback-stagger.sh root@<server>
│  └─ WARNING (pool 60-70%, slight degradation)
│     └─ Continue monitoring 1h
│        ├─ Improves → Continue
│        └─ Worsens → ROLLBACK
└─ No → Continue monitoring
```

---

## QUICK HEALTH CHECK

```bash
# One-liner health check
ssh root@<server> 'cd /var/www/goalgpt && \
  echo "=== Stagger Status ===" && \
  grep "Job stagger" logs/combined.log | tail -1 && \
  echo "=== Pool Utilization (last 5 checks) ===" && \
  grep "PoolMonitor" logs/combined.log | tail -5 && \
  echo "=== Recent Errors ===" && \
  tail -10 logs/error.log && \
  echo "=== Job Timing (last 10 starts) ===" && \
  grep "Job started" logs/combined.log | tail -10 | awk "{print \$2, \$NF}"'
```

---

## FILES CREATED

### Scripts (all executable)
- ✅ `scripts/deploy-and-verify.sh`
- ✅ `scripts/first-30min-validation.sh`
- ✅ `scripts/kpi-checkpoint.sh`
- ✅ `scripts/rollback-stagger.sh`

### SQL
- ✅ `sql/p1-analysis.sql`

### Documentation
- ✅ `docs/P1-DEPLOYMENT-RUNBOOK.md`
- ✅ `docs/P1-QUICK-CHECKLIST.md` (this file)

---

## NEXT IMMEDIATE STEPS

1. **Review Code** (15 min)
   ```bash
   cd /Users/utkubozbay/Downloads/GoalGPT/project
   git checkout feat/job-stagger-p1
   npm test -- staggerConfig.test.ts
   ```

2. **Merge to Main** (5 min)
   ```bash
   git checkout main
   git merge feat/job-stagger-p1
   git push origin main
   ```

3. **Start Phase 1** (24h)
   ```bash
   ./scripts/deploy-and-verify.sh staging-baseline root@staging.goalgpt.com
   ```

---

## TIMELINE ESTIMATE

| Phase | Duration | Calendar Days |
|-------|----------|---------------|
| Phase 1 (Staging Baseline) | 24h | Day 1 |
| Phase 2 (Staging Stagger) | 72h | Day 2-4 |
| Phase 3 (Prod Baseline) | 12h | Day 5 |
| Phase 4 (Prod Stagger) | 7d active | Day 6-12 |
| **Total** | **~12 days** | **Start to completion** |

---

## EMERGENCY CONTACTS

- **Primary**: [Your contact]
- **Secondary**: [Team lead]
- **Escalation**: [CTO/Engineering lead]

---

**STATUS**: ✅ READY TO EXECUTE
**RISK**: 🟢 VERY LOW (feature-flagged, instant rollback)
**NEXT ACTION**: Merge branch to main, start Phase 1
