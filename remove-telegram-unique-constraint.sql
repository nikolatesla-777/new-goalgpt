-- Remove UNIQUE constraint on (match_id, channel_id) to allow duplicate publishes
ALTER TABLE telegram_posts DROP CONSTRAINT IF EXISTS telegram_posts_match_channel_unique;
ALTER TABLE telegram_posts DROP CONSTRAINT IF EXISTS telegram_posts_match_id_channel_id_key;
