-- ============================================================================
-- FOOTYSTATS MATCHES - 2-TABLE MODEL (Fixture + Stats)
-- ============================================================================

-- ============================================================================
-- TABLE 1: MATCHES (Kalıcı + Fixture)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_matches (
  fs_match_id INTEGER PRIMARY KEY,              -- FootyStats match ID

  -- Season context
  fs_season_id INTEGER NULL,                    -- FootyStats season ID
  competition_id INTEGER NULL,                  -- Competition/season ID

  -- Match info
  status TEXT NULL,                             -- 'complete', 'fixture', etc.
  round_id INTEGER NULL,
  game_week INTEGER NULL,
  revised_game_week INTEGER NULL,

  -- Teams
  home_team_fs_id INTEGER NULL,                 -- homeID
  away_team_fs_id INTEGER NULL,                 -- awayID
  winning_team_fs_id INTEGER NULL,

  -- Date/Time
  date_unix INTEGER NULL,
  date TEXT NULL,

  -- Venue
  stadium_id INTEGER NULL,
  stadium_name TEXT NULL,
  stadium_location TEXT NULL,

  -- Officials
  referee_id INTEGER NULL,
  coach_home_id INTEGER NULL,
  coach_away_id INTEGER NULL,

  -- Flags
  no_home_away BOOLEAN NULL,

  -- Hash for fixture data
  source_hash TEXT NULL,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_fs_matches_season
    FOREIGN KEY (fs_season_id) REFERENCES fs_league_seasons(fs_season_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_fs_matches_home_team
    FOREIGN KEY (home_team_fs_id) REFERENCES fs_teams(fs_team_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_fs_matches_away_team
    FOREIGN KEY (away_team_fs_id) REFERENCES fs_teams(fs_team_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fs_matches_season ON fs_matches(fs_season_id);
CREATE INDEX IF NOT EXISTS idx_fs_matches_status ON fs_matches(status);
CREATE INDEX IF NOT EXISTS idx_fs_matches_date_unix ON fs_matches(date_unix);
CREATE INDEX IF NOT EXISTS idx_fs_matches_home_team ON fs_matches(home_team_fs_id);
CREATE INDEX IF NOT EXISTS idx_fs_matches_away_team ON fs_matches(away_team_fs_id);
CREATE INDEX IF NOT EXISTS idx_fs_matches_source_hash ON fs_matches(source_hash);

-- ============================================================================
-- TABLE 2: MATCH STATS (Stats + Derived Booleans + Odds)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_match_stats (
  fs_match_id INTEGER PRIMARY KEY,              -- 1-1 with fs_matches

  -- Score
  home_goal_count INTEGER NULL,
  away_goal_count INTEGER NULL,
  total_goal_count INTEGER NULL,
  ht_home INTEGER NULL,
  ht_away INTEGER NULL,
  ht_goal_count INTEGER NULL,

  -- Events (JSONB)
  home_goals_jsonb JSONB NULL,
  away_goals_jsonb JSONB NULL,
  events_jsonb JSONB NULL,

  -- Stats
  corners_home INTEGER NULL,
  corners_away INTEGER NULL,
  corners_total INTEGER NULL,

  cards_home INTEGER NULL,
  cards_away INTEGER NULL,
  cards_total INTEGER NULL,

  shots_home INTEGER NULL,
  shots_away INTEGER NULL,
  shots_total INTEGER NULL,

  shots_on_target_home INTEGER NULL,
  shots_on_target_away INTEGER NULL,

  fouls_home INTEGER NULL,
  fouls_away INTEGER NULL,

  possession_home NUMERIC NULL,
  possession_away NUMERIC NULL,

  offsides_home INTEGER NULL,
  offsides_away INTEGER NULL,

  -- xG
  xg_home NUMERIC NULL,
  xg_away NUMERIC NULL,

  -- Odds
  odds_ft_1 NUMERIC NULL,                       -- Home win
  odds_ft_x NUMERIC NULL,                       -- Draw
  odds_ft_2 NUMERIC NULL,                       -- Away win
  odds_ft_over25 NUMERIC NULL,
  odds_ft_under25 NUMERIC NULL,
  odds_btts_yes NUMERIC NULL,
  odds_btts_no NUMERIC NULL,

  -- Derived flags (goals)
  btts BOOLEAN NULL,
  over05 BOOLEAN NULL,
  over15 BOOLEAN NULL,
  over25 BOOLEAN NULL,
  over35 BOOLEAN NULL,
  over45 BOOLEAN NULL,
  over55 BOOLEAN NULL,

  -- Derived flags (corners)
  over65_corners BOOLEAN NULL,
  over75_corners BOOLEAN NULL,
  over85_corners BOOLEAN NULL,
  over95_corners BOOLEAN NULL,
  over105_corners BOOLEAN NULL,

  -- Derived flags (cards)
  over25_cards BOOLEAN NULL,
  over35_cards BOOLEAN NULL,
  over45_cards BOOLEAN NULL,

  -- Full raw data
  raw_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Hash for stats data
  source_hash TEXT NULL,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_fs_match_stats_match
    FOREIGN KEY (fs_match_id) REFERENCES fs_matches(fs_match_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fs_match_stats_btts ON fs_match_stats(btts);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_over25 ON fs_match_stats(over25);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_source_hash ON fs_match_stats(source_hash);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_raw_gin ON fs_match_stats USING GIN (raw_jsonb);

-- ============================================================================
-- VIEW: Quick match lookup with teams
-- ============================================================================
CREATE OR REPLACE VIEW vw_fs_matches_quick AS
SELECT
  m.fs_match_id,
  m.fs_season_id,
  m.status,
  m.game_week,
  m.date_unix,
  m.date,
  m.home_team_fs_id,
  m.away_team_fs_id,
  ms.home_goal_count,
  ms.away_goal_count,
  ms.total_goal_count,
  ms.btts,
  ms.over25,
  ms.corners_total,
  ms.cards_total,
  m.fetched_at
FROM fs_matches m
LEFT JOIN fs_match_stats ms ON m.fs_match_id = ms.fs_match_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE fs_matches IS 'FootyStats matches (kalıcı + fixture bilgileri)';
COMMENT ON TABLE fs_match_stats IS 'Match statistics (stats + odds + derived flags)';

COMMENT ON COLUMN fs_matches.source_hash IS 'SHA-256 hash (fixture data için)';
COMMENT ON COLUMN fs_match_stats.source_hash IS 'SHA-256 hash (stats data için)';
COMMENT ON COLUMN fs_match_stats.raw_jsonb IS 'Full match object from FootyStats API';
