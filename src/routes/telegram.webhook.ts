/**
 * Telegram Webhook Route
 *
 * Receives updates from Telegram Bot API
 * Handles messages, commands, and callback queries
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleTelegramUpdate } from '../services/telegram/bot.handler';
import { logger } from '../utils/logger';
import crypto from 'crypto';

interface WebhookRequest {
  Body: any; // TelegramUpdate type from bot.handler
}

/**
 * Verify Telegram webhook request signature
 */
function verifyTelegramWebhook(token: string, body: any, signature: string | undefined): boolean {
  if (!signature) return false;

  const secretKey = crypto.createHash('sha256').update(token).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(JSON.stringify(body)).digest('hex');

  return signature === hash;
}

export async function telegramWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /webhook/telegram
   * Telegram webhook endpoint
   *
   * Security: Verifies Telegram signature (X-Telegram-Bot-Api-Secret-Token header)
   */
  fastify.post<WebhookRequest>(
    '/webhook/telegram',
    async (request: FastifyRequest<WebhookRequest>, reply: FastifyReply) => {
      const startTime = Date.now();
      const update = request.body;

      try {
        // Security: Verify webhook secret (optional but recommended)
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (webhookSecret) {
          const signature = request.headers['x-telegram-bot-api-secret-token'] as string | undefined;
          const token = process.env.TELEGRAM_BOT_TOKEN || '';

          if (!verifyTelegramWebhook(token, update, signature)) {
            logger.warn('[TelegramWebhook] Invalid signature', {
              update_id: update.update_id,
            });
            return reply.status(403).send({ error: 'Invalid signature' });
          }
        }

        logger.info('[TelegramWebhook] Update received', {
          update_id: update.update_id,
          has_message: !!update.message,
          has_callback_query: !!update.callback_query,
        });

        // Handle update async (don't block response)
        setImmediate(async () => {
          try {
            await handleTelegramUpdate(update);
          } catch (error: any) {
            logger.error('[TelegramWebhook] Error handling update:', {
              update_id: update.update_id,
              error: error.message,
              stack: error.stack,
            });
          }
        });

        // Respond immediately to Telegram (required within 5 seconds)
        return { ok: true };

      } catch (error: any) {
        const elapsedMs = Date.now() - startTime;
        logger.error('[TelegramWebhook] Error processing webhook:', {
          error: error.message,
          stack: error.stack,
          elapsed_ms: elapsedMs,
        });

        // Still return 200 to prevent Telegram retries on our errors
        return { ok: false, error: 'Internal error' };
      }
    }
  );

  /**
   * POST /webhook/telegram/set
   * Set Telegram webhook URL (admin endpoint)
   *
   * Usage:
   * POST /webhook/telegram/set
   * Body: { url: "https://api.goalgpt.com/webhook/telegram" }
   */
  fastify.post<{ Body: { url: string } }>(
    '/webhook/telegram/set',
    async (request, reply) => {
      const { url } = request.body;

      if (!url) {
        return reply.status(400).send({ error: 'URL required' });
      }

      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          return reply.status(500).send({ error: 'TELEGRAM_BOT_TOKEN not configured' });
        }

        // Set webhook via Telegram API
        const axios = require('axios');
        const response = await axios.post(
          `https://api.telegram.org/bot${token}/setWebhook`,
          {
            url,
            secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true,
          }
        );

        logger.info('[TelegramWebhook] Webhook set successfully', {
          url,
          response: response.data,
        });

        return {
          success: true,
          url,
          telegram_response: response.data,
        };

      } catch (error: any) {
        logger.error('[TelegramWebhook] Error setting webhook:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  /**
   * POST /webhook/telegram/delete
   * Delete Telegram webhook (switch to polling mode)
   */
  fastify.post('/webhook/telegram/delete', async (request, reply) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return reply.status(500).send({ error: 'TELEGRAM_BOT_TOKEN not configured' });
      }

      const axios = require('axios');
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/deleteWebhook`,
        {
          drop_pending_updates: true,
        }
      );

      logger.info('[TelegramWebhook] Webhook deleted', {
        response: response.data,
      });

      return {
        success: true,
        message: 'Webhook deleted, bot can now use polling mode',
        telegram_response: response.data,
      };

    } catch (error: any) {
      logger.error('[TelegramWebhook] Error deleting webhook:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /webhook/telegram/info
   * Get webhook info
   */
  fastify.get('/webhook/telegram/info', async (request, reply) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return reply.status(500).send({ error: 'TELEGRAM_BOT_TOKEN not configured' });
      }

      const axios = require('axios');
      const response = await axios.get(
        `https://api.telegram.org/bot${token}/getWebhookInfo`
      );

      return {
        success: true,
        webhook_info: response.data.result,
      };

    } catch (error: any) {
      logger.error('[TelegramWebhook] Error getting webhook info:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
