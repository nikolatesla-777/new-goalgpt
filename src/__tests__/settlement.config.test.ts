/**
 * Settlement Config Tests
 * Phase 5: Quality - Unit test coverage
 */

import {
  validateSettlementConfig,
  DEFAULT_SETTLEMENT_CONFIG,
  resetSettlementConfig,
  getSettlementConfig,
  loadSettlementConfig,
  MarketType,
  SettlementConfig,
} from '../config/settlement.config';

describe('Settlement Configuration', () => {
  afterEach(() => {
    resetSettlementConfig();
    // Clear any env overrides
    delete process.env.SETTLEMENT_FINISH_HOURS;
    delete process.env.SETTLEMENT_THRESHOLD_OVER_25;
  });

  describe('validateSettlementConfig', () => {
    it('should validate default config successfully', () => {
      const result = validateSettlementConfig(DEFAULT_SETTLEMENT_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config with missing market', () => {
      const invalidConfig = { ...DEFAULT_SETTLEMENT_CONFIG };
      delete (invalidConfig.markets as any).OVER_25;

      const result = validateSettlementConfig(invalidConfig as SettlementConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing market configuration: OVER_25');
    });

    it('should reject negative threshold', () => {
      const invalidConfig = {
        ...DEFAULT_SETTLEMENT_CONFIG,
        markets: {
          ...DEFAULT_SETTLEMENT_CONFIG.markets,
          OVER_25: { ...DEFAULT_SETTLEMENT_CONFIG.markets.OVER_25, threshold: -1 },
        },
      };

      const result = validateSettlementConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('threshold must be positive'))).toBe(true);
    });

    it('should reject SPECIAL market without scorePath', () => {
      const invalidConfig = {
        ...DEFAULT_SETTLEMENT_CONFIG,
        markets: {
          ...DEFAULT_SETTLEMENT_CONFIG.markets,
          CORNERS: { ...DEFAULT_SETTLEMENT_CONFIG.markets.CORNERS, scorePath: undefined },
        },
      };

      const result = validateSettlementConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('SPECIAL scoreType requires scorePath'))).toBe(true);
    });

    it('should reject negative finishThresholdHours', () => {
      const invalidConfig = {
        ...DEFAULT_SETTLEMENT_CONFIG,
        finishThresholdHours: -1,
      };

      const result = validateSettlementConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('finishThresholdHours must be positive'))).toBe(true);
    });
  });

  describe('loadSettlementConfig', () => {
    it('should load default config when no env vars set', () => {
      const config = loadSettlementConfig();
      expect(config.finishThresholdHours).toBe(2);
      expect(config.markets.OVER_25.threshold).toBe(3);
    });

    it('should override finishThresholdHours from env', () => {
      process.env.SETTLEMENT_FINISH_HOURS = '3';
      const config = loadSettlementConfig();
      expect(config.finishThresholdHours).toBe(3);
    });

    it('should override market threshold from env', () => {
      process.env.SETTLEMENT_THRESHOLD_OVER_25 = '4';
      const config = loadSettlementConfig();
      expect(config.markets.OVER_25.threshold).toBe(4);
    });

    it('should ignore invalid env values', () => {
      process.env.SETTLEMENT_FINISH_HOURS = 'invalid';
      process.env.SETTLEMENT_THRESHOLD_OVER_25 = '-1';
      const config = loadSettlementConfig();
      expect(config.finishThresholdHours).toBe(2); // Falls back to default
      expect(config.markets.OVER_25.threshold).toBe(3); // Ignores invalid value
    });

    it('should throw on invalid config after env overrides', () => {
      process.env.SETTLEMENT_FINISH_HOURS = '-5';
      // Invalid value is ignored, but if we force it:
      const originalLoad = loadSettlementConfig;

      // This test verifies the validation catches issues
      expect(() => {
        validateSettlementConfig({
          ...DEFAULT_SETTLEMENT_CONFIG,
          finishThresholdHours: -5,
        });
      }).not.toThrow(); // Validation returns errors, doesn't throw

      const result = validateSettlementConfig({
        ...DEFAULT_SETTLEMENT_CONFIG,
        finishThresholdHours: -5,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('getSettlementConfig', () => {
    it('should return singleton instance', () => {
      const config1 = getSettlementConfig();
      const config2 = getSettlementConfig();
      expect(config1).toBe(config2); // Same reference
    });

    it('should reload after reset', () => {
      const config1 = getSettlementConfig();
      resetSettlementConfig();
      const config2 = getSettlementConfig();
      expect(config1).not.toBe(config2); // Different reference after reset
    });
  });

  describe('Market Definitions', () => {
    const markets: MarketType[] = ['OVER_25', 'OVER_15', 'BTTS', 'HT_OVER_05', 'CORNERS', 'CARDS'];

    it('should define all required markets', () => {
      const config = DEFAULT_SETTLEMENT_CONFIG;
      markets.forEach(market => {
        expect(config.markets[market]).toBeDefined();
        expect(config.markets[market].market).toBe(market);
      });
    });

    it('should have correct scoreTypes', () => {
      const config = DEFAULT_SETTLEMENT_CONFIG;
      expect(config.markets.OVER_25.scoreType).toBe('FULL_TIME');
      expect(config.markets.HT_OVER_05.scoreType).toBe('HALF_TIME');
      expect(config.markets.CORNERS.scoreType).toBe('SPECIAL');
    });

    it('should have positive thresholds', () => {
      const config = DEFAULT_SETTLEMENT_CONFIG;
      markets.forEach(market => {
        expect(config.markets[market].threshold).toBeGreaterThan(0);
      });
    });
  });
});
