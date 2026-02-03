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

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    }
  );
}

function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '📱 GoalGPT\'yi Aç',
          web_app: { url: 'https://partnergoalgpt.com/miniapp' }
        },
      ],
      [
        { text: '📊 Günlük Listeler', callback_data: 'menu_gunluk' },
        { text: '⚽️ Canlı Maçlar', callback_data: 'menu_canli' },
      ],
      [
        { text: '🤖 AI Analiz', callback_data: 'menu_analiz' },
        { text: '🎁 Kupon Hazırla', callback_data: 'menu_kupon' },
      ],
      [
        { text: '📈 Performans', callback_data: 'menu_performans' },
        { text: '⚙️ Ayarlar', callback_data: 'menu_ayarlar' },
      ],
    ],
  };
}

function getBackButton() {
  return {
    inline_keyboard: [
      [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }],
    ],
  };
}

async function handleCallbackQuery(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  logger.info('[Bot] Callback query', { chat_id: chatId, data });

  // Answer callback to remove loading state
  await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
    { callback_query_id: callbackQuery.id }
  );

  // Edit message based on callback
  if (data === 'menu_main') {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: '⚽️ *GoalGPT Ana Menü*\n\nNe yapmak istersiniz?',
        parse_mode: 'Markdown',
        reply_markup: getMainMenuKeyboard(),
      }
    );
  }
  else if (data === 'menu_gunluk') {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: '📊 *Günlük Tahmin Listeleri*\n\nAI destekli günlük tahmin listelerimiz hazırlanıyor...\n\nBu özellik çok yakında aktif olacak! 🎯',
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'menu_canli') {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: '⚽️ *Canlı Maçlar*\n\nCanlı maç skorları ve analizleri...\n\nBu özellik çok yakında aktif olacak! 📺',
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'menu_analiz') {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: '🤖 *AI Analiz*\n\nBir maç linki gönderin, AI analizi yapayım! 🔬',
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'menu_kupon') {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: '🎁 *Kupon Hazırla*\n\nAI destekli kupon önerisi yakında! 📝',
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'menu_performans') {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: '📈 *Performans Takibi*\n\nİstatistikleriniz:\n✅ Kazanılan: -\n❌ Kaybedilen: -\n📊 Başarı oranı: -%\n\nYakında detaylı istatistikler! 📊',
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'menu_ayarlar') {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: '⚙️ *Ayarlar*\n\nBildirim ayarlarınızı düzenleyin:\n\n🔔 Bildirimler: Açık\n⏰ Bildirim saati: 09:00\n\nYakında özelleştirilebilir! 🎯',
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
}

async function handleUpdate(update: any) {
  // Handle callback queries (button clicks)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

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
      `📋 Aşağıdaki menüden seçim yapabilirsiniz:`,
      getMainMenuKeyboard()
    );
  }
  else if (text === '/help' || text === '/yardim') {
    await sendMessage(
      chatId,
      `📖 *Yardım*\n\n` +
      `Aşağıdaki komutları kullanabilirsiniz:\n\n` +
      `🏠 /start - Başlangıç\n` +
      `📊 /gunluk - Günlük tahmin listeleri\n` +
      `⚽️ /canli - Canlı maçlar\n` +
      `🤖 /analizyap - AI analiz iste\n` +
      `🎁 /kupon - Kupon hazırla\n` +
      `📈 /performans - Performans takibi\n` +
      `📞 /iletisim - İletişim\n` +
      `📋 /kurallar - Kurallar\n` +
      `👤 /uyelik - Üyelik durumu\n` +
      `🚀 /uyeol - Prime üyelik\n\n` +
      `Daha fazla özellik çok yakında! 🚀`
    );
  }
  else if (text === '/gunluk') {
    await sendMessage(
      chatId,
      `📊 *Günlük Tahmin Listeleri*\n\n` +
      `AI destekli günlük tahmin listelerimiz hazırlanıyor...\n\n` +
      `Bu özellik çok yakında aktif olacak! 🎯`,
      getBackButton()
    );
  }
  else if (text === '/canli') {
    await sendMessage(
      chatId,
      `⚽️ *Canlı Maçlar*\n\n` +
      `Canlı maç skorları ve analizleri...\n\n` +
      `Bu özellik çok yakında aktif olacak! 📺`
    );
  }
  else if (text === '/analizyap') {
    await sendMessage(
      chatId,
      `🤖 *AI Analiz*\n\n` +
      `Analiz iste!\n\n` +
      `Bir maç linki gönderin, AI analizi yapayım! 🔬`
    );
  }
  else if (text === '/kupon' || text === '/kuponyap') {
    await sendMessage(
      chatId,
      `🎁 *Kupon Hazırla*\n\n` +
      `Kupon hazırlanıyor...\n\n` +
      `AI destekli kupon önerisi yakında! 📝`
    );
  }
  else if (text === '/performans') {
    await sendMessage(
      chatId,
      `📈 *Performans Takibi*\n\n` +
      `İstatistikleriniz:\n` +
      `✅ Kazanılan: -\n` +
      `❌ Kaybedilen: -\n` +
      `📊 Başarı oranı: -%\n\n` +
      `Yakında detaylı istatistikler! 📊`
    );
  }
  else if (text === '/iletisim') {
    await sendMessage(
      chatId,
      `📞 *İletişim*\n\n` +
      `Oynadım, Ne Oldu?\n\n` +
      `Sorularınız için: @goalgpt_destek\n` +
      `Web: goalgpt.com 🌐`
    );
  }
  else if (text === '/kurallar') {
    await sendMessage(
      chatId,
      `📋 *Kurallar*\n\n` +
      `Kurallara göz atın.\n\n` +
      `1. Sorumlu bahis oynayın\n` +
      `2. AI önerileri tavsiye niteliğindedir\n` +
      `3. Kendi analizinizi de yapın\n\n` +
      `Detaylı kurallar: goalgpt.com/kurallar 📜`
    );
  }
  else if (text === '/uyelik') {
    await sendMessage(
      chatId,
      `👤 *Üyelik Durumu*\n\n` +
      `Üyelik durumunuzu görüntüleyin.\n\n` +
      `📦 Paket: Ücretsiz\n` +
      `📅 Son kullanım: -\n\n` +
      `Prime'a geçmek için: /uyeol 🚀`
    );
  }
  else if (text === '/uyeol') {
    await sendMessage(
      chatId,
      `🚀 *Prime Üyelik*\n\n` +
      `Prime üyelik 🚀\n\n` +
      `✅ Sınırsız analiz\n` +
      `✅ VIP tahminler\n` +
      `✅ Öncelikli destek\n\n` +
      `Yakında aktif olacak! 💎`
    );
  }
  else if (text === '/hesapla') {
    await sendMessage(
      chatId,
      `🧮 *Hesapla*\n\n` +
      `Oynadım, Ne Oldu?\n\n` +
      `Kupon hesaplama özelliği yakında! 💰`
    );
  }
  else if (text === '/istatistik') {
    await sendMessage(
      chatId,
      `📊 *İstatistik Merkezi*\n\n` +
      `Detaylı istatistikler ve analizler...\n\n` +
      `Bu özellik çok yakında! 📈`
    );
  }
  else {
    await sendMessage(
      chatId,
      `Merhaba! Menüden bir komut seçin veya /help yazın. ⚽️`
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
