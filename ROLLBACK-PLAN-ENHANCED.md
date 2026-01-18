# ENHANCED ROLLBACK PLAN - Backend Refactor Safety Net

**Tarih:** 17 Ocak 2026
**Proje:** GoalGPT Backend Refactor (MQTT Direct Writes + AI Settlement)
**Risk Level:** HIGH (Critical production system)

---

## 🎯 OVERVIEW

Bu refactor şunları değiştirecek:
1. ✅ MQTT → Direct DB writes (queue/orchestrator bypass)
2. ✅ AI predictions → Instant settlement on GOAL events
3. ✅ MatchWriteQueue → Deleted
4. ✅ LiveMatchOrchestrator → Deleted
5. ✅ 12 sync workers → 1 EntitySyncWorker

---

## 🛡️ PRE-DEPLOYMENT SAFETY CHECKLIST

### 1. Database Backup (MANDATORY)
```bash
# VPS: /var/www/goalgpt
ssh root@142.93.103.128

# Full database backup with timestamp
BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/root/backups/goalgpt_pre_refactor_${BACKUP_TIME}.sql"

# Create backup directory
mkdir -p /root/backups

# Dump entire database
PGPASSWORD='ysWCB6wcltV4nn9P' pg_dump \
  -h aws-1-eu-central-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.wakbsxzocfpngywyzdml \
  -d postgres \
  --verbose \
  --no-owner \
  --no-acl \
  -f "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Verify backup integrity
gunzip -t "${BACKUP_FILE}.gz"
ls -lh "${BACKUP_FILE}.gz"

echo "✅ Backup created: ${BACKUP_FILE}.gz"
```

**Expected Size:** ~500MB-1GB compressed
**Verification:** `gunzip -t` must pass without errors

### 2. Git Snapshot
```bash
# Local: Create safety branch
git checkout -b backup/pre-refactor-$(date +%Y%m%d_%H%M%S)
git push origin backup/pre-refactor-$(date +%Y%m%d_%H%M%S)

# Tag current state
git tag -a v1.0-pre-refactor -m "Stable state before backend refactor"
git push origin v1.0-pre-refactor

# Return to main
git checkout main
```

### 3. PM2 Process Save
```bash
# VPS: Save PM2 process list
ssh root@142.93.103.128
pm2 save
pm2 list > /root/backups/pm2_processes_$(date +%Y%m%d_%H%M%S).txt
```

### 4. Environment Variables Backup
```bash
# VPS: Backup .env file
ssh root@142.93.103.128
cp /var/www/goalgpt/.env "/root/backups/env_$(date +%Y%m%d_%H%M%S).backup"
```

### 5. Current Logs Snapshot
```bash
# VPS: Save current logs
ssh root@142.93.103.128
pm2 logs goalgpt-backend --lines 1000 --nostream > "/root/backups/logs_pre_refactor_$(date +%Y%m%d_%H%M%S).txt"
```

---

## 🔄 DEPLOYMENT PROCEDURE

### Phase 1: Local Testing
```bash
# Local development
cd /Users/utkubozbay/Downloads/GoalGPT/project

# Run TypeScript check
npm run typecheck

# Start dev server
npm run dev

# Monitor logs for errors
# Test with live matches
# Verify MQTT direct writes work
# Verify AI settlement triggers on goals
```

**Success Criteria:**
- ✅ No TypeScript errors
- ✅ Server starts without crashes
- ✅ MQTT messages parsed correctly
- ✅ Score updates written to DB within 100ms
- ✅ AI predictions settle instantly on goals

### Phase 2: Staging Deployment (VPS - Low Traffic Window)
```bash
# Choose low-traffic time: 03:00-05:00 TSI (optimal)

# VPS deployment
ssh root@142.93.103.128
cd /var/www/goalgpt

# Pull latest code
git fetch origin
git checkout main
git pull origin main

# Install dependencies (if package.json changed)
npm install

# Restart backend
pm2 restart goalgpt-backend

# Monitor logs in real-time
pm2 logs goalgpt-backend --lines 100
```

**Monitor for 5 minutes:**
- ✅ Server starts successfully
- ✅ MQTT connects: `websocket.connected`
- ✅ No crash loops
- ✅ Database connections healthy

### Phase 3: Live Verification
```bash
# Check live matches API
curl https://partnergoalgpt.com/api/matches/live | jq '.matches | length'

# Check WebSocket connection
# Frontend: https://partnergoalgpt.com/livescore/live

# Check AI predictions
curl https://partnergoalgpt.com/api/predictions/matched | jq '.'
```

**Success Criteria:**
- ✅ Live matches displaying correctly
- ✅ Scores update in real-time (<1s)
- ✅ AI predictions show correct status
- ✅ No NULL values in frontend

---

## 🚨 ROLLBACK PROCEDURES

### CRITICAL: When to Rollback

Rollback **IMMEDIATELY** if ANY of these occur:
1. ❌ Server crashes on startup (5+ restarts in 2 minutes)
2. ❌ MQTT connection fails repeatedly
3. ❌ Live match scores NOT updating (stuck for >2 minutes)
4. ❌ Database connection pool exhaustion
5. ❌ AI predictions stuck in "PENDING" status
6. ❌ Frontend showing NULL/0-0 scores for live matches
7. ❌ Error rate >10% in logs

### Rollback Level 1: Code-Only Revert (FAST - 2 minutes)

**Use when:** Server code broken, database schema unchanged

```bash
# VPS
ssh root@142.93.103.128
cd /var/www/goalgpt

# Revert to safe tag
git fetch --tags
git checkout v1.0-pre-refactor

# Reinstall dependencies
npm install

# Restart
pm2 restart goalgpt-backend
pm2 logs goalgpt-backend --lines 50

# Verify rollback
curl https://partnergoalgpt.com/api/matches/live
```

**Expected Time:** 2-3 minutes
**Verification:** Old code running, matches display correctly

### Rollback Level 2: Database Restore (MEDIUM - 10 minutes)

**Use when:** Database corruption, schema issues, data loss

```bash
# VPS
ssh root@142.93.103.128

# Find latest backup
ls -lh /root/backups/*.sql.gz | tail -3

# Stop backend to prevent writes
pm2 stop goalgpt-backend

# Restore database
BACKUP_FILE="/root/backups/goalgpt_pre_refactor_YYYYMMDD_HHMMSS.sql.gz"

# Decompress
gunzip "$BACKUP_FILE"

# Drop and recreate (DESTRUCTIVE!)
PGPASSWORD='ysWCB6wcltV4nn9P' psql \
  -h aws-1-eu-central-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.wakbsxzocfpngywyzdml \
  -d postgres \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
PGPASSWORD='ysWCB6wcltV4nn9P' psql \
  -h aws-1-eu-central-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.wakbsxzocfpngywyzdml \
  -d postgres \
  -f "${BACKUP_FILE%.gz}"

# Verify restore
PGPASSWORD='ysWCB6wcltV4nn9P' psql \
  -h aws-1-eu-central-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.wakbsxzocfpngywyzdml \
  -d postgres \
  -c "SELECT COUNT(*) FROM ts_matches WHERE status_id IN (2,3,4,5,7);"

# Restart backend
pm2 restart goalgpt-backend
```

**Expected Time:** 10-15 minutes (depends on DB size)
**Data Loss:** All changes since backup timestamp

### Rollback Level 3: Full System Restore (SLOW - 20 minutes)

**Use when:** Complete system failure, cascading issues

```bash
# 1. Restore database (Level 2 steps)
# 2. Restore code (Level 1 steps)
# 3. Restore environment
ssh root@142.93.103.128
cp /root/backups/env_YYYYMMDD_HHMMSS.backup /var/www/goalgpt/.env

# 4. Clear PM2 logs
pm2 flush

# 5. Restart all services
pm2 restart all

# 6. Verify health
pm2 status
pm2 logs --lines 50

# 7. Test frontend
curl https://partnergoalgpt.com/api/matches/live
curl https://partnergoalgpt.com/ai-predictions
```

---

## 📊 POST-ROLLBACK VERIFICATION

### Critical Checks:
```bash
# 1. Backend health
pm2 status goalgpt-backend
# Expected: status=online, restarts=0 (or low)

# 2. Database connections
PGPASSWORD='ysWCB6wcltV4nn9P' psql -h aws-1-eu-central-1.pooler.supabase.com -p 6543 -U postgres.wakbsxzocfpngywyzdml -d postgres -c "SELECT count(*), state FROM pg_stat_activity WHERE datname = 'postgres' GROUP BY state;"
# Expected: 10-15 connections, mostly idle

# 3. Live matches API
curl https://partnergoalgpt.com/api/matches/live | jq '.matches | length'
# Expected: >0 matches if live games exist

# 4. AI predictions
curl https://partnergoalgpt.com/api/predictions/matched | jq '.[] | {match_id, status, home_score, away_score}'
# Expected: No NULL values, correct statuses

# 5. Frontend visual check
# Visit: https://partnergoalgpt.com/livescore/live
# Verify: Scores display, no 0-0 stuck matches
```

---

## 🔧 MONITORING POST-DEPLOYMENT

### Immediate Monitoring (First 30 minutes):
```bash
# Tail logs
pm2 logs goalgpt-backend --lines 100

# Watch for:
# ✅ websocket.connected
# ✅ orchestrator.preferred_source_accept (OLD - should be GONE after refactor)
# ✅ mqtt.direct_write.success (NEW)
# ✅ ai.settlement.goal_detected (NEW)
# ❌ timeout exceeded
# ❌ ECONNREFUSED
# ❌ crash/restart loops
```

### Extended Monitoring (First 24 hours):
```bash
# Check error rate every 15 minutes
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i error | wc -l

# Check restart count
pm2 show goalgpt-backend | grep "restarts"

# Check database query time
PGPASSWORD='ysWCB6wcltV4nn9P' psql -h aws-1-eu-central-1.pooler.supabase.com -p 6543 -U postgres.wakbsxzocfpngywyzdml -d postgres -c "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 5;"
```

---

## 📞 EMERGENCY CONTACTS

### If Rollback Fails:
1. **Check backup integrity:** `gunzip -t /root/backups/*.sql.gz`
2. **Check disk space:** `df -h` (need >5GB free)
3. **Check Supabase status:** https://status.supabase.com/
4. **Nuclear option:** Contact Supabase support for point-in-time recovery

### Recovery Time Objectives (RTO):
- **Code Rollback:** 2-3 minutes
- **Database Restore:** 10-15 minutes
- **Full System Restore:** 20-30 minutes

### Data Loss Risk:
- **Backup taken before deployment:** 0 data loss
- **Backup taken 1 hour before deployment:** Up to 1 hour of data loss
- **Recommendation:** Take backup **immediately** before deployment

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-Deployment:
- [ ] Database backup created and verified
- [ ] Git safety branch and tag pushed
- [ ] PM2 process list saved
- [ ] .env file backed up
- [ ] Current logs captured
- [ ] Low-traffic deployment window confirmed (03:00-05:00 TSI)

### During Deployment:
- [ ] Code deployed to VPS
- [ ] Dependencies installed
- [ ] Backend restarted
- [ ] Logs monitored for 5 minutes
- [ ] No critical errors observed

### Post-Deployment:
- [ ] Live matches API working
- [ ] Scores updating in real-time
- [ ] AI predictions settling on goals
- [ ] Frontend displaying correctly
- [ ] Database connections healthy
- [ ] No NULL values anywhere
- [ ] Error rate <5%

### Rollback Decision Point (if ANY fail):
- [ ] If ANY post-deployment check fails → Execute Rollback Level 1
- [ ] If database issues → Execute Rollback Level 2
- [ ] If complete failure → Execute Rollback Level 3

---

## 🎯 SUCCESS METRICS

### Deployment Successful If:
1. ✅ Server uptime >99% first hour
2. ✅ MQTT score updates <100ms latency
3. ✅ AI predictions settle within 1 second of goal
4. ✅ Zero NULL values in frontend
5. ✅ Database connection pool <50% usage
6. ✅ Error rate <5%
7. ✅ No stuck matches for >2 minutes
8. ✅ User complaints = 0

---

**Plan Created:** 17 Ocak 2026, 01:40 TSI
**Review Status:** APPROVED
**Deployment Window:** TBD (03:00-05:00 TSI recommended)
