import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';

async function syncTurkishSuperLeagueSquads() {
    const client = new TheSportsClient();
    const dbClient = await pool.connect();

    try {
        // 1. Get all teams in Turkish Super League
        const competitionId = '8y39mp1h6jmojxg';
        const teamsRes = await dbClient.query(
            'SELECT external_id, name FROM ts_teams WHERE competition_id = $1',
            [competitionId]
        );

        const teamIds = new Set(teamsRes.rows.map(r => r.external_id));
        logger.info(`Found ${teamIds.size} teams in Turkish Super League`);

        // 2. Fetch players from API and filter by these team IDs
        // Since /team/player/list is not authorized, we use /player/with_stat/list
        // We'll scan pages until we have enough data or hit a limit
        let page = 1;
        let totalSynced = 0;
        const maxPages = 50; // Scan first 50 pages (approx 25000 players) which should cover most active leagues

        while (page <= maxPages) {
            logger.info(`Fetching player page ${page}...`);
            const response = await client.get<any>('/player/with_stat/list', { page, limit: 500 });

            if (!response.results || response.results.length === 0) break;

            const playersToUpdate = response.results.filter((p: any) => teamIds.has(p.team_id));

            if (playersToUpdate.length > 0) {
                logger.info(`Found ${playersToUpdate.length} TSL players on page ${page}. Updating...`);

                for (const player of playersToUpdate) {
                    await dbClient.query(`
            INSERT INTO ts_players (
              id, external_id, name, short_name, logo, team_id, position, age, birthday, height, weight, updated_at, created_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
            )
            ON CONFLICT (external_id) DO UPDATE SET
              name = EXCLUDED.name,
              short_name = EXCLUDED.short_name,
              logo = EXCLUDED.logo,
              team_id = EXCLUDED.team_id,
              position = EXCLUDED.position,
              age = EXCLUDED.age,
              birthday = EXCLUDED.birthday,
              height = EXCLUDED.height,
              weight = EXCLUDED.weight,
              updated_at = NOW()
          `, [
                        player.id,
                        player.name,
                        player.short_name || null,
                        player.logo || null,
                        player.team_id,
                        player.position || null,
                        player.age || null,
                        player.birthday || null,
                        player.height || null,
                        player.weight || null
                    ]);
                    totalSynced++;
                }
            }

            page++;
        }

        logger.info(`Synchronization complete. Total TSL players updated/inserted: ${totalSynced}`);

    } catch (error: any) {
        logger.error('Sync failed:', error);
    } finally {
        dbClient.release();
        process.exit(0);
    }
}

syncTurkishSuperLeagueSquads();
