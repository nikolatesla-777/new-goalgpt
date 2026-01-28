-- ============================================================================
-- ADD SETTLEMENT COLUMNS TO TELEGRAM DAILY LISTS
-- ============================================================================
-- Purpose: Enable auto-settlement tracking for daily lists
-- Features:
--   - Track Telegram message ID for editing
--   - Track settlement status (active/settled/cancelled)
--   - Store settlement results (won/lost/void counts)
--   - Track settlement timestamp
-- ============================================================================

-- Add columns for settlement tracking
ALTER TABLE telegram_daily_lists
ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT,
ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS settlement_result JSONB;

-- Update existing records to 'active' status if they have been posted
UPDATE telegram_daily_lists
SET status = 'active'
WHERE telegram_message_id IS NOT NULL AND status = 'draft';

-- Create index for settlement query optimization
CREATE INDEX IF NOT EXISTS idx_telegram_daily_lists_settlement
ON telegram_daily_lists(status, list_date, settled_at)
WHERE status = 'active' AND settled_at IS NULL;

-- Create index for telegram_message_id lookups
CREATE INDEX IF NOT EXISTS idx_telegram_daily_lists_message_id
ON telegram_daily_lists(telegram_message_id)
WHERE telegram_message_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN telegram_daily_lists.telegram_message_id IS
  'Telegram message ID for editing settlement results';

COMMENT ON COLUMN telegram_daily_lists.channel_id IS
  'Telegram channel ID where the list was published';

COMMENT ON COLUMN telegram_daily_lists.settled_at IS
  'Timestamp when the list was settled (all matches finished)';

COMMENT ON COLUMN telegram_daily_lists.status IS
  'List status: draft (not posted), active (posted, not settled), settled (results finalized), cancelled';

COMMENT ON COLUMN telegram_daily_lists.settlement_result IS
  'JSON object with settlement results: { won: number, lost: number, void: number, matches: [...] }';
