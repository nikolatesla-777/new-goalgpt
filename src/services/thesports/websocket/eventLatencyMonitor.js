"use strict";
/**
 * Event Latency Monitor
 *
 * Monitors and measures event broadcasting latency from MQTT message to frontend delivery.
 * Tracks performance metrics for optimization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLatencyMonitor = void 0;
var logger_1 = require("../../../utils/logger");
var EventLatencyMonitor = /** @class */ (function () {
    function EventLatencyMonitor() {
        var _this = this;
        this.measurements = [];
        this.maxMeasurements = 1000; // Keep last 1000 measurements
        this.statsInterval = null;
        // Log stats every 5 minutes
        this.statsInterval = setInterval(function () {
            _this.logStats();
        }, 5 * 60 * 1000);
    }
    /**
     * Record MQTT message received timestamp
     */
    EventLatencyMonitor.prototype.recordMqttReceived = function (eventType, matchId) {
        return Date.now();
    };
    /**
     * Record event emitted timestamp
     */
    EventLatencyMonitor.prototype.recordEventEmitted = function (eventType, matchId, mqttReceivedTs) {
        var eventEmittedTs = Date.now();
        var processingLatency = eventEmittedTs - mqttReceivedTs;
        // Store measurement (will be completed when broadcast is sent)
        var measurement = {
            eventType: eventType,
            matchId: matchId,
            mqttReceivedTs: mqttReceivedTs,
            eventEmittedTs: eventEmittedTs,
            broadcastSentTs: 0, // Will be set when broadcast is sent
            totalLatency: 0,
            processingLatency: processingLatency,
            broadcastLatency: 0,
        };
        // Store with matchId+eventType as key for completion
        var key = "".concat(matchId, ":").concat(eventType, ":").concat(mqttReceivedTs);
        this[key] = measurement;
    };
    /**
     * Record broadcast sent timestamp and complete measurement
     */
    EventLatencyMonitor.prototype.recordBroadcastSent = function (eventType, matchId, mqttReceivedTs) {
        var broadcastSentTs = Date.now();
        var key = "".concat(matchId, ":").concat(eventType, ":").concat(mqttReceivedTs);
        var measurement = this[key];
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
            logger_1.logger.warn("[LatencyMonitor] High latency detected: ".concat(eventType, " for ").concat(matchId, " - ") +
                "Total: ".concat(measurement.totalLatency, "ms, Processing: ").concat(measurement.processingLatency, "ms, Broadcast: ").concat(measurement.broadcastLatency, "ms"));
        }
    };
    /**
     * Calculate statistics for event type
     */
    EventLatencyMonitor.prototype.getStats = function (eventType) {
        var filtered = eventType
            ? this.measurements.filter(function (m) { return m.eventType === eventType; })
            : this.measurements;
        var byType = new Map();
        for (var _i = 0, filtered_1 = filtered; _i < filtered_1.length; _i++) {
            var m = filtered_1[_i];
            if (!byType.has(m.eventType)) {
                byType.set(m.eventType, []);
            }
            byType.get(m.eventType).push(m);
        }
        var stats = [];
        for (var _a = 0, _b = Array.from(byType.keys()); _a < _b.length; _a++) {
            var type = _b[_a];
            var measurements = byType.get(type);
            if (measurements.length === 0)
                continue;
            var latencies = measurements.map(function (m) { return m.totalLatency; }).sort(function (a, b) { return a - b; });
            var processingLatencies = measurements.map(function (m) { return m.processingLatency; });
            var broadcastLatencies = measurements.map(function (m) { return m.broadcastLatency; });
            var avgTotal = latencies.reduce(function (a, b) { return a + b; }, 0) / latencies.length;
            var avgProcessing = processingLatencies.reduce(function (a, b) { return a + b; }, 0) / processingLatencies.length;
            var avgBroadcast = broadcastLatencies.reduce(function (a, b) { return a + b; }, 0) / broadcastLatencies.length;
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
    };
    /**
     * Log statistics
     */
    EventLatencyMonitor.prototype.logStats = function () {
        var stats = this.getStats();
        if (stats.length === 0) {
            logger_1.logger.debug('[LatencyMonitor] No measurements yet');
            return;
        }
        logger_1.logger.info('[LatencyMonitor] === Event Broadcasting Latency Stats ===');
        for (var _i = 0, stats_1 = stats; _i < stats_1.length; _i++) {
            var stat = stats_1[_i];
            logger_1.logger.info("[LatencyMonitor] ".concat(stat.eventType, ": ") +
                "Count=".concat(stat.count, ", ") +
                "Avg=".concat(stat.avgTotalLatency, "ms, ") +
                "P50=".concat(stat.p50, "ms, ") +
                "P95=".concat(stat.p95, "ms, ") +
                "P99=".concat(stat.p99, "ms, ") +
                "Processing=".concat(stat.avgProcessingLatency, "ms, ") +
                "Broadcast=".concat(stat.avgBroadcastLatency, "ms"));
        }
        logger_1.logger.info('[LatencyMonitor] ========================================');
    };
    /**
     * Get current measurements count
     */
    EventLatencyMonitor.prototype.getMeasurementsCount = function () {
        return this.measurements.length;
    };
    /**
     * Clear all measurements
     */
    EventLatencyMonitor.prototype.clear = function () {
        this.measurements = [];
    };
    /**
     * Stop monitoring
     */
    EventLatencyMonitor.prototype.stop = function () {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        this.logStats(); // Final stats log
    };
    return EventLatencyMonitor;
}());
exports.EventLatencyMonitor = EventLatencyMonitor;
