# Historical Data Acquisition Plan - Week-2C

**Version:** 1.0.0
**Date:** 2026-01-29
**Purpose:** Acquire historical match data from FootyStats API for backtest + calibration

---

## 🎯 Objective

Fetch 6-12 months of historical match data with complete FootyStats statistics (xG, potentials, odds, trends, H2H) to enable:
- **Backtest validation** of scoring model accuracy
- **Calibration** of confidence/probability thresholds
- **Data quality assessment** per league/market

---

## 📊 Current State Analysis

### Available Data Sources

#### 1. TheSports API (ts_matches table)
**Strengths:**
- ✅ Already synced with ts_matches table (10,000+ matches)
- ✅ Match IDs, scores, status, timestamps available
- ✅ Covers 100+ competitions

**Limitations:**
- ❌ NO xG data
- ❌ NO betting potentials
- ❌ NO H2H statistics
- ❌ NO trend data

**Conclusion:** TheSports data provides **match skeleton** (who played, final score) but lacks **betting intelligence** needed for model validation.

#### 2. FootyStats API
**Strengths:**
- ✅ xG (Expected Goals) for both teams
- ✅ Betting potentials (btts, o25, o15, corners, cards)
- ✅ H2H statistics (avg_goals, bttsPercentage)
- ✅ Team form & trends
- ✅ Odds data (ft_1, ft_x, ft_2)

**Limitations:**
- ⚠️ Rate limit: 30 requests/minute (max burst: 10)
- ⚠️ No bulk "league-matches" endpoint (must fetch match-by-match or day-by-day)
- ⚠️ API cost per request (check with PM if budget constraint exists)

---

## 🔀 Historical Data Acquisition Strategies

### Option A: Day-by-Day Fetch (`/todays-matches`)

**Method:**
```
FOR EACH date FROM 2024-01-01 TO 2024-12-31:
  1. GET /todays-matches?date=YYYY-MM-DD
  2. For each match in response:
     - Check if match finished (status = 'finished')
     - GET /match?match_id={id} for full stats
  3. Store in fs_match_history table
```

**Pros:**
- ✅ Simple API usage pattern
- ✅ Gets all matches for a day (across all leagues)
- ✅ Can parallelize by date range (e.g., 10 workers, each handling 36 days)

**Cons:**
- ❌ **365 requests** for todays-matches (1 per day)
- ❌ **~10,000+ requests** for match details (assuming 30 matches/day avg)
- ❌ Total: ~10,365 requests ÷ 30 req/min = **~345 minutes (~6 hours)**
- ❌ No filtering by league (gets ALL matches, including low-tier)

**Rate Limit Impact:**
- With 30 req/min: 365 date requests = 12 minutes
- With 30 req/min: 10,000 match requests = 333 minutes (~5.5 hours)
- **Total**: ~6 hours for full year

**Cost Estimation:**
- Assuming FootyStats charges per request: **~10,365 requests**
- If tiered pricing, check if "bulk match" endpoints reduce cost

---

### Option B: Enrich Existing TheSports Matches

**Method:**
```
1. SELECT ts_match_id, ts_external_id, footystats_id FROM ts_matches
   WHERE status_id = 8 (ENDED)
     AND match_time >= '2024-01-01'
     AND match_time <= '2024-12-31'
     AND competition_id IN (tracked_leagues)
   LIMIT 5000

2. FOR EACH match:
   - IF footystats_id EXISTS:
       GET /match?match_id={footystats_id}
   - ELSE:
       Search FootyStats by home_team + away_team + date
       (or skip if no mapping)

3. Store in fs_match_stats table (linked to ts_matches via foreign key)
```

**Pros:**
- ✅ Only fetch matches we care about (tracked leagues)
- ✅ Leverage existing ts_matches data (no need to re-discover matches)
- ✅ Can filter by competition_id (e.g., only top 20 leagues)
- ✅ Reduced API calls (~2,000-5,000 instead of 10,000+)

**Cons:**
- ❌ Requires ts_matches ↔ FootyStats match ID mapping
- ❌ If footystats_id is NULL, must perform fuzzy match (team names + date)
- ❌ Some matches may not be in FootyStats (lower leagues)

**Rate Limit Impact:**
- With 30 req/min: 3,000 matches = 100 minutes (~1.7 hours)
- **Much faster** than Option A

---

### Option C: Hybrid Approach (RECOMMENDED)

**Method:**
```
PHASE 1: Target High-Priority Leagues (Fast)
1. SELECT match_id FROM ts_matches
   WHERE status_id = 8
     AND competition_id IN (top_20_leagues)
     AND match_time >= '2024-06-01' (last 6 months)
   → ~1,500-2,500 matches

2. Enrich with FootyStats /match endpoint
   → 1,500-2,500 requests ÷ 30 req/min = 50-83 minutes (~1 hour)

PHASE 2: Expand to All Tracked Leagues (Optional)
3. If PHASE 1 backtest results are promising:
   Expand to all tracked leagues (100 leagues)
   → Additional 3,000-5,000 matches (~2-3 hours)
```

**Pros:**
- ✅ **Fast initial validation** (1 hour to get top leagues)
- ✅ Can run backtest after PHASE 1 and decide if PHASE 2 is needed
- ✅ Focused on high-quality data (top leagues have better FootyStats coverage)
- ✅ Minimizes API costs (pay for what matters)

**Cons:**
- ⚠️ Two-phase approach requires manual decision point
- ⚠️ Lower-tier leagues won't be backtested initially

---

## 🏆 Recommended Strategy: **Option C (Hybrid)**

**Reasoning:**
1. **Speed:** Get initial results in ~1 hour (top 20 leagues, 6 months)
2. **Cost-effective:** Only 1,500-2,500 API calls for initial validation
3. **Data quality:** Top leagues have best FootyStats coverage (fewer missing fields)
4. **Iterative:** Can expand if PHASE 1 shows good calibration

---

## 🛠️ Implementation Plan

### Step 1: Database Schema

Create `fs_match_stats` table to store FootyStats data:

```sql
CREATE TABLE fs_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts_match_id UUID NOT NULL REFERENCES ts_matches(id), -- Link to TheSports match
  fs_match_id INTEGER NOT NULL UNIQUE,                 -- FootyStats match ID

  -- Basic info
  home_team_fs_id INTEGER,
  away_team_fs_id INTEGER,
  status VARCHAR(20),
  date_unix BIGINT,

  -- Potentials
  btts_potential NUMERIC(5,2),
  o25_potential NUMERIC(5,2),
  o15_potential NUMERIC(5,2),
  avg_potential NUMERIC(5,2),
  corners_potential NUMERIC(5,2),
  cards_potential NUMERIC(5,2),

  -- xG
  team_a_xg_prematch NUMERIC(5,2),
  team_b_xg_prematch NUMERIC(5,2),

  -- Odds
  odds_ft_1 NUMERIC(6,2),
  odds_ft_x NUMERIC(6,2),
  odds_ft_2 NUMERIC(6,2),

  -- H2H (JSON)
  h2h_stats JSONB,

  -- Trends (JSON)
  trends JSONB,

  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  data_quality_score INTEGER, -- 0-100 (how complete is the data?)

  CONSTRAINT unique_fs_match UNIQUE(fs_match_id)
);

CREATE INDEX idx_fs_match_stats_ts_match ON fs_match_stats(ts_match_id);
CREATE INDEX idx_fs_match_stats_fs_id ON fs_match_stats(fs_match_id);
CREATE INDEX idx_fs_match_stats_fetched ON fs_match_stats(fetched_at);
```

### Step 2: Match ID Mapping

**Option 2a: Manual Mapping Table (if existing)**
```sql
-- Check if ts_matches already has footystats_id column
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS footystats_id INTEGER;
```

**Option 2b: Fuzzy Match (if no existing mapping)**
```typescript
async function findFootyStatsMatch(
  homeTeam: string,
  awayTeam: string,
  matchDate: string
): Promise<number | null> {
  // 1. Try exact team name match
  const response = await footyStatsAPI.getTodaysMatches(matchDate);
  const match = response.data.find(m =>
    m.home_name.toLowerCase() === homeTeam.toLowerCase() &&
    m.away_name.toLowerCase() === awayTeam.toLowerCase()
  );

  if (match) return match.id;

  // 2. Try fuzzy match (Levenshtein distance or similar)
  // ... (implement if needed)

  return null;
}
```

### Step 3: Historical Data Fetcher Service

**File:** `src/services/footystats/historicalFetcher.service.ts`

```typescript
/**
 * Historical Match Data Fetcher
 *
 * Fetches FootyStats data for historical matches from ts_matches table
 * Rate-limited and resumable
 */

import { footyStatsAPI } from './footystats.client';
import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';

interface FetchConfig {
  startDate: string;      // '2024-01-01'
  endDate: string;        // '2024-12-31'
  competitions?: number[]; // Filter by competition_id
  limit?: number;         // Max matches to fetch
  skipExisting?: boolean; // Skip if fs_match_stats already exists
}

export async function fetchHistoricalData(config: FetchConfig): Promise<void> {
  const { startDate, endDate, competitions, limit, skipExisting = true } = config;

  logger.info('[HistoricalFetcher] Starting historical data fetch', { config });

  // 1. Get target matches from ts_matches
  let query = `
    SELECT
      m.id as ts_match_id,
      m.external_id as ts_external_id,
      m.home_team,
      m.away_team,
      m.match_time,
      m.home_score_display,
      m.away_score_display,
      m.status_id
    FROM ts_matches m
    WHERE m.status_id = 8  -- ENDED
      AND m.match_time >= $1::timestamptz
      AND m.match_time <= $2::timestamptz
  `;

  const params: any[] = [startDate, endDate];

  if (competitions && competitions.length > 0) {
    query += ` AND m.competition_id = ANY($${params.length + 1})`;
    params.push(competitions);
  }

  if (skipExisting) {
    query += ` AND NOT EXISTS (
      SELECT 1 FROM fs_match_stats fs
      WHERE fs.ts_match_id = m.id
    )`;
  }

  query += ` ORDER BY m.match_time DESC`;

  if (limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  const result = await pool.query(query, params);
  const matches = result.rows;

  logger.info(`[HistoricalFetcher] Found ${matches.length} matches to fetch`);

  // 2. Fetch FootyStats data for each match
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    try {
      // 2a. Find FootyStats match ID (fuzzy match if needed)
      const fsMatchId = await findFootyStatsMatchId(
        match.home_team,
        match.away_team,
        match.match_time
      );

      if (!fsMatchId) {
        logger.warn('[HistoricalFetcher] FootyStats match not found', {
          ts_match_id: match.ts_match_id,
          home: match.home_team,
          away: match.away_team,
        });
        errorCount++;
        continue;
      }

      // 2b. Fetch full match data
      const fsData = await footyStatsAPI.getMatchDetails(fsMatchId);

      // 2c. Calculate data quality score
      const qualityScore = calculateDataQuality(fsData.data);

      // 2d. Store in fs_match_stats
      await pool.query(
        `INSERT INTO fs_match_stats (
          ts_match_id, fs_match_id,
          home_team_fs_id, away_team_fs_id,
          status, date_unix,
          btts_potential, o25_potential, o15_potential,
          avg_potential, corners_potential, cards_potential,
          team_a_xg_prematch, team_b_xg_prematch,
          odds_ft_1, odds_ft_x, odds_ft_2,
          h2h_stats, trends,
          data_quality_score
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        ON CONFLICT (fs_match_id) DO NOTHING`,
        [
          match.ts_match_id,
          fsMatchId,
          fsData.data.homeID,
          fsData.data.awayID,
          fsData.data.status,
          fsData.data.date_unix,
          fsData.data.btts_potential,
          fsData.data.o25_potential,
          fsData.data.o15_potential,
          fsData.data.avg_potential,
          fsData.data.corners_potential,
          fsData.data.cards_potential,
          fsData.data.team_a_xg_prematch,
          fsData.data.team_b_xg_prematch,
          fsData.data.odds_ft_1,
          fsData.data.odds_ft_x,
          fsData.data.odds_ft_2,
          JSON.stringify(fsData.data.h2h),
          JSON.stringify(fsData.data.trends),
          qualityScore,
        ]
      );

      successCount++;

      if ((i + 1) % 100 === 0) {
        logger.info(`[HistoricalFetcher] Progress: ${i + 1}/${matches.length} (${successCount} success, ${errorCount} errors)`);
      }
    } catch (error) {
      logger.error(`[HistoricalFetcher] Error fetching match`, {
        ts_match_id: match.ts_match_id,
        error: error instanceof Error ? error.message : String(error),
      });
      errorCount++;
    }
  }

  logger.info('[HistoricalFetcher] Fetch complete', {
    total: matches.length,
    success: successCount,
    errors: errorCount,
  });
}

function calculateDataQuality(fsMatch: any): number {
  let score = 0;

  // xG data (30 points)
  if (fsMatch.team_a_xg_prematch && fsMatch.team_b_xg_prematch) score += 30;

  // Potentials (30 points)
  if (fsMatch.btts_potential) score += 6;
  if (fsMatch.o25_potential) score += 6;
  if (fsMatch.o15_potential) score += 6;
  if (fsMatch.corners_potential) score += 6;
  if (fsMatch.cards_potential) score += 6;

  // Odds (20 points)
  if (fsMatch.odds_ft_1 && fsMatch.odds_ft_x && fsMatch.odds_ft_2) score += 20;

  // H2H (10 points)
  if (fsMatch.h2h && fsMatch.h2h.betting_stats) score += 10;

  // Trends (10 points)
  if (fsMatch.trends && fsMatch.trends.home && fsMatch.trends.away) score += 10;

  return score;
}
```

### Step 4: CLI Tool for Historical Fetch

**File:** `src/scripts/fetchHistorical.ts`

```bash
# Usage:
npm run fetch:historical -- --from 2024-06-01 --to 2024-12-31 --competitions 1,2,3 --limit 2000
```

**Implementation:**
```typescript
import { program } from 'commander';
import { fetchHistoricalData } from '../services/footystats/historicalFetcher.service';

program
  .requiredOption('--from <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--to <date>', 'End date (YYYY-MM-DD)')
  .option('--competitions <ids>', 'Comma-separated competition IDs')
  .option('--limit <number>', 'Max matches to fetch', '2000')
  .option('--skip-existing', 'Skip already fetched matches', true)
  .parse();

const options = program.opts();

const config = {
  startDate: options.from,
  endDate: options.to,
  competitions: options.competitions?.split(',').map(Number),
  limit: parseInt(options.limit),
  skipExisting: options.skipExisting,
};

fetchHistoricalData(config)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
```

---

## 📊 Rate Limiting Strategy

### Token Bucket Implementation (Already Exists)

**Current:** 30 requests/minute, max burst 10
- Refill rate: 0.5 tokens/second
- Max tokens: 10

**For 2,000 matches:**
- Time: 2,000 ÷ 30 = 67 minutes (~1.1 hours)
- With retries: ~1.5 hours

### Caching Strategy

**1. In-Memory Cache (Short-term)**
```typescript
const matchCache = new Map<number, FootyStatsMatch>();

async function getMatchDetails(matchId: number): Promise<FootyStatsMatch> {
  if (matchCache.has(matchId)) {
    return matchCache.get(matchId)!;
  }

  const data = await footyStatsAPI.getMatchDetails(matchId);
  matchCache.set(matchId, data.data);
  return data.data;
}
```

**2. Database Cache (Long-term)**
- fs_match_stats table acts as permanent cache
- Check `fetched_at` timestamp; re-fetch if > 30 days old (for "live" data only)
- Historical matches (status = 'finished') never re-fetch

---

## ✅ Execution Plan

### PHASE 1: Top 20 Leagues (6 months)

**Target:**
- Leagues: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, etc. (top 20)
- Period: 2024-06-01 to 2024-12-31
- Expected matches: ~1,500-2,500

**Commands:**
```bash
# 1. Create database table
npm run migrate -- create-fs-match-stats

# 2. Fetch historical data
npm run fetch:historical -- \
  --from 2024-06-01 \
  --to 2024-12-31 \
  --competitions 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 \
  --limit 2500

# 3. Verify data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fs_match_stats"
```

**Timeline:**
- Migration: 1 minute
- Fetch: ~1.5 hours
- **Total: ~1.5 hours**

### PHASE 2: All Tracked Leagues (Optional)

**If PHASE 1 backtest results are promising:**
- Expand to all 100+ tracked leagues
- Additional ~3,000-5,000 matches
- Timeline: ~3-4 hours

---

## 🚨 Risk Mitigation

### 1. API Rate Limit Errors
**Mitigation:**
- Exponential backoff on 429 errors
- Resume capability (track last fetched ts_match_id)
- Progress logging every 100 matches

### 2. Missing FootyStats Match IDs
**Mitigation:**
- Fuzzy match by team names + date
- Log unmatched matches for manual review
- Skip if no match found (don't block entire process)

### 3. Incomplete Data
**Mitigation:**
- Calculate `data_quality_score` (0-100)
- Filter low-quality matches during backtest (score < 60)
- Report missing fields per league in data quality report

### 4. API Cost Overrun
**Mitigation:**
- Start with PHASE 1 (top 20 leagues only)
- Validate results before expanding to PHASE 2
- Set `--limit` flag to cap API calls

---

## 📈 Expected Outcomes

**After PHASE 1 (1.5 hours):**
- ✅ 1,500-2,500 historical matches with full FootyStats data
- ✅ Ready for backtest CLI execution
- ✅ Can run calibration analysis on top 20 leagues

**After PHASE 2 (if needed):**
- ✅ 4,000-7,500 total matches (all tracked leagues)
- ✅ Comprehensive league coverage for data quality report

---

## 📝 Next Steps

1. **Implement:** `src/services/footystats/historicalFetcher.service.ts`
2. **Migrate:** Create `fs_match_stats` table
3. **Execute:** Run PHASE 1 fetch (top 20 leagues, 6 months)
4. **Validate:** Check data quality scores, missing fields
5. **Backtest:** Proceed to Week-2C backtest CLI tool

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-29
**Status:** 📋 Plan Ready - Awaiting Implementation Approval
