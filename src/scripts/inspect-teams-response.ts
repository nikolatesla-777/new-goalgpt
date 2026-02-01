// src/scripts/inspect-teams-response.ts
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) throw new Error("FOOTYSTATS_API_KEY missing");

  const url = new URL("https://api.football-data-api.com/league-season");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("season_id", "14972");

  console.log('Fetching from:', url.toString().replace(apiKey, 'API_KEY'));
  console.log('');

  const res = await fetch(url.toString());
  const data = await res.json();

  console.log('Response root keys:', Object.keys(data));
  console.log('');

  if (data.data) {
    console.log('data keys:', Object.keys(data.data));
    console.log('');

    // Check for teams in different locations
    if (data.data.teams) {
      console.log('✅ data.teams found:', Array.isArray(data.data.teams) ? `${data.data.teams.length} teams` : typeof data.data.teams);
      if (Array.isArray(data.data.teams) && data.data.teams.length > 0) {
        console.log('First team keys:', Object.keys(data.data.teams[0]).slice(0, 30));
      }
    } else {
      console.log('❌ data.teams not found');
    }

    // Check other possible locations
    if (data.teams) {
      console.log('✅ teams (root level):', Array.isArray(data.teams) ? `${data.teams.length} teams` : typeof data.teams);
    }

    // Print data structure sample
    console.log('');
    console.log('data structure (first 100 chars of stringified):');
    console.log(JSON.stringify(data.data).substring(0, 500));
  }

  process.exit(0);
}

main();
