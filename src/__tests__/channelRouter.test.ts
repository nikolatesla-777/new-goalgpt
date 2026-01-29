/**
 * Unit Tests for ChannelRouter - Week-2B
 *
 * Tests channel routing logic, environment validation, and configuration
 *
 * @author GoalGPT Team
 */

import { ChannelRouter, ChannelConfig } from '../services/telegram/channelRouter';
import { MarketId } from '../types/markets';

describe('ChannelRouter', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let router: ChannelRouter;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset singleton instance for each test
    (ChannelRouter as any).instance = null;
    router = ChannelRouter.getInstance();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // ============================================================================
  // TEST 1: Environment Variable Mapping
  // ============================================================================
  describe('Environment Variable Mapping', () => {
    it('should correctly map all 7 market channel IDs from environment', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act
      router.initialize();

      // Assert
      expect(router.getTargetChatId(MarketId.O25)).toBe('-1001234567890');
      expect(router.getTargetChatId(MarketId.BTTS)).toBe('-1001234567891');
      expect(router.getTargetChatId(MarketId.HT_O05)).toBe('-1001234567892');
      expect(router.getTargetChatId(MarketId.O35)).toBe('-1001234567893');
      expect(router.getTargetChatId(MarketId.HOME_O15)).toBe('-1001234567894');
      expect(router.getTargetChatId(MarketId.CORNERS_O85)).toBe('-1001234567895');
      expect(router.getTargetChatId(MarketId.CARDS_O25)).toBe('-1001234567896');
    });
  });

  // ============================================================================
  // TEST 2: Fail-Fast Validation (Publish Enabled, Missing Channels)
  // ============================================================================
  describe('Fail-Fast Validation', () => {
    it('should throw error when PUBLISH_ENABLED=true and channel IDs missing', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      // Intentionally missing channel IDs

      // Act & Assert
      expect(() => router.initialize()).toThrow(/required channel IDs are missing/);
      expect(() => router.initialize()).toThrow(/TELEGRAM_CHANNEL_O25/);
    });

    it('should throw error when PUBLISH_ENABLED=true and bot token missing', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      // Bot token missing
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act & Assert
      expect(() => router.initialize()).toThrow(/TELEGRAM_BOT_TOKEN is required/);
    });
  });

  // ============================================================================
  // TEST 3: Graceful Degradation (Publish Disabled)
  // ============================================================================
  describe('Graceful Degradation', () => {
    it('should initialize successfully when PUBLISH_ENABLED=false even without channel IDs', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'false';

      // Act
      router.initialize();

      // Assert
      expect(router.isInitialized()).toBe(true);
      expect(router.isPublishEnabled()).toBe(false);
    });

    it('should allow partial config when STRICT_CONFIG=false', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'false';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      // Other channels missing

      // Act & Assert
      expect(() => router.initialize()).not.toThrow();
      expect(router.isInitialized()).toBe(true);
    });
  });

  // ============================================================================
  // TEST 4: DRY_RUN Mode
  // ============================================================================
  describe('DRY_RUN Mode', () => {
    it('should initialize successfully in DRY_RUN mode without real channel IDs', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_DRY_RUN = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';

      // Act
      router.initialize();

      // Assert
      expect(router.isInitialized()).toBe(true);
      expect(router.isDryRun()).toBe(true);
      expect(router.isPublishEnabled()).toBe(true);
    });

    it('should return channel IDs in DRY_RUN mode without real sends', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_DRY_RUN = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act
      router.initialize();
      const chatId = router.getTargetChatId(MarketId.O25);

      // Assert
      expect(chatId).toBe('-1001234567890');
      expect(router.isDryRun()).toBe(true);
    });
  });

  // ============================================================================
  // TEST 5: Channel ID Normalization
  // ============================================================================
  describe('Channel ID Normalization', () => {
    it('should preserve channel IDs with -100 prefix', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act
      router.initialize();

      // Assert
      expect(router.getTargetChatId(MarketId.O25)).toBe('-1001234567890');
    });

    it('should preserve username format channel IDs', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '@goalgpt_o25';
      process.env.TELEGRAM_CHANNEL_BTTS = '@goalgpt_btts';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '@goalgpt_ht';
      process.env.TELEGRAM_CHANNEL_O35 = '@goalgpt_o35';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '@goalgpt_home';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '@goalgpt_corners';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '@goalgpt_cards';

      // Act
      router.initialize();

      // Assert
      expect(router.getTargetChatId(MarketId.O25)).toBe('@goalgpt_o25');
      expect(router.getTargetChatId(MarketId.BTTS)).toBe('@goalgpt_btts');
    });
  });

  // ============================================================================
  // TEST 6: Channel Configuration Retrieval
  // ============================================================================
  describe('Channel Configuration Retrieval', () => {
    it('should return channel config for valid market', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act
      router.initialize();
      const config = router.getChannelConfig(MarketId.O25);

      // Assert
      expect(config).toBeDefined();
      expect(config?.marketId).toBe(MarketId.O25);
      expect(config?.chatId).toBe('-1001234567890');
      expect(config?.displayName).toBe('2.5 Üst Gol');
    });

    it('should return undefined for unconfigured market', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'false';

      // Act
      router.initialize();
      const config = router.getChannelConfig('INVALID_MARKET' as MarketId);

      // Assert
      expect(config).toBeUndefined();
    });
  });

  // ============================================================================
  // TEST 7: getAllChannels Method
  // ============================================================================
  describe('getAllChannels Method', () => {
    it('should return all 7 configured channels', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act
      router.initialize();
      const channels = router.getAllChannels();

      // Assert
      expect(channels).toHaveLength(7);
      expect(channels.map((c) => c.marketId)).toEqual([
        MarketId.O25,
        MarketId.BTTS,
        MarketId.HT_O05,
        MarketId.O35,
        MarketId.HOME_O15,
        MarketId.CORNERS_O85,
        MarketId.CARDS_O25,
      ]);
    });
  });

  // ============================================================================
  // TEST 8: getStatus Method (Health Check)
  // ============================================================================
  describe('getStatus Method', () => {
    it('should return comprehensive status for health checks', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act
      router.initialize();
      const status = router.getStatus();

      // Assert
      expect(status.initialized).toBe(true);
      expect(status.publishEnabled).toBe(true);
      expect(status.strictConfig).toBe(true);
      expect(status.dryRun).toBe(false);
      expect(status.channelCount).toBe(7);
      expect(status.channels).toHaveLength(7);
      expect(status.channels.every((c) => c.configured)).toBe(true);
      // Chat IDs should be hidden in production (not dry-run)
      expect(status.channels.every((c) => c.chatId === '***')).toBe(true);
    });

    it('should show channel IDs in DRY_RUN mode', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_DRY_RUN = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001234567891';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001234567892';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001234567893';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001234567894';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001234567895';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001234567896';

      // Act
      router.initialize();
      const status = router.getStatus();

      // Assert
      expect(status.dryRun).toBe(true);
      // Chat IDs should be visible in dry-run mode
      expect(status.channels.find((c) => c.market === MarketId.O25)?.chatId).toBe('-1001234567890');
    });
  });

  // ============================================================================
  // TEST 9: Error Handling for Unconfigured Market
  // ============================================================================
  describe('Error Handling', () => {
    it('should throw error when getting chat ID for unconfigured market', () => {
      // Arrange
      process.env.TELEGRAM_PUBLISH_ENABLED = 'false';

      // Act
      router.initialize();

      // Assert
      expect(() => router.getTargetChatId('INVALID_MARKET' as MarketId)).toThrow(
        'No channel configured for market: INVALID_MARKET'
      );
    });
  });

  // ============================================================================
  // TEST 10: Singleton Pattern
  // ============================================================================
  describe('Singleton Pattern', () => {
    it('should return same instance on multiple getInstance calls', () => {
      // Act
      const instance1 = ChannelRouter.getInstance();
      const instance2 = ChannelRouter.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});
