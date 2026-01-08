-- ============================================
-- Migration 002: Add Missing Columns to Entity Tables
-- Competition, Team, Player, Coach, Venue, Season
-- ============================================

-- ==========================================
-- COMPETITION TABLE
-- ==========================================
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS title_holder JSONB;
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS most_titles JSONB;
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS newcomers JSONB;
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS divisions JSONB;
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS host JSONB;
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20);
ALTER TABLE ts_competitions ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20);

-- ==========================================
-- TEAM TABLE
-- ==========================================
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS national INTEGER DEFAULT 0;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS country_logo TEXT;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS foundation_time INTEGER;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS coach_id VARCHAR(50);
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS market_value BIGINT;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS market_value_currency VARCHAR(10);
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS total_players INTEGER DEFAULT -1;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS foreign_players INTEGER DEFAULT -1;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS national_players INTEGER DEFAULT -1;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS virtual INTEGER DEFAULT 0;
ALTER TABLE ts_teams ADD COLUMN IF NOT EXISTS gender INTEGER DEFAULT 1;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ts_teams_national ON ts_teams(national) WHERE national = 1;
CREATE INDEX IF NOT EXISTS idx_ts_teams_gender ON ts_teams(gender);

-- ==========================================
-- PLAYER TABLE
-- ==========================================
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS national_logo TEXT;
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS contract_until INTEGER;
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS preferred_foot INTEGER DEFAULT 0;
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS ability JSONB;
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS characteristics JSONB;
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS positions JSONB;
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS deathday INTEGER;
ALTER TABLE ts_players ADD COLUMN IF NOT EXISTS retire_time INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ts_players_preferred_foot ON ts_players(preferred_foot);
CREATE INDEX IF NOT EXISTS idx_ts_players_contract_until ON ts_players(contract_until);

-- ==========================================
-- COACH TABLE
-- ==========================================
ALTER TABLE ts_coaches ADD COLUMN IF NOT EXISTS type INTEGER DEFAULT 1;
ALTER TABLE ts_coaches ADD COLUMN IF NOT EXISTS preferred_formation VARCHAR(20);
ALTER TABLE ts_coaches ADD COLUMN IF NOT EXISTS joined INTEGER;
ALTER TABLE ts_coaches ADD COLUMN IF NOT EXISTS contract_until INTEGER;
ALTER TABLE ts_coaches ADD COLUMN IF NOT EXISTS deathday INTEGER;

-- Create index
CREATE INDEX IF NOT EXISTS idx_ts_coaches_type ON ts_coaches(type);

-- ==========================================
-- VENUE TABLE
-- ==========================================
ALTER TABLE ts_venues ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- ==========================================
-- SEASON TABLE
-- ==========================================
ALTER TABLE ts_seasons ADD COLUMN IF NOT EXISTS has_player_stats INTEGER DEFAULT 0;
ALTER TABLE ts_seasons ADD COLUMN IF NOT EXISTS has_team_stats INTEGER DEFAULT 0;
ALTER TABLE ts_seasons ADD COLUMN IF NOT EXISTS has_table INTEGER DEFAULT 0;
ALTER TABLE ts_seasons ADD COLUMN IF NOT EXISTS is_current INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ts_seasons_is_current ON ts_seasons(is_current) WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_ts_seasons_has_table ON ts_seasons(has_table) WHERE has_table = 1;
