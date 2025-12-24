-- ============================================
-- DATABASE RESET SCRIPT
-- ============================================
-- This script truncates all TheSports API cached data
-- to allow a clean "Cold Boot" with the new architecture
-- ============================================

-- Disable foreign key checks temporarily (PostgreSQL doesn't need this, but included for safety)
-- Note: PostgreSQL uses CASCADE to handle dependencies

-- Core match data
TRUNCATE TABLE ts_matches CASCADE;

-- Master data tables (in dependency order)
TRUNCATE TABLE ts_players CASCADE;
TRUNCATE TABLE ts_coaches CASCADE;
TRUNCATE TABLE ts_referees CASCADE;
TRUNCATE TABLE ts_venues CASCADE;
TRUNCATE TABLE ts_stages CASCADE;
TRUNCATE TABLE ts_seasons CASCADE;
TRUNCATE TABLE ts_teams CASCADE;
TRUNCATE TABLE ts_competitions CASCADE;
TRUNCATE TABLE ts_countries CASCADE;
TRUNCATE TABLE ts_categories CASCADE;

-- Sync state tracking
TRUNCATE TABLE ts_sync_state CASCADE;

-- ============================================
-- VERIFICATION QUERIES (Run after reset)
-- ============================================
-- SELECT COUNT(*) FROM ts_matches;        -- Should return 0
-- SELECT COUNT(*) FROM ts_teams;           -- Should return 0
-- SELECT COUNT(*) FROM ts_competitions;     -- Should return 0
-- SELECT COUNT(*) FROM ts_sync_state;      -- Should return 0
-- ============================================






