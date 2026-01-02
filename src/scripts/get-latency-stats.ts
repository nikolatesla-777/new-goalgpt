/**
 * Get Latency Stats
 * 
 * Script to get current latency statistics from EventLatencyMonitor
 * Useful for monitoring and debugging event broadcasting performance
 */

import 'dotenv/config';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { WebSocketService } from '../services/thesports/websocket/websocket.service';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';

async function getLatencyStats() {
  logger.info('📊 Getting latency statistics...\n');

  try {
    const theSportsClient = new TheSportsClient();
    const websocketService = new WebSocketService();
    
    // Wait a bit for events to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get latency monitor instance
    const latencyMonitor = (websocketService as any).latencyMonitor;
    
    if (!latencyMonitor) {
      logger.warn('⚠️ LatencyMonitor not initialized');
      return;
    }

    const stats = latencyMonitor.getStats();
    const count = latencyMonitor.getMeasurementsCount();

    logger.info(`📊 Total measurements: ${count}\n`);

    if (stats.length === 0) {
      logger.info('ℹ️ No latency measurements yet. Wait for events to be processed.');
      return;
    }

    logger.info('=== Event Broadcasting Latency Statistics ===\n');

    for (const stat of stats) {
      logger.info(`Event Type: ${stat.eventType}`);
      logger.info(`  Count: ${stat.count}`);
      logger.info(`  Average Total Latency: ${stat.avgTotalLatency}ms`);
      logger.info(`  Average Processing Latency: ${stat.avgProcessingLatency}ms`);
      logger.info(`  Average Broadcast Latency: ${stat.avgBroadcastLatency}ms`);
      logger.info(`  Min: ${stat.minLatency}ms`);
      logger.info(`  Max: ${stat.maxLatency}ms`);
      logger.info(`  P50: ${stat.p50}ms`);
      logger.info(`  P95: ${stat.p95}ms`);
      logger.info(`  P99: ${stat.p99}ms`);
      logger.info('');
    }

    logger.info('===========================================\n');

    // Performance assessment
    const goalStats = stats.find(s => s.eventType === 'GOAL');
    if (goalStats) {
      if (goalStats.avgTotalLatency < 100) {
        logger.info('✅ Goal event latency is EXCELLENT (<100ms)');
      } else if (goalStats.avgTotalLatency < 500) {
        logger.info('⚠️ Goal event latency is GOOD (<500ms) but could be improved');
      } else {
        logger.warn('❌ Goal event latency is HIGH (>500ms) - needs optimization');
      }
    }

  } catch (error: any) {
    logger.error('Error getting latency stats:', error);
  } finally {
    await pool.end();
  }
}

getLatencyStats().catch(console.error);

