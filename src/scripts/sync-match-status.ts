/**
 * Emergency Match Status Sync Script
 * 
 * PROBLEM: 52 matches in DB are marked as "live" (status 2,3,4,5,7) but API shows them as finished
 * ROOT CAUSE: Watchdog couldn't update status due to Redis lock failures
 * 
 * This script:
 * 1. Fetches all live matches from API (/match/diary)
 * 2. Compares with DB live matches
 * 3. Updates orphan matches to status 8 (END)
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import axios from 'axios';

const API_USER = process.env.THESPORTS_USER || 'goalgpt';
const API_SECRET = process.env.THESPORTS_SECRET || '3205e4f6efe04a03f0055152c4aa0f37';
const API_BASE = 'https://api.thesports.com/v1/football';

interface APIMatch {
    id: string;
    status_id: number;
}

async function syncMatchStatuses(): Promise<void> {
    const client = await pool.connect();

    try {
        logger.info('[SyncScript] Starting match status sync...');

        // Step 1: Get all "live" matches from API
        const apiUrl = `${API_BASE}/match/diary?user=${API_USER}&secret=${API_SECRET}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiMatches: APIMatch[] = response.data?.results || [];

        // Build set of API live match IDs (status 2,3,4,5,7)
        const apiLiveMatchIds = new Set<string>();
        const apiMatchStatusMap = new Map<string, number>();

        for (const match of apiMatches) {
            apiMatchStatusMap.set(match.id, match.status_id);
            if ([2, 3, 4, 5, 7].includes(match.status_id)) {
                apiLiveMatchIds.add(match.id);
            }
        }

        logger.info(`[SyncScript] API reports ${apiLiveMatchIds.size} live matches`);

        // Step 2: Get all "live" matches from DB
        const dbResult = await client.query(`
      SELECT external_id, status_id, minute
      FROM ts_matches 
      WHERE status_id IN (2, 3, 4, 5, 7)
    `);

        const dbLiveMatches = dbResult.rows;
        logger.info(`[SyncScript] DB has ${dbLiveMatches.length} live matches`);

        // Step 3: Find orphan matches (in DB as live, but NOT live in API)
        const orphanMatches: { id: string; dbStatus: number; apiStatus: number | null }[] = [];

        for (const dbMatch of dbLiveMatches) {
            const matchId = dbMatch.external_id;

            // Check if this match is live in API
            if (!apiLiveMatchIds.has(matchId)) {
                // Match is NOT live in API - it's an orphan
                const apiStatus = apiMatchStatusMap.get(matchId) || null;
                orphanMatches.push({
                    id: matchId,
                    dbStatus: dbMatch.status_id,
                    apiStatus: apiStatus,
                });
            }
        }

        logger.info(`[SyncScript] Found ${orphanMatches.length} ORPHAN matches (live in DB, not live in API)`);

        if (orphanMatches.length === 0) {
            logger.info('[SyncScript] ✅ No orphan matches found. DB is in sync with API.');
            return;
        }

        // Step 4: Update orphan matches to correct status
        const nowTs = Math.floor(Date.now() / 1000);
        let updatedCount = 0;
        let skippedCount = 0;

        for (const orphan of orphanMatches) {
            // Determine target status
            let targetStatus: number;

            if (orphan.apiStatus !== null) {
                // Use API status if available
                targetStatus = orphan.apiStatus;
            } else {
                // Match not in today's diary - assume finished
                targetStatus = 8; // END
            }

            // Skip if status would not change
            if (targetStatus === orphan.dbStatus) {
                skippedCount++;
                continue;
            }

            // Update the match status
            await client.query(`
        UPDATE ts_matches 
        SET status_id = $1, 
            updated_at = NOW(),
            last_event_ts = $2
        WHERE external_id = $3
      `, [targetStatus, nowTs, orphan.id]);

            logger.info(`[SyncScript] Updated ${orphan.id}: ${orphan.dbStatus} → ${targetStatus}`);
            updatedCount++;
        }

        logger.info(`[SyncScript] ✅ COMPLETE: Updated ${updatedCount} matches, skipped ${skippedCount}`);

        // Step 5: Verify final count
        const finalResult = await client.query(`
      SELECT COUNT(*) as count FROM ts_matches WHERE status_id IN (2, 3, 4, 5, 7)
    `);

        logger.info(`[SyncScript] ✅ Final DB live match count: ${finalResult.rows[0].count}`);
        logger.info(`[SyncScript] ✅ API live match count: ${apiLiveMatchIds.size}`);

    } catch (error: any) {
        logger.error('[SyncScript] Error syncing match statuses:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run immediately
syncMatchStatuses()
    .then(() => {
        logger.info('[SyncScript] Script completed successfully');
        process.exit(0);
    })
    .catch((err) => {
        logger.error('[SyncScript] Script failed:', err);
        process.exit(1);
    });
