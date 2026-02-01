-- ============================================================================
-- FOOTYSTATS INDIVIDUAL TEAM STATS SCHEMA
-- ============================================================================
-- Purpose: Store detailed team statistics from /team?team_id=X&include=stats
-- This is different from fs_teams (league-level teams from /league-teams)
--
-- Data Model:
--   - fs_team_snapshots: Team meta per (team_id, competition_id, season)
--   - fs_team_snapshot_stats: Team stats per (team_id, competition_id, season)
--
-- Note: Renamed from "fs_teams" to avoid conflict with existing table
-- ============================================================================

-- ============================================================================
-- STEP 1: Rename existing tables to preserve data
-- ============================================================================
DO $$
BEGIN
  -- Rename existing fs_teams structure (from Adım 2.2)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'fs_teams'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'fs_teams' AND column_name = 'fs_team_id'
    )
  ) THEN
    ALTER TABLE fs_teams RENAME TO fs_teams_v1_league;
    ALTER TABLE fs_team_seasons RENAME TO fs_team_seasons_v1_league;
    ALTER TABLE fs_team_season_stats RENAME TO fs_team_season_stats_v1_league;

    RAISE NOTICE 'Renamed existing fs_teams tables to fs_teams_v1_league (data preserved)';
  END IF;
END $$;

-- ============================================================================
-- TABLE 1: fs_team_snapshots (Team Meta per Competition/Season)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_team_snapshots (
  team_id           INT NOT NULL,
  competition_id    INT NOT NULL,
  season            TEXT NOT NULL,

  -- Team identity
  name              TEXT,
  full_name         TEXT,
  english_name      TEXT,
  country           TEXT,
  founded           TEXT,
  image             TEXT,
  url               TEXT,

  -- Season context
  season_format     TEXT,
  table_position    INT,
  performance_rank  INT,
  risk              INT,

  -- Stadium
  stadium_name      TEXT,
  stadium_address   TEXT,

  -- Full raw payload (without stats, stats in separate table)
  raw               JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_hash       TEXT NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (team_id, competition_id, season)
);

CREATE INDEX IF NOT EXISTS idx_fs_team_snapshots_comp_season
  ON fs_team_snapshots (competition_id, season);
CREATE INDEX IF NOT EXISTS idx_fs_team_snapshots_hash
  ON fs_team_snapshots (source_hash);
CREATE INDEX IF NOT EXISTS idx_fs_team_snapshots_raw_gin
  ON fs_team_snapshots USING GIN (raw);

-- ============================================================================
-- TABLE 2: fs_team_snapshot_stats (Team Stats per Competition/Season)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_team_snapshot_stats (
  team_id           INT NOT NULL,
  competition_id    INT NOT NULL,
  season            TEXT NOT NULL,

  -- AI-critical typed columns (minimal set for fast queries)
  matches_played_overall INT,
  goals_scored_overall   INT,
  goals_conceded_overall INT,

  ppg_overall            NUMERIC,
  btts_pct_overall       NUMERIC,
  over25_pct_overall     NUMERIC,

  corners_avg_overall    NUMERIC,
  cards_avg_overall      NUMERIC,

  -- Full stats payload (300+ metrics)
  stats_raw         JSONB NOT NULL DEFAULT '{}'::jsonb,

  source_hash       TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (team_id, competition_id, season),

  CONSTRAINT fk_fs_team_snapshot_stats_team
    FOREIGN KEY (team_id, competition_id, season)
    REFERENCES fs_team_snapshots(team_id, competition_id, season)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fs_team_snapshot_stats_hash
  ON fs_team_snapshot_stats (source_hash);
CREATE INDEX IF NOT EXISTS idx_fs_team_snapshot_stats_raw_gin
  ON fs_team_snapshot_stats USING GIN (stats_raw);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE fs_team_snapshots IS 'FootyStats individual team metadata per competition/season';
COMMENT ON TABLE fs_team_snapshot_stats IS 'FootyStats individual team statistics per competition/season';

COMMENT ON COLUMN fs_team_snapshots.source_hash IS 'SHA-256 hash of team metadata (excluding stats)';
COMMENT ON COLUMN fs_team_snapshot_stats.source_hash IS 'SHA-256 hash of full stats payload';
COMMENT ON COLUMN fs_team_snapshot_stats.stats_raw IS 'Full stats object from FootyStats /team endpoint (300+ metrics)';
