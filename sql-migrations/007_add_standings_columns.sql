-- ============================================
-- Migration 007: Add Missing Standings Columns
-- BASIC DATA - ts_standings table
-- ============================================

-- Meta columns
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS conference VARCHAR(100);
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS deduct_points INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS note TEXT;

-- Home stats (9 columns)
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_points INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_position INTEGER;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_total INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_won INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_draw INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_loss INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_goals INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_goals_against INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS home_goal_diff INTEGER DEFAULT 0;

-- Away stats (9 columns)
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_points INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_position INTEGER;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_total INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_won INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_draw INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_loss INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_goals INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_goals_against INTEGER DEFAULT 0;
ALTER TABLE ts_standings ADD COLUMN IF NOT EXISTS away_goal_diff INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ts_standings_conference ON ts_standings(conference) WHERE conference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ts_standings_home_position ON ts_standings(home_position);
CREATE INDEX IF NOT EXISTS idx_ts_standings_away_position ON ts_standings(away_position);

-- Comments
COMMENT ON COLUMN ts_standings.conference IS 'Conference/Division (e.g., MLS East/West)';
COMMENT ON COLUMN ts_standings.deduct_points IS 'Points deducted';
COMMENT ON COLUMN ts_standings.note IS 'Additional notes/description';
COMMENT ON COLUMN ts_standings.home_points IS 'Home match points';
COMMENT ON COLUMN ts_standings.home_position IS 'Home table position';
COMMENT ON COLUMN ts_standings.home_total IS 'Home matches played';
COMMENT ON COLUMN ts_standings.home_won IS 'Home wins';
COMMENT ON COLUMN ts_standings.home_draw IS 'Home draws';
COMMENT ON COLUMN ts_standings.home_loss IS 'Home losses';
COMMENT ON COLUMN ts_standings.home_goals IS 'Home goals scored';
COMMENT ON COLUMN ts_standings.home_goals_against IS 'Home goals conceded';
COMMENT ON COLUMN ts_standings.home_goal_diff IS 'Home goal difference';
COMMENT ON COLUMN ts_standings.away_points IS 'Away match points';
COMMENT ON COLUMN ts_standings.away_position IS 'Away table position';
COMMENT ON COLUMN ts_standings.away_total IS 'Away matches played';
COMMENT ON COLUMN ts_standings.away_won IS 'Away wins';
COMMENT ON COLUMN ts_standings.away_draw IS 'Away draws';
COMMENT ON COLUMN ts_standings.away_loss IS 'Away losses';
COMMENT ON COLUMN ts_standings.away_goals IS 'Away goals scored';
COMMENT ON COLUMN ts_standings.away_goals_against IS 'Away goals conceded';
COMMENT ON COLUMN ts_standings.away_goal_diff IS 'Away goal difference';
