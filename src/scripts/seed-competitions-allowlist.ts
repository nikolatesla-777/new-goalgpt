// src/scripts/seed-competitions-allowlist.ts
import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

/**
 * 50 Competitions from FootyStats Hobi Package
 *
 * NOTE: Replace these with your actual Hobi package competition IDs
 * This is a sample list of popular European leagues
 */
const HOBI_COMPETITIONS = [
  // Tier 1: Top 5 European Leagues
  { id: 2, name: 'Premier League', country: 'England' },
  { id: 3, name: 'Championship', country: 'England' },
  { id: 4, name: 'League One', country: 'England' },
  { id: 5, name: 'League Two', country: 'England' },
  { id: 7, name: 'La Liga', country: 'Spain' },
  { id: 8, name: 'Segunda División', country: 'Spain' },
  { id: 9, name: 'Serie A', country: 'Italy' },
  { id: 10, name: 'Serie B', country: 'Italy' },
  { id: 11, name: 'Bundesliga', country: 'Germany' },
  { id: 12, name: '2. Bundesliga', country: 'Germany' },
  { id: 13, name: 'Ligue 1', country: 'France' },
  { id: 14, name: 'Ligue 2', country: 'France' },

  // Tier 2: Other Major European Leagues
  { id: 17, name: 'Eredivisie', country: 'Netherlands' },
  { id: 18, name: 'Eerste Divisie', country: 'Netherlands' },
  { id: 20, name: 'Primeira Liga', country: 'Portugal' },
  { id: 22, name: 'Belgian Pro League', country: 'Belgium' },
  { id: 23, name: 'Scottish Premiership', country: 'Scotland' },
  { id: 24, name: 'Championship (Scottish)', country: 'Scotland' },
  { id: 25, name: 'Russian Premier League', country: 'Russia' },
  { id: 26, name: 'Ukrainian Premier League', country: 'Ukraine' },
  { id: 27, name: 'Greek Super League', country: 'Greece' },
  { id: 28, name: 'Austrian Bundesliga', country: 'Austria' },
  { id: 29, name: 'Swiss Super League', country: 'Switzerland' },
  { id: 30, name: 'Danish Superliga', country: 'Denmark' },
  { id: 31, name: 'Norwegian Eliteserien', country: 'Norway' },
  { id: 32, name: 'Swedish Allsvenskan', country: 'Sweden' },
  { id: 14972, name: 'Süper Lig', country: 'Turkey' },
  { id: 14973, name: '1. Lig', country: 'Turkey' },

  // Tier 3: South America + Others
  { id: 41, name: 'Brasileirão Série A', country: 'Brazil' },
  { id: 42, name: 'Brasileirão Série B', country: 'Brazil' },
  { id: 43, name: 'Argentine Primera División', country: 'Argentina' },
  { id: 44, name: 'Chilean Primera División', country: 'Chile' },
  { id: 45, name: 'Colombian Primera A', country: 'Colombia' },
  { id: 46, name: 'Mexican Liga MX', country: 'Mexico' },
  { id: 47, name: 'MLS', country: 'USA' },
  { id: 48, name: 'J1 League', country: 'Japan' },
  { id: 49, name: 'K League 1', country: 'South Korea' },
  { id: 50, name: 'Chinese Super League', country: 'China' },

  // Tier 4: Eastern Europe + Others
  { id: 51, name: 'Polish Ekstraklasa', country: 'Poland' },
  { id: 52, name: 'Czech First League', country: 'Czech Republic' },
  { id: 53, name: 'Romanian Liga I', country: 'Romania' },
  { id: 54, name: 'Croatian First League', country: 'Croatia' },
  { id: 55, name: 'Serbian SuperLiga', country: 'Serbia' },
  { id: 56, name: 'Hungarian NB I', country: 'Hungary' },
  { id: 57, name: 'Bulgarian First League', country: 'Bulgaria' },
  { id: 58, name: 'Cypriot First Division', country: 'Cyprus' },
  { id: 59, name: 'Israeli Premier League', country: 'Israel' },
  { id: 60, name: 'South African Premier Division', country: 'South Africa' },
  { id: 61, name: 'Australian A-League', country: 'Australia' },
  { id: 62, name: 'Saudi Pro League', country: 'Saudi Arabia' },
];

async function main() {
  console.log('='.repeat(80));
  console.log('FootyStats Competitions Allowlist - Seed Script');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test connection
    console.log('[1/4] Testing database connection...');
    const connTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connTest.rows[0].now);
    console.log('');

    // Verify table exists
    console.log('[2/4] Verifying fs_competitions_allowlist table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'fs_competitions_allowlist'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table fs_competitions_allowlist does not exist!');
      console.log('   Run migration first: database/migrations/fs_competitions_allowlist_schema.sql');
      process.exit(1);
    }
    console.log('✅ Table exists');
    console.log('');

    // Seed allowlist
    console.log('[3/4] Seeding 50 competitions to allowlist...');
    console.log(`   Total competitions to insert: ${HOBI_COMPETITIONS.length}`);

    let inserted = 0;
    let updated = 0;

    for (const comp of HOBI_COMPETITIONS) {
      const result = await pool.query(
        `
        INSERT INTO fs_competitions_allowlist (
          competition_id,
          name,
          country,
          is_enabled,
          notes
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (competition_id) DO UPDATE SET
          name = EXCLUDED.name,
          country = EXCLUDED.country,
          updated_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `,
        [
          comp.id,
          comp.name,
          comp.country,
          true,
          'FootyStats Hobi Package 2025/2026',
        ]
      );

      if (result.rows[0].is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    console.log('✅ Seed completed:');
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Updated: ${updated}`);
    console.log('');

    // Verification
    console.log('[4/4] Verifying seeded data...');
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled,
        COUNT(CASE WHEN is_enabled = false THEN 1 END) as disabled,
        COUNT(DISTINCT country) as unique_countries
      FROM fs_competitions_allowlist
    `);

    const stats = verifyResult.rows[0];
    console.log(`✅ Allowlist Statistics:`);
    console.log(`   Total competitions: ${stats.total}`);
    console.log(`   Enabled: ${stats.enabled}`);
    console.log(`   Disabled: ${stats.disabled}`);
    console.log(`   Countries: ${stats.unique_countries}`);
    console.log('');

    // Show sample (first 10)
    console.log('Sample (first 10 competitions):');
    const sampleResult = await pool.query(`
      SELECT competition_id, name, country, is_enabled
      FROM fs_competitions_allowlist
      ORDER BY competition_id
      LIMIT 10
    `);

    sampleResult.rows.forEach((row, idx) => {
      const status = row.is_enabled ? '✅' : '❌';
      console.log(`  ${idx + 1}. ${status} [${row.competition_id}] ${row.name} (${row.country})`);
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Seed completed successfully!');
    console.log('='.repeat(80));
    console.log('');
    console.log('⚠️  IMPORTANT:');
    console.log('   1. Verify these are YOUR FootyStats Hobi package competitions');
    console.log('   2. Update competition_ids if needed in: src/scripts/seed-competitions-allowlist.ts');
    console.log('   3. Run Teams Catalog Sync: npm run sync:teams-catalog');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ Seed failed:', error.message);
    console.error('='.repeat(80));
    console.error(error.stack);
    process.exit(1);
  }
}

main();
