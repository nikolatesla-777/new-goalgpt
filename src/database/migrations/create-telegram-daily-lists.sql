-- ============================================================================
-- TELEGRAM DAILY LISTS TABLE
-- ============================================================================
-- Purpose: Store daily prediction lists (generated once per day)
-- Benefits:
--   - Lists remain STABLE throughout the day
--   - Started matches stay in list for performance tracking
--   - Reduces FootyStats API calls
--   - Historical data preserved
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_daily_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- List identification
  market VARCHAR(20) NOT NULL,              -- OVER_25, OVER_15, BTTS, HT_OVER_05, CORNERS, CARDS
  list_date DATE NOT NULL,                  -- 2026-01-26

  -- List metadata
  title VARCHAR(200) NOT NULL,              -- "Günün 2.5 ÜST Maçları"
  emoji VARCHAR(10) NOT NULL,               -- "📈"
  matches_count INTEGER DEFAULT 0,
  avg_confidence INTEGER DEFAULT 0,

  -- Match data (stored as JSONB for flexibility)
  matches JSONB NOT NULL,                   -- Array of match objects
  preview TEXT,                             -- Pre-formatted Telegram message

  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one list per market per day
  UNIQUE(market, list_date)
);

-- Indexes for performance
CREATE INDEX idx_telegram_daily_lists_date
  ON telegram_daily_lists(list_date DESC);

CREATE INDEX idx_telegram_daily_lists_market_date
  ON telegram_daily_lists(market, list_date DESC);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_telegram_daily_lists_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_telegram_daily_lists_timestamp
  BEFORE UPDATE ON telegram_daily_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_daily_lists_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE telegram_daily_lists IS
  'Daily prediction lists for Telegram channel - generated once per day, remain stable';

COMMENT ON COLUMN telegram_daily_lists.matches IS
  'Array of match objects with fs_id, team names, confidence, potentials, xg, odds, live_score';

COMMENT ON COLUMN telegram_daily_lists.preview IS
  'Pre-formatted Telegram message preview (HTML format)';
