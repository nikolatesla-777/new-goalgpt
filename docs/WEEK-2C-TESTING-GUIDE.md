# Week-2C Testing Guide - Historical Data & Backtest

**Branch**: `phase-2C/backtest-calibration`
**Date**: 2026-01-29

---

## 📋 Prerequisites

1. **Database Connection**: Ensure `DATABASE_URL` is set in `.env`
2. **FootyStats API**: Valid `FOOTYSTATS_API_KEY` in `.env`
3. **Historical Matches**: `ts_matches` table should have completed matches (status_id = 8)

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
npm install
```

**New Dependencies**:
- `commander` - CLI framework for fetch:historical and backtest tools

### Step 2: Run Database Migration

Create the `fs_match_stats` table:

```bash
psql $DATABASE_URL -f src/database/migrations/create-fs-match-stats-table.sql
```

**Verify Migration**:
```bash
psql $DATABASE_URL -c "\d fs_match_stats"
```

Expected output:
```
Column              | Type                     | Collation | Nullable | Default
--------------------+--------------------------+-----------+----------+---------
id                  | uuid                     |           | not null | gen_random_uuid()
ts_match_id         | uuid                     |           | not null |
fs_match_id         | integer                  |           | not null |
btts_potential      | numeric(5,2)             |           |          |
o25_potential       | numeric(5,2)             |           |          |
...
```

---

## 🔍 Phase 1: Historical Data Fetch (Top 20 Leagues)

### Test 1: Small Sample (Last 30 Days, Top 5 Leagues)

```bash
npm run fetch:historical -- \
  --from 2025-12-30 \
  --to 2026-01-29 \
  --competitions 1,2,3,4,5 \
  --limit 500
```

**Expected Results**:
- Duration: ~5-10 minutes (depending on match count)
- Success Rate: > 80%
- Average Quality Score: > 70

**What to Monitor**:
- Rate limiting (should stay under 30 req/min)
- Match ID fuzzy matching success
- Data quality scores

### Test 2: Full 6 Months (Top 20 Leagues)

```bash
npm run fetch:historical -- \
  --from 2024-06-01 \
  --to 2024-12-31 \
  --competitions 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 \
  --limit 2500
```

**Expected Results**:
- Duration: ~1-1.5 hours
- Total Matches: 1,500-2,500
- Success Rate: > 75%
- Average Quality Score: > 65

**Competition IDs** (Top 20 Leagues):
```
1  - Premier League (England)
2  - LaLiga (Spain)
3  - Serie A (Italy)
4  - Bundesliga (Germany)
5  - Ligue 1 (France)
6  - Primeira Liga (Portugal)
7  - Eredivisie (Netherlands)
8  - Championship (England)
9  - Liga MX (Mexico)
10 - Brasileirão (Brazil)
11 - Super Lig (Turkey)
12 - Saudi Pro League
13 - MLS (USA)
14 - Russian Premier League
15 - Belgian Pro League
16 - Swiss Super League
17 - Austrian Bundesliga
18 - Scottish Premiership
19 - Danish Superliga
20 - Norwegian Eliteserien
```

---

## 📊 Data Quality Validation

### Check Fetch Results

```sql
-- Total fetched matches
SELECT COUNT(*) as total_matches,
       AVG(data_quality_score) as avg_quality
FROM fs_match_stats;

-- Quality distribution
SELECT
  CASE
    WHEN data_quality_score >= 80 THEN 'Excellent (80-100)'
    WHEN data_quality_score >= 60 THEN 'Good (60-79)'
    WHEN data_quality_score >= 40 THEN 'Fair (40-59)'
    ELSE 'Poor (0-39)'
  END as quality_tier,
  COUNT(*) as match_count,
  ROUND(AVG(data_quality_score), 1) as avg_score
FROM fs_match_stats
GROUP BY quality_tier
ORDER BY avg_score DESC;

-- Missing data analysis
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN team_a_xg_prematch IS NULL OR team_b_xg_prematch IS NULL THEN 1 ELSE 0 END) as missing_xg,
  SUM(CASE WHEN btts_potential IS NULL THEN 1 ELSE 0 END) as missing_btts,
  SUM(CASE WHEN o25_potential IS NULL THEN 1 ELSE 0 END) as missing_o25,
  SUM(CASE WHEN odds_ft_1 IS NULL OR odds_ft_x IS NULL OR odds_ft_2 IS NULL THEN 1 ELSE 0 END) as missing_odds
FROM fs_match_stats;
```

### Sample High-Quality Match

```sql
-- Get a high-quality match example
SELECT
  m.home_team,
  m.away_team,
  m.match_time,
  fs.data_quality_score,
  fs.team_a_xg_prematch,
  fs.team_b_xg_prematch,
  fs.btts_potential,
  fs.o25_potential,
  fs.odds_ft_1,
  fs.odds_ft_x,
  fs.odds_ft_2
FROM fs_match_stats fs
JOIN ts_matches m ON fs.ts_match_id = m.id
WHERE fs.data_quality_score >= 80
ORDER BY fs.data_quality_score DESC
LIMIT 5;
```

---

## 🎯 Phase 2: Backtest CLI (To Be Implemented)

### Run O2.5 Backtest

```bash
npm run backtest -- \
  --market O25 \
  --from 2024-06-01 \
  --to 2024-12-31 \
  --min-confidence 60
```

**Expected Output**:
```
╔═══════════════════════════════════════════════════════════╗
║   📊 Backtest Results - O25 (Over 2.5 Goals)             ║
╚═══════════════════════════════════════════════════════════╝

Period: 2024-06-01 to 2024-12-31
Total Predictions: 487
Settled: 477 | Won: 291 | Lost: 186 | Void: 10

📈 PERFORMANCE METRICS:
  Hit Rate: 61.01%
  ROI: 8.34%
  Avg Confidence: 67.2
  Avg Probability: 65.8%

📊 CALIBRATION:
  Calibration Error: 5.23%
  Bucket Analysis:
    60-70%: Predicted 65.0% | Actual 67.2% | Error: +2.2%
    70-80%: Predicted 75.0% | Actual 71.8% | Error: -3.2%

✅ VALIDATION: PASSED
  ✓ Hit Rate >= 58% (target: 58%)
  ✓ ROI >= 5% (target: 5%)
  ✓ Calibration <= 8% (target: 8%)
```

### Run All Markets

```bash
npm run backtest -- \
  --market all \
  --from 2024-06-01 \
  --to 2024-12-31 \
  --save
```

**Generates**:
- `docs/BACKTEST_RESULTS_2024-06-01_2024-12-31.md`
- Calibration curves (JSON)
- Threshold suggestions

---

## 📋 Data Quality Report (To Be Implemented)

```bash
npm run backtest:data-quality
```

**Expected Output**:
```
╔═══════════════════════════════════════════════════════════╗
║   📊 Data Quality Report                                 ║
╚═══════════════════════════════════════════════════════════╝

OVERALL QUALITY:
  Total Matches: 2,134
  Avg Quality Score: 72.5
  High Quality (>= 80): 1,245 (58.3%)
  Good Quality (60-79): 687 (32.2%)
  Low Quality (< 60): 202 (9.5%)

MISSING DATA BY FIELD:
  xG Data: 3.2% missing
  BTTS Potential: 5.1% missing
  O25 Potential: 4.8% missing
  Odds: 2.7% missing
  H2H Stats: 12.4% missing

PER-LEAGUE ANALYSIS:
  Premier League (1): 95.2% quality (EXCELLENT)
  LaLiga (2): 93.8% quality (EXCELLENT)
  Turkish Super Lig (11): 68.4% quality (GOOD)
  ...

⚠️  RISK FLAGS:
  - League 47 (Albanian Superliga): 42.1% quality (LOW) - RECOMMEND BLOCK
  - League 83 (Uzbekistan Super League): 38.9% quality (LOW) - RECOMMEND BLOCK
```

---

## 🔧 Troubleshooting

### Issue: Rate Limit Errors

**Symptoms**: 429 errors in logs
**Solution**: Increase delay between requests in footystats.client.ts

### Issue: Match Not Found in FootyStats

**Symptoms**: High skipped count (> 30%)
**Solution**:
- Check team name matching (fuzzy logic)
- Verify date format
- Use --competitions flag to target specific leagues

### Issue: Low Data Quality Scores

**Symptoms**: Avg quality < 60
**Solution**:
- Focus on top leagues (competitions 1-20)
- Increase historical date range
- Check FootyStats API response completeness

### Issue: Database Connection Timeout

**Symptoms**: "Connection terminated unexpectedly"
**Solution**:
```bash
# Check connection
npm run test-connection

# Verify DATABASE_URL
echo $DATABASE_URL
```

---

## 📝 Next Steps

After successful Phase 1 (Historical Fetch):

1. ✅ Verify data quality (avg score > 65)
2. ✅ Check missing data rates (< 15% for critical fields)
3. 🚀 Implement backtest CLI tool
4. 🚀 Run backtests for all 7 markets
5. 🚀 Generate calibration reports
6. 🚀 Tune thresholds based on results

---

**Last Updated**: 2026-01-29
**Status**: Phase 1 Ready for Testing
