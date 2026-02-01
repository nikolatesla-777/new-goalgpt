/**
 * P1: Job Stagger Configuration Tests
 *
 * Tests for cron conversion, offset validation, and collision detection.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Store original env vars
const originalEnv = { ...process.env };

describe('Job Stagger Configuration', () => {
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = { ...originalEnv };
    // Clear module cache to reload with new env vars
    jest.resetModules();
  });

  describe('applyCronStagger', () => {
    it('should convert 5-field every-minute to 6-field with offset', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = '15';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('* * * * *', 'Referral Tier 3 Processor');

      expect(result).toBe('15 * * * * *');
    });

    it('should convert 5-field every-5-minutes to 6-field with offset', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_BADGES = '5';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('*/5 * * * *', 'Badge Auto-Unlock');

      expect(result).toBe('5 */5 * * * *');
    });

    it('should convert 5-field every-10-minutes to 6-field with offset', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_STUCK_MATCHES = '10';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('*/10 * * * *', 'Stuck Match Finisher');

      expect(result).toBe('10 */10 * * * *');
    });

    it('should preserve 5-field when stagger disabled', async () => {
      process.env.JOB_STAGGER_ENABLED = 'false';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('* * * * *', 'Referral Tier 3 Processor');

      expect(result).toBe('* * * * *');
    });

    it('should return original cron when offset is 0', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T2 = '0';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('* * * * *', 'Referral Tier 2 Processor');

      expect(result).toBe('* * * * *');
    });

    it('should handle unknown job name (defaults to offset 0)', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('* * * * *', 'Unknown Job');

      expect(result).toBe('* * * * *');
    });

    it('should preserve existing 6-field cron', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = '15';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('30 * * * * *', 'Referral Tier 3 Processor');

      expect(result).toBe('30 * * * * *');
    });

    it('should return original for invalid cron format', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = '15';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');
      const result = applyCronStagger('invalid cron', 'Referral Tier 3 Processor');

      expect(result).toBe('invalid cron');
    });
  });

  describe('getJobStaggerOffset', () => {
    it('should return 0 when stagger disabled', async () => {
      process.env.JOB_STAGGER_ENABLED = 'false';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 3 Processor');

      expect(result).toBe(0);
    });

    it('should return configured offset when stagger enabled', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = '15';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 3 Processor');

      expect(result).toBe(15);
    });

    it('should return 0 for unknown job', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Unknown Job');

      expect(result).toBe(0);
    });
  });

  describe('Offset Validation', () => {
    it('should use default when env var is missing', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      // JOB_STAGGER_REFERRAL_T3 not set

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 3 Processor');

      expect(result).toBe(15); // Default from STAGGER_OFFSETS
    });

    it('should use default when offset is invalid (NaN)', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = 'invalid';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 3 Processor');

      expect(result).toBe(15); // Default
    });

    it('should use default when offset is out of range (negative)', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = '-5';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 3 Processor');

      expect(result).toBe(15); // Default
    });

    it('should use default when offset is out of range (>59)', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = '60';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 3 Processor');

      expect(result).toBe(15); // Default
    });

    it('should accept valid offsets at boundary (0)', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T2 = '0';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 2 Processor');

      expect(result).toBe(0);
    });

    it('should accept valid offsets at boundary (59)', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T3 = '59';

      const { getJobStaggerOffset } = await import('../../jobs/config/staggerConfig');
      const result = getJobStaggerOffset('Referral Tier 3 Processor');

      expect(result).toBe(59);
    });
  });

  describe('validateStaggerConfig', () => {
    it('should return valid when stagger disabled', async () => {
      process.env.JOB_STAGGER_ENABLED = 'false';

      const { validateStaggerConfig } = await import('../../jobs/config/staggerConfig');
      const result = validateStaggerConfig();

      expect(result.valid).toBe(true);
      expect(result.collisions).toHaveLength(0);
    });

    it('should detect no collisions with default config', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      // Use default offsets (0, 15, 30, 45, 5, 25, 10, 40)

      const { validateStaggerConfig } = await import('../../jobs/config/staggerConfig');
      const result = validateStaggerConfig();

      expect(result.valid).toBe(true);
      expect(result.collisions).toHaveLength(0);
    });

    it('should detect collision when two jobs have same offset', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';
      process.env.JOB_STAGGER_REFERRAL_T2 = '15';
      process.env.JOB_STAGGER_REFERRAL_T3 = '15'; // Same as T2

      const { validateStaggerConfig } = await import('../../jobs/config/staggerConfig');
      const result = validateStaggerConfig();

      expect(result.valid).toBe(false);
      expect(result.collisions.length).toBeGreaterThan(0);
      expect(result.collisions[0]).toContain('Referral Tier 2 Processor');
      expect(result.collisions[0]).toContain('Referral Tier 3 Processor');
    });
  });

  describe('Integration Tests', () => {
    it('should have offsets for all 8 high-frequency jobs', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';

      const { STAGGER_OFFSETS } = await import('../../jobs/config/staggerConfig');

      const requiredJobs = [
        'Referral Tier 2 Processor',
        'Referral Tier 3 Processor',
        'Scheduled Notifications',
        'Live Stats Sync',
        'Badge Auto-Unlock',
        'Prediction Matcher',
        'Stuck Match Finisher',
        'Telegram Settlement',
      ];

      requiredJobs.forEach((job) => {
        expect(STAGGER_OFFSETS).toHaveProperty(job);
        expect(typeof STAGGER_OFFSETS[job]).toBe('number');
        expect(STAGGER_OFFSETS[job]).toBeGreaterThanOrEqual(0);
        expect(STAGGER_OFFSETS[job]).toBeLessThanOrEqual(59);
      });
    });

    it('should have unique offsets for all jobs (default config)', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';

      const { STAGGER_OFFSETS } = await import('../../jobs/config/staggerConfig');

      const offsets = Object.values(STAGGER_OFFSETS);
      const uniqueOffsets = new Set(offsets);

      expect(uniqueOffsets.size).toBe(offsets.length);
    });

    it('should generate correct 6-field cron for all job types', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';

      const { applyCronStagger } = await import('../../jobs/config/staggerConfig');

      const testCases = [
        { cron: '* * * * *', job: 'Referral Tier 2 Processor', expected: '* * * * *' }, // Offset 0, no change
        { cron: '* * * * *', job: 'Referral Tier 3 Processor', expected: '15 * * * * *' },
        { cron: '*/5 * * * *', job: 'Badge Auto-Unlock', expected: '5 */5 * * * *' },
        { cron: '*/10 * * * *', job: 'Stuck Match Finisher', expected: '10 */10 * * * *' },
      ];

      testCases.forEach(({ cron, job, expected }) => {
        const result = applyCronStagger(cron, job);
        expect(result).toBe(expected);
      });
    });
  });

  describe('getStaggerSummary', () => {
    it('should return disabled message when stagger disabled', async () => {
      process.env.JOB_STAGGER_ENABLED = 'false';

      const { getStaggerSummary } = await import('../../jobs/config/staggerConfig');
      const result = getStaggerSummary();

      expect(result).toContain('DISABLED');
    });

    it('should show collision-free status with default config', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';

      const { getStaggerSummary } = await import('../../jobs/config/staggerConfig');
      const result = getStaggerSummary();

      expect(result).toContain('ENABLED');
      expect(result).toContain('No collisions');
    });

    it('should list all configured jobs', async () => {
      process.env.JOB_STAGGER_ENABLED = 'true';

      const { getStaggerSummary } = await import('../../jobs/config/staggerConfig');
      const result = getStaggerSummary();

      expect(result).toContain('Referral Tier 2 Processor');
      expect(result).toContain('Referral Tier 3 Processor');
      expect(result).toContain('Badge Auto-Unlock');
      expect(result).toContain('Stuck Match Finisher');
    });
  });
});
