-- Complete Test User Setup
-- Email: test@goalgpt.com
-- Password: test123

-- Step 1: Create test user
INSERT INTO customer_users (
  id,
  email,
  password_hash,
  full_name,
  referral_code,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'test@goalgpt.com',
  '$2b$10$J4xKXrQ5ws/IDONwvnCUcuitEPYV2i31fEo2j5ow/.l/qyDeWLDBW', -- test123
  'Test User',
  'TESTGG',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- Step 2: Create XP record for test user
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
  '00000000-0000-0000-0000-000000000001'::uuid,
  500,
  'silver',
  25.5,
  5,
  10,
  500,
  3,
  NOW(),
  NOW()
) ON CONFLICT (customer_user_id) DO UPDATE SET
  xp_points = EXCLUDED.xp_points,
  level = EXCLUDED.level,
  updated_at = NOW();

-- Step 3: Create Credits record for test user
INSERT INTO customer_credits (
  customer_user_id,
  balance,
  lifetime_earned,
  lifetime_spent,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  250,
  500,
  250,
  NOW(),
  NOW()
) ON CONFLICT (customer_user_id) DO UPDATE SET
  balance = EXCLUDED.balance,
  lifetime_earned = EXCLUDED.lifetime_earned,
  lifetime_spent = EXCLUDED.lifetime_spent,
  updated_at = NOW();

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
