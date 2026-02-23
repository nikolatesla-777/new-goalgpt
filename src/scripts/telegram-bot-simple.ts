/**
 * Simple Telegram Bot Polling - MVP Version
 *
 * Minimal bot without dailyLists dependency
 * Just responds to /start and /help commands
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
let offset = 0;
let isRunning = true;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// VIP kontrolü
async function isUserVIP(telegramUserId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT id FROM telegram_vip_subscriptions
       WHERE telegram_user_id = $1
       AND status = 'active'
       AND expires_at > NOW()
       LIMIT 1`,
      [telegramUserId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('[Bot] VIP check error:', error);
    return false;
  }
}

// Bugün kaç liste görüntüledi?
async function getTodayViewCount(telegramUserId: number): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT list_type) as count
       FROM telegram_daily_list_views
       WHERE telegram_user_id = $1
       AND view_date = CURRENT_DATE`,
      [telegramUserId]
    );
    return parseInt(result.rows[0]?.count || '0');
  } catch (error) {
    logger.error('[Bot] View count error:', error);
    return 0;
  }
}

// Liste görüntülemeyi kaydet
async function recordListView(telegramUserId: number, listType: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO telegram_daily_list_views (telegram_user_id, list_type, view_date)
       VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT (telegram_user_id, view_date, list_type) DO NOTHING`,
      [telegramUserId, listType]
    );
  } catch (error) {
    logger.error('[Bot] Record view error:', error);
  }
}

// Liste erişim kontrolü
async function canAccessList(telegramUserId: number): Promise<{ allowed: boolean; reason?: string }> {
  const isVIP = await isUserVIP(telegramUserId);

  if (isVIP) {
    return { allowed: true };
  }

  const viewCount = await getTodayViewCount(telegramUserId);

  if (viewCount >= 1) {
    return {
      allowed: false,
      reason: 'free_limit_reached'
    };
  }

  return { allowed: true };
}

// VIP kilit mesajı
function getVIPLockedMessage(): string {
  return `🔒 *VIP İçerik*\n\n` +
    `Bu liste *VIP üyelerine* özeldir.\n\n` +
    `✨ *Günlük 1 liste ÜCRETSİZ!*\n` +
    `Bugünkü ücretsiz listenizi zaten kullandınız.\n\n` +
    `🚀 *VIP Üyelik ile:*\n` +
    `• Sınırsız tüm tahmin listeleri\n` +
    `• AI destekli maç analizleri\n` +
    `• Canlı skor bildirimleri\n` +
    `• Özel kupon önerileri\n\n` +
    `💎 *Haftalık sadece 200 Stars (≈199₺)*\n\n` +
    `VIP üye olmak için: /uyeol`;
}

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

async function sendInvoice(chatId: number) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`,
      {
        chat_id: chatId,
        title: '⭐️ GoalGPT VIP Üyelik',
        description: 'Haftalık VIP üyelik ile sınırsız AI tahmin, canlı maç analizleri ve özel kuponlara erişin!',
        payload: `vip_weekly_${chatId}_${Date.now()}`,
        currency: 'XTR', // Telegram Stars
        prices: [
          {
            label: 'VIP Üyelik (1 Hafta)',
            amount: 200 // 200 Stars
          }
        ],
        photo_url: 'https://partnergoalgpt.com/assets/vip-badge.png',
        photo_width: 640,
        photo_height: 640,
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⭐️ 200 Stars ile Öde (≈199₺)',
                pay: true
              }
            ]
          ]
        }
      }
    );
    logger.info('[Bot] Invoice sent', { chat_id: chatId });
  } catch (error: any) {
    logger.error('[Bot] Error sending invoice:', error.message);
    throw error;
  }
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

async function getDailyList(market: string): Promise<any> {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/telegram/daily-lists/today`);
    if (!response.data || !response.data.lists) {
      return null;
    }

    // Find the specific market list
    const list = response.data.lists.find((l: any) => l.market === market);
    return list || null;
  } catch (error: any) {
    logger.error('[Bot] Error fetching daily list:', error.message);
    return null;
  }
}

function formatDailyListMessage(list: any, title: string): string {
  if (!list || !list.matches || list.matches.length === 0) {
    return `${title}\n\nBugün için maç bulunamadı. 😔`;
  }

  let message = `${title}\n`;
  message += `📅 Tarih: ${new Date().toLocaleDateString('tr-TR')}\n`;
  message += `📊 Maç Sayısı: ${list.matches.length}\n`;

  // Performance gösterimi
  if (list.performance) {
    const perf = list.performance;
    message += `🎯 Başarı: ${perf.won || 0}/${perf.total || 0} (${perf.win_rate || 0}%)\n`;
  }

  message += `━━━━━━━━━━━━━━━━\n\n`;

  list.matches.slice(0, 10).forEach((match: any, index: number) => {
    // Takım isimleri
    const homeName = match.home_name || 'N/A';
    const awayName = match.away_name || 'N/A';
    message += `${index + 1}. *${homeName}* vs *${awayName}*\n`;

    // Saat - Unix timestamp'i Türkiye saatine göre formatla
    if (match.date_unix) {
      const matchDate = new Date(match.date_unix * 1000);
      const timeStr = matchDate.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      message += `   🕐 ${timeStr}\n`;
    }

    // Lig
    if (match.league_name) {
      message += `   🏆 ${match.league_name}\n`;
    }

    // Güven skoru ve sebep
    if (match.confidence) {
      message += `   🔥 Güven: ${match.confidence}/100\n`;
    }
    if (match.reason) {
      message += `   💡 ${match.reason}\n`;
    }

    message += `\n`;
  });

  if (list.matches.length > 10) {
    message += `\n... ve ${list.matches.length - 10} maç daha!\n`;
    message += `\nTüm listeyi görmek için Mini App'i açın: /goalgpt`;
  }

  return message;
}

async function handlePreCheckoutQuery(preCheckoutQuery: any) {
  const queryId = preCheckoutQuery.id;
  const userId = preCheckoutQuery.from.id;

  logger.info('[Bot] Pre-checkout query', {
    query_id: queryId,
    user_id: userId,
    invoice_payload: preCheckoutQuery.invoice_payload
  });

  try {
    // Approve the payment
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`,
      {
        pre_checkout_query_id: queryId,
        ok: true
      }
    );
    logger.info('[Bot] Pre-checkout approved', { query_id: queryId });
  } catch (error: any) {
    logger.error('[Bot] Error approving pre-checkout:', error.message);
    // Reject payment
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`,
      {
        pre_checkout_query_id: queryId,
        ok: false,
        error_message: 'Ödeme işlenirken bir hata oluştu. Lütfen tekrar deneyin.'
      }
    );
  }
}

async function handleSuccessfulPayment(message: any) {
  const chatId = message.chat.id;
  const payment = message.successful_payment;
  const userId = message.from.id;
  const firstName = message.from.first_name;

  logger.info('[Bot] Successful payment received', {
    user_id: userId,
    telegram_payment_charge_id: payment.telegram_payment_charge_id,
    invoice_payload: payment.invoice_payload,
    total_amount: payment.total_amount
  });

  try {
    // TODO: Save to database (next step)
    // For now, just send confirmation message

    await sendMessage(
      chatId,
      `🎉 *Ödeme Başarılı!*\n\n` +
      `Tebrikler ${firstName}! VIP üyeliğiniz aktif edildi.\n\n` +
      `⭐️ *Ödeme:* ${payment.total_amount} Stars\n` +
      `📅 *Süre:* 7 gün\n` +
      `🔓 *Durum:* Aktif\n\n` +
      `Artık tüm VIP içeriklere erişebilirsiniz! 🚀\n\n` +
      `Mini app'i açmak için: /goalgpt`
    );

    logger.info('[Bot] VIP subscription activated', { user_id: userId });
  } catch (error: any) {
    logger.error('[Bot] Error handling successful payment:', error.message);
    await sendMessage(
      chatId,
      `⚠️ Ödemeniz alındı ancak üyelik aktivasyonunda bir sorun oluştu. Destek ekibimiz en kısa sürede sizinle iletişime geçecek.`
    );
  }
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
        text: `📊 *Günlük Tahmin Listeleri*\n\nBugünün AI destekli tahmin listelerine aşağıdan ulaşabilirsiniz:\n\n📅 ${new Date().toLocaleDateString('tr-TR')}`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⚽️ 2.5 Üst', callback_data: 'list_ust25' },
              { text: '⚽️ 1.5 Üst', callback_data: 'list_ust15' }
            ],
            [
              { text: '🎯 KG VAR', callback_data: 'list_kgvar' },
              { text: '🕐 İY 0.5 Üst', callback_data: 'list_iy05' }
            ],
            [
              { text: '🚩 Korner 7.5 Üst', callback_data: 'list_korner' },
            ],
            [
              { text: '🟨 Sarı Kart 3.5 Üst', callback_data: 'list_sarikart' }
            ],
            [
              { text: '🔙 Ana Menü', callback_data: 'menu_main' }
            ]
          ]
        },
      }
    );
  }
  else if (data === 'list_ust25') {
    const userId = callbackQuery.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text: getVIPLockedMessage(),
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 VIP Üye Ol', callback_data: 'upgrade_vip' }],
              [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }]
            ]
          },
        }
      );
      return;
    }

    const list = await getDailyList('OVER_25');
    const message = formatDailyListMessage(list, '⚽️ *2.5 ÜST LİSTESİ*');

    await recordListView(userId, 'OVER_25');

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'list_ust15') {
    const userId = callbackQuery.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text: getVIPLockedMessage(),
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 VIP Üye Ol', callback_data: 'upgrade_vip' }],
              [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }]
            ]
          },
        }
      );
      return;
    }

    const list = await getDailyList('OVER_15');
    const message = formatDailyListMessage(list, '⚽️ *1.5 ÜST LİSTESİ*');

    await recordListView(userId, 'OVER_15');

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'list_iy05') {
    const userId = callbackQuery.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text: getVIPLockedMessage(),
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 VIP Üye Ol', callback_data: 'upgrade_vip' }],
              [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }]
            ]
          },
        }
      );
      return;
    }

    const list = await getDailyList('HT_OVER_05');
    const message = formatDailyListMessage(list, '🕐 *İLK YARI 0.5 ÜST LİSTESİ*');

    await recordListView(userId, 'HT_OVER_05');

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'list_korner') {
    const userId = callbackQuery.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text: getVIPLockedMessage(),
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 VIP Üye Ol', callback_data: 'upgrade_vip' }],
              [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }]
            ]
          },
        }
      );
      return;
    }

    const list = await getDailyList('CORNERS');
    const message = formatDailyListMessage(list, '🚩 *KORNER 7.5 ÜST LİSTESİ*');

    await recordListView(userId, 'CORNERS');

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'list_sarikart') {
    const userId = callbackQuery.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text: getVIPLockedMessage(),
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 VIP Üye Ol', callback_data: 'upgrade_vip' }],
              [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }]
            ]
          },
        }
      );
      return;
    }

    const list = await getDailyList('CARDS');
    const message = formatDailyListMessage(list, '🟨 *SARI KART 3.5 ÜST LİSTESİ*');

    await recordListView(userId, 'CARDS');

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: getBackButton(),
      }
    );
  }
  else if (data === 'list_kgvar') {
    const userId = callbackQuery.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text: getVIPLockedMessage(),
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 VIP Üye Ol', callback_data: 'upgrade_vip' }],
              [{ text: '🔙 Ana Menü', callback_data: 'menu_main' }]
            ]
          },
        }
      );
      return;
    }

    const list = await getDailyList('BTTS');
    const message = formatDailyListMessage(list, '🎯 *KG VAR LİSTESİ*');

    await recordListView(userId, 'BTTS');

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text: message,
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
  else if (data === 'upgrade_vip') {
    // VIP üyelik invoice gönder
    await sendInvoice(chatId);
  }
}

async function handleUpdate(update: any) {
  // Handle pre-checkout query (payment confirmation)
  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(update.pre_checkout_query);
    return;
  }

  // Handle successful payment
  if (update.message?.successful_payment) {
    await handleSuccessfulPayment(update.message);
    return;
  }

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
  else if (text === '/goalgpt') {
    await sendMessage(
      chatId,
      `📱 *GoalGPT Mini App*\n\n` +
      `Aşağıdaki butona tıklayarak GoalGPT Mini App'i açabilirsiniz! 🚀`,
      {
        inline_keyboard: [
          [
            {
              text: '📱 GoalGPT\'yi Aç',
              web_app: { url: 'https://partnergoalgpt.com/miniapp' }
            }
          ]
        ]
      }
    );
  }
  else if (text === '/help' || text === '/yardim') {
    await sendMessage(
      chatId,
      `📖 *Yardım*\n\n` +
      `Aşağıdaki komutları kullanabilirsiniz:\n\n` +
      `🏠 /start - Başlangıç\n` +
      `📱 /goalgpt - GoalGPT Mini App Aç\n` +
      `📊 /gunluk - Günlük tahmin listeleri\n` +
      `⚽️ /ust25 - 2.5 Üst Listesi\n` +
      `⚽️ /ust15 - 1.5 Üst Listesi\n` +
      `🎯 /kgvar - KG VAR Listesi\n` +
      `🕐 /iy05 - İlk Yarı 0.5 Üst\n` +
      `🚩 /korner - Korner Listesi\n` +
      `🟨 /sarikart - Sarı Kart Listesi\n` +
      `🤖 /analizyap - AI analiz iste\n` +
      `📈 /performans - Performans takibi\n` +
      `📞 /iletisim - İletişim\n` +
      `👤 /uyelik - Üyelik durumu\n\n` +
      `Daha fazla özellik çok yakında! 🚀`
    );
  }
  else if (text === '/gunluk') {
    await sendMessage(
      chatId,
      `📊 *Günlük Tahmin Listeleri*\n\n` +
      `Bugünün AI destekli tahmin listelerine aşağıdan ulaşabilirsiniz:\n\n` +
      `📅 ${new Date().toLocaleDateString('tr-TR')}`,
      {
        inline_keyboard: [
          [
            { text: '⚽️ 2.5 Üst', callback_data: 'list_ust25' },
            { text: '⚽️ 1.5 Üst', callback_data: 'list_ust15' }
          ],
          [
            { text: '🎯 KG VAR', callback_data: 'list_kgvar' },
            { text: '🕐 İY 0.5 Üst', callback_data: 'list_iy05' }
          ],
          [
            { text: '🚩 Korner 7.5 Üst', callback_data: 'list_korner' },
          ],
          [
            { text: '🟨 Sarı Kart 3.5 Üst', callback_data: 'list_sarikart' }
          ],
          [
            { text: '🔙 Ana Menü', callback_data: 'menu_main' }
          ]
        ]
      }
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
  else if (text === '/ust25') {
    const userId = update.message.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await sendMessage(chatId, getVIPLockedMessage());
      await sendInvoice(chatId);
      return;
    }

    const list = await getDailyList('OVER_25');
    const message = formatDailyListMessage(list, '⚽️ *2.5 ÜST LİSTESİ*');
    await recordListView(userId, 'OVER_25');
    await sendMessage(chatId, message);
  }
  else if (text === '/ust15') {
    const userId = update.message.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await sendMessage(chatId, getVIPLockedMessage());
      await sendInvoice(chatId);
      return;
    }

    const list = await getDailyList('OVER_15');
    const message = formatDailyListMessage(list, '⚽️ *1.5 ÜST LİSTESİ*');
    await recordListView(userId, 'OVER_15');
    await sendMessage(chatId, message);
  }
  else if (text === '/iy05') {
    const userId = update.message.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await sendMessage(chatId, getVIPLockedMessage());
      await sendInvoice(chatId);
      return;
    }

    const list = await getDailyList('HT_OVER_05');
    const message = formatDailyListMessage(list, '🕐 *İLK YARI 0.5 ÜST LİSTESİ*');
    await recordListView(userId, 'HT_OVER_05');
    await sendMessage(chatId, message);
  }
  else if (text === '/korner') {
    const userId = update.message.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await sendMessage(chatId, getVIPLockedMessage());
      await sendInvoice(chatId);
      return;
    }

    const list = await getDailyList('CORNERS');
    const message = formatDailyListMessage(list, '🚩 *KORNER 7.5 ÜST LİSTESİ*');
    await recordListView(userId, 'CORNERS');
    await sendMessage(chatId, message);
  }
  else if (text === '/sarikart') {
    const userId = update.message.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await sendMessage(chatId, getVIPLockedMessage());
      await sendInvoice(chatId);
      return;
    }

    const list = await getDailyList('CARDS');
    const message = formatDailyListMessage(list, '🟨 *SARI KART 3.5 ÜST LİSTESİ*');
    await recordListView(userId, 'CARDS');
    await sendMessage(chatId, message);
  }
  else if (text === '/kgvar') {
    const userId = update.message.from.id;
    const access = await canAccessList(userId);

    if (!access.allowed) {
      await sendMessage(chatId, getVIPLockedMessage());
      await sendInvoice(chatId);
      return;
    }

    const list = await getDailyList('BTTS');
    const message = formatDailyListMessage(list, '🎯 *KG VAR LİSTESİ*');
    await recordListView(userId, 'BTTS');
    await sendMessage(chatId, message);
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
      `⭐️ *GoalGPT VIP Üyelik*\n\n` +
      `VIP üyelikle neler kazanırsınız?\n\n` +
      `✅ Sınırsız AI tahmin\n` +
      `✅ Canlı maç analizleri\n` +
      `✅ Özel VIP kuponlar\n` +
      `✅ Günlük tahmin listeleri\n` +
      `✅ Öncelikli destek\n\n` +
      `💰 *Fiyat:* 200 ⭐️ Telegram Stars (≈199₺)\n` +
      `📅 *Süre:* 1 Hafta\n\n` +
      `Aşağıdaki butona tıklayarak ödeme yapabilirsiniz! 👇`
    );

    // Send invoice
    try {
      await sendInvoice(chatId);
    } catch (error: any) {
      await sendMessage(
        chatId,
        `❌ Ödeme sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.`
      );
    }
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
            logger.error('[Bot] Error handling update:', error.message || error);
          }
        }
      }
    } catch (error: any) {
      logger.error('[Bot] Error in polling loop:', error.message || String(error));
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
