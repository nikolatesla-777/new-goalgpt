import dotenv from 'dotenv';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

dotenv.config();

const FOOTYSTATS_API_URL = 'http://localhost:3000/api/footystats';

interface StandingRow {
  id: number;
  name: string;
  position: number;
  points: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  form?: string;
  zone?: any;
  corrections?: number;
}

async function fetchFootyStatsStandings(competitionId: number): Promise<StandingRow[] | null> {
  try {
    const url = `${FOOTYSTATS_API_URL}/league-tables/${competitionId}`;
    const res = await fetch(url);

    if (!res.ok) {
      logger.warn(`[FootyStats Standings] HTTP ${res.status} for competition ${competitionId}`);
      return null;
    }

    const data = await res.json();

    if (!data.success || !data.league_table) {
      logger.warn(`[FootyStats Standings] No data for competition ${competitionId}`);
      return null;
    }

    return data.league_table;
  } catch (err: any) {
    logger.error(`[FootyStats Standings] Error fetching competition ${competitionId}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('FootyStats Standings Sync');
  console.log('='.repeat(60));

  // Get 50 enabled competitions from allowlist
  const compsResult = await pool.query(`
    SELECT competition_id, name, country
    FROM fs_competitions_allowlist
    WHERE is_enabled = TRUE
    ORDER BY competition_id;
  `);

  console.log(`Found ${compsResult.rows.length} enabled competitions`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;
  let totalTeams = 0;

  for (const comp of compsResult.rows) {
    console.log(`Processing: [${comp.competition_id}] ${comp.name} (${comp.country})...`);

    const standings = await fetchFootyStatsStandings(comp.competition_id);

    if (!standings || standings.length === 0) {
      console.log(`  ❌ No data`);
      failedCount++;
      continue;
    }

    console.log(`  ✅ ${standings.length} teams`);

    // Display top 3
    standings.slice(0, 3).forEach((team, idx) => {
      console.log(`    ${idx + 1}. ${team.name} - ${team.points} pts`);
    });

    successCount++;
    totalTeams += standings.length;

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Success: ${successCount}/${compsResult.rows.length}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Total teams: ${totalTeams}`);
  console.log('='.repeat(60));

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
