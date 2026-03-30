/**
 * Re-engagement Campaign Service
 *
 * Handles:
 * 1. User segment queries (inactive users by days / plan type)
 * 2. Email campaign trigger via Resend (HTML email broadcast)
 * 3. WhatsApp broadcast via Sent.dm (optional secondary channel)
 * 4. Campaign log persistence in email_campaign_logs table
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  sendBatchEmails,
  renderReengagementTemplate,
  ResendBatchResult,
} from './resend.service';

// ============================================================================
// TYPES
// ============================================================================

export type PlanFilter = 'all' | 'free' | 'vip_expired';
export type CampaignChannel = 'email' | 'whatsapp' | 'sms';
export type CampaignStatus = 'pending' | 'sent' | 'partial' | 'failed';

export interface SegmentParams {
  inactiveDays: number;
  planFilter: PlanFilter;
}

export interface SegmentUser {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  is_vip: boolean;
  days_inactive: number;
}

export interface CampaignPayload {
  campaignName: string;
  segmentParams: SegmentParams;
  channel: CampaignChannel;
  emailSubject?: string;        // for email channel
  discountCode?: string;
  adminUserId: string;
}

export interface CampaignResult {
  success: boolean;
  campaignLogId?: string;
  recipientCount: number;
  accepted: number;
  rejected: number;
  error?: string;
}

// ============================================================================
// SEGMENT QUERIES
// ============================================================================

/**
 * Count users matching the given segment (for preview, no full data load).
 */
export async function countUserSegment(params: SegmentParams): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - params.inactiveDays);

  let query = `
    SELECT COUNT(DISTINCT cu.id) AS cnt
    FROM customer_users cu
    LEFT JOIN customer_subscriptions cs
      ON cs.customer_user_id = cu.id AND cs.status = 'active'
    WHERE cu.is_active = true
      AND cu.deleted_at IS NULL
      AND (cu.updated_at < $1 OR cu.updated_at IS NULL)
  `;
  const values: unknown[] = [cutoffDate.toISOString()];

  if (params.planFilter === 'free') {
    query += ` AND cs.id IS NULL`;
  } else if (params.planFilter === 'vip_expired') {
    query += `
      AND cs.id IS NULL
      AND EXISTS (
        SELECT 1 FROM customer_subscriptions cs2
        WHERE cs2.customer_user_id = cu.id AND cs2.status = 'cancelled'
      )`;
  }

  const result = await pool.query<{ cnt: string }>(query, values);
  return parseInt(result.rows[0]?.cnt ?? '0', 10);
}

/**
 * Fetch all users matching the given segment.
 * For email channel: filters by users who have an email address.
 * For WhatsApp channel: filters by users who have a phone number.
 */
export async function getUserSegment(
  params: SegmentParams,
  channel: CampaignChannel = 'email'
): Promise<SegmentUser[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - params.inactiveDays);

  const contactFilter =
    channel === 'email' ? 'AND cu.email IS NOT NULL' : 'AND cu.phone IS NOT NULL';

  let query = `
    SELECT
      cu.id,
      cu.email,
      cu.phone,
      cu.full_name,
      CASE WHEN cs.id IS NOT NULL THEN true ELSE false END AS is_vip,
      COALESCE(EXTRACT(DAY FROM NOW() - cu.updated_at)::int, ${params.inactiveDays}) AS days_inactive
    FROM customer_users cu
    LEFT JOIN customer_subscriptions cs
      ON cs.customer_user_id = cu.id AND cs.status = 'active'
    WHERE cu.is_active = true
      AND cu.deleted_at IS NULL
      ${contactFilter}
      AND (cu.updated_at < $1 OR cu.updated_at IS NULL)
  `;
  const values: unknown[] = [cutoffDate.toISOString()];

  if (params.planFilter === 'free') {
    query += ` AND cs.id IS NULL`;
  } else if (params.planFilter === 'vip_expired') {
    query += `
      AND cs.id IS NULL
      AND EXISTS (
        SELECT 1 FROM customer_subscriptions cs2
        WHERE cs2.customer_user_id = cu.id AND cs2.status = 'cancelled'
      )`;
  }

  query += ` ORDER BY cu.updated_at ASC LIMIT 50000`;

  const result = await pool.query<SegmentUser>(query, values);
  return result.rows;
}

// ============================================================================
// CAMPAIGN TRIGGER
// ============================================================================

/**
 * Trigger a re-engagement email campaign via Resend.
 *
 * Flow:
 * 1. Query user segment (email addresses)
 * 2. Insert campaign log (status=pending)
 * 3. Render HTML template per user
 * 4. Send batch via Resend
 * 5. Update campaign log (sent/partial/failed)
 */
export async function triggerReengagementCampaign(
  payload: CampaignPayload
): Promise<CampaignResult> {
  if (payload.channel !== 'email') {
    return {
      success: false,
      recipientCount: 0,
      accepted: 0,
      rejected: 0,
      error: 'Only email channel is currently supported via this function. Use Sent.dm service for WhatsApp.',
    };
  }

  // 1. Get users
  const users = await getUserSegment(payload.segmentParams, 'email');

  if (users.length === 0) {
    logger.info('[Reengagement] No users in segment — aborting');
    return { success: false, recipientCount: 0, accepted: 0, rejected: 0, error: 'Empty segment' };
  }

  logger.info({ count: users.length }, '[Reengagement] Segment resolved');

  // 2. Insert campaign log (pending)
  const logResult = await pool.query<{ id: string }>(
    `INSERT INTO email_campaign_logs
      (campaign_name, channel, segment_params, recipient_count, status, created_by_admin_id)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id`,
    [
      payload.campaignName,
      payload.channel,
      JSON.stringify(payload.segmentParams),
      users.length,
      payload.adminUserId,
    ]
  );
  const logId = logResult.rows[0]?.id;

  // 3. Build batch email items
  const subject = payload.emailSubject ?? `GoalGPT — Seni Özledik 🤖 Geri Dön, %30 İndirim Kazan!`;
  const discountCode = payload.discountCode ?? 'GOBACK30';

  const batchItems = users.map((u) => {
    const firstName = u.full_name?.split(' ')[0] ?? 'Kullanıcı';
    const daysInactive = u.days_inactive ?? payload.segmentParams.inactiveDays;
    const html = renderReengagementTemplate({
      user_name: firstName,
      days_inactive: daysInactive,
      discount_code: discountCode,
      unsubscribe_url: `https://app.goalgpt.pro/unsubscribe?uid=${u.id}`,
    });
    return { to: u.email!, subject, html };
  });

  // 4. Send via Resend
  let batchResult: ResendBatchResult;
  try {
    batchResult = await sendBatchEmails(batchItems);
  } catch (err: any) {
    logger.error({ err, logId }, '[Reengagement] Batch send failed');
    if (logId) {
      await pool.query(
        `UPDATE email_campaign_logs SET status = 'failed', error_message = $1, sent_at = NOW() WHERE id = $2`,
        [err.message, logId]
      );
    }
    return {
      success: false,
      campaignLogId: logId,
      recipientCount: users.length,
      accepted: 0,
      rejected: users.length,
      error: err.message,
    };
  }

  // 5. Update campaign log
  const status: CampaignStatus =
    batchResult.accepted === users.length ? 'sent' :
    batchResult.accepted > 0 ? 'partial' : 'failed';

  if (logId) {
    await pool.query(
      `UPDATE email_campaign_logs
       SET status = $1, accepted_count = $2, rejected_count = $3, sent_at = NOW(),
           error_message = $4
       WHERE id = $5`,
      [
        status,
        batchResult.accepted,
        batchResult.rejected,
        batchResult.errors.length > 0 ? batchResult.errors.slice(0, 3).join('; ') : null,
        logId,
      ]
    );
  }

  logger.info({ logId, status, accepted: batchResult.accepted }, '[Reengagement] Campaign complete');

  return {
    success: status !== 'failed',
    campaignLogId: logId,
    recipientCount: users.length,
    accepted: batchResult.accepted,
    rejected: batchResult.rejected,
  };
}

// ============================================================================
// CAMPAIGN LOGS
// ============================================================================

export interface CampaignLog {
  id: string;
  campaign_name: string;
  channel: string;
  segment_params: SegmentParams;
  recipient_count: number;
  accepted_count: number | null;
  rejected_count: number | null;
  status: CampaignStatus;
  error_message: string | null;
  sent_at: string | null;
  created_by_admin_id: string;
  created_at: string;
}

export async function getCampaignLogs(limit = 20): Promise<CampaignLog[]> {
  const result = await pool.query<CampaignLog>(
    `SELECT * FROM email_campaign_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
