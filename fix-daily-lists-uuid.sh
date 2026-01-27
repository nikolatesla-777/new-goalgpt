#!/bin/bash
# Targeted fix for daily lists UUID error
# Run this on VPS: scp fix-daily-lists-uuid.sh root@partnergoalgpt.com:/tmp/ && ssh root@partnergoalgpt.com "bash /tmp/fix-daily-lists-uuid.sh"

echo "🔧 Fixing daily lists UUID queries..."

cd /var/www/goalgpt/dist || exit 1

# Backup first
echo "📦 Creating backup..."
cp routes/telegram.routes.js routes/telegram.routes.js.backup-$(date +%Y%m%d-%H%M%S)

# Fix the three critical queries in telegram.routes.js
echo "Applying fixes..."

# Fix 1: Line 475 - Competition join (league name lookup)
# FROM: JOIN ts_competitions c ON m.competition_id = c.id::varchar
# TO:   JOIN ts_competitions c ON m.competition_id::text = c.id::text
sed -i "s/JOIN ts_competitions c ON m\.competition_id = c\.id::varchar/JOIN ts_competitions c ON m.competition_id::text = c.id::text/g" routes/telegram.routes.js

# Fix 2: Lines 830-831 - Live scores query
# FROM: INNER JOIN ts_teams t1 ON m.home_team_id = t1.external_id::varchar
# TO:   INNER JOIN ts_teams t1 ON m.home_team_id::text = t1.external_id::text
sed -i "s/INNER JOIN ts_teams t1 ON m\.home_team_id = t1\.external_id::varchar/INNER JOIN ts_teams t1 ON m.home_team_id::text = t1.external_id::text/g" routes/telegram.routes.js
sed -i "s/INNER JOIN ts_teams t2 ON m\.away_team_id = t2\.external_id::varchar/INNER JOIN ts_teams t2 ON m.away_team_id::text = t2.external_id::text/g" routes/telegram.routes.js

# Verify the fixes were applied
echo ""
echo "✅ Fixes applied! Verifying..."
echo ""

grep -n "ts_competitions c ON" routes/telegram.routes.js | head -3
grep -n "ts_teams t1 ON" routes/telegram.routes.js | head -3
grep -n "ts_teams t2 ON" routes/telegram.routes.js | head -3

echo ""
echo "🔄 Restarting backend..."
pm2 restart goalgpt-backend

echo ""
echo "✅ Done! Test with:"
echo "   curl https://partnergoalgpt.com/api/telegram/daily-lists/today"
