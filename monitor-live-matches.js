/**
 * Real-time monitoring script for live matches and their minutes
 * Updates every 5 seconds to show current minute progression
 */
const { Pool } = require('pg');
require('dotenv').config();

let previousMatches = new Map();

async function monitorLiveMatches() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  
  // Clear screen
  console.clear();
  console.log('🔴 LIVE MATCHES MONITOR - Real-time Minute Tracking\n');
  console.log('Press Ctrl+C to exit\n');
  
  const monitorInterval = setInterval(async () => {
    try {
      const result = await client.query(
        `SELECT 
          m.external_id,
          m.status_id,
          m.minute,
          m.match_time,
          m.first_half_kickoff_ts,
          m.second_half_kickoff_ts,
          m.home_score_regular,
          m.away_score_regular,
          m.provider_update_time,
          m.last_event_ts,
          m.updated_at,
          ht.name as home_team_name,
          at.name as away_team_name,
          c.name as competition_name
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
         WHERE m.status_id IN (2, 3, 4, 5, 7)
         ORDER BY m.match_time DESC
         LIMIT 50`
      );
      
      // Clear screen and show header
      console.clear();
      console.log('🔴 LIVE MATCHES MONITOR - Real-time Minute Tracking');
      console.log(`📊 ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`);
      console.log(`\n📈 Found ${result.rows.length} live match(es)\n`);
      console.log('═'.repeat(120));
      
      if (result.rows.length === 0) {
        console.log('   No live matches at the moment.');
      } else {
        // Header
        console.log(
          'Status'.padEnd(8) +
          'Minute'.padEnd(8) +
          'Score'.padEnd(12) +
          'Home Team'.padEnd(25) +
          'Away Team'.padEnd(25) +
          'Competition'.padEnd(20) +
          'Last Update'
        );
        console.log('─'.repeat(120));
        
        for (const match of result.rows) {
          const statusText = getStatusText(match.status_id);
          const minuteText = match.minute !== null ? `${match.minute}'` : 'NULL';
          const scoreText = `${match.home_score_regular || 0} - ${match.away_score_regular || 0}`;
          const homeTeam = (match.home_team_name || 'Unknown').substring(0, 24);
          const awayTeam = (match.away_team_name || 'Unknown').substring(0, 24);
          const competition = (match.competition_name || 'Unknown').substring(0, 19);
          
          // Calculate last update time
          const lastUpdate = match.updated_at ? new Date(match.updated_at) : null;
          const lastUpdateText = lastUpdate 
            ? `${Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago`
            : 'N/A';
          
          // Check if minute changed
          const prevMinute = previousMatches.get(match.external_id);
          const minuteChanged = prevMinute !== undefined && prevMinute !== match.minute;
          const minuteIndicator = minuteChanged ? '🔄' : '  ';
          
          // Color coding for status
          const statusColor = getStatusColor(match.status_id);
          
          console.log(
            `${minuteIndicator}${statusColor}${statusText.padEnd(6)}\x1b[0m` +
            `${minuteText.padEnd(8)}` +
            `${scoreText.padEnd(12)}` +
            `${homeTeam.padEnd(25)}` +
            `${awayTeam.padEnd(25)}` +
            `${competition.padEnd(20)}` +
            `${lastUpdateText}`
          );
          
          // Show minute change indicator
          if (minuteChanged && match.minute !== null) {
            const change = match.minute - (prevMinute || 0);
            if (change > 0) {
              console.log(`      ⬆️  Minute increased: ${prevMinute} → ${match.minute} (+${change})`);
            }
          }
          
          // Store current minute
          previousMatches.set(match.external_id, match.minute);
        }
      }
      
      console.log('\n' + '═'.repeat(120));
      console.log('💡 Tips:');
      console.log('   - 🔄 indicates minute changed since last update');
      console.log('   - Status: 1H=First Half, HT=Half Time, 2H=Second Half, OT=Overtime, PEN=Penalty');
      console.log('   - Minute should increase every ~60 seconds for live matches');
      console.log('   - Press Ctrl+C to exit\n');
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
  }, 5000); // Update every 5 seconds
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(monitorInterval);
    console.log('\n\n👋 Monitoring stopped. Goodbye!\n');
    client.release();
    pool.end();
    process.exit(0);
  });
}

function getStatusText(statusId) {
  const statusMap = {
    1: 'NS',
    2: '1H',
    3: 'HT',
    4: '2H',
    5: 'OT',
    7: 'PEN',
    8: 'FT'
  };
  return statusMap[statusId] || '?';
}

function getStatusColor(statusId) {
  const colorMap = {
    2: '\x1b[32m', // Green for First Half
    3: '\x1b[33m', // Yellow for Half Time
    4: '\x1b[36m', // Cyan for Second Half
    5: '\x1b[35m', // Magenta for Overtime
    7: '\x1b[31m'  // Red for Penalty
  };
  return colorMap[statusId] || '';
}

monitorLiveMatches().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

