# GoalGPT Mobile App - Quick Start Guide

> **For:** New team members and developers starting Phase 0
> **Time:** ~2 hours setup
> **Last Updated:** 2026-01-12

---

## Prerequisites

- macOS or Linux (Windows via WSL)
- Admin access to your machine
- GitHub account
- Basic terminal knowledge

---

## Step 1: Environment Check (5 minutes)

Run the environment verification script:

```bash
cd /Users/utkubozbay/Downloads/GoalGPT/project
./scripts/check-dev-environment.sh
```

**Expected Output:**
- ✅ Node.js v18+
- ✅ npm
- ✅ git

**If Missing Tools:**

### Install PostgreSQL Client (macOS)
```bash
brew install postgresql
```

### Install Expo CLI
```bash
npm install -g expo-cli eas-cli
```

### Verify Again
```bash
./scripts/check-dev-environment.sh
```

---

## Step 2: Clone Repositories (5 minutes)

```bash
# Backend (if not already cloned)
cd ~/Projects
git clone <backend-repo-url> goalgpt-backend
cd goalgpt-backend
git checkout -b feature/mobile-app

# Mobile App
cd ~/Projects
git clone <mobile-repo-url> goalgpt-mobile
cd goalgpt-mobile
```

---

## Step 3: Backend Setup (10 minutes)

### Install Dependencies
```bash
cd ~/Projects/goalgpt-backend
npm install
```

### Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit with real credentials
nano .env
```

**Required variables:**
```bash
DB_HOST=your-supabase-host
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.xxxxx
DB_PASSWORD=your-password
DATABASE_URL=postgres://...

THESPORTS_API_SECRET=your-secret
THESPORTS_API_USER=goalgpt
```

### Test Connection
```bash
npm run build
npm start
```

**Expected:** Server running on `http://localhost:3000`

**Test:** Open `http://localhost:3000/health`

---

## Step 4: Mobile App Setup (10 minutes)

### Install Dependencies
```bash
cd ~/Projects/goalgpt-mobile
npm install
```

### Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit with backend URL
nano .env
```

**For local development:**
```bash
API_URL=http://localhost:3000
WS_URL=ws://localhost:3000/ws
```

### Start Development Server
```bash
npm start
# or
expo start
```

### Run on Simulator
```bash
# iOS (macOS only)
npm run ios

# Android
npm run android
```

---

## Step 5: Database Backup (5 minutes)

**⚠️ CRITICAL:** Always backup before any migrations!

```bash
cd ~/Projects/goalgpt-backend
./scripts/backup-database.sh production
```

**Verify:**
```bash
ls -lh backups/
```

You should see: `backup_production_YYYYMMDD_HHMMSS.dump`

---

## Step 6: Access Documentation (5 minutes)

### Master Plan
```bash
open MASTER-APP-GOALGPT-PLAN.md
```

### Phase 0 Setup Guide
```bash
open docs/PHASE-0-THIRD-PARTY-SETUP.md
```

### Team Setup
```bash
open docs/TEAM-SETUP.md
```

---

## Step 7: Join Communication Channels (10 minutes)

1. **Slack/Discord:** Ask PM for invite
2. **GitHub:** Request repository access
3. **1Password:** Request vault access (staging)
4. **Calendar:** Add standup/sprint meetings

---

## Step 8: Complete Phase 0 Tasks (Manual)

Now follow the detailed guide:

```bash
open docs/PHASE-0-THIRD-PARTY-SETUP.md
```

**Tasks:**
1. Create RevenueCat account
2. Setup Firebase project
3. Configure Google OAuth
4. Configure Apple Sign In
5. Setup AdMob
6. Setup Branch.io
7. Setup Sentry

**Save all API keys to 1Password**

---

## Common Issues & Solutions

### Port 3000 already in use
```bash
lsof -ti:3000 | xargs kill -9
```

### npm install fails
```bash
rm -rf node_modules package-lock.json
npm install
```

### Database connection fails
- Check VPN connection
- Verify database credentials in `.env`
- Check firewall rules

### Expo won't start
```bash
npm install -g expo-cli@latest
expo doctor
```

---

## Verification Checklist

After setup, verify:

- [ ] Backend runs locally (`http://localhost:3000/health` returns 200)
- [ ] Mobile app runs on simulator/emulator
- [ ] Database backup created successfully
- [ ] Can connect to staging database
- [ ] Access to all documentation
- [ ] Added to communication channels
- [ ] Attended first standup

---

## Next Steps

### Backend Developer
→ Start Phase 1: Database Migration
```bash
open MASTER-APP-GOALGPT-PLAN.md
# Jump to: ## 📋 FAZ 1: DATABASE MIGRATION
```

### Mobile Developer
→ Wait for Phase 1-4 completion, then start Phase 5
```bash
# Review mobile app architecture
open MASTER-APP-GOALGPT-PLAN.md
# Jump to: ## 📱 MOBİL UYGULAMA MİMARİSİ
```

### QA Engineer
→ Familiarize with testing plan
```bash
# Review Phase 12
open MASTER-APP-GOALGPT-PLAN.md
# Jump to: ## 📋 FAZ 12: TEST & QUALITY ASSURANCE
```

---

## Getting Help

### Questions?
- Ask in `#mobile-app-general` (Slack/Discord)
- DM your onboarding buddy
- Schedule 1-on-1 with PM

### Found a bug in setup?
- Create issue on GitHub
- Tag with `setup` label
- Assign to DevOps

---

## Useful Commands

### Backend
```bash
npm run dev          # Development server
npm run build        # TypeScript compile
npm run test         # Run tests
npm run lint         # Lint code
```

### Mobile
```bash
npm start            # Expo dev server
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run test         # Jest tests
```

### Database
```bash
# Backup
./scripts/backup-database.sh production

# Restore
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c backups/latest_production.dump

# Check tables
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"
```

---

**Welcome to the team! 🎉**

**Questions?** Ask in Slack `#mobile-app-general`

**Ready?** Attend the next daily standup (weekdays 10:00 AM)
