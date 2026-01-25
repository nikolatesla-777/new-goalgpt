# FootyStats Full Data Exploration - Executive Summary

**Date:** 2026-01-25
**Status:** ✅ COMPLETE
**Conclusion:** NULL fields are API coverage limits, NOT bugs. Solution: Fallback hierarchy.

---

## 🎯 OBJECTIVE

Find why potentials/corners/cards/trends are NULL for some matches and determine:
1. Is FootyStats API really providing this data?
2. Are we using the wrong endpoint/parameters?
3. Do we need derived signals?

---

## ✅ FINDINGS

### 1. **ROOT CAUSE: API Coverage Limitation**

FootyStats API DOES provide potentials, but **coverage varies by league**:

| Region | Potentials | xG | Trends | Reason |
|--------|------------|----|----|--------|
| 🇪🇸🇬🇧🇩🇪🇮🇹🇫🇷 Western Europe | ✅ Full | ✅ | ✅ | High priority leagues |
| 🇦🇷🇧🇷 South America | ❌ NULL | ❌ | ❌ | Lower priority |
| 🇯🇵🇰🇷 Asia | ⚠️ Partial | ⚠️ | ❌ | Limited coverage |

**Evidence:**
- La Liga (Alavés vs Betis): BTTS=75%, O2.5=45%, xG=1.38-1.49, 6 trends ✅
- Argentina (Gimnasia vs Racing): ALL NULL ❌

**Conclusion:** This is NOT a bug. FootyStats focuses on top European leagues.

---

### 2. **CORRECT ENDPOINT USAGE**

✅ **We ARE using the right endpoint:** `/match?match_id=X`

**Endpoint Hierarchy:**
1. `/todays-matches` → Summary data (basic potentials)
2. `/match?match_id=X` → **FULL DATA** (H2H, trends, detailed potentials) ⭐
3. `/lastx?team_id=X` → Team form (PPG, BTTS%, O2.5%, xG avg)

**Current implementation is CORRECT.**

---

### 3. **H2H STATS: ALWAYS AVAILABLE**

Even when potentials are NULL, H2H provides:

```json
"h2h": {
  "betting_stats": {
    "bttsPercentage": 36,        // ✅ BTTS fallback
    "over25Percentage": 45,      // ✅ O2.5 fallback
    "avg_goals": 2.09            // ✅ Goals expectation
  }
}
```

**This is the KEY to our fallback strategy.**

---

## 💡 SOLUTION: 3-TIER FALLBACK HIERARCHY

### Tier 1: FootyStats Potentials (Primary)
```javascript
const btts = fsMatch.btts_potential;  // If available
const over25 = fsMatch.o25_potential;
```

### Tier 2: H2H Stats (Fallback)
```javascript
const btts = fsMatch.h2h?.betting_stats?.bttsPercentage;
const over25 = fsMatch.h2h?.betting_stats?.over25Percentage;
```

### Tier 3: Derived Signals (Last Resort)
```javascript
const btts = calculateDerivedBTTS(fsMatch, homeStats, awayStats);
const over25 = calculateDerivedOver25(fsMatch, homeStats, awayStats);
```

---

## 📊 NULL FIELD ALTERNATIVES

| Field | Primary | Fallback 1 | Fallback 2 | Fallback 3 |
|-------|---------|------------|------------|------------|
| **BTTS** | `btts_potential` | `h2h.btts%` ✅ | `seasonBTTS%` avg | Derived formula |
| **O2.5** | `o25_potential` | `h2h.over25%` ✅ | `h2h.avg_goals > 2.5` | Derived formula |
| **O1.5** | `avg_potential` | `h2h.avg_goals > 1.5` | BTTS signal | Derived formula |
| **xG** | `team_a/b_xg_prematch` | `teamStats.xg_avg` ✅ | 1.2 default | - |
| **Corners** | `corners_potential` | `teamStats.cornersAVG` | **Skip display** | - |
| **Cards** | `cards_potential` | `teamStats.cardsAVG` | **Skip display** | - |
| **Trends** | `trends.home/away` | None | **Skip display** | - |

**✅ = Currently available in API response**

---

## 🔧 DERIVED SIGNALS FORMULAS

### BTTS Score (0-100)
```
Base: 50
+ H2H BTTS% × 0.4
+ Season BTTS% avg × 0.3
+ xG balance bonus (both > 1.0): +10
+ Competitive odds bonus: +5
= BTTS Score
```

### Over 2.5 Score (0-100)
```
Base: 30
+ H2H avg_goals factor: +30 if ≥3.0, +20 if ≥2.5
+ H2H O2.5% × 0.3
+ Season O2.5% avg × 0.2
+ Total xG bonus: +15 if ≥3.0, +10 if ≥2.5
= Over 2.5 Score
```

### Over 1.5 Score (0-100)
```
Base: 60
+ H2H avg_goals: 80 if ≥2.0, 70 if ≥1.5
+ Total xG bonus: +10 if ≥2.0
+ BTTS signal bonus: +10 if BTTS > 60
= Over 1.5 Score
```

---

## 📂 DELIVERABLES

### Reports
1. **FOOTYSTATS_FULL_DATA_REPORT.md** (13KB) - Detailed analysis
2. **FOOTYSTATS_RAW_DATA_REPORT.md** (10KB) - First iteration findings
3. **TELEGRAM_TEMPLATE_QUICK_REF.md** (6.5KB) - Implementation guide
4. **This file** - Executive summary

### RAW Data Samples
1. `direct-api-today.json` (457KB) - 70 matches from /todays-matches
2. `direct-api-match-8200594.json` (139KB) - La Liga FULL data ✅
3. `direct-api-match-8419232.json` (108KB) - Argentina LIMITED data ⚠️
4. `endpoint-comparison/` - Various endpoint tests

### Code Artifacts
- `analyze_coverage.js` - Data quality analyzer
- `test_direct_footystats_api.js` - API tester
- `footystats_endpoint_map.md` - Endpoint reference

---

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Fallback Logic (Immediate)
```javascript
// In footystats.routes.ts /match/:fsId handler
const potentials = {
  btts: fsMatch.btts_potential
    || fsMatch.h2h?.betting_stats?.bttsPercentage
    || null,

  over25: fsMatch.o25_potential
    || fsMatch.h2h?.betting_stats?.over25Percentage
    || null,

  // ... etc
};
```

### Phase 2: Derived Signals (Next Sprint)
```javascript
// Create: src/services/footystats/derived.signals.ts
export function calculateDerivedBTTS(match, homeStats, awayStats) {
  // Implementation from report
}
```

### Phase 3: Telegram Display (Final)
```javascript
// In telegram formatter
if (potentials.btts) {
  msg += `• BTTS: ${potentials.btts}% ⚽⚽\n`;
} else if (h2h?.btts_pct) {
  msg += `• BTTS: ${h2h.btts_pct}% (H2H) ⚽\n`;
}
```

---

## ✅ QUESTIONS ANSWERED

### Q1: "Are we getting full data from FootyStats?"
**A:** YES, for major leagues. `/match` endpoint returns complete data when available.

### Q2: "Why are potentials NULL for some matches?"
**A:** FootyStats API coverage limits. South America, Asia, lower divisions = limited data.

### Q3: "Can we derive missing potentials?"
**A:** YES, using H2H stats (always available) + season averages + formulas.

### Q4: "What's the best endpoint to use?"
**A:** `/api/footystats/match/:fsId` (already implemented correctly).

### Q5: "Do we need alternative field mappings?"
**A:** YES, H2H provides btts% and o25% as fallbacks. Team stats provide xG/corners/cards averages.

---

## 📌 FINAL RECOMMENDATION

### ✅ Keep Current Implementation
- `/api/footystats/match/:fsId` is correct
- No endpoint changes needed

### ✅ Add 3-Tier Fallback
1. Primary: FootyStats potentials
2. Fallback: H2H betting stats
3. Derived: Calculated signals

### ✅ Display Strategy
- **Full data leagues:** Show all potentials with "(FootyStats)" tag
- **Limited data leagues:** Show H2H-based signals with "(H2H)" tag
- **Corners/Cards:** Skip if NULL (non-critical metrics)
- **Trends:** Skip if NULL (nice-to-have, not essential)

---

## 🎯 SUCCESS METRICS

- ✅ 100% of matches show SOME betting signals (via fallbacks)
- ✅ Western Europe: Full FootyStats data
- ✅ Other regions: H2H-based fallback
- ✅ Telegram messages always have BTTS + O2.5 scores
- ✅ Clear data source indicators

---

**Status:** Ready for implementation
**Blocker:** None
**Risk:** Low (fallback hierarchy ensures data availability)

---

**Next Action:** Implement Phase 1 (H2H fallbacks) in next coding session.
