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

// ============================================================
// TYPES
// ============================================================

export interface MetricTags {
  [key: string]: string | number | boolean;
}

interface CounterMetric {
  type: 'counter';
  value: number;
  tags: MetricTags;
  lastUpdated: number;
}

interface HistogramMetric {
  type: 'histogram';
  count: number;
  sum: number;
  min: number;
  max: number;
  tags: MetricTags;
  lastUpdated: number;
}

interface GaugeMetric {
  type: 'gauge';
  value: number;
  tags: MetricTags;
  lastUpdated: number;
}

type Metric = CounterMetric | HistogramMetric | GaugeMetric;

// ============================================================
// METRICS CLASS
// ============================================================

class Metrics {
  private counters = new Map<string, CounterMetric>();
  private histograms = new Map<string, HistogramMetric>();
  private gauges = new Map<string, GaugeMetric>();

  /**
   * Generate a unique key for metric + tags combination
   */
  private getKey(name: string, tags?: MetricTags): string {
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
  inc(name: string, tags?: MetricTags, value: number = 1): void {
    const key = this.getKey(name, tags);
    const existing = this.counters.get(key);

    if (existing) {
      existing.value += value;
      existing.lastUpdated = Date.now();
    } else {
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
  add(name: string, value: number, tags?: MetricTags): void {
    this.inc(name, tags, value);
  }

  /**
   * Observe a value for histogram metric
   */
  observe(name: string, value: number, tags?: MetricTags): void {
    const key = this.getKey(name, tags);
    const existing = this.histograms.get(key);

    if (existing) {
      existing.count += 1;
      existing.sum += value;
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.lastUpdated = Date.now();
    } else {
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
  set(name: string, value: number, tags?: MetricTags): void {
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
  getCounter(name: string, tags?: MetricTags): number {
    const key = this.getKey(name, tags);
    return this.counters.get(key)?.value || 0;
  }

  /**
   * Get current value of a gauge
   */
  getGauge(name: string, tags?: MetricTags): number {
    const key = this.getKey(name, tags);
    return this.gauges.get(key)?.value || 0;
  }

  /**
   * Get histogram statistics
   */
  getHistogram(name: string, tags?: MetricTags): { count: number; sum: number; avg: number; min: number; max: number } | null {
    const key = this.getKey(name, tags);
    const h = this.histograms.get(key);
    if (!h) return null;

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
  getReport(): {
    counters: Record<string, { value: number; tags: MetricTags }>;
    histograms: Record<string, { count: number; sum: number; avg: number; min: number; max: number; tags: MetricTags }>;
    gauges: Record<string, { value: number; tags: MetricTags }>;
    collectedAt: string;
  } {
    const counters: Record<string, { value: number; tags: MetricTags }> = {};
    const histograms: Record<string, { count: number; sum: number; avg: number; min: number; max: number; tags: MetricTags }> = {};
    const gauges: Record<string, { value: number; tags: MetricTags }> = {};

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
  toPrometheus(): string {
    const lines: string[] = [];

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
  private formatPrometheusTags(tags: MetricTags): string {
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
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }

  /**
   * Get all metric names
   */
  getMetricNames(): { counters: string[]; histograms: string[]; gauges: string[] } {
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

export const metrics = new Metrics();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Record job execution metrics
 */
export function recordJobExecution(
  jobName: string,
  status: 'success' | 'failure' | 'timeout' | 'skipped',
  durationMs: number
): void {
  metrics.inc(`job.${status}`, { jobName });
  if (status !== 'skipped') {
    metrics.observe('job.duration_ms', durationMs, { jobName });
  }
}

/**
 * Record API call metrics
 */
export function recordApiCall(
  endpoint: string,
  status: number,
  durationMs: number
): void {
  metrics.inc('api.calls', { endpoint, status: String(status) });
  metrics.observe('api.duration_ms', durationMs, { endpoint });
}

/**
 * Record database query metrics
 */
export function recordDbQuery(
  operation: string,
  table: string,
  durationMs: number
): void {
  metrics.inc('db.queries', { operation, table });
  metrics.observe('db.duration_ms', durationMs, { operation, table });
}
