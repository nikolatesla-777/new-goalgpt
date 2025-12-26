/**
 * Manual Finalization Script
 * 
 * Finalizes the stuck match Al Sailiya SC Reserves vs Al Wakrah U23
 * (ID: k82rekhg085yrep) to END status (8).
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function finalizeStuckMatch() {
    const matchId = 'k82rekhg085yrep';

    try {
        logger.info(`Finalizing stuck match ${matchId}...`);

        const client = await pool.connect();
        try {
            // Check current state
            const checkResult = await client.query(
                'SELECT status_id, minute, home_score_regular, away_score_regular FROM ts_matches WHERE external_id = $1',
                [matchId]
            );

            if (checkResult.rows.length === 0) {
                logger.error(`Match ${matchId} not found in database!`);
                return;
            }

            const match = checkResult.rows[0];
            logger.info(`Current state: Status=${match.status_id}, Minute=${match.minute}, Score=${match.home_score_regular}-${match.away_score_regular}`);

            if (match.status_id === 8) {
                logger.warn(`Match ${matchId} is already in END status.`);
                return;
            }

            // Update to END status (8)
            const updateResult = await client.query(
                `UPDATE ts_matches 
         SET status_id = 8, 
             updated_at = NOW(),
             last_event_ts = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE external_id = $1`,
                [matchId]
            );

            if (updateResult.rowCount && updateResult.rowCount > 0) {
                logger.info(`✅ Successfully finalized match ${matchId} to END status`);
            } else {
                logger.error(`Failed to update match ${matchId}`);
            }
        } finally {
            client.release();
        }

        process.exit(0);
    } catch (error) {
        logger.error(`Error finalizing match ${matchId}:`, error);
        process.exit(1);
    }
}

finalizeStuckMatch();
