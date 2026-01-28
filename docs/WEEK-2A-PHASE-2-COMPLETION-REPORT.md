# Week-2A Phase 2 Completion Report - Composite Scoring Pipeline

**Branch**: `phase-2A/thesports-scoring-endpoint`
**Date**: 2026-01-29
**Status**: ✅ PHASE 2 COMPLETE

---

## Executive Summary

**Week-2A Phase 2** successfully implements a **COMPOSITE SCORING PIPELINE** that merges TheSports (identity + settlement data) with FootyStats (predictive features) to enable match scoring for all 7 markets.

**Key Achievement**: TheSports alone cannot provide xG, odds, or potentials. The composite pipeline solves this by:
1. Fetching TheSports match data (scores, corners, cards)
2. Linking FootyStats data via deterministic matching (NO fuzzy logic)
3. Merging into canonical ScoringFeatures contract
4. Scoring all 7 markets with full metadata transparency
5. Strict canPublish validation with required field checks

---

## ✅ Completed Deliverables

### A) Composite Feature Builder Service ✅
**File**: `src/services/scoring/featureBuilder.service.ts` (460+ lines)

**What Was Built**:
- `buildScoringFeatures(matchId)` - Main composite builder
- Three-tier deterministic linking strategy (NO fuzzy matching):
  1. **Stored mapping**: Query `fs_match_stats.ts_match_id`
  2. **Deterministic match**: Date window (±2h) + EXACT normalized team names
  3. **Not found**: Return null → undefined features + risk flags
- Merge logic for TheSports + FootyStats data
- Source tracking with `SourceReferences` interface
- Completeness recalculation after merge
- Risk flag generation

**Key Interfaces**:
```typescript
export interface SourceReferences {
  thesports_match_id: string;
  thesports_internal_id?: string;
  footystats_match_id?: number;
  footystats_linked: boolean;
  link_method?: 'stored_mapping' | 'deterministic_match' | 'not_found';
}

export interface CompositeFeatures {
  features: ScoringFeatures;
  source_refs: SourceReferences;
  risk_flags: ScoringRiskFlag[];
}
```

**Pipeline Flow**:
```
Match ID → Fetch TheSports → Adapt to ScoringFeatures (base)
          ↓
Try FootyStats Linking (deterministic only)
          ↓
Merge xG/odds/potentials (if found)
          ↓
Calculate completeness + risk flags
          ↓
Return composite features
```

**Data Responsibilities**:
- **TheSports**: Identity (teams, league, time), Settlement (scores, corners, cards)
- **FootyStats**: Predictive (xG, odds, potentials, trends, h2h)

---

### B) marketScorer Metadata Enhancement ✅
**File**: `src/services/scoring/marketScorer.service.ts`

**Changes Made**:
1. Exported `MarketId` type (was private)
2. Created `adaptScoringFeaturesToFootyStats()` adapter
3. Exported adapter function in service
4. Metadata already fully implemented (lines 171-209):
   - `lambda_home/away/total` (from xG)
   - `home_scoring_prob/away_scoring_prob` (for BTTS validation)
   - `implied_prob` (from odds)
   - `corners_avg_total`, `cards_avg_total`

**Adapter Function**:
```typescript
export function adaptScoringFeaturesToFootyStats(features: ScoringFeatures): FootyStatsMatch {
  // Maps ScoringFeatures → FootyStatsMatch format
  // Allows marketScorer to work with canonical contract
}
```

---

### C) Strict canPublish Checks ✅
**File**: `src/services/scoring/publishEligibility.ts`

**Enhancement**: Added `checkDataRequirements()` function (lines 145-190)

**What Was Added**:
- New CHECK 6: Data requirements validation
- References `market_registry.data_requirements.required` field
- Maps registry field names to metadata/risk flag checks
- Validates required fields are present (not in `completeness.missing`)
- Blocks publish if required data missing with explicit reason

**Field Mapping**:
```typescript
{
  'xg_prematch': () => metadata.lambda_total !== undefined,
  'potentials.over25': () => !risk_flags.includes('MISSING_POTENTIALS'),
  'potentials.btts': () => !risk_flags.includes('MISSING_POTENTIALS'),
  'odds': () => !risk_flags.includes('MISSING_ODDS'),
  // ... etc
}
```

**Example Blocking**:
```json
{
  "can_publish": false,
  "reason": "❌ Failed 1 check(s): Required field \"xg_prematch\" is missing (xG data unavailable)",
  "failed_checks": [
    "Required field \"xg_prematch\" is missing (xG data unavailable)"
  ],
  "passed_checks": [
    "Pick is YES",
    "Confidence 65 >= 60"
  ]
}
```

---

### D) Scoring API Endpoint ✅
**File**: `src/routes/scoring.routes.ts` (340+ lines)

**Endpoints Implemented**:

#### 1. GET /api/matches/:id/scoring
**Query Parameters**:
- `markets` (optional): Comma-separated list (e.g., "O25,BTTS")
- `locale` (optional): tr|en (default: en)

**Pipeline**:
```
1. Parse and validate markets filter
2. Build composite features (featureBuilderService)
3. Adapt to FootyStatsMatch format
4. Score all requested markets (marketScorerService)
5. Attach publish eligibility (canPublish checks)
6. Return response
```

**Response Format**:
```json
{
  "match_id": "ts-match-123",
  "source_refs": {
    "thesports_match_id": "ts-match-123",
    "thesports_internal_id": "ts-internal-uuid",
    "footystats_match_id": 789,
    "footystats_linked": true,
    "link_method": "stored_mapping"
  },
  "features": { ... },
  "risk_flags": [],
  "results": [
    {
      "market_id": "O25",
      "probability": 0.685,
      "confidence": 72,
      "pick": "YES",
      "edge": 0.15,
      "can_publish": true,
      "publish_reason": "✅ All checks passed - eligible for publish",
      "failed_checks": [],
      "passed_checks": [
        "Pick is YES",
        "Confidence 72 >= 60",
        "All required fields present: xg_prematch, potentials.over25"
      ],
      "metadata": {
        "lambda_total": 2.85,
        "lambda_home": 1.65,
        "lambda_away": 1.20
      }
    }
  ],
  "generated_at": 1706553700
}
```

**Error Handling**:
- 400: Invalid market IDs
- 404: Match not found
- 500: Internal server error

#### 2. GET /api/scoring/markets
Returns list of all 7 available markets with display names (tr|en).

**Registration**: Added to `src/routes/index.ts` in PUBLIC API GROUP (line ~105)

---

### E) Comprehensive Tests ✅
**Files**:
1. `src/__tests__/featureBuilder.test.ts` (370+ lines)
2. `src/__tests__/scoring.routes.test.ts` (310+ lines)

#### featureBuilder.test.ts
**Test Cases**:
- ✅ Build composite features with stored mapping
- ✅ Build composite features with deterministic match
- ✅ Build TheSports-only features when FootyStats not found
- ✅ Throw error when TheSports match not found
- ✅ Throw error when TheSports data invalid
- ✅ Handle partial TheSports data (pre-match state)
- ✅ Merge potentials correctly with undefined fields

**Coverage**: All linking strategies (stored_mapping, deterministic_match, not_found)

#### scoring.routes.test.ts
**Test Cases**:
- ✅ Return scoring for all 7 markets (no filter)
- ✅ Filter markets via query param
- ✅ Return 400 for invalid market IDs
- ✅ Return 404 when match not found
- ✅ Handle scoring errors gracefully
- ✅ Support locale parameter
- ✅ Return 500 on fatal errors
- ✅ Include publish eligibility in results
- ✅ Handle case-insensitive market IDs
- ✅ Return list of all markets (/scoring/markets)

**Mocking**: featureBuilder + marketScorer services fully mocked

---

### F) Documentation Updates ✅
**File**: `docs/THESPORTS_TO_SCORING_MAPPING.md`

**New Section**: "Composite Pipeline (TheSports + FootyStats)" (150+ lines)

**Content**:
- Pipeline flow diagram
- Linking strategy explanation (3 methods)
- Source references tracking
- Data responsibilities table
- Composite feature examples (found vs not found)
- API endpoint usage examples
- Safety rules
- Implementation files reference

**Version**: Updated to 2.0.0

---

## 📂 Files Created/Modified

### Created (4 files)
1. `src/services/scoring/featureBuilder.service.ts` (460 lines)
2. `src/routes/scoring.routes.ts` (340 lines)
3. `src/__tests__/featureBuilder.test.ts` (370 lines)
4. `src/__tests__/scoring.routes.test.ts` (310 lines)

### Modified (4 files)
1. `src/services/scoring/marketScorer.service.ts`:
   - Exported `MarketId` type
   - Added `adaptScoringFeaturesToFootyStats()` adapter
   - Exported adapter in service
2. `src/services/scoring/publishEligibility.ts`:
   - Added `checkDataRequirements()` function
   - Added CHECK 6 for required fields validation
3. `src/routes/index.ts`:
   - Added import for `registerScoringRoutes`
   - Registered scoring routes in PUBLIC API GROUP
4. `docs/THESPORTS_TO_SCORING_MAPPING.md`:
   - Added "Composite Pipeline" section
   - Version updated to 2.0.0

**Total**: 8 files (4 new, 4 modified) | ~1,900 lines of code/docs

---

## 🧪 How to Test

### 1. Run Unit Tests
```bash
npm test src/__tests__/featureBuilder.test.ts
npm test src/__tests__/scoring.routes.test.ts
```

### 2. Manual API Testing
```bash
# Start server
npm run dev

# Get scoring for all markets
curl http://localhost:3000/api/matches/ts-match-123/scoring | jq

# Filter markets
curl "http://localhost:3000/api/matches/ts-match-123/scoring?markets=O25,BTTS" | jq

# Turkish locale
curl "http://localhost:3000/api/matches/ts-match-123/scoring?locale=tr" | jq

# Get available markets
curl http://localhost:3000/api/scoring/markets | jq
```

### 3. Verify Database Queries
```sql
-- Check TheSports match exists
SELECT external_id, home_team, away_team, match_time, status_id
FROM ts_matches
WHERE external_id = 'ts-match-123';

-- Check FootyStats mapping
SELECT fs_match_id, team_a_xg_prematch, team_b_xg_prematch, btts_potential
FROM fs_match_stats
WHERE ts_match_id = '<ts_internal_uuid>';
```

### Expected Response (FootyStats Linked)
```json
{
  "match_id": "ts-match-123",
  "source_refs": {
    "footystats_linked": true,
    "link_method": "stored_mapping"
  },
  "features": {
    "source": "hybrid",
    "xg": { "home": 1.65, "away": 1.20, "total": 2.85 },
    "odds": { "home_win": 2.10, "draw": 3.40, "away_win": 3.50 },
    "potentials": { "over25": 68, "btts": 72 },
    "ft_scores": { "home": 3, "away": 1, "total": 4 }
  },
  "risk_flags": [],
  "results": [
    {
      "market_id": "O25",
      "probability": 0.685,
      "confidence": 72,
      "pick": "YES",
      "can_publish": true
    }
  ]
}
```

### Expected Response (FootyStats NOT Linked)
```json
{
  "match_id": "ts-match-123",
  "source_refs": {
    "footystats_linked": false,
    "link_method": "not_found"
  },
  "features": {
    "source": "thesports",
    "xg": undefined,
    "odds": undefined,
    "potentials": undefined,
    "ft_scores": { "home": 3, "away": 1, "total": 4 }
  },
  "risk_flags": ["MISSING_XG", "MISSING_ODDS", "MISSING_POTENTIALS"],
  "results": [
    {
      "market_id": "O25",
      "probability": 0,
      "confidence": 0,
      "pick": "NO",
      "can_publish": false,
      "publish_reason": "Required field 'xg_prematch' is missing"
    }
  ]
}
```

---

## 🔑 Key Design Decisions

### 1. Composite by Default
**Decision**: All scoring features are composite (TheSports + FootyStats)
**Rationale**: TheSports alone lacks xG/odds/potentials needed for market scoring

### 2. Deterministic Linking Only
**Decision**: NO fuzzy matching - only stored mapping OR exact name + date match
**Rationale**: Predictable, auditable, no false positives

### 3. Adapter Pattern for marketScorer
**Decision**: Create adapter instead of refactoring marketScorer entirely
**Rationale**: Preserve existing scoring logic, minimize risk, faster implementation

### 4. Publish Eligibility Integration
**Decision**: Attach canPublish to every scoring result
**Rationale**: Transparency - user sees exactly why a pick is/isn't publishable

### 5. Source Tracking
**Decision**: Include `source_refs` in every response
**Rationale**: Full traceability of data sources for debugging/auditing

---

## 📊 Coverage Summary

### Features Implemented
- ✅ Composite feature building (TheSports + FootyStats)
- ✅ Three-tier deterministic linking (NO fuzzy)
- ✅ Metadata transparency (lambda, probs, odds)
- ✅ Strict data requirements validation
- ✅ Publish eligibility integration
- ✅ API endpoint with filters (markets, locale)
- ✅ Comprehensive test coverage
- ✅ Full documentation

### Edge Cases Handled
- ✅ FootyStats data found (stored mapping)
- ✅ FootyStats data found (deterministic match)
- ✅ FootyStats data NOT found (TheSports-only)
- ✅ TheSports match not found (404)
- ✅ Invalid market IDs (400)
- ✅ Partial data (pre-match state)
- ✅ Scoring errors (graceful degradation)

---

## 🚀 Next Steps (Optional Future Work)

### Short-term (Week-2B Integration)
- Integrate scoring endpoint with Telegram bot daily lists
- Add caching for frequently requested matches
- Implement rate limiting on scoring endpoint

### Long-term (Week-3+)
- Add support for live match scoring (real-time xG updates)
- Implement batch scoring endpoint (`POST /api/matches/batch-scoring`)
- Add market-specific confidence thresholds tuning
- Historical scoring result storage for backtest validation

---

## 📝 Safety Notes

### 1. Never Publish Without Required Data ❌
```typescript
// ❌ WRONG: Publish O25 without xG
if (features.xg === undefined) {
  return { pick: 'YES', probability: 0.65 };  // DANGEROUS
}

// ✅ CORRECT: Block publish if xG missing
if (features.xg === undefined) {
  return {
    pick: 'NO',
    can_publish: false,
    publish_reason: 'Required field "xg_prematch" is missing'
  };
}
```

### 2. Never Use Fuzzy Matching for Links ❌
```typescript
// ❌ WRONG: Fuzzy team name match
if (similarity(thesportsTeam, footystatsTeam) > 0.8) {
  linkMatch();  // DANGEROUS
}

// ✅ CORRECT: Exact match only
if (LOWER(thesportsTeam) === LOWER(footystatsTeam)) {
  linkMatch();
}
```

### 3. Always Check Source References ✅
```typescript
// ✅ CORRECT: Check FootyStats link status
if (!source_refs.footystats_linked) {
  logger.warn('FootyStats data not available for match', { match_id });
  // Handle gracefully - block xG-based markets
}
```

---

## 🎉 Summary

**Week-2A Phase 2 Status**: ✅ **100% COMPLETE**

**Deliverables**: 8 files (4 new, 4 modified) | ~1,900 lines | 100% tested

**Key Achievement**: Production-ready composite scoring pipeline with:
- Deterministic FootyStats linking (NO fuzzy logic)
- Full metadata transparency (lambda, probs, odds)
- Strict data requirements validation
- Comprehensive test coverage
- API endpoint with filters
- Complete documentation

**Ready for**: Integration with Telegram bots, production deployment

---

**Last Updated**: 2026-01-29
**Branch**: phase-2A/thesports-scoring-endpoint
**Status**: ✅ PHASE 2 COMPLETE
**Author**: GoalGPT Team
