-- ============================================
-- Migration 011: Add Soft Delete to All Tables
-- BASIC DATA - Support for /deleted endpoint sync
-- ============================================

-- ts_teams
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_teams_deleted_at ON ts_teams(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_players
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_players_deleted_at ON ts_players(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_competitions
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_competitions_deleted_at ON ts_competitions(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_seasons
ALTER TABLE ts_seasons ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_seasons_deleted_at ON ts_seasons(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_stages
ALTER TABLE ts_stages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_stages_deleted_at ON ts_stages(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_coaches
ALTER TABLE ts_coaches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_coaches_deleted_at ON ts_coaches(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_referees
ALTER TABLE ts_referees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_referees_deleted_at ON ts_referees(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_venues
ALTER TABLE ts_venues ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_venues_deleted_at ON ts_venues(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_countries
ALTER TABLE ts_countries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_countries_deleted_at ON ts_countries(deleted_at) WHERE deleted_at IS NOT NULL;

-- ts_categories
ALTER TABLE ts_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ts_categories_deleted_at ON ts_categories(deleted_at) WHERE deleted_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN ts_teams.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_players.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_competitions.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_seasons.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_stages.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_coaches.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_referees.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_venues.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_countries.deleted_at IS 'Soft delete timestamp from TheSports API';
COMMENT ON COLUMN ts_categories.deleted_at IS 'Soft delete timestamp from TheSports API';
