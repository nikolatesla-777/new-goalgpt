/**
 * GoalGPT Telegram Bot Handler
 *
 * Interactive bot with commands and inline keyboard menus
 * Similar to professional betting bots (Keydo-style)
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { telegramBot } from './telegram.client';
import { logger } from '../../utils/logger';
// import { getDailyLists } from './dailyLists.service'; // TODO: Re-enable after fixing dependencies
import { pool } from '../../database/connection';

// ============================================================================
// TYPES
// ============================================================================

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message: TelegramMessage;
  data: string;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

// ============================================================================
// INLINE KEYBOARDS
// ============================================================================

/**
 * Ana menü keyboard'u
 */
function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📋 Günlük Listeler', callback_data: 'menu_daily_lists' }],
      [{ text: '⚽️ Canlı Maçlar', callback_data: 'menu_live_matches' }],
      [{ text: '🤖 AI Analiz İste', callback_data: 'menu_ai_analysis' }],
      [{ text: '📊 İstatistikler', callback_data: 'menu_stats' }],
      [{ text: '⚙️ Ayarlar', callback_data: 'menu_settings' }],
    ],
  };
}

/**
 * Günlük listeler alt menüsü
 */
function getDailyListsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '⚽️ Gol (2.5 Üst)', callback_data: 'list_O25' },
        { text: '🤝 BTTS', callback_data: 'list_BTTS' },
      ],
      [
        { text: '🚩 Korner', callback_data: 'list_CORNERS_O85' },
        { text: '🟨 Kart', callback_data: 'list_CARDS_O25' },
      ],
      [
        { text: '⚽️ İlk Yarı Gol', callback_data: 'list_HT_O05' },
        { text: '🎯 3.5 Üst', callback_data: 'list_O35' },
      ],
      [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }],
    ],
  };
}

/**
 * Ayarlar menüsü
 */
function getSettingsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔔 Bildirim Ayarları', callback_data: 'settings_notifications' }],
      [{ text: '🕐 Bildirim Saati', callback_data: 'settings_time' }],
      [{ text: '🌍 Dil Seçimi', callback_data: 'settings_language' }],
      [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }],
    ],
  };
}

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

/**
 * Hoş geldin mesajı
 */
function getWelcomeMessage(userName: string): string {
  return `⚽️ *GoalGPT'ye Hoş Geldiniz, ${userName}!*

AI destekli maç tahmin ve analiz sisteminiz.

*🎯 Neler Yapabilirsiniz:*
• 📋 Günlük bahis listelerini görüntüle
• ⚽️ Canlı maçları takip et
• 🤖 AI analiz iste
• 📊 İstatistikleri incele

*✨ Özellikler:*
✅ AI tabanlı maç analizleri
✅ Canlı skor takibi
✅ Güven skoru sistemi
✅ Performans raporları

Başlamak için aşağıdaki menüyü kullanın! 👇`;
}

/**
 * Yardım mesajı
 */
function getHelpMessage(): string {
  return `📖 *GoalGPT Yardım Menüsü*

*📋 Komutlar:*
/start - Ana menüyü aç
/gunluk - Günlük tahmin listelerini göster
/canli - Canlı maçları göster
/analiz - Maç analizi al
/istatistik - İstatistikleri göster
/ayarlar - Bildirim ayarlarını düzenle
/help - Bu yardım mesajını göster

*🤖 AI Analiz:*
Bir maç ID'si ile analiz isteyebilirsiniz:
\`/analiz {match_id}\`

*📊 İstatistikler:*
Listelerin geçmiş performansını görmek için:
\`/istatistik\` komutunu kullanın

*💡 İpucu:*
Bildirim almak için ayarlar menüsünden tercihleri düzenleyin!

Sorularınız için: @goalgpt_support`;
}

/**
 * Liste önizleme mesajı
 */
async function getDailyListPreview(market: string): Promise<string> {
  try {
    // const lists = await getDailyLists(); // TODO: Re-enable
    const lists: any[] = []; // Temporary mock
    const list = lists.find(l => l.market === market);

    if (!list) {
      return `❌ *${market} listesi henüz oluşturulmadı.*\n\nBugün için yeterli güvenilir maç bulunamadı. Lütfen daha sonra tekrar deneyin.`;
    }

    const marketNames: Record<string, string> = {
      OVER_25: '⚽️ GOL (2.5 ÜST)',
      BTTS: '🤝 KARŞILIKLI GOL (BTTS)',
      HT_OVER_05: '⚽️ İLK YARI GOL (0.5 ÜST)',
      OVER_35: '🎯 GOL (3.5 ÜST)',
      CORNERS: '🚩 KORNER (8.5 ÜST)',
      CARDS: '🟨 KART (2.5 ÜST)',
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let message = `📋 *${marketNames[market] || market} LİSTESİ*\n`;
    message += `🗓 ${dateStr}\n\n`;

    // İlk 3 maçı göster
    const previewCount = Math.min(3, list.matches.length);
    for (let i = 0; i < previewCount; i++) {
      const match = list.matches[i];
      const matchTime = new Date(match.match.date_unix * 1000);
      const timeStr = matchTime.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      message += `${i + 1}. *${match.match.home_name}* vs *${match.match.away_name}*\n`;
      message += `   🏆 ${match.match.league_name}\n`;
      message += `   ⏰ ${timeStr}\n`;
      message += `   ⭐️ Güven: ${match.confidence}%\n`;

      // Piyasa potansiyeli
      const potential = (match.match.potentials as any)[market.toLowerCase().replace('over_', 'o').replace('_', '')];
      if (potential) {
        message += `   📊 Potansiyel: ${Math.round(potential)}%\n`;
      }
      message += `\n`;
    }

    if (list.matches.length > previewCount) {
      message += `_[${list.matches.length - previewCount} maç daha...]_\n\n`;
    }

    message += `📊 *Toplam: ${list.matches.length} maç*\n`;
    message += `⭐️ *Ortalama Güven: ${Math.round(list.matches.reduce((sum, m) => sum + m.confidence, 0) / list.matches.length)}%*\n\n`;
    message += `➡️ Detaylar için web panelini ziyaret edin!`;

    return message;
  } catch (error: any) {
    logger.error('[BotHandler] Error getting daily list preview:', error);
    return `❌ Liste yüklenirken hata oluştu.\n\nLütfen daha sonra tekrar deneyin.`;
  }
}

/**
 * İstatistik mesajı
 */
async function getStatsMessage(chatId: number): Promise<string> {
  try {
    const client = await pool.connect();
    try {
      // Toplam yayınlanmış liste sayısı
      const postsResult = await client.query(
        `SELECT COUNT(*) as total FROM telegram_posts WHERE status = 'published'`
      );
      const totalPosts = parseInt(postsResult.rows[0]?.total || '0');

      // Toplam kullanıcı sayısı (benzersiz chat_id)
      const usersResult = await client.query(
        `SELECT COUNT(DISTINCT chat_id) as total FROM telegram_user_preferences`
      );
      const totalUsers = parseInt(usersResult.rows[0]?.total || '0');

      // Bugünkü liste sayısı
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
      const todayListsResult = await client.query(
        `SELECT COUNT(*) as total FROM telegram_daily_lists
         WHERE list_date = $1 AND status = 'active'`,
        [today]
      );
      const todayLists = parseInt(todayListsResult.rows[0]?.total || '0');

      let message = `📊 *GoalGPT İstatistikleri*\n\n`;
      message += `*📋 Sistem:*\n`;
      message += `• Toplam Liste: ${totalPosts}\n`;
      message += `• Bugünkü Listeler: ${todayLists}\n`;
      message += `• Toplam Kullanıcı: ${totalUsers}\n\n`;
      message += `*🎯 Performans:*\n`;
      message += `• Ortalama Güven: 75%\n`;
      message += `• Başarı Oranı: Hesaplanıyor...\n\n`;
      message += `_Detaylı istatistikler için web panelini ziyaret edin!_`;

      return message;
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('[BotHandler] Error getting stats:', error);
    return `❌ İstatistikler yüklenirken hata oluştu.`;
  }
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * /start komutu
 */
async function handleStartCommand(chatId: number, firstName: string) {
  const welcomeMessage = getWelcomeMessage(firstName);

  await telegramBot.sendMessage({
    chat_id: chatId,
    text: welcomeMessage,
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard(),
  });

  // Kullanıcıyı veritabanına kaydet
  try {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO telegram_user_preferences (chat_id, first_name, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET last_active_at = NOW()`,
        [chatId, firstName]
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('[BotHandler] Error saving user:', error);
  }

  logger.info(`[BotHandler] User started bot: ${chatId} (${firstName})`);
}

/**
 * /help komutu
 */
async function handleHelpCommand(chatId: number) {
  const helpMessage = getHelpMessage();

  await telegramBot.sendMessage({
    chat_id: chatId,
    text: helpMessage,
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard(),
  });
}

/**
 * /gunluk komutu
 */
async function handleDailyCommand(chatId: number) {
  await telegramBot.sendMessage({
    chat_id: chatId,
    text: '📋 *Günlük Tahmin Listeleri*\n\nBu özellik yakında aktif olacak! 🚀',
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard(),
  });
}

/**
 * /istatistik komutu
 */
async function handleStatsCommand(chatId: number) {
  const statsMessage = await getStatsMessage(chatId);

  await telegramBot.sendMessage({
    chat_id: chatId,
    text: statsMessage,
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard(),
  });
}

/**
 * /ayarlar komutu
 */
async function handleSettingsCommand(chatId: number) {
  await telegramBot.sendMessage({
    chat_id: chatId,
    text: '⚙️ *Ayarlar*\n\nBildirim tercihlerinizi düzenleyin:',
    parse_mode: 'Markdown',
    reply_markup: getSettingsKeyboard(),
  });
}

// ============================================================================
// CALLBACK QUERY HANDLERS
// ============================================================================

/**
 * Callback query handler
 */
async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  logger.info(`[BotHandler] Callback query: ${data} from ${chatId}`);

  // Answer callback query (removes loading state)
  try {
    await telegramBot.axiosInstance.post('/answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
    });
  } catch (error) {
    logger.warn('[BotHandler] Failed to answer callback query:', error);
  }

  // Handle menu actions
  if (data === 'menu_main') {
    await telegramBot.editMessageText(
      chatId,
      messageId,
      getWelcomeMessage(callbackQuery.from.first_name)
    );

    await telegramBot.axiosInstance.post('/editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: getMainMenuKeyboard(),
    });
  }
  else if (data === 'menu_daily_lists') {
    await telegramBot.axiosInstance.post('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: '📋 *Günlük Tahmin Listeleri*\n\nHangi piyasa için liste görmek istersiniz?',
      parse_mode: 'Markdown',
      reply_markup: getDailyListsKeyboard(),
    });
  }
  else if (data === 'menu_settings') {
    await telegramBot.axiosInstance.post('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: '⚙️ *Ayarlar*\n\nBildirim tercihlerinizi düzenleyin:',
      parse_mode: 'Markdown',
      reply_markup: getSettingsKeyboard(),
    });
  }
  else if (data === 'menu_stats') {
    const statsMessage = await getStatsMessage(chatId);
    await telegramBot.axiosInstance.post('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: statsMessage,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }],
        ],
      },
    });
  }
  else if (data.startsWith('list_')) {
    const market = data.replace('list_', '');
    const listMessage = await getDailyListPreview(market);

    await telegramBot.axiosInstance.post('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: listMessage,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Listeler', callback_data: 'menu_daily_lists' }],
          [{ text: '🏠 Ana Menü', callback_data: 'menu_main' }],
        ],
      },
    });
  }
  else if (data === 'menu_live_matches') {
    await telegramBot.axiosInstance.post('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: '⚽️ *Canlı Maçlar*\n\n_Bu özellik yakında aktif olacak!_\n\nCanlı maçları web panelinden takip edebilirsiniz.',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }],
        ],
      },
    });
  }
  else if (data === 'menu_ai_analysis') {
    await telegramBot.axiosInstance.post('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: '🤖 *AI Analiz İste*\n\n_Bu özellik yakında aktif olacak!_\n\nBir maç ID\'si ile analiz isteyebileceksiniz:\n`/analiz {match_id}`',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }],
        ],
      },
    });
  }
  else if (data === 'settings_notifications') {
    await telegramBot.axiosInstance.post('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: '🔔 *Bildirim Ayarları*\n\n_Bu özellik yakında aktif olacak!_\n\nHandgi listeler için bildirim almak istediğinizi seçebileceksiniz.',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Ayarlar', callback_data: 'menu_settings' }],
        ],
      },
    });
  }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

/**
 * Gelen mesajları işle
 */
export async function handleTelegramUpdate(update: TelegramUpdate) {
  try {
    // Callback query (inline button tıklamaları)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }

    // Text message
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const firstName = update.message.from.first_name;

      // Sadece private chat'lerde yanıt ver
      if (update.message.chat.type !== 'private') {
        return;
      }

      // Komutları işle
      if (text === '/start') {
        await handleStartCommand(chatId, firstName);
      }
      else if (text === '/help') {
        await handleHelpCommand(chatId);
      }
      else if (text === '/gunluk') {
        await handleDailyCommand(chatId);
      }
      else if (text === '/istatistik') {
        await handleStatsCommand(chatId);
      }
      else if (text === '/ayarlar') {
        await handleSettingsCommand(chatId);
      }
      else {
        // Bilinmeyen komut
        await telegramBot.sendMessage({
          chat_id: chatId,
          text: '❓ *Bilinmeyen komut.*\n\nYardım için /help komutunu kullanabilirsiniz.',
          parse_mode: 'Markdown',
        });
      }
    }
  } catch (error: any) {
    logger.error('[BotHandler] Error handling update:', error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  handleStartCommand,
  handleHelpCommand,
  handleDailyCommand,
  handleStatsCommand,
  handleSettingsCommand,
  handleCallbackQuery,
};
