/**
 * Phase-3B.4: Daily Auto-Preview Job
 *
 * Runs daily at a scheduled time to generate DRY_RUN preview reports.
 * Helps admins review candidate picks before manual approval.
 *
 * Schedule: Daily at 08:00 UTC
 */

import { jobRunner } from './jobRunner';
import { generateBulkPreview } from '../services/admin/bulkPreview.service';
import { BulkPreviewRequest } from '../types/bulkOperations.types';
import logger from '../utils/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_FILTERS = {
  min_confidence: parseInt(process.env.AUTO_PREVIEW_MIN_CONFIDENCE || '60', 10),
  min_probability: parseFloat(process.env.AUTO_PREVIEW_MIN_PROBABILITY || '0.60'),
  max_risk_flags: parseInt(process.env.AUTO_PREVIEW_MAX_RISK_FLAGS || '2', 10),
  max_per_league: parseInt(process.env.AUTO_PREVIEW_MAX_PER_LEAGUE || '2', 10),
  time_spread_minutes: parseInt(process.env.AUTO_PREVIEW_TIME_SPREAD_MINUTES || '90', 10),
};

const LIMIT_PER_MARKET = parseInt(process.env.AUTO_PREVIEW_LIMIT_PER_MARKET || '5', 10);
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

export async function runDailyAutoPreview(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'dailyAutoPreview',
      overlapGuard: true,
      advisoryLockKey: 920000000100n,
      timeoutMs: 300000, // 5 minutes
    },
    async (ctx) => {
      ctx.logger.info('[DailyAutoPreview] Starting daily preview generation...');

      try {
        // Calculate date range (next 24 hours)
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const request: BulkPreviewRequest = {
          date_from: now.toISOString(),
          date_to: tomorrow.toISOString(),
          markets: MARKETS,
          filters: DEFAULT_FILTERS,
          limit_per_market: LIMIT_PER_MARKET,
          locale: 'tr',
        };

        ctx.logger.info(
          `[DailyAutoPreview] Generating preview for ${request.date_from} to ${request.date_to}`
        );

        // Generate bulk preview
        const result = await generateBulkPreview(request);

        if (!result.success) {
          throw new Error(result.error || 'Failed to generate preview');
        }

        // Log summary
        const totalCandidates = result.data?.markets.reduce(
          (sum, m) => sum + m.total_candidates,
          0
        ) || 0;
        const totalSelected = result.data?.markets.reduce(
          (sum, m) => sum + m.total_selected,
          0
        ) || 0;

        ctx.logger.info(
          `[DailyAutoPreview] Preview complete: ${totalSelected}/${totalCandidates} picks selected across ${MARKETS.length} markets`
        );

        // Log market breakdown
        for (const market of result.data?.markets || []) {
          ctx.logger.info(
            `[DailyAutoPreview] ${market.market_id}: ${market.total_selected}/${market.total_candidates} picks`
          );

          // Log top picks for each market
          for (const pick of market.picks) {
            ctx.logger.info(
              `  - ${pick.home_team} vs ${pick.away_team} (${pick.league}) | Confidence: ${pick.confidence}/100 | Probability: ${(pick.probability * 100).toFixed(1)}%`
            );
          }
        }

        ctx.logger.info(
          '[DailyAutoPreview] Daily preview report generated successfully (DRY_RUN mode)'
        );

        // TODO: Optionally send preview report via email/Telegram to admins
        // await sendPreviewReport(result.data);
      } catch (error: any) {
        ctx.logger.error(
          `[DailyAutoPreview] Failed to generate preview: ${error.message}`
        );
        throw error;
      }
    }
  );
}
