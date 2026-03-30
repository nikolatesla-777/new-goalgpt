/**
 * Email Campaign Routes
 *
 * Admin-only endpoints for managing re-engagement email campaigns.
 * Integrated with Resend (email) and Sent.dm (WhatsApp — optional).
 *
 * All routes require X-Admin-Api-Key header (same as existing admin routes).
 *
 * Endpoints:
 *   GET  /api/admin/email/segment-preview   — count users in segment
 *   POST /api/admin/email/send-campaign     — trigger campaign
 *   GET  /api/admin/email/campaign-logs     — past campaigns
 *   GET  /api/admin/email/health            — check Resend connectivity
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  countUserSegment,
  triggerReengagementCampaign,
  getCampaignLogs,
  SegmentParams,
  CampaignChannel,
} from '../services/email/reengagement.service';
import { healthCheck as resendHealthCheck } from '../services/email/resend.service';

// ============================================================================
// AUTH MIDDLEWARE (same API key as existing admin routes)
// ============================================================================

function requireAdminKey(req: FastifyRequest, reply: FastifyReply): void {
  const key = req.headers['x-admin-api-key'];
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || key !== expected) {
    reply.status(401).send({ error: 'Unauthorized — invalid admin API key' });
  }
}

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export default async function emailRoutes(app: FastifyInstance): Promise<void> {
  // Apply admin key check to all routes in this plugin
  app.addHook('preHandler', (req, reply, done) => {
    requireAdminKey(req, reply);
    done();
  });

  // ────────────────────────────────────────────────────────────
  // GET /segment-preview
  // Returns count of users matching the given segment filters.
  // ────────────────────────────────────────────────────────────
  app.get<{
    Querystring: {
      inactiveDays?: string;
      planFilter?: string;
    };
  }>('/segment-preview', async (req, reply) => {
    const inactiveDays = parseInt(req.query.inactiveDays ?? '14', 10);
    const planFilter = (req.query.planFilter ?? 'all') as SegmentParams['planFilter'];

    if (isNaN(inactiveDays) || inactiveDays < 1 || inactiveDays > 365) {
      return reply.status(400).send({ error: 'inactiveDays must be between 1 and 365' });
    }
    if (!['all', 'free', 'vip_expired'].includes(planFilter)) {
      return reply.status(400).send({ error: 'planFilter must be all | free | vip_expired' });
    }

    try {
      const count = await countUserSegment({ inactiveDays, planFilter });
      return reply.send({ success: true, data: { count, inactiveDays, planFilter } });
    } catch (err: any) {
      req.log.error({ err }, 'segment-preview failed');
      return reply.status(500).send({ error: 'Failed to count segment', detail: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────
  // POST /send-campaign
  // Triggers a re-engagement email campaign for a user segment.
  // ────────────────────────────────────────────────────────────
  app.post<{
    Body: {
      campaignName: string;
      inactiveDays: number;
      planFilter: 'all' | 'free' | 'vip_expired';
      channel?: CampaignChannel;
      emailSubject?: string;
      discountCode?: string;
      adminUserId: string;
      templateId?: string;
    };
  }>('/send-campaign', async (req, reply) => {
    const {
      campaignName,
      inactiveDays,
      planFilter = 'all',
      channel = 'email',
      emailSubject,
      discountCode,
      adminUserId,
      templateId,
    } = req.body;

    // Validate required fields
    if (!campaignName || typeof campaignName !== 'string') {
      return reply.status(400).send({ error: 'campaignName is required' });
    }
    if (!adminUserId || typeof adminUserId !== 'string') {
      return reply.status(400).send({ error: 'adminUserId is required' });
    }
    if (!inactiveDays || isNaN(Number(inactiveDays)) || Number(inactiveDays) < 1) {
      return reply.status(400).send({ error: 'inactiveDays must be a positive number' });
    }
    if (!['all', 'free', 'vip_expired'].includes(planFilter)) {
      return reply.status(400).send({ error: 'planFilter must be all | free | vip_expired' });
    }

    try {
      const result = await triggerReengagementCampaign({
        campaignName,
        segmentParams: { inactiveDays: Number(inactiveDays), planFilter },
        channel,
        emailSubject,
        discountCode,
        adminUserId,
        templateId,
      });

      const statusCode = result.success ? 200 : result.recipientCount === 0 ? 422 : 500;
      return reply.status(statusCode).send({ success: result.success, data: result });
    } catch (err: any) {
      req.log.error({ err }, 'send-campaign failed');
      return reply.status(500).send({ error: 'Campaign failed', detail: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────
  // GET /campaign-logs
  // Returns the last N campaigns with their status.
  // ────────────────────────────────────────────────────────────
  app.get<{ Querystring: { limit?: string } }>('/campaign-logs', async (req, reply) => {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);

    try {
      const logs = await getCampaignLogs(limit);
      return reply.send({ success: true, data: logs });
    } catch (err: any) {
      req.log.error({ err }, 'campaign-logs fetch failed');
      return reply.status(500).send({ error: 'Failed to fetch logs', detail: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────
  // GET /health
  // Checks Resend API connectivity.
  // ────────────────────────────────────────────────────────────
  app.get('/health', async (_req, reply) => {
    const resendOk = await resendHealthCheck();
    return reply.send({
      success: true,
      data: {
        resend: resendOk ? 'ok' : 'error',
        resend_key_configured: !!process.env.RESEND_API_KEY,
      },
    });
  });
}
