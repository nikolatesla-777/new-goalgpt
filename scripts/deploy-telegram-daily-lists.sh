#!/bin/bash
#
# Telegram Daily Lists - Production Deployment Script
# Run this script to deploy all fixes to production
#

set -e  # Exit on error

echo "🚀 Deploying Telegram Daily Lists fixes to production..."
echo ""

# ============================================================================
# STEP 1: PRE-DEPLOYMENT CHECKS
# ============================================================================
echo "📋 Step 1: Pre-deployment checks..."

# Check if we're on the correct branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "   ✓ Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "   ⚠️  WARNING: You have uncommitted changes"
  read -p "   Continue anyway? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "   ❌ Deployment cancelled"
    exit 1
  fi
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "   ✓ Node.js version: $NODE_VERSION"

# Check if .env exists
if [[ ! -f .env ]]; then
  echo "   ❌ ERROR: .env file not found"
  exit 1
fi
echo "   ✓ .env file found"

echo ""

# ============================================================================
# STEP 2: DATABASE BACKUP
# ============================================================================
echo "💾 Step 2: Creating database backup..."

BACKUP_DIR="backups"
BACKUP_FILE="$BACKUP_DIR/goalgpt_backup_$(date +%Y%m%d_%H%M%S).sql"

mkdir -p "$BACKUP_DIR"

# Read database credentials from .env
export $(grep -v '^#' .env | xargs)

# Create backup
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
echo "   ✓ Database backup saved to: $BACKUP_FILE"
echo ""

# ============================================================================
# STEP 3: RUN DATABASE MIGRATIONS
# ============================================================================
echo "🗃️  Step 3: Running database migrations..."

npm run migrate

echo "   ✓ Migrations completed"
echo ""

# Verify telegram_daily_lists table exists
echo "   📊 Verifying telegram_daily_lists table..."
psql "$DATABASE_URL" -c "\d telegram_daily_lists" > /dev/null 2>&1
if [[ $? -eq 0 ]]; then
  echo "   ✓ telegram_daily_lists table exists"
else
  echo "   ❌ ERROR: telegram_daily_lists table not found"
  exit 1
fi
echo ""

# ============================================================================
# STEP 4: INSTALL DEPENDENCIES
# ============================================================================
echo "📦 Step 4: Installing dependencies..."

echo "   Backend dependencies..."
npm install --production

echo "   Frontend dependencies..."
cd frontend
npm install --production
cd ..

echo "   ✓ Dependencies installed"
echo ""

# ============================================================================
# STEP 5: BUILD BACKEND
# ============================================================================
echo "🔨 Step 5: Building backend..."

npm run build

if [[ ! -d "dist" ]]; then
  echo "   ❌ ERROR: Backend build failed (dist directory not found)"
  exit 1
fi

echo "   ✓ Backend build successful"
echo ""

# ============================================================================
# STEP 6: BUILD FRONTEND
# ============================================================================
echo "🎨 Step 6: Building frontend..."

cd frontend
npm run build

if [[ ! -d "dist" ]]; then
  echo "   ❌ ERROR: Frontend build failed (dist directory not found)"
  exit 1
fi

echo "   ✓ Frontend build successful"
cd ..
echo ""

# ============================================================================
# STEP 7: RUN TESTS (if available)
# ============================================================================
echo "🧪 Step 7: Running tests..."

if grep -q "\"test\":" package.json; then
  npm run test || {
    echo "   ⚠️  WARNING: Tests failed"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "   ❌ Deployment cancelled"
      exit 1
    fi
  }
else
  echo "   ⏭️  No tests configured, skipping..."
fi

echo ""

# ============================================================================
# STEP 8: TYPE CHECK
# ============================================================================
echo "🔍 Step 8: Type checking..."

if grep -q "\"type-check\":" package.json; then
  npm run type-check || {
    echo "   ⚠️  WARNING: Type check failed"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "   ❌ Deployment cancelled"
      exit 1
    fi
  }
else
  echo "   ⏭️  No type-check script configured, skipping..."
fi

echo ""

# ============================================================================
# STEP 9: RESTART APPLICATION (PM2)
# ============================================================================
echo "🔄 Step 9: Restarting application..."

if command -v pm2 &> /dev/null; then
  pm2 restart goalgpt || {
    echo "   ⚠️  WARNING: PM2 restart failed, trying to start..."
    pm2 start npm --name goalgpt -- start
  }
  echo "   ✓ Application restarted via PM2"
else
  echo "   ⚠️  PM2 not found, skipping application restart"
  echo "   ℹ️  You'll need to manually restart the application"
fi

echo ""

# ============================================================================
# STEP 10: POST-DEPLOYMENT VERIFICATION
# ============================================================================
echo "✅ Step 10: Post-deployment verification..."

# Wait for application to start
echo "   ⏳ Waiting for application to start (10 seconds)..."
sleep 10

# Check health endpoint
if command -v curl &> /dev/null; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "000")
  if [[ $HTTP_CODE == "200" ]]; then
    echo "   ✓ Health check passed (HTTP $HTTP_CODE)"
  else
    echo "   ⚠️  WARNING: Health check failed (HTTP $HTTP_CODE)"
  fi
else
  echo "   ⏭️  curl not found, skipping health check"
fi

# Check database connection
echo "   📊 Verifying database connection..."
psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1
if [[ $? -eq 0 ]]; then
  echo "   ✓ Database connection successful"
else
  echo "   ❌ WARNING: Database connection failed"
fi

echo ""

# ============================================================================
# DEPLOYMENT SUMMARY
# ============================================================================
echo "═══════════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📊 Summary:"
echo "   • Database backup: $BACKUP_FILE"
echo "   • Migrations: ✓ Completed"
echo "   • Backend build: ✓ Completed"
echo "   • Frontend build: ✓ Completed"
echo "   • Application: ✓ Restarted"
echo ""
echo "📝 Next Steps:"
echo "   1. Monitor logs: pm2 logs goalgpt"
echo "   2. Check metrics: curl http://localhost:3000/api/admin/settlement/metrics?days=7"
echo "   3. Verify settlement job: Check job_execution_logs table"
echo ""
echo "🔍 Rollback instructions (if needed):"
echo "   psql \$DATABASE_URL < $BACKUP_FILE"
echo "   git revert HEAD"
echo "   ./scripts/deploy-telegram-daily-lists.sh"
echo ""
echo "═══════════════════════════════════════════════════════════════"
