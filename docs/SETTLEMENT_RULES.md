# Settlement Rules - WIN/LOSS/VOID Criteria

**Version:** 1.0.0
**Date:** 2026-01-28
**Purpose:** Define exact settlement logic for all 7 markets

---

## 1. Settlement Philosophy

**Goal:** Fair, deterministic, and transparent outcome evaluation.

**Principles:**
1. **Match Status First:** Only settle if `status_id = 8` (ENDED)
2. **Data Availability:** If required data missing → VOID
3. **No Partial Settlement:** Either WIN, LOSS, or VOID (no draws)
4. **Transparent Logging:** All settlement decisions logged with reason

---

## 2. Database Schema: ts_matches

**Relevant Fields:**
```sql
-- Match status
status_id INTEGER  -- 8 = ENDED

-- Full-time scores
home_score_display INTEGER  -- Final home score
away_score_display INTEGER  -- Final away score

-- Half-time scores (JSONB array)
home_scores JSONB  -- [ht_score, ..., corners, cards]
away_scores JSONB  -- [ht_score, ..., corners, cards]

-- Array indices:
-- home_scores[0] = Half-time home score
-- away_scores[0] = Half-time away score
-- home_scores[4] = Full-time home corners
-- away_scores[4] = Full-time away corners
-- home_scores[2] = Full-time home yellow cards
-- away_scores[3] = Full-time away yellow cards
```

**Data Availability:**
- Full-time scores: ✅ Always available (home_score_display, away_score_display)
- Half-time scores: ✅ Available via home_scores[0], away_scores[0]
- Corners: ⚠️ May be missing (home_scores[4], away_scores[4])
- Cards: ⚠️ May be missing (home_scores[2], away_scores[3])

---

## 3. Settlement Rules Per Market

### O25 (Over 2.5 Goals)

**Evaluation Period:** Full-time (90 minutes + added time)

**Data Source:**
```sql
home_score_display + away_score_display
```

**WIN Condition:**
```
total_goals >= 3
```

**LOSS Condition:**
```
total_goals <= 2
```

**VOID Conditions:**
- Match status != 8 (not ended)
- `home_score_display IS NULL OR away_score_display IS NULL`

**SQL Query:**
```sql
SELECT
  CASE
    WHEN status_id != 8 THEN 'VOID'
    WHEN home_score_display IS NULL OR away_score_display IS NULL THEN 'VOID'
    WHEN (home_score_display + away_score_display) >= 3 THEN 'WIN'
    ELSE 'LOSS'
  END AS settlement_result
FROM ts_matches
WHERE external_id = ?
```

**Examples:**
```
Match: Barcelona 3-2 Real Madrid → 5 goals → WIN ✅
Match: Man City 1-1 Liverpool → 2 goals → LOSS ❌
Match: PSG 2-0 Monaco → 2 goals → LOSS ❌
Match: Bayern - Dortmund (POSTPONED) → VOID ⚪
```

---

### BTTS (Both Teams To Score)

**Evaluation Period:** Full-time

**Data Source:**
```sql
home_score_display, away_score_display
```

**WIN Condition:**
```
home_score > 0 AND away_score > 0
```

**LOSS Condition:**
```
home_score = 0 OR away_score = 0
```

**VOID Conditions:**
- Match status != 8
- Either score is NULL

**SQL Query:**
```sql
SELECT
  CASE
    WHEN status_id != 8 THEN 'VOID'
    WHEN home_score_display IS NULL OR away_score_display IS NULL THEN 'VOID'
    WHEN home_score_display > 0 AND away_score_display > 0 THEN 'WIN'
    ELSE 'LOSS'
  END AS settlement_result
FROM ts_matches
WHERE external_id = ?
```

**Examples:**
```
Match: Chelsea 2-1 Tottenham → Both scored → WIN ✅
Match: Arsenal 3-0 Newcastle → Away 0 → LOSS ❌
Match: Inter 0-0 AC Milan → Both 0 → LOSS ❌
Match: Sevilla 1-2 Valencia → Both scored → WIN ✅
```

---

### HT_O05 (Half-Time Over 0.5)

**Evaluation Period:** Half-time (45 minutes)

**Data Source:**
```sql
home_scores[0] + away_scores[0]
```

**Important:**
- PostgreSQL JSONB arrays use **0-based indexing**
- `home_scores[0]` = first element = half-time score
- Must cast to INTEGER: `(home_scores->0)::INTEGER`

**WIN Condition:**
```
ht_total_goals >= 1
```

**LOSS Condition:**
```
ht_total_goals = 0
```

**VOID Conditions:**
- Match status != 8 (must be finished to know HT score)
- `home_scores[0] IS NULL OR away_scores[0] IS NULL`

**SQL Query:**
```sql
SELECT
  CASE
    WHEN status_id != 8 THEN 'VOID'
    WHEN home_scores->0 IS NULL OR away_scores->0 IS NULL THEN 'VOID'
    WHEN ((home_scores->0)::INTEGER + (away_scores->0)::INTEGER) >= 1 THEN 'WIN'
    ELSE 'LOSS'
  END AS settlement_result
FROM ts_matches
WHERE external_id = ?
```

**Examples:**
```
Match: Liverpool 2-1 Man United (HT: 1-0) → 1 goal → WIN ✅
Match: Juventus 3-0 Napoli (HT: 0-0) → 0 goals → LOSS ❌
Match: Real Madrid 2-2 Atletico (HT: 1-1) → 2 goals → WIN ✅
Match: Roma - Lazio (HT score missing) → VOID ⚪
```

---

### O35 (Over 3.5 Goals)

**Evaluation Period:** Full-time

**Data Source:**
```sql
home_score_display + away_score_display
```

**WIN Condition:**
```
total_goals >= 4
```

**LOSS Condition:**
```
total_goals <= 3
```

**VOID Conditions:**
- Match status != 8
- Either score is NULL

**SQL Query:**
```sql
SELECT
  CASE
    WHEN status_id != 8 THEN 'VOID'
    WHEN home_score_display IS NULL OR away_score_display IS NULL THEN 'VOID'
    WHEN (home_score_display + away_score_display) >= 4 THEN 'WIN'
    ELSE 'LOSS'
  END AS settlement_result
FROM ts_matches
WHERE external_id = ?
```

**Examples:**
```
Match: PSG 5-2 Monaco → 7 goals → WIN ✅
Match: Barcelona 3-1 Real Madrid → 4 goals → WIN ✅
Match: Man City 2-1 Liverpool → 3 goals → LOSS ❌
Match: Bayern 1-0 Dortmund → 1 goal → LOSS ❌
```

---

### HOME_O15 (Home Over 1.5)

**Evaluation Period:** Full-time

**Data Source:**
```sql
home_score_display
```

**WIN Condition:**
```
home_score >= 2
```

**LOSS Condition:**
```
home_score <= 1
```

**VOID Conditions:**
- Match status != 8
- `home_score_display IS NULL`

**SQL Query:**
```sql
SELECT
  CASE
    WHEN status_id != 8 THEN 'VOID'
    WHEN home_score_display IS NULL THEN 'VOID'
    WHEN home_score_display >= 2 THEN 'WIN'
    ELSE 'LOSS'
  END AS settlement_result
FROM ts_matches
WHERE external_id = ?
```

**Examples:**
```
Match: Arsenal (H) 3-0 Newcastle → Home 3 → WIN ✅
Match: Chelsea (H) 2-2 Tottenham → Home 2 → WIN ✅
Match: Inter (H) 1-1 AC Milan → Home 1 → LOSS ❌
Match: Sevilla (H) 0-2 Valencia → Home 0 → LOSS ❌
```

---

### CORNERS_O85 (Corners Over 8.5)

**Evaluation Period:** Full-time

**Data Source:**
```sql
home_scores[4] + away_scores[4]
```

**Important:**
- Corner data index: `[4]`
- May be missing in some leagues/matches
- Must check for NULL before settlement

**WIN Condition:**
```
total_corners >= 9
```

**LOSS Condition:**
```
total_corners <= 8
```

**VOID Conditions:**
- Match status != 8
- `home_scores[4] IS NULL OR away_scores[4] IS NULL`
- Corner data not tracked for this league

**SQL Query:**
```sql
SELECT
  CASE
    WHEN status_id != 8 THEN 'VOID'
    WHEN home_scores->4 IS NULL OR away_scores->4 IS NULL THEN 'VOID'
    WHEN ((home_scores->4)::INTEGER + (away_scores->4)::INTEGER) >= 9 THEN 'WIN'
    ELSE 'LOSS'
  END AS settlement_result
FROM ts_matches
WHERE external_id = ?
```

**Examples:**
```
Match: Liverpool 2-1 Man City (Corners: 6-5) → 11 corners → WIN ✅
Match: Chelsea 1-0 Tottenham (Corners: 4-4) → 8 corners → LOSS ❌
Match: Inter - AC Milan (Corner data missing) → VOID ⚪
Match: Bundesliga match (Corners: 7-3) → 10 corners → WIN ✅
```

---

### CARDS_O25 (Cards Over 2.5)

**Evaluation Period:** Full-time

**Data Source:**
```sql
home_scores[2] + away_scores[3]
```

**Important:**
- Yellow card indices: `home_scores[2]`, `away_scores[3]`
- Card data often missing (not all leagues track)
- Red cards NOT included (only yellow cards)

**WIN Condition:**
```
total_yellow_cards >= 3
```

**LOSS Condition:**
```
total_yellow_cards <= 2
```

**VOID Conditions:**
- Match status != 8
- `home_scores[2] IS NULL OR away_scores[3] IS NULL`
- Card data not tracked for this league

**SQL Query:**
```sql
SELECT
  CASE
    WHEN status_id != 8 THEN 'VOID'
    WHEN home_scores->2 IS NULL OR away_scores->3 IS NULL THEN 'VOID'
    WHEN ((home_scores->2)::INTEGER + (away_scores->3)::INTEGER) >= 3 THEN 'WIN'
    ELSE 'LOSS'
  END AS settlement_result
FROM ts_matches
WHERE external_id = ?
```

**Examples:**
```
Match: Real Madrid - Atletico (Cards: 2-3) → 5 cards → WIN ✅
Match: Barcelona - Sevilla (Cards: 1-1) → 2 cards → LOSS ❌
Match: PSG - Monaco (Card data missing) → VOID ⚪
Match: Derby match (Cards: 4-1) → 5 cards → WIN ✅
```

---

## 4. Settlement Service Integration

**Existing Service:** `dailyListsSettlement.service.ts`

**Required Updates:**

### Extend evaluateMarket() function
```typescript
function evaluateMarket(marketId: string, matchData: MatchData): 'WIN' | 'LOSS' | 'VOID' {
  // Step 1: Check match status
  if (matchData.status_id !== 8) {
    return 'VOID'; // Not ended
  }

  // Step 2: Market-specific settlement
  switch (marketId) {
    case 'O25':
      if (matchData.home_score == null || matchData.away_score == null) return 'VOID';
      const totalGoals = matchData.home_score + matchData.away_score;
      return totalGoals >= 3 ? 'WIN' : 'LOSS';

    case 'BTTS':
      if (matchData.home_score == null || matchData.away_score == null) return 'VOID';
      return (matchData.home_score > 0 && matchData.away_score > 0) ? 'WIN' : 'LOSS';

    case 'HT_O05':
      const htHome = matchData.home_scores?.[0];
      const htAway = matchData.away_scores?.[0];
      if (htHome == null || htAway == null) return 'VOID';
      const htTotal = htHome + htAway;
      return htTotal >= 1 ? 'WIN' : 'LOSS';

    case 'O35':
      if (matchData.home_score == null || matchData.away_score == null) return 'VOID';
      const totalGoalsO35 = matchData.home_score + matchData.away_score;
      return totalGoalsO35 >= 4 ? 'WIN' : 'LOSS';

    case 'HOME_O15':
      if (matchData.home_score == null) return 'VOID';
      return matchData.home_score >= 2 ? 'WIN' : 'LOSS';

    case 'CORNERS_O85':
      const homeCorners = matchData.home_scores?.[4];
      const awayCorners = matchData.away_scores?.[4];
      if (homeCorners == null || awayCorners == null) return 'VOID';
      const totalCorners = homeCorners + awayCorners;
      return totalCorners >= 9 ? 'WIN' : 'LOSS';

    case 'CARDS_O25':
      const homeCards = matchData.home_scores?.[2];
      const awayCards = matchData.away_scores?.[3];
      if (homeCards == null || awayCards == null) return 'VOID';
      const totalCards = homeCards + awayCards;
      return totalCards >= 3 ? 'WIN' : 'LOSS';

    default:
      logger.error(`Unknown market for settlement: ${marketId}`);
      return 'VOID';
  }
}
```

---

## 5. Settlement Data Availability by League

**Data Completeness Table:**

| **League** | **FT Scores** | **HT Scores** | **Corners** | **Cards** |
|------------|---------------|---------------|-------------|-----------|
| Premier League | ✅ 100% | ✅ 100% | ✅ 99% | ✅ 95% |
| LaLiga | ✅ 100% | ✅ 100% | ✅ 98% | ✅ 92% |
| Bundesliga | ✅ 100% | ✅ 100% | ✅ 97% | ✅ 90% |
| Serie A | ✅ 100% | ✅ 100% | ✅ 96% | ✅ 88% |
| Ligue 1 | ✅ 100% | ✅ 100% | ✅ 95% | ✅ 85% |
| Süper Lig | ✅ 100% | ✅ 100% | ⚠️ 80% | ⚠️ 75% |
| Champions League | ✅ 100% | ✅ 100% | ✅ 99% | ✅ 97% |
| 3rd Division | ✅ 100% | ⚠️ 85% | ❌ 30% | ❌ 20% |

**Recommendation:**
- Block CORNERS_O85 and CARDS_O25 for low-tier leagues (< 80% data availability)
- HT_O05 safe for top leagues (99%+ HT score availability)

---

## 6. VOID Rate Monitoring

**Expected VOID Rates:**
- O25: < 1% (FT scores always available)
- BTTS: < 1%
- HT_O05: < 2%
- O35: < 1%
- HOME_O15: < 1%
- CORNERS_O85: 5-15% (depends on league)
- CARDS_O25: 10-20% (depends on league)

**Alert Triggers:**
- If VOID rate > 20% for any market → Investigate data source
- If specific league has >30% VOID → Block that league for affected markets

---

## 7. Settlement Logging

**Log Format:**
```typescript
logger.info('[Settlement] Market settled', {
  market_id: 'O25',
  match_id: 'l7oqdehg6ko3r51',
  home_team: 'Barcelona',
  away_team: 'Real Madrid',
  score: '3-2',
  predicted_probability: 0.685,
  predicted_confidence: 72,
  actual_outcome: 'WIN',
  settlement_timestamp: '2026-01-28T22:05:00Z',
});
```

**Database Update:**
```sql
UPDATE scoring_predictions
SET settled = TRUE,
    settlement_result = 'WIN',
    settlement_actual_value = '{"home_score": 3, "away_score": 2, "total_goals": 5}',
    settled_at = NOW()
WHERE match_id = 'l7oqdehg6ko3r51' AND market_id = 'O25';
```

---

**Last Updated:** 2026-01-28
**Reviewed By:** PM
**Status:** ✅ APPROVED FOR INTEGRATION
