# Phase 0: Third-Party Accounts Setup Checklist

> **Purpose:** Complete checklist for setting up all required third-party services
> **Owner:** Project Manager / Tech Lead
> **Duration:** 2-3 days
> **Status:** 🔲 Not Started

---

## 1. RevenueCat (Subscription Management)

**URL:** https://app.revenuecat.com

### Setup Steps:
- [ ] Create account with company email
- [ ] Create project: "GoalGPT Mobile"
- [ ] Add iOS app:
  - Bundle ID: `com.goalgpt.mobile`
  - Connect to App Store Connect
- [ ] Add Android app:
  - Package name: `com.goalgpt.mobile`
  - Connect to Google Play Console
- [ ] Configure products:
  ```
  goalgpt_monthly_vip      → ₺99.99/month
  goalgpt_yearly_vip       → ₺599.99/year (50% discount)
  goalgpt_first_time_offer → ₺49.99/month (first month promo)
  ```
- [ ] Create entitlements:
  - `vip_access` → links to all products above
- [ ] Get API keys:
  - [ ] iOS SDK Key: `rcb_...`
  - [ ] Android SDK Key: `rcb_...`
  - [ ] REST API Key: `sk_...`
  - [ ] Webhook Secret: `rcwsk_...`
- [ ] Configure webhook URL: `https://api.goalgpt.com/webhooks/revenuecat`

**Save to:**
```bash
REVENUE_CAT_IOS_KEY=rcb_XXXXX
REVENUE_CAT_ANDROID_KEY=rcb_XXXXX
REVENUECAT_API_KEY=sk_XXXXX
REVENUECAT_WEBHOOK_SECRET=rcwsk_XXXXX
```

---

## 2. Firebase (Auth + Push Notifications)

**URL:** https://console.firebase.google.com

### Setup Steps:
- [ ] Create/use existing project: `goalgpt-mobile`
- [ ] Add iOS app:
  - Bundle ID: `com.goalgpt.mobile`
  - Download `GoogleService-Info.plist`
- [ ] Add Android app:
  - Package name: `com.goalgpt.mobile`
  - SHA-1 fingerprint (from `keytool`)
  - Download `google-services.json`
- [ ] Enable Authentication:
  - [ ] Email/Password
  - [ ] Phone (enable SMS provider)
  - [ ] Google Sign-In (auto-configured)
  - [ ] Apple Sign-In
- [ ] Enable Cloud Messaging (FCM):
  - [ ] Upload APNs certificate (iOS)
  - [ ] Get Server Key for backend
- [ ] Create service account:
  - IAM & Admin → Service Accounts
  - Create key (JSON format)
  - Download `firebase-admin-sdk.json`

**Save to:**
```bash
FIREBASE_PROJECT_ID=goalgpt-mobile
FIREBASE_IOS_API_KEY=AIzaXXXXXX
FIREBASE_ANDROID_API_KEY=AIzaXXXXXX
FIREBASE_MESSAGING_SENDER_ID=000000000000
FIREBASE_SERVER_KEY=AAAA...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@goalgpt-mobile.iam.gserviceaccount.com
```

---

## 3. Google OAuth (Sign-In)

**URL:** https://console.cloud.google.com

### Setup Steps:
- [ ] Go to: APIs & Services → Credentials
- [ ] Create OAuth 2.0 Client IDs:

  **iOS Client:**
  - [ ] Application type: iOS
  - [ ] Bundle ID: `com.goalgpt.mobile`
  - Copy Client ID

  **Android Client:**
  - [ ] Application type: Android
  - [ ] Package name: `com.goalgpt.mobile`
  - [ ] SHA-1 fingerprint: `keytool -list -v -keystore release.keystore`
  - Copy Client ID

  **Web Client (for backend):**
  - [ ] Application type: Web application
  - [ ] Authorized redirect URIs: `https://api.goalgpt.com/auth/google/callback`
  - Copy Client ID + Client Secret

- [ ] Configure OAuth consent screen:
  - [ ] App name: "GoalGPT"
  - [ ] User support email
  - [ ] Developer contact email
  - [ ] Add scopes: `email`, `profile`

**Save to:**
```bash
GOOGLE_IOS_CLIENT_ID=XXX.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=XXX.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=XXX.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-XXXXXXXXXXXXXXXXXXXX
```

---

## 4. Apple Sign In

**URL:** https://developer.apple.com

### Setup Steps:
- [ ] Go to: Certificates, IDs & Profiles
- [ ] Register App ID:
  - [ ] Bundle ID: `com.goalgpt.mobile`
  - [ ] Enable capability: "Sign In with Apple"
- [ ] Create Service ID:
  - [ ] Identifier: `com.goalgpt.signin`
  - [ ] Configure: Sign In with Apple
  - [ ] Return URLs: `https://api.goalgpt.com/auth/apple/callback`
- [ ] Create Key:
  - [ ] Key name: "GoalGPT Apple Sign In Key"
  - [ ] Enable: Sign In with Apple
  - [ ] Download `.p8` file (save securely!)
  - Note: Key ID, Team ID

**Save to:**
```bash
APPLE_SERVICE_ID=com.goalgpt.signin
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_BUNDLE_ID=com.goalgpt.mobile
# Convert .p8 file to single-line with \n:
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nXXXXX\n-----END PRIVATE KEY-----
```

---

## 5. AdMob (Rewarded Ads)

**URL:** https://admob.google.com

### Setup Steps:
- [ ] Create account
- [ ] Add iOS app:
  - [ ] App name: "GoalGPT"
  - [ ] Platform: iOS
  - [ ] App Store URL: (when available)
  - Copy App ID
- [ ] Add Android app:
  - [ ] App name: "GoalGPT"
  - [ ] Platform: Android
  - [ ] Google Play URL: (when available)
  - Copy App ID
- [ ] Create Ad Units (both platforms):
  - [ ] Ad format: Rewarded
  - [ ] Ad unit name: "Credit Reward Video"
  - Copy Ad Unit IDs

**Save to:**
```bash
ADMOB_APP_ID_IOS=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
ADMOB_APP_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
ADMOB_IOS_REWARDED_AD_UNIT=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
ADMOB_ANDROID_REWARDED_AD_UNIT=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
ADMOB_PUBLISHER_ID=pub-XXXXXXXXXXXXXXXX
```

---

## 6. Branch.io (Deep Linking)

**URL:** https://branch.io

### Setup Steps:
- [ ] Create account
- [ ] Create app: "GoalGPT"
- [ ] Configure iOS:
  - [ ] Bundle ID: `com.goalgpt.mobile`
  - [ ] Team ID: (from Apple Developer)
  - [ ] App Store URL: (when available)
  - [ ] Configure Universal Links
- [ ] Configure Android:
  - [ ] Package name: `com.goalgpt.mobile`
  - [ ] SHA256 fingerprint
  - [ ] Google Play URL: (when available)
  - [ ] Configure App Links
- [ ] Configure link domain:
  - [ ] Custom domain: `go.goalgpt.com` (requires DNS setup)
  - [ ] Or use: `goalgpt.app.link`
- [ ] Get Branch Key (Settings → Account)

**Save to:**
```bash
BRANCH_KEY=key_live_XXXXXXXXXXXXXXXXXXXXXXXX
BRANCH_DOMAIN=goalgpt.app.link
```

---

## 7. Sentry (Error Tracking)

**URL:** https://sentry.io

### Setup Steps:
- [ ] Create organization: "GoalGPT"
- [ ] Create project:
  - [ ] Platform: React Native
  - [ ] Project name: "goalgpt-mobile"
- [ ] Get DSN (Data Source Name)
- [ ] Configure alerts:
  - [ ] Email notifications
  - [ ] Slack integration (optional)
- [ ] Set up backend project (separate):
  - [ ] Platform: Node.js
  - [ ] Project name: "goalgpt-backend"
  - [ ] Get backend DSN

**Save to:**
```bash
# Mobile
SENTRY_DSN=https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@sentry.io/XXXXXXX
SENTRY_ENVIRONMENT=production

# Backend (separate)
SENTRY_BACKEND_DSN=https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@sentry.io/YYYYYYY
```

---

## 8. App Store Connect (iOS)

**URL:** https://appstoreconnect.apple.com

### Setup Steps:
- [ ] Create app listing:
  - [ ] App name: "GoalGPT"
  - [ ] Bundle ID: `com.goalgpt.mobile`
  - [ ] SKU: `com.goalgpt.mobile`
- [ ] Configure in-app purchases:
  - [ ] Monthly subscription
  - [ ] Yearly subscription
  - [ ] Promotional offer
- [ ] Submit app information:
  - [ ] Category: Sports
  - [ ] Age rating: 4+
  - [ ] Privacy policy URL
  - [ ] Support URL
- [ ] Upload APNs certificate for Push Notifications

---

## 9. Google Play Console (Android)

**URL:** https://play.google.com/console

### Setup Steps:
- [ ] Create app:
  - [ ] App name: "GoalGPT"
  - [ ] Default language: Turkish
  - [ ] App type: App
  - [ ] Free/Paid: Free (with in-app purchases)
- [ ] Configure in-app products:
  - [ ] Monthly subscription
  - [ ] Yearly subscription
- [ ] Submit app information:
  - [ ] Category: Sports
  - [ ] Content rating: Everyone
  - [ ] Privacy policy URL
  - [ ] Support email

---

## 10. PostgreSQL Client Tools (Local Dev)

### macOS Installation:
```bash
# Install PostgreSQL client tools via Homebrew
brew install postgresql@15

# Or install full PostgreSQL
brew install postgresql
```

### Verification:
```bash
psql --version
pg_dump --version
pg_restore --version
```

---

## Phase 0 Completion Checklist

### Files Created:
- [ ] `/mobile-app/goalgpt-mobile/.env` (from .env.example)
- [ ] `/project/.env` (updated with mobile keys)
- [ ] `/project/firebase-admin-sdk.json` (service account key)
- [ ] `/mobile-app/goalgpt-mobile/ios/GoogleService-Info.plist`
- [ ] `/mobile-app/goalgpt-mobile/android/app/google-services.json`
- [ ] Apple Sign In `.p8` file (stored securely)

### Security:
- [ ] All API keys stored in 1Password/LastPass
- [ ] `.env` files added to `.gitignore`
- [ ] Service account JSON added to `.gitignore`
- [ ] Team members have access to credentials vault

### Verification:
- [ ] Run: `./scripts/check-dev-environment.sh`
- [ ] All required tools installed
- [ ] Database connection tested
- [ ] Firebase admin SDK initialized
- [ ] RevenueCat SDK keys tested

---

**✅ Phase 0 Complete When:**
- All accounts created
- All API keys collected and stored
- Development environment verified
- Team has access to credentials
- Ready to begin Phase 1 (Database Migration)

**Next Step:** Phase 1 - Database Migration
