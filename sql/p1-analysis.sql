-- ============================================================
-- P1 STAGGER IMPACT ANALYSIS - BEFORE/AFTER COMPARISON
-- ============================================================
-- Run this query set at end of Phase 1 (baseline) and Phase 2/4 (stagger)
-- Save results to CSV for comparison

-- Query 1: Concurrent Job Execution Analysis
-- Purpose: Measure peak concurrent jobs (expect 8→1 reduction)
-- ============================================================
WITH job_minutes AS (
  SELECT
    DATE_TRUNC('minute', started_at) AS minute,
    job_name,
    COUNT(*) FILTER (WHERE status = 'running') AS running_count,
    COUNT(*) FILTER (WHERE status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
  FROM job_execution_logs
  WHERE started_at >= NOW() - INTERVAL '24 hours'
    AND job_name IN (
      'Referral Tier 2 Processor',
      'Referral Tier 3 Processor',
      'Scheduled Notifications',
      'Live Stats Sync',
      'Badge Auto-Unlock',
      'Prediction Matcher',
      'Stuck Match Finisher',
      'Telegram Settlement'
    )
  GROUP BY minute, job_name
)
SELECT
  minute,
  SUM(running_count) AS total_concurrent,
  COUNT(DISTINCT job_name) AS unique_jobs,
  ARRAY_AGG(DISTINCT job_name ORDER BY job_name) AS job_names
FROM job_minutes
GROUP BY minute
ORDER BY total_concurrent DESC
LIMIT 20;

-- Expected Results:
-- BEFORE (Phase 1): total_concurrent = 8, unique_jobs = 8 (all at :00)
-- AFTER (Phase 2/4): total_concurrent = 1-2, unique_jobs = 1-2 (spread across minute)

-- Query 2: Job Duration Comparison
-- Purpose: Measure avg duration per job (expect 30% improvement)
-- ============================================================
SELECT
  job_name,
  COUNT(*) AS execution_count,
  ROUND(AVG(duration_ms)::numeric, 2) AS avg_duration_ms,
  ROUND(MIN(duration_ms)::numeric, 2) AS min_duration_ms,
  ROUND(MAX(duration_ms)::numeric, 2) AS max_duration_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) AS median_duration_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) AS p95_duration_ms
FROM job_execution_logs
WHERE started_at >= NOW() - INTERVAL '24 hours'
  AND status IN ('success', 'failed')
  AND job_name IN (
    'Referral Tier 2 Processor',
    'Referral Tier 3 Processor',
    'Scheduled Notifications',
    'Live Stats Sync',
    'Badge Auto-Unlock',
    'Prediction Matcher',
    'Stuck Match Finisher',
    'Telegram Settlement'
  )
GROUP BY job_name
ORDER BY avg_duration_ms DESC;

-- Expected Results:
-- BEFORE: avg_duration_ms = [baseline]
-- AFTER: avg_duration_ms = [baseline] * 0.7 (30% faster)

-- Query 3: Job Execution Success Rate
-- Purpose: Ensure no degradation in reliability
-- ============================================================
SELECT
  job_name,
  COUNT(*) AS total_executions,
  COUNT(*) FILTER (WHERE status = 'success') AS success_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'success')::float / COUNT(*)) * 100,
    2
  ) AS success_rate_pct
FROM job_execution_logs
WHERE started_at >= NOW() - INTERVAL '24 hours'
  AND job_name IN (
    'Referral Tier 2 Processor',
    'Referral Tier 3 Processor',
    'Scheduled Notifications',
    'Live Stats Sync',
    'Badge Auto-Unlock',
    'Prediction Matcher',
    'Stuck Match Finisher',
    'Telegram Settlement'
  )
GROUP BY job_name
ORDER BY success_rate_pct ASC;

-- Expected Results:
-- BEFORE & AFTER: success_rate_pct should be similar (no degradation)

-- Query 4: Job Start Time Distribution (Second-Level Precision)
-- Purpose: Verify stagger offsets working correctly
-- ============================================================
SELECT
  job_name,
  EXTRACT(SECOND FROM started_at)::int AS start_second,
  COUNT(*) AS execution_count,
  ARRAY_AGG(DISTINCT DATE_TRUNC('minute', started_at) ORDER BY DATE_TRUNC('minute', started_at) DESC LIMIT 5) AS recent_minutes
FROM job_execution_logs
WHERE started_at >= NOW() - INTERVAL '24 hours'
  AND job_name IN (
    'Referral Tier 2 Processor',
    'Referral Tier 3 Processor',
    'Scheduled Notifications',
    'Live Stats Sync',
    'Badge Auto-Unlock',
    'Prediction Matcher',
    'Stuck Match Finisher',
    'Telegram Settlement'
  )
GROUP BY job_name, start_second
ORDER BY job_name, start_second;

-- Expected Results:
-- BEFORE: All jobs at start_second = 0
-- AFTER: Jobs at different seconds (0, 5, 10, 15, 25, 30, 40, 45)

-- Query 5: Overlap Detection (Should Be Zero Always)
-- Purpose: Verify advisory locks prevent duplicates
-- ============================================================
WITH overlapping_jobs AS (
  SELECT
    a.job_name,
    a.started_at AS first_start,
    b.started_at AS second_start,
    a.duration_ms + b.duration_ms AS total_duration_ms
  FROM job_execution_logs a
  JOIN job_execution_logs b
    ON a.job_name = b.job_name
    AND a.id < b.id
    AND b.started_at < (a.started_at + (a.duration_ms || ' milliseconds')::interval)
  WHERE a.started_at >= NOW() - INTERVAL '24 hours'
    AND a.job_name IN (
      'Referral Tier 2 Processor',
      'Referral Tier 3 Processor',
      'Scheduled Notifications',
      'Live Stats Sync',
      'Badge Auto-Unlock',
      'Prediction Matcher',
      'Stuck Match Finisher',
      'Telegram Settlement'
    )
)
SELECT
  job_name,
  COUNT(*) AS overlap_count,
  ARRAY_AGG(first_start ORDER BY first_start DESC LIMIT 5) AS recent_overlaps
FROM overlapping_jobs
GROUP BY job_name
ORDER BY overlap_count DESC;

-- Expected Results:
-- BEFORE & AFTER: overlap_count = 0 (advisory locks working)

-- Query 6: Metadata Verification (Phase 2/4 Only)
-- Purpose: Verify stagger metadata logged correctly
-- ============================================================
SELECT
  job_name,
  metadata->>'schedule' AS original_schedule,
  metadata->>'effective_schedule' AS effective_schedule,
  (metadata->>'stagger_offset_s')::int AS stagger_offset,
  COUNT(*) AS execution_count
FROM job_execution_logs
WHERE started_at >= NOW() - INTERVAL '24 hours'
  AND metadata IS NOT NULL
  AND job_name IN (
    'Referral Tier 2 Processor',
    'Referral Tier 3 Processor',
    'Scheduled Notifications',
    'Live Stats Sync',
    'Badge Auto-Unlock',
    'Prediction Matcher',
    'Stuck Match Finisher',
    'Telegram Settlement'
  )
GROUP BY job_name, metadata->>'schedule', metadata->>'effective_schedule', metadata->>'stagger_offset_s'
ORDER BY job_name;

-- Expected Results (Phase 2/4):
-- effective_schedule should be 6-field (e.g., "15 * * * * *")
-- stagger_offset should match config (0, 5, 10, 15, 25, 30, 40, 45)

-- ============================================================
-- EXPORT RESULTS TO CSV FOR COMPARISON
-- ============================================================
-- \copy (SELECT * FROM ...) TO '/tmp/phase1_concurrent.csv' CSV HEADER;
-- \copy (SELECT * FROM ...) TO '/tmp/phase2_concurrent.csv' CSV HEADER;
