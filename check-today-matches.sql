-- Check today's matches in database
-- Run: psql -U postgres -d goalgpt -f check-today-matches.sql
-- Or: docker exec -i <postgres_container> psql -U postgres -d goalgpt < check-today-matches.sql

-- Today's date range (TSİ - UTC+3)
-- Get start of today in TSİ, convert to UTC
WITH today_tsi AS (
  SELECT 
    CURRENT_DATE AS today_date,
    EXTRACT(EPOCH FROM (CURRENT_DATE AT TIME ZONE 'Europe/Istanbul' AT TIME ZONE 'UTC'))::BIGINT AS start_unix,
    EXTRACT(EPOCH FROM ((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul' AT TIME ZONE 'UTC'))::BIGINT AS end_unix
)
SELECT 
  'Total matches today' AS metric,
  COUNT(*) AS count
FROM ts_matches m, today_tsi t
WHERE m.match_time >= t.start_unix AND m.match_time < t.end_unix

UNION ALL

SELECT 
  'Live matches (status 2,4,5,7)' AS metric,
  COUNT(*) AS count
FROM ts_matches m, today_tsi t
WHERE m.match_time >= t.start_unix 
  AND m.match_time < t.end_unix
  AND m.status_id IN (2, 4, 5, 7)

UNION ALL

SELECT 
  'Status ' || m.status_id::TEXT AS metric,
  COUNT(*) AS count
FROM ts_matches m, today_tsi t
WHERE m.match_time >= t.start_unix AND m.match_time < t.end_unix
GROUP BY m.status_id
ORDER BY metric;

-- Show sample live matches
SELECT 
  m.external_id,
  m.status_id,
  m.minute,
  m.home_score_regular,
  m.away_score_regular,
  TO_TIMESTAMP(m.match_time) AT TIME ZONE 'UTC' AS match_time_utc,
  TO_TIMESTAMP(m.updated_at) AT TIME ZONE 'UTC' AS updated_at_utc,
  m.provider_update_time,
  m.last_event_ts
FROM ts_matches m, (
  SELECT 
    EXTRACT(EPOCH FROM (CURRENT_DATE AT TIME ZONE 'Europe/Istanbul' AT TIME ZONE 'UTC'))::BIGINT AS start_unix,
    EXTRACT(EPOCH FROM ((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul' AT TIME ZONE 'UTC'))::BIGINT AS end_unix
) t
WHERE m.match_time >= t.start_unix 
  AND m.match_time < t.end_unix
  AND m.status_id IN (2, 4, 5, 7)
ORDER BY m.match_time DESC
LIMIT 20;





