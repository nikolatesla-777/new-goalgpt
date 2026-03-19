-- InPlay Guru Supabase'de çalıştır (SQL Editor)
-- GoalGPT sync için goalgpt_id kolonu ekler

ALTER TABLE inplayguru_picks
  ADD COLUMN IF NOT EXISTS goalgpt_id TEXT UNIQUE;

-- Index for fast upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_inplayguru_picks_goalgpt_id
  ON inplayguru_picks (goalgpt_id)
  WHERE goalgpt_id IS NOT NULL;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inplayguru_picks'
ORDER BY ordinal_position;
