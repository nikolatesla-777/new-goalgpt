-- FootyStats Cache Tables - Alter Existing Tables
-- Purpose: Add TTL and caching columns to existing fs_match_stats and fs_team_form tables

-- ============================================================================
-- 1. Alter fs_match_stats table
-- ============================================================================

-- Add missing columns
ALTER TABLE fs_match_stats
  ADD COLUMN IF NOT EXISTS home_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS away_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS competition_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS match_date_unix BIGINT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS o15_potential INTEGER,
  ADD COLUMN IF NOT EXISTS shots_potential INTEGER,
  ADD COLUMN IF NOT EXISTS fouls_potential INTEGER,
  ADD COLUMN IF NOT EXISTS xg_total DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS odds_home DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS odds_draw DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS odds_away DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS form_data JSONB,
  ADD COLUMN IF NOT EXISTS api_response JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 0;

-- Update existing rows to have a default expires_at (24 hours from now)
UPDATE fs_match_stats
SET expires_at = NOW() + INTERVAL '24 hours'
WHERE expires_at IS NULL;

-- Make expires_at NOT NULL after setting defaults
ALTER TABLE fs_match_stats
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

-- Create indexes for TTL and performance
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_expires ON fs_match_stats(expires_at);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_status ON fs_match_stats(status);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_date ON fs_match_stats(match_date_unix);

-- Add unique constraint on fs_match_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fs_match_stats_unique'
  ) THEN
    ALTER TABLE fs_match_stats ADD CONSTRAINT fs_match_stats_unique UNIQUE (fs_match_id);
  END IF;
END $$;

-- ============================================================================
-- 2. Alter fs_team_form table (if exists)
-- ============================================================================

-- Add missing columns
ALTER TABLE fs_team_form
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 0;

-- Update existing rows to have a default expires_at (24 hours from now)
UPDATE fs_team_form
SET expires_at = NOW() + INTERVAL '24 hours'
WHERE expires_at IS NULL;

-- Make expires_at NOT NULL after setting defaults
ALTER TABLE fs_team_form
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

-- Create indexes for TTL and performance
CREATE INDEX IF NOT EXISTS idx_fs_team_form_expires ON fs_team_form(expires_at);

-- ============================================================================
-- 3. Create fs_today_matches_cache table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_today_matches_cache (
    id SERIAL PRIMARY KEY,
    cache_date DATE NOT NULL UNIQUE,
    matches_data JSONB NOT NULL,
    match_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fs_today_cache_expires ON fs_today_matches_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_fs_today_cache_date ON fs_today_matches_cache(cache_date);

-- ============================================================================
-- 4. Create fs_cache_stats table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_cache_stats (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    entity_id VARCHAR(100),
    response_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fs_cache_stats_timestamp ON fs_cache_stats(timestamp);
CREATE INDEX IF NOT EXISTS idx_fs_cache_stats_operation ON fs_cache_stats(operation);

-- ============================================================================
-- 5. Update cleanup function (if exists, replace it)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_fs_cache()
RETURNS void AS $$
BEGIN
    -- Delete expired match stats
    DELETE FROM fs_match_stats WHERE expires_at < NOW();

    -- Delete expired team form
    DELETE FROM fs_team_form WHERE expires_at < NOW();

    -- Delete expired today matches cache
    DELETE FROM fs_today_matches_cache WHERE expires_at < NOW();

    -- Log cleanup
    INSERT INTO fs_cache_stats (table_name, operation)
    VALUES ('all', 'cleanup');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Add comments
-- ============================================================================
COMMENT ON COLUMN fs_match_stats.expires_at IS 'TTL: 24h pre-match, 5min live, 7 days completed';
COMMENT ON COLUMN fs_team_form.expires_at IS 'TTL: 24 hours for team form data';

-- ============================================================================
-- Done!
-- ============================================================================
-- Usage: psql -d your_database -f footystats-cache-tables-alter.sql
