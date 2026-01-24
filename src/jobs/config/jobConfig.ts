/**
 * Centralized Job Configuration
 *
 * All job timeouts, batch sizes, and tuneable parameters in one place.
 * Environment variables allow production tuning without code changes.
 */

export const JOB_CONFIG = {
  /**
   * Match Minute Job - Updates live match data every minute
   */
  MATCH_MINUTE: {
    /** Job execution timeout (default: 2 minutes) */
    TIMEOUT_MS: parseInt(process.env.MATCH_MINUTE_TIMEOUT_MS || '120000'),

    /** Max matches to fetch per execution (default: 100) */
    BATCH_SIZE: parseInt(process.env.MATCH_MINUTE_BATCH_SIZE || '100'),

    /** Max concurrent orchestrator updates per tick (default: 50) */
    MAX_UPDATES_PER_TICK: parseInt(process.env.MAX_UPDATES_PER_TICK || '50'),

    /** Cron schedule (every minute) */
    CRON: '* * * * *',
  },

  /**
   * Match Watchdog Job - Monitors stuck matches
   */
  MATCH_WATCHDOG: {
    /** Job execution timeout (default: 5 minutes) */
    TIMEOUT_MS: parseInt(process.env.MATCH_WATCHDOG_TIMEOUT_MS || '300000'),

    /** Cron schedule (every 5 minutes) */
    CRON: '*/5 * * * *',
  },

  /**
   * Match Daily Job - Daily match data sync
   */
  MATCH_DAILY: {
    /** Job execution timeout (default: 10 minutes) */
    TIMEOUT_MS: parseInt(process.env.MATCH_DAILY_TIMEOUT_MS || '600000'),

    /** Cron schedule (every 6 hours) */
    CRON: '0 */6 * * *',
  },

  /**
   * AI Prediction Jobs
   */
  AI_PREDICTION: {
    /** Job execution timeout (default: 5 minutes) */
    TIMEOUT_MS: parseInt(process.env.AI_PREDICTION_TIMEOUT_MS || '300000'),

    /** Batch size for prediction generation */
    BATCH_SIZE: parseInt(process.env.AI_PREDICTION_BATCH_SIZE || '50'),
  },

  /**
   * General orchestrator settings
   */
  ORCHESTRATOR: {
    /** Default lock timeout for advisory locks (default: 10 seconds) */
    LOCK_TIMEOUT_MS: parseInt(process.env.ORCHESTRATOR_LOCK_TIMEOUT_MS || '10000'),

    /** Max retry attempts for failed updates */
    MAX_RETRIES: parseInt(process.env.ORCHESTRATOR_MAX_RETRIES || '3'),
  },
} as const;

/**
 * Validate configuration on module load
 */
function validateConfig() {
  const errors: string[] = [];

  // Validate positive integers
  if (JOB_CONFIG.MATCH_MINUTE.TIMEOUT_MS <= 0) {
    errors.push('MATCH_MINUTE_TIMEOUT_MS must be > 0');
  }
  if (JOB_CONFIG.MATCH_MINUTE.BATCH_SIZE <= 0) {
    errors.push('MATCH_MINUTE_BATCH_SIZE must be > 0');
  }
  if (JOB_CONFIG.MATCH_MINUTE.MAX_UPDATES_PER_TICK <= 0) {
    errors.push('MAX_UPDATES_PER_TICK must be > 0');
  }

  // Warn about extreme values
  if (JOB_CONFIG.MATCH_MINUTE.MAX_UPDATES_PER_TICK > 100) {
    console.warn('⚠️ MAX_UPDATES_PER_TICK > 100 may cause pool exhaustion');
  }
  if (JOB_CONFIG.MATCH_MINUTE.BATCH_SIZE > 500) {
    console.warn('⚠️ MATCH_MINUTE_BATCH_SIZE > 500 may cause memory issues');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid job config: ${errors.join(', ')}`);
  }
}

// Validate on import
validateConfig();

/**
 * Get human-readable config summary for debugging
 */
export function getConfigSummary(): string {
  return `
=== Job Configuration ===
MATCH_MINUTE:
  - Timeout: ${JOB_CONFIG.MATCH_MINUTE.TIMEOUT_MS}ms
  - Batch Size: ${JOB_CONFIG.MATCH_MINUTE.BATCH_SIZE}
  - Max Updates/Tick: ${JOB_CONFIG.MATCH_MINUTE.MAX_UPDATES_PER_TICK}

MATCH_WATCHDOG:
  - Timeout: ${JOB_CONFIG.MATCH_WATCHDOG.TIMEOUT_MS}ms

ORCHESTRATOR:
  - Lock Timeout: ${JOB_CONFIG.ORCHESTRATOR.LOCK_TIMEOUT_MS}ms
  - Max Retries: ${JOB_CONFIG.ORCHESTRATOR.MAX_RETRIES}
  `.trim();
}
