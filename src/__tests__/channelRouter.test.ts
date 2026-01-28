/**
 * Channel Router Unit Tests - Week-2B Hardening
 *
 * Tests for Telegram channel routing system
 *
 * Coverage:
 * - Missing channel configuration behavior
 * - Fail-fast vs warning scenarios
 * - Correct market-to-channel mapping
 * - DRY_RUN mode behavior
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { ChannelRouter } from '../services/telegram/channelRouter';
import { MarketId } from '../types/markets';

describe('ChannelRouter - Week-2B Hardening', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset singleton instance before each test
    (ChannelRouter as any).instance = null;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Initialization - Configuration Validation', () => {
    it('should initialize successfully with all channels configured', () => {
      // Arrange: Set all required environment variables
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';

      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001111111112';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001111111113';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001111111114';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001111111115';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001111111116';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001111111117';

      // Act
      const router = ChannelRouter.getInstance();

      // Assert: Should not throw
      expect(() => router.initialize()).not.toThrow();
      expect(router.isInitialized()).toBe(true);
      expect(router.isPublishEnabled()).toBe(true);
      expect(router.isDryRun()).toBe(false);
    });

    it('should FAIL-FAST when publish enabled but channels missing', () => {
      // Arrange: Publish enabled but missing channels
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';

      // Only configure 3 channels (missing 4)
      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001111111112';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001111111113';
      // Missing: O35, HOME_O15, CORNERS_O85, CARDS_O25

      // Act & Assert: Should throw error
      const router = ChannelRouter.getInstance();

      expect(() => router.initialize()).toThrow(/CRITICAL.*required channel IDs are missing/);
    });

    it('should WARN ONLY when publish disabled but channels missing', () => {
      // Arrange: Publish disabled, missing channels should only warn
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'false';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';

      // Only configure 2 channels
      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001111111112';

      // Act: Should NOT throw, only warn
      const router = ChannelRouter.getInstance();

      expect(() => router.initialize()).not.toThrow();
      expect(router.isInitialized()).toBe(true);
      expect(router.isPublishEnabled()).toBe(false);
    });

    it('should allow partial config in DRY_RUN mode', () => {
      // Arrange: DRY_RUN mode should bypass validation
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      process.env.TELEGRAM_DRY_RUN = 'true'; // DRY_RUN bypasses validation

      // Only configure 1 channel
      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';

      // Act: Should not throw in dry-run mode
      const router = ChannelRouter.getInstance();

      expect(() => router.initialize()).not.toThrow();
      expect(router.isInitialized()).toBe(true);
      expect(router.isDryRun()).toBe(true);
    });

    it('should allow partial config when STRICT_CONFIG=false', () => {
      // Arrange: Non-strict mode allows partial config
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'false'; // Non-strict mode
      process.env.TELEGRAM_DRY_RUN = 'false';

      // Only configure 2 channels
      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001111111112';

      // Act: Should not throw in non-strict mode
      const router = ChannelRouter.getInstance();

      expect(() => router.initialize()).not.toThrow();
      expect(router.isInitialized()).toBe(true);
    });

    it('should fail when bot token missing and publish enabled', () => {
      // Arrange: No bot token
      delete process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';

      // Configure all channels
      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001111111112';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001111111113';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001111111114';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001111111115';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001111111116';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001111111117';

      // Act & Assert
      const router = ChannelRouter.getInstance();

      expect(() => router.initialize()).toThrow(/TELEGRAM_BOT_TOKEN is required/);
    });
  });

  describe('Market-to-Channel Mapping', () => {
    beforeEach(() => {
      // Configure full environment for mapping tests
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';

      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001111111112';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001111111113';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001111111114';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001111111115';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001111111116';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001111111117';
    });

    it('should map all 7 markets to correct channels', () => {
      // Arrange
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Act & Assert: Test each market mapping
      expect(router.getTargetChatId(MarketId.O25)).toBe('-1001111111111');
      expect(router.getTargetChatId(MarketId.BTTS)).toBe('-1001111111112');
      expect(router.getTargetChatId(MarketId.HT_O05)).toBe('-1001111111113');
      expect(router.getTargetChatId(MarketId.O35)).toBe('-1001111111114');
      expect(router.getTargetChatId(MarketId.HOME_O15)).toBe('-1001111111115');
      expect(router.getTargetChatId(MarketId.CORNERS_O85)).toBe('-1001111111116');
      expect(router.getTargetChatId(MarketId.CARDS_O25)).toBe('-1001111111117');
    });

    it('should return correct channel configs with display names', () => {
      // Arrange
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Act
      const o25Config = router.getChannelConfig(MarketId.O25);
      const bttsConfig = router.getChannelConfig(MarketId.BTTS);

      // Assert
      expect(o25Config).toMatchObject({
        marketId: MarketId.O25,
        chatId: '-1001111111111',
        displayName: '2.5 Üst Gol',
      });

      expect(bttsConfig).toMatchObject({
        marketId: MarketId.BTTS,
        chatId: '-1001111111112',
        displayName: 'Karşılıklı Gol',
      });
    });

    it('should return all 7 channels from getAllChannels()', () => {
      // Arrange
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Act
      const allChannels = router.getAllChannels();

      // Assert
      expect(allChannels).toHaveLength(7);
      expect(allChannels.map(c => c.marketId)).toEqual([
        MarketId.O25,
        MarketId.BTTS,
        MarketId.HT_O05,
        MarketId.O35,
        MarketId.HOME_O15,
        MarketId.CORNERS_O85,
        MarketId.CARDS_O25,
      ]);
    });

    it('should throw error for unconfigured market', () => {
      // Arrange
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Act & Assert: Trying to get invalid market
      expect(() => router.getTargetChatId('INVALID_MARKET' as MarketId)).toThrow(
        /No channel configured for market/
      );
    });
  });

  describe('Channel ID Normalization', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';

      // Configure channels with various formats
      process.env.TELEGRAM_CHANNEL_O25 = '-1001234567890'; // Standard format
      process.env.TELEGRAM_CHANNEL_BTTS = '@test_channel'; // Username format
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001111111113';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001111111114';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001111111115';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001111111116';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001111111117';
    });

    it('should accept channel IDs in -100 format', () => {
      // Arrange & Act
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Assert
      expect(router.getTargetChatId(MarketId.O25)).toBe('-1001234567890');
    });

    it('should accept channel usernames (@format)', () => {
      // Arrange & Act
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Assert
      expect(router.getTargetChatId(MarketId.BTTS)).toBe('@test_channel');
    });
  });

  describe('Status and Health Check', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:TEST_TOKEN';
      process.env.TELEGRAM_PUBLISH_ENABLED = 'true';
      process.env.TELEGRAM_STRICT_CONFIG = 'true';
      process.env.TELEGRAM_DRY_RUN = 'false';

      process.env.TELEGRAM_CHANNEL_O25 = '-1001111111111';
      process.env.TELEGRAM_CHANNEL_BTTS = '-1001111111112';
      process.env.TELEGRAM_CHANNEL_HT_O05 = '-1001111111113';
      process.env.TELEGRAM_CHANNEL_O35 = '-1001111111114';
      process.env.TELEGRAM_CHANNEL_HOME_O15 = '-1001111111115';
      process.env.TELEGRAM_CHANNEL_CORNERS_O85 = '-1001111111116';
      process.env.TELEGRAM_CHANNEL_CARDS_O25 = '-1001111111117';
    });

    it('should return correct router status', () => {
      // Arrange
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Act
      const status = router.getStatus();

      // Assert
      expect(status).toMatchObject({
        initialized: true,
        publishEnabled: true,
        strictConfig: true,
        dryRun: false,
        channelCount: 7,
      });

      expect(status.channels).toHaveLength(7);
      expect(status.channels[0]).toMatchObject({
        market: MarketId.O25,
        displayName: '2.5 Üst Gol',
        configured: true,
        chatId: '***', // Hidden in production
      });
    });

    it('should expose channel IDs in DRY_RUN mode', () => {
      // Arrange
      process.env.TELEGRAM_DRY_RUN = 'true';
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Act
      const status = router.getStatus();

      // Assert: Channel IDs visible in dry-run
      expect(status.channels[0].chatId).toBe('-1001111111111');
    });

    it('should hide channel IDs in production mode', () => {
      // Arrange
      process.env.TELEGRAM_DRY_RUN = 'false';
      const router = ChannelRouter.getInstance();
      router.initialize();

      // Act
      const status = router.getStatus();

      // Assert: Channel IDs hidden in production
      expect(status.channels[0].chatId).toBe('***');
    });
  });
});
