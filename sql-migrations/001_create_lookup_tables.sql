-- ============================================
-- Migration 001: Create Lookup Tables
-- TheSports API Status Code Mappings
-- ============================================

-- Match States (0-13)
CREATE TABLE IF NOT EXISTS lookup_match_states (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL,
  description TEXT,
  is_live BOOLEAN DEFAULT false,
  is_finished BOOLEAN DEFAULT false
);

-- Technical Statistics (1-37+)
CREATE TABLE IF NOT EXISTS lookup_technical_statistics (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL,
  is_goal_event BOOLEAN DEFAULT false,
  is_card_event BOOLEAN DEFAULT false
);

-- Event Reasons (0-37)
CREATE TABLE IF NOT EXISTS lookup_event_reasons (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(100) NOT NULL,
  name_tr VARCHAR(100) NOT NULL
);

-- Half-time Statistics (1-83)
CREATE TABLE IF NOT EXISTS lookup_halftime_statistics (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL
);

-- Data Update Types (1-11)
CREATE TABLE IF NOT EXISTS lookup_data_update_types (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL,
  uses_match_id BOOLEAN DEFAULT false,
  uses_season_id BOOLEAN DEFAULT false
);

-- VAR Reasons (0-7)
CREATE TABLE IF NOT EXISTS lookup_var_reasons (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL
);

-- VAR Results (0-10)
CREATE TABLE IF NOT EXISTS lookup_var_results (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL
);

-- Player Positions (F, M, D, G)
CREATE TABLE IF NOT EXISTS lookup_player_positions (
  code VARCHAR(2) PRIMARY KEY,
  name_en VARCHAR(30) NOT NULL,
  name_tr VARCHAR(30) NOT NULL,
  color VARCHAR(7)
);

-- Player Detailed Positions (LW, RW, ST, etc.)
CREATE TABLE IF NOT EXISTS lookup_player_detailed_positions (
  code VARCHAR(3) PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL,
  general_position VARCHAR(2)
);

-- Player Ability Types (1-9)
CREATE TABLE IF NOT EXISTS lookup_player_ability_types (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(30) NOT NULL,
  name_tr VARCHAR(30) NOT NULL,
  is_goalkeeper_specific BOOLEAN DEFAULT false
);

-- Player Characteristics (1-43)
CREATE TABLE IF NOT EXISTS lookup_player_characteristics (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL,
  is_negative BOOLEAN DEFAULT false
);

-- Competition Types (0-3)
CREATE TABLE IF NOT EXISTS lookup_competition_types (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(30) NOT NULL,
  name_tr VARCHAR(30) NOT NULL
);

-- Gender (1-2)
CREATE TABLE IF NOT EXISTS lookup_genders (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(10) NOT NULL,
  name_tr VARCHAR(10) NOT NULL
);

-- Preferred Foot (0-3)
CREATE TABLE IF NOT EXISTS lookup_preferred_foot (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(20) NOT NULL,
  name_tr VARCHAR(20) NOT NULL
);

-- Coach Types (1-2)
CREATE TABLE IF NOT EXISTS lookup_coach_types (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(30) NOT NULL,
  name_tr VARCHAR(30) NOT NULL
);

-- Stage Modes (1-2)
CREATE TABLE IF NOT EXISTS lookup_stage_modes (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(30) NOT NULL,
  name_tr VARCHAR(30) NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_lookup_match_states_is_live ON lookup_match_states(is_live);
CREATE INDEX IF NOT EXISTS idx_lookup_match_states_is_finished ON lookup_match_states(is_finished);
CREATE INDEX IF NOT EXISTS idx_lookup_technical_statistics_is_goal ON lookup_technical_statistics(is_goal_event);
