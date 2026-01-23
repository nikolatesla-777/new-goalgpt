# PR-5B: First TheSports Consumer Migration

**Commit:** `ef91fd4`
**Status:** ✅ Ready for Production Deployment
**Risk Level:** 🟢 Low (Read-only endpoints, adapter-based)

---

## 📦 What Was Migrated

### Services (2)
1. **MatchDiaryService** → `/match/diary` TheSports API endpoint
   - Route: `GET /api/matches/diary`
   - Usage: Daily match listing (high traffic)
   - Cache: 10 minutes
   - Response: Match list with team/competition data

2. **CompetitionService** → `/competition/list` TheSports API endpoint
   - Route: `GET /api/leagues/:league_id/*` (indirect usage)
   - Usage: League/competition metadata
   - Cache: 24 hours
   - Response: Competition list with metadata

---

## 🔧 Before/After Call Path

### Before (Legacy)
```typescript
// TheSportsAPIManager (axios-based, old circuit breaker)
import { theSportsAPI } from '../../../core/TheSportsAPIManager';

const response = await this.client.get('/match/diary', { date: '20260123' });
```

### After (Hardened)
```typescript
// TheSportsClient via Adapter (cockatiel resilience, new circuit breaker)
import { theSportsAPIAdapter as theSportsAPI } from '../../../integrations/thesports';

const response = await this.client.get('/match/diary', { date: '20260123' });
// ✅ Response shape IDENTICAL (adapter ensures compatibility)
// ✅ Gains: exponential backoff, circuit breaker (5 failures → 30s cooldown)
// ✅ Gains: request ID tracing, improved rate limiting
```

**Key Point:** Code using the service sees NO CHANGE. Only internal HTTP client changed.

---

## ✅ Pre-Merge Checks Passed

```bash
✅ grep -rn "axios.*thesports|fetch.*thesports" src/services/thesports/match/matchDiary.service.ts
   → 0 results (no direct HTTP calls)

✅ grep "import.*theSports" src/services/thesports/{match/matchDiary,competition/competition}.service.ts
   → src/services/thesports/match/matchDiary.service.ts:
        import { theSportsAPIAdapter as theSportsAPI } from '../../../integrations/thesports';
   → src/services/thesports/competition/competition.service.ts:
        import { theSportsAPIAdapter as theSportsAPI } from '../../../integrations/thesports';

✅ npm run typecheck 2>&1 | grep -E "(matchDiary|competition\.service|integrations/thesports)"
   → 0 new errors (141 pre-existing TypeScript errors unchanged)

✅ Environment Variables:
   → No new env vars required
   → Uses existing config.thesports.baseUrl / .user / .secret

✅ Tests Added:
   → src/__tests__/pr5b-migration.test.ts (CI-safe with fetch mocking)
   → Validates response structure for both services
   → Checks adapter health and circuit breaker state
   → NO real network calls - fully mocked
   → src/__tests__/manual/live-thesports-smoke.ts (manual live testing)
   → Requires THESPORTS_API_USER/SECRET credentials
   → Run with: npm run test:live-thesports
```

---

## 🧪 Smoke Test Commands

### Local Testing (Before Deploy)

```bash
# 1. Health checks
curl http://localhost:3000/health
curl http://localhost:3000/ready

# 2. Match Diary endpoint (migrated)
curl -s "http://localhost:3000/api/matches/diary?date=2026-01-23" | jq '.results | length'
# Expected: Number of matches for the date

# 3. Competition list (migrated, indirect usage)
curl -s "http://localhost:3000/api/leagues/1/fixtures?limit=5" | jq '.fixtures | length'
# Expected: 5 fixtures or less

# 4. Circuit breaker health (NEW - check adapter)
curl -s "http://localhost:3000/health" | jq '.integrations.thesports'
# Expected: { initialized: true, circuitState: "CLOSED", ... }
```

### Production Testing (After Deploy)

```bash
# 1. Production health
curl https://partnergoalgpt.com/health
curl https://partnergoalgpt.com/ready

# 2. Match Diary (critical path)
curl -I https://partnergoalgpt.com/api/matches/diary
# Expected: HTTP/1.1 200 OK

# 3. Verify JSON response keys
curl -s "https://partnergoalgpt.com/api/matches/diary?date=$(date +%Y%m%d)" | jq 'keys'
# Expected: ["results", "results_extra", ...]

# 4. Check response time (should be similar or faster)
time curl -s "https://partnergoalgpt.com/api/matches/diary" > /dev/null
# Expected: < 2 seconds (cached) or < 5 seconds (fresh)

# 5. Monitor logs for circuit breaker trips
pm2 logs goalgpt-backend --lines 50 | grep -E "Circuit|TheSportsClient"  # CORRECTED: Process name
# Expected: No "OPEN" circuit state, normal request logs
```

---

## 🚀 Production Deployment Plan

### Prerequisites
- [x] PR approved
- [x] Smoke tests passed locally
- [x] Backup strategy ready (git revert)

### Deployment Steps (DigitalOcean + PM2)

**DEPLOYMENT METHOD: Manual git pull** (PR-0 releases/current infrastructure exists but not yet active)

```bash
# 1. SSH to production server
ssh root@142.93.103.128

# 2. Navigate to project directory
cd /var/www/goalgpt

# 3. Backup current state
git branch backup-pre-pr5b-$(date +%Y%m%d_%H%M%S)

# 4. Pull changes from main
git pull origin main

# 5. Install dependencies (if package.json changed - NOT in this PR)
npm install  # Should show: "up to date, audited 650 packages in 1s"

# 6. Reload PM2 (hot reload without downtime)
pm2 reload goalgpt-backend  # CORRECTED: Process name is goalgpt-backend, not goalgpt

# 7. Verify PM2 status
pm2 status
# Expected: goalgpt-backend | online | 0 restarts

# 8. Monitor logs for 2 minutes
pm2 logs goalgpt-backend --lines 100  # CORRECTED: Process name is goalgpt-backend
# Watch for:
#   ✅ [TheSportsClient] Initialized with cockatiel resilience
#   ✅ [TheSportsClient] → GET /match/diary
#   ✅ [TheSportsClient] ← /match/diary (XXXms)
#   ❌ [TheSportsClient] Circuit breaker state: OPEN (should NOT appear)

# 9. Run production smoke tests (see above section)

# 10. Monitor for 5 minutes
pm2 monit  # Watch CPU/memory, should be stable
```

### Post-Deployment Validation

```bash
# Check circuit breaker state via health endpoint
curl -s https://partnergoalgpt.com/health | jq '.integrations.thesports.circuitState'
# Expected: "CLOSED" (healthy)

# Check rate limiter queue
curl -s https://partnergoalgpt.com/health | jq '.integrations.thesports.rateLimiter'
# Expected: { tokens: 4-5, queueLength: 0-1 }

# Check request metrics
curl -s https://partnergoalgpt.com/health | jq '.integrations.thesports.metrics'
# Expected: { requests: >0, errors: 0, ... }
```

---

## 🔴 Rollback Plan

### If Issues Detected:

**Symptoms requiring rollback:**
- Circuit breaker stuck OPEN (> 1 minute)
- Increased error rate on /api/matches/diary
- Timeout errors (> 10 seconds)
- HTTP 500 responses on previously working endpoints

**Rollback Steps (< 2 minutes):**

```bash
# 1. Identify commit to revert
git log --oneline | grep "pr-5"
# Find: ef91fd4 refactor(pr-5): Migrate first TheSports consumers...

# 2. Revert the migration
git revert ef91fd4 --no-edit

# 3. Reload PM2
pm2 reload goalgpt-backend  # CORRECTED: Process name is goalgpt-backend

# 4. Verify rollback
curl -s https://partnergoalgpt.com/health | jq '.integrations.thesports'
# Expected: null or undefined (legacy client has no health endpoint)

# 5. Confirm endpoints work
curl -I https://partnergoalgpt.com/api/matches/diary
# Expected: HTTP/1.1 200 OK

# 6. Monitor logs
pm2 logs goalgpt-backend --lines 50  # CORRECTED: Process name is goalgpt-backend
# Expected: Back to normal, no TheSportsClient logs
```

### Alternative Rollback (If git revert fails):

```bash
# 1. Checkout previous commit
git checkout backup-pre-pr5b-YYYYMMDD_HHMMSS

# 2. Force reset main
git reset --hard HEAD

# 3. Reload PM2
pm2 reload goalgpt-backend  # CORRECTED: Process name is goalgpt-backend
```

---

## 📊 Expected Metrics (Post-Deploy)

### Request Success Rate
- **Before:** ~98% (legacy circuit breaker)
- **After:** ~99%+ (improved retry + circuit breaker)

### Average Response Time
- **Match Diary (cached):** < 100ms (unchanged)
- **Match Diary (fresh):** 1-3s (unchanged or slightly faster)

### Circuit Breaker Trips
- **Expected:** 0 trips in first 24 hours
- **Alert threshold:** > 2 trips in 1 hour

### Rate Limiting
- **Queue length:** 0-2 requests (unchanged)
- **Token bucket:** 4-5 tokens available (unchanged)

---

## 🔍 Monitoring Checklist (First 24 Hours)

### Hour 1 (Critical)
- [ ] No HTTP 500 errors on /api/matches/diary
- [ ] Circuit breaker state: CLOSED
- [ ] PM2 status: online, 0 restarts
- [ ] Response times: < 5 seconds for fresh requests

### Hour 6 (Important)
- [ ] No sustained circuit breaker OPEN state
- [ ] Error rate < 2%
- [ ] No customer complaints about match listings

### Hour 24 (Stability)
- [ ] Circuit breaker trips: 0-1 (acceptable)
- [ ] Total requests > 1000 (normal traffic)
- [ ] Error rate < 1%

---

## 🎯 Success Criteria

**Deployment considered successful if:**

✅ All smoke tests pass
✅ No sustained circuit breaker OPEN state (> 1 minute)
✅ Error rate < 2% for migrated endpoints
✅ Response times within 10% of baseline
✅ No customer-reported issues
✅ PM2 stable (0 unexpected restarts)

**If ALL criteria met after 24 hours → Proceed with next migration batch (PR-5C)**

---

## 📝 Next Steps (AFTER 24H Stability)

**Awaiting approval for PR-5C (next batch):**

Candidate endpoints for next migration:
1. MatchDetailLiveService (`/match/detail_live`) - Medium risk
2. StandingsService (`/season/standings`) - Low risk
3. TeamDataService (`/team/data`) - Low risk

**DO NOT PROCEED** without explicit approval after PR-5B stability confirmed.

---

## 📞 Contact

**Rollback Authority:** Engineering team
**Monitoring:** PM2 logs + health endpoint
**Timeline:** Deploy during low-traffic hours (recommended: early morning UTC+3)
