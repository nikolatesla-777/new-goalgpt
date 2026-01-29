/**
 * Telegram Channel Router - Week-2B (Hardened)
 *
 * Routes scoring predictions to appropriate Telegram channels
 * Single bot token → 7 separate channels (one per market)
 *
 * Features:
 * - Market-to-channel mapping
 * - Boot-time configuration validation (fail-fast if PUBLISH_ENABLED=true)
 * - DRY_RUN mode support
 * - Channel ID normalization (-100... format)
 *
 * @author GoalGPT Team
 * @version 1.1.0
 */

import { logger } from '../../utils/logger';
import { MarketId } from '../../types/markets';

// ============================================================================
// TYPES
// ============================================================================

export interface ChannelConfig {
  marketId: MarketId;
  chatId: string;
  displayName: string;
}

export interface ChannelRouterConfig {
  publishEnabled: boolean;
  strictConfig: boolean;
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
   * @throws Error if required channel IDs are missing AND publish enabled
   */
  initialize(): void {
    const publishEnabled = process.env.TELEGRAM_PUBLISH_ENABLED === 'true';
    const strictConfig = process.env.TELEGRAM_STRICT_CONFIG !== 'false'; // Default true
    const dryRun = process.env.TELEGRAM_DRY_RUN === 'true';

    const channels: ChannelConfig[] = [
      {
        marketId: MarketId.O25,
        chatId: process.env.TELEGRAM_CHANNEL_O25 || '',
        displayName: '2.5 Üst Gol',
      },
      {
        marketId: MarketId.BTTS,
        chatId: process.env.TELEGRAM_CHANNEL_BTTS || '',
        displayName: 'Karşılıklı Gol',
      },
      {
        marketId: MarketId.HT_O05,
        chatId: process.env.TELEGRAM_CHANNEL_HT_O05 || '',
        displayName: 'İlk Yarı 0.5 Üst',
      },
      {
        marketId: MarketId.O35,
        chatId: process.env.TELEGRAM_CHANNEL_O35 || '',
        displayName: '3.5 Üst Gol',
      },
      {
        marketId: MarketId.HOME_O15,
        chatId: process.env.TELEGRAM_CHANNEL_HOME_O15 || '',
        displayName: 'Ev Sahibi 1.5 Üst',
      },
      {
        marketId: MarketId.CORNERS_O85,
        chatId: process.env.TELEGRAM_CHANNEL_CORNERS_O85 || '',
        displayName: 'Korner 8.5 Üst',
      },
      {
        marketId: MarketId.CARDS_O25,
        chatId: process.env.TELEGRAM_CHANNEL_CARDS_O25 || '',
        displayName: 'Kart 2.5 Üst',
      },
    ];

    // Validate configuration (fail-fast if publish enabled)
    this.validateConfig(channels, publishEnabled, strictConfig, dryRun);

    // Normalize channel IDs and build map
    channels.forEach((channel) => {
      const normalized = this.normalizeChannelId(channel.chatId);
      this.channelMap.set(channel.marketId, {
        ...channel,
        chatId: normalized,
      });
    });

    this.config = { publishEnabled, strictConfig, dryRun, channels };

    logger.info('[ChannelRouter] Initialized', {
      publishEnabled,
      strictConfig,
      dryRun,
      channelCount: channels.length,
      markets: channels.map((c) => c.marketId),
    });

    if (!publishEnabled) {
      logger.warn('[ChannelRouter] ⚠️  TELEGRAM_PUBLISH_ENABLED=false - Publish endpoints will return 503');
    }

    if (dryRun) {
      logger.warn('[ChannelRouter] ⚠️  DRY_RUN mode enabled - messages will NOT be sent to Telegram');
    }
  }

  /**
   * Validate configuration at boot time
   * HARDENED: Fail-fast behavior based on TELEGRAM_PUBLISH_ENABLED
   *
   * @param channels - Channel configurations
   * @param publishEnabled - Whether Telegram publishing is enabled
   * @param strictConfig - Whether to enforce strict validation
   * @param dryRun - Whether dry run mode is enabled
   * @throws Error if validation fails AND publish enabled
   */
  private validateConfig(
    channels: ChannelConfig[],
    publishEnabled: boolean,
    strictConfig: boolean,
    dryRun: boolean
  ): void {
    const missingChannels: string[] = [];

    for (const channel of channels) {
      if (!channel.chatId || channel.chatId.trim() === '') {
        missingChannels.push(channel.marketId);
      }
    }

    // CRITICAL: Fail-fast if publish enabled and strict config
    if (missingChannels.length > 0 && publishEnabled && strictConfig && !dryRun) {
      const errorMessage =
        `[CRITICAL] Telegram publishing ENABLED but required channel IDs are missing: ${missingChannels.join(', ')}.\n` +
        `Please configure the following environment variables:\n` +
        missingChannels.map((m) => `  - TELEGRAM_CHANNEL_${m}`).join('\n') +
        `\n\nOptions to fix:\n` +
        `  1. Configure missing channel IDs in .env\n` +
        `  2. Set TELEGRAM_PUBLISH_ENABLED=false to disable publishing\n` +
        `  3. Set TELEGRAM_DRY_RUN=true for testing without real sends\n` +
        `  4. Set TELEGRAM_STRICT_CONFIG=false to allow partial config (NOT recommended)`;

      logger.error('[ChannelRouter] FATAL: Configuration validation failed', {
        publishEnabled,
        strictConfig,
        dryRun,
        missingChannels,
      });

      // FAIL-FAST: Exit process
      throw new Error(errorMessage);
    }

    // WARNING: Missing channels but publish disabled
    if (missingChannels.length > 0 && !publishEnabled) {
      logger.warn('[ChannelRouter] ⚠️  Missing channel IDs (ignored - TELEGRAM_PUBLISH_ENABLED=false)', {
        missingChannels,
        note: 'Publish endpoints will return 503 Service Unavailable',
      });
    }

    // WARNING: Missing channels in dry-run mode
    if (missingChannels.length > 0 && dryRun) {
      logger.warn('[ChannelRouter] ⚠️  Missing channel IDs (ignored - DRY_RUN mode)', {
        missingChannels,
      });
    }

    // Validate bot token (only if publish enabled)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken && publishEnabled && strictConfig && !dryRun) {
      const errorMessage =
        `[CRITICAL] TELEGRAM_BOT_TOKEN is required when TELEGRAM_PUBLISH_ENABLED=true.\n` +
        `Please configure it in .env file or set TELEGRAM_PUBLISH_ENABLED=false.`;

      logger.error('[ChannelRouter] FATAL: Bot token missing', { publishEnabled });
      throw new Error(errorMessage);
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
   * Check if Telegram publishing is enabled
   *
   * @returns True if TELEGRAM_PUBLISH_ENABLED=true
   */
  isPublishEnabled(): boolean {
    return this.config?.publishEnabled ?? false;
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
      publishEnabled: this.isPublishEnabled(),
      strictConfig: this.config?.strictConfig ?? true,
      dryRun: this.isDryRun(),
      channelCount: this.channelMap.size,
      channels: Array.from(this.channelMap.entries()).map(([marketId, config]) => ({
        market: marketId,
        displayName: config.displayName,
        configured: config.chatId.length > 0,
        chatId: this.isDryRun() || !this.isPublishEnabled() ? config.chatId : '***', // Hide in production
      })),
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const channelRouter = ChannelRouter.getInstance();
export { ChannelRouter };
