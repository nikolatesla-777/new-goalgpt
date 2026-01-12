-- ============================================================================
-- Phase 2 Production Monitoring Queries
-- 24-hour monitoring dashboard for Phase 2 deployment
-- ============================================================================

-- ============================================================================
-- 1. OVERALL HEALTH METRICS
-- ============================================================================

-- Total active users (should stay at ~49,587)
SELECT
    'Active Users' as metric,
    COUNT(*) as value,
    'Should be ~49,587' as expected
FROM customer_users
WHERE deleted_at IS NULL;

-- XP records initialized
SELECT
    'XP Records' as metric,
    COUNT(*) as value,
    'Should be ~49,587' as expected
FROM customer_xp;

-- Credits records initialized
SELECT
    'Credits Records' as metric,
    COUNT(*) as value,
    'Should be ~49,587' as expected
FROM customer_credits;

-- ============================================================================
-- 2. AUTHENTICATION METRICS (Last 24 Hours)
-- ============================================================================

-- OAuth identities created (since deployment)
SELECT
    provider,
    COUNT(*) as user_count,
    MAX(linked_at) as last_login,
    MIN(linked_at) as first_login
FROM customer_oauth_identities
WHERE linked_at > NOW() - INTERVAL '24 hours'
GROUP BY provider
ORDER BY user_count DESC;

-- Last login activity by provider
SELECT
    provider,
    COUNT(*) as logins_count,
    COUNT(DISTINCT customer_user_id) as unique_users
FROM customer_oauth_identities
WHERE last_login_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;

-- New users created (last 24 hours)
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as new_users
FROM customer_users
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Authentication failure indicators
-- (Users with OAuth identity but no recent last_login_at update)
SELECT
    provider,
    COUNT(*) as potentially_failed_logins
FROM customer_oauth_identities
WHERE linked_at > NOW() - INTERVAL '24 hours'
  AND (last_login_at IS NULL OR last_login_at < linked_at)
GROUP BY provider;

-- ============================================================================
-- 3. XP SYSTEM METRICS (Last 24 Hours)
-- ============================================================================

-- XP transactions summary
SELECT
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(xp_amount) as total_xp_granted,
    AVG(xp_amount) as avg_xp_per_transaction,
    COUNT(DISTINCT customer_user_id) as unique_users
FROM customer_xp_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY transaction_type
ORDER BY transaction_count DESC;

-- Users who leveled up (last 24 hours)
SELECT
    level,
    COUNT(*) as users_at_level
FROM customer_xp
WHERE updated_at > NOW() - INTERVAL '24 hours'
  AND level != 'bronze'  -- Exclude initial bronze users
GROUP BY level
ORDER BY
    CASE level
        WHEN 'bronze' THEN 1
        WHEN 'silver' THEN 2
        WHEN 'gold' THEN 3
        WHEN 'platinum' THEN 4
        WHEN 'diamond' THEN 5
        WHEN 'vip_elite' THEN 6
    END;

-- Login streak activity (daily logins)
SELECT
    COUNT(*) as users_logged_in_today,
    AVG(current_streak_days) as avg_streak,
    MAX(current_streak_days) as max_streak
FROM customer_xp
WHERE last_activity_date = CURRENT_DATE;

-- Top XP earners (last 24 hours)
SELECT
    cu.name,
    cu.email,
    xp.xp_points as current_xp,
    xp.level,
    SUM(xpt.xp_amount) as xp_earned_24h
FROM customer_xp xp
JOIN customer_users cu ON cu.id = xp.customer_user_id
LEFT JOIN customer_xp_transactions xpt ON xpt.customer_user_id = xp.customer_user_id
    AND xpt.created_at > NOW() - INTERVAL '24 hours'
WHERE cu.deleted_at IS NULL
GROUP BY cu.id, cu.name, cu.email, xp.xp_points, xp.level
ORDER BY xp_earned_24h DESC
LIMIT 10;

-- ============================================================================
-- 4. CREDITS SYSTEM METRICS (Last 24 Hours)
-- ============================================================================

-- Credits transactions summary
SELECT
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
    COUNT(DISTINCT customer_user_id) as unique_users
FROM customer_credit_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY transaction_type
ORDER BY transaction_count DESC;

-- Ad reward fraud detection check
-- Users who watched > 10 ads today (should be NONE)
SELECT
    customer_user_id,
    COUNT(*) as ads_watched_today,
    'FRAUD ALERT' as status
FROM customer_ad_views
WHERE completed_at > CURRENT_DATE
  AND reward_granted = true
GROUP BY customer_user_id
HAVING COUNT(*) > 10
ORDER BY ads_watched_today DESC;

-- Ad reward statistics
SELECT
    ad_network,
    ad_type,
    COUNT(*) as total_ads,
    COUNT(DISTINCT customer_user_id) as unique_users,
    SUM(reward_amount) as total_credits_earned
FROM customer_ad_views
WHERE completed_at > NOW() - INTERVAL '24 hours'
  AND reward_granted = true
GROUP BY ad_network, ad_type
ORDER BY total_ads DESC;

-- Users approaching ad limit today
SELECT
    customer_user_id,
    COUNT(*) as ads_today,
    10 - COUNT(*) as ads_remaining,
    MAX(completed_at) as last_ad_time
FROM customer_ad_views
WHERE completed_at > CURRENT_DATE
  AND reward_granted = true
GROUP BY customer_user_id
HAVING COUNT(*) >= 5  -- Show users who watched 5+ ads
ORDER BY ads_today DESC;

-- Top credit earners (last 24 hours)
SELECT
    cu.name,
    cu.email,
    c.balance as current_balance,
    SUM(CASE WHEN ct.amount > 0 THEN ct.amount ELSE 0 END) as earned_24h,
    SUM(CASE WHEN ct.amount < 0 THEN ABS(ct.amount) ELSE 0 END) as spent_24h
FROM customer_credits c
JOIN customer_users cu ON cu.id = c.customer_user_id
LEFT JOIN customer_credit_transactions ct ON ct.customer_user_id = c.customer_user_id
    AND ct.created_at > NOW() - INTERVAL '24 hours'
WHERE cu.deleted_at IS NULL
GROUP BY cu.id, cu.name, cu.email, c.balance
ORDER BY earned_24h DESC
LIMIT 10;

-- ============================================================================
-- 5. PERFORMANCE METRICS
-- ============================================================================

-- Database query performance (requires pg_stat_statements extension)
SELECT
    LEFT(query, 100) as query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
    ROUND(total_exec_time::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query LIKE '%customer_xp%'
   OR query LIKE '%customer_credits%'
   OR query LIKE '%customer_oauth%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Active database connections
SELECT
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active,
    COUNT(*) FILTER (WHERE state = 'idle') as idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database();

-- Table sizes (to monitor growth)
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'customer_xp%'
    OR tablename LIKE 'customer_credit%'
    OR tablename LIKE 'customer_oauth%')
ORDER BY bytes DESC;

-- ============================================================================
-- 6. ERROR DETECTION
-- ============================================================================

-- Users with NULL XP records (should be NONE)
SELECT
    COUNT(*) as users_without_xp,
    'Should be 0' as expected
FROM customer_users cu
LEFT JOIN customer_xp xp ON xp.customer_user_id = cu.id
WHERE cu.deleted_at IS NULL
  AND xp.id IS NULL;

-- Users with NULL Credits records (should be NONE)
SELECT
    COUNT(*) as users_without_credits,
    'Should be 0' as expected
FROM customer_users cu
LEFT JOIN customer_credits c ON c.customer_user_id = cu.id
WHERE cu.deleted_at IS NULL
  AND c.id IS NULL;

-- Negative credit balances (should be NONE - data integrity issue)
SELECT
    customer_user_id,
    balance,
    'DATA INTEGRITY ERROR' as status
FROM customer_credits
WHERE balance < 0;

-- XP transaction inconsistencies
-- (Users whose XP points don't match transaction history)
WITH user_xp_calc AS (
    SELECT
        customer_user_id,
        SUM(xp_amount) as calculated_xp
    FROM customer_xp_transactions
    GROUP BY customer_user_id
)
SELECT
    xp.customer_user_id,
    xp.xp_points as current_xp,
    calc.calculated_xp,
    xp.xp_points - COALESCE(calc.calculated_xp, 0) as difference,
    'XP MISMATCH' as status
FROM customer_xp xp
LEFT JOIN user_xp_calc calc ON calc.customer_user_id = xp.customer_user_id
WHERE xp.xp_points != COALESCE(calc.calculated_xp, 0)
LIMIT 10;

-- ============================================================================
-- 7. HOURLY TRENDS (Last 24 Hours)
-- ============================================================================

-- Authentication activity by hour
SELECT
    DATE_TRUNC('hour', linked_at) as hour,
    provider,
    COUNT(*) as new_logins
FROM customer_oauth_identities
WHERE linked_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, provider
ORDER BY hour DESC, provider;

-- XP transactions by hour
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as transactions,
    SUM(xp_amount) as total_xp,
    COUNT(DISTINCT customer_user_id) as unique_users
FROM customer_xp_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Credits transactions by hour
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as transactions,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as earned,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as spent,
    COUNT(DISTINCT customer_user_id) as unique_users
FROM customer_credit_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- ============================================================================
-- 8. SUCCESS CRITERIA VALIDATION
-- ============================================================================

-- Phase 2 Success Metrics
SELECT
    'Metric' as check_name,
    'Current Value' as current_value,
    'Success Criteria' as criteria,
    'Status' as status
UNION ALL

-- Check 1: No data loss
SELECT
    'User Count',
    COUNT(*)::text,
    '49,587 (no data loss)',
    CASE WHEN COUNT(*) >= 49587 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM customer_users
WHERE deleted_at IS NULL

UNION ALL

-- Check 2: XP initialization
SELECT
    'XP Records',
    COUNT(*)::text,
    '49,587 (all users)',
    CASE WHEN COUNT(*) >= 49587 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM customer_xp

UNION ALL

-- Check 3: Credits initialization
SELECT
    'Credits Records',
    COUNT(*)::text,
    '49,587 (all users)',
    CASE WHEN COUNT(*) >= 49587 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM customer_credits

UNION ALL

-- Check 4: OAuth activity
SELECT
    'OAuth Logins (24h)',
    COUNT(*)::text,
    '> 0 (authentication working)',
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '⚠️  PENDING' END
FROM customer_oauth_identities
WHERE linked_at > NOW() - INTERVAL '24 hours'

UNION ALL

-- Check 5: No fraud violations
SELECT
    'Ad Fraud Violations',
    COUNT(*)::text,
    '0 (no users > 10 ads/day)',
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM (
    SELECT customer_user_id, COUNT(*) as ads_today
    FROM customer_ad_views
    WHERE completed_at > CURRENT_DATE AND reward_granted = true
    GROUP BY customer_user_id
    HAVING COUNT(*) > 10
) fraud_check

UNION ALL

-- Check 6: No negative balances
SELECT
    'Negative Balances',
    COUNT(*)::text,
    '0 (data integrity)',
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM customer_credits
WHERE balance < 0;

-- ============================================================================
-- 9. QUICK HEALTH CHECK (Run Every 15 Minutes)
-- ============================================================================

-- Quick health summary
SELECT
    'Phase 2 Health Check - ' || NOW()::text as timestamp,
    (SELECT COUNT(*) FROM customer_users WHERE deleted_at IS NULL) as active_users,
    (SELECT COUNT(*) FROM customer_oauth_identities WHERE linked_at > NOW() - INTERVAL '1 hour') as logins_last_hour,
    (SELECT COUNT(*) FROM customer_xp_transactions WHERE created_at > NOW() - INTERVAL '1 hour') as xp_transactions_last_hour,
    (SELECT COUNT(*) FROM customer_credit_transactions WHERE created_at > NOW() - INTERVAL '1 hour') as credit_transactions_last_hour,
    (SELECT COUNT(*) FROM customer_ad_views WHERE completed_at > NOW() - INTERVAL '1 hour') as ads_last_hour;

-- ============================================================================
-- END OF MONITORING QUERIES
-- ============================================================================

-- To run all queries:
-- psql $DATABASE_URL -f scripts/monitor-phase2-production.sql

-- To run specific sections:
-- psql $DATABASE_URL -c "SELECT ..." (copy individual query)

-- To export results to CSV:
-- psql $DATABASE_URL -c "COPY (SELECT ...) TO STDOUT WITH CSV HEADER" > results.csv
