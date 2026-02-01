-- ============================================================================
-- FOOTYSTATS TEAMS - 3-TIER SCHEMA (Team → Team Season → Stats)
-- ============================================================================

-- ============================================================================
-- TIER 1: TEAMS (Kalıcı Kimlik)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_teams (
  fs_team_id        INTEGER PRIMARY KEY,     -- FootyStats team.id
  original_id       INTEGER NULL,
  country           TEXT NULL,
  continent         TEXT NULL,
  founded           INTEGER NULL,
  stadium_name      TEXT NULL,
  stadium_address   TEXT NULL,
  image             TEXT NULL,
  image_thumb       TEXT NULL,
  flag_element      TEXT NULL,
  url               TEXT NULL,
  parent_url        TEXT NULL,
  verified          BOOLEAN NULL,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fs_teams_country ON fs_teams(country);

-- ============================================================================
-- TIER 2: TEAM SEASONS (Mapping burada!)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_team_seasons (
  fs_team_id        INTEGER NOT NULL REFERENCES fs_teams(fs_team_id) ON DELETE CASCADE,
  fs_season_id      INTEGER NOT NULL REFERENCES fs_league_seasons(fs_season_id) ON DELETE CASCADE,

  season            TEXT NULL,
  season_clean      TEXT NULL,

  -- Provider IDs (FootyStats payload'ında gelenler)
  competition_id    TEXT NULL,
  tsapi_id          TEXT NULL,
  eo_id             TEXT NULL,
  dsg_id            TEXT NULL,

  -- TheSports mapping (Adım 2.3'te doldurulacak)
  tsapi_team_id     TEXT NULL,
  mapping_verified  BOOLEAN NOT NULL DEFAULT FALSE,

  seasonurl_overall TEXT NULL,
  seasonurl_home    TEXT NULL,
  seasonurl_away    TEXT NULL,

  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_fs_team_season UNIQUE (fs_team_id, fs_season_id)
);

CREATE INDEX IF NOT EXISTS idx_fs_team_seasons_season ON fs_team_seasons(fs_season_id);
CREATE INDEX IF NOT EXISTS idx_fs_team_seasons_tsapi_team_id ON fs_team_seasons(tsapi_team_id);

-- ============================================================================
-- TIER 3: TEAM SEASON STATS (Full JSONB + Extracted + Hash)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_team_season_stats (
  fs_team_id        INTEGER NOT NULL REFERENCES fs_teams(fs_team_id) ON DELETE CASCADE,
  fs_season_id      INTEGER NOT NULL REFERENCES fs_league_seasons(fs_season_id) ON DELETE CASCADE,

  -- AI-critical extracted (hız için)
  season_btts_percentage_overall   NUMERIC NULL,
  season_over25_percentage_overall NUMERIC NULL,
  season_over35_percentage_overall NUMERIC NULL,
  season_under25_percentage_overall NUMERIC NULL,

  season_avg_goals_overall         NUMERIC NULL,
  season_ppg_overall               NUMERIC NULL,

  corners_avg_overall              NUMERIC NULL,
  cards_avg_overall                NUMERIC NULL,

  xg_for_avg_overall               NUMERIC NULL,
  xg_against_avg_overall           NUMERIC NULL,

  -- Full stats
  stats            JSONB NOT NULL DEFAULT '{}'::jsonb,

  source_hash      TEXT NULL,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_fs_team_season_stats UNIQUE (fs_team_id, fs_season_id)
);

CREATE INDEX IF NOT EXISTS idx_fs_tss_season ON fs_team_season_stats(fs_season_id);
CREATE INDEX IF NOT EXISTS idx_fs_tss_hash   ON fs_team_season_stats(source_hash);

-- ============================================================================
-- VIEW: Quick team season lookup
-- ============================================================================
CREATE OR REPLACE VIEW vw_fs_team_season_quick AS
SELECT
  ts.fs_season_id,
  ts.fs_team_id,
  t.country,
  s.tsapi_team_id,
  ts.season_ppg_overall,
  ts.season_btts_percentage_overall,
  ts.season_over25_percentage_overall,
  ts.corners_avg_overall,
  ts.cards_avg_overall,
  ts.xg_for_avg_overall,
  ts.xg_against_avg_overall,
  ts.fetched_at
FROM fs_team_season_stats ts
JOIN fs_teams t ON t.fs_team_id = ts.fs_team_id
JOIN fs_team_seasons s ON s.fs_team_id = ts.fs_team_id AND s.fs_season_id = ts.fs_season_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE fs_teams IS 'FootyStats teams (kalıcı kimlik, team_id bazlı)';
COMMENT ON TABLE fs_team_seasons IS 'Team seasons (TheSports mapping burada, team_id + season_id)';
COMMENT ON TABLE fs_team_season_stats IS 'Team season statistics (AI-critical extracted + full JSONB)';

COMMENT ON COLUMN fs_team_seasons.tsapi_team_id IS 'TheSports team external_id (Adım 2.3''te doldurulacak)';
COMMENT ON COLUMN fs_team_season_stats.source_hash IS 'SHA-256 hash (deterministik UPSERT için)';
