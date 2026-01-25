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
// SINGLETON CLIENT
// ============================================================================

class TelegramBotClient {
  private static instance: TelegramBotClient | null = null;
  private axiosInstance: AxiosInstance;
  private botToken: string;
  private requestCount = 0;
  private errorCount = 0;

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
      (error) => {
        this.errorCount++;
        logger.error('[Telegram] Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send a message to a chat
   */
  async sendMessage(message: TelegramMessage): Promise<TelegramResponse<MessageResult>> {
    this.requestCount++;
    const response = await this.axiosInstance.post<TelegramResponse<MessageResult>>('/sendMessage', message);
    return response.data;
  }

  /**
   * Edit an existing message
   */
  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string
  ): Promise<TelegramResponse<MessageResult>> {
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
   */
  async replyToMessage(
    chatId: string | number,
    replyToMessageId: number,
    text: string
  ): Promise<TelegramResponse<MessageResult>> {
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
