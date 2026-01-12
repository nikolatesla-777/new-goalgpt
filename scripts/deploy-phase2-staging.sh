#!/bin/bash

###############################################################################
# Phase 2 Staging Deployment Script
# Auto-deploy Phase 2 backend to staging environment
#
# Usage: ./scripts/deploy-phase2-staging.sh
# Requirements: SSH access to staging server, git, npm
###############################################################################

set -e  # Exit on any error

# Configuration
STAGING_HOST="${STAGING_HOST:-staging.goalgpt.com}"
STAGING_USER="${STAGING_USER:-deploy}"
STAGING_PATH="/var/www/goalgpt"
BRANCH="main"

echo "=========================================="
echo "Phase 2 Staging Deployment"
echo "=========================================="
echo ""
echo "Target: $STAGING_USER@$STAGING_HOST:$STAGING_PATH"
echo "Branch: $BRANCH"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "Step 1: Creating backup branch on staging..."
ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && git branch backup/pre-phase2-\$(date +%Y%m%d-%H%M%S) || true"

echo ""
echo "Step 2: Pulling latest code..."
ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH"

echo ""
echo "Step 3: Installing dependencies..."
ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && npm install"

echo ""
echo "Step 4: Building TypeScript..."
ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && npm run build"

echo ""
echo "Step 5: Checking Firebase service account..."
ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && if [ ! -f firebase-service-account.json ]; then echo 'WARNING: firebase-service-account.json not found!'; else echo 'Firebase service account found.'; fi"

echo ""
echo "Step 6: Checking environment variables..."
ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && if grep -q JWT_SECRET .env; then echo 'JWT_SECRET configured.'; else echo 'WARNING: JWT_SECRET not found in .env!'; fi"

echo ""
echo "Step 7: Restarting server (PM2)..."
ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && pm2 restart goalgpt"

echo ""
echo "Step 8: Waiting for server to start (15 seconds)..."
sleep 15

echo ""
echo "Step 9: Health check..."
HEALTH_CHECK=$(ssh $STAGING_USER@$STAGING_HOST "curl -s http://localhost:3000/api/health | jq -r .status || echo 'FAILED'")

if [ "$HEALTH_CHECK" == "healthy" ]; then
    echo "✅ Health check PASSED"
else
    echo "❌ Health check FAILED"
    echo "Rolling back..."
    ssh $STAGING_USER@$STAGING_HOST "cd $STAGING_PATH && git checkout backup/pre-phase2-* && pm2 restart goalgpt"
    exit 1
fi

echo ""
echo "Step 10: Checking new API endpoints..."
AUTH_CHECK=$(ssh $STAGING_USER@$STAGING_HOST "curl -s http://localhost:3000/api/auth/me | jq -r .error || echo 'FAILED'")

if [ "$AUTH_CHECK" == "UNAUTHORIZED" ]; then
    echo "✅ Auth endpoint responding correctly (401 without token)"
else
    echo "⚠️  Auth endpoint check inconclusive"
fi

echo ""
echo "=========================================="
echo "✅ Staging Deployment Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Run API tests: See docs/PHASE-2-API-TESTS.md"
echo "2. Monitor logs: ssh $STAGING_USER@$STAGING_HOST 'pm2 logs goalgpt'"
echo "3. Check database: psql \$DATABASE_URL"
echo ""
echo "Staging URL: https://staging.goalgpt.com"
echo ""
