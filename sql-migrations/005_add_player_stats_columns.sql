-- ============================================
-- Migration 005: Add Missing Player Stats Columns
-- BASIC DATA - ts_match_player_stats table
-- ============================================

-- Free kick stats
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS freekicks INTEGER DEFAULT 0;
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS freekick_goals INTEGER DEFAULT 0;

-- Woodwork
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS hit_woodwork INTEGER DEFAULT 0;

-- Fast break stats
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS fastbreaks INTEGER DEFAULT 0;
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS fastbreak_shots INTEGER DEFAULT 0;
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS fastbreak_goals INTEGER DEFAULT 0;

-- Possession
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS poss_losts INTEGER DEFAULT 0;

-- Aerial duels
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS aerial_won INTEGER DEFAULT 0;
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS aerial_lost INTEGER DEFAULT 0;

-- Ground duels
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS duel_won INTEGER DEFAULT 0;
ALTER TABLE ts_match_player_stats ADD COLUMN IF NOT EXISTS duel_lost INTEGER DEFAULT 0;

-- Comments
COMMENT ON COLUMN ts_match_player_stats.freekicks IS 'Free kicks taken';
COMMENT ON COLUMN ts_match_player_stats.freekick_goals IS 'Goals from free kicks';
COMMENT ON COLUMN ts_match_player_stats.hit_woodwork IS 'Shots hit woodwork';
COMMENT ON COLUMN ts_match_player_stats.fastbreaks IS 'Fast break participations';
COMMENT ON COLUMN ts_match_player_stats.fastbreak_shots IS 'Shots from fast breaks';
COMMENT ON COLUMN ts_match_player_stats.fastbreak_goals IS 'Goals from fast breaks';
COMMENT ON COLUMN ts_match_player_stats.poss_losts IS 'Possession lost count';
COMMENT ON COLUMN ts_match_player_stats.aerial_won IS 'Aerial duels won';
COMMENT ON COLUMN ts_match_player_stats.aerial_lost IS 'Aerial duels lost';
COMMENT ON COLUMN ts_match_player_stats.duel_won IS 'Ground duels won';
COMMENT ON COLUMN ts_match_player_stats.duel_lost IS 'Ground duels lost';
