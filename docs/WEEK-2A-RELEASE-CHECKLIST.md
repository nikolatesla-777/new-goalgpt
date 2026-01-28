# Week-2A Release Checklist - Composite Scoring Pipeline

**PR**: #4
**Branch**: `phase-2A/thesports-scoring-endpoint`
**Target**: `main`
**Date**: 2026-01-29

---

## ✅ Pre-Merge Checklist

### 1. Code Review
- [ ] All 17 Week-2A tests passing (featureBuilder + scoring.routes)
- [ ] No regressions in existing tests (306/310 passing, 4 unrelated network failures)
- [ ] Code follows project conventions
- [ ] No console.logs or debug statements
- [ ] TypeScript strict mode compliance

### 2. Documentation Review
- [ ] `docs/PR-WEEK-2A-DESCRIPTION.md` complete
- [ ] `docs/SAMPLE-SCORING-RESPONSE.md` accurate
- [ ] `docs/THESPORTS_TO_SCORING_MAPPING.md` updated (v2.0.0)
- [ ] `docs/WEEK-2A-PHASE-2-COMPLETION-REPORT.md` comprehensive

### 3. Breaking Changes Assessment
- [ ] `MarketId` type exported (minimal impact, internal use only)
- [ ] No API contract changes
- [ ] No database schema changes
- [ ] Backward compatible with existing code

---

## 🔧 Required Environment Variables

### Existing (No Changes)
```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:port/database

# TheSports API credentials (unchanged)
THESPORTS_API_USER=your_api_user
THESPORTS_API_SECRET=your_api_secret

# FootyStats API credentials (unchanged)
FOOTYSTATS_API_KEY=your_footystats_key
```

### New (None Required)
**No new environment variables needed.** Week-2A uses existing database connection and API credentials.

---

## 🗄️ Database Migrations Required

**ANSWER: NONE**

Week-2A uses **EXISTING** database tables:
- ✅ `ts_matches` (TheSports matches) - Already exists
- ✅ `fs_match_stats` (FootyStats match stats) - Already exists

**NO schema changes, NO migrations needed.**

---

## 🧪 Smoke Test Commands

### 1. Server Health Check
```bash
curl http://localhost:3000/api/health
# Expected: { "status": "ok" }
```

### 2. Get Available Markets
```bash
curl http://localhost:3000/api/scoring/markets | jq
```

**Expected Response**:
```json
{
  "markets": [
    { "id": "O25", "display_name": "Over 2.5 Goals", "display_name_tr": "2.5 Üst Gol" },
    { "id": "BTTS", "display_name": "Both Teams To Score", "display_name_tr": "Karşılıklı Gol" },
    { "id": "HT_O05", "display_name": "Half-Time Over 0.5", "display_name_tr": "İlk Yarı 0.5 Üst" },
    { "id": "O35", "display_name": "Over 3.5 Goals", "display_name_tr": "3.5 Üst Gol" },
    { "id": "HOME_O15", "display_name": "Home Over 1.5", "display_name_tr": "Ev Sahibi 1.5 Üst" },
    { "id": "CORNERS_O85", "display_name": "Corners Over 8.5", "display_name_tr": "Korner 8.5 Üst" },
    { "id": "CARDS_O25", "display_name": "Cards Over 2.5", "display_name_tr": "Kart 2.5 Üst" }
  ]
}
```

**Checklist**:
- [ ] Returns 200 OK
- [ ] All 7 markets present
- [ ] Both `display_name` (EN) and `display_name_tr` (TR) present

### 3. Score All Markets (With FootyStats Linked)
```bash
# Replace <ts_match_id> with real TheSports match ID from ts_matches table
curl "http://localhost:3000/api/matches/<ts_match_id>/scoring" | jq
```

**Expected Response Keys Checklist**:
- [ ] `match_id` - TheSports external match ID
- [ ] `source_refs` object:
  - [ ] `thesports_match_id` - External ID
  - [ ] `thesports_internal_id` - Internal UUID
  - [ ] `footystats_match_id` - Number (if linked) or null
  - [ ] `footystats_linked` - Boolean (true if FootyStats data found)
  - [ ] `link_method` - "stored_mapping" | "deterministic_match" | "not_found"
- [ ] `features` object:
  - [ ] `source` - "hybrid" (if linked) or "thesports" (if not)
  - [ ] `match_id`, `kickoff_ts`, `home_team`, `away_team`
  - [ ] `xg` - Object with home/away/total (if linked) or undefined
  - [ ] `odds` - Object with home_win/draw/away_win (if linked) or undefined
  - [ ] `potentials` - Object with over25/btts/etc (if linked) or undefined
  - [ ] `completeness` - Object with `present[]` and `missing[]` arrays
- [ ] `risk_flags` - Array (empty if all data present, or ["MISSING_XG", "MISSING_ODDS", ...])
- [ ] `results[]` - Array of 7 market results:
  - [ ] `market_id` - Market code (O25, BTTS, etc.)
  - [ ] `market_name` - Display name (localized)
  - [ ] `probability` - Number (0.0-1.0)
  - [ ] `confidence` - Integer (0-100)
  - [ ] `pick` - "YES" or "NO"
  - [ ] `edge` - Number (positive/negative/null)
  - [ ] `components[]` - Array of component breakdowns
  - [ ] `metadata` - Object with lambda_total, lambda_home, lambda_away, implied_prob (when available)
  - [ ] `can_publish` - Boolean
  - [ ] `publish_reason` - String explanation
  - [ ] `failed_checks[]` - Array of failed validation checks
  - [ ] `passed_checks[]` - Array of passed validation checks
- [ ] `generated_at` - Unix timestamp

### 4. Score Specific Markets (Filter)
```bash
curl "http://localhost:3000/api/matches/<ts_match_id>/scoring?markets=O25,BTTS" | jq
```

**Checklist**:
- [ ] Returns 200 OK
- [ ] `results[]` contains exactly 2 elements (O25, BTTS)
- [ ] Other fields same as above

### 5. Turkish Locale
```bash
curl "http://localhost:3000/api/matches/<ts_match_id>/scoring?locale=tr" | jq
```

**Checklist**:
- [ ] Returns 200 OK
- [ ] `results[].market_name` in Turkish (e.g., "2.5 Üst Gol", "Karşılıklı Gol")

### 6. Match Not Found (Error Handling)
```bash
curl "http://localhost:3000/api/matches/nonexistent-match-id/scoring" | jq
```

**Expected Response**:
```json
{
  "error": "Match not found: nonexistent-match-id"
}
```

**Checklist**:
- [ ] Returns 404 Not Found
- [ ] Error message clear and specific

### 7. Invalid Market IDs (Error Handling)
```bash
curl "http://localhost:3000/api/matches/<ts_match_id>/scoring?markets=O25,INVALID_MARKET" | jq
```

**Expected Response**:
```json
{
  "error": "Invalid market IDs",
  "details": {
    "invalid": ["INVALID_MARKET"],
    "allowed": ["O25", "BTTS", "HT_O05", "O35", "HOME_O15", "CORNERS_O85", "CARDS_O25"]
  }
}
```

**Checklist**:
- [ ] Returns 400 Bad Request
- [ ] `details.invalid` lists invalid market IDs
- [ ] `details.allowed` lists all valid market IDs

---

## 🚨 Failure Handling & Expected Behaviors

### Scenario 1: FootyStats Data NOT Linked
**Trigger**: Match has no FootyStats data (neither stored mapping nor deterministic match found)

**Expected Behavior**:
```json
{
  "source_refs": {
    "footystats_linked": false,
    "link_method": "not_found"
  },
  "features": {
    "source": "thesports",
    "xg": undefined,
    "odds": undefined,
    "potentials": undefined,
    "completeness": {
      "missing": ["xg", "odds", "potentials"]
    }
  },
  "risk_flags": ["MISSING_XG", "MISSING_ODDS", "MISSING_POTENTIALS"],
  "results": [
    {
      "market_id": "O25",
      "probability": 0,
      "confidence": 0,
      "pick": "NO",
      "can_publish": false,
      "publish_reason": "❌ Failed 1 check(s): Required field \"xg_prematch\" is missing (xG data unavailable)",
      "failed_checks": [
        "Required field \"xg_prematch\" is missing (xG data unavailable)"
      ]
    }
  ]
}
```

**Validation Checklist**:
- [ ] `footystats_linked` is `false`
- [ ] `link_method` is `"not_found"`
- [ ] `features.source` is `"thesports"` (not "hybrid")
- [ ] `features.xg` is `undefined` (not estimated)
- [ ] `risk_flags` includes `"MISSING_XG"`
- [ ] All xG-dependent markets (O25, BTTS, O35, HOME_O15) have:
  - [ ] `pick` = `"NO"` (not guessed)
  - [ ] `probability` = `0` (not estimated)
  - [ ] `confidence` = `0` (not faked)
  - [ ] `can_publish` = `false`
  - [ ] `failed_checks[]` mentions "Required field \"xg_prematch\" is missing"

**CRITICAL**: NO inference, NO estimation, NO fuzzy matching. Markets must be BLOCKED.

### Scenario 2: Partial FootyStats Data
**Trigger**: FootyStats linked but missing some potentials (e.g., corners_potential = null)

**Expected Behavior**:
- BTTS/O25 markets: Should work (if xG + potentials present)
- CORNERS_O85: Should be blocked if `potentials.corners_over85` is undefined
- Market-specific blocking with clear reason

**Validation Checklist**:
- [ ] Markets with required data → `can_publish: true`
- [ ] Markets missing required data → `can_publish: false` with specific reason

### Scenario 3: Deterministic Match Success
**Trigger**: No stored mapping, but deterministic match finds FootyStats data (exact team names + date window)

**Expected Behavior**:
```json
{
  "source_refs": {
    "footystats_linked": true,
    "link_method": "deterministic_match"
  },
  "features": {
    "source": "hybrid",
    "xg": { "home": 1.65, "away": 1.20, "total": 2.85 }
  }
}
```

**Validation Checklist**:
- [ ] `link_method` is `"deterministic_match"` (not "stored_mapping")
- [ ] `footystats_linked` is `true`
- [ ] `features.source` is `"hybrid"`
- [ ] xG/odds/potentials present

### Scenario 4: Scoring Error (Graceful Degradation)
**Trigger**: One market scoring fails (e.g., calculation error)

**Expected Behavior**:
- Other markets continue to score successfully
- Failed market returns error placeholder:
```json
{
  "market_id": "BTTS",
  "probability": 0,
  "confidence": 0,
  "pick": "NO",
  "risk_flags": ["SCORING_ERROR"],
  "can_publish": false
}
```

**Validation Checklist**:
- [ ] HTTP 200 (not 500) - partial success is OK
- [ ] Other markets in `results[]` have valid data
- [ ] Failed market has `risk_flags: ["SCORING_ERROR"]`

---

## 📋 DRY_RUN Mode

**IMPORTANT**: Week-2A scoring endpoints are **READ-ONLY operations**. They do not modify database state.

### What DRY_RUN Does NOT Affect:
- ✅ `/api/matches/:id/scoring` - Safe to call in production (read-only query)
- ✅ `/api/scoring/markets` - Static data endpoint (no DB writes)

### No DRY_RUN Flag Needed:
Week-2A endpoints are inherently safe. No write operations, no job triggers, no side effects.

---

## 🔍 Staging Verification Steps

### 1. Check Database Connectivity
```bash
# SSH to staging server
ssh user@staging-server

# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ts_matches WHERE status_id IN (2,3,4,5,7);"
# Should return count of live matches
```

### 2. Verify FootyStats Data Availability
```sql
-- Check how many matches have FootyStats linkage
SELECT
  COUNT(*) AS total_matches,
  SUM(CASE WHEN fs.fs_match_id IS NOT NULL THEN 1 ELSE 0 END) AS with_footystats,
  ROUND(AVG(CASE WHEN fs.fs_match_id IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100, 1) AS link_rate_pct
FROM ts_matches m
LEFT JOIN fs_match_stats fs ON fs.ts_match_id = m.id
WHERE m.status_id = 8  -- ENDED matches
  AND m.match_time >= NOW() - INTERVAL '7 days';
```

**Expected**: Link rate should be >50% for recent matches.

### 3. Pick a Real Match for Smoke Test
```sql
-- Find a recent match with FootyStats data
SELECT
  m.external_id AS ts_match_id,
  m.home_team,
  m.away_team,
  m.match_time,
  fs.fs_match_id,
  fs.team_a_xg_prematch,
  fs.team_b_xg_prematch,
  fs.o25_potential,
  fs.btts_potential
FROM ts_matches m
JOIN fs_match_stats fs ON fs.ts_match_id = m.id
WHERE m.status_id = 8  -- ENDED
  AND m.match_time >= NOW() - INTERVAL '3 days'
  AND fs.team_a_xg_prematch IS NOT NULL
ORDER BY m.match_time DESC
LIMIT 1;
```

Copy `ts_match_id` (external_id) and use it in smoke tests.

### 4. Run Full Smoke Test Suite
```bash
export MATCH_ID="<ts_match_id_from_query>"

# 1. Markets list
curl http://staging-server:3000/api/scoring/markets

# 2. All markets
curl "http://staging-server:3000/api/matches/$MATCH_ID/scoring"

# 3. Filtered markets
curl "http://staging-server:3000/api/matches/$MATCH_ID/scoring?markets=O25,BTTS"

# 4. Turkish locale
curl "http://staging-server:3000/api/matches/$MATCH_ID/scoring?locale=tr"

# 5. Not found
curl "http://staging-server:3000/api/matches/nonexistent/scoring"

# 6. Invalid market
curl "http://staging-server:3000/api/matches/$MATCH_ID/scoring?markets=INVALID"
```

### 5. Verify Publish Eligibility Logic
```bash
curl "http://staging-server:3000/api/matches/$MATCH_ID/scoring?markets=O25" | jq '.results[0] | { can_publish, publish_reason, failed_checks, passed_checks }'
```

**Expected**:
- If FootyStats linked + high confidence → `can_publish: true`
- If FootyStats NOT linked → `can_publish: false` with "Required field \"xg_prematch\" is missing"

---

## 📊 Monitoring After Deployment

### Metrics to Watch (First 24h)

1. **Response Times**:
   - `/api/scoring/markets`: <50ms (static data)
   - `/api/matches/:id/scoring`: <500ms (database queries + scoring)

2. **Error Rates**:
   - 404 errors: Normal (invalid match IDs from bots/scrapers)
   - 500 errors: Should be 0% (no uncaught exceptions)

3. **FootyStats Link Rate**:
   - Monitor `footystats_linked: true` vs `false` ratio
   - Expected: 60-80% for recent matches

4. **Publish Eligibility Rate**:
   - Monitor `can_publish: true` rate per market
   - Expected: 50-70% (depends on data quality)

### Logging to Check
```bash
# Check for errors in logs
pm2 logs goalgpt --lines 100 | grep "scoring"

# Look for:
# - "Match not found" (404s - expected if users try invalid IDs)
# - "Scoring error" (should be rare)
# - "FootyStats link: not_found" (informational, not error)
```

---

## 🚀 Rollback Plan

### If Issues Detected

1. **Immediate Rollback**:
```bash
ssh user@production-server
cd /var/www/goalgpt
git checkout main
npm install
npm run build
pm2 restart goalgpt
```

2. **Partial Rollback (Disable Endpoints)**:
```typescript
// In src/routes/index.ts - comment out:
// await registerScoringRoutes(publicAPI);
```

3. **Database Safety**:
Week-2A makes NO database writes. No rollback needed for database state.

---

## ✅ Final Checklist Before Merge

- [ ] All smoke tests passing (7/7 scenarios)
- [ ] No 500 errors in staging
- [ ] FootyStats link rate >50%
- [ ] Publish eligibility logic correct (blocks when data missing)
- [ ] Documentation accurate (PR description, sample responses)
- [ ] Test suite passing (17/17 Week-2A tests)
- [ ] No console.logs or debug code
- [ ] PM approval obtained

---

## 📝 Post-Merge Actions

### Immediate (Within 1 Hour)
- [ ] Monitor staging logs for errors
- [ ] Run smoke tests on production
- [ ] Verify `/api/scoring/markets` endpoint live
- [ ] Test one real match ID on production

### Within 24 Hours
- [ ] Check FootyStats link rate metric
- [ ] Review publish eligibility rate per market
- [ ] Monitor response time P95
- [ ] Update MASTER-APP-GOALGPT-PLAN.md (Phase 2A complete)

### Within 1 Week
- [ ] Integrate with Telegram bots (Week-2B)
- [ ] Add caching layer if needed
- [ ] Backtest scoring algorithm with historical data

---

**Author**: GoalGPT Team
**Date**: 2026-01-29
**Status**: ✅ Ready for Merge
**PR**: https://github.com/nikolatesla-777/new-goalgpt/pull/4
