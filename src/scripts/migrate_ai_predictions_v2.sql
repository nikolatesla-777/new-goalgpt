-- ============================================================================
-- AI PREDICTIONS SCHEMA MIGRATION v2
-- Target: 29-column optimized schema
-- Safe migration with data preservation
-- ============================================================================

-- Start transaction
BEGIN;

-- ============================================================================
-- STEP 1: Add new columns
-- ============================================================================

-- Core new columns
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS prediction VARCHAR(100);
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS prediction_threshold DECIMAL(3,1);
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS result_reason VARCHAR(255);
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'external';

-- Team ID columns (for FK references)
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS home_team_id VARCHAR(50);
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS away_team_id VARCHAR(50);

-- ============================================================================
-- STEP 2: Migrate data to new columns
-- ============================================================================

-- Populate 'prediction' from existing data
UPDATE ai_predictions SET prediction = COALESCE(
    prediction_value,
    CASE
        WHEN display_prediction IS NOT NULL AND display_prediction != ''
        THEN REGEXP_REPLACE(display_prediction, '^[^A-Z]*', '')  -- Strip emoji prefix
        ELSE NULL
    END,
    'IY 0.5 ÜST'  -- Default for NULL values
) WHERE prediction IS NULL;

-- Populate 'prediction_threshold' by parsing from prediction
UPDATE ai_predictions SET prediction_threshold = CASE
    WHEN prediction LIKE '%0.5%' THEN 0.5
    WHEN prediction LIKE '%1.5%' THEN 1.5
    WHEN prediction LIKE '%2.5%' THEN 2.5
    WHEN prediction LIKE '%3.5%' THEN 3.5
    WHEN prediction LIKE '%4.5%' THEN 4.5
    ELSE 0.5  -- Default threshold
END WHERE prediction_threshold IS NULL;

-- Set source based on external_id pattern
UPDATE ai_predictions SET source = CASE
    WHEN external_id LIKE 'manual_%' THEN 'manual'
    WHEN external_id IS NULL OR external_id = '' THEN 'manual'
    ELSE 'external'
END WHERE source IS NULL OR source = 'external';

-- Merge resulted_score into final_score (if not already set)
UPDATE ai_predictions
SET final_score = COALESCE(final_score, resulted_score)
WHERE resulted_score IS NOT NULL AND (final_score IS NULL OR final_score = '');

-- Set result_reason for existing settled predictions
UPDATE ai_predictions SET result_reason = CASE
    WHEN result = 'won' THEN 'manual_or_legacy'
    WHEN result = 'lost' THEN 'manual_or_legacy'
    WHEN result = 'cancelled' THEN 'match_cancelled'
    ELSE NULL
END WHERE result != 'pending' AND result_reason IS NULL;

-- ============================================================================
-- STEP 3: Set constraints and defaults
-- ============================================================================

-- Make prediction NOT NULL (after migration)
ALTER TABLE ai_predictions ALTER COLUMN prediction SET NOT NULL;
ALTER TABLE ai_predictions ALTER COLUMN prediction SET DEFAULT 'IY 0.5 ÜST';

-- Make prediction_threshold NOT NULL
ALTER TABLE ai_predictions ALTER COLUMN prediction_threshold SET NOT NULL;
ALTER TABLE ai_predictions ALTER COLUMN prediction_threshold SET DEFAULT 0.5;

-- ============================================================================
-- STEP 4: Drop deprecated columns
-- ============================================================================

-- Remove redundant columns
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS bot_name;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS bot_group_id;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS prediction_type;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS prediction_value;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS display_prediction;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS confidence;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS match_confidence;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS resulted_score;
ALTER TABLE ai_predictions DROP COLUMN IF EXISTS prediction_period;

-- ============================================================================
-- STEP 5: Add new indexes
-- ============================================================================

-- Index for threshold-based queries (settlement)
CREATE INDEX IF NOT EXISTS idx_predictions_threshold ON ai_predictions(prediction_threshold);

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_predictions_source ON ai_predictions(source);

-- Composite index for settlement queries
CREATE INDEX IF NOT EXISTS idx_predictions_settlement
ON ai_predictions(match_id, result, minute_at_prediction);

-- ============================================================================
-- STEP 6: Update check constraints
-- ============================================================================

-- Add source constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_source'
    ) THEN
        ALTER TABLE ai_predictions
        ADD CONSTRAINT chk_source CHECK (source IN ('external', 'manual'));
    END IF;
END $$;

-- ============================================================================
-- STEP 7: Verify migration
-- ============================================================================

-- Show final column count
SELECT 'Migration complete. Column count:' AS status,
       COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_name = 'ai_predictions';

-- Show sample of migrated data
SELECT id, canonical_bot_name, prediction, prediction_threshold, result, source
FROM ai_predictions
LIMIT 5;

COMMIT;
