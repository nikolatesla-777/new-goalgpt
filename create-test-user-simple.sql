-- Simple Test User Setup (without ON CONFLICT)
-- Email: test@goalgpt.com
-- Password: test123

-- Step 1: Delete existing test user if any
DELETE FROM customer_users WHERE email = 'test@goalgpt.com';

-- Step 2: Create test user
INSERT INTO customer_users (
  email,
  password_hash,
  full_name,
  referral_code,
  is_active,
  created_at,
  updated_at
) VALUES (
  'test@goalgpt.com',
  '$2b$10$J4xKXrQ5ws/IDONwvnCUcuitEPYV2i31fEo2j5ow/.l/qyDeWLDBW',
  'Test User',
  'TESTGG',
  true,
  NOW(),
  NOW()
)
RETURNING id;

-- Step 3: Get the user ID
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM customer_users WHERE email = 'test@goalgpt.com';

  -- Step 4: Create XP record
  INSERT INTO customer_xp (
    customer_user_id,
    xp_points,
    level,
    level_progress,
    current_streak_days,
    longest_streak_days,
    total_earned,
    achievements_count,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    500,
    'silver',
    25.5,
    5,
    10,
    500,
    3,
    NOW(),
    NOW()
  );

  -- Step 5: Create Credits record
  INSERT INTO customer_credits (
    customer_user_id,
    balance,
    lifetime_earned,
    lifetime_spent,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    250,
    500,
    250,
    NOW(),
    NOW()
  );
END $$;

-- Verification
SELECT
  'Test user created successfully!' as message,
  u.id,
  u.email,
  u.full_name,
  x.xp_points,
  x.level,
  c.balance as credits
FROM customer_users u
LEFT JOIN customer_xp x ON x.customer_user_id = u.id
LEFT JOIN customer_credits c ON c.customer_user_id = u.id
WHERE u.email = 'test@goalgpt.com';
