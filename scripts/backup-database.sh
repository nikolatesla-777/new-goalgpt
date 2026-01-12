#!/bin/bash

# ====================
# GOALGPT DATABASE BACKUP SCRIPT
# ====================
# Usage: ./scripts/backup-database.sh [production|staging]
#
# CRITICAL: Run this before any migration!
#

set -e

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="backup_${ENVIRONMENT}_${TIMESTAMP}.dump"

echo "🗄️  GoalGPT Database Backup"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "❌ Error: .env file not found!"
    exit 1
fi

# Validate required variables
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "❌ Error: Missing database configuration in .env"
    exit 1
fi

echo "📊 Database Info:"
echo "  Host: $DB_HOST"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# Prompt for confirmation if production
if [ "$ENVIRONMENT" == "production" ]; then
    read -p "⚠️  You are backing up PRODUCTION. Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Backup cancelled."
        exit 0
    fi
fi

echo "🚀 Starting backup..."
echo ""

# Run pg_dump
pg_dump \
    -h "$DB_HOST" \
    -p "${DB_PORT:-5432}" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    -b \
    -v \
    -f "${BACKUP_DIR}/${BACKUP_FILE}" 2>&1 | while read line; do
        echo "  $line"
    done

# Check if backup was successful
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)

    echo ""
    echo "✅ Backup completed successfully!"
    echo "================================"
    echo "File: ${BACKUP_DIR}/${BACKUP_FILE}"
    echo "Size: $BACKUP_SIZE"
    echo ""

    # Verify backup
    echo "🔍 Verifying backup integrity..."
    pg_restore --list "${BACKUP_DIR}/${BACKUP_FILE}" > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "✅ Backup verification passed!"

        # Show table count
        TABLE_COUNT=$(pg_restore --list "${BACKUP_DIR}/${BACKUP_FILE}" | grep "TABLE DATA" | wc -l)
        echo "📋 Tables backed up: $TABLE_COUNT"

        # Create symlink to latest
        ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/latest_${ENVIRONMENT}.dump"
        echo "🔗 Symlink created: ${BACKUP_DIR}/latest_${ENVIRONMENT}.dump"

    else
        echo "❌ Backup verification failed!"
        exit 1
    fi

    echo ""
    echo "📝 To restore this backup, run:"
    echo "   pg_restore -h \$DB_HOST -U \$DB_USER -d \$DB_NAME -c ${BACKUP_DIR}/${BACKUP_FILE}"
    echo ""

    # Cleanup old backups (keep last 7 days)
    echo "🧹 Cleaning up old backups (keeping last 7 days)..."
    find "${BACKUP_DIR}" -name "backup_${ENVIRONMENT}_*.dump" -type f -mtime +7 -delete
    echo "✅ Cleanup complete!"

else
    echo "❌ Backup failed!"
    exit 1
fi
