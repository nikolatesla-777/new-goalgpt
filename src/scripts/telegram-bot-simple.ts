/**
 * Simple Telegram Bot Polling - MVP Version
 *
 * Minimal bot without dailyLists dependency
 * Just responds to /start and /help commands
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;
let isRunning = true;

async function sendMessage(chatId: number, text: string) {
  await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }
  );
}

async function handleUpdate(update: any) {
  if (!update.message?.text) return;

  const chatId = update.message.chat.id;
  const text = update.message.text;
  const firstName = update.message.from.first_name;

  logger.info('[Bot] Received message', { chat_id: chatId, text });

  if (text === '/start') {
    await sendMessage(
      chatId,
      `⚽️ Merhaba ${firstName}!\n\n` +
      `GoalGPT'e hoş geldiniz. AI destekli maç tahmin sistemi.\n\n` +
      `Komutlar:\n` +
      `/start - Başlangıç\n` +
      `/help - Yardım\n` +
      `/canli - Canlı maçlar (yakında)\n` +
      `/gunluk - Günlük listeler (yakında)`
    );
  } else if (text === '/help') {
    await sendMessage(
      chatId,
      `📖 *Yardım*\n\n` +
      `GoalGPT'yi kullanmak için aşağıdaki komutları kullanabilirsiniz:\n\n` +
      `/start - Başlangıç\n` +
      `/help - Bu yardım mesajı\n` +
      `/canli - Canlı maçlar (yakında)\n` +
      `/gunluk - Günlük tahmin listeleri (yakında)\n\n` +
      `Daha fazla özellik çok yakında! 🚀`
    );
  } else {
    await sendMessage(
      chatId,
      `Merhaba! /start veya /help yazarak başlayabilirsiniz.`
    );
  }
}

async function getUpdates() {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`,
      {
        params: {
          offset,
          timeout: 30,
        },
      }
    );

    if (response.data.ok) {
      return response.data.result;
    }
    return [];
  } catch (error: any) {
    logger.error('[Bot] Error getting updates:', error.message);
    return [];
  }
}

async function startPolling() {
  logger.info('[Bot] 🤖 Starting simple Telegram bot polling...');

  if (!BOT_TOKEN) {
    logger.error('[Bot] ❌ TELEGRAM_BOT_TOKEN not configured');
    process.exit(1);
  }

  // Get bot info
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    logger.info('[Bot] ✅ Bot connected:', response.data.result);
  } catch (error: any) {
    logger.error('[Bot] ❌ Failed to connect:', error.message);
    process.exit(1);
  }

  // Delete webhook
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`,
      { drop_pending_updates: false }
    );
    logger.info('[Bot] Webhook deleted');
  } catch (error: any) {
    logger.warn('[Bot] Failed to delete webhook:', error.message);
  }

  // Main loop
  while (isRunning) {
    try {
      const updates = await getUpdates();

      if (updates.length > 0) {
        logger.info(`[Bot] Received ${updates.length} updates`);
        for (const update of updates) {
          try {
            await handleUpdate(update);
            offset = update.update_id + 1;
          } catch (error: any) {
            logger.error('[Bot] Error handling update:', error);
          }
        }
      }
    } catch (error: any) {
      logger.error('[Bot] Error in polling loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('[Bot] Shutting down...');
  isRunning = false;
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  logger.info('[Bot] Shutting down...');
  isRunning = false;
  setTimeout(() => process.exit(0), 2000);
});

if (require.main === module) {
  startPolling().catch(error => {
    logger.error('[Bot] Fatal error:', error);
    process.exit(1);
  });
}

export { startPolling };
