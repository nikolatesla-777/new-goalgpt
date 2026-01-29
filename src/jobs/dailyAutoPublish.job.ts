/**
 * Phase-3B.4: Daily Auto-Publish Job
 *
 * Runs daily at a scheduled time to automatically publish predictions.
 * FEATURE-FLAGGED: Only runs if AUTO_PUBLISH_ENABLED=true
 * KILL SWITCH: MAX_PUBLISH_PER_RUN prevents runaway publishing
 *
 * Schedule: Daily at 09:00 UTC (1 hour after auto-preview)
 */

import { jobRunner } from './jobRunner';
import { generateBulkPreview } from '../services/admin/bulkPreview.service';
import { executeBulkPublish } from '../services/admin/bulkPublish.service';
import {
  BulkPreviewRequest,
  BulkPublishRequest,
} from '../types/bulkOperations.types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// FEATURE FLAGS & CONFIGURATION
// ============================================================================

const AUTO_PUBLISH_ENABLED = process.env.AUTO_PUBLISH_ENABLED === 'true';
const MAX_PUBLISH_PER_RUN = parseInt(process.env.MAX_PUBLISH_PER_RUN || '20', 10);
const DRY_RUN_MODE = process.env.AUTO_PUBLISH_DRY_RUN === 'true';

const DEFAULT_FILTERS = {
  min_confidence: parseInt(process.env.AUTO_PUBLISH_MIN_CONFIDENCE || '65', 10),
  min_probability: parseFloat(process.env.AUTO_PUBLISH_MIN_PROBABILITY || '0.65'),
  max_risk_flags: parseInt(process.env.AUTO_PUBLISH_MAX_RISK_FLAGS || '1', 10),
  max_per_league: parseInt(process.env.AUTO_PUBLISH_MAX_PER_LEAGUE || '1', 10),
  time_spread_minutes: parseInt(process.env.AUTO_PUBLISH_TIME_SPREAD_MINUTES || '120', 10),
};

const LIMIT_PER_MARKET = parseInt(process.env.AUTO_PUBLISH_LIMIT_PER_MARKET || '3', 10);
const MARKETS: BulkPreviewRequest['markets'] = [
  'O25',
  'BTTS',
  'HT_O05',
  'O35',
  'HOME_O15',
  'CORNERS_O85',
  'CARDS_O25',
];

// ============================================================================
// JOB FUNCTION
// ============================================================================

export async function runDailyAutoPublish(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'dailyAutoPublish',
      overlapGuard: true,
      advisoryLockKey: 920000000200n,
      timeoutMs: 600000, // 10 minutes
    },
    async (ctx) => {
      // Check feature flag
      if (!AUTO_PUBLISH_ENABLED) {
        ctx.logger.info(
          '[DailyAutoPublish] Auto-publish disabled (AUTO_PUBLISH_ENABLED=false). Skipping.'
        );
        return;
      }

      ctx.logger.info(
        `[DailyAutoPublish] Starting daily auto-publish (DRY_RUN=${DRY_RUN_MODE})...`
      );

      try {
        // Step 1: Generate bulk preview
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const previewRequest: BulkPreviewRequest = {
          date_from: now.toISOString(),
          date_to: tomorrow.toISOString(),
          markets: MARKETS,
          filters: DEFAULT_FILTERS,
          limit_per_market: LIMIT_PER_MARKET,
          locale: 'tr',
        };

        ctx.logger.info(
          `[DailyAutoPublish] Generating preview for ${previewRequest.date_from} to ${previewRequest.date_to}`
        );

        const previewResult = await generateBulkPreview(previewRequest);

        if (!previewResult.success) {
          throw new Error(previewResult.error || 'Failed to generate preview');
        }

        // Step 2: Collect all picks across markets
        const allPicks: BulkPublishRequest['picks'] = [];

        for (const market of previewResult.data?.markets || []) {
          for (const pick of market.picks) {
            allPicks.push({
              match_id: pick.match_id,
              market_id: market.market_id,
              locale: 'tr',
              template_version: 'v1',
            });
          }
        }

        ctx.logger.info(`[DailyAutoPublish] Found ${allPicks.length} candidate picks`);

        // Step 3: Apply kill switch (MAX_PUBLISH_PER_RUN)
        if (allPicks.length > MAX_PUBLISH_PER_RUN) {
          ctx.logger.warn(
            `[DailyAutoPublish] KILL SWITCH: ${allPicks.length} picks exceeds limit of ${MAX_PUBLISH_PER_RUN}. Truncating.`
          );
          allPicks.splice(MAX_PUBLISH_PER_RUN);
        }

        if (allPicks.length === 0) {
          ctx.logger.info('[DailyAutoPublish] No picks to publish. Exiting.');
          return;
        }

        // Step 4: Execute bulk publish
        const publishRequest: BulkPublishRequest = {
          admin_user_id: 'auto-publish-job',
          dry_run: DRY_RUN_MODE,
          picks: allPicks,
        };

        const requestMetadata = {
          request_id: uuidv4(),
          ip_address: '127.0.0.1',
          user_agent: 'DailyAutoPublish/1.0',
        };

        ctx.logger.info(
          `[DailyAutoPublish] Publishing ${allPicks.length} picks (DRY_RUN=${DRY_RUN_MODE})...`
        );

        const publishResult = await executeBulkPublish(publishRequest, requestMetadata);

        if (!publishResult.success) {
          throw new Error(publishResult.error || 'Failed to execute bulk publish');
        }

        // Step 5: Log summary
        const summary = publishResult.data?.summary;
        ctx.logger.info(
          `[DailyAutoPublish] Publish complete: ${summary?.sent} sent, ${summary?.failed} failed, ${summary?.skipped} skipped (total: ${summary?.total})`
        );

        // Log failed/skipped picks
        for (const result of publishResult.data?.results || []) {
          if (result.status !== 'sent') {
            ctx.logger.warn(
              `[DailyAutoPublish] ${result.status.toUpperCase()}: ${result.match_id} - ${result.market_id} | Reason: ${result.reason || result.error_message}`
            );
          }
        }

        ctx.logger.info('[DailyAutoPublish] Daily auto-publish completed successfully');
      } catch (error: any) {
        ctx.logger.error(
          `[DailyAutoPublish] Failed to execute auto-publish: ${error.message}`
        );
        throw error;
      }
    }
  );
}
