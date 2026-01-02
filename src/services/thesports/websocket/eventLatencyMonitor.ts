/**
 * Event Latency Monitor
 * 
 * Monitors and measures event broadcasting latency from MQTT message to frontend delivery.
 * Tracks performance metrics for optimization.
 */

import { logger } from '../../../utils/logger';
import { MatchEvent } from './event-detector';

interface LatencyMeasurement {
  eventType: string;
  matchId: string;
  mqttReceivedTs: number;      // When MQTT message was received
  eventEmittedTs: number;       // When emitEvent() was called
  broadcastSentTs: number;      // When broadcastEvent() sent to clients
  totalLatency: number;         // Total latency (mqttReceivedTs to broadcastSentTs)
  processingLatency: number;    // Processing latency (mqttReceivedTs to eventEmittedTs)
  broadcastLatency: number;     // Broadcast latency (eventEmittedTs to broadcastSentTs)
}

interface LatencyStats {
  eventType: string;
  count: number;
  avgTotalLatency: number;
  avgProcessingLatency: number;
  avgBroadcastLatency: number;
  minLatency: number;
  maxLatency: number;
  p50: number;
  p95: number;
  p99: number;
}

export class EventLatencyMonitor {
  private measurements: LatencyMeasurement[] = [];
  private readonly maxMeasurements = 1000; // Keep last 1000 measurements
  private readonly statsInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Log stats every 5 minutes
    this.statsInterval = setInterval(() => {
      this.logStats();
    }, 5 * 60 * 1000);
  }

  /**
   * Record MQTT message received timestamp
   */
  recordMqttReceived(eventType: string, matchId: string): number {
    return Date.now();
  }

  /**
   * Record event emitted timestamp
   */
  recordEventEmitted(eventType: string, matchId: string, mqttReceivedTs: number): void {
    const eventEmittedTs = Date.now();
    const processingLatency = eventEmittedTs - mqttReceivedTs;

    // Store measurement (will be completed when broadcast is sent)
    const measurement: LatencyMeasurement = {
      eventType,
      matchId,
      mqttReceivedTs,
      eventEmittedTs,
      broadcastSentTs: 0, // Will be set when broadcast is sent
      totalLatency: 0,
      processingLatency,
      broadcastLatency: 0,
    };

    // Store with matchId+eventType as key for completion
    const key = `${matchId}:${eventType}:${mqttReceivedTs}`;
    (this as any)[key] = measurement;
  }

  /**
   * Record broadcast sent timestamp and complete measurement
   */
  recordBroadcastSent(eventType: string, matchId: string, mqttReceivedTs: number): void {
    const broadcastSentTs = Date.now();
    const key = `${matchId}:${eventType}:${mqttReceivedTs}`;
    const measurement = (this as any)[key] as LatencyMeasurement | undefined;

    if (!measurement) {
      // Measurement not found (might have been cleaned up)
      return;
    }

    measurement.broadcastSentTs = broadcastSentTs;
    measurement.totalLatency = broadcastSentTs - measurement.mqttReceivedTs;
    measurement.broadcastLatency = broadcastSentTs - measurement.eventEmittedTs;

    // Add to measurements array
    this.measurements.push(measurement);

    // Cleanup old measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }

    // Cleanup temporary storage
    delete (this as any)[key];

    // Log high latency events (>100ms)
    if (measurement.totalLatency > 100) {
      logger.warn(
        `[LatencyMonitor] High latency detected: ${eventType} for ${matchId} - ` +
        `Total: ${measurement.totalLatency}ms, Processing: ${measurement.processingLatency}ms, Broadcast: ${measurement.broadcastLatency}ms`
      );
    }
  }

  /**
   * Calculate statistics for event type
   */
  getStats(eventType?: string): LatencyStats[] {
    const filtered = eventType
      ? this.measurements.filter(m => m.eventType === eventType)
      : this.measurements;

    const byType = new Map<string, LatencyMeasurement[]>();
    for (const m of filtered) {
      if (!byType.has(m.eventType)) {
        byType.set(m.eventType, []);
      }
      byType.get(m.eventType)!.push(m);
    }

    const stats: LatencyStats[] = [];

    for (const type of Array.from(byType.keys())) {
      const measurements = byType.get(type)!;
      if (measurements.length === 0) continue;

      const latencies = measurements.map(m => m.totalLatency).sort((a, b) => a - b);
      const processingLatencies = measurements.map(m => m.processingLatency);
      const broadcastLatencies = measurements.map(m => m.broadcastLatency);

      const avgTotal = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const avgProcessing = processingLatencies.reduce((a, b) => a + b, 0) / processingLatencies.length;
      const avgBroadcast = broadcastLatencies.reduce((a, b) => a + b, 0) / broadcastLatencies.length;

      stats.push({
        eventType: type,
        count: measurements.length,
        avgTotalLatency: Math.round(avgTotal * 100) / 100,
        avgProcessingLatency: Math.round(avgProcessing * 100) / 100,
        avgBroadcastLatency: Math.round(avgBroadcast * 100) / 100,
        minLatency: latencies[0],
        maxLatency: latencies[latencies.length - 1],
        p50: latencies[Math.floor(latencies.length * 0.5)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)],
      });
    }

    return stats;
  }

  /**
   * Log statistics
   */
  private logStats(): void {
    const stats = this.getStats();
    
    if (stats.length === 0) {
      logger.debug('[LatencyMonitor] No measurements yet');
      return;
    }

    logger.info('[LatencyMonitor] === Event Broadcasting Latency Stats ===');
    for (const stat of stats) {
      logger.info(
        `[LatencyMonitor] ${stat.eventType}: ` +
        `Count=${stat.count}, ` +
        `Avg=${stat.avgTotalLatency}ms, ` +
        `P50=${stat.p50}ms, ` +
        `P95=${stat.p95}ms, ` +
        `P99=${stat.p99}ms, ` +
        `Processing=${stat.avgProcessingLatency}ms, ` +
        `Broadcast=${stat.avgBroadcastLatency}ms`
      );
    }
    logger.info('[LatencyMonitor] ========================================');
  }

  /**
   * Get current measurements count
   */
  getMeasurementsCount(): number {
    return this.measurements.length;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements = [];
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    this.logStats(); // Final stats log
  }
}

