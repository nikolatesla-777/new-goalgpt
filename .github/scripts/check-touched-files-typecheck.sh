#!/bin/bash
set -euo pipefail

# Phase 5-2: Typecheck Touched Files Clean Check
# This script verifies that Phase 3/4/5 touched files have no TypeScript errors.

echo "🔍 Checking TypeScript errors in touched files..."

# Determine changed files
if [ -n "${GITHUB_BASE_REF:-}" ]; then
  # PR context: compare against base branch
  BASE_REF="${GITHUB_BASE_REF}"
  CHANGED_FILES=$(git diff --name-only "origin/${BASE_REF}...HEAD" || git diff --name-only "main...HEAD" || git diff --name-only "HEAD~1" || echo "")
else
  # Fallback: compare against HEAD~1
  CHANGED_FILES=$(git diff --name-only HEAD~1 || echo "")
fi

if [ -z "$CHANGED_FILES" ]; then
  echo "⚠️  No changed files detected. Running full typecheck..."
  npm run typecheck
  exit 0
fi

# Filter Phase 3/4/5 touched files
PHASE_FILES=$(echo "$CHANGED_FILES" | grep -E "(matchMinute|matchWatchdog|matchFreezeDetection|health|server\.ts|obsLogger|matchFreezeDetection|freezeDetection)" || true)

if [ -z "$PHASE_FILES" ]; then
  echo "✅ No Phase 3/4/5 files changed. Skipping targeted typecheck."
  exit 0
fi

echo "📋 Phase 3/4/5 files changed:"
echo "$PHASE_FILES" | while read -r file; do
  echo "  - $file"
done

# Run full typecheck and filter errors for touched files
echo "🔧 Running typecheck..."
if npm run typecheck 2>&1 | tee /tmp/typecheck-output.txt; then
  echo "✅ Typecheck passed (no errors)"
  exit 0
else
  # Check if errors are in touched files
  TYPECHECK_EXIT=$?
  ERRORS_IN_TOUCHED=$(grep -E "$(echo "$PHASE_FILES" | tr '\n' '|' | sed 's/|$//')" /tmp/typecheck-output.txt || true)
  
  if [ -n "$ERRORS_IN_TOUCHED" ]; then
    echo "❌ TypeScript errors found in Phase 3/4/5 touched files:"
    echo "$ERRORS_IN_TOUCHED"
    exit 1
  else
    echo "⚠️  Typecheck failed, but errors are NOT in Phase 3/4/5 touched files."
    echo "✅ Touched files are clean (pre-existing errors in other files)."
    exit 0
  fi
fi



