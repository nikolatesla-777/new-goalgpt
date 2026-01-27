-- FootyStats Cache Tables Migration
-- Purpose: Implement caching for FootyStats API responses to improve performance
-- TTL Strategy:
--   - Pre-match: 24 hours
--   - Live: 5 minutes
--   - Completed: 7 days

-- ============================================================================
-- 1. Match Stats Cache Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_match_stats (
    id SERIAL PRIMARY KEY,
    fs_match_id INTEGER NOT NULL UNIQUE, -- FootyStats Match ID

    -- Match Basic Info
    home_name VARCHAR(255),
    away_name VARCHAR(255),
    competition_name VARCHAR(255),
    match_date_unix BIGINT,
    status VARCHAR(50), -- 'scheduled', 'live', 'completed'

    -- AI Critical Data
    btts_potential INTEGER, -- Percentage
    over25_potential INTEGER, -- Percentage
    over15_potential INTEGER, -- Percentage
    corners_potential DECIMAL(5,2),
    cards_potential DECIMAL(5,2),
    shots_potential INTEGER,
    fouls_potential INTEGER,

    -- xG Data
    xg_home_prematch DECIMAL(4,2),
    xg_away_prematch DECIMAL(4,2),
    xg_total DECIMAL(4,2),

    -- Odds
    odds_home DECIMAL(6,2),
    odds_draw DECIMAL(6,2),
    odds_away DECIMAL(6,2),

    -- Trends (JSON)
    trends JSONB,

    -- H2H Data (JSON)
    h2h_data JSONB,

    -- Form Data (JSON)
    form_data JSONB,

    -- Full API Response (for reference)
    api_response JSONB,

    -- Cache Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL, -- TTL expiration
    hit_count INTEGER DEFAULT 0, -- Track cache usage

    -- Indexes
    CONSTRAINT fs_match_stats_unique UNIQUE (fs_match_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_expires ON fs_match_stats(expires_at);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_status ON fs_match_stats(status);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_date ON fs_match_stats(match_date_unix);

-- ============================================================================
-- 2. Team Form Cache Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_team_form (
    id SERIAL PRIMARY KEY,
    fs_team_id INTEGER NOT NULL, -- FootyStats Team ID
    season_id VARCHAR(50),

    -- Team Info
    team_name VARCHAR(255),

    -- Form String (AI Critical)
    form_string VARCHAR(20), -- e.g., "WDLWW"

    -- Advanced Statistics
    ppg_overall DECIMAL(4,2), -- Points per game
    ppg_home DECIMAL(4,2),
    ppg_away DECIMAL(4,2),

    -- xG Statistics
    xg_for_avg DECIMAL(4,2),
    xg_against_avg DECIMAL(4,2),
    xg_for_home DECIMAL(4,2),
    xg_against_home DECIMAL(4,2),
    xg_for_away DECIMAL(4,2),
    xg_against_away DECIMAL(4,2),

    -- Scoring Statistics
    btts_percentage INTEGER,
    over25_percentage INTEGER,
    clean_sheets_percentage INTEGER,

    -- Full Form Data (JSON)
    form_data_overall JSONB,
    form_data_home JSONB,
    form_data_away JSONB,

    -- Cache Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0,

    -- Unique constraint
    CONSTRAINT fs_team_form_unique UNIQUE (fs_team_id, season_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fs_team_form_expires ON fs_team_form(expires_at);
CREATE INDEX IF NOT EXISTS idx_fs_team_form_team ON fs_team_form(fs_team_id);
CREATE INDEX IF NOT EXISTS idx_fs_team_form_season ON fs_team_form(season_id);

-- ============================================================================
-- 3. Today's Matches Cache (Bulk Cache)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_today_matches_cache (
    id SERIAL PRIMARY KEY,
    cache_date DATE NOT NULL UNIQUE, -- Date of cached matches

    -- Cached Data
    matches_data JSONB NOT NULL, -- Array of match objects
    match_count INTEGER,

    -- Cache Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_fs_today_cache_expires ON fs_today_matches_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_fs_today_cache_date ON fs_today_matches_cache(cache_date);

-- ============================================================================
-- 4. Cache Statistics Table (Optional - for monitoring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_cache_stats (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL, -- 'hit', 'miss', 'write', 'expire'
    timestamp TIMESTAMP DEFAULT NOW(),

    -- Additional context
    entity_id VARCHAR(100),
    response_time_ms INTEGER
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_fs_cache_stats_timestamp ON fs_cache_stats(timestamp);
CREATE INDEX IF NOT EXISTS idx_fs_cache_stats_operation ON fs_cache_stats(operation);

-- ============================================================================
-- 5. Cleanup Function (Auto-delete expired cache)
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
-- 6. Comments for Documentation
-- ============================================================================
COMMENT ON TABLE fs_match_stats IS 'Cache table for FootyStats match details with TTL-based expiration';
COMMENT ON TABLE fs_team_form IS 'Cache table for FootyStats team form data';
COMMENT ON TABLE fs_today_matches_cache IS 'Bulk cache for daily matches list';
COMMENT ON COLUMN fs_match_stats.expires_at IS 'TTL: 24h pre-match, 5min live, 7 days completed';
COMMENT ON COLUMN fs_team_form.expires_at IS 'TTL: 24 hours for team form data';

-- ============================================================================
-- Done!
-- ============================================================================
-- Usage: psql -d your_database -f footystats-cache-tables.sql
