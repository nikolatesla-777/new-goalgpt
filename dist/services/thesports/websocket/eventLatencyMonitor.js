"use strict";
/**
 * Event Latency Monitor
 *
 * Monitors and measures event broadcasting latency from MQTT message to frontend delivery.
 * Tracks performance metrics for optimization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLatencyMonitor = void 0;
const logger_1 = require("../../../utils/logger");
class EventLatencyMonitor {
    constructor() {
        this.measurements = [];
        this.maxMeasurements = 1000; // Keep last 1000 measurements
        this.statsInterval = null;
        // Log stats every 5 minutes
        this.statsInterval = setInterval(() => {
            this.logStats();
        }, 5 * 60 * 1000);
    }
    /**
     * Record MQTT message received timestamp
     */
    recordMqttReceived(eventType, matchId) {
        return Date.now();
    }
    /**
     * Record event emitted timestamp
     */
    recordEventEmitted(eventType, matchId, mqttReceivedTs) {
        const eventEmittedTs = Date.now();
        const processingLatency = eventEmittedTs - mqttReceivedTs;
        // Store measurement (will be completed when broadcast is sent)
        const measurement = {
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
        this[key] = measurement;
    }
    /**
     * Record broadcast sent timestamp and complete measurement
     */
    recordBroadcastSent(eventType, matchId, mqttReceivedTs) {
        const broadcastSentTs = Date.now();
        const key = `${matchId}:${eventType}:${mqttReceivedTs}`;
        const measurement = this[key];
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
        delete this[key];
        // Log high latency events (>100ms)
        if (measurement.totalLatency > 100) {
            logger_1.logger.warn(`[LatencyMonitor] High latency detected: ${eventType} for ${matchId} - ` +
                `Total: ${measurement.totalLatency}ms, Processing: ${measurement.processingLatency}ms, Broadcast: ${measurement.broadcastLatency}ms`);
        }
    }
    /**
     * Calculate statistics for event type
     */
    getStats(eventType) {
        const filtered = eventType
            ? this.measurements.filter(m => m.eventType === eventType)
            : this.measurements;
        const byType = new Map();
        for (const m of filtered) {
            if (!byType.has(m.eventType)) {
                byType.set(m.eventType, []);
            }
            byType.get(m.eventType).push(m);
        }
        const stats = [];
        for (const type of Array.from(byType.keys())) {
            const measurements = byType.get(type);
            if (measurements.length === 0)
                continue;
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
    logStats() {
        const stats = this.getStats();
        if (stats.length === 0) {
            logger_1.logger.debug('[LatencyMonitor] No measurements yet');
            return;
        }
        logger_1.logger.info('[LatencyMonitor] === Event Broadcasting Latency Stats ===');
        for (const stat of stats) {
            logger_1.logger.info(`[LatencyMonitor] ${stat.eventType}: ` +
                `Count=${stat.count}, ` +
                `Avg=${stat.avgTotalLatency}ms, ` +
                `P50=${stat.p50}ms, ` +
                `P95=${stat.p95}ms, ` +
                `P99=${stat.p99}ms, ` +
                `Processing=${stat.avgProcessingLatency}ms, ` +
                `Broadcast=${stat.avgBroadcastLatency}ms`);
        }
        logger_1.logger.info('[LatencyMonitor] ========================================');
    }
    /**
     * Get current measurements count
     */
    getMeasurementsCount() {
        return this.measurements.length;
    }
    /**
     * Clear all measurements
     */
    clear() {
        this.measurements = [];
    }
    /**
     * Stop monitoring
     */
    stop() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        this.logStats(); // Final stats log
    }
}
exports.EventLatencyMonitor = EventLatencyMonitor;
