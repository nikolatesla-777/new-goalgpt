/**
 * Migration: Add ts_team_aliases table for fuzzy team name matching
 * 
 * This allows mapping multiple team name variations (e.g., "Olympiacos", "Olympiakos") 
 * to the same team in ts_teams.
 */

import { pool } from '../connection';

export async function up(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create team aliases table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_team_aliases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_external_id VARCHAR(255) NOT NULL,
        alias VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(alias)
      );
    `);

        // Add index for fast alias lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_team_aliases_alias 
      ON ts_team_aliases(LOWER(alias));
    `);

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_team_aliases_team_id 
      ON ts_team_aliases(team_external_id);
    `);

        // Insert some common aliases
        await client.query(`
      INSERT INTO ts_team_aliases (team_external_id, alias) VALUES
        -- These will be populated based on actual team_external_ids
        -- Greek teams
        ('placeholder', 'Olympiacos'),
        ('placeholder', 'Olympiakos'),
        -- Turkish teams
        ('placeholder', 'GS'),
        ('placeholder', 'Galatasaray SK'),
        ('placeholder', 'FB'),
        ('placeholder', 'Fenerbahce SK'),
        ('placeholder', 'BJK'),
        ('placeholder', 'Besiktas JK')
      ON CONFLICT (alias) DO NOTHING;
    `);

        await client.query('COMMIT');
        console.log('✅ Created ts_team_aliases table');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function down(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DROP TABLE IF EXISTS ts_team_aliases CASCADE');
        await client.query('COMMIT');
        console.log('✅ Dropped ts_team_aliases table');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// CLI runner
if (require.main === module) {
    const action = process.argv[2];
    if (action === 'up') {
        up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    } else if (action === 'down') {
        down().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    } else {
        console.log('Usage: npx tsx add-team-aliases.ts [up|down]');
        process.exit(1);
    }
}
