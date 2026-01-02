import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function dedupeTeamPlayers(teamId: string) {
    const dbClient = await pool.connect();

    try {
        logger.info(`Starting deduplication for team: ${teamId}`);

        // 1. Get all players for this team
        const res = await dbClient.query(
            'SELECT id, external_id, name, logo, market_value, updated_at FROM ts_players WHERE team_id = $1',
            [teamId]
        );

        const players = res.rows;
        logger.info(`Found ${players.length} total players for team ${teamId}`);

        // 2. Simple normalization helper
        const normalize = (name: string) => {
            return name
                .toLowerCase()
                .replace(/ı/g, 'i')
                .replace(/ğ/g, 'g')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ö/g, 'o')
                .replace(/ç/g, 'c')
                .replace(/[^a-z0-9]/g, '');
        };

        // Group by normalized name
        const grouped = new Map<string, any[]>();
        for (const player of players) {
            const key = normalize(player.name);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(player);
        }

        let totalDeleted = 0;

        // 3. Process each group
        for (const [normalizedName, pGroup] of grouped.entries()) {
            if (pGroup.length > 1) {
                // Sort to find the "best" record
                // Priority: 
                // 1. Market value (numeric)
                // 2. Has logo
                // 3. Most recently updated
                const sorted = [...pGroup].sort((a, b) => {
                    const valA = parseInt(a.market_value) || 0;
                    const valB = parseInt(b.market_value) || 0;
                    if (valB !== valA) return valB - valA;

                    const hasLogoA = a.logo ? 1 : 0;
                    const hasLogoB = b.logo ? 1 : 0;
                    if (hasLogoB !== hasLogoA) return hasLogoB - hasLogoA;

                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                });

                const master = sorted[0];
                const duplicates = sorted.slice(1);

                logger.info(`Duplicate group found for "${normalizedName}". Keeping ${master.name} (${master.external_id}). Deleting ${duplicates.length} records.`);

                for (const dupe of duplicates) {
                    await dbClient.query('DELETE FROM ts_players WHERE id = $1', [dupe.id]);
                    totalDeleted++;
                }
            }
        }

        logger.info(`Deduplication complete. Total deleted: ${totalDeleted}`);

    } catch (error: any) {
        logger.error('Deduplication failed:', error);
    } finally {
        dbClient.release();
    }
}

// Running for all teams in Turkish Super League
async function dedupeTSL() {
    const dbClient = await pool.connect();
    try {
        const competitionId = '8y39mp1h6jmojxg';
        const res = await dbClient.query(
            'SELECT external_id, name FROM ts_teams WHERE competition_id = $1',
            [competitionId]
        );

        logger.info(`Found ${res.rows.length} teams in TSL for deduplication`);

        for (const team of res.rows) {
            await dedupeTeamPlayers(team.external_id);
        }
    } finally {
        dbClient.release();
    }
}

dedupeTSL().then(() => {
    logger.info('TSL Dedupe finished');
    process.exit(0);
});
