"use strict";
/**
 * Dead Token Cleanup Job
 *
 * Schedule: Weekly Sunday at 03:00 (3 AM)
 * Purpose: Remove expired/invalid FCM tokens from database
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDeadTokenCleanup = runDeadTokenCleanup;
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
const kysely_2 = require("kysely");
async function runDeadTokenCleanup() {
    const jobName = 'Dead Token Cleanup';
    const startTime = Date.now();
    let processedCount = 0;
    let logId = null;
    try {
        // Log job start
        const logResult = await kysely_1.db
            .insertInto('job_execution_logs')
            .values({
            job_name: jobName,
            started_at: (0, kysely_2.sql) `NOW()`,
            status: 'running',
        })
            .returning('id')
            .executeTakeFirst();
        logId = logResult?.id || null;
        // Cutoff date: 90 days ago
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        logger_1.logger.info(`Cleaning up tokens not used since ${cutoffDate.toISOString()}`);
        // Delete tokens that:
        // 1. Haven't been updated in 90 days (not used)
        // 2. OR marked as inactive (failed sends)
        const deletedTokens = await kysely_1.db
            .deleteFrom('customer_push_tokens')
            .where((eb) => eb.or([
            eb('updated_at', '<', cutoffDate),
            eb('is_active', '=', false),
        ]))
            .executeTakeFirst();
        processedCount = Number(deletedTokens.numDeletedRows || 0);
        // Log statistics
        const totalRemainingTokens = await kysely_1.db
            .selectFrom('customer_push_tokens')
            .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
            .executeTakeFirst();
        const activeTokens = await kysely_1.db
            .selectFrom('customer_push_tokens')
            .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
            .where('is_active', '=', true)
            .executeTakeFirst();
        logger_1.logger.info(`Token cleanup stats:`);
        logger_1.logger.info(`  - Deleted: ${processedCount} tokens`);
        logger_1.logger.info(`  - Remaining: ${totalRemainingTokens?.count || 0} total`);
        logger_1.logger.info(`  - Active: ${activeTokens?.count || 0} tokens`);
        // Log job success
        const duration = Date.now() - startTime;
        if (logId) {
            await kysely_1.db
                .updateTable('job_execution_logs')
                .set({
                completed_at: (0, kysely_2.sql) `NOW()`,
                status: 'success',
                items_processed: processedCount,
                duration_ms: duration,
            })
                .where('id', '=', logId)
                .execute();
        }
        logger_1.logger.info(`${jobName}: Deleted ${processedCount} token(s) in ${duration}ms`);
    }
    catch (error) {
        // Log job failure
        const duration = Date.now() - startTime;
        if (logId) {
            await kysely_1.db
                .updateTable('job_execution_logs')
                .set({
                completed_at: (0, kysely_2.sql) `NOW()`,
                status: 'failed',
                items_processed: processedCount,
                error_message: error.message,
                duration_ms: duration,
            })
                .where('id', '=', logId)
                .execute();
        }
        logger_1.logger.error(`${jobName} failed:`, error);
        throw error;
    }
}
