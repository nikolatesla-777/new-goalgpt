#!/bin/bash

# ====================
# MIGRATION RUNNER SCRIPT
# ====================
# Runs Phase 1 database migrations
# Usage: ./scripts/run-migration.sh [staging|production]
#

set -e

ENVIRONMENT=${1:-staging}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 GoalGPT Migration Runner"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo "Timestamp: $TIMESTAMP"
echo ""

# Safety check for production
if [ "$ENVIRONMENT" == "production" ]; then
    read -p "⚠️  You are running on PRODUCTION. Continue? (type 'YES' to confirm): " confirm
    if [ "$confirm" != "YES" ]; then
        echo "Migration cancelled."
        exit 0
    fi

    # Check if backup exists
    if [ ! -f "./backups/latest_production.dump" ]; then
        echo "❌ Error: No production backup found!"
        echo "   Please run: ./scripts/backup-database.sh production"
        exit 1
    fi

    echo "✅ Production backup verified"
fi

# Load environment
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "❌ Error: .env file not found!"
    exit 1
fi

echo "📋 Migration Plan:"
echo "  1. Schema migration (001-mobile-app-schema.ts)"
echo "  2. Data migration (002-mobile-app-data.ts)"
echo "  3. Verification (verify-migration.ts)"
echo ""

read -p "▶️  Start migration? (yes/no): " start
if [ "$start" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "🔄 Starting migration..."
echo "================================"

# Run migrations using the existing migrate.ts system
echo ""
echo "📦 Step 1: Running schema migration..."
npx ts-node src/database/migrations/001-mobile-app-schema.ts

if [ $? -ne 0 ]; then
    echo "❌ Schema migration failed!"
    exit 1
fi

echo ""
echo "📦 Step 2: Running data migration..."
npx ts-node src/database/migrations/002-mobile-app-data.ts

if [ $? -ne 0 ]; then
    echo "❌ Data migration failed!"
    echo "⚠️  Consider rollback: npm run migrate:down"
    exit 1
fi

echo ""
echo "📦 Step 3: Verifying migration..."
npx ts-node scripts/verify-migration.ts

if [ $? -ne 0 ]; then
    echo "❌ Migration verification failed!"
    echo "⚠️  Review errors above and consider rollback"
    exit 1
fi

echo ""
echo "================================"
echo "✅ Migration completed successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Test authentication endpoints"
echo "  2. Test XP/credit functionality"
echo "  3. Begin Phase 2 (Backend API development)"
echo ""

# Log migration
echo "$TIMESTAMP - Migration completed on $ENVIRONMENT" >> migrations.log
