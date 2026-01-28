# FootyStats Scoring Contract

**Version:** 1.0.0
**Date:** 2026-01-28
**Purpose:** Define exact input requirements for market scoring system

---

## 1. Input Shape: FootyStatsMatchFeatures

```typescript
/**
 * Required input shape for market scoring
 * All fields must match FootyStats API response structure
 */
interface FootyStatsMatchFeatures {
  // === MATCH IDENTIFIERS (REQUIRED) ===
  id: number;                          // FootyStats numeric match ID
  externalId: string;                  // TheSports external_id (alphanumeric)
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  matchTime: number;                   // Unix timestamp

  // === xG DATA (CRITICAL) ===
  // Source: FootyStats /match endpoint → prematch_xg object
  xg?: {
    home: number;                      // team_a_xg_prematch
    away: number;                      // team_b_xg_prematch
    total: number;                     // home + away
  };

  // === POTENTIALS (PRE-CALCULATED PROBABILITIES) ===
  // Source: FootyStats /match endpoint → potentials object
  potentials?: {
    over25?: number;                   // o25_potential (0-100)
    btts?: number;                     // btts_potential (0-100)
    o05HT?: number;                    // o05HT_potential (0-100)
    o15?: number;                      // o15_potential (0-100)
    corners?: number;                  // corners_potential (0-100)
    cards?: number;                    // cards_potential (0-100)
  };

  // === ODDS (BETTING MARKETS) ===
  // Source: FootyStats /match endpoint → odds_* fields
  odds?: {
    ft_1?: number;                     // odds_ft_1 (home win)
    ft_x?: number;                     // odds_ft_x (draw)
    ft_2?: number;                     // odds_ft_2 (away win)
  };

  // === TRENDS (RECENT FORM) ===
  // Source: FootyStats /match endpoint → trends object
  trends?: {
    home?: Array<{
      home_goals?: number;
      away_goals?: number;
      ht_home_goals?: number;
      ht_away_goals?: number;
      home_corners?: number;
      away_corners?: number;
      home_cards?: number;
      away_cards?: number;
    }>;
    away?: Array<{
      home_goals?: number;
      away_goals?: number;
      ht_home_goals?: number;
      ht_away_goals?: number;
      home_corners?: number;
      away_corners?: number;
      home_cards?: number;
      away_cards?: number;
    }>;
  };

  // === H2H (HEAD-TO-HEAD STATS) ===
  // Source: FootyStats /match endpoint → h2h object
  h2h?: {
    betting_stats?: {
      over25Percentage?: number;       // h2h_betting_stats.over25Percentage
      bttsPercentage?: number;         // h2h_betting_stats.bttsPercentage
    };
    avg_goals?: number;                // h2h.avg_goals
  };

  // === TEAM FORM (SEASON STATS) ===
  // Source: FootyStats /lastx endpoint → team stats
  homeTeam?: {
    seasonOver25Percentage_home?: number;
    seasonBTTSPercentage_home?: number;
    seasonGoals_home?: number;
    seasonConcededAVG_home?: number;
    cornersAVG_home?: number;
    cardsAVG_home?: number;
  };

  awayTeam?: {
    seasonOver25Percentage_away?: number;
    seasonBTTSPercentage_away?: number;
    seasonGoals_away?: number;
    seasonConcededAVG_away?: number;
    cornersAVG_away?: number;
    cardsAVG_away?: number;
  };

  // === LEAGUE NORMS ===
  // Source: FootyStats /stats-data-over25 or /stats-data-btts endpoints
  league?: {
    avg_goals?: number;                // League average goals per match
    over25_rate?: number;              // League Over 2.5 rate (0-100)
    btts_rate?: number;                // League BTTS rate (0-100)
  };

  // === REFEREE DATA (OPTIONAL - NOT AVAILABLE) ===
  // FootyStats /match does NOT provide referee_id
  // referee?: {
  //   cards_per_match?: number;       // NOT AVAILABLE
  // };
}
```

---

## 2. Field Mapping: Scorer → FootyStats API

| **Scorer Field** | **FootyStats Response Field** | **Fallback** | **Market Dependency** |
|------------------|-------------------------------|--------------|------------------------|
| `xg.home` | `team_a_xg_prematch` | `null` | O25, BTTS, HT_O05, O35, HOME_O15 |
| `xg.away` | `team_b_xg_prematch` | `null` | O25, BTTS, HT_O05, O35 |
| `xg.total` | `team_a_xg_prematch + team_b_xg_prematch` | `null` | O25, O35 |
| `potentials.over25` | `o25_potential` | `null` | O25, O35 |
| `potentials.btts` | `btts_potential` | `null` | BTTS |
| `potentials.o05HT` | `o05HT_potential` | `null` | HT_O05 |
| `potentials.o15` | `o15_potential` | `null` | HOME_O15 |
| `potentials.corners` | `corners_potential` | `null` | CORNERS_O85 |
| `potentials.cards` | `cards_potential` | `null` | CARDS_O25 |
| `odds.ft_1` | `odds_ft_1` | `2.0` (default) | HOME_O15 (correlation) |
| `odds.ft_x` | `odds_ft_x` | `3.0` (default) | Edge calculation |
| `odds.ft_2` | `odds_ft_2` | `3.5` (default) | Edge calculation |
| `trends.home` | `trends.home[]` | `[]` (empty array) | All markets (form) |
| `trends.away` | `trends.away[]` | `[]` (empty array) | All markets (form) |
| `h2h.betting_stats.over25Percentage` | `h2h.betting_stats.over25Percentage` | `null` | O25 (minor weight) |
| `h2h.betting_stats.bttsPercentage` | `h2h.betting_stats.bttsPercentage` | `null` | BTTS (minor weight) |
| `h2h.avg_goals` | `h2h.avg_goals` | `null` | O35 (proxy) |
| `homeTeam.seasonOver25Percentage_home` | `/lastx` endpoint → `seasonOver25Percentage_home` | `null` | O25 (form) |
| `homeTeam.seasonBTTSPercentage_home` | `/lastx` endpoint → `seasonBTTSPercentage_home` | `null` | BTTS (form) |
| `homeTeam.seasonGoals_home` | `/lastx` endpoint → `seasonGoals_home` | `null` | HOME_O15 |
| `homeTeam.cornersAVG_home` | `/lastx` endpoint → `cornersAVG_home` | `null` | CORNERS_O85 |
| `homeTeam.cardsAVG_home` | `/lastx` endpoint → `cardsAVG_home` | `null` | CARDS_O25 |
| `league.avg_goals` | `/stats-data-over25` → `avg_goals` | `2.6` (default) | O25, O35 (adjustment) |
| `league.over25_rate` | `/stats-data-over25` → `over25_rate` | `null` | O25 (league norm) |
| `league.btts_rate` | `/stats-data-btts` → `btts_rate` | `null` | BTTS (league norm) |
| `referee.cards_per_match` | **NOT AVAILABLE** | `null` | CARDS_O25 (missing) |

---

## 3. Required Fields Per Market

### O25 (Over 2.5 Goals)
**Critical (MUST HAVE):**
- `xg.home`, `xg.away`, `xg.total`
- `potentials.over25`

**Important (SHOULD HAVE):**
- `odds.ft_1`, `odds.ft_x`, `odds.ft_2` (for edge calculation)
- `trends.home`, `trends.away` (for form adjustment)
- `h2h.betting_stats.over25Percentage`

**Optional (NICE TO HAVE):**
- `league.avg_goals` (for league adjustment)
- `potentials.btts` (for correlation bonus)

**Missing Data Impact:**
- No xG → Risk flag: `MISSING_XG`, confidence penalty: -20
- No potentials → Risk flag: `MISSING_POTENTIALS`, confidence penalty: -15
- No odds → Risk flag: `MISSING_ODDS`, edge = null (publish blocked if edge required)

---

### BTTS (Both Teams To Score)
**Critical (MUST HAVE):**
- `xg.home`, `xg.away`
- `potentials.btts`

**Important (SHOULD HAVE):**
- `trends.home`, `trends.away`
- `h2h.betting_stats.bttsPercentage`
- `homeTeam.seasonBTTSPercentage_home`, `awayTeam.seasonBTTSPercentage_away`

**Missing Data Impact:**
- No xG → Risk flag: `MISSING_XG`, confidence penalty: -20
- No potentials → Risk flag: `MISSING_POTENTIALS`, confidence penalty: -15

---

### HT_O05 (Half-Time Over 0.5)
**Critical (MUST HAVE):**
- `xg.home`, `xg.away`
- `potentials.o05HT`

**Important (SHOULD HAVE):**
- `trends.home`, `trends.away` (HT-specific goals)

**Missing Data Impact:**
- No potentials.o05HT → Risk flag: `MISSING_POTENTIAL_HT`, confidence penalty: -20, **PUBLISH BLOCKED**

---

### O35 (Over 3.5 Goals)
**Critical (MUST HAVE):**
- `xg.total` (must be >= 3.1 for publish)
- `potentials.over25` (derive O35 with penalty)

**Important (SHOULD HAVE):**
- `h2h.avg_goals`
- `trends.home`, `trends.away`

**Missing Data Impact:**
- xG < 3.1 → Confidence penalty: -15, publish may be blocked

---

### HOME_O15 (Home Over 1.5)
**Critical (MUST HAVE):**
- `xg.home` (must be >= 1.45 for publish)
- `potentials.o15`

**Important (SHOULD HAVE):**
- `odds.ft_1` (home win odds for correlation)
- `homeTeam.seasonGoals_home`

**Missing Data Impact:**
- xG.home < 1.45 → Publish blocked

---

### CORNERS_O85 (Corners Over 8.5)
**Critical (MUST HAVE):**
- `potentials.corners`
- `homeTeam.cornersAVG_home`, `awayTeam.cornersAVG_away`

**Important (SHOULD HAVE):**
- `trends.home`, `trends.away` (corner stats)

**Missing Data Impact:**
- No potentials.corners → Risk flag: `MISSING_POTENTIAL_CORNERS`, **PUBLISH BLOCKED**

---

### CARDS_O25 (Cards Over 2.5)
**Critical (MUST HAVE):**
- `potentials.cards`
- `homeTeam.cardsAVG_home`, `awayTeam.cardsAVG_away`

**Important (SHOULD HAVE):**
- `referee.cards_per_match` (**NOT AVAILABLE - known limitation**)

**Missing Data Impact:**
- No potentials.cards → Risk flag: `MISSING_POTENTIAL_CARDS`, **PUBLISH BLOCKED**
- No referee data → Risk flag: `NO_REFEREE_DATA`, confidence penalty: -10

---

## 4. Missing Field Handling Rules

### Rule 1: Risk Flag Generation
If critical field is missing:
1. Add to `risk_flags` array
2. Apply confidence penalty (see table below)
3. If publish-blocking field missing → `pick = 'NO'` (force rejection)

### Rule 2: Confidence Penalty Table

| **Risk Flag** | **Penalty** | **Publish Blocked?** |
|---------------|-------------|----------------------|
| `MISSING_XG` | -20 | Yes (for O25, BTTS, HT_O05, O35, HOME_O15) |
| `MISSING_POTENTIALS` | -15 | Yes (market-specific) |
| `MISSING_ODDS` | -5 | No (edge calculation skipped) |
| `MISSING_POTENTIAL_HT` | -20 | Yes (HT_O05) |
| `MISSING_POTENTIAL_CORNERS` | -20 | Yes (CORNERS_O85) |
| `MISSING_POTENTIAL_CARDS` | -20 | Yes (CARDS_O25) |
| `NO_REFEREE_DATA` | -10 | No (CARDS_O25 continues) |
| `EXTREME_ODDS` | -10 | No |
| `LOW_SAMPLE_LEAGUE` | -8 | No |
| `HIGH_VARIANCE` | -12 | No |
| `CONFLICT_SIGNALS` | -15 | No |

### Rule 3: Publish Blocking Logic
```typescript
function canPublish(marketId: MarketId, scoreResult: ScoringResult): boolean {
  // Check critical missing data
  if (scoreResult.risk_flags.includes('MISSING_XG')) {
    if (['O25', 'BTTS', 'HT_O05', 'O35', 'HOME_O15'].includes(marketId)) {
      return false; // BLOCKED
    }
  }

  if (scoreResult.risk_flags.includes('MISSING_POTENTIAL_HT') && marketId === 'HT_O05') {
    return false; // BLOCKED
  }

  if (scoreResult.risk_flags.includes('MISSING_POTENTIAL_CORNERS') && marketId === 'CORNERS_O85') {
    return false; // BLOCKED
  }

  if (scoreResult.risk_flags.includes('MISSING_POTENTIAL_CARDS') && marketId === 'CARDS_O25') {
    return false; // BLOCKED
  }

  // Check pick and confidence thresholds
  if (scoreResult.pick !== 'YES') return false;
  if (scoreResult.confidence < getMinConfidenceForMarket(marketId)) return false;

  return true;
}
```

---

## 5. API Endpoint Coverage

| **Endpoint** | **Purpose** | **Fields Provided** | **Usage** |
|--------------|-------------|---------------------|-----------|
| `/match` | Match data | `xg`, `potentials`, `odds`, `trends`, `h2h` | Primary scoring input |
| `/lastx` | Team form | `seasonOver25Percentage_home`, `cornersAVG_home`, etc. | Form adjustments |
| `/stats-data-over25` | League norms | `avg_goals`, `over25_rate` | League adjustments |
| `/stats-data-btts` | League norms | `btts_rate` | League adjustments |
| `/referee` | Referee stats | **NOT ACCESSIBLE (no referee_id in match)** | ❌ CARDS_O25 limitation |

---

## 6. Validation Checklist

Before scoring a match, validate:
- [ ] `xg.home` and `xg.away` are numbers (not null)
- [ ] `potentials` object exists
- [ ] Market-specific critical fields are present (see section 3)
- [ ] `trends.home` and `trends.away` are arrays (can be empty)
- [ ] `odds` object exists (for edge calculation)
- [ ] Team form data is present for high-confidence markets

If validation fails → Generate risk flags → Apply penalties → Block publish if critical.

---

**Last Updated:** 2026-01-28
**Reviewed By:** PM
**Status:** ✅ APPROVED FOR WEEK-2
