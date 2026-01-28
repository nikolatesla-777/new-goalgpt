# TheSports → ScoringFeatures Field Mapping

**Version**: 1.0.0
**Date**: 2026-01-29
**Branch**: phase-2A/thesports-scoring-endpoint

---

## Overview

This document defines the **EXACT** field-by-field mapping from TheSports backend data (`ts_matches` table) to the canonical `ScoringFeatures` contract.

**CRITICAL RULES**:
- ✅ **100% deterministic** - no fuzzy matching, no inference
- ✅ **Field missing** => `undefined` + tracked in `completeness.missing`
- ✅ **No guessing** - if TheSports doesn't provide it, we don't infer it
- ✅ **Computed fields** - only calculate if ALL parts exist (e.g., `total = home + away` only if both exist)

---

## Data Source Capabilities

### TheSports Provides ✅
- Match identifiers (external_id, team IDs, league ID)
- Team names
- Match timing (kickoff timestamp, status)
- **Full-time scores** (home_score_display, away_score_display)
- **Half-time scores** (home_scores[1], away_scores[1])
- **Corners** (home_scores[5], away_scores[5])
- **Cards** (home_scores[3], away_scores[4])

### TheSports Does NOT Provide ❌
- **xG (Expected Goals)** - Only FootyStats has this
- **Odds** - Not in TheSports match data
- **Potentials** (market probabilities) - Only FootyStats has this
- **Team form statistics** - Not in simple match query
- **H2H statistics** - Not in simple match query
- **League statistics** - Not in simple match query

---

## Field Mapping Table

| ScoringFeatures Field | TheSports Source | Type | Notes |
|----------------------|------------------|------|-------|
| **source** | N/A (hardcoded) | `'thesports'` | Data source identifier |
| **match_id** | `external_id` | `string` | TheSports external match ID |
| **kickoff_ts** | `match_time` | `number` | Unix timestamp (seconds) |
| **completeness** | Calculated | `DataCompleteness` | Auto-calculated from present/missing fields |
| **home_team.id** | `home_team_id` | `string` | Falls back to `external_id + '_home'` if missing |
| **home_team.name** | `home_team` | `string` | REQUIRED field |
| **away_team.id** | `away_team_id` | `string` | Falls back to `external_id + '_away'` if missing |
| **away_team.name** | `away_team` | `string` | REQUIRED field |
| **league.id** | `competition_id` | `string` | Falls back to `'unknown'` if missing |
| **league.name** | `competition_name` | `string \| undefined` | Optional (only if joined) |
| **xg** | ❌ NOT AVAILABLE | `undefined` | TheSports doesn't provide xG data |
| **odds** | ❌ NOT AVAILABLE | `undefined` | TheSports doesn't provide odds |
| **potentials** | ❌ NOT AVAILABLE | `undefined` | TheSports doesn't provide potentials |
| **ft_scores.home** | `home_score_display` | `number \| undefined` | Only if `status_id = 8` (ENDED) |
| **ft_scores.away** | `away_score_display` | `number \| undefined` | Only if `status_id = 8` (ENDED) |
| **ft_scores.total** | Computed | `number \| undefined` | `home + away` (only if both exist) |
| **ht_scores.home** | `home_scores[1]` | `number \| undefined` | Array index 1 = half-time score |
| **ht_scores.away** | `away_scores[1]` | `number \| undefined` | Array index 1 = half-time score |
| **ht_scores.total** | Computed | `number \| undefined` | `home + away` (only if both exist) |
| **corners.home** | `home_scores[5]` | `number \| undefined` | Array index 5 = corners |
| **corners.away** | `away_scores[5]` | `number \| undefined` | Array index 5 = corners |
| **corners.total** | Computed | `number \| undefined` | `home + away` (only if both exist) |
| **cards.home** | `home_scores[3]` | `number \| undefined` | Array index 3 = yellow cards |
| **cards.away** | `away_scores[4]` | `number \| undefined` | Array index 4 = yellow cards |
| **cards.total** | Computed | `number \| undefined` | `home + away` (only if both exist) |
| **form** | ❌ NOT AVAILABLE | `undefined` | Not in simple match query |
| **h2h** | ❌ NOT AVAILABLE | `undefined` | Not in simple match query |
| **league_stats** | ❌ NOT AVAILABLE | `undefined` | Not in simple match query |

---

## TheSports `home_scores` / `away_scores` Array Structure

TheSports stores detailed match statistics in two arrays: `home_scores[]` and `away_scores[]`.

### Array Index Mapping

| Index | Home Array (`home_scores`) | Away Array (`away_scores`) | Description |
|-------|----------------------------|----------------------------|-------------|
| **0** | ❌ Unused | ❌ Unused | Reserved |
| **1** | ✅ Half-time score | ✅ Half-time score | HT goals |
| **2** | ❌ Unused | ❌ Unused | Reserved |
| **3** | ✅ Yellow cards | ❌ Unused | Home team cards |
| **4** | ❌ Unused | ✅ Yellow cards | Away team cards |
| **5** | ✅ Corners | ✅ Corners | Corner kicks |

**Example**:
```javascript
// Match: Barcelona 3-1 Real Madrid (HT: 2-0, Corners: 7-4, Cards: 2-1)
home_scores = [0, 2, 0, 2, 0, 7]  // [unused, HT=2, unused, cards=2, unused, corners=7]
away_scores = [0, 0, 0, 0, 1, 4]  // [unused, HT=0, unused, unused, cards=1, corners=4]
```

---

## Computation Rules

### Full-Time Scores
```typescript
if (status_id === 8 && home_score_display !== null && away_score_display !== null) {
  ft_scores = {
    home: home_score_display,
    away: away_score_display,
    total: home_score_display + away_score_display  // ✅ Computed
  };
} else {
  ft_scores = undefined;  // ❌ Match not ended or scores missing
}
```

### Half-Time Scores
```typescript
if (home_scores[1] !== null && away_scores[1] !== null) {
  ht_scores = {
    home: home_scores[1],
    away: away_scores[1],
    total: home_scores[1] + away_scores[1]  // ✅ Computed
  };
} else {
  ht_scores = undefined;  // ❌ HT data missing
}
```

### Corners
```typescript
if (home_scores[5] !== null && away_scores[5] !== null) {
  corners = {
    home: home_scores[5],
    away: away_scores[5],
    total: home_scores[5] + away_scores[5]  // ✅ Computed
  };
} else {
  corners = undefined;  // ❌ Corners data missing
}
```

### Cards (Yellow Cards)
```typescript
if (home_scores[3] !== null && away_scores[4] !== null) {
  cards = {
    home: home_scores[3],
    away: away_scores[4],
    total: home_scores[3] + away_scores[4]  // ✅ Computed
  };
} else {
  cards = undefined;  // ❌ Cards data missing
}
```

---

## Completeness Tracking

The adapter automatically tracks which fields are present and which are missing.

### Example Output
```typescript
{
  features: {
    source: 'thesports',
    match_id: '12345',
    kickoff_ts: 1706553600,

    home_team: { id: '789', name: 'Barcelona' },
    away_team: { id: '456', name: 'Real Madrid' },
    league: { id: '1', name: 'LaLiga' },

    ft_scores: { home: 3, away: 1, total: 4 },
    ht_scores: { home: 2, away: 0, total: 2 },
    corners: { home: 7, away: 4, total: 11 },
    cards: { home: 2, away: 1, total: 3 },

    xg: undefined,           // ❌ Not available from TheSports
    odds: undefined,         // ❌ Not available from TheSports
    potentials: undefined,   // ❌ Not available from TheSports
    form: undefined,         // ❌ Not available from TheSports
    h2h: undefined,          // ❌ Not available from TheSports
    league_stats: undefined, // ❌ Not available from TheSports

    completeness: {
      present: ['ft_scores', 'ht_scores', 'corners', 'cards'],
      missing: ['xg', 'odds', 'potentials', 'form', 'h2h', 'league_stats']
    }
  },

  risk_flags: [
    'MISSING_XG',
    'MISSING_ODDS',
    'MISSING_POTENTIALS',
    'MISSING_FORM_DATA',
    'MISSING_H2H_DATA',
    'MISSING_LEAGUE_STATS'
  ]
}
```

---

## Risk Flags

Risk flags are generated based on `completeness.missing`.

| Risk Flag | Trigger | Impact on Scoring |
|-----------|---------|-------------------|
| `MISSING_XG` | `xg === undefined` | **CRITICAL** - Blocks xG-based markets (O25, BTTS, O35, HOME_O15) |
| `MISSING_ODDS` | `odds === undefined` | **HIGH** - Cannot calculate edge/value |
| `MISSING_POTENTIALS` | `potentials === undefined` | **HIGH** - Cannot use FootyStats probabilities |
| `MISSING_HT_SCORES` | `ht_scores === undefined` | **MEDIUM** - Blocks HT_O05 market |
| `MISSING_CORNERS` | `corners === undefined` | **MEDIUM** - Blocks CORNERS_O85 market |
| `MISSING_CARDS` | `cards === undefined` | **MEDIUM** - Blocks CARDS_O25 market |
| `MISSING_FORM_DATA` | `form === undefined` | **LOW** - Reduces confidence score |
| `MISSING_H2H_DATA` | `h2h === undefined` | **LOW** - Reduces confidence score |
| `MISSING_LEAGUE_STATS` | `league_stats === undefined` | **LOW** - Reduces confidence score |

---

## Validation Rules

Before adapting, the adapter validates that TheSports data has minimum required fields.

### Required Fields
```typescript
{
  external_id: string;   // MUST be present
  home_team: string;     // MUST be present
  away_team: string;     // MUST be present
  match_time: number;    // MUST be present
  status_id: number;     // MUST be present
}
```

If any required field is missing, `validate()` returns:
```typescript
{
  valid: false,
  errors: ['Missing required field: external_id', ...]
}
```

---

## Usage Example

```typescript
import { thesportsMatchAdapter, TheSportsMatchData } from '../adapters/thesportsMatch.adapter';

// Fetch match data from TheSports backend
const thesportsData: TheSportsMatchData = await matchService.getMatchById('12345');

// Validate data
const validation = thesportsMatchAdapter.validate(thesportsData);
if (!validation.valid) {
  throw new Error(`Invalid TheSports data: ${validation.errors.join(', ')}`);
}

// Adapt to ScoringFeatures
const { features, risk_flags } = thesportsMatchAdapter.adapt(thesportsData);

// Check if scoring is possible
if (risk_flags.includes('MISSING_XG')) {
  console.log('WARNING: Cannot score xG-based markets (O25, BTTS, etc.)');
}

// Use features for scoring
const o25Result = await marketScorer.scoreMarket('O25', features);
```

---

## Safety Notes

### 1. **No Publish for Critical Missing Data**
If a market requires data that's missing, `canPublish()` MUST return `false`.

**Example**: O25 market requires `xg` data. If `features.xg === undefined`, publish is **BLOCKED**.

### 2. **No Fallbacks or Inference**
If TheSports doesn't provide a field, it stays `undefined`. **NO GUESSING**.

❌ **WRONG**: "xG is missing, let's estimate it from goals scored"
✅ **CORRECT**: "xG is missing → `xg: undefined` → market blocked → clear error message"

### 3. **Explicit NULL Checks**
Always check for `undefined` AND `null`:
```typescript
if (value !== undefined && value !== null) {
  // Safe to use value
}
```

### 4. **Array Bounds Checking**
Always verify array exists and has the index:
```typescript
if (home_scores && home_scores[5] !== undefined && home_scores[5] !== null) {
  // Safe to access home_scores[5]
}
```

---

## Future Enhancements

### Hybrid Mode (TheSports + FootyStats)
If we want to combine TheSports match data with FootyStats predictions:

```typescript
// 1. Adapt TheSports data
const thesportsFeatures = thesportsMatchAdapter.adapt(thesportsData);

// 2. Enrich with FootyStats data (if available)
if (footystatsData) {
  thesportsFeatures.features.xg = footystatsData.xg;
  thesportsFeatures.features.potentials = footystatsData.potentials;
  thesportsFeatures.features.odds = footystatsData.odds;
  thesportsFeatures.features.source = 'hybrid';
  thesportsFeatures.features.completeness = calculateCompleteness(thesportsFeatures.features);
  thesportsFeatures.risk_flags = generateRiskFlags(thesportsFeatures.features.completeness);
}

// 3. Score with enriched data
const result = await marketScorer.scoreMarket('O25', thesportsFeatures.features);
```

---

## Composite Pipeline (TheSports + FootyStats)

### Overview

**CRITICAL**: TheSports alone cannot provide xG, odds, or potentials data. The scoring system uses a **COMPOSITE PIPELINE** that merges:

- **TheSports**: Identity, settlement data (scores, corners, cards)
- **FootyStats**: Predictive features (xG, odds, potentials, trends)

### Pipeline Flow

```
Match ID (TheSports external_id)
         ↓
┌────────────────────────────────────────────┐
│ featureBuilderService.buildScoringFeatures │
└────────────────────────────────────────────┘
         ↓
   STEP 1: Fetch TheSports Match
         ↓
   ┌─────────────────┐
   │ ts_matches      │ ← SELECT WHERE external_id = $1
   └─────────────────┘
         ↓
   ┌─────────────────────────┐
   │ TheSportsMatchAdapter   │ → Base ScoringFeatures
   └─────────────────────────┘
         ↓
   STEP 2: Try to Link FootyStats Data
         ↓
   ┌──────────────────────────┐
   │ METHOD 1: Stored Mapping │
   └──────────────────────────┘
   Query: fs_match_stats WHERE ts_match_id = <internal_id>
         ↓
   Found? ──Yes→ Use FootyStats data
         │
        No
         ↓
   ┌────────────────────────────┐
   │ METHOD 2: Deterministic    │
   │ Date ±2h + EXACT team names│
   └────────────────────────────┘
   Query: fs_match_stats + ts_matches JOIN
          WHERE match_time ±2h AND LOWER(home_team) = LOWER($3)
         ↓
   Found? ──Yes→ Use FootyStats data
         │
        No
         ↓
   ┌────────────────┐
   │ METHOD 3: None │ → FootyStats data = null
   └────────────────┘
         ↓
   STEP 3: Merge Features
         ↓
   ┌──────────────────────────┐
   │ Composite ScoringFeatures│
   │ source: 'hybrid'         │ (if FootyStats found)
   │ source: 'thesports'      │ (if FootyStats NOT found)
   └──────────────────────────┘
         ↓
   STEP 4: Completeness + Risk Flags
         ↓
   Return: {
     features: ScoringFeatures,
     source_refs: SourceReferences,
     risk_flags: ScoringRiskFlag[]
   }
```

### Linking Strategy (NO FUZZY MATCHING)

**RULE**: Only deterministic links are allowed.

#### Method 1: Stored Mapping (Fastest)
```sql
SELECT *
FROM fs_match_stats
WHERE ts_match_id = '<ts_internal_uuid>'
LIMIT 1
```

**Pros**: Instant, reliable (pre-established mapping)
**Cons**: Only works for historical matches already mapped

#### Method 2: Deterministic Match (Fallback)
```sql
SELECT *
FROM fs_match_stats fs
JOIN ts_matches m ON fs.ts_match_id = m.id
WHERE m.match_time >= $1  -- matchTime - 7200 (2 hours before)
  AND m.match_time <= $2  -- matchTime + 7200 (2 hours after)
  AND LOWER(m.home_team) = LOWER($3)  -- EXACT normalized team name
  AND LOWER(m.away_team) = LOWER($4)  -- EXACT normalized team name
LIMIT 1
```

**Pros**: Catches recent matches not yet in mapping table
**Cons**: Requires exact team name match (no fuzzy logic)

#### Method 3: Not Found
If neither method finds a match:
- `footystats_linked: false`
- `link_method: 'not_found'`
- All FootyStats fields → `undefined`
- Risk flags: `MISSING_XG`, `MISSING_ODDS`, `MISSING_POTENTIALS`

### Source References Tracking

Every scoring result includes `source_refs` for full traceability:

```typescript
{
  thesports_match_id: "ts-match-123",     // TheSports external_id
  thesports_internal_id: "uuid-456",      // ts_matches.id (internal UUID)
  footystats_match_id: 789,               // fs_match_stats.fs_match_id (if found)
  footystats_linked: true,                // Whether FootyStats data was found
  link_method: "stored_mapping"           // How FootyStats was linked
}
```

### Data Responsibilities

| Data Type | Source | Fields |
|-----------|--------|--------|
| **Identity** | TheSports | match_id, home_team, away_team, kickoff_ts |
| **Settlement** | TheSports | ft_scores, ht_scores, corners, cards |
| **Predictive** | FootyStats | xg, odds, potentials, trends, h2h |
| **Hybrid** | Both | completeness, risk_flags |

### Composite Feature Example

**Scenario**: Barcelona vs Real Madrid (FootyStats data FOUND)

```typescript
{
  features: {
    source: "hybrid",  // ✅ Both sources
    match_id: "ts-match-123",
    kickoff_ts: 1706553600,

    // TheSports identity
    home_team: { id: "team-1", name: "Barcelona" },
    away_team: { id: "team-2", name: "Real Madrid" },

    // TheSports settlement
    ft_scores: { home: 3, away: 1, total: 4 },
    ht_scores: { home: 2, away: 0, total: 2 },
    corners: { home: 7, away: 4, total: 11 },
    cards: { home: 2, away: 1, total: 3 },

    // FootyStats predictive
    xg: { home: 1.65, away: 1.20, total: 2.85 },
    odds: { home_win: 2.10, draw: 3.40, away_win: 3.50 },
    potentials: { over25: 68, btts: 72, ... },

    completeness: {
      present: ["ft_scores", "ht_scores", "corners", "cards", "xg", "odds", "potentials"],
      missing: []
    }
  },

  source_refs: {
    thesports_match_id: "ts-match-123",
    thesports_internal_id: "ts-internal-uuid",
    footystats_match_id: 789,
    footystats_linked: true,
    link_method: "stored_mapping"
  },

  risk_flags: []  // All data present
}
```

**Scenario**: Barcelona vs Real Madrid (FootyStats data NOT FOUND)

```typescript
{
  features: {
    source: "thesports",  // ❌ Only TheSports
    match_id: "ts-match-123",

    // TheSports data only
    home_team: { id: "team-1", name: "Barcelona" },
    away_team: { id: "team-2", name: "Real Madrid" },
    ft_scores: { home: 3, away: 1, total: 4 },
    ht_scores: { home: 2, away: 0, total: 2 },

    // FootyStats data missing
    xg: undefined,
    odds: undefined,
    potentials: undefined,

    completeness: {
      present: ["ft_scores", "ht_scores"],
      missing: ["xg", "odds", "potentials", "trends", "h2h"]
    }
  },

  source_refs: {
    thesports_match_id: "ts-match-123",
    thesports_internal_id: "ts-internal-uuid",
    footystats_match_id: undefined,
    footystats_linked: false,
    link_method: "not_found"
  },

  risk_flags: ["MISSING_XG", "MISSING_ODDS", "MISSING_POTENTIALS"]
}
```

### API Endpoint Usage

```bash
# Get composite scoring for a match (all markets)
curl http://localhost:3000/api/matches/ts-match-123/scoring

# Filter markets
curl "http://localhost:3000/api/matches/ts-match-123/scoring?markets=O25,BTTS"

# Specify locale (tr|en)
curl "http://localhost:3000/api/matches/ts-match-123/scoring?locale=tr"
```

**Response**:
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
        "Probability 0.69 >= 0.60",
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

### Safety Rules

1. **NO Fuzzy Matching** - Only exact deterministic links allowed
2. **NO Inference** - Missing FootyStats data stays `undefined`
3. **NO Fallbacks** - Don't estimate xG from goals scored
4. **Source Tracking** - Always include `source_refs` for transparency
5. **Risk Flags** - Flag missing data explicitly (`MISSING_XG`, etc.)

### Implementation Files

| File | Purpose |
|------|---------|
| `src/services/scoring/featureBuilder.service.ts` | Composite feature builder |
| `src/adapters/thesportsMatch.adapter.ts` | TheSports → ScoringFeatures |
| `src/types/scoringFeatures.ts` | Canonical contract |
| `src/routes/scoring.routes.ts` | API endpoint |
| `src/services/scoring/publishEligibility.ts` | Strict canPublish checks |

---

**Document Version**: 2.0.0
**Last Updated**: 2026-01-29
**Maintainer**: GoalGPT Team
