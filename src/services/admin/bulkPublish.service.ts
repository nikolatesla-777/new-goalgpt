/**
 * Phase-3B.2: Bulk Publish Service
 *
 * Publishes predictions to Telegram with:
 * 1. Re-check publish eligibility (no trust in client)
 * 2. DRY_RUN mode support (logs only, no actual publish)
 * 3. Full audit logging to admin_publish_logs
 * 4. Integration with Week-2B channelRouter
 */

import { getDb } from '../../database/connection';
import {
  BulkPublishRequest,
  BulkPublishResponse,
  BulkPublishResult,
  AdminPublishLog,
} from '../../types/bulkOperations.types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// INTERFACES
// ============================================================================

interface PublishEligibilityCheck {
  can_publish: boolean;
  reasons: string[];
  market_data: {
    confidence: number;
    probability: number;
    risk_flags: string[];
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function executeBulkPublish(
  request: BulkPublishRequest,
  requestMetadata: {
    request_id: string;
    ip_address?: string;
    user_agent?: string;
  }
): Promise<BulkPublishResponse> {
  const results: BulkPublishResult[] = [];
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  try {
    for (const pick of request.picks) {
      const pickResult = await processSinglePick(
        pick,
        request.admin_user_id,
        request.dry_run,
        requestMetadata
      );

      results.push(pickResult);

      // Update counters
      if (pickResult.status === 'sent') sentCount++;
      else if (pickResult.status === 'failed') failedCount++;
      else if (pickResult.status === 'skipped') skippedCount++;
    }

    return {
      success: true,
      data: {
        summary: {
          total: request.picks.length,
          sent: sentCount,
          failed: failedCount,
          skipped: skippedCount,
        },
        results,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to execute bulk publish',
    };
  }
}

// ============================================================================
// SINGLE PICK PROCESSING
// ============================================================================

async function processSinglePick(
  pick: BulkPublishRequest['picks'][0],
  adminUserId: string,
  dryRun: boolean,
  requestMetadata: {
    request_id: string;
    ip_address?: string;
    user_agent?: string;
  }
): Promise<BulkPublishResult> {
  const db = getDb();

  try {
    // Step 1: Re-check publish eligibility (NO TRUST IN CLIENT)
    const eligibility = await recheckPublishEligibility(
      pick.match_id,
      pick.market_id
    );

    if (!eligibility.can_publish) {
      // SKIP: Not eligible to publish
      await logPublishAttempt({
        admin_user_id: adminUserId,
        match_id: pick.match_id,
        market_id: pick.market_id,
        dry_run: dryRun,
        payload: { pick, eligibility },
        status: 'skipped',
        error_message: `Not eligible: ${eligibility.reasons.join(', ')}`,
        request_id: requestMetadata.request_id,
        ip_address: requestMetadata.ip_address,
        user_agent: requestMetadata.user_agent,
      });

      return {
        match_id: pick.match_id,
        market_id: pick.market_id,
        status: 'skipped',
        reason: `Not eligible: ${eligibility.reasons.join(', ')}`,
        dry_run: dryRun,
      };
    }

    // Step 2: DRY RUN mode - log success without publishing
    if (dryRun) {
      await logPublishAttempt({
        admin_user_id: adminUserId,
        match_id: pick.match_id,
        market_id: pick.market_id,
        dry_run: true,
        payload: { pick, eligibility },
        status: 'dry_run_success',
        request_id: requestMetadata.request_id,
        ip_address: requestMetadata.ip_address,
        user_agent: requestMetadata.user_agent,
      });

      return {
        match_id: pick.match_id,
        market_id: pick.market_id,
        status: 'sent',
        reason: 'DRY_RUN: Would have published',
        dry_run: true,
      };
    }

    // Step 3: Actual publish to Telegram
    const telegramResult = await publishToTelegram(pick, eligibility);

    if (!telegramResult.success) {
      // FAILED: Telegram publish failed
      await logPublishAttempt({
        admin_user_id: adminUserId,
        match_id: pick.match_id,
        market_id: pick.market_id,
        dry_run: false,
        payload: { pick, eligibility },
        status: 'failed',
        error_message: telegramResult.error,
        request_id: requestMetadata.request_id,
        ip_address: requestMetadata.ip_address,
        user_agent: requestMetadata.user_agent,
      });

      return {
        match_id: pick.match_id,
        market_id: pick.market_id,
        status: 'failed',
        error_message: telegramResult.error,
        dry_run: false,
      };
    }

    // SUCCESS: Published successfully
    await logPublishAttempt({
      admin_user_id: adminUserId,
      match_id: pick.match_id,
      market_id: pick.market_id,
      dry_run: false,
      payload: { pick, eligibility },
      status: 'sent',
      telegram_message_id: telegramResult.message_id,
      request_id: requestMetadata.request_id,
      ip_address: requestMetadata.ip_address,
      user_agent: requestMetadata.user_agent,
    });

    return {
      match_id: pick.match_id,
      market_id: pick.market_id,
      status: 'sent',
      telegram_message_id: telegramResult.message_id,
      dry_run: false,
    };
  } catch (error: any) {
    // Unexpected error
    await logPublishAttempt({
      admin_user_id: adminUserId,
      match_id: pick.match_id,
      market_id: pick.market_id,
      dry_run: dryRun,
      payload: { pick },
      status: 'failed',
      error_message: error.message,
      request_id: requestMetadata.request_id,
      ip_address: requestMetadata.ip_address,
      user_agent: requestMetadata.user_agent,
    });

    return {
      match_id: pick.match_id,
      market_id: pick.market_id,
      status: 'failed',
      error_message: error.message,
      dry_run: dryRun,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function recheckPublishEligibility(
  matchId: string,
  marketId: string
): Promise<PublishEligibilityCheck> {
  // TODO: Replace with actual Week-2A scoring endpoint call
  // For now, this is a stub that will be implemented when Week-2A is merged

  // In production, this would call:
  // const response = await fetch(`http://localhost:3000/api/matches/${matchId}/scoring`);
  // const data = await response.json();
  // const market = data.data.markets.find(m => m.market_id === marketId);
  // return {
  //   can_publish: market.can_publish,
  //   reasons: market.can_publish ? [] : [market.reason],
  //   market_data: {
  //     confidence: market.confidence,
  //     probability: market.probability,
  //     risk_flags: market.risk_flags,
  //   },
  // };

  // Stub implementation
  return {
    can_publish: false,
    reasons: [
      'Week-2A scoring endpoint not available yet (requires PR#5 merge)',
    ],
    market_data: {
      confidence: 0,
      probability: 0,
      risk_flags: ['ENDPOINT_NOT_AVAILABLE'],
    },
  };
}

async function publishToTelegram(
  pick: BulkPublishRequest['picks'][0],
  eligibility: PublishEligibilityCheck
): Promise<{ success: boolean; message_id?: number; error?: string }> {
  // TODO: Replace with actual Week-2B channelRouter integration
  // For now, this is a stub that will be implemented when Week-2B is merged

  // In production, this would:
  // 1. Get channel for market_id from channelRouter
  // 2. Format message using template
  // 3. Send to Telegram via telegram.client
  // 4. Return message_id

  // Stub implementation
  return {
    success: false,
    error: 'Week-2B channelRouter not available yet (requires PR#6 merge)',
  };
}

async function logPublishAttempt(
  log: Omit<AdminPublishLog, 'id' | 'created_at'>
): Promise<void> {
  const db = getDb();

  await db
    .insertInto('admin_publish_logs')
    .values({
      id: uuidv4(),
      admin_user_id: log.admin_user_id,
      match_id: log.match_id,
      market_id: log.market_id,
      dry_run: log.dry_run,
      payload: JSON.stringify(log.payload),
      status: log.status,
      telegram_message_id: log.telegram_message_id,
      error_message: log.error_message,
      request_id: log.request_id,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
    })
    .execute();
}
