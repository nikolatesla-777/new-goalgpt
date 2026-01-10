-- ============================================
-- Migration 008: Add Missing Lineup Columns
-- BASIC DATA - Lineup related columns
-- ============================================

-- Check if ts_match_lineups table exists, if not we'll add to ts_matches
-- Adding lineup metadata to ts_matches table

ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS lineup_confirmed INTEGER DEFAULT 0;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS coach_home_id VARCHAR(50);
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS coach_away_id VARCHAR(50);

-- Injury data (JSONB array for home and away)
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS injury_data JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ts_matches_lineup_confirmed ON ts_matches(lineup_confirmed) WHERE lineup_confirmed = 1;
CREATE INDEX IF NOT EXISTS idx_ts_matches_coach_home_id ON ts_matches(coach_home_id) WHERE coach_home_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ts_matches_coach_away_id ON ts_matches(coach_away_id) WHERE coach_away_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN ts_matches.lineup_confirmed IS 'Official lineup confirmed? 1=Yes';
COMMENT ON COLUMN ts_matches.coach_home_id IS 'Home team coach ID';
COMMENT ON COLUMN ts_matches.coach_away_id IS 'Away team coach ID';
COMMENT ON COLUMN ts_matches.injury_data IS 'Injury data {home: [], away: []}';

-- ============================================
-- If ts_match_lineups table exists, add columns there too
-- ============================================

-- Add captain flag to lineup player data (if stored separately)
-- This is typically stored in JSONB lineup data, so we note it here

-- Add addtime to incidents (for injury time tracking)
-- This is typically stored in JSONB incidents data
