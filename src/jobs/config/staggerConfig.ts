/**
 * P1: Job Stagger Configuration
 *
 * Converts 5-field cron expressions to 6-field with second offsets
 * to distribute high-frequency job execution and reduce DB pool contention.
 *
 * Features:
 * - Native 6-field cron syntax (node-cron v3.0.3 support)
 * - Config-based offsets via env vars
 * - Feature flag for instant rollback
 * - Collision detection and validation
 * - Zero breaking changes (default: no stagger)
 */

import { logger } from '../../utils/logger';

/**
 * Feature flag: Enable/disable job staggering globally
 * Default: false (safe rollout)
 */
export const STAGGER_ENABLED: boolean = process.env.JOB_STAGGER_ENABLED === 'true';

/**
 * Job name to second offset mapping
 * Valid range: 0-59 seconds
 * Default offsets optimize for zero collision
 */
export const STAGGER_OFFSETS: Record<string, number> = {
  // Every-minute jobs (0s, 15s, 30s, 45s)
  'Referral Tier 2 Processor': parseOffset(process.env.JOB_STAGGER_REFERRAL_T2, 0),
  'Referral Tier 3 Processor': parseOffset(process.env.JOB_STAGGER_REFERRAL_T3, 15),
  'Scheduled Notifications': parseOffset(process.env.JOB_STAGGER_NOTIFICATIONS, 30),
  'Live Stats Sync': parseOffset(process.env.JOB_STAGGER_STATS_SYNC, 45),

  // Every-5-minute jobs (5s, 25s)
  'Badge Auto-Unlock': parseOffset(process.env.JOB_STAGGER_BADGES, 5),
  'Prediction Matcher': parseOffset(process.env.JOB_STAGGER_PREDICTIONS, 25),

  // Every-10-minute jobs (10s, 40s)
  'Stuck Match Finisher': parseOffset(process.env.JOB_STAGGER_STUCK_MATCHES, 10),
  'Telegram Settlement': parseOffset(process.env.JOB_STAGGER_TELEGRAM, 40),
};

/**
 * Parse offset from env var with validation
 * @param value - Environment variable value
 * @param defaultValue - Fallback if invalid or missing
 * @returns Valid offset (0-59) or default
 */
function parseOffset(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    logger.warn(`[Stagger] Invalid offset value "${value}", using default ${defaultValue}`);
    return defaultValue;
  }

  if (parsed < 0 || parsed > 59) {
    logger.warn(`[Stagger] Offset ${parsed} out of range (0-59), using default ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * Get configured stagger offset for a job
 * @param jobName - Job name from jobManager
 * @returns Second offset (0 if unknown job or stagger disabled)
 */
export function getJobStaggerOffset(jobName: string): number {
  if (!STAGGER_ENABLED) return 0;
  return STAGGER_OFFSETS[jobName] || 0;
}

/**
 * Convert 5-field cron expression to 6-field with second offset
 *
 * @param originalCron - 5-field cron (e.g., "* * * * *")
 * @param jobName - Job name to lookup offset
 * @returns 6-field cron (e.g., "15 * * * * *") or original if stagger disabled
 *
 * @example
 * ```
 * applyCronStagger("* * * * *", "Referral Tier 3 Processor")
 * // Returns: "15 * * * * *"
 * ```
 *
 * @example
 * ```
 * applyCronStagger("* /5 * * * *", "Badge Auto-Unlock")
 * // Returns: "5 * /5 * * * *"
 * ```
 */
export function applyCronStagger(originalCron: string, jobName: string): string {
  if (!STAGGER_ENABLED) return originalCron;

  const offset = getJobStaggerOffset(jobName);

  // If offset is 0, no stagger needed
  if (offset === 0) return originalCron;

  const cronParts = originalCron.trim().split(/\s+/);

  // If already 6-field, preserve existing second field
  if (cronParts.length === 6) {
    logger.warn(`[Stagger] Job "${jobName}" already has 6-field cron, preserving: ${originalCron}`);
    return originalCron;
  }

  // Convert 5-field to 6-field by prepending second offset
  if (cronParts.length === 5) {
    return `${offset} ${originalCron}`;
  }

  // Invalid cron format
  logger.error(`[Stagger] Invalid cron format for "${jobName}": ${originalCron}`);
  return originalCron;
}

/**
 * Validate stagger configuration for collisions
 * Detects if multiple jobs will execute at same second
 *
 * @returns Validation result with collision details
 */
export function validateStaggerConfig(): {
  valid: boolean;
  collisions: string[];
} {
  if (!STAGGER_ENABLED) {
    return { valid: true, collisions: [] };
  }

  const collisions: string[] = [];
  const offsetMap = new Map<number, string[]>();

  // Group jobs by offset
  for (const [jobName, offset] of Object.entries(STAGGER_OFFSETS)) {
    if (!offsetMap.has(offset)) {
      offsetMap.set(offset, []);
    }
    offsetMap.get(offset)!.push(jobName);
  }

  // Detect collisions (multiple jobs at same offset)
  for (const [offset, jobs] of offsetMap.entries()) {
    if (jobs.length > 1) {
      collisions.push(`Offset ${offset}s: ${jobs.join(', ')}`);
    }
  }

  return {
    valid: collisions.length === 0,
    collisions,
  };
}

/**
 * Get human-readable stagger summary for logging
 */
export function getStaggerSummary(): string {
  if (!STAGGER_ENABLED) {
    return 'Job stagger: DISABLED';
  }

  const validation = validateStaggerConfig();
  const jobCount = Object.keys(STAGGER_OFFSETS).length;

  let summary = `Job stagger: ENABLED (${jobCount} jobs configured)\n`;

  if (validation.valid) {
    summary += '✅ No collisions detected\n';
  } else {
    summary += '⚠️ Collisions detected:\n';
    validation.collisions.forEach(c => {
      summary += `   - ${c}\n`;
    });
  }

  // Show offset distribution
  summary += '\nOffset Distribution:\n';
  const sortedOffsets = Object.entries(STAGGER_OFFSETS).sort((a, b) => a[1] - b[1]);
  sortedOffsets.forEach(([job, offset]) => {
    summary += `   ${offset.toString().padStart(2, ' ')}s - ${job}\n`;
  });

  return summary.trim();
}
