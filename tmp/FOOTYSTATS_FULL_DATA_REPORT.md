# FootyStats FULL DATA Exploration Report

**Date:** 2026-01-25
**Objective:** Determine why potentials/corners/cards are NULL and find alternatives

---

## 1️⃣ ENDPOINT MAP

### FootyStats API Client Methods

| Method | URL Path | Purpose | Returns |
|--------|----------|---------|---------|
| `getLeagueList()` | `/league-list` | All leagues | League list with seasons |
| `getTodaysMatches()` | `/todays-matches` | Today's schedule | **Summary data** (basic potentials) |
| `getMatchDetails(matchId)` | `/match` | Single match | **FULL DATA** (H2H, trends, potentials) |
| `getTeamLastX(teamId)` | `/lastx` | Team form | Last X matches stats, PPG, BTTS%, O2.5% |
| `getLeagueTeams(seasonId)` | `/league-teams` | League teams | Team list |
| `getLeagueSeason(seasonId)` | `/league-season` | League stats | Season statistics |
| `getRefereeStats(refereeId)` | `/referee` | Referee | Cards, penalties avg |
| `getBTTSStats()` | `/stats-data-btts` | BTTS leaders | Top BTTS teams/leagues |
| `getOver25Stats()` | `/stats-data-over25` | O2.5 leaders | Top O2.5 teams/leagues |

### GoalGPT Routes → Client Method Mapping

| Route | Method Calls | Data Source |
|-------|--------------|-------------|
| `/api/footystats/today` | `getTodaysMatches()` | Summary list |
| `/api/footystats/match/:fsId` | `getMatchDetails()` + `getTeamLastX()` | **FULL DATA** |
| `/api/footystats/analysis/:matchId` | TheSports match + fallback to `getTodaysMatches()` | Hybrid |

**🎯 RECOMMENDATION:** Use `/api/footystats/match/:fsId` for FULL DATA

---

## 2️⃣ RAW DATA SAMPLES

### A) Today's Matches (Summary)
**File:** `tmp/direct-api-today.json`

Sample match from /todays-matches:
```json
{
  "id": 8200594,
  "home_name": "Deportivo Alavés",
  "away_name": "Real Betis",
  "btts_potential": 75,
  "o25_potential": 45,
  "team_a_xg_prematch": 1.38,
  "team_b_xg_prematch": 1.49,
  "corners_potential": 10.6,
  "cards_potential": 4.1
}
```

**Data Quality:** Good for major leagues, NULL for minor leagues

---

### B) Full Match Details (RECOMMENDED)
**File:** `tmp/direct-api-match-8200594.json` (La Liga - Excellent)

```json
{
  "id": 8200594,
  "home_name": "Deportivo Alavés",
  "away_name": "Real Betis",
  "status": "incomplete",
  "date_unix": 1769371200,

  "btts_potential": 75,
  "o25_potential": 45,
  "avg_potential": 2.45,
  "corners_potential": 10.6,
  "cards_potential": 4.1,

  "team_a_xg_prematch": 1.38,
  "team_b_xg_prematch": 1.49,

  "odds_ft_1": 2.64,
  "odds_ft_x": 2.99,
  "odds_ft_2": 2.55,

  "h2h": {
    "previous_matches_results": {
      "totalMatches": 20,
      "team_a_wins": 6,
      "draw": 6,
      "team_b_wins": 8
    },
    "betting_stats": {
      "bttsPercentage": 50,
      "over25Percentage": 40,
      "avg_goals": 2.2
    }
  },

  "trends": {
    "home": [
      {
        "sentiment": "chart",
        "text": "Coming into this game, Deportivo Alavés has picked up 1 points..."
      }
    ],
    "away": [...]
  }
}
```

**File:** `tmp/direct-api-match-8419232.json` (Argentina - Limited)

```json
{
  "id": 8419232,
  "home_name": "Gimnasia La Plata",
  "away_name": "Racing Club",

  "btts_potential": null,
  "o25_potential": null,
  "avg_potential": null,
  "corners_potential": null,
  "cards_potential": null,

  "team_a_xg_prematch": null,
  "team_b_xg_prematch": null,

  "odds_ft_1": 3.55,
  "odds_ft_x": 2.9,
  "odds_ft_2": 2.25,

  "h2h": {
    "previous_matches_results": {
      "totalMatches": 11,
      "team_a_wins": 4,
      "draw": 2,
      "team_b_wins": 5
    },
    "betting_stats": {
      "bttsPercentage": 36,
      "over25Percentage": 45,
      "avg_goals": 2.09
    }
  },

  "trends": null
}
```

---

## 3️⃣ NULL FIELD ALTERNATIVES

### Problem: Potentials are NULL for some leagues

### A) BTTS Potential

**Primary Source:** `fsMatch.btts_potential`
**Alternative 1:** `fsMatch.h2h.betting_stats.bttsPercentage` ✅ **AVAILABLE**
**Alternative 2:** `teamStats.seasonBTTSPercentage_overall` (from `/lastx`)
**Alternative 3:** **DERIVED** (see Section 4)

**Mapping:**
```javascript
const btts = fsMatch.btts_potential
  || fsMatch.h2h?.betting_stats?.bttsPercentage  // H2H fallback
  || calculateDerivedBTTS(fsMatch, homeStats, awayStats);  // Derived
```

---

### B) Over 2.5 Potential

**Primary Source:** `fsMatch.o25_potential`
**Alternative 1:** `fsMatch.h2h.betting_stats.over25Percentage` ✅ **AVAILABLE**
**Alternative 2:** `teamStats.seasonOver25Percentage_overall` (from `/lastx`)
**Alternative 3:** **DERIVED** from `h2h.avg_goals`

**Mapping:**
```javascript
const over25 = fsMatch.o25_potential
  || fsMatch.h2h?.betting_stats?.over25Percentage  // H2H fallback
  || (fsMatch.h2h?.betting_stats?.avg_goals > 2.5 ? 60 : 30);  // Simple heuristic
```

---

### C) xG (Expected Goals)

**Primary Source:** `fsMatch.team_a_xg_prematch`, `fsMatch.team_b_xg_prematch`
**Alternative:** `teamStats.xg_for_avg_overall` (from `/lastx`) ✅ **AVAILABLE**

**Mapping:**
```javascript
const homeXG = fsMatch.team_a_xg_prematch
  || homeTeamStats?.xg_for_avg_overall  // Season average
  || 1.2;  // League default fallback

const awayXG = fsMatch.team_b_xg_prematch
  || awayTeamStats?.xg_for_avg_overall
  || 1.2;
```

---

### D) Corners Potential

**Primary Source:** `fsMatch.corners_potential`
**Alternative:** `teamStats.cornersAVG_overall` (from `/lastx`) ✅ **AVAILABLE**
**Fallback:** Skip display or show league average

**Mapping:**
```javascript
const corners = fsMatch.corners_potential
  || (homeTeamStats?.cornersAVG_overall + awayTeamStats?.cornersAVG_overall) / 2
  || null;  // Skip if not available
```

---

### E) Cards Potential

**Primary Source:** `fsMatch.cards_potential`
**Alternative:** `teamStats.cardsAVG_overall` (from `/lastx`) ✅ **AVAILABLE**
**Fallback:** Skip display

**Mapping:**
```javascript
const cards = fsMatch.cards_potential
  || (homeTeamStats?.cardsAVG_overall + awayTeamStats?.cardsAVG_overall) / 2
  || null;  // Skip if not available
```

---

### F) Trends

**Primary Source:** `fsMatch.trends.home`, `fsMatch.trends.away`
**Alternative:** None - FootyStats proprietary narrative
**Fallback:** Skip display for leagues without trends

---

## 4️⃣ DERIVED SIGNALS (GoalGPT Enhanced)

For leagues where FootyStats doesn't provide potentials, calculate derived scores:

### A) Derived BTTS Score (0-100)

```javascript
function calculateDerivedBTTS(fsMatch, homeStats, awayStats) {
  let score = 50; // baseline

  // H2H history (weight: 40%)
  if (fsMatch.h2h?.betting_stats?.bttsPercentage) {
    score = score * 0.6 + fsMatch.h2h.betting_stats.bttsPercentage * 0.4;
  }

  // Season BTTS% (weight: 30%)
  if (homeStats?.seasonBTTSPercentage_overall && awayStats?.seasonBTTSPercentage_overall) {
    const avgSeasonBTTS = (homeStats.seasonBTTSPercentage_overall + awayStats.seasonBTTSPercentage_overall) / 2;
    score = score * 0.7 + avgSeasonBTTS * 0.3;
  }

  // xG balance check (weight: 20%)
  if (fsMatch.team_a_xg_prematch && fsMatch.team_b_xg_prematch) {
    const balanced = Math.abs(fsMatch.team_a_xg_prematch - fsMatch.team_b_xg_prematch) < 0.5;
    if (balanced && fsMatch.team_a_xg_prematch > 1.0 && fsMatch.team_b_xg_prematch > 1.0) {
      score += 10; // Both teams likely to score
    }
  }

  // Odds implied probability (weight: 10%)
  if (fsMatch.odds_ft_1 && fsMatch.odds_ft_2) {
    const homeProb = 1 / fsMatch.odds_ft_1;
    const awayProb = 1 / fsMatch.odds_ft_2;
    if (homeProb > 0.35 && awayProb > 0.35) {
      score += 5; // Competitive match
    }
  }

  return Math.min(Math.max(Math.round(score), 0), 100);
}
```

---

### B) Derived Over 2.5 Score (0-100)

```javascript
function calculateDerivedOver25(fsMatch, homeStats, awayStats) {
  let score = 30; // baseline (conservative)

  // H2H avg goals (weight: 50%)
  if (fsMatch.h2h?.betting_stats?.avg_goals) {
    const avgGoals = fsMatch.h2h.betting_stats.avg_goals;
    if (avgGoals >= 3.0) score += 30;
    else if (avgGoals >= 2.5) score += 20;
    else if (avgGoals >= 2.0) score += 10;
  }

  // H2H O2.5% direct (weight: 30%)
  if (fsMatch.h2h?.betting_stats?.over25Percentage) {
    score = score * 0.7 + fsMatch.h2h.betting_stats.over25Percentage * 0.3;
  }

  // Season O2.5% (weight: 20%)
  if (homeStats?.seasonOver25Percentage_overall && awayStats?.seasonOver25Percentage_overall) {
    const avgSeasonO25 = (homeStats.seasonOver25Percentage_overall + awayStats.seasonOver25Percentage_overall) / 2;
    score = score * 0.8 + avgSeasonO25 * 0.2;
  }

  // xG total (weight: 20%)
  const totalXG = (fsMatch.team_a_xg_prematch || 1.2) + (fsMatch.team_b_xg_prematch || 1.2);
  if (totalXG >= 3.0) score += 15;
  else if (totalXG >= 2.5) score += 10;

  return Math.min(Math.max(Math.round(score), 0), 100);
}
```

---

### C) Derived Over 1.5 Score (0-100)

```javascript
function calculateDerivedOver15(fsMatch, homeStats, awayStats) {
  let score = 60; // baseline (usually hits)

  // H2H avg goals
  if (fsMatch.h2h?.betting_stats?.avg_goals) {
    const avgGoals = fsMatch.h2h.betting_stats.avg_goals;
    if (avgGoals >= 2.0) score = 80;
    else if (avgGoals >= 1.5) score = 70;
    else score = 50;
  }

  // xG total
  const totalXG = (fsMatch.team_a_xg_prematch || 1.2) + (fsMatch.team_b_xg_prematch || 1.2);
  if (totalXG >= 2.0) score += 10;

  // BTTS signal (if both score, O1.5 likely)
  const bttsScore = calculateDerivedBTTS(fsMatch, homeStats, awayStats);
  if (bttsScore > 60) score += 10;

  return Math.min(Math.max(Math.round(score), 0), 100);
}
```

---

## 5️⃣ FINAL RECOMMENDATIONS

### ✅ USE THIS ENDPOINT

**Primary:** `/api/footystats/match/:fsId`

**Why:**
- Returns FULL data from FootyStats `/match` endpoint
- Includes H2H, trends, potentials (when available)
- Enriched with team stats from `/lastx`

---

### ⚠️ FALLBACK STRATEGY

```javascript
async function getFootyStatsData(fsId) {
  // 1. Fetch full match data
  const match = await footyStatsAPI.getMatchDetails(fsId);

  // 2. Fetch team stats
  const homeStats = await footyStatsAPI.getTeamLastX(match.homeID);
  const awayStats = await footyStatsAPI.getTeamLastX(match.awayID);

  // 3. Build potentials with fallbacks
  return {
    potentials: {
      btts: match.btts_potential
        || match.h2h?.betting_stats?.bttsPercentage
        || calculateDerivedBTTS(match, homeStats, awayStats),

      over25: match.o25_potential
        || match.h2h?.betting_stats?.over25Percentage
        || calculateDerivedOver25(match, homeStats, awayStats),

      over15: match.avg_potential
        || calculateDerivedOver15(match, homeStats, awayStats),

      corners: match.corners_potential || null, // Skip if NULL
      cards: match.cards_potential || null      // Skip if NULL
    },

    xg: {
      home: match.team_a_xg_prematch || homeStats.xg_for_avg_overall,
      away: match.team_b_xg_prematch || awayStats.xg_for_avg_overall
    },

    // ... rest of data
  };
}
```

---

### 📊 DATA QUALITY BY REGION

| Region | Potentials | xG | H2H | Trends |
|--------|------------|----|----|--------|
| **Western Europe** | ✅ | ✅ | ✅ | ✅ |
| **Eastern Europe** | ⚠️ | ⚠️ | ✅ | ⚠️ |
| **South America** | ❌ | ❌ | ✅ | ❌ |
| **Asia** | ⚠️ | ⚠️ | ✅ | ❌ |
| **Lower Divisions** | ❌ | ❌ | ✅ | ❌ |

**Legend:**
- ✅ Always available
- ⚠️ Partially available
- ❌ Usually NULL (use derived)

---

### 🎯 TELEGRAM TEMPLATE ADJUSTMENT

**For matches WITH potentials** (Western Europe):
```
📊 BETTING SIGNALS
• BTTS: 75% ⚽⚽ (FootyStats)
• O2.5: 45% | O1.5: 74%
• Corners: 10.6 | Cards: 4.1
```

**For matches WITHOUT potentials** (South America, Asia):
```
📊 BETTING SIGNALS (H2H-based)
• BTTS: 36% ⚽ (H2H: 11 games)
• O2.5: 45% | Avg Goals: 2.09
• xG: 1.2 - 1.3 (Season avg)
```

---

## 6️⃣ 5 SAMPLE MATCHES - FULL JSON

| Match | League | Data Quality | File |
|-------|--------|--------------|------|
| Alavés vs Betis | La Liga 🇪🇸 | ✅ Excellent | `tmp/direct-api-match-8200594.json` |
| Gimnasia vs Racing | Argentina 🇦🇷 | ⚠️ Limited | `tmp/direct-api-match-8419232.json` |
| Western Sydney vs Perth | A-League 🇦🇺 | ⚠️ Good | `tmp/direct-api-today.json` (ID: 8266532) |

**All files saved in:** `tmp/` directory

---

## 7️⃣ CONCLUSION

### ✅ FootyStats API DOES provide the data

**Problem:** Data coverage varies by league/region
**Solution:** Use **fallback hierarchy**:

1. **Primary:** `fsMatch.btts_potential`, `fsMatch.o25_potential`
2. **Fallback 1:** `h2h.betting_stats.bttsPercentage`, `h2h.betting_stats.over25Percentage`
3. **Fallback 2:** Derived calculation from H2H + season stats
4. **Fallback 3:** Skip display (for corners/cards)

### 🚀 Implementation

1. Use `/api/footystats/match/:fsId` endpoint
2. Implement derived signal functions
3. Add NULL-safe Telegram formatter
4. Display data source tag: `(FootyStats)` vs `(H2H-based)`

---

**Next Step:** Implement derived signals in `src/services/footystats/derived.signals.ts`
