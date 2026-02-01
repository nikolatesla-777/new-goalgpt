import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

const THESPORTS_API_URL = 'https://api.thesports.com/v1/football';
const THESPORTS_USER = process.env.THESPORTS_API_USER || 'goalgpt';
const THESPORTS_SECRET = process.env.THESPORTS_API_SECRET || '3205e4f6efe04a03f0055152c4aa0f37';

interface StandingTeam {
  team_id: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

async function fetchLiveStandings(): Promise<any> {
  const url = new URL(`${THESPORTS_API_URL}/table/live`);
  url.searchParams.set('user', THESPORTS_USER);
  url.searchParams.set('secret', THESPORTS_SECRET);

  console.log('Fetching from:', url.toString().replace(THESPORTS_SECRET, '***'));

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.err) {
    throw new Error(`API Error: ${JSON.stringify(data)}`);
  }

  // Debug: Print first result to see structure
  console.log('');
  console.log('DEBUG - First Result Structure:');
  console.log(JSON.stringify(data.results?.[0], null, 2).slice(0, 2000));
  console.log('');

  return data;
}

async function main() {
  console.log('🔄 THESPORTS STANDINGS SYNC');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Fetch live standings from TheSports API
    console.log('📡 Fetching live standings from TheSports API...');
    const standingsData = await fetchLiveStandings();

    if (!standingsData.results || standingsData.results.length === 0) {
      console.log('❌ No standings data received');
      console.log('Response:', JSON.stringify(standingsData, null, 2));
      process.exit(1);
    }

    console.log(`✅ Received ${standingsData.results.length} league standings`);
    console.log('');

    // Debug: Show what leagues we actually got
    console.log('📋 LEAGUES IN RESPONSE:');
    console.log('='.repeat(80));
    standingsData.results.forEach((league: any, idx: number) => {
      const name = league.name || league.competition_name || 'Unknown';
      const compId = league.competition_id || 'N/A';
      const tableLength = (league.table || league.standings || []).length;
      console.log(`  ${idx + 1}. [${compId}] ${name} (${tableLength} teams)`);
    });
    console.log('');

    // 2. Find Süper Lig to verify Trabzonspor has 42 points
    const superLig = standingsData.results.find((league: any) =>
      league.competition_id === '8y39mp1h6jmojxg' ||
      league.name?.toLowerCase().includes('süper lig') ||
      league.name?.toLowerCase().includes('super lig')
    );

    if (superLig) {
      console.log('🇹🇷 SÜPER LİG STANDINGS:');
      console.log('='.repeat(80));
      console.log(`Competition: ${superLig.name || 'Süper Lig'}`);
      console.log(`Season: ${superLig.season_id || 'N/A'}`);
      console.log('');

      const standings = superLig.table || superLig.standings || [];

      // Get team names from database
      const teamIds = standings.map((t: any) => t.team_id);
      const teams = await pool.query(`
        SELECT external_id, name
        FROM ts_teams
        WHERE external_id = ANY($1::text[])
      `, [teamIds]);

      const teamMap: any = {};
      teams.rows.forEach(t => teamMap[t.external_id] = t.name);

      standings.forEach((team: any, idx: number) => {
        const teamName = teamMap[team.team_id] || 'Unknown';
        const isTrabzon = teamName.toLowerCase().includes('trabzon');
        const prefix = isTrabzon ? '👉' : '  ';

        console.log(`${prefix} ${team.position}. ${teamName} - ${team.points} pts (MP:${team.played} W:${team.won} D:${team.drawn} L:${team.lost} GD:${team.goal_diff})`);

        // Verify Trabzonspor
        if (isTrabzon && team.points !== 42) {
          console.log(`⚠️  WARNING: Trabzonspor points mismatch! Expected: 42, Got: ${team.points}`);
        } else if (isTrabzon && team.points === 42) {
          console.log(`✅ Trabzonspor points verified: 42`);
        }
      });

      console.log('');
    } else {
      console.log('⚠️  Süper Lig not found in response');
    }

    // 3. Get FootyStats 50 allowlisted competitions
    const allowlistResult = await pool.query(`
      SELECT competition_id, name, country
      FROM fs_competitions_allowlist
      WHERE is_enabled = TRUE
      ORDER BY name;
    `);

    console.log('='.repeat(80));
    console.log(`📋 MATCHING STANDINGS WITH 50 ALLOWLISTED LEAGUES:`);
    console.log('='.repeat(80));
    console.log('');

    let matchedCount = 0;
    let totalTeams = 0;

    for (const fsComp of allowlistResult.rows) {
      // Try to find matching TheSports standing
      const tsStanding = standingsData.results.find((league: any) => {
        if (!league.name) return false;

        const fsName = fsComp.name.toLowerCase().trim();
        const tsName = league.name.toLowerCase().trim();

        // Fuzzy match
        return tsName.includes(fsName) || fsName.includes(tsName) ||
               (fsName.includes('liga') && tsName.includes('liga')) ||
               (fsName.includes('league') && tsName.includes('league'));
      });

      if (tsStanding && (tsStanding.table?.length > 0 || tsStanding.standings?.length > 0)) {
        const standings = tsStanding.table || tsStanding.standings || [];
        matchedCount++;
        totalTeams += standings.length;

        console.log(`✅ [FS:${fsComp.competition_id}] ${fsComp.name} (${fsComp.country})`);
        console.log(`   TheSports: ${tsStanding.name}`);
        console.log(`   Teams: ${standings.length}`);
        console.log('');
      } else {
        console.log(`❌ [FS:${fsComp.competition_id}] ${fsComp.name} (${fsComp.country}) - NO STANDINGS`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('SUMMARY:');
    console.log(`  FootyStats Allowlist: ${allowlistResult.rows.length} leagues`);
    console.log(`  TheSports Standings: ${standingsData.results.length} leagues`);
    console.log(`  Matched: ${matchedCount}/${allowlistResult.rows.length}`);
    console.log(`  Total Teams: ${totalTeams}`);
    console.log('='.repeat(80));

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
