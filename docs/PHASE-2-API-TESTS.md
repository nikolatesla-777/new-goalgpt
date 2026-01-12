# Phase 2 API Testing Guide

> **Manual test collection for Phase 2 Authentication, XP, and Credits APIs**
> **Status:** Ready for testing on staging/production
> **Last Updated:** 2026-01-12

---

## Prerequisites

Before testing, ensure you have:
- [ ] Backend server running (staging or local)
- [ ] Firebase service account JSON configured
- [ ] Database populated with Phase 1 migrations
- [ ] JWT secrets configured in `.env`
- [ ] Test user credentials ready

---

## Environment Variables

```bash
# .env (Backend)
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/goalgpt

# Firebase Admin SDK
# Place firebase-service-account.json in project root

# JWT Secrets
JWT_SECRET=your-secret-key-256-bit
JWT_REFRESH_SECRET=your-refresh-secret-256-bit
```

---

## Test Sequence

### 1️⃣ Authentication Tests

#### 1.1 Google OAuth Sign In

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/google/signin \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
    "deviceInfo": {
      "deviceId": "test-device-001",
      "platform": "ios",
      "appVersion": "2.0.0"
    }
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "test@gmail.com",
    "name": "Test User",
    "profilePhotoUrl": "https://...",
    "isNewUser": true,
    "xpLevel": "bronze",
    "creditsBalance": 0
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**Test Cases:**
- [ ] New user: Creates user, OAuth identity, XP, Credits
- [ ] Existing user: Returns existing user with updated last login
- [ ] Invalid token: Returns 401 with error message
- [ ] Duplicate email: Links OAuth identity to existing email account

---

#### 1.2 Apple Sign In

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/apple/signin \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "eyJraWQiOiJlWGF1bm1MIiwiYWxnIjoi...",
    "email": "test@privaterelay.appleid.com",
    "name": "Test User",
    "deviceInfo": {
      "deviceId": "test-device-002",
      "platform": "ios",
      "appVersion": "2.0.0"
    }
  }'
```

**Expected Response (200):** Same structure as Google OAuth

**Test Cases:**
- [ ] First sign-in with email/name provided
- [ ] Subsequent sign-ins without email/name (Apple privacy)
- [ ] Invalid token: Returns 401

---

#### 1.3 Phone Authentication

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/phone/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+905551234567",
    "deviceInfo": {
      "deviceId": "test-device-003",
      "platform": "android",
      "appVersion": "2.0.0"
    }
  }'
```

**Expected Response (200):** Same structure as OAuth

**Test Cases:**
- [ ] Valid E.164 phone format
- [ ] Invalid phone format: Returns 400
- [ ] Existing user: Returns user data
- [ ] New user: Creates user with phone

---

#### 1.4 Refresh Token

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**Test Cases:**
- [ ] Valid refresh token: Returns new access token
- [ ] Expired refresh token: Returns 401
- [ ] Invalid refresh token: Returns 401

---

#### 1.5 Get User Profile

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "test@gmail.com",
    "phone": "+905551234567",
    "name": "Test User",
    "username": null,
    "referralCode": "GOAL-ABC12",
    "createdAt": "2026-01-12T00:00:00Z",
    "xp": {
      "xpPoints": 0,
      "level": "bronze",
      "levelProgress": 0.0,
      "currentStreak": 0,
      "longestStreak": 0
    },
    "credits": {
      "balance": 0,
      "lifetimeEarned": 0,
      "lifetimeSpent": 0
    },
    "subscription": {
      "status": "inactive",
      "expiredAt": null
    }
  }
}
```

**Test Cases:**
- [ ] Valid token: Returns full user profile
- [ ] Missing token: Returns 401
- [ ] Invalid token: Returns 401
- [ ] Deleted user: Returns 401

---

#### 1.6 Logout

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Test Cases:**
- [ ] Valid token: Invalidates FCM tokens
- [ ] Missing token: Returns 401

---

### 2️⃣ XP System Tests

#### 2.1 Get User XP Profile

**Request:**
```bash
curl -X GET http://localhost:3000/api/xp/me \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "xpPoints": 0,
    "level": "bronze",
    "levelProgress": 0.0,
    "totalEarned": 0,
    "currentStreak": 0,
    "longestStreak": 0,
    "lastActivityDate": null,
    "nextLevelXP": 500,
    "achievementsCount": 0,
    "levelName": "Bronz"
  }
}
```

**Test Cases:**
- [ ] New user: Shows bronze level, 0 XP
- [ ] User with XP: Shows correct level and progress
- [ ] Missing auth: Returns 401

---

#### 2.2 Grant XP (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/api/xp/grant \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "target-user-uuid",
    "amount": 100,
    "transactionType": "admin_grant",
    "description": "Manual XP grant for testing",
    "metadata": {
      "reason": "test"
    }
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "oldXP": 0,
    "newXP": 100,
    "oldLevel": "bronze",
    "newLevel": "bronze",
    "leveledUp": false
  }
}
```

**Test Cases:**
- [ ] Grant XP: Updates user XP correctly
- [ ] Level-up: Triggers when crossing threshold (500, 2000, 5000, 10000, 25000)
- [ ] Level-up rewards: Grants credits (Silver: 25, Gold: 50, Platinum: 100, Diamond: 250, VIP Elite: 500)
- [ ] Negative XP: Should be prevented or handled gracefully
- [ ] Zero XP: Returns error

---

#### 2.3 Update Login Streak

**Request:**
```bash
curl -X POST http://localhost:3000/api/xp/login-streak \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

**Expected Response (200) - First Login:**
```json
{
  "success": true,
  "data": {
    "currentStreak": 1,
    "longestStreak": 1,
    "xpGranted": 10
  },
  "message": "Günlük giriş bonusu kazandın! 10 XP"
}
```

**Expected Response (200) - Already Logged In Today:**
```json
{
  "success": true,
  "data": {
    "currentStreak": 1,
    "longestStreak": 1,
    "xpGranted": 0
  },
  "message": "Bugün zaten giriş yaptın"
}
```

**Test Cases:**
- [ ] First login: Grants 10 XP, streak = 1
- [ ] Consecutive days: Increments streak
- [ ] Streak broken: Resets to 1
- [ ] Already logged in today: Returns 0 XP
- [ ] 7-day streak: Grants bonus 100 XP
- [ ] 30-day streak: Grants bonus 500 XP

---

#### 2.4 Get XP Transactions

**Request:**
```bash
curl -X GET "http://localhost:3000/api/xp/transactions?limit=10&offset=0" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "xp_amount": 10,
      "transaction_type": "daily_login",
      "description": "Günlük giriş bonusu (1 gün streak)",
      "reference_id": null,
      "reference_type": null,
      "metadata": "{\"streak\":1}",
      "created_at": "2026-01-12T03:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "count": 1
  }
}
```

**Test Cases:**
- [ ] Returns transactions in descending order
- [ ] Pagination works (limit, offset)
- [ ] Empty list for new users

---

#### 2.5 Get XP Leaderboard (Public)

**Request:**
```bash
curl -X GET "http://localhost:3000/api/xp/leaderboard?limit=10"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": "uuid-1",
      "name": "Top User",
      "username": "topuser",
      "xpPoints": 15420,
      "level": "diamond",
      "streakDays": 45
    },
    {
      "rank": 2,
      "userId": "uuid-2",
      "name": "Second User",
      "username": "seconduser",
      "xpPoints": 12850,
      "level": "diamond",
      "streakDays": 30
    }
  ]
}
```

**Test Cases:**
- [ ] Returns top users sorted by XP
- [ ] No auth required (public endpoint)
- [ ] Limit parameter works
- [ ] Shows correct rank numbers

---

### 3️⃣ Credits System Tests

#### 3.1 Get User Credits

**Request:**
```bash
curl -X GET http://localhost:3000/api/credits/me \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "balance": 0,
    "lifetimeEarned": 0,
    "lifetimeSpent": 0
  }
}
```

**Test Cases:**
- [ ] New user: Shows 0 balance
- [ ] User with credits: Shows correct balance
- [ ] Missing auth: Returns 401

---

#### 3.2 Grant Credits (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/api/credits/grant \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "target-user-uuid",
    "amount": 50,
    "transactionType": "admin_grant",
    "description": "Test credit grant"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "oldBalance": 0,
    "newBalance": 50,
    "transactionId": "uuid"
  }
}
```

**Test Cases:**
- [ ] Grant credits: Updates balance
- [ ] Transaction logged correctly
- [ ] Negative amount: Should be prevented
- [ ] Zero amount: Returns error

---

#### 3.3 Process Ad Reward (Fraud Prevention)

**Request:**
```bash
curl -X POST http://localhost:3000/api/credits/ad-reward \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "adNetwork": "admob",
    "adUnitId": "ca-app-pub-test/1234567890",
    "adType": "rewarded_video",
    "deviceId": "test-device-001"
  }'
```

**Expected Response (200) - Success:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "credits": 5,
    "message": "5 kredi kazandın! (1/10)"
  }
}
```

**Expected Response (429) - Daily Limit Reached:**
```json
{
  "success": false,
  "error": "AD_LIMIT_REACHED",
  "message": "Günlük reklam limiti aşıldı (10/10)"
}
```

**Test Cases:**
- [ ] First ad: Grants 5 credits
- [ ] Multiple ads: Counter increments (1/10, 2/10, etc.)
- [ ] 10th ad: Still grants credits
- [ ] 11th ad: Returns 429 error
- [ ] Next day: Counter resets
- [ ] Device/IP logged for fraud detection

---

#### 3.4 Purchase VIP Prediction

**Request:**
```bash
curl -X POST http://localhost:3000/api/credits/purchase-prediction \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "predictionId": "prediction-uuid"
  }'
```

**Expected Response (200) - Success:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "creditsSpent": 10
  },
  "message": "VIP tahmin başarıyla satın alındı"
}
```

**Expected Response (400) - Insufficient Credits:**
```json
{
  "success": false,
  "error": "INSUFFICIENT_CREDITS",
  "message": "Insufficient credits. Required: 10, Available: 5"
}
```

**Expected Response (400) - Already Purchased:**
```json
{
  "success": false,
  "error": "ALREADY_PURCHASED",
  "message": "Bu tahmin zaten satın alındı"
}
```

**Test Cases:**
- [ ] Sufficient balance: Purchase succeeds
- [ ] Insufficient balance: Returns 400
- [ ] Duplicate purchase: Returns 400
- [ ] Balance updated correctly
- [ ] Prediction marked as purchased in database

---

#### 3.5 Get Credit Transactions

**Request:**
```bash
curl -X GET "http://localhost:3000/api/credits/transactions?limit=10&offset=0" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "amount": 5,
      "transaction_type": "ad_reward",
      "description": "Reklam izleme ödülü (1/10)",
      "reference_id": null,
      "reference_type": "ad_view",
      "balance_before": 0,
      "balance_after": 5,
      "metadata": "{\"ad_network\":\"admob\"}",
      "created_at": "2026-01-12T03:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "count": 1
  }
}
```

**Test Cases:**
- [ ] Returns transactions in descending order
- [ ] Shows balance before/after
- [ ] Pagination works
- [ ] Positive amounts for earning, negative for spending

---

#### 3.6 Get Daily Stats

**Request:**
```bash
curl -X GET http://localhost:3000/api/credits/daily-stats \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "earnedToday": 25,
    "spentToday": 10,
    "adsWatchedToday": 5,
    "adsRemainingToday": 5
  }
}
```

**Test Cases:**
- [ ] Shows correct daily earnings
- [ ] Shows correct daily spending
- [ ] Shows correct ad count
- [ ] Resets at midnight

---

## Integration Tests

### Level-Up Reward Flow

**Test Scenario:**
1. Grant 500 XP to user (should trigger Silver level-up)
2. Verify user leveled up to Silver
3. Verify 25 credits were automatically granted
4. Check credit transaction log shows "promotional" type

**Expected:**
- User XP: 500
- User level: silver
- User credits: +25
- Credit transaction exists with description: "SILVER seviyesine ulaştın! 🎉"

---

### Ad Fraud Prevention Flow

**Test Scenario:**
1. Watch 10 ads in succession (should all succeed)
2. Attempt 11th ad (should fail with 429)
3. Wait until next day (or manually reset)
4. Watch ad again (should succeed)

**Expected:**
- First 10 ads: Each grants 5 credits
- 11th ad: Returns 429 error
- Next day: Counter resets, ad succeeds

---

## Postman Collection

Import this JSON into Postman for automated testing:

```json
{
  "info": {
    "name": "GoalGPT Phase 2 API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "access_token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Google Sign In",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/api/auth/google/signin",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"idToken\": \"YOUR_GOOGLE_ID_TOKEN\",\n  \"deviceInfo\": {\n    \"deviceId\": \"test-device-001\",\n    \"platform\": \"ios\",\n    \"appVersion\": \"2.0.0\"\n  }\n}"
            }
          }
        }
      ]
    }
  ]
}
```

---

## Test Results Template

| Test | Endpoint | Status | Response Time | Notes |
|------|----------|--------|---------------|-------|
| Google OAuth | POST /api/auth/google/signin | ✅ Pass | 245ms | User created successfully |
| Apple OAuth | POST /api/auth/apple/signin | ✅ Pass | 198ms | - |
| Phone Auth | POST /api/auth/phone/login | ✅ Pass | 152ms | - |
| Refresh Token | POST /api/auth/refresh | ✅ Pass | 12ms | - |
| Get Profile | GET /api/auth/me | ✅ Pass | 34ms | - |
| Logout | POST /api/auth/logout | ✅ Pass | 28ms | - |
| Get XP | GET /api/xp/me | ✅ Pass | 42ms | - |
| Grant XP | POST /api/xp/grant | ✅ Pass | 89ms | Level-up triggered |
| Login Streak | POST /api/xp/login-streak | ✅ Pass | 76ms | - |
| XP Transactions | GET /api/xp/transactions | ✅ Pass | 38ms | - |
| XP Leaderboard | GET /api/xp/leaderboard | ✅ Pass | 55ms | - |
| Get Credits | GET /api/credits/me | ✅ Pass | 31ms | - |
| Grant Credits | POST /api/credits/grant | ✅ Pass | 72ms | - |
| Ad Reward | POST /api/credits/ad-reward | ✅ Pass | 94ms | Fraud check passed |
| Ad Limit | POST /api/credits/ad-reward (11th) | ✅ Pass | 45ms | Correctly blocked |
| Purchase Prediction | POST /api/credits/purchase-prediction | ✅ Pass | 112ms | - |
| Insufficient Balance | POST /api/credits/purchase-prediction | ✅ Pass | 24ms | Correctly blocked |
| Credit Transactions | GET /api/credits/transactions | ✅ Pass | 41ms | - |
| Daily Stats | GET /api/credits/daily-stats | ✅ Pass | 48ms | - |

---

## Next Steps After Testing

1. ✅ All tests pass → Mark Phase 2 as 100% complete
2. ❌ Tests fail → Fix issues and retest
3. Document any bugs or edge cases found
4. Prepare for Phase 3 implementation

---

**Testing Completed By:** _________________
**Date:** _________________
**Environment:** Staging / Production
**All Tests Pass:** ✅ Yes / ❌ No
