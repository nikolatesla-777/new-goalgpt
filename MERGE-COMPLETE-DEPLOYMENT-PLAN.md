# ✅ MERGE COMPLETE - Deployment Plan

**Date:** 2026-01-30
**Status:** All 7 PRs merged successfully to `main`

---

## 📦 MERGED PRs (Chronological Order)

| # | PR | Branch | SHA | Status |
|---|----|----|-----|--------|
| 1 | #10 | phase-0/stabilization | `0254840` | ✅ Merged |
| 2 | #5 | week-2A/scoring-pipeline | `d675b60` | ✅ Merged |
| 3 | #6 | week-2B/telegram-router | `cad63c1` | ✅ Merged |
| 4 | #7 | week-2C/backtest | `5a25c7e` | ✅ Merged |
| 5 | #8 | phase-3A/clean-mvp | `379aa3c` | ✅ Merged |
| 6 | #9 | phase-3A/clean-alignment | `6c0de4c` | ✅ Merged |
| 7 | #11 | phase-3B/admin-ops | `32aa24a` | ✅ Merged |

**Git Log:**
```bash
git log --oneline main -7
```

---

## 🗄️ DATABASE MIGRATIONS TO APPLY

### ⚠️ CRITICAL: Migration Conflict Resolution

**Duplicate Migration Detected:**
- `src/database/migrations/007-admin-publish-logs.ts` (Phase-3B - Kysely)
- `src/database/migrations/20260129_create_admin_publish_logs.sql` (Phase-3A - SQL)

**Both create `admin_publish_logs` table.**

**Recommendation:** Apply **ONLY ONE** of these migrations:
- **Option 1 (Recommended):** `20260129_create_admin_publish_logs.sql` (more complete schema with `fs_match_id`, `channel_id`, `completed_at`)
- **Option 2:** `007-admin-publish-logs.ts` (simpler schema)

**Action:** Before deployment, verify which migration to use and delete/disable the duplicate.

### New Migrations from Merged PRs

#### PR #10 (Phase-0) - ALREADY APPLIED ❓
```bash
src/database/migrations/006-phase0-idempotency.ts
```
Creates: `job_execution_logs`, `telegram_blocked_chats`, adds `dedupe_key` to matches

#### PR #7 (Week-2C)
```bash
src/database/migrations/20260128_create_scoring_backtest_results.sql
src/database/migrations/20260128_create_scoring_predictions.sql
src/database/migrations/create-fs-match-stats-table.sql
```
Creates: `scoring_backtest_results`, `scoring_predictions`, `fs_match_stats`

#### PR #8 (Phase-3A) OR PR #11 (Phase-3B)
```bash
# CHOOSE ONE:
src/database/migrations/20260129_create_admin_publish_logs.sql  # Recommended
# OR
src/database/migrations/007-admin-publish-logs.ts
```
Creates: `admin_publish_logs`

### Migration Execution Order

```bash
# 1. Check if Phase-0 migration was already applied
psql $DATABASE_URL -c "SELECT * FROM job_execution_logs LIMIT 1" 2>/dev/null

# If not exists, apply Phase-0:
# npm run migration:run 006-phase0-idempotency

# 2. Apply Week-2C migrations
psql $DATABASE_URL -f src/database/migrations/20260128_create_scoring_backtest_results.sql
psql $DATABASE_URL -f src/database/migrations/20260128_create_scoring_predictions.sql
psql $DATABASE_URL -f src/database/migrations/create-fs-match-stats-table.sql

# 3. Apply admin_publish_logs (CHOOSE ONE)
psql $DATABASE_URL -f src/database/migrations/20260129_create_admin_publish_logs.sql
```

---

## 🔧 ENVIRONMENT VARIABLES / FEATURE FLAGS

### Required Configuration (VPS .env)

```bash
# ADMIN API SECURITY
ADMIN_API_KEY="<GENERATE_STRONG_KEY_32_CHARS>"  # REQUIRED!
ADMIN_RATE_LIMIT=60                             # Requests per minute per IP (default: 60)
ADMIN_IP_ALLOWLIST=""                          # Comma-separated IPs (empty = allow all)

# AUTO-PUBLISH FEATURE FLAGS (CRITICAL!)
AUTO_PUBLISH_ENABLED=false                      # Kill switch - MUST be false initially!
AUTO_PUBLISH_DRY_RUN=true                       # Safety - always dry-run first
MAX_PUBLISH_PER_RUN=20                          # Max predictions per execution

# EXISTING VARS (verify these exist)
DATABASE_URL="postgresql://..."
THESPORTS_API_USER="..."
THESPORTS_API_SECRET="..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_CHANNEL_ADMIN="..."
```

### Generate ADMIN_API_KEY
```bash
# On VPS:
openssl rand -base64 32
# Set in .env file
```

### Feature Flag Behaviors

| Flag | Value | Behavior |
|------|-------|----------|
| `AUTO_PUBLISH_ENABLED` | `false` | Auto-publish jobs will NOT run (safe default) |
| `AUTO_PUBLISH_ENABLED` | `true` | Auto-publish jobs will run (enable after testing) |
| `AUTO_PUBLISH_DRY_RUN` | `true` | Publishes will be simulated (no actual Telegram send) |
| `AUTO_PUBLISH_DRY_RUN` | `false` | Publishes will be real (only enable after dry-run testing) |
| `MAX_PUBLISH_PER_RUN` | `20` | Max 20 predictions per job execution (kill switch) |

---

## 🚀 DEPLOYMENT STEPS (Zero-Downtime)

### 1. Pre-Deployment Checks
```bash
# On local machine:
git log main --oneline -10
# Verify all 7 commits are present

npm run build
# Ensure build succeeds
```

### 2. VPS Backup
```bash
ssh root@142.93.103.128

# Backup current release
cd /var/www/goalgpt
cp -r . ../goalgpt-backup-$(date +%Y%m%d-%H%M%S)

# Backup database schema
pg_dump $DATABASE_URL --schema-only > ~/db-schema-backup-$(date +%Y%m%d-%H%M%S).sql
```

### 3. Pull & Install
```bash
cd /var/www/goalgpt
git fetch origin main
git checkout main
git pull origin main

# Verify SHA matches local
git log --oneline -1
# Should show: 32aa24a feat(phase-3B): Advanced admin operations...

npm ci
npm run build
```

### 4. Apply Database Migrations
```bash
# Option 1: Manual SQL execution
psql $DATABASE_URL -f src/database/migrations/20260128_create_scoring_backtest_results.sql
psql $DATABASE_URL -f src/database/migrations/20260128_create_scoring_predictions.sql
psql $DATABASE_URL -f src/database/migrations/create-fs-match-stats-table.sql
psql $DATABASE_URL -f src/database/migrations/20260129_create_admin_publish_logs.sql

# Option 2: If migration runner exists
# npm run migration:run
```

### 5. Configure Environment Variables
```bash
nano .env

# Add/Update these variables:
ADMIN_API_KEY="<PASTE_GENERATED_KEY>"
ADMIN_RATE_LIMIT=60
ADMIN_IP_ALLOWLIST=""
AUTO_PUBLISH_ENABLED=false
AUTO_PUBLISH_DRY_RUN=true
MAX_PUBLISH_PER_RUN=20

# Save and exit (Ctrl+X, Y, Enter)
```

### 6. Restart Application
```bash
pm2 restart goalgpt
pm2 logs goalgpt --lines 50
# Watch for errors
```

---

## ✅ POST-DEPLOYMENT SMOKE TESTS

### Test 1: Verify 7-Market Scoring Endpoint
```bash
curl -X GET "https://partnergoalgpt.com/api/scoring/markets" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "markets": [
    "O25", "BTTS", "HT_O05", "O35", "HOME_O15", "CORNERS_O85", "CARDS_O25"
  ]
}
```

### Test 2: Admin API Key Authentication
```bash
# Test without API key (should fail)
curl -X GET "https://partnergoalgpt.com/api/admin/publish-logs" | jq

# Expected: 401 Unauthorized
```

```bash
# Test with valid API key
curl -X GET "https://partnergoalgpt.com/api/admin/publish-logs" \
  -H "x-admin-api-key: <YOUR_ADMIN_API_KEY>" | jq

# Expected: 200 OK with empty logs array
```

### Test 3: AI Summary Endpoint
```bash
# Get today's match ID from diary
MATCH_ID=$(curl "https://partnergoalgpt.com/api/matches/diary?date=$(date +%Y-%m-%d)" | jq -r '.matches[0].id')

# Test AI summary
curl -X POST "https://partnergoalgpt.com/api/admin/ai-summary" \
  -H "x-admin-api-key: <YOUR_ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"match_id\": \"$MATCH_ID\", \"locale\": \"tr\"}" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "match_id": "...",
    "summary": "...",
    "confidence": 75
  }
}
```

**OR** (if Week-2A endpoint not available yet):
```json
{
  "error": "Service Unavailable",
  "message": "Failed to generate summary",
  "note": "Week-2A endpoint may not be available yet"
}
```

### Test 4: Verify Job Scheduler
```bash
pm2 logs goalgpt | grep "Initializing Phase"
```

**Expected Output:**
```
🤖 Initializing Phase 4 background jobs...
✅ Badge Auto-Unlock scheduled
✅ Referral Tier 2 Processor scheduled
...
✅ Daily Auto-Preview scheduled
✅ Daily Auto-Publish scheduled (DISABLED - feature flag)
```

### Test 5: Verify AUTO_PUBLISH is Disabled
```bash
pm2 logs goalgpt | grep "Daily Auto-Publish"
```

**Expected:**
- Job should be registered but NOT executing
- Look for: "DISABLED - feature flag" or similar

---

## 🎯 UI INTEGRATION TASKS (Future Work)

### Admin Panel Features to Add

#### 1. AI Summary Panel (Phase-3B.1)
**Location:** `frontend/src/components/admin/MatchScoringAnalysis.tsx`

**Task:**
- Add "Generate AI Summary" button
- Call `POST /api/admin/ai-summary` with `x-admin-api-key`
- Display formatted summary with confidence score

#### 2. Bulk Preview/Publish UI (Phase-3B.2)
**Location:** `frontend/src/components/admin/BulkOperations.tsx` (new file)

**Features:**
- Date range picker (date_from, date_to)
- Market checkboxes (O25, BTTS, etc.)
- Filter inputs (min_confidence, min_probability)
- "Preview" button → `POST /api/admin/bulk-preview`
- Results table with "Publish Selected" button
- Dry-run mode toggle

#### 3. Audit Logs Screen (Phase-3A.1)
**Location:** `frontend/src/components/admin/PublishLogs.tsx` (new file)

**Features:**
- Paginated table view
- Filters: market_id, admin_user_id, status
- Display: timestamp, match, market, status, message_id, error
- Export to CSV button

---

## 📊 MONITORING & VALIDATION

### Daily Checks (First Week)

#### Day 1-3: Dry-Run Testing
```bash
# Keep AUTO_PUBLISH_ENABLED=false
# Monitor logs for any errors in:
# - Daily Auto-Preview job (08:00 UTC)
# - Job execution (check job_execution_logs table)

psql $DATABASE_URL -c "
  SELECT job_name, status, COUNT(*)
  FROM job_execution_logs
  WHERE job_name IN ('dailyAutoPreview', 'dailyAutoPublish')
  GROUP BY job_name, status
  ORDER BY job_name;
"
```

#### Day 4-7: Enable Dry-Run Mode
```bash
# Update .env:
AUTO_PUBLISH_ENABLED=true
AUTO_PUBLISH_DRY_RUN=true  # Still dry-run!

pm2 restart goalgpt

# Monitor admin_publish_logs
psql $DATABASE_URL -c "
  SELECT status, dry_run, COUNT(*)
  FROM admin_publish_logs
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY status, dry_run;
"
```

#### Week 2+: Production Mode (if dry-run successful)
```bash
# Update .env:
AUTO_PUBLISH_DRY_RUN=false  # Real publishes!

pm2 restart goalgpt

# Monitor Telegram channels for actual messages
# Check admin_publish_logs for telegram_message_id population
```

---

## 🚨 ROLLBACK PLAN (If Critical Issues)

### Emergency Rollback
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt

# Revert to previous commit (before all 7 merges)
git reset --hard d28cb3e  # Last commit before Phase-0

npm ci
npm run build
pm2 restart goalgpt

# Database rollback (if needed)
# Restore from backup:
psql $DATABASE_URL < ~/db-schema-backup-YYYYMMDD-HHMMSS.sql
```

### Partial Rollback (Disable Features)
```bash
# Quick disable without code rollback:
nano .env

# Set:
AUTO_PUBLISH_ENABLED=false
ADMIN_API_KEY=""  # Disable admin endpoints

pm2 restart goalgpt
```

---

## 📝 VERIFICATION CHECKLIST

- [ ] All 7 PRs merged to main (SHA: 32aa24a)
- [ ] Pushed to origin/main successfully
- [ ] Database migrations planned (resolve duplicate first!)
- [ ] ADMIN_API_KEY generated (32+ chars)
- [ ] .env configured with feature flags (AUTO_PUBLISH_ENABLED=false)
- [ ] Deployment to VPS completed
- [ ] Database migrations applied
- [ ] PM2 restart successful
- [ ] Smoke Test 1: `/api/scoring/markets` returns 7 markets
- [ ] Smoke Test 2: `/api/admin/publish-logs` requires API key (401 without)
- [ ] Smoke Test 3: `/api/admin/ai-summary` accessible with API key
- [ ] Job scheduler initialized (check PM2 logs)
- [ ] AUTO_PUBLISH jobs registered but disabled (verify logs)
- [ ] No errors in PM2 logs for 10 minutes
- [ ] Daily Auto-Preview job executes at 08:00 UTC (dry-run mode)
- [ ] Audit logs accumulating in `admin_publish_logs` table

---

## 🎉 SUCCESS CRITERIA

**Phase-3B Deployment is successful when:**

1. ✅ All 6 admin endpoints respond correctly:
   - `POST /api/admin/publish-with-audit`
   - `GET /api/admin/publish-logs`
   - `POST /api/admin/ai-summary`
   - `POST /api/admin/bulk-preview`
   - `POST /api/admin/bulk-publish`
   - `POST /api/admin/generate-image`

2. ✅ Security middleware working:
   - Rate limiting (429 after 60 requests)
   - API key auth (401 without valid key)
   - IP allowlist (403 if configured and IP not in list)

3. ✅ Jobs scheduled correctly:
   - Daily Auto-Preview runs at 08:00 UTC
   - Daily Auto-Publish registered but DISABLED (AUTO_PUBLISH_ENABLED=false)
   - No errors in job execution logs

4. ✅ Audit logging functional:
   - All publishes logged to `admin_publish_logs`
   - Logs queryable via `/api/admin/publish-logs`

5. ✅ Zero downtime:
   - No service interruption during deployment
   - All existing features still working (live scores, predictions, etc.)

---

**Prepared by:** Claude Sonnet 4.5
**Date:** 2026-01-30
**Next Review:** After VPS deployment + smoke tests
