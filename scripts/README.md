# GoalGPT Scripts

Automation scripts for database management, environment setup, and deployment.

---

## Phase 0 Scripts

### 1. `check-dev-environment.sh`

**Purpose:** Verify all required development tools are installed.

**Usage:**
```bash
./scripts/check-dev-environment.sh
```

**Checks:**
- Node.js (>= 18)
- npm/yarn
- Git
- PostgreSQL client tools (`psql`, `pg_dump`, `pg_restore`)
- Expo CLI (optional)
- Xcode (macOS only)
- Android Studio
- Docker (optional)

**Output:**
- ✅ Installed tools
- ❌ Missing required tools
- ⚠️ Missing optional tools

---

### 2. `backup-database.sh`

**Purpose:** Create a complete backup of the PostgreSQL database.

**Usage:**
```bash
# Production backup
./scripts/backup-database.sh production

# Staging backup
./scripts/backup-database.sh staging
```

**Features:**
- Creates compressed binary dump (`.dump` format)
- Verifies backup integrity
- Shows table count
- Creates symlink to latest backup
- Auto-cleanup (keeps last 7 days)

**Output Location:**
```
./backups/
├── backup_production_20260112_143022.dump
├── backup_staging_20260112_143045.dump
└── latest_production.dump → backup_production_20260112_143022.dump
```

**Restore:**
```bash
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c ./backups/latest_production.dump
```

---

### 3. `setup-staging-data.sql`

**Purpose:** Anonymize production data for staging environment.

**⚠️ CRITICAL:** Only run on staging database!

**Usage:**
```bash
# After restoring production backup to staging
psql -h $STAGING_DB_HOST -U $DB_USER -d $DB_NAME -f ./scripts/setup-staging-data.sql
```

**Actions:**
- Anonymizes emails: `test_user_123@goalgpt-staging.com`
- Randomizes phone numbers
- Resets passwords to test hash
- Removes OAuth tokens
- Clears payment data
- Deletes push notification tokens
- Keeps only 1000 most recent users
- Resets credit balances

**Safety:**
- Wrapped in transaction (can rollback)
- Adds `is_staging` flag to users
- Cannot accidentally run on production (manual safety check recommended)

---

## Environment Setup

### Required Environment Variables

Create `.env` file in project root:

```bash
# Copy from template
cp .env.example .env

# Edit with your values
nano .env
```

**Required for scripts:**
```bash
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password
```

---

## Common Workflows

### Setting Up Staging Environment

**Step 1: Backup Production**
```bash
./scripts/backup-database.sh production
```

**Step 2: Restore to Staging**
```bash
pg_restore \
  -h $STAGING_DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -c \
  ./backups/latest_production.dump
```

**Step 3: Anonymize Data**
```bash
psql \
  -h $STAGING_DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -f ./scripts/setup-staging-data.sql
```

**Step 4: Verify**
```bash
psql -h $STAGING_DB_HOST -U $DB_USER -d $DB_NAME -c \
  "SELECT COUNT(*) FROM customer_users WHERE is_staging = true;"
```

---

### Pre-Migration Checklist

Before running database migrations:

1. **Backup Production:**
   ```bash
   ./scripts/backup-database.sh production
   ```

2. **Verify Backup:**
   ```bash
   pg_restore --list ./backups/latest_production.dump | head -20
   ```

3. **Test on Staging First:**
   - Restore backup to staging
   - Run migration on staging
   - Verify data integrity
   - Test application functionality

4. **Schedule Production Migration:**
   - Low-traffic time (early morning)
   - Notify users
   - Have rollback plan ready

---

## Troubleshooting

### psql: command not found

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

### Permission denied

```bash
chmod +x ./scripts/*.sh
```

### Connection timeout

Check firewall rules, database host, and credentials in `.env`.

### Backup verification failed

Backup file may be corrupted. Try creating a new backup.

---

## Phase 1 Scripts (Migration)

### 4. `run-migration.sh`

**Purpose:** Automated runner for Phase 1 database migrations.

**Usage:**
```bash
# Staging migration
./scripts/run-migration.sh staging

# Production migration
./scripts/run-migration.sh production
```

**Features:**
- Safety confirmations for production
- Backup verification
- Runs schema migration (001)
- Runs data migration (002)
- Runs verification checks
- Logs migration timestamp

**Included Migrations:**
- `001-mobile-app-schema.ts` - Creates 17 tables, alters 3 tables
- `002-mobile-app-data.ts` - Initializes XP/Credits, grants VIP bonuses, creates badges

### 5. `verify-migration.ts`

**Purpose:** Comprehensive data integrity verification after migration.

**Usage:**
```bash
npx ts-node scripts/verify-migration.ts
```

**Checks Performed:**
1. All users have XP records
2. All users have Credit records
3. VIP users received welcome bonus (50 credits)
4. Badges created (minimum 5)
5. Referral codes generated
6. No orphaned records (foreign key integrity)
7. All 17 new tables exist
8. All 7 altered columns exist
9. Check constraints enforced

**Exit Codes:**
- `0` - All checks passed
- `1` - Critical errors found

---

## Future Scripts

### Phase 13: Deployment
- `deploy-backend.sh` - Backend deployment
- `deploy-mobile.sh` - Mobile app build & upload
- `health-check.sh` - Post-deployment verification

---

## Safety Guidelines

1. **Always backup before migrations**
2. **Test on staging first**
3. **Verify backups regularly**
4. **Never run staging scripts on production**
5. **Keep backups for at least 30 days**
6. **Document all manual operations**

---

**Last Updated:** 2026-01-12
**Maintained By:** DevOps Team
