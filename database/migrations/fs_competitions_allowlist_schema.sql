-- ============================================================================
-- FOOTYSTATS COMPETITIONS ALLOWLIST + TEAMS CATALOG SCHEMA
-- ============================================================================
-- Purpose: Hard allowlist for 50 competitions in FootyStats Hobi package
--          + Teams catalog for 2025/2026 season only
--
-- Data Model:
--   - fs_competitions_allowlist: 50 enabled competitions (hard limit)
--   - fs_teams_catalog: Teams per (competition, season) - ONLY 2025/2026
--   - fs_job_hashes: Hash guard for Teams Catalog sync
--
-- Season Standard: "2025/2026" (single format across entire system)
-- ============================================================================

-- ============================================================================
-- TABLE 1: fs_competitions_allowlist (50 competitions, hard limit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_competitions_allowlist (
  competition_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fs_competitions_allowlist_enabled
  ON fs_competitions_allowlist (is_enabled) WHERE is_enabled = TRUE;

COMMENT ON TABLE fs_competitions_allowlist IS 'Hard allowlist: Only 50 competitions from FootyStats Hobi package';
COMMENT ON COLUMN fs_competitions_allowlist.is_enabled IS 'Only enabled competitions will be synced';

-- ============================================================================
-- TABLE 2: fs_teams_catalog (Teams per competition/season)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_teams_catalog (
  team_id INTEGER NOT NULL,
  competition_id INTEGER NOT NULL,
  season TEXT NOT NULL,
  team_name TEXT NOT NULL,

  -- Optional: store raw API response
  meta JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (team_id, competition_id, season),

  CONSTRAINT fk_fs_teams_catalog_comp
    FOREIGN KEY (competition_id)
    REFERENCES fs_competitions_allowlist(competition_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fs_teams_catalog_comp_season
  ON fs_teams_catalog (competition_id, season);

CREATE INDEX IF NOT EXISTS idx_fs_teams_catalog_season
  ON fs_teams_catalog (season);

COMMENT ON TABLE fs_teams_catalog IS 'Teams catalog per competition/season (ONLY 2025/2026)';
COMMENT ON COLUMN fs_teams_catalog.season IS 'Standard format: "2025/2026" (normalized from API variations)';

-- ============================================================================
-- TABLE 3: fs_job_hashes (Hash guard for catalog sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_job_hashes (
  job_name TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (job_name, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_fs_job_hashes_job
  ON fs_job_hashes (job_name);

COMMENT ON TABLE fs_job_hashes IS 'Hash storage for deterministic job sync guard';
COMMENT ON COLUMN fs_job_hashes.job_name IS 'Job identifier (e.g., "teams_catalog_sync")';
COMMENT ON COLUMN fs_job_hashes.entity_key IS 'Unique entity identifier (e.g., "14972:2025/2026")';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get catalog hash for competition/season
CREATE OR REPLACE FUNCTION get_catalog_hash(
  p_competition_id INTEGER,
  p_season TEXT
) RETURNS TEXT AS $$
  SELECT payload_hash
  FROM fs_job_hashes
  WHERE job_name = 'teams_catalog_sync'
    AND entity_key = p_competition_id::text || ':' || p_season
$$ LANGUAGE SQL;

-- Function: Set catalog hash for competition/season
CREATE OR REPLACE FUNCTION set_catalog_hash(
  p_competition_id INTEGER,
  p_season TEXT,
  p_hash TEXT
) RETURNS VOID AS $$
  INSERT INTO fs_job_hashes (job_name, entity_key, payload_hash)
  VALUES ('teams_catalog_sync', p_competition_id::text || ':' || p_season, p_hash)
  ON CONFLICT (job_name, entity_key) DO UPDATE
    SET payload_hash = EXCLUDED.payload_hash,
        updated_at = NOW()
$$ LANGUAGE SQL;

-- ============================================================================
-- VALIDATION: Ensure season is always "2025/2026"
-- ============================================================================
ALTER TABLE fs_teams_catalog
  ADD CONSTRAINT chk_teams_catalog_season_2025_2026
  CHECK (season = '2025/2026');

COMMENT ON CONSTRAINT chk_teams_catalog_season_2025_2026 ON fs_teams_catalog
  IS 'CRITICAL: Only 2025/2026 season allowed. Hard constraint for Hobi package.';
