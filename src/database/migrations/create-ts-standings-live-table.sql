-- Live Standings Table
-- Stores real-time standings from TheSports /table/live endpoint

CREATE TABLE IF NOT EXISTS ts_standings_live (
  season_id VARCHAR(50) PRIMARY KEY,
  standings JSONB NOT NULL,
  raw_response JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_ts_standings_live_updated_at ON ts_standings_live(updated_at);

COMMENT ON TABLE ts_standings_live IS 'Real-time standings from TheSports /table/live (updates every 2 mins during live matches)';
COMMENT ON COLUMN ts_standings_live.season_id IS 'Season external ID (primary key)';
COMMENT ON COLUMN ts_standings_live.standings IS 'Live standings array (team positions with ongoing match results)';
COMMENT ON COLUMN ts_standings_live.raw_response IS 'Full API response from /table/live';
COMMENT ON COLUMN ts_standings_live.updated_at IS 'Last sync time';
