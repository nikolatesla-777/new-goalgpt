-- ============================================
-- Migration 004: Add Missing Match Columns
-- BASIC DATA - ts_matches table
-- ============================================

-- Match metadata
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS neutral INTEGER DEFAULT 0;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS home_position VARCHAR(10);
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS away_position VARCHAR(10);

-- Coverage flags
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS coverage_mlive INTEGER DEFAULT 0;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS coverage_lineup INTEGER DEFAULT 0;

-- Round info
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS group_num INTEGER;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS round_num INTEGER;

-- Related match (for double-leg ties)
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS related_id VARCHAR(50);

-- Aggregate score (for two-leg ties)
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS agg_score JSONB;

-- Environment/Weather
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS environment JSONB;

-- Match flags
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS tbd INTEGER DEFAULT 0;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS has_ot INTEGER DEFAULT 0;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS ended INTEGER;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS team_reverse INTEGER DEFAULT 0;
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS loss INTEGER DEFAULT 0;

-- Text live commentary
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS tlive JSONB;

-- Soft delete support
ALTER TABLE ts_matches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ts_matches_neutral ON ts_matches(neutral) WHERE neutral = 1;
CREATE INDEX IF NOT EXISTS idx_ts_matches_coverage_mlive ON ts_matches(coverage_mlive) WHERE coverage_mlive = 1;
CREATE INDEX IF NOT EXISTS idx_ts_matches_coverage_lineup ON ts_matches(coverage_lineup) WHERE coverage_lineup = 1;
CREATE INDEX IF NOT EXISTS idx_ts_matches_group_num ON ts_matches(group_num) WHERE group_num IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ts_matches_related_id ON ts_matches(related_id) WHERE related_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ts_matches_has_ot ON ts_matches(has_ot) WHERE has_ot = 1;
CREATE INDEX IF NOT EXISTS idx_ts_matches_deleted_at ON ts_matches(deleted_at) WHERE deleted_at IS NOT NULL;

-- Comment
COMMENT ON COLUMN ts_matches.neutral IS 'Is neutral venue? 1=Yes, 0=No';
COMMENT ON COLUMN ts_matches.note IS 'Match remarks/description';
COMMENT ON COLUMN ts_matches.home_position IS 'Home team league position';
COMMENT ON COLUMN ts_matches.away_position IS 'Away team league position';
COMMENT ON COLUMN ts_matches.coverage_mlive IS 'Has live animation? 1=Yes';
COMMENT ON COLUMN ts_matches.coverage_lineup IS 'Has lineup data? 1=Yes';
COMMENT ON COLUMN ts_matches.group_num IS 'Group number (1=A, 2=B, etc)';
COMMENT ON COLUMN ts_matches.round_num IS 'Round number';
COMMENT ON COLUMN ts_matches.related_id IS 'Related match ID (double-leg ties)';
COMMENT ON COLUMN ts_matches.agg_score IS 'Aggregate score [home, away]';
COMMENT ON COLUMN ts_matches.environment IS 'Weather info {weather, pressure, temperature, wind, humidity}';
COMMENT ON COLUMN ts_matches.tbd IS 'Time to be determined? 1=Yes';
COMMENT ON COLUMN ts_matches.has_ot IS 'Has overtime? 1=Yes';
COMMENT ON COLUMN ts_matches.ended IS 'End timestamp';
COMMENT ON COLUMN ts_matches.team_reverse IS 'Teams reversed from official? 1=Yes';
COMMENT ON COLUMN ts_matches.loss IS 'Match ruled as loss? 1=Yes';
COMMENT ON COLUMN ts_matches.tlive IS 'Text live commentary array';
COMMENT ON COLUMN ts_matches.deleted_at IS 'Soft delete timestamp';
