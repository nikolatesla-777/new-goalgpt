/**
 * Check if provider sends minute in detail_live response
 */
const https = require('https');
require('dotenv').config();

const user = process.env.THESPORTS_API_USER || '';
const secret = process.env.THESPORTS_API_SECRET || '';

// Test with a live match ID (use a known live match)
const matchIds = [
  'k82rekhgxp2grep', // Tocantinopolis (we know this one is live)
  '8yomo4h1g51kq0j', // The ID provider returned
];

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'https://api.thesports.com');
    url.searchParams.set('user', user);
    url.searchParams.set('secret', secret);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}\nData: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function checkMinute() {
  console.log('\n🔍 Checking if provider sends minute in detail_live response...\n');
  
  for (const matchId of matchIds) {
    try {
      console.log(`\n=== Match ${matchId} ===`);
      const detailLive = await makeRequest(`/v1/football/match/detail_live?match_id=${matchId}`);
      
      if (detailLive.err) {
        console.log('Error:', detailLive.err);
        continue;
      }
      
      // Try to find the match in response
      let match = null;
      if (Array.isArray(detailLive.results)) {
        match = detailLive.results.find(m => 
          String(m.id || m.match_id) === matchId
        );
      } else if (detailLive.results && typeof detailLive.results === 'object') {
        match = detailLive.results;
      }
      
      if (!match) {
        console.log('Match not found in response');
        continue;
      }
      
      console.log('Match object keys:', Object.keys(match));
      console.log('Minute fields:');
      console.log('  minute:', match.minute, typeof match.minute);
      console.log('  match_minute:', match.match_minute, typeof match.match_minute);
      console.log('  match?.minute:', match.match?.minute, typeof match.match?.minute);
      console.log('  match?.match_minute:', match.match?.match_minute, typeof match.match?.match_minute);
      
      // Check score array format
      if (Array.isArray(match.score)) {
        console.log('Score array:', match.score);
        console.log('Score array length:', match.score.length);
      }
      
      // Show full match object structure (limited)
      console.log('\nFull match object (first level):');
      Object.keys(match).forEach(key => {
        if (typeof match[key] !== 'object' || match[key] === null) {
          console.log(`  ${key}:`, match[key]);
        } else if (Array.isArray(match[key])) {
          console.log(`  ${key}: [Array, length=${match[key].length}]`);
        } else {
          console.log(`  ${key}: [Object]`);
        }
      });
      
    } catch (error) {
      console.error(`Error checking ${matchId}:`, error.message);
    }
  }
}

checkMinute().catch(console.error);
