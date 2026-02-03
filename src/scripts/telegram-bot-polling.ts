/**
 * Telegram Bot Polling Mode
 *
 * Alternative to webhook - polls Telegram API for updates
 * Use for development or when webhook is not available
 *
 * Usage: npm run bot:polling
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import axios from 'axios';
import { handleTelegramUpdate } from '../services/telegram/bot.handler';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const POLL_TIMEOUT = 30; // Long polling timeout (seconds)
const POLL_INTERVAL = 1000; // Interval between polls (ms)

let offset = 0; // Update ID offset for polling
let isRunning = true;

/**
 * Get updates from Telegram API
 */
async function getUpdates(): Promise<any[]> {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`,
      {
        params: {
          offset,
          timeout: POLL_TIMEOUT,
          allowed_updates: JSON.stringify(['message', 'callback_query']),
        },
      }
    );

    if (response.data.ok) {
      return response.data.result;
    }

    logger.error('[BotPolling] Telegram API error:', response.data);
    return [];
  } catch (error: any) {
    logger.error('[BotPolling] Error getting updates:', {
      error: error.message,
      code: error.code,
    });
    return [];
  }
}

/**
 * Process updates
 */
async function processUpdates(updates: any[]) {
  for (const update of updates) {
    try {
      logger.info('[BotPolling] Processing update:', {
        update_id: update.update_id,
        has_message: !!update.message,
        has_callback_query: !!update.callback_query,
      });

      await handleTelegramUpdate(update);

      // Update offset to mark this update as processed
      offset = update.update_id + 1;

    } catch (error: any) {
      logger.error('[BotPolling] Error processing update:', {
        update_id: update.update_id,
        error: error.message,
        stack: error.stack,
      });
    }
  }
}

/**
 * Main polling loop
 */
async function startPolling() {
  logger.info('[BotPolling] 🤖 Starting Telegram Bot polling...');

  if (!BOT_TOKEN) {
    logger.error('[BotPolling] ❌ TELEGRAM_BOT_TOKEN not configured');
    process.exit(1);
  }

  // Get bot info
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    const botInfo = response.data.result;
    logger.info('[BotPolling] ✅ Bot connected:', {
      username: botInfo.username,
      first_name: botInfo.first_name,
      id: botInfo.id,
    });
  } catch (error: any) {
    logger.error('[BotPolling] ❌ Failed to connect to bot:', error.message);
    process.exit(1);
  }

  // Delete webhook if exists (can't use polling with webhook)
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`,
      {
        drop_pending_updates: false,
      }
    );
    logger.info('[BotPolling] Webhook deleted (switching to polling mode)');
  } catch (error: any) {
    logger.warn('[BotPolling] Failed to delete webhook:', error.message);
  }

  // Main loop
  while (isRunning) {
    try {
      const updates = await getUpdates();

      if (updates.length > 0) {
        logger.info(`[BotPolling] Received ${updates.length} updates`);
        await processUpdates(updates);
      }

      // Small delay between polls (only if not using long polling timeout)
      if (POLL_TIMEOUT === 0) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }

    } catch (error: any) {
      logger.error('[BotPolling] Error in polling loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s on error
    }
  }

  logger.info('[BotPolling] Polling stopped');
}

/**
 * Graceful shutdown
 */
function setupShutdownHandlers() {
  const shutdown = (signal: string) => {
    logger.info(`[BotPolling] Received ${signal}, shutting down gracefully...`);
    isRunning = false;

    // Give time for current update to finish
    setTimeout(() => {
      logger.info('[BotPolling] Shutdown complete');
      process.exit(0);
    }, 2000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  setupShutdownHandlers();
  startPolling().catch(error => {
    logger.error('[BotPolling] Fatal error:', error);
    process.exit(1);
  });
}

export { startPolling };
