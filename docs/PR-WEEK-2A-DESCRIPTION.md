# PR: Week-2A - Composite Scoring Pipeline (TheSports + FootyStats)

**Branch**: `phase-2A/thesports-scoring-endpoint` → `main`
**Type**: Feature
**Status**: Ready for Review

---

## 📋 Summary

Implements a **production-ready composite scoring pipeline** that merges TheSports (identity + settlement data) with FootyStats (predictive features) to enable match scoring for all 7 markets.

**Key Innovation**: TheSports alone cannot provide xG, odds, or potentials. This PR solves that limitation by implementing a deterministic linking system (NO fuzzy matching) that merges data from both sources.

---

## 🎯 What's Included

### Phase 1: Foundation (Previously Completed)
- ✅ Canonical `ScoringFeatures` contract
- ✅ TheSports→ScoringFeatures adapter
- ✅ Field-by-field mapping documentation

### Phase 2: Composite Pipeline (This PR)
- ✅ Composite feature builder service
- ✅ Three-tier deterministic linking (NO fuzzy matching)
- ✅ marketScorer metadata enhancement
- ✅ Strict canPublish validation
- ✅ API endpoint `/api/matches/:id/scoring`
- ✅ Comprehensive test coverage (17 tests)
- ✅ Complete documentation

---

## 🔗 Linking Strategy (3-Tier Deterministic)

**CRITICAL**: NO fuzzy matching allowed. Only exact deterministic links.

### Method 1: Stored Mapping (Fastest)
```sql
SELECT * FROM fs_match_stats WHERE ts_match_id = '<uuid>' LIMIT 1
```
- **Pros**: Instant, reliable (pre-established mapping)
- **Usage**: Historical matches already mapped

### Method 2: Deterministic Match (Fallback)
```sql
SELECT * FROM fs_match_stats fs
JOIN ts_matches m ON fs.ts_match_id = m.id
WHERE m.match_time >= $1  -- matchTime ± 2 hours
  AND m.match_time <= $2
  AND LOWER(m.home_team) = LOWER($3)  -- EXACT normalized team name
  AND LOWER(m.away_team) = LOWER($4)
LIMIT 1
```
- **Pros**: Catches recent matches not yet in mapping table
- **Constraints**: EXACT team name match (case-insensitive)

### Method 3: Not Found
- `footystats_linked: false`
- All FootyStats fields → `undefined`
- Risk flags: `MISSING_XG`, `MISSING_ODDS`, `MISSING_POTENTIALS`
- Markets blocked from publishing

---

## 🛡️ Safety Rules

### 1. NO Fuzzy Matching ❌
```typescript
// ❌ WRONG: Fuzzy team name match
if (similarity(team1, team2) > 0.8) { link(); }

// ✅ CORRECT: Exact match only
if (LOWER(team1) === LOWER(team2)) { link(); }
```

### 2. NO Inference ❌
```typescript
// ❌ WRONG: Estimate xG from goals
if (xg === undefined) { xg = estimateFromGoals(); }

// ✅ CORRECT: Leave as undefined
if (xg === undefined) { /* Market blocked */ }
```

### 3. Required Fields = BLOCKED ❌
```typescript
// ❌ WRONG: Publish O25 without xG
if (xg === undefined) { return { pick: 'YES', prob: 0.65 }; }

// ✅ CORRECT: Block publish
if (xg === undefined) {
  return {
    can_publish: false,
    publish_reason: 'Required field "xg_prematch" is missing'
  };
}
```

---

## 📡 New Endpoints

### 1. GET /api/matches/:id/scoring
Score a specific match for requested markets.

**Query Parameters**:
- `markets` (optional): Comma-separated (e.g., `O25,BTTS`)
- `locale` (optional): `tr|en` (default: `en`)

**Example**:
```bash
curl "http://localhost:3000/api/matches/12345678/scoring?markets=O25,BTTS&locale=tr"
```

**Response**: See `docs/SAMPLE-SCORING-RESPONSE.md`

### 2. GET /api/scoring/markets
Get list of all 7 available markets with display names.

**Example**:
```bash
curl http://localhost:3000/api/scoring/markets
```

**Response**:
```json
{
  "markets": [
    { "id": "O25", "display_name": "Over 2.5 Goals", "display_name_tr": "2.5 Üst Gol" },
    { "id": "BTTS", "display_name": "Both Teams To Score", "display_name_tr": "Karşılıklı Gol" },
    ...
  ]
}
```

---

## 🧪 How to Test

### Run Tests
```bash
# Feature builder tests (7 tests)
npm test src/__tests__/featureBuilder.test.ts

# Scoring routes tests (10 tests)
npm test src/__tests__/scoring.routes.test.ts

# Full test suite (310 tests)
npm test
```

**Expected Results**:
- ✅ featureBuilder: 7/7 passing
- ✅ scoring.routes: 10/10 passing
- ✅ Full suite: 306/310 passing (4 network-related failures, not related to this PR)

### Test Endpoint
```bash
# Start server
npm run dev

# Test all markets
curl http://localhost:3000/api/matches/<match_id>/scoring | jq

# Filter markets
curl "http://localhost:3000/api/matches/<match_id>/scoring?markets=O25,BTTS" | jq

# Turkish locale
curl "http://localhost:3000/api/matches/<match_id>/scoring?locale=tr" | jq

# Get available markets
curl http://localhost:3000/api/scoring/markets | jq
```

**Sample Responses**: See `docs/SAMPLE-SCORING-RESPONSE.md`

---

## 📊 Files Changed

### Created (4 files)
1. `src/services/scoring/featureBuilder.service.ts` (460 lines)
   - Composite feature builder
   - Three-tier deterministic linking
   - Source tracking

2. `src/routes/scoring.routes.ts` (340 lines)
   - `/api/matches/:id/scoring` endpoint
   - `/api/scoring/markets` endpoint
   - Markets filter & locale support

3. `src/__tests__/featureBuilder.test.ts` (370 lines)
   - 7 test cases
   - All linking strategies covered
   - Edge cases (not found, invalid data, partial data)

4. `src/__tests__/scoring.routes.test.ts` (310 lines)
   - 10 test cases
   - API validation, filters, error handling
   - Publish eligibility integration

### Modified (5 files)
1. `src/services/scoring/marketScorer.service.ts`
   - Exported `MarketId` type
   - Added `adaptScoringFeaturesToFootyStats()` adapter
   - Metadata already complete (lambda, probs, odds)

2. `src/services/scoring/publishEligibility.ts`
   - Added `checkDataRequirements()` function
   - Validates required fields from market_registry
   - Blocks publish if required data missing

3. `src/routes/index.ts`
   - Registered scoring routes in PUBLIC API GROUP
   - Added import for `registerScoringRoutes`

4. `docs/THESPORTS_TO_SCORING_MAPPING.md`
   - Added "Composite Pipeline" section (150 lines)
   - Updated version to 2.0.0

5. `docs/WEEK-2A-PHASE-2-COMPLETION-REPORT.md`
   - Comprehensive completion report
   - Implementation details
   - Testing instructions

### Documentation (New)
- `docs/SAMPLE-SCORING-RESPONSE.md` - Sample API responses (4 scenarios)

**Total**: 9 files (5 new, 5 modified) | ~2,100 lines

---

## 🚨 Breaking Changes?

### Exported Types
**Breaking**: `MarketId` type is now exported from `marketScorer.service.ts`
- **Before**: Private type
- **After**: Public export
- **Impact**: Minimal - only affects internal code, not external API
- **Migration**: None needed

### API Endpoints (NEW)
**Non-Breaking**: All endpoints are NEW, no existing endpoints modified
- `GET /api/matches/:id/scoring` (NEW)
- `GET /api/scoring/markets` (NEW)

### Database Schema
**Non-Breaking**: No database changes
- Uses existing `ts_matches` table
- Uses existing `fs_match_stats` table
- No migrations needed

---

## 🎯 Test Coverage

### Unit Tests
- ✅ 7 featureBuilder tests (all linking strategies)
- ✅ 10 scoring routes tests (API validation, filters, errors)
- ✅ Edge cases: not found, invalid data, partial data

### Integration Points
- ✅ TheSports adapter integration
- ✅ FootyStats linking (deterministic)
- ✅ marketScorer integration
- ✅ publishEligibility integration

### Error Handling
- ✅ Match not found (404)
- ✅ Invalid market IDs (400)
- ✅ Missing required data (blocked)
- ✅ Scoring errors (graceful degradation)
- ✅ Fatal errors (500)

---

## 📝 Known Limitations

1. **FootyStats Data Availability**: Not all matches have FootyStats data
   - **Impact**: Markets requiring xG/odds/potentials will be blocked
   - **Mitigation**: Clear error messages, risk flags, publish blocking

2. **Deterministic Linking Constraints**: Only exact team name matches
   - **Impact**: Team name variations may cause link failures
   - **Mitigation**: Relies on stored mapping table for most matches

3. **Test Suite**: 4 network-related test failures (not related to this PR)
   - **Impact**: None on scoring functionality
   - **Status**: Pre-existing issue in `pr5b-migration.test.ts`

---

## ✅ Acceptance Checklist

- [x] All Week-2A tests passing (17/17)
- [x] No regressions in existing tests (306/310 passing, 4 unrelated)
- [x] Documentation complete (mapping docs, sample responses, completion report)
- [x] API endpoints functional (2 new endpoints)
- [x] Safety rules enforced (NO fuzzy matching, NO inference, strict validation)
- [x] Publish eligibility integrated
- [x] Source tracking implemented
- [x] Comprehensive error handling

---

## 🚀 What's Next (Post-Merge)

### Short-term
- Integrate with Telegram bot daily lists
- Add caching for frequently requested matches
- Monitor production performance

### Long-term
- Live match scoring (real-time xG updates)
- Batch scoring endpoint
- Historical scoring result storage

---

## 📚 Additional Documentation

- `docs/THESPORTS_TO_SCORING_MAPPING.md` - Field mapping reference
- `docs/WEEK-2A-PROGRESS-REPORT.md` - Phase 1 progress
- `docs/WEEK-2A-PHASE-2-COMPLETION-REPORT.md` - Phase 2 completion
- `docs/SAMPLE-SCORING-RESPONSE.md` - API response samples

---

**Author**: GoalGPT Team
**Date**: 2026-01-29
**Branch**: phase-2A/thesports-scoring-endpoint
**Status**: ✅ Ready for Merge
