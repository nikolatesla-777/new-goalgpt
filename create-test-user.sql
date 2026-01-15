-- Test user credentials:
-- Email: test@goalgpt.com
-- Password: test123

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
  gen_random_uuid(),
  'test@goalgpt.com',
  '$2b$10$rQ5K5mF0vZ0gD8nJ5Zx5Zu5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5', -- test123
  'Test User',
  'TESTGG',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;
