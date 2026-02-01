import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

const THESPORTS_API_URL = 'https://api.thesports.com/v1/football';
const THESPORTS_USER = process.env.THESPORTS_API_USER || 'goalgpt';
const THESPORTS_SECRET = process.env.THESPORTS_API_SECRET || '3205e4f6efe04a03f0055152c4aa0f37';

async function fetchSeasonRecentStandings(): Promise<any> {
  const url = new URL(`${THESPORTS_API_URL}/season/recent/table/detail`);
  url.searchParams.set('user', THESPORTS_USER);
  url.searchParams.set('secret', THESPORTS_SECRET);

  console.log('Fetching from:', url.toString().replace(THESPORTS_SECRET, '***'));

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.err) {
    throw new Error(`API Error: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  console.log('🔄 THESPORTS SEASON RECENT STANDINGS');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Fetch standings from TheSports API
    console.log('📡 Fetching recent season standings...');
    const standingsData = await fetchSeasonRecentStandings();

    console.log('');
    console.log('DEBUG - Response Structure:');
    console.log(JSON.stringify(standingsData, null, 2).slice(0, 3000));
    console.log('');

    if (!standingsData.results || standingsData.results.length === 0) {
      console.log('❌ No standings data received');
      process.exit(1);
    }

    console.log(`✅ Received ${standingsData.results.length} season standings`);
    console.log('');

    // 2. Get FootyStats 50 allowlisted competitions
    const allowlistResult = await pool.query(`
      SELECT competition_id, name, country
      FROM fs_competitions_allowlist
      WHERE is_enabled = TRUE
      ORDER BY name;
    `);

    console.log('='.repeat(80));
    console.log(`📋 FOOTYSTATS 50 ALLOWLISTED COMPETITIONS:`);
    console.log('='.repeat(80));
    allowlistResult.rows.forEach((comp: any) => {
      console.log(`  [${comp.competition_id}] ${comp.name} (${comp.country})`);
    });
    console.log('');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

main();
