/**
 * Post Match Processor Job
 * 
 * Periodically runs to ensure all ended matches have their data persisted:
 * - Final statistics
 * - All incidents
 * - Final trend data
 * - Player statistics
 * - Standings updates
 * 
 * Runs every 30 minutes to catch up on any missed matches.
 */

import * as cron from 'node-cron';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { PostMatchProcessor } from '../services/liveData/postMatchProcessor';
import { logger } from '../utils/logger';

export class PostMatchProcessorJob {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private processor: PostMatchProcessor;

  private static readonly CRON_TIMEZONE = 'Europe/Istanbul';

  constructor(client: TheSportsClient) {
    this.processor = new PostMatchProcessor(client);
  }

  /**
   * Run the processor
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[PostMatchJob] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🔄 [PostMatchJob] Processing ended matches...');

      const result = await this.processor.processEndedMatches(50);

      const duration = Date.now() - startTime;
      logger.info(`✅ [PostMatchJob] Completed in ${duration}ms: ${result.processed} processed, ${result.success} success, ${result.failed} failed`);

    } catch (error: any) {
      logger.error('[PostMatchJob] Job failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the job
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('[PostMatchJob] Job already started');
      return;
    }

    // Run every 30 minutes
    this.cronJob = cron.schedule(
      '*/30 * * * *',
      async () => {
        await this.run();
      },
      { timezone: PostMatchProcessorJob.CRON_TIMEZONE }
    );

    logger.info('📊 [PostMatchJob] Job started:');
    logger.info('   ⏰ Schedule: Every 30 minutes');
    logger.info('   🎯 Target: Recently ended matches missing data');
    logger.info('   🕒 Timezone: Europe/Istanbul');

    // Run immediately on start to catch up on missed matches
    setTimeout(() => {
      this.run();
    }, 30000); // 30 seconds after server start
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    logger.info('[PostMatchJob] Job stopped');
  }

  /**
   * Get the processor instance for direct use
   */
  getProcessor(): PostMatchProcessor {
    return this.processor;
  }
}

