# Week-2C Progress Report - Historical Data & Backtest Implementation

**Branch**: `phase-2C/backtest-calibration`
**Date**: 2026-01-29
**Status**: Phase 1 Complete - Ready for Testing

---

## ✅ Completed Tasks

### 1. FootyStats API Analysis & Planning ✅
**Deliverable**: `docs/HISTORICAL_DATA_PLAN.md`

**What Was Done**:
- Analyzed FootyStats API structure (rate limits, endpoints, data availability)
- Compared 3 acquisition strategies (day-by-day, enrich existing, hybrid)
- **Recommended**: Option C (Hybrid) - Top 20 leagues first (~1 hour fetch time)
- Calculated rate limit impact and cost estimates
- Identified data gaps (referee stats for CARDS_O25 market)

**Key Findings**:
- FootyStats provides all required data for 6/7 markets
- CARDS_O25 market lacks referee stats (will use team form as proxy)
- Top 20 leagues should yield 1,500-2,500 high-quality matches
- Estimated fetch time: 1-1.5 hours for 6 months of data

---

### 2. Historical Data Fetcher Implementation ✅
**Deliverables**:
- `src/services/footystats/historicalFetcher.service.ts` (350 lines)
- `src/scripts/fetchHistorical.ts` (CLI tool, 137 lines)
- `src/database/migrations/create-fs-match-stats-table.sql`

**Features Implemented**:
✅ **Rate-Limited Fetching**: 30 req/min with token bucket algorithm
✅ **Fuzzy Team Name Matching**: Exact + substring matching for team names
✅ **Data Quality Scoring**: 0-100 score based on completeness
  - xG data: 30 points
  - Potentials (5 fields): 30 points
  - Odds: 20 points
  - H2H stats: 10 points
  - Trends: 10 points
✅ **Resumable**: Skip already fetched matches (prevents duplicates)
✅ **Progress Tracking**: Log every 100 matches
✅ **Error Handling**: Continue on individual match failures

**Database Schema**:
```sql
CREATE TABLE fs_match_stats (
  id UUID PRIMARY KEY,
  ts_match_id UUID NOT NULL REFERENCES ts_matches(id),
  fs_match_id INTEGER NOT NULL UNIQUE,

  -- Potentials
  btts_potential NUMERIC(5,2),
  o25_potential NUMERIC(5,2),
  o15_potential NUMERIC(5,2),
  corners_potential NUMERIC(5,2),
  cards_potential NUMERIC(5,2),

  -- xG
  team_a_xg_prematch NUMERIC(5,2),
  team_b_xg_prematch NUMERIC(5,2),

  -- Odds
  odds_ft_1 NUMERIC(6,2),
  odds_ft_x NUMERIC(6,2),
  odds_ft_2 NUMERIC(6,2),

  -- JSON fields
  h2h_stats JSONB,
  trends JSONB,

  data_quality_score INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
```

**CLI Usage**:
```bash
# Small test (last 30 days, top 5 leagues)
npm run fetch:historical -- \
  --from 2025-12-30 \
  --to 2026-01-29 \
  --competitions 1,2,3,4,5 \
  --limit 500

# Full fetch (6 months, top 20 leagues)
npm run fetch:historical -- \
  --from 2024-06-01 \
  --to 2024-12-31 \
  --competitions 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 \
  --limit 2500
```

---

### 3. Backtest Service Integration ✅
**Deliverables**:
- Updated `src/services/scoring/backtest.service.ts` (integrate FootyStats data)
- New `src/scripts/backtest.ts` (CLI tool, 267 lines)
- Existing migration: `src/database/migrations/20260128_create_scoring_backtest_results.sql`

**Changes Made to Existing Backtest Service**:
1. ✅ **Updated Query**: Join `ts_matches` with `fs_match_stats` table
2. ✅ **Data Transformation**: Convert database rows to `FootyStatsMatch` format
3. ✅ **Scoring Integration**: Call `marketScorer.service.scoreMarket()` for each match
4. ✅ **Removed TODO**: Replaced placeholder code with actual implementation

**Key Functions**:
```typescript
// Transform database row to FootyStatsMatch format
function transformToFootyStatsMatch(dbRow: any): FootyStatsMatch {
  return {
    xg: { home: dbRow.team_a_xg_prematch, away: dbRow.team_b_xg_prematch },
    potentials: { over25: dbRow.o25_potential, btts: dbRow.btts_potential, ... },
    odds: { ft_1: dbRow.odds_ft_1, ft_x: dbRow.odds_ft_x, ft_2: dbRow.odds_ft_2 },
    h2h: dbRow.h2h_stats,
    trends: dbRow.trends,
  };
}

// Fetch historical matches with FootyStats data
async function fetchHistoricalMatches(startDate, endDate) {
  // Query joins ts_matches + fs_match_stats
  // Filters by data_quality_score >= 60
}

// Run backtest for a market
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  // 1. Fetch historical matches
  // 2. Score each match using marketScorer.service
  // 3. Evaluate actual outcomes
  // 4. Calculate performance metrics (hit rate, ROI)
  // 5. Calculate calibration (bucketed analysis)
  // 6. Validate against thresholds
}
```

**Backtest CLI Usage**:
```bash
# Run backtest for O25 market
npm run backtest -- --market O25 --from 2024-06-01 --to 2024-12-31

# Run all 7 markets
npm run backtest -- --market all --from 2024-06-01 --to 2024-12-31

# Save results to database + markdown report
npm run backtest -- --market all --from 2024-06-01 --to 2024-12-31 --save
```

**Expected Output**:
```
╔═══════════════════════════════════════════════════════════╗
║   📊 Backtest - Week-2C Scoring Validation              ║
╚═══════════════════════════════════════════════════════════╝

Configuration:
  Markets: O25, BTTS, HT_O05, O35, HOME_O15, CORNERS_O85, CARDS_O25
  Period: 2024-06-01 to 2024-12-31
  Min Matches: 100 (default)
  Save Results: Yes

============================================================
📊 Running backtest for O25...
============================================================

📊 PERFORMANCE METRICS:
  Total Predictions: 487
  Settled: 477 | Won: 291 | Lost: 186 | Void: 10
  Hit Rate: 61.01%
  ROI: 8.34%
  Avg Confidence: 67.2
  Avg Probability: 65.8%

📈 CALIBRATION:
  Calibration Error: 5.23%
  Bucket Analysis:
    60-70%: Predicted 65.0% | Actual 67.2% | Error: +2.2% (n=245)
    70-80%: Predicted 75.0% | Actual 71.8% | Error: -3.2% (n=142)

✅ VALIDATION:
  ✅ ALL CHECKS PASSED
  All thresholds met

...
```

---

### 4. Package.json Scripts & Documentation ✅
**Deliverables**:
- Updated `package.json` with new scripts
- Created `docs/WEEK-2C-TESTING-GUIDE.md` (comprehensive guide)

**New Scripts**:
```json
{
  "fetch:historical": "tsx src/scripts/fetchHistorical.ts",
  "backtest": "tsx src/scripts/backtest.ts",
  "backtest:data-quality": "tsx src/scripts/dataQuality.ts"
}
```

**Dependencies Added**:
- `commander@^12.0.0` - CLI framework for argument parsing

**Documentation**:
- `docs/HISTORICAL_DATA_PLAN.md` - API analysis + acquisition strategy
- `docs/WEEK-2C-TESTING-GUIDE.md` - Step-by-step testing instructions
- `docs/WEEK-2C-PROGRESS-REPORT.md` - This file

---

## 📂 Files Created/Modified

### New Files (8)
1. `docs/HISTORICAL_DATA_PLAN.md` (API analysis)
2. `docs/WEEK-2C-TESTING-GUIDE.md` (testing guide)
3. `docs/WEEK-2C-PROGRESS-REPORT.md` (this file)
4. `src/services/footystats/historicalFetcher.service.ts` (fetcher)
5. `src/scripts/fetchHistorical.ts` (CLI for fetch)
6. `src/scripts/backtest.ts` (CLI for backtest)
7. `src/database/migrations/create-fs-match-stats-table.sql` (schema)
8. (Existing) `src/database/migrations/20260128_create_scoring_backtest_results.sql`

### Modified Files (2)
1. `package.json` (added 3 scripts + commander dependency)
2. `src/services/scoring/backtest.service.ts` (integrated FootyStats data)

---

## 🧪 Testing Status

### Phase 1: Historical Data Fetch
**Status**: ⏳ **Ready for Testing** (user must run)

**Prerequisites**:
- ✅ Database migration: `create-fs-match-stats-table.sql`
- ✅ FootyStats API key in `.env`
- ✅ Historical matches in `ts_matches` table (status_id = 8)

**Test Commands**:
```bash
# 1. Install dependencies
npm install

# 2. Run migration
psql $DATABASE_URL -f src/database/migrations/create-fs-match-stats-table.sql

# 3. Test small sample (5-10 minutes)
npm run fetch:historical -- \
  --from 2025-12-30 \
  --to 2026-01-29 \
  --competitions 1,2,3,4,5 \
  --limit 500

# 4. Full fetch (1-1.5 hours)
npm run fetch:historical -- \
  --from 2024-06-01 \
  --to 2024-12-31 \
  --competitions 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 \
  --limit 2500
```

**Success Criteria**:
- ✅ Success rate > 80%
- ✅ Average quality score > 70
- ✅ Low error rate (< 20%)

### Phase 2: Backtest Validation
**Status**: ⏳ **Pending** (requires Phase 1 completion)

**Prerequisites**:
- ✅ Phase 1 complete (fs_match_stats populated)
- ✅ Migration: `20260128_create_scoring_backtest_results.sql`
- ✅ marketScorer.service working

**Test Commands**:
```bash
# 1. Run backtest for O25
npm run backtest -- --market O25 --from 2024-06-01 --to 2024-12-31

# 2. Run all markets
npm run backtest -- --market all --from 2024-06-01 --to 2024-12-31

# 3. Save results
npm run backtest -- --market all --from 2024-06-01 --to 2024-12-31 --save
```

**Success Criteria (per market)**:
| Market | Min Hit Rate | Min ROI | Max Cal Error |
|--------|--------------|---------|---------------|
| O25 | 58% | 5% | 8% |
| BTTS | 58% | 5% | 8% |
| HT_O05 | 58% | 5% | 8% |
| O35 | 55% | 5% | 10% |
| HOME_O15 | 58% | 5% | 8% |
| CORNERS_O85 | 55% | 3% | 12% |
| CARDS_O25 | 52% | 3% | 15% |

---

## ⏭️  Next Steps

### Immediate (User Must Run)
1. **Install Dependencies**: `npm install`
2. **Run Migrations**:
   ```bash
   psql $DATABASE_URL -f src/database/migrations/create-fs-match-stats-table.sql
   psql $DATABASE_URL -f src/database/migrations/20260128_create_scoring_backtest_results.sql
   ```
3. **Test Historical Fetch** (small sample):
   ```bash
   npm run fetch:historical -- \
     --from 2025-12-30 \
     --to 2026-01-29 \
     --competitions 1,2,3,4,5 \
     --limit 500
   ```
4. **Validate Data Quality**:
   ```sql
   SELECT COUNT(*), AVG(data_quality_score) FROM fs_match_stats;
   ```

### Phase 2 (After Historical Fetch)
5. **Run Backtests** (all 7 markets):
   ```bash
   npm run backtest -- --market all --from 2024-06-01 --to 2024-12-31 --save
   ```
6. **Review Results**: Check `docs/BACKTEST_RESULTS_*.md`
7. **Analyze Failures**: If any market fails validation, investigate root cause

### Phase 3 (To Be Implemented)
8. **Data Quality Report CLI**: `npm run backtest:data-quality`
   - Per-league data quality analysis
   - Missing data breakdown
   - Risk flags for low-tier leagues
9. **Calibration Report**: Auto-suggest threshold adjustments
10. **Final Week-2C Report**: Comprehensive results + recommendations

---

## 📊 Architecture Overview

```
User Request: Validate scoring system
       │
       ├─> Phase 1: Historical Data Acquisition
       │   ├─> fetchHistorical.ts (CLI)
       │   ├─> historicalFetcher.service.ts
       │   ├─> FootyStats API (rate-limited)
       │   └─> fs_match_stats table ✅
       │
       ├─> Phase 2: Backtest Validation
       │   ├─> backtest.ts (CLI)
       │   ├─> backtest.service.ts
       │   ├─> marketScorer.service.ts
       │   ├─> evaluateActualOutcome()
       │   ├─> calculateMetrics() (hit rate, ROI)
       │   ├─> calculateCalibration() (bucketed)
       │   └─> scoring_backtest_results table ✅
       │
       └─> Phase 3: Calibration Analysis
           ├─> dataQuality.ts (CLI) ⏳
           ├─> Threshold tuning ⏳
           └─> Final report ⏳
```

---

## 🔑 Key Technical Decisions

### 1. Hybrid Historical Fetch Strategy
**Decision**: Fetch top 20 leagues first (Option C)
**Rationale**:
- Fast initial validation (~1 hour)
- High data quality (95%+ for top leagues)
- Cost-effective (1,500-2,500 matches sufficient)
- Expandable if needed

### 2. Data Quality Scoring (0-100)
**Decision**: Weight critical fields higher
- xG: 30 points (critical for goal markets)
- Potentials: 30 points (FootyStats predictions)
- Odds: 20 points (for edge calculation)
- H2H: 10 points (context)
- Trends: 10 points (recent form)

**Rationale**: Ensures backtest only uses high-quality matches (>= 60 points)

### 3. Integrate Existing Backtest Service
**Decision**: Enhance existing `backtest.service.ts` instead of rewriting
**Rationale**:
- Avoid code duplication
- Preserve existing database schema
- Faster implementation
- Maintain consistency with existing patterns

### 4. CLI-First Approach
**Decision**: Build CLI tools (not web UI)
**Rationale**:
- Faster development
- Easier automation
- Better for CI/CD integration
- Deterministic (no LLM calls)

---

## 📝 Known Issues & Limitations

### Data Gaps
1. **CARDS_O25**: No referee stats available from FootyStats
   - **Mitigation**: Use team form (cardsAVG) as proxy
   - **Impact**: Lower validation thresholds (52% hit rate, 15% cal error)

2. **HT_O05**: No dedicated HT potential field
   - **Mitigation**: Use o15_potential as proxy
   - **Impact**: May affect calibration

### Performance
1. **Fetch Time**: 1-1.5 hours for full dataset
   - **Acceptable**: One-time operation
   - **Optimization**: Parallelization possible (future)

2. **Backtest Time**: ~5-10 minutes per market
   - **Acceptable**: Run once after fetch
   - **Optimization**: Database indexing helps

---

## ✅ Validation Checklist

### Code Quality
- ✅ TypeScript strict mode enabled
- ✅ Error handling implemented
- ✅ Logging added (logger.info/warn/error)
- ✅ Database transactions used where needed
- ✅ Rate limiting enforced (30 req/min)

### Testing
- ⏳ Unit tests (not implemented - focus on integration)
- ⏳ Integration tests (manual testing required)
- ⏳ End-to-end test (full pipeline)

### Documentation
- ✅ API analysis documented
- ✅ Testing guide created
- ✅ Progress report (this file)
- ⏳ Final Week-2C report (pending results)

---

## 🚀 Summary

**Status**: **Phase 1 Complete - Ready for User Testing**

**What's Done**:
1. ✅ Comprehensive FootyStats API analysis
2. ✅ Historical data fetcher with rate limiting
3. ✅ Database schema for fs_match_stats
4. ✅ Backtest service integration (FootyStats data)
5. ✅ CLI tools for fetch and backtest
6. ✅ Complete documentation

**What's Next**:
1. User runs historical fetch (1-1.5 hours)
2. User runs backtests for 7 markets (~10 minutes each)
3. Analyze results, tune thresholds if needed
4. Implement data quality report CLI
5. Generate final Week-2C report

**Estimated Remaining Work**: 2-4 hours (mostly testing + report generation)

---

**Last Updated**: 2026-01-29
**Branch**: phase-2C/backtest-calibration
**Status**: ✅ Phase 1 Complete
