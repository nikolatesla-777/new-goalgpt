-- Migration: Add uid and is_duplicate columns to Competition, Team, Player, Coach tables
-- Run this in Supabase SQL Editor

-- Add uid and is_duplicate columns to ts_competitions
ALTER TABLE ts_competitions
ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;

-- Add uid and is_duplicate columns to ts_teams
ALTER TABLE ts_teams
ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;

-- Add uid and is_duplicate columns to ts_players
ALTER TABLE ts_players
ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;

-- Add uid and is_duplicate columns to ts_coaches
ALTER TABLE ts_coaches
ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;

-- Create indexes on uid for fast lookups
CREATE INDEX IF NOT EXISTS idx_ts_competitions_uid ON ts_competitions(uid);
CREATE INDEX IF NOT EXISTS idx_ts_teams_uid ON ts_teams(uid);
CREATE INDEX IF NOT EXISTS idx_ts_players_uid ON ts_players(uid);
CREATE INDEX IF NOT EXISTS idx_ts_coaches_uid ON ts_coaches(uid);

-- Create indexes on is_duplicate for filtering
CREATE INDEX IF NOT EXISTS idx_ts_competitions_is_duplicate ON ts_competitions(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_ts_teams_is_duplicate ON ts_teams(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_ts_players_is_duplicate ON ts_players(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_ts_coaches_is_duplicate ON ts_coaches(is_duplicate);



