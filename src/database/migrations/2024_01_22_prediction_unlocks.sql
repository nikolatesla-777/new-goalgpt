-- ============================================================================
-- Prediction Unlocks (Credit-based prediction access for FREE users)
-- Migration: 2024_01_22_prediction_unlocks.sql
-- ============================================================================

-- Create table to track which predictions users have unlocked
CREATE TABLE IF NOT EXISTS customer_prediction_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id UUID NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
    prediction_id UUID NOT NULL,
    credits_spent INTEGER NOT NULL DEFAULT 50,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate unlocks
    CONSTRAINT unique_user_prediction_unlock UNIQUE (customer_user_id, prediction_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prediction_unlocks_user ON customer_prediction_unlocks(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_unlocks_prediction ON customer_prediction_unlocks(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_unlocks_date ON customer_prediction_unlocks(unlocked_at);

-- Comments
COMMENT ON TABLE customer_prediction_unlocks IS 'Tracks predictions unlocked by FREE users using credits';
COMMENT ON COLUMN customer_prediction_unlocks.credits_spent IS 'Number of credits spent to unlock (default: 50)';
