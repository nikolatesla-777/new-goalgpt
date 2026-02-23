-- Twitter Posts Table
-- Stores Twitter/X thread publications for trends analysis
-- Mirrors telegram_posts idempotency pattern

CREATE TABLE IF NOT EXISTS twitter_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL DEFAULT 'trends',
  dedupe_key VARCHAR(64) UNIQUE,          -- 'twitter:trends:YYYY-MM-DD:v1' SHA256
  main_tweet_text TEXT NOT NULL,
  thread_tweets JSONB NOT NULL DEFAULT '[]',
  thread_tweet_ids JSONB,
  main_tweet_id VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_log TEXT,
  last_error_at TIMESTAMP,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  template_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMP,
  trends_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_twitter_posts_status ON twitter_posts(status);
CREATE INDEX IF NOT EXISTS idx_twitter_posts_dedupe ON twitter_posts(dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_twitter_posts_created_at ON twitter_posts(created_at DESC);
