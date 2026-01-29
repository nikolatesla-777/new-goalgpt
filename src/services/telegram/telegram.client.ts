/**
 * TelegramBotClient - Singleton Pattern
 *
 * Telegram Bot API client for publishing match predictions to channels:
 * - Send formatted messages
 * - Edit existing messages
 * - Reply with settlement results
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

interface MessageResult {
  message_id: number;
  chat?: {
    id: number;
    type: string;
  };
  date: number;
  text: string;
}

// ============================================================================
// PHASE-0: RATE LIMITER
// ============================================================================

/**
 * PHASE-0.1: Enhanced rate limiter with 429 backoff support
 * Telegram allows 30 messages/second to different chats
 */
class TelegramRateLimiter {
  private lastRequestTime = 0;
  private minIntervalMs = 50; // 50ms = 20 req/sec (under Telegram's 30/sec limit)
  private backoffMs = 0; // Dynamic backoff for 429 responses

  async throttle(): Promise<void> {
    const now = Date.now();

    // If in backoff period (429 received), wait extra time
    if (this.backoffMs > 0) {
      logger.debug(`[Telegram] ⏳ Backoff active, waiting ${this.backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, this.backoffMs));
      this.backoffMs = 0; // Reset after waiting
    }

    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Set backoff time after receiving 429 response
   */
  setBackoff(ms: number): void {
    this.backoffMs = Math.min(ms, 30000); // Max 30 seconds
    logger.info(`[Telegram] 🕐 Backoff set to ${this.backoffMs}ms`);
  }

  /**
   * Get current backoff state
   */
  isInBackoff(): boolean {
    return this.backoffMs > 0;
  }
}

// ============================================================================
// SINGLETON CLIENT
// ============================================================================

class TelegramBotClient {
  private static instance: TelegramBotClient | null = null;
  private axiosInstance: AxiosInstance;
  private botToken: string;
  private requestCount = 0;
  private errorCount = 0;
  private rateLimiter = new TelegramRateLimiter();

  private constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';

    if (!this.botToken) {
      logger.warn('[Telegram] BOT_TOKEN not configured');
    }

    this.axiosInstance = axios.create({
      baseURL: `https://api.telegram.org/bot${this.botToken}`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.setupInterceptors();
    logger.info('[Telegram] Bot client initialized');
  }

  static getInstance(): TelegramBotClient {
    if (!TelegramBotClient.instance) {
      TelegramBotClient.instance = new TelegramBotClient();
    }
    return TelegramBotClient.instance;
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (cfg) => {
        (cfg as any).metadata = { startTime: Date.now() };
        return cfg;
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config as any).metadata?.startTime;
        logger.debug(`[Telegram] ${response.config.url} ${duration}ms`);
        return response;
      },
      async (error) => {
        this.errorCount++;

        const errorCode = error.response?.data?.error_code;

        // PHASE-0.1: Handle 429 Too Many Requests (rate limited)
        if (errorCode === 429) {
          const retryAfter = error.response?.data?.parameters?.retry_after || 1;
          const backoffMs = retryAfter * 1000;

          logger.warn('[Telegram] ⚠️ 429 Rate Limited - backing off', {
            retry_after: retryAfter,
            backoff_ms: backoffMs,
            description: error.response?.data?.description,
          });

          // Set backoff for next request
          this.rateLimiter.setBackoff(backoffMs);

          // Return soft fail with retry_after info (caller can retry)
          return {
            data: {
              ok: false,
              rate_limited: true,
              error_code: 429,
              retry_after: retryAfter,
              description: error.response?.data?.description || 'Too Many Requests',
            }
          };
        }

        // PHASE-0: Handle 403 Forbidden (user blocked the bot)
        if (errorCode === 403) {
          let chatId: string | null = null;
          try {
            if (error.config?.data) {
              const requestData = JSON.parse(error.config.data);
              chatId = requestData.chat_id?.toString() || null;
            }
          } catch (e) {
            // Ignore parse error
          }

          logger.warn('[Telegram] ⚠️ 403 Forbidden - User blocked bot', {
            chat_id: chatId,
            description: error.response?.data?.description,
          });

          // Mark chat as blocked in database (fire and forget)
          if (chatId) {
            this.markChatAsBlocked(chatId, errorCode, error.response?.data?.description);
          }

          // Return soft fail response instead of throwing
          return {
            data: {
              ok: false,
              blocked: true,
              error_code: 403,
              description: error.response?.data?.description || 'Forbidden: bot was blocked by the user',
            }
          };
        }

        logger.error('[Telegram] Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * PHASE-0: Mark a chat as blocked in the database
   * Fire and forget - does not throw on error
   */
  private async markChatAsBlocked(chatId: string, errorCode: number, description: string): Promise<void> {
    try {
      const { pool } = await import('../../database/connection');
      await pool.query(`
        INSERT INTO telegram_blocked_chats (chat_id, error_code, error_description)
        VALUES ($1, $2, $3)
        ON CONFLICT (chat_id) DO UPDATE SET
          blocked_at = NOW(),
          error_code = $2,
          error_description = $3,
          retry_count = telegram_blocked_chats.retry_count + 1,
          last_retry_at = NOW()
      `, [chatId, errorCode, description || 'Blocked by user']);
      logger.info('[Telegram] 📝 Chat marked as blocked', { chat_id: chatId });
    } catch (err) {
      logger.error('[Telegram] Failed to mark chat as blocked:', err);
    }
  }

  /**
   * Send a message to a chat
   * PHASE-0: Added rate limiting
   */
  async sendMessage(message: TelegramMessage): Promise<TelegramResponse<MessageResult>> {
    await this.rateLimiter.throttle();
    this.requestCount++;
    const response = await this.axiosInstance.post<TelegramResponse<MessageResult>>('/sendMessage', message);
    return response.data;
  }

  /**
   * Edit an existing message
   * PHASE-0.1: Added rate limiting
   */
  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string
  ): Promise<TelegramResponse<MessageResult>> {
    await this.rateLimiter.throttle();
    this.requestCount++;
    const response = await this.axiosInstance.post<TelegramResponse<MessageResult>>('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    });
    return response.data;
  }

  /**
   * Reply to a message
   * PHASE-0.1: Added rate limiting
   */
  async replyToMessage(
    chatId: string | number,
    replyToMessageId: number,
    text: string
  ): Promise<TelegramResponse<MessageResult>> {
    await this.rateLimiter.throttle();
    this.requestCount++;
    const response = await this.axiosInstance.post<TelegramResponse<MessageResult>>('/sendMessage', {
      chat_id: chatId,
      reply_to_message_id: replyToMessageId,
      text,
      parse_mode: 'HTML',
    });
    return response.data;
  }

  /**
   * Check if bot is configured
   */
  isConfigured(): boolean {
    return this.botToken.length > 0;
  }

  /**
   * Get health status
   */
  getHealth() {
    return {
      configured: this.isConfigured(),
      metrics: { requests: this.requestCount, errors: this.errorCount },
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const telegramBot = TelegramBotClient.getInstance();
export { TelegramBotClient };
