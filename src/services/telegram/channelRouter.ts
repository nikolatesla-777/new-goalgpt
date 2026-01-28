/**
 * Telegram Channel Router - Week-2B
 *
 * Routes scoring predictions to appropriate Telegram channels
 * Single bot token → 7 separate channels (one per market)
 *
 * Features:
 * - Market-to-channel mapping
 * - Boot-time configuration validation
 * - DRY_RUN mode support
 * - Channel ID normalization (-100... format)
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type MarketId = 'O25' | 'BTTS' | 'HT_O05' | 'O35' | 'HOME_O15' | 'CORNERS_O85' | 'CARDS_O25';

export interface ChannelConfig {
  marketId: MarketId;
  chatId: string;
  displayName: string;
}

export interface ChannelRouterConfig {
  dryRun: boolean;
  channels: ChannelConfig[];
}

// ============================================================================
// CHANNEL ROUTER
// ============================================================================

class ChannelRouter {
  private static instance: ChannelRouter | null = null;
  private config: ChannelRouterConfig | null = null;
  private channelMap: Map<MarketId, ChannelConfig> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ChannelRouter {
    if (!ChannelRouter.instance) {
      ChannelRouter.instance = new ChannelRouter();
    }
    return ChannelRouter.instance;
  }

  /**
   * Initialize router with environment variables
   * Called once during server boot
   *
   * @throws Error if required channel IDs are missing
   */
  initialize(): void {
    const dryRun = process.env.TELEGRAM_DRY_RUN === 'true';

    const channels: ChannelConfig[] = [
      {
        marketId: 'O25',
        chatId: process.env.TELEGRAM_CHANNEL_O25 || '',
        displayName: '2.5 Üst Gol',
      },
      {
        marketId: 'BTTS',
        chatId: process.env.TELEGRAM_CHANNEL_BTTS || '',
        displayName: 'Karşılıklı Gol',
      },
      {
        marketId: 'HT_O05',
        chatId: process.env.TELEGRAM_CHANNEL_HT_O05 || '',
        displayName: 'İlk Yarı 0.5 Üst',
      },
      {
        marketId: 'O35',
        chatId: process.env.TELEGRAM_CHANNEL_O35 || '',
        displayName: '3.5 Üst Gol',
      },
      {
        marketId: 'HOME_O15',
        chatId: process.env.TELEGRAM_CHANNEL_HOME_O15 || '',
        displayName: 'Ev Sahibi 1.5 Üst',
      },
      {
        marketId: 'CORNERS_O85',
        chatId: process.env.TELEGRAM_CHANNEL_CORNERS_O85 || '',
        displayName: 'Korner 8.5 Üst',
      },
      {
        marketId: 'CARDS_O25',
        chatId: process.env.TELEGRAM_CHANNEL_CARDS_O25 || '',
        displayName: 'Kart 2.5 Üst',
      },
    ];

    // Validate configuration
    this.validateConfig(channels, dryRun);

    // Normalize channel IDs and build map
    channels.forEach((channel) => {
      const normalized = this.normalizeChannelId(channel.chatId);
      this.channelMap.set(channel.marketId, {
        ...channel,
        chatId: normalized,
      });
    });

    this.config = { dryRun, channels };

    logger.info('[ChannelRouter] Initialized', {
      dryRun,
      channelCount: channels.length,
      markets: channels.map((c) => c.marketId),
    });

    if (dryRun) {
      logger.warn('[ChannelRouter] ⚠️  DRY_RUN mode enabled - messages will NOT be sent to Telegram');
    }
  }

  /**
   * Validate configuration at boot time
   * Fails fast if required environment variables are missing
   *
   * @param channels - Channel configurations
   * @param dryRun - Whether dry run mode is enabled
   * @throws Error if validation fails
   */
  private validateConfig(channels: ChannelConfig[], dryRun: boolean): void {
    const missingChannels: string[] = [];

    for (const channel of channels) {
      if (!channel.chatId || channel.chatId.trim() === '') {
        missingChannels.push(channel.marketId);
      }
    }

    if (missingChannels.length > 0 && !dryRun) {
      const errorMessage = `Missing Telegram channel IDs: ${missingChannels.join(', ')}. ` +
        `Please configure the following environment variables:\n` +
        missingChannels.map((m) => `  - TELEGRAM_CHANNEL_${m}`).join('\n') +
        `\n\nOr set TELEGRAM_DRY_RUN=true to skip validation.`;

      logger.error('[ChannelRouter] Configuration validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    if (missingChannels.length > 0 && dryRun) {
      logger.warn('[ChannelRouter] Missing channel IDs (ignored in DRY_RUN mode):', missingChannels);
    }

    // Validate bot token
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken && !dryRun) {
      throw new Error('TELEGRAM_BOT_TOKEN is required. Please configure it in .env file.');
    }
  }

  /**
   * Normalize Telegram channel ID
   * Ensures proper format (e.g., -1001234567890)
   *
   * Channel IDs can be:
   * - Negative integers (e.g., -1001234567890) for channels
   * - Positive integers (e.g., 1234567890) for private chats
   * - Usernames (e.g., @mychannel) for public channels
   *
   * @param chatId - Raw channel ID from environment
   * @returns Normalized channel ID
   */
  private normalizeChannelId(chatId: string): string {
    const trimmed = chatId.trim();

    // Already in correct format or username
    if (trimmed.startsWith('-100') || trimmed.startsWith('@')) {
      return trimmed;
    }

    // Numeric ID without -100 prefix
    if (/^-?\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      // If negative but missing -100 prefix, assume it's a channel
      if (num < 0 && !trimmed.startsWith('-100')) {
        logger.warn(`[ChannelRouter] Channel ID ${trimmed} missing -100 prefix. Did you mean -100${trimmed.substring(1)}?`);
      }
      return trimmed;
    }

    logger.warn(`[ChannelRouter] Unexpected channel ID format: ${trimmed}`);
    return trimmed;
  }

  /**
   * Get target chat ID for a market
   *
   * @param marketId - Market identifier
   * @returns Channel chat ID
   * @throws Error if market not configured
   */
  getTargetChatId(marketId: MarketId): string {
    const channel = this.channelMap.get(marketId);

    if (!channel) {
      throw new Error(`No channel configured for market: ${marketId}`);
    }

    if (this.isDryRun()) {
      logger.debug(`[ChannelRouter] DRY_RUN: Would publish ${marketId} to ${channel.chatId} (${channel.displayName})`);
    }

    return channel.chatId;
  }

  /**
   * Get channel configuration for a market
   *
   * @param marketId - Market identifier
   * @returns Channel configuration
   */
  getChannelConfig(marketId: MarketId): ChannelConfig | undefined {
    return this.channelMap.get(marketId);
  }

  /**
   * Get all configured channels
   *
   * @returns Array of channel configurations
   */
  getAllChannels(): ChannelConfig[] {
    return Array.from(this.channelMap.values());
  }

  /**
   * Check if dry run mode is enabled
   *
   * @returns True if DRY_RUN mode is enabled
   */
  isDryRun(): boolean {
    return this.config?.dryRun ?? false;
  }

  /**
   * Check if router is initialized
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.config !== null;
  }

  /**
   * Get router status for health checks
   *
   * @returns Router status
   */
  getStatus() {
    return {
      initialized: this.isInitialized(),
      dryRun: this.isDryRun(),
      channelCount: this.channelMap.size,
      channels: Array.from(this.channelMap.entries()).map(([marketId, config]) => ({
        market: marketId,
        displayName: config.displayName,
        configured: config.chatId.length > 0,
        chatId: this.isDryRun() ? config.chatId : '***', // Hide in production
      })),
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const channelRouter = ChannelRouter.getInstance();
export { ChannelRouter };
