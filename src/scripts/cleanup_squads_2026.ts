import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';

const TSL_COMPETITION_ID = '8y39mp1h6jmojxg';
const CURRENT_SEASON_ID = '4zp5rzgh8xvq82w'; // 2025-2026 Season ID for TSL

async function cleanupAndSync() {
    const client = new TheSportsClient();
    const dbClient = await pool.connect();

    try {
        // 1. Get TSL teams
        const teamsRes = await dbClient.query(
            'SELECT external_id, name FROM ts_teams WHERE competition_id = $1',
            [TSL_COMPETITION_ID]
        );
        const teamIds = new Set(teamsRes.rows.map(r => r.external_id));
        logger.info(`Cleaning up squads for ${teamIds.size} TSL teams...`);

        // 2. Fetch and sync current players
        let page = 1;
        let syncedCount = 0;
        const maxPages = 500; // Deep scan to capture stars like Baris Alper who are deep in the list

        while (page <= maxPages) {
            logger.info(`Fetching player page ${page}...`);
            const response = await client.get<any>('/player/with_stat/list', { page, limit: 500 });
            if (!response.results || response.results.length === 0) break;

            const tslPlayers = response.results.filter((p: any) => teamIds.has(p.team_id));

            for (const p of tslPlayers) {
                await dbClient.query(`
                    INSERT INTO ts_players (
                        id, external_id, name, short_name, logo, team_id, current_season_id, updated_at, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()
                    )
                    ON CONFLICT (external_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        team_id = EXCLUDED.team_id,
                        logo = EXCLUDED.logo,
                        current_season_id = EXCLUDED.current_season_id,
                        updated_at = NOW()
                `, [p.id, p.name, p.short_name || null, p.logo || null, p.team_id, CURRENT_SEASON_ID]);
                syncedCount++;
            }
            page++;
        }
        logger.info(`Synced ${syncedCount} players for 2025-2026 season.`);

        // 3. Delete players NOT in this season for TSL teams
        const deleteRes = await dbClient.query(`
            DELETE FROM ts_players 
            WHERE team_id IN (SELECT external_id FROM ts_teams WHERE competition_id = $1)
            AND (current_season_id IS NULL OR current_season_id != $2)
        `, [TSL_COMPETITION_ID, CURRENT_SEASON_ID]);

        logger.info(`Deleted ${deleteRes.rowCount} stale/old season players.`);

    } catch (e: any) {
        logger.error('Cleanup failed:', e);
    } finally {
        dbClient.release();
        process.exit(0);
    }
}

cleanupAndSync();
