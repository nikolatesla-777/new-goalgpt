"use strict";
/**
 * Metrics Utility - In-Memory Metrics Collection
 *
 * PR-7: Job Framework
 *
 * Features:
 * - Counter metrics (inc, add)
 * - Histogram/gauge metrics (observe, set)
 * - Tag support for dimensional metrics
 * - Prometheus-compatible export format
 * - Thread-safe (single-threaded Node.js)
 *
 * Usage:
 * ```typescript
 * metrics.inc('job.started', { jobName: 'matchWatchdog' });
 * metrics.observe('job.duration_ms', 1234, { jobName: 'matchWatchdog' });
 * const report = metrics.getReport();
 * const prometheus = metrics.toPrometheus();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
exports.recordJobExecution = recordJobExecution;
exports.recordApiCall = recordApiCall;
exports.recordDbQuery = recordDbQuery;
// ============================================================
// METRICS CLASS
// ============================================================
class Metrics {
    constructor() {
        this.counters = new Map();
        this.histograms = new Map();
        this.gauges = new Map();
    }
    /**
     * Generate a unique key for metric + tags combination
     */
    getKey(name, tags) {
        if (!tags || Object.keys(tags).length === 0) {
            return name;
        }
        const sortedTags = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${sortedTags}}`;
    }
    /**
     * Increment a counter metric
     */
    inc(name, tags, value = 1) {
        const key = this.getKey(name, tags);
        const existing = this.counters.get(key);
        if (existing) {
            existing.value += value;
            existing.lastUpdated = Date.now();
        }
        else {
            this.counters.set(key, {
                type: 'counter',
                value,
                tags: tags || {},
                lastUpdated: Date.now(),
            });
        }
    }
    /**
     * Add to a counter metric (alias for inc with custom value)
     */
    add(name, value, tags) {
        this.inc(name, tags, value);
    }
    /**
     * Observe a value for histogram metric
     */
    observe(name, value, tags) {
        const key = this.getKey(name, tags);
        const existing = this.histograms.get(key);
        if (existing) {
            existing.count += 1;
            existing.sum += value;
            existing.min = Math.min(existing.min, value);
            existing.max = Math.max(existing.max, value);
            existing.lastUpdated = Date.now();
        }
        else {
            this.histograms.set(key, {
                type: 'histogram',
                count: 1,
                sum: value,
                min: value,
                max: value,
                tags: tags || {},
                lastUpdated: Date.now(),
            });
        }
    }
    /**
     * Set a gauge metric value
     */
    set(name, value, tags) {
        const key = this.getKey(name, tags);
        this.gauges.set(key, {
            type: 'gauge',
            value,
            tags: tags || {},
            lastUpdated: Date.now(),
        });
    }
    /**
     * Get current value of a counter
     */
    getCounter(name, tags) {
        const key = this.getKey(name, tags);
        return this.counters.get(key)?.value || 0;
    }
    /**
     * Get current value of a gauge
     */
    getGauge(name, tags) {
        const key = this.getKey(name, tags);
        return this.gauges.get(key)?.value || 0;
    }
    /**
     * Get histogram statistics
     */
    getHistogram(name, tags) {
        const key = this.getKey(name, tags);
        const h = this.histograms.get(key);
        if (!h)
            return null;
        return {
            count: h.count,
            sum: h.sum,
            avg: h.count > 0 ? h.sum / h.count : 0,
            min: h.min,
            max: h.max,
        };
    }
    /**
     * Get full metrics report as JSON
     */
    getReport() {
        const counters = {};
        const histograms = {};
        const gauges = {};
        for (const [key, c] of this.counters) {
            counters[key] = { value: c.value, tags: c.tags };
        }
        for (const [key, h] of this.histograms) {
            histograms[key] = {
                count: h.count,
                sum: h.sum,
                avg: h.count > 0 ? h.sum / h.count : 0,
                min: h.min,
                max: h.max,
                tags: h.tags,
            };
        }
        for (const [key, g] of this.gauges) {
            gauges[key] = { value: g.value, tags: g.tags };
        }
        return {
            counters,
            histograms,
            gauges,
            collectedAt: new Date().toISOString(),
        };
    }
    /**
     * Export metrics in Prometheus text format
     */
    toPrometheus() {
        const lines = [];
        // Counters
        for (const [key, c] of this.counters) {
            const name = key.split('{')[0].replace(/\./g, '_');
            const tags = this.formatPrometheusTags(c.tags);
            lines.push(`# TYPE ${name} counter`);
            lines.push(`${name}${tags} ${c.value}`);
        }
        // Histograms (simplified - just sum and count)
        for (const [key, h] of this.histograms) {
            const name = key.split('{')[0].replace(/\./g, '_');
            const tags = this.formatPrometheusTags(h.tags);
            lines.push(`# TYPE ${name} summary`);
            lines.push(`${name}_count${tags} ${h.count}`);
            lines.push(`${name}_sum${tags} ${h.sum}`);
            lines.push(`${name}_min${tags} ${h.min}`);
            lines.push(`${name}_max${tags} ${h.max}`);
        }
        // Gauges
        for (const [key, g] of this.gauges) {
            const name = key.split('{')[0].replace(/\./g, '_');
            const tags = this.formatPrometheusTags(g.tags);
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name}${tags} ${g.value}`);
        }
        return lines.join('\n');
    }
    /**
     * Format tags for Prometheus output
     */
    formatPrometheusTags(tags) {
        if (!tags || Object.keys(tags).length === 0) {
            return '';
        }
        const formatted = Object.entries(tags)
            .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
            .join(',');
        return `{${formatted}}`;
    }
    /**
     * Reset all metrics (useful for testing)
     */
    reset() {
        this.counters.clear();
        this.histograms.clear();
        this.gauges.clear();
    }
    /**
     * Get all metric names
     */
    getMetricNames() {
        return {
            counters: Array.from(this.counters.keys()),
            histograms: Array.from(this.histograms.keys()),
            gauges: Array.from(this.gauges.keys()),
        };
    }
}
// ============================================================
// SINGLETON EXPORT
// ============================================================
exports.metrics = new Metrics();
// ============================================================
// HELPER FUNCTIONS
// ============================================================
/**
 * Record job execution metrics
 */
function recordJobExecution(jobName, status, durationMs) {
    exports.metrics.inc(`job.${status}`, { jobName });
    if (status !== 'skipped') {
        exports.metrics.observe('job.duration_ms', durationMs, { jobName });
    }
}
/**
 * Record API call metrics
 */
function recordApiCall(endpoint, status, durationMs) {
    exports.metrics.inc('api.calls', { endpoint, status: String(status) });
    exports.metrics.observe('api.duration_ms', durationMs, { endpoint });
}
/**
 * Record database query metrics
 */
function recordDbQuery(operation, table, durationMs) {
    exports.metrics.inc('db.queries', { operation, table });
    exports.metrics.observe('db.duration_ms', durationMs, { operation, table });
}
