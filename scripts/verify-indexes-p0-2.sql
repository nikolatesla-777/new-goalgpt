-- PR-P0-2: Index Verification Script
-- Verifies all 3 performance indexes were created successfully
-- Note: Does NOT include composite index (phase8 already has idx_matches_live_status)

-- ============================================================================
-- SECTION 1: Index Existence and Size Verification
-- ============================================================================

\echo '========================================='
\echo 'PR-P0-2: Index Verification'
\echo '========================================='
\echo ''
\echo 'Note: Composite index skipped (phase8 has idx_matches_live_status)'
\echo ''

-- Index 1: Live matches covering (ONLY covering, no duplicate composite)
\echo 'Index 1: idx_ts_matches_live_covering (COVERING)'
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE indexname = 'idx_ts_matches_live_covering';

\echo ''

-- Index 2: Daily lists settlement
\echo 'Index 2: idx_telegram_daily_lists_settlement_enhanced'
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE indexname = 'idx_telegram_daily_lists_settlement_enhanced';

\echo ''

-- Index 3: Subscription dashboard
\echo 'Index 3: idx_customer_subscriptions_dashboard'
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE indexname = 'idx_customer_subscriptions_dashboard';

\echo ''
\echo '========================================='
\echo 'All Indexes Summary'
\echo '========================================='

-- Summary of all 3 indexes (composite skipped - phase8 duplicate)
SELECT
  indexname,
  tablename,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE indexname IN (
  'idx_ts_matches_live_covering',
  'idx_telegram_daily_lists_settlement_enhanced',
  'idx_customer_subscriptions_dashboard'
)
ORDER BY indexname;

\echo ''
\echo '========================================='
\echo 'SECTION 2: Query Plan Verification'
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 2: Query Plan Verification
-- ============================================================================

-- Test 1: Live matches query (should use covering index)
\echo 'Test 1: Live Matches Query Plan'
\echo 'Expected: Index Scan or Index-Only Scan using idx_ts_matches_live_covering'
\echo 'Note: Planner may also choose phase8 idx_matches_live_status (both valid)'
\echo ''

EXPLAIN (ANALYZE, BUFFERS)
SELECT m.external_id, m.status_id, m.minute, m.match_time
FROM ts_matches m
WHERE m.status_id IN (2, 3, 4, 5, 7)
  AND m.match_time <= EXTRACT(EPOCH FROM NOW()) * 1000
ORDER BY m.match_time DESC
LIMIT 50;

\echo ''
\echo '========================================='
\echo ''

-- Test 2: Daily lists settlement query
\echo 'Test 2: Daily Lists Settlement Query Plan'
\echo 'Expected: Index Scan using idx_telegram_daily_lists_settlement_enhanced'
\echo ''

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, market, list_date, matches, telegram_message_id, channel_id
FROM telegram_daily_lists
WHERE status = 'active'
  AND settled_at IS NULL
  AND telegram_message_id IS NOT NULL
  AND list_date <= EXTRACT(EPOCH FROM NOW()) * 1000
ORDER BY list_date ASC, market ASC
LIMIT 100;

\echo ''
\echo '========================================='
\echo ''

-- Test 3: Subscription dashboard query
\echo 'Test 3: Subscription Dashboard Query Plan'
\echo 'Expected: Index Scan using idx_customer_subscriptions_dashboard'
\echo ''

EXPLAIN (ANALYZE, BUFFERS)
SELECT
  COUNT(*) as total_count,
  SUM(CASE WHEN created_at >= (EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000) THEN 1 ELSE 0 END) as recent_count
FROM customer_subscriptions
WHERE status NOT IN ('canceled', 'expired');

\echo ''
\echo '========================================='
\echo 'SECTION 3: Index Health Check'
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 3: Index Health Check
-- ============================================================================

-- Check for invalid indexes (should be empty)
\echo 'Invalid Indexes Check (should be empty):'
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname IN (
  'idx_ts_matches_live_covering',
  'idx_telegram_daily_lists_settlement_enhanced',
  'idx_customer_subscriptions_dashboard'
)
AND indexname IN (
  SELECT indexrelid::regclass::text
  FROM pg_index
  WHERE NOT indisvalid
);

\echo ''
\echo '========================================='
\echo 'Verification Complete'
\echo '========================================='
\echo ''
\echo 'If all 3 indexes appear above with sizes and query plans show Index Scan,'
\echo 'then PR-P0-2 was deployed successfully.'
\echo ''
\echo 'Note: Composite index intentionally skipped (phase8 already has equivalent)'
\echo ''
