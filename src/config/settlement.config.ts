/**
 * Settlement Configuration
 *
 * Centralized configuration for daily lists market settlement rules.
 * Externalized from hardcoded logic to enable easy tuning and validation.
 *
 * Phase 3: Settlement Configuration Externalization
 */

export type MarketType = 'OVER_25' | 'OVER_15' | 'BTTS' | 'HT_OVER_05' | 'CORNERS' | 'CARDS';

export interface MarketThreshold {
  market: MarketType;
  description: string;
  threshold: number;
  scoreType: 'FULL_TIME' | 'HALF_TIME' | 'SPECIAL';
  scorePath?: string; // JSON path for special scores (e.g., home_scores[4] for corners)
}

export interface SettlementConfig {
  markets: Record<MarketType, MarketThreshold>;
  finishThresholdHours: number; // Hours after match start to consider finished
}

/**
 * Default settlement configuration
 * Can be overridden by environment variables
 */
export const DEFAULT_SETTLEMENT_CONFIG: SettlementConfig = {
  markets: {
    OVER_25: {
      market: 'OVER_25',
      description: 'Over 2.5 Goals',
      threshold: 3, // 3 or more goals
      scoreType: 'FULL_TIME',
    },
    OVER_15: {
      market: 'OVER_15',
      description: 'Over 1.5 Goals',
      threshold: 2, // 2 or more goals
      scoreType: 'FULL_TIME',
    },
    BTTS: {
      market: 'BTTS',
      description: 'Both Teams To Score',
      threshold: 1, // Both teams score at least 1
      scoreType: 'FULL_TIME',
    },
    HT_OVER_05: {
      market: 'HT_OVER_05',
      description: 'Half-Time Over 0.5 Goals',
      threshold: 1, // 1 or more goals in first half
      scoreType: 'HALF_TIME',
      scorePath: 'home_scores[0].score + away_scores[0].score',
    },
    CORNERS: {
      market: 'CORNERS',
      description: 'Over 9.5 Corners',
      threshold: 10, // 10 or more corners
      scoreType: 'SPECIAL',
      scorePath: 'home_scores[4].score + away_scores[4].score',
    },
    CARDS: {
      market: 'CARDS',
      description: 'Over 4.5 Cards',
      threshold: 5, // 5 or more yellow cards
      scoreType: 'SPECIAL',
      scorePath: 'home_scores[2].score + away_scores[2].score',
    },
  },
  finishThresholdHours: 2, // Match considered finished 2 hours after start
};

/**
 * Validate settlement configuration
 * Ensures all markets are defined and thresholds are valid
 */
export function validateSettlementConfig(config: SettlementConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all required markets exist
  const requiredMarkets: MarketType[] = ['OVER_25', 'OVER_15', 'BTTS', 'HT_OVER_05', 'CORNERS', 'CARDS'];
  for (const market of requiredMarkets) {
    if (!config.markets[market]) {
      errors.push(`Missing market configuration: ${market}`);
    } else {
      const marketConfig = config.markets[market];

      // Validate threshold is positive
      if (marketConfig.threshold <= 0) {
        errors.push(`${market}: threshold must be positive (got ${marketConfig.threshold})`);
      }

      // Validate SPECIAL markets have scorePath
      if (marketConfig.scoreType === 'SPECIAL' && !marketConfig.scorePath) {
        errors.push(`${market}: SPECIAL scoreType requires scorePath`);
      }
    }
  }

  // Validate finishThresholdHours
  if (config.finishThresholdHours <= 0) {
    errors.push(`finishThresholdHours must be positive (got ${config.finishThresholdHours})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Load settlement configuration from environment (if provided)
 * Falls back to defaults if not set
 */
export function loadSettlementConfig(): SettlementConfig {
  // Deep copy to avoid mutating DEFAULT_SETTLEMENT_CONFIG
  const config: SettlementConfig = {
    finishThresholdHours: DEFAULT_SETTLEMENT_CONFIG.finishThresholdHours,
    markets: {
      OVER_25: { ...DEFAULT_SETTLEMENT_CONFIG.markets.OVER_25 },
      OVER_15: { ...DEFAULT_SETTLEMENT_CONFIG.markets.OVER_15 },
      BTTS: { ...DEFAULT_SETTLEMENT_CONFIG.markets.BTTS },
      HT_OVER_05: { ...DEFAULT_SETTLEMENT_CONFIG.markets.HT_OVER_05 },
      CORNERS: { ...DEFAULT_SETTLEMENT_CONFIG.markets.CORNERS },
      CARDS: { ...DEFAULT_SETTLEMENT_CONFIG.markets.CARDS },
    },
  };

  // Allow env override for finish threshold
  if (process.env.SETTLEMENT_FINISH_HOURS) {
    const hours = parseFloat(process.env.SETTLEMENT_FINISH_HOURS);
    if (!isNaN(hours) && hours > 0) {
      config.finishThresholdHours = hours;
    }
  }

  // Allow env override for individual thresholds
  // Format: SETTLEMENT_THRESHOLD_OVER_25=3
  const marketKeys: MarketType[] = ['OVER_25', 'OVER_15', 'BTTS', 'HT_OVER_05', 'CORNERS', 'CARDS'];
  for (const market of marketKeys) {
    const envKey = `SETTLEMENT_THRESHOLD_${market}`;
    const envValue = process.env[envKey];
    if (envValue) {
      const threshold = parseFloat(envValue);
      if (!isNaN(threshold) && threshold > 0) {
        config.markets[market].threshold = threshold;
      }
    }
  }

  // Validate loaded config
  const validation = validateSettlementConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid settlement configuration: ${validation.errors.join(', ')}`);
  }

  return config;
}

/**
 * Singleton instance - loaded once on startup
 */
let settlementConfig: SettlementConfig | null = null;

export function getSettlementConfig(): SettlementConfig {
  if (!settlementConfig) {
    settlementConfig = loadSettlementConfig();
  }
  return settlementConfig;
}

/**
 * Reset configuration (for testing)
 */
export function resetSettlementConfig(): void {
  settlementConfig = null;
}
