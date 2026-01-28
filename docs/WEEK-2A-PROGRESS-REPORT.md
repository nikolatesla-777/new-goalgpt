# Week-2A Progress Report - TheSports Scoring Adapter

**Branch**: `phase-2A/thesports-scoring-endpoint`
**Date**: 2026-01-29
**Status**: Phase 1 Complete (Core Foundation)

---

## ✅ Completed Tasks

### 1. Canonical ScoringFeatures Contract ✅
**Deliverable**: `src/types/scoringFeatures.ts` (300+ lines)

**What Was Created**:
- ✅ **ScoringFeatures interface** - Single source of truth for all scoring operations
- ✅ **Completeness tracking** - `present[]` and `missing[]` field lists
- ✅ **Helper functions** - `calculateCompleteness()`, `generateRiskFlags()`
- ✅ **Type definitions** for all data structures:
  - `XGData` - Expected Goals (home, away, total)
  - `OddsData` - 1X2 odds (home_win, draw, away_win)
  - `PotentialsData` - Market probabilities (over25, btts, etc.)
  - `FullTimeScores`, `HalfTimeScores`, `CornersData`, `CardsData`
  - `TeamInfo`, `LeagueInfo`

**Key Features**:
- 100% optional fields (undefined if not available)
- Source tracking (`'thesports'` | `'footystats'` | `'hybrid'`)
- Risk flag generation (10 flag types)
- NO inference - missing data = undefined

---

### 2. TheSports→ScoringFeatures Adapter ✅
**Deliverable**: `src/adapters/thesportsMatch.adapter.ts` (450+ lines)

**What Was Created**:
- ✅ **TheSportsMatchAdapter class** - 100% deterministic mapping
- ✅ **`adapt()` method** - Maps TheSports data to ScoringFeatures
- ✅ **`validate()` method** - Checks required fields before adaptation
- ✅ **Explicit field mapping** - No fuzzy matching, no guessing
- ✅ **Computed totals** - Only calculate if ALL parts exist
- ✅ **Completeness tracking** - Automatically tracks present/missing fields

**Mapping Rules Implemented**:
```typescript
// ✅ Direct mapping (no transformation)
features.match_id = thesportsData.external_id;
features.kickoff_ts = thesportsData.match_time;

// ✅ Computed totals (only if both parts exist)
if (home !== null && away !== null) {
  total = home + away;
} else {
  total = undefined;  // ❌ Don't guess
}

// ✅ Missing data = undefined (no fallbacks)
features.xg = undefined;  // TheSports doesn't provide xG
features.odds = undefined;  // TheSports doesn't provide odds
features.potentials = undefined;  // TheSports doesn't provide potentials
```

**TheSports Data Mapped**:
- ✅ Match identifiers (external_id, team IDs, league ID)
- ✅ Team names (home_team, away_team)
- ✅ Match timing (match_time, status_id)
- ✅ Full-time scores (home_score_display, away_score_display)
- ✅ Half-time scores (home_scores[1], away_scores[1])
- ✅ Corners (home_scores[5], away_scores[5])
- ✅ Cards (home_scores[3], away_scores[4])

**TheSports Limitations (marked as undefined)**:
- ❌ xG (Expected Goals) - Only FootyStats has this
- ❌ Odds - Not in TheSports match data
- ❌ Potentials (market probabilities) - Only FootyStats has this
- ❌ Team form statistics - Not in simple match query
- ❌ H2H statistics - Not in simple match query
- ❌ League statistics - Not in simple match query

---

### 3. Field-by-Field Mapping Documentation ✅
**Deliverable**: `docs/THESPORTS_TO_SCORING_MAPPING.md` (500+ lines)

**What Was Documented**:
- ✅ **Complete field mapping table** - 30+ fields mapped
- ✅ **Array structure reference** - `home_scores[]` / `away_scores[]` indexes explained
- ✅ **Computation rules** - Exact formulas for totals
- ✅ **Completeness tracking examples** - Real-world output samples
- ✅ **Risk flags table** - Impact on scoring per flag
- ✅ **Validation rules** - Required fields checklist
- ✅ **Safety notes** - Critical rules for developers
- ✅ **Usage examples** - Copy-paste ready code samples

**Documentation Highlights**:
```markdown
| ScoringFeatures Field | TheSports Source | Type | Notes |
|----------------------|------------------|------|-------|
| xg | ❌ NOT AVAILABLE | undefined | TheSports doesn't provide xG data |
| odds | ❌ NOT AVAILABLE | undefined | TheSports doesn't provide odds |
| ft_scores.home | home_score_display | number | Only if status_id = 8 (ENDED) |
| ht_scores.home | home_scores[1] | number | Array index 1 = half-time score |
| corners.home | home_scores[5] | number | Array index 5 = corners |
| cards.home | home_scores[3] | number | Array index 3 = yellow cards |
```

---

## ⏳ Remaining Tasks (Week-2A)

### 4. Update marketScorer Metadata
**Status**: Pending
**Deliverable**: Update `src/services/scoring/marketScorer.service.ts`

**What Needs to Be Done**:
- Add full metadata output to `ScoringResult`:
  - `lambda_home`, `lambda_away`, `lambda_total` (only if xg exists)
  - `home_scoring_prob`, `away_scoring_prob` (only if lambda exists)
  - `implied_prob` per market (only if odds exists)
- Ensure metadata is populated in every scoring result
- Add metadata to scoring endpoint response

**Expected Changes**:
```typescript
export interface ScoringResult {
  // ... existing fields ...

  // NEW: Full metadata for transparency
  metadata: {
    lambda_home?: number;         // xG home (if available)
    lambda_away?: number;         // xG away (if available)
    lambda_total?: number;        // xG total (if available)
    home_scoring_prob?: number;   // P(home scores) for BTTS (if xg available)
    away_scoring_prob?: number;   // P(away scores) for BTTS (if xg available)
    implied_prob?: number;        // Implied probability from odds (if odds available)
    corners_avg_total?: number;   // Corners average total (if form available)
    cards_avg_total?: number;     // Cards average total (if form available)
  };
}
```

---

### 5. Strict canPublish Checks
**Status**: Pending
**Deliverable**: Update `src/services/scoring/publishEligibility.ts`

**What Needs to Be Done**:
- Block publish if required data is missing (no workarounds)
- Add clear reason messages for blocking
- Add risk flags to blocking logic

**Market Requirements**:
```typescript
const marketRequirements = {
  O25: ['xg'],              // ❌ Blocked if xg missing
  BTTS: ['xg'],             // ❌ Blocked if xg missing
  HT_O05: ['ht_scores'],    // ❌ Blocked if ht_scores missing
  O35: ['xg'],              // ❌ Blocked if xg missing
  HOME_O15: ['xg'],         // ❌ Blocked if xg missing
  CORNERS_O85: ['corners'], // ❌ Blocked if corners missing
  CARDS_O25: ['cards'],     // ❌ Blocked if cards missing
};
```

---

### 6. Create /api/matches/:id/scoring Endpoint
**Status**: Pending
**Deliverable**: `src/routes/scoring.routes.ts` (NEW)

**What Needs to Be Done**:
```typescript
/**
 * GET /api/matches/:id/scoring
 *
 * Query params:
 * - markets (optional): comma-separated list (e.g., "O25,BTTS")
 *
 * Response:
 * {
 *   match_id: string,
 *   features: ScoringFeatures,
 *   results: ScoringResult[],
 *   generated_at: number
 * }
 */
router.get('/matches/:id/scoring', async (req, res) => {
  // 1. Load match data from TheSports backend
  const matchData = await matchService.getMatchById(req.params.id);

  // 2. Validate data
  const validation = thesportsMatchAdapter.validate(matchData);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid match data',
      details: validation.errors,
    });
  }

  // 3. Adapt to ScoringFeatures
  const { features, risk_flags } = thesportsMatchAdapter.adapt(matchData);

  // 4. Score markets
  const markets = req.query.markets ? req.query.markets.split(',') : ALL_MARKETS;
  const results = await Promise.all(
    markets.map(marketId => marketScorer.scoreMarket(marketId, features))
  );

  // 5. Return response
  res.json({
    match_id: features.match_id,
    features,
    risk_flags,
    results,
    generated_at: Date.now(),
  });
});
```

---

### 7. Write Adapter Tests
**Status**: Pending
**Deliverable**: `src/__tests__/thesportsMatch.adapter.test.ts` (NEW)

**What Needs to Be Done**:
- Use real TheSports response fixtures (from existing code)
- Test exact field mapping (no approximations)
- Test completeness tracking (present/missing lists)
- Test risk flag generation
- Test validation rules (required fields)
- Test computed totals (only if both parts exist)
- Test array index mapping (corners, cards, HT scores)

**Test Cases**:
```typescript
describe('TheSportsMatchAdapter', () => {
  describe('adapt()', () => {
    test('maps match identifiers correctly', () => {
      const thesportsData = { external_id: '12345', ... };
      const { features } = adapter.adapt(thesportsData);
      expect(features.match_id).toBe('12345');
    });

    test('marks xG as undefined (TheSports limitation)', () => {
      const thesportsData = { ... };
      const { features, risk_flags } = adapter.adapt(thesportsData);
      expect(features.xg).toBeUndefined();
      expect(risk_flags).toContain('MISSING_XG');
    });

    test('computes FT total only if both scores exist', () => {
      const thesportsData = {
        status_id: 8,
        home_score_display: 3,
        away_score_display: 1,
      };
      const { features } = adapter.adapt(thesportsData);
      expect(features.ft_scores).toEqual({
        home: 3,
        away: 1,
        total: 4,  // ✅ Computed
      });
    });

    test('returns undefined if FT score missing', () => {
      const thesportsData = {
        status_id: 8,
        home_score_display: 3,
        away_score_display: null,  // ❌ Missing
      };
      const { features } = adapter.adapt(thesportsData);
      expect(features.ft_scores).toBeUndefined();  // ❌ Don't guess
    });

    test('maps corners from array index 5', () => {
      const thesportsData = {
        home_scores: [0, 2, 0, 1, 0, 7],  // index 5 = 7 corners
        away_scores: [0, 0, 0, 0, 1, 4],  // index 5 = 4 corners
      };
      const { features } = adapter.adapt(thesportsData);
      expect(features.corners).toEqual({
        home: 7,
        away: 4,
        total: 11,
      });
    });

    test('tracks completeness correctly', () => {
      const thesportsData = { ... };
      const { features } = adapter.adapt(thesportsData);
      expect(features.completeness.present).toContain('ft_scores');
      expect(features.completeness.missing).toContain('xg');
      expect(features.completeness.missing).toContain('odds');
    });
  });

  describe('validate()', () => {
    test('rejects missing external_id', () => {
      const thesportsData = { home_team: 'Barcelona', ... };
      const validation = adapter.validate(thesportsData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required field: external_id');
    });
  });
});
```

---

## 📂 Files Created

### New Files (3)
1. `src/types/scoringFeatures.ts` (300+ lines)
2. `src/adapters/thesportsMatch.adapter.ts` (450+ lines)
3. `docs/THESPORTS_TO_SCORING_MAPPING.md` (500+ lines)

### Files To Create (3)
4. `src/routes/scoring.routes.ts` (endpoint)
5. `src/__tests__/thesportsMatch.adapter.test.ts` (tests)
6. `docs/WEEK-2A-PR-DESCRIPTION.md` (PR documentation)

### Files To Modify (2)
7. `src/services/scoring/marketScorer.service.ts` (metadata enhancement)
8. `src/services/scoring/publishEligibility.ts` (strict checks)

---

## 🧪 How to Test (When Complete)

### Step 1: Unit Tests
```bash
npm test src/__tests__/thesportsMatch.adapter.test.ts
```

### Step 2: Endpoint Test (curl)
```bash
# Get scoring for a specific match (all markets)
curl http://localhost:3000/api/matches/12345/scoring

# Get scoring for specific markets
curl "http://localhost:3000/api/matches/12345/scoring?markets=O25,BTTS"
```

### Expected Response
```json
{
  "match_id": "12345",
  "features": {
    "source": "thesports",
    "kickoff_ts": 1706553600,
    "home_team": { "id": "789", "name": "Barcelona" },
    "away_team": { "id": "456", "name": "Real Madrid" },
    "ft_scores": { "home": 3, "away": 1, "total": 4 },
    "xg": null,
    "odds": null,
    "potentials": null,
    "completeness": {
      "present": ["ft_scores", "ht_scores", "corners", "cards"],
      "missing": ["xg", "odds", "potentials", "form", "h2h", "league_stats"]
    }
  },
  "risk_flags": ["MISSING_XG", "MISSING_ODDS", "MISSING_POTENTIALS"],
  "results": [
    {
      "market_id": "O25",
      "probability": null,
      "confidence": 0,
      "pick": "NO",
      "can_publish": false,
      "block_reason": "Required field 'xg' is missing",
      "risk_flags": ["MISSING_XG"]
    }
  ],
  "generated_at": 1706553700
}
```

---

## 🔑 Key Design Decisions

### 1. Canonical Contract First
**Decision**: Create ScoringFeatures as single source of truth BEFORE building adapter
**Rationale**:
- Prevents coupling to specific data providers
- Makes it easy to add new adapters (FootyStats, hybrid, etc.)
- Clear contract for scoring engine

### 2. 100% Deterministic Mapping
**Decision**: NO fuzzy matching, NO inference, missing = undefined
**Rationale**:
- Predictable behavior
- Easy to debug
- Clear error messages ("xG missing" not "xG estimated from goals")
- Transparent to users

### 3. Completeness Tracking
**Decision**: Track present/missing fields explicitly
**Rationale**:
- Enables smart publish blocking
- Provides transparency to frontend/users
- Helps identify data quality issues
- Easy to audit

### 4. Risk Flags
**Decision**: Generate flags based on missing data
**Rationale**:
- Clear communication of limitations
- Enables different handling per flag severity
- Helps prioritize data acquisition efforts

---

## 📝 Safety Notes

### 1. Never Publish with Missing Required Data ❌
```typescript
// ❌ WRONG: Publish O25 prediction without xG
if (features.xg === undefined) {
  return { pick: 'YES', probability: 0.65 };  // ❌ DANGEROUS
}

// ✅ CORRECT: Block publish if xG missing
if (features.xg === undefined) {
  return {
    pick: 'NO',
    can_publish: false,
    block_reason: "Required field 'xg' is missing",
  };
}
```

### 2. Never Infer Missing Data ❌
```typescript
// ❌ WRONG: Estimate xG from goals scored
if (features.xg === undefined) {
  features.xg = estimateXGFromGoals(features.ft_scores);  // ❌ DANGEROUS
}

// ✅ CORRECT: Leave as undefined
if (features.xg === undefined) {
  logger.warn('xG data not available for this match');
  // Market will be blocked by canPublish check
}
```

### 3. Always Check Completeness ✅
```typescript
// ✅ CORRECT: Check completeness before scoring
if (!features.completeness.present.includes('xg')) {
  throw new Error('Cannot score O25: xG data missing');
}
```

---

## 🚀 Summary

**Status**: **Phase 1 Complete (Core Foundation) - 60% Done**

**What's Done**:
1. ✅ Canonical ScoringFeatures contract (single source of truth)
2. ✅ TheSports→ScoringFeatures adapter (100% deterministic)
3. ✅ Field-by-field mapping documentation

**What's Next**:
4. ⏳ Update marketScorer metadata (full transparency)
5. ⏳ Strict canPublish checks (missing field blocking)
6. ⏳ Create /api/matches/:id/scoring endpoint
7. ⏳ Write adapter tests with real fixtures

**Estimated Remaining Work**: 2-3 hours

---

**Last Updated**: 2026-01-29
**Branch**: phase-2A/thesports-scoring-endpoint
**Status**: ✅ Phase 1 Complete (Foundation)
