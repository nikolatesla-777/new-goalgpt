-- HARD RESET: Truncate core tables for clean slate
-- WARNING: This will delete ALL data in these tables

TRUNCATE TABLE ts_matches CASCADE;
TRUNCATE TABLE ts_competitions CASCADE;
TRUNCATE TABLE ts_stages CASCADE;

-- Reset sync state for matches
DELETE FROM ts_sync_state WHERE entity_type = 'match';

-- Log completion
SELECT 'Hard reset completed. Tables truncated: ts_matches, ts_competitions, ts_stages' as status;









