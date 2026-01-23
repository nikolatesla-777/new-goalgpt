-- Migration: Add last_update_source column to ts_matches
-- Purpose: Track which service last updated each match (for debugging/monitoring)
-- PR-8B: Required by MatchOrchestrator for source tracking
-- Date: 2026-01-23
-- Applied to: Production (already executed via hotfix)

ALTER TABLE ts_matches 
ADD COLUMN IF NOT EXISTS last_update_source VARCHAR(50);

COMMENT ON COLUMN ts_matches.last_update_source IS 'Tracks which service/job last updated this match (watchdog/sync/computed/admin)';
