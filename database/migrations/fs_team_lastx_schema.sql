-- ============================================================================
-- FOOTYSTATS TEAM LASTX STATS SCHEMA
-- ============================================================================
-- Purpose: Store Last 5 / Last 6 / Last 10 match statistics for teams
-- Endpoint: GET /lastx?team_id=X&key=KEY
--
-- Single API call returns 3 records (Last 5, Last 6, Last 10)
-- Each record has same stats structure as /team endpoint
-- ============================================================================

CREATE TABLE IF NOT EXISTS fs_team_lastx_stats (
  id BIGSERIAL PRIMARY KEY,

  -- Team identity
  team_id           INTEGER NOT NULL,
  season            VARCHAR(16),
  competition_id    INTEGER,

  -- Window specification
  scope             SMALLINT NOT NULL DEFAULT 0,  -- 0=overall, 1=home, 2=away
  last_x            SMALLINT NOT NULL,            -- 5, 6, or 10

  -- Team metadata
  name              TEXT,
  full_name         TEXT,
  country           TEXT,
  image             TEXT,
  url               TEXT,

  -- Position & performance
  table_position    INTEGER,
  performance_rank  INTEGER,
  risk              INTEGER,
  season_format     TEXT,

  -- Timing
  last_updated_match_timestamp BIGINT,

  -- Full stats payload (300+ fields)
  stats             JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Full raw data for debugging
  raw               JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Hash for deterministic UPSERT
  source_hash       TEXT,

  -- Timestamps
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  CONSTRAINT uq_team_lastx_stats
    UNIQUE NULLS NOT DISTINCT (team_id, season, competition_id, scope, last_x)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fs_team_lastx_team
  ON fs_team_lastx_stats(team_id);

CREATE INDEX IF NOT EXISTS idx_fs_team_lastx_window
  ON fs_team_lastx_stats(last_x);

CREATE INDEX IF NOT EXISTS idx_fs_team_lastx_scope
  ON fs_team_lastx_stats(scope);

CREATE INDEX IF NOT EXISTS idx_fs_team_lastx_hash
  ON fs_team_lastx_stats(source_hash);

CREATE INDEX IF NOT EXISTS idx_fs_team_lastx_stats_gin
  ON fs_team_lastx_stats USING GIN (stats);

CREATE INDEX IF NOT EXISTS idx_fs_team_lastx_fetched
  ON fs_team_lastx_stats(team_id, fetched_at);

-- Comments
COMMENT ON TABLE fs_team_lastx_stats IS 'FootyStats Last X (5/6/10) match statistics per team';
COMMENT ON COLUMN fs_team_lastx_stats.scope IS '0=overall, 1=home, 2=away (from last_x_home_away_or_overall)';
COMMENT ON COLUMN fs_team_lastx_stats.last_x IS 'Window size: 5, 6, or 10 matches';
COMMENT ON COLUMN fs_team_lastx_stats.stats IS 'Full stats object (300+ fields, same as /team endpoint)';
COMMENT ON COLUMN fs_team_lastx_stats.source_hash IS 'SHA-256 hash of stats payload for deterministic UPSERT';
