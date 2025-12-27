# 🚀 Database Reset & Cold Boot Launch Guide

## STEP 1: Clean the Database

Run the SQL script to remove all corrupted data:

```bash
# Option 1: Using psql command line
psql -U your_username -d your_database -f reset-database.sql

# Option 2: Using psql interactive mode
psql -U your_username -d your_database
\i reset-database.sql

# Option 3: Copy-paste the SQL directly into your database client
```

**Or manually run this SQL:**

```sql
-- Core match data
TRUNCATE TABLE ts_matches CASCADE;

-- Master data tables (in dependency order)
TRUNCATE TABLE ts_players CASCADE;
TRUNCATE TABLE ts_coaches CASCADE;
TRUNCATE TABLE ts_referees CASCADE;
TRUNCATE TABLE ts_venues CASCADE;
TRUNCATE TABLE ts_stages CASCADE;
TRUNCATE TABLE ts_seasons CASCADE;
TRUNCATE TABLE ts_teams CASCADE;
TRUNCATE TABLE ts_competitions CASCADE;
TRUNCATE TABLE ts_countries CASCADE;
TRUNCATE TABLE ts_categories CASCADE;

-- Sync state tracking
TRUNCATE TABLE ts_sync_state CASCADE;
```

**Verify the reset:**
```sql
SELECT COUNT(*) FROM ts_matches;        -- Should return 0
SELECT COUNT(*) FROM ts_teams;         -- Should return 0
SELECT COUNT(*) FROM ts_competitions;   -- Should return 0
SELECT COUNT(*) FROM ts_sync_state;    -- Should return 0
```

---

## STEP 2: Launch the Backend

Start the server to trigger the **Cold Boot** sequence:

```bash
npm run dev
```

**Expected output:**
```
🚀 Fastify server running on port 3000
📊 API: http://localhost:3000/api
```

---

## STEP 3: Watch for Cold Boot Logs

Monitor the console for these **specific log messages** that confirm the Bootstrap is working:

### ✅ **Phase 1: Database Check**
```
🚀 Starting Bootstrap Sequence...
Database status: Categories=0, Competitions=0, Teams=0, Empty=true
📦 Database is empty. Running initial syncs...
```

### ✅ **Phase 2: Master Data Sync**
```
📋 Syncing Categories...
Starting category sync from TheSports API...
Category sync completed: X/Y synced, Z errors
✅ Categories synced

🌍 Syncing Countries...
Starting country sync from TheSports API...
Country sync completed: X/Y synced, Z errors
✅ Countries synced

🏆 Syncing Competitions...
Starting competition sync...
Competition sync completed: X/Y synced, Z errors (FULL)
✅ Competitions synced

⚽ Syncing Teams...
Starting team sync...
Team sync completed: X/Y synced, Z errors (FULL)
✅ Teams synced
```

### ✅ **Phase 3: Today's Schedule**
```
📅 Fetching Today's Schedule...
Fetching match diary for today: YYYYMMDD
Fetching match diary for date: YYYYMMDD
Found X matches for today. Syncing...
Match ... synced successfully
Today's schedule synced: X/Y matches synced, Z errors
```

### ✅ **Phase 4: Bootstrap Complete**
```
✅ Bootstrap Complete. System Ready. Opening MQTT Gates...
🔧 Running Bootstrap Sequence...
✅ Bootstrap Complete
✅ WebSocket service connected
✅ All background workers started
```

### ✅ **Phase 5: MatchSyncService in Action**
Look for these messages when matches are being saved:
```
Competition ... not found, fetching from API...
Home team ... not found, attempting to fetch from API...
Away team ... not found, attempting to fetch from API...
Match ... synced successfully
```

---

## STEP 4: Verify Frontend

1. **Open the frontend:** `http://localhost:5173` (or your frontend port)

2. **Check for:**
   - ✅ Team names appear (not "Unknown Team")
   - ✅ League names appear (not "Unknown League" or "Bilinmeyen Lig")
   - ✅ Match times are correct (not showing "Ended" for future matches)
   - ✅ Team logos load correctly

3. **Expected behavior:**
   - First load might take 30-60 seconds (cold boot is syncing data)
   - Subsequent loads should be fast (data is cached)
   - Matches should have proper team/competition names

---

## Troubleshooting

### ❌ **If Bootstrap fails:**
- Check API credentials in `.env` file
- Verify database connection
- Check network connectivity to TheSports API
- Review error logs for specific failures

### ❌ **If "Unknown League" still appears:**
- Check if `ts_competitions` table has data: `SELECT COUNT(*) FROM ts_competitions;`
- Verify competition sync completed: Look for "✅ Competitions synced" in logs
- Check if match has `competition_id`: `SELECT competition_id FROM ts_matches LIMIT 10;`

### ❌ **If "Unknown Team" still appears:**
- Check if `ts_teams` table has data: `SELECT COUNT(*) FROM ts_teams;`
- Verify team sync completed: Look for "✅ Teams synced" in logs
- Check MatchSyncService logs for team fetch errors

### ❌ **If matches show wrong status:**
- Check timezone fix logs: Look for "Fixing status to NOT_STARTED" messages
- Verify `match_time` is Unix timestamp: `SELECT match_time, status_id FROM ts_matches LIMIT 5;`

---

## Success Criteria

✅ **Cold Boot is successful if you see:**
1. All 4 phases complete without errors
2. Frontend shows proper team/league names
3. Match times are correct
4. No "Unknown" text in the UI

🎉 **You're ready for real-time updates!**










