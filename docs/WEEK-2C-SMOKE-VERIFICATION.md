# Week-2C Smoke Verification Guide

## Overview
This guide provides smoke test procedures for Week-2C: Historical Fetcher + Backtest CLI + Database Migrations.

## ⚠️ CRITICAL DEPENDENCY

**Week-2C requires Week-2A to be merged first.**

Week-2C uses:
- `componentEvaluators.ts` (Week-2A)
- `marketScorer.service.ts` (Week-2A)
- `ScoringFeatures` interface (Week-2A)

**Verification Order:**
1. ✅ Merge PR#5 (Week-2A) to main
2. ✅ Merge PR#6 (Week-2B) to main (optional, independent)
3. ⏳ Run smoke tests below
4. ✅ Merge PR#7 (Week-2C) to main

---

## Prerequisites

- Week-2A merged ✅
- Database access (staging or local)
- FootyStats API credentials configured
- Node.js environment ready

---

## STEP 1: Database Migrations

### Migration Files
```
src/database/migrations/
├── create-fs-match-stats-table.sql              (Historical FootyStats storage)
├── 20260128_create_scoring_predictions.sql      (Prediction tracking)
└── 20260128_create_scoring_backtest_results.sql (Backtest metrics)
```

### Run Migrations

```bash
# Connect to database
psql $DATABASE_URL

# Run migration 1: fs_match_stats
\i src/database/migrations/create-fs-match-stats-table.sql

# Run migration 2: scoring_predictions
\i src/database/migrations/20260128_create_scoring_predictions.sql

# Run migration 3: scoring_backtest_results
\i src/database/migrations/20260128_create_scoring_backtest_results.sql
```

### Verify Tables Created

```sql
-- Check fs_match_stats table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fs_match_stats'
ORDER BY ordinal_position;

-- Check scoring_predictions table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scoring_predictions'
ORDER BY ordinal_position;

-- Check scoring_backtest_results table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scoring_backtest_results'
ORDER BY ordinal_position;
```

**Expected:** All 3 tables exist with proper columns ✅

---

## STEP 2: Historical Data Fetcher

### Smoke Test: Fetch Last 7 Days (Limit 200 Matches)

```bash
# Set date range (last 7 days)
START_DATE=$(date -u -d "7 days ago" +%Y-%m-%d)
END_DATE=$(date -u +%Y-%m-%d)

# Run historical fetcher with limit
npx ts-node src/scripts/fetchHistorical.ts \
  --start $START_DATE \
  --end $END_DATE \
  --limit 200
```

**Expected Output:**
```
[HistoricalFetcher] Starting historical fetch
  Start Date: 2026-01-22
  End Date: 2026-01-29
  Limit: 200

[HistoricalFetcher] Fetching matches from FootyStats API...
[HistoricalFetcher] Fetched 200 matches

[HistoricalFetcher] Inserting into fs_match_stats...
[HistoricalFetcher] Inserted 200 matches (0 duplicates skipped)

✅ Historical fetch complete
  Total Matches: 200
  Inserted: 200
  Duplicates: 0
  Time: 12.3s
```

### Verify Data Inserted

```sql
-- Check fs_match_stats row count (should increase)
SELECT COUNT(*) as total_matches FROM fs_match_stats;

-- Check recent inserts
SELECT
  match_id,
  home_team_name,
  away_team_name,
  match_time,
  created_at
FROM fs_match_stats
ORDER BY created_at DESC
LIMIT 10;

-- Check date range
SELECT
  MIN(match_time) as earliest_match,
  MAX(match_time) as latest_match,
  COUNT(*) as total
FROM fs_match_stats
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

**Expected:**
- Row count increased by ~200 ✅
- Recent inserts visible ✅
- Date range covers last 7 days ✅

---

## STEP 3: Backtest Smoke Test

### Smoke Test: Backtest O25 Market (Last 7 Days)

```bash
# Run backtest for O25 market
npx ts-node src/scripts/backtest.ts \
  --market O25 \
  --start $START_DATE \
  --end $END_DATE
```

**Expected Output:**
```
[Backtest] Starting backtest for market: O25
  Start Date: 2026-01-22
  End Date: 2026-01-29

[Backtest] Fetching historical matches...
[Backtest] Found 187 settled matches (status_id = 8)

[Backtest] Generating predictions...
[Backtest] Progress: 50/187 (26.7%)
[Backtest] Progress: 100/187 (53.5%)
[Backtest] Progress: 150/187 (80.2%)
[Backtest] Progress: 187/187 (100.0%)

[Backtest] Evaluating predictions...
[Backtest] Settled: 187
[Backtest] Void: 0

[Backtest] Calculating performance metrics...

📊 Backtest Results - O25
─────────────────────────────────────
Total Predictions:    187
Settled:              187
Won:                  112
Lost:                  75
Void:                   0

Hit Rate:            59.89%
ROI:                  7.23%
Avg Odds:             2.15
Avg Confidence:      68.2
Avg Probability:     0.652

Calibration Error:    5.8%
─────────────────────────────────────

Calibration Curve:
  0-10%:   Predicted 0.05, Actual 0.03 (N=12)
 10-20%:   Predicted 0.15, Actual 0.18 (N=8)
 20-30%:   Predicted 0.25, Actual 0.22 (N=5)
 ...
 60-70%:   Predicted 0.65, Actual 0.68 (N=42)
 70-80%:   Predicted 0.75, Actual 0.71 (N=58)
 80-90%:   Predicted 0.85, Actual 0.82 (N=22)

✅ Validation: PASSED
  Hit Rate: 59.89% >= 58% (threshold) ✅
  ROI: 7.23% >= 5% (threshold) ✅
  Calibration Error: 5.8% <= 8% (threshold) ✅
```

### Verify Backtest Results Stored

```sql
-- Check scoring_backtest_results table
SELECT
  market_id,
  backtest_period,
  total_predictions,
  hit_rate,
  roi,
  calibration_error,
  created_at
FROM scoring_backtest_results
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- Backtest row inserted ✅
- Hit rate > 58% ✅
- ROI > 5% ✅
- Calibration error < 8% ✅

---

## STEP 4: All 7 Markets Backtest

### Run Full Suite (Optional)

```bash
# Run backtest for all 7 markets
for market in O25 BTTS HT_O05 O35 HOME_O15 CORNERS_O85 CARDS_O25; do
  echo "========================================="
  echo "Backtesting $market..."
  echo "========================================="

  npx ts-node src/scripts/backtest.ts \
    --market $market \
    --start $START_DATE \
    --end $END_DATE

  echo ""
done
```

**Expected:** Each market produces backtest results with validation status

---

## STEP 5: Backtest with Larger Date Range (Optional)

### 6-Month Backtest (Production Validation)

```bash
# Set 6-month range
START_DATE="2024-07-01"
END_DATE="2024-12-31"

# Run backtest for O25
npx ts-node src/scripts/backtest.ts \
  --market O25 \
  --start $START_DATE \
  --end $END_DATE \
  --save
```

**Expected:**
- 1000+ matches processed
- Hit rate 58-65%
- ROI 5-12%
- Calibration error < 8%
- Results saved to `scoring_backtest_results` table

---

## Verification Checklist

### Database Migrations
- [ ] `fs_match_stats` table created
- [ ] `scoring_predictions` table created
- [ ] `scoring_backtest_results` table created
- [ ] All tables have proper indexes
- [ ] All tables have proper constraints

### Historical Fetcher
- [ ] Fetch last 7 days (limit 200) completes successfully
- [ ] Data inserted into `fs_match_stats`
- [ ] Row count increased by expected amount
- [ ] No duplicates inserted
- [ ] Match data complete (xG, potentials, odds)

### Backtest CLI
- [ ] Backtest O25 (last 7 days) completes
- [ ] Results match expected format
- [ ] Hit rate >= 58%
- [ ] ROI >= 5%
- [ ] Calibration error <= 8%
- [ ] Results saved to database
- [ ] Calibration curve generated

### Integration
- [ ] Backtest uses Week-2A scoring pipeline correctly
- [ ] componentEvaluators functions work
- [ ] marketScorer.service integration works
- [ ] ScoringFeatures interface compatible

---

## Troubleshooting

### Issue: "Cannot find module componentEvaluators"
**Cause:** Week-2A not merged yet
**Solution:** Merge PR#5 (Week-2A) first, then retry

### Issue: "Table fs_match_stats does not exist"
**Cause:** Migrations not run
**Solution:** Run all 3 migrations (see STEP 1)

### Issue: "FootyStats API error"
**Cause:** API credentials missing or invalid
**Solution:** Check `FOOTYSTATS_API_KEY` in `.env`

### Issue: Backtest returns 0 matches
**Cause:** Date range too narrow or no settled matches
**Solution:** Expand date range or check match data availability

### Issue: Hit rate < 58%
**Cause:** Scoring algorithm needs tuning or insufficient data
**Solution:** Review market_registry.json thresholds, check data quality

---

## CLI Usage Reference

### fetchHistorical.ts

```bash
# Basic usage
npx ts-node src/scripts/fetchHistorical.ts \
  --start YYYY-MM-DD \
  --end YYYY-MM-DD \
  [--limit NUMBER]

# Examples
npx ts-node src/scripts/fetchHistorical.ts --start 2024-01-01 --end 2024-12-31
npx ts-node src/scripts/fetchHistorical.ts --start 2024-06-01 --end 2024-06-30 --limit 500
```

### backtest.ts

```bash
# Basic usage
npx ts-node src/scripts/backtest.ts \
  --market MARKET_ID \
  --start YYYY-MM-DD \
  --end YYYY-MM-DD \
  [--save]

# Examples
npx ts-node src/scripts/backtest.ts --market O25 --start 2024-01-01 --end 2024-12-31
npx ts-node src/scripts/backtest.ts --market BTTS --start 2024-06-01 --end 2024-12-31 --save
npx ts-node src/scripts/backtest.ts --market all --start 2024-01-01 --end 2024-12-31 --save
```

---

## Expected Performance Targets

| Market | Hit Rate | ROI | Calibration Error |
|--------|----------|-----|-------------------|
| **O25** | 60-65% | 8-12% | <6% |
| **BTTS** | 58-62% | 7-10% | <7% |
| **HT_O05** | 62-68% | 10-15% | <5% |
| **O35** | 55-60% | 5-8% | <10% |
| **HOME_O15** | 58-62% | 7-10% | <8% |
| **CORNERS_O85** | 55-58% | 3-6% | <12% |
| **CARDS_O25** | 52-56% | 3-5% | <15% |

---

## Post-Verification

### Create Smoke Test Summary

Document results in a markdown file:

```markdown
# Week-2C Smoke Test Results

## Database Migrations
✅ All 3 tables created
✅ fs_match_stats: 200 rows inserted

## Historical Fetcher
✅ Fetch completed: 200 matches
✅ Data quality verified

## Backtest Results
Market: O25
Hit Rate: 59.89% ✅
ROI: 7.23% ✅
Calibration Error: 5.8% ✅

## Status: VERIFIED ✅
Ready for merge to main.
```

---

**Last Updated:** 2026-01-29
**For:** Week-2C PR#7 Smoke Verification
**Dependency:** Requires Week-2A PR#5 merged first
