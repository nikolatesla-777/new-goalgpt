/**
 * Resend Email Service
 *
 * Resend (resend.com) is a developer-first email API.
 * This service wraps the Resend REST API for sending re-engagement
 * HTML emails to GoalGPT users.
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 * SDK:  npm install resend
 */

import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIG
// ============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'GoalGPT <noreply@goalgpt.pro>';
const RESEND_API_URL = 'https://api.resend.com';

if (!RESEND_API_KEY) {
  logger.warn('[Resend] RESEND_API_KEY not configured — email sending will be disabled');
}

// ============================================================================
// TYPES
// ============================================================================

export interface ResendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface ResendBatchItem {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface ResendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ResendBatchResult {
  success: boolean;
  accepted: number;
  rejected: number;
  errors: string[];
}

// ============================================================================
// TEMPLATE LOADER
// ============================================================================

// Cache template in memory after first load
let _templateCache: string | null = null;

/**
 * Load and cache the re-engagement HTML template.
 * Looks for the file at project root or Downloads/GoalGPT/
 */
export function loadReengagementTemplate(): string {
  if (_templateCache) return _templateCache;

  const candidates = [
    path.resolve(__dirname, '../../../../goalgpt-reengagement.html'),
    path.resolve(process.cwd(), 'goalgpt-reengagement.html'),
    path.resolve(process.env.HOME || '', 'Downloads/GoalGPT/goalgpt-reengagement.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      _templateCache = fs.readFileSync(candidate, 'utf8');
      logger.info({ path: candidate }, '[Resend] Template loaded');
      return _templateCache;
    }
  }

  throw new Error('[Resend] goalgpt-reengagement.html template not found');
}

/**
 * Render the re-engagement template with user-specific variables.
 */
export function renderReengagementTemplate(vars: {
  user_name: string;
  days_inactive: string | number;
  discount_code: string;
  unsubscribe_url: string;
}): string {
  let html = loadReengagementTemplate();
  html = html.replace(/\{\{user_name\}\}/g, vars.user_name);
  html = html.replace(/\{\{days_inactive\}\}/g, String(vars.days_inactive));
  html = html.replace(/\{\{discount_code\}\}/g, vars.discount_code);
  html = html.replace(/\{\{unsubscribe_url\}\}/g, vars.unsubscribe_url);
  return html;
}

// ============================================================================
// SEND SINGLE EMAIL
// ============================================================================

export async function sendEmail(payload: ResendEmailPayload): Promise<ResendResult> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch(`${RESEND_API_URL}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from ?? RESEND_FROM_EMAIL,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo,
        tags: payload.tags,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      logger.error({ status: res.status, body: errText }, '[Resend] sendEmail failed');
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json() as { id: string };
    return { success: true, messageId: data.id };
  } catch (err: any) {
    logger.error({ err }, '[Resend] sendEmail exception');
    return { success: false, error: err.message };
  }
}

// ============================================================================
// BATCH SEND (chunked, respects Resend rate limits)
// ============================================================================

/**
 * Send emails to multiple recipients in batches.
 * Resend supports up to 100 emails per batch request.
 * We serialize batches sequentially to avoid hitting rate limits.
 */
export async function sendBatchEmails(
  items: ResendBatchItem[]
): Promise<ResendBatchResult> {
  if (!RESEND_API_KEY) {
    return { success: false, accepted: 0, rejected: items.length, errors: ['API key not configured'] };
  }

  const CHUNK_SIZE = 100;
  let accepted = 0;
  let rejected = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);

    try {
      const res = await fetch(`${RESEND_API_URL}/emails/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          chunk.map((item) => ({
            from: item.from ?? RESEND_FROM_EMAIL,
            to: [item.to],
            subject: item.subject,
            html: item.html,
          }))
        ),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        logger.error({ status: res.status, chunk: i }, '[Resend] batch chunk failed');
        errors.push(`Chunk ${i}: HTTP ${res.status} - ${errText}`);
        rejected += chunk.length;
        continue;
      }

      const data = await res.json() as { data: Array<{ id: string }> };
      const successCount = data.data?.length ?? chunk.length;
      accepted += successCount;
      rejected += chunk.length - successCount;
    } catch (err: any) {
      logger.error({ err, chunk: i }, '[Resend] batch exception');
      errors.push(`Chunk ${i}: ${err.message}`);
      rejected += chunk.length;
    }

    // Small delay between chunks to respect rate limits
    if (i + CHUNK_SIZE < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  logger.info({ accepted, rejected }, '[Resend] Batch send complete');
  return { success: accepted > 0, accepted, rejected, errors };
}

/**
 * Health check — validate API key works
 */
export async function healthCheck(): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch(`${RESEND_API_URL}/domains`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
