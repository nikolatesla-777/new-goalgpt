-- Migration: Create ts_incidents table
-- Purpose: Store match incidents (goals, cards, substitutions, etc.) for Events tab
-- Created: 2026-01-12

-- Drop if exists (for development)
-- DROP TABLE IF EXISTS ts_incidents;

CREATE TABLE IF NOT EXISTS ts_incidents (
  id SERIAL PRIMARY KEY,
  
  -- Match reference
  match_id TEXT NOT NULL,
  
  -- Incident data
  type INTEGER NOT NULL,           -- Event type (1=goal, 3=yellow, 4=red, 9=sub, etc.)
  time INTEGER NOT NULL,           -- Minute of incident
  position INTEGER DEFAULT 0,      -- 1=home, 2=away, 0=neutral
  
  -- Player info
  player_name TEXT,
  player_id TEXT,
  assist1_name TEXT,
  
  -- Substitution specific
  in_player_name TEXT,
  out_player_name TEXT,
  
  -- Score at incident time (for goals)
  home_score INTEGER,
  away_score INTEGER,
  
  -- Additional metadata
  var_reason INTEGER,
  reason_type INTEGER,
  add_time INTEGER,               -- Extra time minutes (e.g., +3)
  
  -- Deduplication and tracking
  incident_key TEXT UNIQUE,       -- Unique key: match_id:type:time:position
  source TEXT DEFAULT 'api',      -- Source: api, websocket, polling
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_match ON ts_incidents(match_id);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON ts_incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON ts_incidents(created_at);

-- Comments
COMMENT ON TABLE ts_incidents IS 'Match incidents/events from TheSports API';
COMMENT ON COLUMN ts_incidents.incident_key IS 'Unique key for deduplication: match_id:type:time:position';
COMMENT ON COLUMN ts_incidents.type IS 'TheSports event type: 1=goal, 3=yellow, 4=red, 8=penalty, 9=sub, 17=own_goal';
