#!/bin/bash

# Migration Verification Script
# Dynamically extracts target table from migration and verifies columns

set -e

MIGRATION_FILE="src/database/migrations/add-half-statistics-persistence.ts"

echo "=== MIGRATION VERIFICATION ==="
echo ""

# 1. Extract target table from migration (no hard-coding)
echo "Step 1: Extracting target table from migration..."
# Portable extraction (works on both GNU and BSD grep)
TARGET_TABLE=$(grep "ALTER TABLE" "$MIGRATION_FILE" | sed -n 's/.*ALTER TABLE \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/p' | head -1)

if [ -z "$TARGET_TABLE" ]; then
    echo "❌ ERROR: Could not find 'ALTER TABLE <table>' in migration file"
    exit 1
fi

echo "✅ Migration targets table: $TARGET_TABLE"
echo ""

# 2. Verify columns in target table
echo "Step 2: Verifying columns in '$TARGET_TABLE'..."

VERIFY_QUERY="
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name = '$TARGET_TABLE'
  AND column_name IN (
    'data_completeness',
    'statistics_second_half',
    'incidents_first_half',
    'incidents_second_half'
  )
ORDER BY column_name;
"

# Execute verification (requires psql to be available)
RESULT=$(psql -U postgres -d goalgpt -t -c "$VERIFY_QUERY" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to query database"
    echo "$RESULT"
    exit 1
fi

# Count rows
ROW_COUNT=$(echo "$RESULT" | grep -c "|" || true)

echo "Query result:"
echo "$RESULT"
echo ""

if [ "$ROW_COUNT" -eq 4 ]; then
    echo "✅ All 4 columns found in table '$TARGET_TABLE'"
else
    echo "⚠️ WARNING: Expected 4 columns, found $ROW_COUNT"
    echo "Missing columns may indicate incomplete migration"
fi

echo ""
echo "=== VERIFICATION COMPLETE ==="

# Exit 0 if all columns found, 1 otherwise
[ "$ROW_COUNT" -eq 4 ] && exit 0 || exit 1
