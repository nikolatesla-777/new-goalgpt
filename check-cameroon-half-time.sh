#!/bin/bash
# Check Cameroon match status transition issue

echo "🔍 Checking Cameroon match status in database..."
echo ""

# Find Cameroon match
psql "$DATABASE_URL" -c "
SELECT 
  external_id,
  status_id,
  match_time,
  first_half_kickoff_ts,
  second_half_kickoff_ts,
  minute,
  home_score_display,
  away_score_display,
  provider_update_time,
  updated_at,
  (SELECT name FROM ts_teams WHERE external_id = ts_matches.home_team_id) as home_team,
  (SELECT name FROM ts_teams WHERE external_id = ts_matches.away_team_id) as away_team
FROM ts_matches
WHERE (
  (SELECT name FROM ts_teams WHERE external_id = ts_matches.home_team_id) ILIKE '%cameroon%'
  OR (SELECT name FROM ts_teams WHERE external_id = ts_matches.away_team_id) ILIKE '%cameroon%'
  OR (SELECT name FROM ts_teams WHERE external_id = ts_matches.home_team_id) ILIKE '%gabon%'
  OR (SELECT name FROM ts_teams WHERE external_id = ts_matches.away_team_id) ILIKE '%gabon%'
)
AND match_time >= EXTRACT(EPOCH FROM NOW()) - 7200
ORDER BY match_time DESC
LIMIT 3;
"

echo ""
echo "📊 Status breakdown:"
psql "$DATABASE_URL" -c "
SELECT 
  status_id,
  CASE status_id
    WHEN 1 THEN 'NOT_STARTED'
    WHEN 2 THEN 'FIRST_HALF'
    WHEN 3 THEN 'HALF_TIME'
    WHEN 4 THEN 'SECOND_HALF'
    WHEN 5 THEN 'OVERTIME'
    WHEN 8 THEN 'END'
    ELSE 'OTHER'
  END as status_name,
  COUNT(*) as count
FROM ts_matches
WHERE (
  (SELECT name FROM ts_teams WHERE external_id = ts_matches.home_team_id) ILIKE '%cameroon%'
  OR (SELECT name FROM ts_teams WHERE external_id = ts_matches.away_team_id) ILIKE '%cameroon%'
)
AND match_time >= EXTRACT(EPOCH FROM NOW()) - 7200
GROUP BY status_id;
"

echo ""
echo "🔍 Recent logs for Cameroon match (last 50 lines):"
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i "cameroon\|gabon" | tail -20
