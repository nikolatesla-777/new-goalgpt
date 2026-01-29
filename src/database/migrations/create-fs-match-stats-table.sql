/**
 * Migration: Create fs_match_stats table
 *
 * Purpose: Store FootyStats historical match data for backtest + calibration
 * Links to ts_matches table via foreign key
 *
 * @version 1.0.0
 * @date 2026-01-29
 */

-- Create fs_match_stats table
CREATE TABLE IF NOT EXISTS fs_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts_match_id UUID NOT NULL REFERENCES ts_matches(id) ON DELETE CASCADE, -- Link to TheSports match
  fs_match_id INTEGER NOT NULL UNIQUE,                                    -- FootyStats match ID

  -- Basic info
  home_team_fs_id INTEGER,
  away_team_fs_id INTEGER,
  status VARCHAR(20),
  date_unix BIGINT,

  -- Potentials (betting probabilities from FootyStats)
  btts_potential NUMERIC(5,2),     -- Both Teams To Score potential (0-100)
  o25_potential NUMERIC(5,2),      -- Over 2.5 Goals potential (0-100)
  o15_potential NUMERIC(5,2),      -- Over 1.5 Goals potential (0-100)
  avg_potential NUMERIC(5,2),      -- Average potential
  corners_potential NUMERIC(5,2),  -- Corners potential
  cards_potential NUMERIC(5,2),    -- Cards potential

  -- xG (Expected Goals)
  team_a_xg_prematch NUMERIC(5,2), -- Home team xG
  team_b_xg_prematch NUMERIC(5,2), -- Away team xG

  -- Odds (closing odds)
  odds_ft_1 NUMERIC(6,2),           -- Home win odds
  odds_ft_x NUMERIC(6,2),           -- Draw odds
  odds_ft_2 NUMERIC(6,2),           -- Away win odds

  -- H2H (JSON - Head-to-Head statistics)
  h2h_stats JSONB,

  -- Trends (JSON - recent form strings)
  trends JSONB,

  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  data_quality_score INTEGER DEFAULT 0, -- 0-100 (completeness score)

  -- Constraints
  CONSTRAINT unique_fs_match UNIQUE(fs_match_id),
  CONSTRAINT valid_quality_score CHECK (data_quality_score >= 0 AND data_quality_score <= 100)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_ts_match ON fs_match_stats(ts_match_id);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_fs_id ON fs_match_stats(fs_match_id);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_fetched ON fs_match_stats(fetched_at);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_quality ON fs_match_stats(data_quality_score);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_date ON fs_match_stats(date_unix);

-- Comment table and columns
COMMENT ON TABLE fs_match_stats IS 'FootyStats historical match data for backtest and calibration (Week-2C)';
COMMENT ON COLUMN fs_match_stats.data_quality_score IS 'Data completeness score: 0-100 (xG=30pts, potentials=30pts, odds=20pts, h2h=10pts, trends=10pts)';
COMMENT ON COLUMN fs_match_stats.btts_potential IS 'Both Teams To Score potential (0-100%)';
COMMENT ON COLUMN fs_match_stats.o25_potential IS 'Over 2.5 Goals potential (0-100%)';

-- Success message
SELECT 'fs_match_stats table created successfully' AS status;
