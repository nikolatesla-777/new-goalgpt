-- ============================================
-- Migration 009: Add Missing H2H and Compensation Columns
-- BASIC DATA - H2H analysis data
-- ============================================

-- Check if ts_match_h2h exists, otherwise add to ts_matches
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS h2h_data JSONB;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS future_matches JSONB;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS goal_distribution JSONB;

-- Compensation/History stats
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS history_home_rate FLOAT;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS history_away_rate FLOAT;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS recent_home_rate FLOAT;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS recent_away_rate FLOAT;

-- Comments
COMMENT ON COLUMN ts_matches.h2h_data IS 'H2H match history {vs: [], home: [], away: []}';
COMMENT ON COLUMN ts_matches.future_matches IS 'Future matches {home: [], away: []}';
COMMENT ON COLUMN ts_matches.goal_distribution IS 'Goal distribution by 15-min periods';
COMMENT ON COLUMN ts_matches.history_home_rate IS 'H2H home team win rate';
COMMENT ON COLUMN ts_matches.history_away_rate IS 'H2H away team win rate';
COMMENT ON COLUMN ts_matches.recent_home_rate IS 'Recent form home team win rate';
COMMENT ON COLUMN ts_matches.recent_away_rate IS 'Recent form away team win rate';
