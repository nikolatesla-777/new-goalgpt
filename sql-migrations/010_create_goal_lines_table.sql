-- ============================================
-- Migration 010: Create Goal Lines Table
-- BASIC DATA - Match goal animation data
-- ============================================

CREATE TABLE IF NOT EXISTS ts_match_goal_lines (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(50) NOT NULL,
  goal_number INTEGER NOT NULL,
  time_seconds INTEGER,
  goal_x DECIMAL(5,2),
  goal_y DECIMAL(5,2),
  own_goal INTEGER DEFAULT 0,
  pass_data JSONB,
  goalkeeper_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, goal_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ts_match_goal_lines_match_id ON ts_match_goal_lines(match_id);
CREATE INDEX IF NOT EXISTS idx_ts_match_goal_lines_own_goal ON ts_match_goal_lines(own_goal) WHERE own_goal = 1;

-- Comments
COMMENT ON TABLE ts_match_goal_lines IS 'Goal animation/line data for matches';
COMMENT ON COLUMN ts_match_goal_lines.match_id IS 'TheSports match ID';
COMMENT ON COLUMN ts_match_goal_lines.goal_number IS 'Goal sequence number (1, 2, 3...)';
COMMENT ON COLUMN ts_match_goal_lines.time_seconds IS 'Goal time in seconds';
COMMENT ON COLUMN ts_match_goal_lines.goal_x IS 'Goal x-coordinate (max 9.6)';
COMMENT ON COLUMN ts_match_goal_lines.goal_y IS 'Goal y-coordinate (max 38)';
COMMENT ON COLUMN ts_match_goal_lines.own_goal IS 'Is own goal? 1=Yes';
COMMENT ON COLUMN ts_match_goal_lines.pass_data IS 'Passing line data array';
COMMENT ON COLUMN ts_match_goal_lines.goalkeeper_data IS 'Goalkeeper position data';

-- ============================================
-- Pass data structure (for reference):
-- [
--   {
--     "belong": 1,          // 1=home, 2=away
--     "player_id": "xxx",
--     "shirt_number": "10",
--     "x": "50.5",          // Field x (0-100)
--     "y": "30.2",          // Field y (0-100)
--     "shooter": 1,         // Is shooter? 1=yes
--     "assist": 0           // Is assist? 1=yes
--   }
-- ]
-- ============================================

-- ============================================
-- Goalkeeper data structure (for reference):
-- {
--   "belong": 2,            // 1=home, 2=away
--   "player_id": "xxx",
--   "shirt_number": "1"
-- }
-- ============================================
