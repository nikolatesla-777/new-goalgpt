-- ====================
-- GOALGPT STAGING DATA ANONYMIZATION
-- ====================
-- Purpose: Anonymize production data for staging environment
-- Run this AFTER restoring production backup to staging database
-- CRITICAL: Only run on staging database, NEVER on production!
-- ====================

BEGIN;

-- Step 1: Anonymize customer_users
DO $$
DECLARE
    affected_rows INT;
BEGIN
    RAISE NOTICE '🔐 Anonymizing customer_users...';

    UPDATE customer_users
    SET
        email = CONCAT('test_user_', id::text, '@goalgpt-staging.com'),
        phone = CASE
            WHEN phone IS NOT NULL THEN CONCAT('+90555', LPAD((RANDOM() * 9999999)::INT::TEXT, 7, '0'))
            ELSE NULL
        END,
        password_hash = '$2b$10$TEST.HASH.FOR.STAGING.USE.ONLY.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        name = CONCAT('Test User ', ROW_NUMBER() OVER (ORDER BY created_at)),
        google_id = NULL,
        apple_id = NULL,
        updated_at = NOW()
    WHERE deleted_at IS NULL;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Anonymized % users', affected_rows;
END $$;

-- Step 2: Anonymize customer_subscriptions (remove payment data)
DO $$
DECLARE
    affected_rows INT;
BEGIN
    RAISE NOTICE '💳 Removing payment data from subscriptions...';

    UPDATE customer_subscriptions
    SET
        payment_method_token = NULL,
        payment_processor_customer_id = NULL,
        updated_at = NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Cleaned % subscription records', affected_rows;
END $$;

-- Step 3: Clear OAuth identities (sensitive)
DO $$
DECLARE
    affected_rows INT;
BEGIN
    RAISE NOTICE '🔑 Clearing OAuth identities...';

    UPDATE customer_oauth_identities
    SET
        access_token = NULL,
        refresh_token = NULL,
        email = CONCAT('test_oauth_', customer_user_id::text, '@goalgpt-staging.com'),
        profile_photo_url = NULL,
        metadata = '{}'::jsonb
    WHERE deleted_at IS NULL;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Cleared % OAuth records', affected_rows;
END $$;

-- Step 4: Clear push notification tokens
DO $$
DECLARE
    affected_rows INT;
BEGIN
    RAISE NOTICE '📱 Clearing push tokens...';

    DELETE FROM customer_push_tokens;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Deleted % push tokens', affected_rows;
END $$;

-- Step 5: Reduce dataset size (keep only 1000 most recent users)
DO $$
DECLARE
    affected_rows INT;
    kept_user_ids UUID[];
BEGIN
    RAISE NOTICE '🗑️  Reducing dataset to 1000 users...';

    -- Keep 1000 most recent users (500 VIP + 500 free)
    SELECT ARRAY_AGG(id) INTO kept_user_ids FROM (
        SELECT id FROM customer_users
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1000
    ) subquery;

    -- Delete users not in kept list
    DELETE FROM customer_users
    WHERE id NOT IN (SELECT unnest(kept_user_ids))
      AND deleted_at IS NULL;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE '✅ Removed % users (kept 1000)', affected_rows;
END $$;

-- Step 6: Update staging flag (add column if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_users' AND column_name = 'is_staging'
    ) THEN
        ALTER TABLE customer_users ADD COLUMN is_staging BOOLEAN DEFAULT FALSE;
    END IF;

    UPDATE customer_users SET is_staging = TRUE;
    RAISE NOTICE '🏷️  Marked all users as staging';
END $$;

-- Step 7: Reset credit balances to reasonable amounts
DO $$
BEGIN
    RAISE NOTICE '💰 Resetting credit balances for testing...';

    UPDATE customer_credits
    SET
        balance = FLOOR(RANDOM() * 100)::INT,
        lifetime_earned = FLOOR(RANDOM() * 500)::INT,
        lifetime_spent = FLOOR(RANDOM() * 400)::INT;

    RAISE NOTICE '✅ Reset credit balances';
END $$;

-- Step 8: Vacuum and analyze
RAISE NOTICE '🧹 Running VACUUM ANALYZE...';
VACUUM ANALYZE;

-- Summary
DO $$
DECLARE
    user_count INT;
    vip_count INT;
    subscription_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM customer_users WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO subscription_count FROM customer_subscriptions WHERE status = 'active';
    SELECT COUNT(DISTINCT cs.customer_user_id) INTO vip_count
    FROM customer_subscriptions cs
    WHERE cs.status = 'active' AND cs.expires_at > NOW();

    RAISE NOTICE '';
    RAISE NOTICE '================================';
    RAISE NOTICE '✅ STAGING DATA SETUP COMPLETE';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total Users: %', user_count;
    RAISE NOTICE 'Active VIP Users: %', vip_count;
    RAISE NOTICE 'Active Subscriptions: %', subscription_count;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  WARNING: This is staging data!';
    RAISE NOTICE '   - All emails anonymized';
    RAISE NOTICE '   - All passwords reset';
    RAISE NOTICE '   - Payment data removed';
    RAISE NOTICE '   - Push tokens cleared';
    RAISE NOTICE '';
END $$;

COMMIT;
