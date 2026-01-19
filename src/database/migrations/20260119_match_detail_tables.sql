-- Match Detail Tables Migration
-- Date: 2026-01-19
-- Purpose: Create tables for Match Detail page (Database-First architecture)

-- ============================================
-- 1. MATCH STATS TABLE (Stats Tab)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_match_stats (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  stat_type VARCHAR(50) NOT NULL,  -- possession, shots, shots_on_target, corners, fouls, offsides, yellow_cards, red_cards, passes, pass_accuracy, attacks, dangerous_attacks
  home_value NUMERIC,
  away_value NUMERIC,
  minute INT DEFAULT NULL,  -- NULL means final/aggregate stat
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, stat_type, COALESCE(minute, -1))
);

CREATE INDEX IF NOT EXISTS idx_match_stats_match_id ON ts_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_match_stats_type ON ts_match_stats(stat_type);

-- ============================================
-- 2. MATCH INCIDENTS TABLE (Events Tab)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_match_incidents (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  incident_type VARCHAR(30) NOT NULL,  -- goal, yellow_card, red_card, substitution, penalty, var, own_goal
  minute INT NOT NULL,
  added_time INT DEFAULT NULL,  -- +3, +5 etc for injury time
  team VARCHAR(10) NOT NULL,  -- home/away
  player_id VARCHAR(50),
  player_name VARCHAR(100),
  assist_player_id VARCHAR(50),
  assist_player_name VARCHAR(100),
  in_player_id VARCHAR(50),  -- for substitutions
  in_player_name VARCHAR(100),
  out_player_id VARCHAR(50),
  out_player_name VARCHAR(100),
  reason VARCHAR(200),  -- for cards, VAR decisions
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, incident_type, minute, COALESCE(player_id, ''), COALESCE(added_time, 0))
);

CREATE INDEX IF NOT EXISTS idx_match_incidents_match_id ON ts_match_incidents(match_id);
CREATE INDEX IF NOT EXISTS idx_match_incidents_type ON ts_match_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_match_incidents_player ON ts_match_incidents(player_id);

-- ============================================
-- 3. MATCH LINEUPS TABLE (Lineup Tab)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_match_lineups (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  team VARCHAR(10) NOT NULL,  -- home/away
  formation VARCHAR(20),  -- 4-3-3, 4-2-3-1, etc
  player_id VARCHAR(50) NOT NULL,
  player_name VARCHAR(100),
  shirt_number INT,
  position VARCHAR(30),  -- GK, LB, CB, RB, CM, LW, RW, ST, etc
  is_starter BOOLEAN DEFAULT true,
  x_position NUMERIC,  -- pitch position for visualization (0-100)
  y_position NUMERIC,  -- pitch position for visualization (0-100)
  rating NUMERIC(3,1),  -- player rating if available
  is_captain BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, team, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_lineups_match_id ON ts_match_lineups(match_id);
CREATE INDEX IF NOT EXISTS idx_match_lineups_player ON ts_match_lineups(player_id);

-- ============================================
-- 4. MATCH TREND TABLE (Trend Tab)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_match_trend (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  minute INT NOT NULL,
  home_possession INT,
  away_possession INT,
  home_attacks INT,
  away_attacks INT,
  home_dangerous_attacks INT,
  away_dangerous_attacks INT,
  home_shots INT,
  away_shots INT,
  home_shots_on_target INT,
  away_shots_on_target INT,
  home_corners INT,
  away_corners INT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, minute)
);

CREATE INDEX IF NOT EXISTS idx_match_trend_match_id ON ts_match_trend(match_id);

-- ============================================
-- 5. MATCH COMMENTS TABLE (Forum Tab - Comments)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_match_comments (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  parent_id INT REFERENCES ts_match_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_comments_match_id ON ts_match_comments(match_id);
CREATE INDEX IF NOT EXISTS idx_match_comments_user_id ON ts_match_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_match_comments_parent_id ON ts_match_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_match_comments_created ON ts_match_comments(match_id, created_at DESC);

-- Comment likes table (to track who liked what)
CREATE TABLE IF NOT EXISTS ts_match_comment_likes (
  id SERIAL PRIMARY KEY,
  comment_id INT NOT NULL REFERENCES ts_match_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- ============================================
-- 6. MATCH POLLS TABLE (Forum Tab - Polls)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_match_polls (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL UNIQUE,
  question VARCHAR(200) NOT NULL DEFAULT 'Kim kazanır?',
  option_home_votes INT DEFAULT 0,
  option_draw_votes INT DEFAULT 0,
  option_away_votes INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_match_polls_match_id ON ts_match_polls(match_id);

-- Poll votes table (to track who voted what)
CREATE TABLE IF NOT EXISTS ts_match_poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INT NOT NULL REFERENCES ts_match_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote VARCHAR(10) NOT NULL,  -- home/draw/away
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- ============================================
-- 7. MATCH CHAT TABLE (Forum Tab - Live Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_match_chat (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  username VARCHAR(100),  -- denormalized for performance
  message VARCHAR(500) NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_chat_match_time ON ts_match_chat(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_chat_user ON ts_match_chat(user_id);

-- ============================================
-- 8. H2H CACHE TABLE (H2H Tab)
-- ============================================
CREATE TABLE IF NOT EXISTS ts_h2h_cache (
  id SERIAL PRIMARY KEY,
  home_team_id VARCHAR(50) NOT NULL,
  away_team_id VARCHAR(50) NOT NULL,
  cache_data JSONB NOT NULL,  -- Contains summary, previous_matches, forms
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,  -- 7 days from creation
  UNIQUE(home_team_id, away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_h2h_cache_teams ON ts_h2h_cache(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_h2h_cache_expires ON ts_h2h_cache(expires_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_ts_match_stats_updated_at ON ts_match_stats;
CREATE TRIGGER update_ts_match_stats_updated_at
  BEFORE UPDATE ON ts_match_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ts_match_lineups_updated_at ON ts_match_lineups;
CREATE TRIGGER update_ts_match_lineups_updated_at
  BEFORE UPDATE ON ts_match_lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ts_match_comments_updated_at ON ts_match_comments;
CREATE TRIGGER update_ts_match_comments_updated_at
  BEFORE UPDATE ON ts_match_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Run this SQL against your PostgreSQL database:
-- psql -U your_user -d your_database -f 20260119_match_detail_tables.sql
