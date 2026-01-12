#!/bin/bash

###############################################################################
# Phase 2 Production Deployment Script - ZERO DOWNTIME
# Deploy Phase 2 backend to production with safety checks
#
# Usage: ./scripts/deploy-phase2-production.sh
# Requirements: SSH access to production, staging tests passed
###############################################################################

set -e

# Configuration
PROD_HOST="${PROD_HOST:-production.goalgpt.com}"
PROD_USER="${PROD_USER:-deploy}"
PROD_PATH="/var/www/goalgpt"
BRANCH="main"
BACKUP_RETENTION_DAYS=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "Phase 2 PRODUCTION Deployment"
echo "=========================================="
echo ""
echo -e "${RED}⚠️  WARNING: PRODUCTION DEPLOYMENT${NC}"
echo ""
echo "Target: $PROD_USER@$PROD_HOST:$PROD_PATH"
echo "Branch: $BRANCH"
echo "Active Users: ~50,000"
echo ""

# Pre-deployment checks
echo "=========================================="
echo "Pre-Deployment Checklist"
echo "=========================================="
echo ""

read -p "Have all staging tests passed? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Staging tests must pass before production deployment.${NC}"
    exit 1
fi

read -p "Have you reviewed the deployment checklist? (docs/PHASE-2-DEPLOYMENT-CHECKLIST.md) (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Please review the deployment checklist first.${NC}"
    exit 1
fi

read -p "Is the team on standby for monitoring? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Recommended to have team on standby during deployment.${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

read -p "Have you taken a database backup? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Database backup is REQUIRED before production deployment.${NC}"
    echo "Run: pg_dump \$DATABASE_URL > backup_pre_phase2_\$(date +%Y%m%d_%H%M%S).sql"
    exit 1
fi

echo ""
echo -e "${YELLOW}Final confirmation required.${NC}"
echo ""
read -p "Type 'DEPLOY PHASE 2' to continue: " CONFIRMATION
echo ""

if [ "$CONFIRMATION" != "DEPLOY PHASE 2" ]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "=========================================="
echo "Starting Production Deployment..."
echo "=========================================="
echo ""

# Step 1: Pre-deployment health check
echo "Step 1: Pre-deployment health check..."
CURRENT_HEALTH=$(ssh $PROD_USER@$PROD_HOST "curl -s http://localhost:3000/api/health | jq -r .status || echo 'UNKNOWN'")
echo "Current status: $CURRENT_HEALTH"

if [ "$CURRENT_HEALTH" != "healthy" ]; then
    echo -e "${RED}❌ Current server is not healthy. Aborting.${NC}"
    exit 1
fi

# Step 2: Create backup branch
echo ""
echo "Step 2: Creating backup branch..."
BACKUP_BRANCH="backup/pre-phase2-$(date +%Y%m%d-%H%M%S)"
ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && git branch $BACKUP_BRANCH"
echo "Backup branch created: $BACKUP_BRANCH"

# Step 3: Pull latest code
echo ""
echo "Step 3: Pulling latest code from $BRANCH..."
ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH"

# Step 4: Install dependencies
echo ""
echo "Step 4: Installing production dependencies..."
ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && npm install --production"

# Step 5: Build TypeScript
echo ""
echo "Step 5: Building TypeScript..."
ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && npm run build"

# Step 6: Verify Firebase service account
echo ""
echo "Step 6: Verifying Firebase service account..."
FIREBASE_CHECK=$(ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && if [ -f firebase-service-account.json ]; then echo 'OK'; else echo 'MISSING'; fi")

if [ "$FIREBASE_CHECK" == "MISSING" ]; then
    echo -e "${RED}❌ firebase-service-account.json is missing!${NC}"
    echo "OAuth authentication will not work."
    read -p "Continue anyway? (NOT RECOMMENDED) (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
else
    echo "✅ Firebase service account found."
fi

# Step 7: Verify JWT secrets
echo ""
echo "Step 7: Verifying JWT configuration..."
JWT_CHECK=$(ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && if grep -q JWT_SECRET .env && grep -q JWT_REFRESH_SECRET .env; then echo 'OK'; else echo 'MISSING'; fi")

if [ "$JWT_CHECK" == "MISSING" ]; then
    echo -e "${RED}❌ JWT_SECRET or JWT_REFRESH_SECRET not configured in .env!${NC}"
    echo "Authentication will not work."
    exit 1
else
    echo "✅ JWT secrets configured."
fi

# Step 8: Zero-downtime reload with PM2
echo ""
echo "Step 8: Reloading server (zero-downtime)..."
echo "Using PM2 reload for zero-downtime deployment..."
ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && pm2 reload goalgpt --update-env"

# Step 9: Wait for server to be ready
echo ""
echo "Step 9: Waiting for server to restart (30 seconds)..."
sleep 30

# Step 10: Post-deployment health check
echo ""
echo "Step 10: Post-deployment health check..."
for i in {1..5}; do
    NEW_HEALTH=$(ssh $PROD_USER@$PROD_HOST "curl -s http://localhost:3000/api/health | jq -r .status || echo 'FAILED'")

    if [ "$NEW_HEALTH" == "healthy" ]; then
        echo -e "${GREEN}✅ Health check PASSED (attempt $i/5)${NC}"
        break
    else
        echo -e "${YELLOW}⚠️  Health check attempt $i/5: $NEW_HEALTH${NC}"
        if [ $i -eq 5 ]; then
            echo -e "${RED}❌ Health check FAILED after 5 attempts!${NC}"
            echo ""
            echo "INITIATING ROLLBACK..."
            ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && git checkout $BACKUP_BRANCH && npm install --production && npm run build && pm2 restart goalgpt"
            echo ""
            echo "Rollback complete. System reverted to previous version."
            exit 1
        fi
        sleep 10
    fi
done

# Step 11: Verify new endpoints
echo ""
echo "Step 11: Verifying Phase 2 endpoints..."

# Check auth endpoint
AUTH_RESPONSE=$(ssh $PROD_USER@$PROD_HOST "curl -s http://localhost:3000/api/auth/me | jq -r .error || echo 'FAILED'")
if [ "$AUTH_RESPONSE" == "UNAUTHORIZED" ]; then
    echo "✅ Auth endpoint responding correctly"
else
    echo -e "${YELLOW}⚠️  Auth endpoint check: $AUTH_RESPONSE${NC}"
fi

# Check XP leaderboard (public endpoint)
XP_RESPONSE=$(ssh $PROD_USER@$PROD_HOST "curl -s http://localhost:3000/api/xp/leaderboard | jq -r .success || echo 'FAILED'")
if [ "$XP_RESPONSE" == "true" ]; then
    echo "✅ XP leaderboard working"
else
    echo -e "${YELLOW}⚠️  XP leaderboard check: $XP_RESPONSE${NC}"
fi

# Step 12: Database connectivity check
echo ""
echo "Step 12: Checking database connectivity..."
DB_CHECK=$(ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && node -e \"const {pool} = require('./dist/database/connection'); pool.query('SELECT COUNT(*) FROM customer_users WHERE deleted_at IS NULL').then(r => console.log(r.rows[0].count)).catch(e => console.log('ERROR')).finally(() => pool.end())\"" 2>/dev/null || echo "ERROR")

if [[ "$DB_CHECK" =~ ^[0-9]+$ ]] && [ "$DB_CHECK" -gt 0 ]; then
    echo "✅ Database connected ($DB_CHECK active users)"
else
    echo -e "${RED}❌ Database connection check failed!${NC}"
    echo "Check database credentials and connectivity."
fi

# Step 13: Monitor initial error logs
echo ""
echo "Step 13: Checking for errors in logs (last 20 lines)..."
ssh $PROD_USER@$PROD_HOST "pm2 logs goalgpt --lines 20 --nostream --err" || echo "No recent errors"

echo ""
echo "=========================================="
echo "✅ Production Deployment Complete!"
echo "=========================================="
echo ""
echo "Deployment Summary:"
echo "  - Branch: $BRANCH"
echo "  - Backup: $BACKUP_BRANCH"
echo "  - Health: $NEW_HEALTH"
echo "  - Active Users: $DB_CHECK"
echo ""
echo "CRITICAL: 24-Hour Monitoring Required"
echo ""
echo "Monitoring Commands:"
echo "  1. Watch logs:     ssh $PROD_USER@$PROD_HOST 'pm2 logs goalgpt'"
echo "  2. Check metrics:  ssh $PROD_USER@$PROD_HOST 'pm2 monit'"
echo "  3. Health:         curl https://api.goalgpt.com/api/health"
echo "  4. Database:       psql \$DATABASE_URL"
echo ""
echo "Rollback Command (if needed):"
echo "  ssh $PROD_USER@$PROD_HOST 'cd $PROD_PATH && git checkout $BACKUP_BRANCH && npm install --production && npm run build && pm2 restart goalgpt'"
echo ""
echo "Next Steps:"
echo "  1. Monitor error logs for next 1 hour"
echo "  2. Test OAuth flows with real users"
echo "  3. Check database for new records (OAuth identities, XP/Credits transactions)"
echo "  4. Monitor authentication success rate"
echo "  5. After 24 hours: Mark Phase 2 as 100% complete"
echo ""
echo "Deployment completed at: $(date)"
echo ""
