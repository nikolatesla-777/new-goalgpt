-- Phase-3A: Admin Publish Logs Table
-- Tracks all publishing actions from admin panel with full audit trail

CREATE TABLE IF NOT EXISTS admin_publish_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request metadata
  request_id VARCHAR(100) NOT NULL,
  admin_user_id VARCHAR(100) NOT NULL,

  -- Match info
  match_id VARCHAR(100) NOT NULL,
  fs_match_id INTEGER,

  -- Publishing details
  market_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(100),

  -- Payload
  payload JSONB NOT NULL,

  -- Execution flags
  dry_run BOOLEAN DEFAULT FALSE,

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Status values: 'pending', 'sent', 'failed', 'dry_run_success'

  telegram_message_id VARCHAR(100),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_publish_logs_match_id ON admin_publish_logs(match_id);
CREATE INDEX IF NOT EXISTS idx_admin_publish_logs_market_id ON admin_publish_logs(market_id);
CREATE INDEX IF NOT EXISTS idx_admin_publish_logs_admin_user ON admin_publish_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_publish_logs_created_at ON admin_publish_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_publish_logs_request_id ON admin_publish_logs(request_id);

-- Comments
COMMENT ON TABLE admin_publish_logs IS 'Audit log for all admin panel publishing actions';
COMMENT ON COLUMN admin_publish_logs.request_id IS 'Unique request identifier for tracking';
COMMENT ON COLUMN admin_publish_logs.dry_run IS 'If TRUE, no actual Telegram send occurred';
COMMENT ON COLUMN admin_publish_logs.payload IS 'Full request payload including picks, text, metadata';
COMMENT ON COLUMN admin_publish_logs.status IS 'pending | sent | failed | dry_run_success';
