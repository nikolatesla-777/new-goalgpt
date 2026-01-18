-- FootyStats Integration Tables Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. INTEGRATION MAPPINGS TABLE (Rosetta Stone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS integration_mappings (
  id SERIAL PRIMARY KEY,

  -- Entity type: 'league', 'team', 'competition', 'referee'
  entity_type VARCHAR(50) NOT NULL,

  -- TheSports (our primary system)
  ts_id VARCHAR(100) NOT NULL,
  ts_name VARCHAR(255),

  -- FootyStats (secondary source)
  fs_id INTEGER NOT NULL,
  fs_name VARCHAR(255),

  -- Matching confidence and verification
  confidence_score DECIMAL(5,2),  -- 0.00 to 100.00 (string similarity)
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR(100),
  verified_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(entity_type, ts_id),
  UNIQUE(entity_type, fs_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_mappings_entity_ts ON integration_mappings(entity_type, ts_id);
CREATE INDEX IF NOT EXISTS idx_mappings_entity_fs ON integration_mappings(entity_type, fs_id);
CREATE INDEX IF NOT EXISTS idx_mappings_unverified ON integration_mappings(is_verified) WHERE is_verified = FALSE;

-- ============================================================================
-- 2. FS_MATCH_STATS TABLE (AI-Critical Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_match_stats (
  id SERIAL PRIMARY KEY,

  -- Reference to our match (TheSports match_id)
  match_id VARCHAR(100) NOT NULL,

  -- FootyStats match ID (for re-fetching)
  fs_match_id INTEGER,

  -- AI Critical: Potentials (%)
  btts_potential INTEGER,        -- Both Teams To Score %
  o25_potential INTEGER,         -- Over 2.5 Goals %
  avg_potential DECIMAL(4,2),    -- Average goals prediction
  corners_potential DECIMAL(5,2),
  cards_potential DECIMAL(5,2),

  -- AI Critical: Expected Goals
  xg_home_prematch DECIMAL(4,2),
  xg_away_prematch DECIMAL(4,2),

  -- Trends (JSON - AI prompt injection)
  trends JSONB,

  -- H2H Summary
  h2h_data JSONB,

  -- Odds comparison (multiple bookies)
  odds_comparison JSONB,

  -- Risk assessment
  risk_level VARCHAR(20),  -- 'low', 'medium', 'high'

  -- Metadata
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(match_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_match ON fs_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_fs ON fs_match_stats(fs_match_id);
CREATE INDEX IF NOT EXISTS idx_fs_match_stats_btts ON fs_match_stats(btts_potential) WHERE btts_potential > 60;

-- ============================================================================
-- 3. FS_TEAM_FORM TABLE (Team Recent Performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_team_form (
  id SERIAL PRIMARY KEY,

  -- Reference to our team (TheSports team_id)
  team_id VARCHAR(100) NOT NULL,

  -- FootyStats team ID
  fs_team_id INTEGER,

  -- Season reference
  season_id VARCHAR(50),

  -- AI Critical: Form String (e.g., "WDLWW")
  form_string_overall VARCHAR(20),
  form_string_home VARCHAR(20),
  form_string_away VARCHAR(20),

  -- Points per game
  ppg_overall DECIMAL(4,2),
  ppg_home DECIMAL(4,2),
  ppg_away DECIMAL(4,2),

  -- Expected Goals averages
  xg_for_avg DECIMAL(4,2),
  xg_against_avg DECIMAL(4,2),

  -- Betting percentages
  btts_percentage INTEGER,
  over25_percentage INTEGER,
  clean_sheet_percentage INTEGER,
  failed_to_score_percentage INTEGER,

  -- Corners & Cards
  corners_avg DECIMAL(4,2),
  cards_avg DECIMAL(4,2),

  -- Goal timing distribution (JSON)
  goal_timing JSONB,

  -- Metadata
  last_x_matches INTEGER DEFAULT 5,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(team_id, season_id, last_x_matches)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fs_team_form_team ON fs_team_form(team_id);
CREATE INDEX IF NOT EXISTS idx_fs_team_form_fs ON fs_team_form(fs_team_id);
CREATE INDEX IF NOT EXISTS idx_fs_team_form_btts ON fs_team_form(btts_percentage) WHERE btts_percentage > 50;

-- ============================================================================
-- 4. FS_REFEREES TABLE (Referee Statistics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_referees (
  id SERIAL PRIMARY KEY,

  -- Reference to our referee (TheSports referee_id)
  referee_id VARCHAR(100),

  -- FootyStats referee ID
  fs_referee_id INTEGER NOT NULL,

  -- Basic info
  full_name VARCHAR(255) NOT NULL,
  nationality VARCHAR(100),

  -- Stats
  appearances INTEGER DEFAULT 0,

  -- AI Critical: Betting stats
  btts_percentage INTEGER,
  avg_goals_per_match DECIMAL(4,2),
  penalties_per_match DECIMAL(4,2),
  penalty_match_percentage INTEGER,

  -- Card stats
  avg_cards_per_match DECIMAL(4,2),
  avg_yellow_cards DECIMAL(4,2),
  avg_red_cards DECIMAL(4,2),

  -- Home/Away bias
  home_win_percentage INTEGER,
  away_win_percentage INTEGER,
  draw_percentage INTEGER,

  -- Season/Competition context
  season VARCHAR(50),
  competition VARCHAR(255),

  -- Metadata
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(fs_referee_id, season, competition)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fs_referees_name ON fs_referees(full_name);
CREATE INDEX IF NOT EXISTS idx_fs_referees_ts ON fs_referees(referee_id);
CREATE INDEX IF NOT EXISTS idx_fs_referees_cards ON fs_referees(avg_cards_per_match) WHERE avg_cards_per_match > 4;

-- ============================================================================
-- 5. FS_LEAGUE_STATS TABLE (League-level Stats)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fs_league_stats (
  id SERIAL PRIMARY KEY,

  -- Reference to our league (TheSports competition_id)
  competition_id VARCHAR(100),

  -- FootyStats season ID
  fs_season_id INTEGER NOT NULL,

  -- Basic info
  league_name VARCHAR(255),
  country VARCHAR(100),
  season VARCHAR(50),

  -- Match progress
  total_matches INTEGER,
  matches_completed INTEGER,

  -- AI Critical: League averages
  avg_goals_per_match DECIMAL(4,2),
  btts_percentage INTEGER,
  over25_percentage INTEGER,
  clean_sheet_percentage INTEGER,

  -- Corner stats
  avg_corners_per_match DECIMAL(4,2),
  over95_corners_percentage INTEGER,

  -- Card stats
  avg_cards_per_match DECIMAL(4,2),

  -- Result distribution
  home_win_percentage INTEGER,
  draw_percentage INTEGER,
  away_win_percentage INTEGER,

  -- Metadata
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(fs_season_id)
);

CREATE INDEX IF NOT EXISTS idx_fs_league_stats_comp ON fs_league_stats(competition_id);

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'FootyStats tables created successfully!' as result;
