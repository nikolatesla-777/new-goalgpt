/**
 * Sent.dm Integration Service
 *
 * Sent.dm is a multi-channel messaging API (WhatsApp, SMS, RCS).
 * This service wraps the Sent.dm REST API for sending re-engagement
 * broadcast messages to GoalGPT users.
 *
 * Docs: https://docs.sent.dm
 * SDK:  npm install @sentdm/sentdm
 */

import { logger } from '../../utils/logger';

// ============================================================================
// CONFIG
// ============================================================================

const SENTDM_API_URL = process.env.SENTDM_API_URL || 'https://api.sent.dm';
const SENTDM_API_KEY = process.env.SENTDM_API_KEY || '';

if (!SENTDM_API_KEY) {
  logger.warn('[SentDm] SENTDM_API_KEY not configured — messaging will be disabled');
}

// ============================================================================
// TYPES
// ============================================================================

export type SentDmChannel = 'whatsapp' | 'sms' | 'rcs';

export interface SentDmContact {
  phone: string;       // E.164 format: +905XXXXXXXXX
  name?: string;
  customFields?: Record<string, string>;
}

export interface SentDmMessagePayload {
  to: string;          // E.164 phone number
  templateId?: string;
  templateName?: string;
  channel: SentDmChannel;
  parameters?: Record<string, string>;
}

export interface SentDmBroadcastPayload {
  name: string;
  channel: SentDmChannel;
  templateId?: string;
  templateName?: string;
  recipients: Array<{
    phone: string;
    parameters?: Record<string, string>;
  }>;
}

export interface SentDmResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SentDmBroadcastResult {
  success: boolean;
  broadcastId?: string;
  accepted: number;
  rejected: number;
  error?: string;
}

// ============================================================================
// INTERNAL FETCH HELPER
// ============================================================================

async function sentdmFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T> {
  const url = `${SENTDM_API_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'x-api-key': SENTDM_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`SentDm API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Send a single message via Sent.dm
 */
export async function sendMessage(payload: SentDmMessagePayload): Promise<SentDmResult> {
  if (!SENTDM_API_KEY) {
    logger.warn('[SentDm] API key not set — skipping sendMessage');
    return { success: false, error: 'API key not configured' };
  }

  try {
    const body: Record<string, unknown> = {
      to: payload.to,
      channel: payload.channel,
    };

    if (payload.templateId) body.template = { id: payload.templateId, parameters: payload.parameters };
    else if (payload.templateName) body.template = { name: payload.templateName, parameters: payload.parameters };

    const result = await sentdmFetch<{ success: boolean; data?: { id: string } }>(
      '/v3/messages',
      'POST',
      body
    );

    return {
      success: result.success,
      messageId: result.data?.id,
    };
  } catch (err: any) {
    logger.error({ err }, '[SentDm] sendMessage failed');
    return { success: false, error: err.message };
  }
}

/**
 * Send broadcast messages to multiple recipients in batch.
 * Uses chunked sending to avoid rate limits (100 per request).
 */
export async function sendBroadcast(payload: SentDmBroadcastPayload): Promise<SentDmBroadcastResult> {
  if (!SENTDM_API_KEY) {
    logger.warn('[SentDm] API key not set — skipping sendBroadcast');
    return { success: false, error: 'API key not configured', accepted: 0, rejected: 0 };
  }

  const CHUNK_SIZE = 100;
  let accepted = 0;
  let rejected = 0;
  let lastBroadcastId: string | undefined;

  // Split into chunks of 100
  for (let i = 0; i < payload.recipients.length; i += CHUNK_SIZE) {
    const chunk = payload.recipients.slice(i, i + CHUNK_SIZE);

    try {
      const body: Record<string, unknown> = {
        name: `${payload.name} (batch ${Math.floor(i / CHUNK_SIZE) + 1})`,
        channel: payload.channel,
        recipients: chunk.map((r) => ({
          to: r.phone,
          template: {
            ...(payload.templateId ? { id: payload.templateId } : {}),
            ...(payload.templateName ? { name: payload.templateName } : {}),
            parameters: r.parameters ?? {},
          },
        })),
      };

      const result = await sentdmFetch<{
        success: boolean;
        data?: { id: string; accepted: number; rejected: number };
      }>('/v3/broadcasts', 'POST', body);

      if (result.success && result.data) {
        accepted += result.data.accepted ?? chunk.length;
        rejected += result.data.rejected ?? 0;
        lastBroadcastId = result.data.id;
      } else {
        rejected += chunk.length;
      }
    } catch (err: any) {
      logger.error({ err, chunk: i }, '[SentDm] sendBroadcast chunk failed');
      rejected += chunk.length;
    }
  }

  logger.info(
    { accepted, rejected, broadcastId: lastBroadcastId },
    '[SentDm] Broadcast complete'
  );

  return {
    success: accepted > 0,
    broadcastId: lastBroadcastId,
    accepted,
    rejected,
  };
}

/**
 * Add or update a contact in Sent.dm
 */
export async function upsertContact(contact: SentDmContact): Promise<boolean> {
  if (!SENTDM_API_KEY) return false;

  try {
    await sentdmFetch('/v3/contacts', 'POST', {
      phone: contact.phone,
      name: contact.name,
      custom_fields: contact.customFields,
    });
    return true;
  } catch (err: any) {
    logger.warn({ err, phone: contact.phone }, '[SentDm] upsertContact failed');
    return false;
  }
}

/**
 * Validate Sent.dm connectivity (health check)
 */
export async function healthCheck(): Promise<boolean> {
  if (!SENTDM_API_KEY) return false;
  try {
    await sentdmFetch('/v3/contacts?limit=1', 'GET');
    return true;
  } catch {
    return false;
  }
}
