# Phase 2 Setup Guide: Authentication & API Implementation

## 📋 Overview

Phase 2 implements OAuth authentication (Google/Apple), JWT-based sessions, and core gamification APIs (XP/Credits).

**Duration:** 5-7 days
**Status:** 🚀 IN PROGRESS (Started: 2026-01-12)

---

## 🔧 Prerequisites

### 1. Phase 1 Completion
✅ Database migration completed (49,587 users migrated)
✅ 17 new tables created (customer_xp, customer_credits, etc.)
✅ Production environment verified and stable

### 2. Required Services
- [ ] Firebase Project created
- [ ] Google OAuth Client ID configured
- [ ] Apple Sign In configured
- [ ] JWT secret generated

---

## 🔐 Firebase Admin SDK Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing "goalgpt" project)
3. Enable Authentication:
   - Go to **Authentication** → **Sign-in method**
   - Enable **Google** provider
   - Enable **Apple** provider
   - Enable **Phone** provider

### Step 2: Generate Service Account

1. Go to **Project Settings** (⚙️ icon)
2. Navigate to **Service accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. Rename it to `firebase-service-account.json`
6. Place it in the project root directory

**⚠️ SECURITY WARNING:**
- NEVER commit `firebase-service-account.json` to git
- File is already added to `.gitignore`
- Keep this file secure (contains private keys)

### Step 3: Verify Configuration

Run this test to verify Firebase is configured correctly:

```bash
# Test Firebase initialization
npm run test:firebase
```

Expected output:
```
✅ Firebase Admin SDK initialized successfully
✅ Auth service available
✅ Messaging service available
```

---

## 🔑 OAuth Credentials Setup

### Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 Client ID:
   - **Application type:** iOS / Android / Web
   - **Name:** GoalGPT Mobile App
3. Configure OAuth consent screen:
   - **App name:** GoalGPT
   - **User support email:** your-email@goalgpt.com
   - **Developer contact:** your-email@goalgpt.com
   - **Scopes:** email, profile, openid
4. Download the client configuration
5. Add Client ID to `.env`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID_IOS=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB=xxxxx.apps.googleusercontent.com
```

### Apple Sign In Configuration

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Create Service ID:
   - **Identifier:** com.goalgpt.signin
   - **Description:** GoalGPT Sign In
3. Configure Sign In with Apple:
   - Enable capability for your App ID
   - Configure Return URLs: `https://api.goalgpt.com/auth/apple/callback`
4. Add to `.env`:

```bash
# Apple OAuth
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY_PATH=./apple-private-key.p8
APPLE_SERVICE_ID=com.goalgpt.signin
```

---

## 🎫 JWT Configuration

### Generate JWT Secrets

```bash
# Generate secure random secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

Add to `.env`:

```bash
# JWT Configuration
JWT_SECRET=your_generated_secret_here
JWT_REFRESH_SECRET=your_generated_refresh_secret_here
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=30d
```

---

## 📦 Installed Dependencies

Phase 2 dependencies installed (2026-01-12):

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "jsonwebtoken": "^9.0.2",
    "kysely": "^0.27.2"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5"
  }
}
```

---

## 🏗️ Project Structure

Phase 2 adds the following files:

```
project/
├── src/
│   ├── config/
│   │   └── firebase.config.ts           Firebase Admin SDK setup
│   ├── utils/
│   │   └── jwt.utils.ts                 JWT token generation/verification
│   ├── middleware/
│   │   └── auth.middleware.ts           Authentication middleware
│   ├── controllers/
│   │   └── auth/
│   │       ├── googleAuth.controller.ts  Google OAuth handler
│   │       ├── appleAuth.controller.ts   Apple OAuth handler
│   │       └── phoneAuth.controller.ts   Phone auth handler
│   ├── services/
│   │   ├── xp.service.ts                 XP system logic
│   │   └── credits.service.ts            Credits system logic
│   └── routes/
│       ├── auth.routes.ts                Authentication endpoints
│       ├── xp.routes.ts                  XP API endpoints
│       └── credits.routes.ts             Credits API endpoints
├── firebase-service-account.json         Firebase credentials (gitignored)
└── firebase-service-account.template.json Template for credentials
```

---

## 🚀 API Endpoints (Phase 2)

### Authentication Endpoints

```
POST /api/auth/google/signin      Google OAuth sign in
POST /api/auth/apple/signin       Apple Sign In
POST /api/auth/phone/request      Request phone OTP
POST /api/auth/phone/verify       Verify phone OTP
POST /api/auth/refresh            Refresh access token
POST /api/auth/logout             Logout (invalidate tokens)
GET  /api/auth/me                 Get current user info
```

### XP System Endpoints

```
GET  /api/xp/me                   Get my XP & level
POST /api/xp/grant                Grant XP (admin only)
GET  /api/xp/transactions         Get XP transaction history
GET  /api/xp/leaderboard          Get global leaderboard
GET  /api/xp/leaderboard/weekly   Get weekly leaderboard
```

### Credits System Endpoints

```
GET  /api/credits/me              Get my credit balance
POST /api/credits/grant           Grant credits (admin only)
GET  /api/credits/transactions    Get credit transaction history
POST /api/credits/spend           Spend credits (prediction purchase)
```

---

## ✅ Testing Checklist

### Unit Tests
- [ ] Firebase initialization
- [ ] JWT generation and verification
- [ ] Google OAuth flow
- [ ] Apple OAuth flow
- [ ] Phone auth flow
- [ ] XP level calculation
- [ ] Credits transaction logic

### Integration Tests
- [ ] User registration flow (new user)
- [ ] User login flow (existing user)
- [ ] OAuth linking (email match)
- [ ] Token refresh flow
- [ ] Protected endpoint access
- [ ] XP grant and level up
- [ ] Credits grant and spend

### Manual Testing (Postman/Thunder Client)
- [ ] Google Sign In with test account
- [ ] Apple Sign In with test account
- [ ] Phone auth with test number
- [ ] Access protected endpoint with JWT
- [ ] Grant XP to user (admin)
- [ ] Check XP leaderboard
- [ ] Grant credits to user (admin)
- [ ] Purchase VIP prediction with credits

---

## 🔒 Security Considerations

### Authentication Security
✅ Firebase verifies OAuth tokens server-side
✅ JWT tokens expire (1 hour access, 30 days refresh)
✅ Refresh tokens stored securely
✅ HTTPS required for all auth endpoints
✅ Rate limiting on auth endpoints
✅ CORS configured for mobile app only

### Data Privacy
✅ OAuth tokens not stored in database
✅ User emails encrypted at rest
✅ Phone numbers hashed
✅ Service account keys secured
✅ Admin endpoints require admin role

---

## 📊 Success Criteria

Phase 2 is complete when:

✅ All OAuth flows working (Google, Apple, Phone)
✅ JWT authentication middleware functional
✅ XP system APIs operational
✅ Credits system APIs operational
✅ All endpoints tested and documented
✅ Zero security vulnerabilities
✅ Performance: Auth endpoints < 200ms
✅ Error handling comprehensive
✅ Staging environment validated
✅ Production deployment successful

---

## 🆘 Troubleshooting

### Firebase Initialization Failed
**Error:** `Firebase service account file not found`
**Solution:** Create `firebase-service-account.json` from template

**Error:** `Error parsing service account`
**Solution:** Verify JSON format, check for trailing commas

### Google OAuth Failed
**Error:** `Invalid Google ID token`
**Solution:** Verify `GOOGLE_CLIENT_ID` matches Firebase configuration

### JWT Verification Failed
**Error:** `jwt malformed`
**Solution:** Check `JWT_SECRET` is set in `.env`

**Error:** `jwt expired`
**Solution:** Use refresh token to get new access token

### Database Connection Issues
**Error:** `customer_oauth_identities table does not exist`
**Solution:** Ensure Phase 1 migration completed successfully

---

## 📞 Support

**Firebase Issues:** https://firebase.google.com/support
**Google OAuth:** https://console.cloud.google.com/apis
**Apple Sign In:** https://developer.apple.com/support

---

**Last Updated:** 2026-01-12
**Phase Status:** 🚀 IN PROGRESS
**Next Phase:** Phase 3 - Backend API Gamification (Badges, Referrals, Daily Rewards)
