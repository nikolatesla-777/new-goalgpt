/**
 * Check Samsunspor match status in database
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function checkSamsunsporMatch() {
  const client = await pool.connect();
  try {
    // Find Samsunspor match (probably vs Eyüpspor based on earlier context)
    const query = `
      SELECT 
        m.external_id,
        m.status_id,
        m.match_time,
        m.first_half_kickoff_ts,
        m.second_half_kickoff_ts,
        m.provider_update_time,
        m.last_event_ts,
        m.updated_at,
        m.home_score_display,
        m.away_score_display,
        m.minute,
        ht.name as home_team_name,
        at.name as away_team_name,
        c.name as competition_name,
        EXTRACT(EPOCH FROM NOW()) - m.match_time as seconds_since_match_time,
        EXTRACT(EPOCH FROM NOW()) - m.provider_update_time as seconds_since_provider_update,
        EXTRACT(EPOCH FROM NOW()) - m.last_event_ts as seconds_since_last_event
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE (
        ht.name ILIKE '%samsun%' 
        OR at.name ILIKE '%samsun%'
        OR ht.name ILIKE '%eyüp%'
        OR at.name ILIKE '%eyüp%'
      )
      AND m.match_time >= EXTRACT(EPOCH FROM NOW()) - 86400  -- Last 24 hours
      ORDER BY m.match_time DESC
      LIMIT 5
    `;

    const result = await client.query(query);
    const matches = result.rows;

    console.log(`\n🔍 Found ${matches.length} matches:\n`);
    
    for (const match of matches) {
      const nowTs = Math.floor(Date.now() / 1000);
      const matchTime = match.match_time;
      const minutesSinceMatchTime = Math.floor((nowTs - matchTime) / 60);
      
      console.log(`📊 Match: ${match.home_team_name} vs ${match.away_team_name}`);
      console.log(`   External ID: ${match.external_id}`);
      console.log(`   Status ID: ${match.status_id} ${getStatusName(match.status_id)}`);
      console.log(`   Match Time: ${new Date(matchTime * 1000).toLocaleString('tr-TR')} (${minutesSinceMatchTime} minutes ago)`);
      console.log(`   Score: ${match.home_score_display || 0} - ${match.away_score_display || 0}`);
      console.log(`   Minute: ${match.minute || 'NULL'}`);
      console.log(`   Competition: ${match.competition_name || 'NULL'}`);
      console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toLocaleString('tr-TR') : 'NULL'}`);
      console.log(`   Second Half Kickoff: ${match.second_half_kickoff_ts ? new Date(match.second_half_kickoff_ts * 1000).toLocaleString('tr-TR') : 'NULL'}`);
      console.log(`   Provider Update Time: ${match.provider_update_time ? new Date(match.provider_update_time * 1000).toLocaleString('tr-TR') : 'NULL'} (${Math.floor(match.seconds_since_provider_update || 0)}s ago)`);
      console.log(`   Last Event TS: ${match.last_event_ts ? new Date(match.last_event_ts * 1000).toLocaleString('tr-TR') : 'NULL'} (${Math.floor(match.seconds_since_last_event || 0)}s ago)`);
      console.log(`   Updated At: ${match.updated_at ? new Date(match.updated_at).toLocaleString('tr-TR') : 'NULL'}`);
      
      // Check if should be live
      if (match.status_id === 1 && matchTime <= nowTs) {
        console.log(`   ⚠️  SHOULD BE LIVE: status=1 but match_time passed (${minutesSinceMatchTime}m ago)`);
      }
      
      // Check if it's live
      if ([2, 3, 4, 5, 7].includes(match.status_id)) {
        console.log(`   ✅ IS LIVE: status=${match.status_id}`);
      }
      
      console.log('');
    }
    
    // Check ProactiveMatchStatusCheckWorker would find this
    const nowTs = Math.floor(Date.now() / 1000);
    const TSI_OFFSET_SECONDS = 3 * 3600;
    const nowDate = new Date(nowTs * 1000);
    const year = nowDate.getUTCFullYear();
    const month = nowDate.getUTCMonth();
    const day = nowDate.getUTCDate();
    const todayStartTSI = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
    const todayEndTSI = todayStartTSI + 86400;
    
    const shouldBeLiveQuery = `
      SELECT COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1
        AND match_time < $2
        AND match_time <= $3
        AND status_id = 1
    `;
    
    const shouldBeLiveResult = await client.query(shouldBeLiveQuery, [todayStartTSI, todayEndTSI, nowTs]);
    console.log(`\n📈 Should-be-live matches count (for ProactiveMatchStatusCheckWorker): ${shouldBeLiveResult.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

function getStatusName(statusId) {
  const statusMap = {
    1: '(NOT_STARTED)',
    2: '(FIRST_HALF)',
    3: '(HALF_TIME)',
    4: '(SECOND_HALF)',
    5: '(OVERTIME)',
    7: '(PENALTIES)',
    8: '(END)',
    9: '(DELAY)',
    10: '(INTERRUPT)',
    12: '(CANCEL)',
  };
  return statusMap[statusId] || '(UNKNOWN)';
}

checkSamsunsporMatch().catch(console.error);


