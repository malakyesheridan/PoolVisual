/**
 * Performance Metrics Collection Service
 * 
 * Integrates with existing logging system to collect and analyze performance metrics
 * Provides real-time performance insights without modifying existing code
 */

import { logger } from './logger';
import { monitoringService } from './monitoringService';

export interface MetricDefinition {
  name: string;
  description: string;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  tags?: string[];
}

export interface MetricValue {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceReport {
  timestamp: Date;
  metrics: MetricValue[];
  summary: {
    totalMetrics: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export class PerformanceMetricsService {
  private metrics: Map<string, MetricValue[]> = new Map();
  private metricDefinitions: Map<string, MetricDefinition> = new Map();
  private reportInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;

  constructor() {
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize default metric definitions
   */
  private initializeDefaultMetrics(): void {
    const defaultMetrics: MetricDefinition[] = [
      {
        name: 'http.request.duration',
        description: 'HTTP request duration in milliseconds',
        unit: 'milliseconds',
        type: 'histogram',
        tags: ['method', 'route', 'status_code']
      },
      {
        name: 'http.request.count',
        description: 'Total HTTP requests',
        unit: 'count',
        type: 'counter',
        tags: ['method', 'route', 'status_code']
      },
      {
        name: 'database.query.duration',
        description: 'Database query duration in milliseconds',
        unit: 'milliseconds',
        type: 'histogram',
        tags: ['query_type', 'table']
      },
      {
        name: 'database.query.count',
        description: 'Total database queries',
        unit: 'count',
        type: 'counter',
        tags: ['query_type', 'table']
      },
      {
        name: 'cache.hit.rate',
        description: 'Cache hit rate percentage',
        unit: 'percent',
        type: 'gauge',
        tags: ['cache_type']
      },
      {
        name: 'memory.usage',
        description: 'Memory usage in bytes',
        unit: 'bytes',
        type: 'gauge'
      },
      {
        name: 'cpu.usage',
        description: 'CPU usage percentage',
        unit: 'percent',
        type: 'gauge'
      },
      {
        name: 'active.connections',
        description: 'Active database connections',
        unit: 'count',
        type: 'gauge'
      }
    ];

    defaultMetrics.forEach(metric => {
      this.metricDefinitions.set(metric.name, metric);
    });
  }

  /**
   * Start metrics collection
   * @param intervalMs Collection interval in milliseconds
   */
  startCollection(intervalMs: number = 60000): void {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;
    this.reportInterval = setInterval(() => {
      this.generateReport();
    }, intervalMs);

    logger.info({
      msg: 'Performance metrics collection started',
      meta: { intervalMs }
    });
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
    this.isCollecting = false;

    logger.info({
      msg: 'Performance metrics collection stopped'
    });
  }

  /**
   * Record a metric value
   * @param name Metric name
   * @param value Metric value
   * @param tags Optional tags
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    try {
      const metric: MetricValue = {
        name,
        value,
        timestamp: new Date(),
        tags
      };

      // Store metric
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }

      const metrics = this.metrics.get(name)!;
      metrics.push(metric);

      // Keep only last 1000 metrics per name
      if (metrics.length > 1000) {
        metrics.shift();
      }

      // Send to monitoring service
      const definition = this.metricDefinitions.get(name);
      if (definition) {
        monitoringService.recordMetric(name, value, definition.unit, tags);
      }

    } catch (error) {
      console.error('[PerformanceMetrics] Error recording metric:', error);
    }
  }

  /**
   * Record HTTP request metric
   * @param method HTTP method
   * @param route Route pattern
   * @param statusCode Status code
   * @param duration Duration in milliseconds
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const tags = {
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString()
    };

    this.recordMetric('http.request.duration', duration, tags);
    this.recordMetric('http.request.count', 1, tags);
  }

  /**
   * Record database query metric
   * @param queryType Type of query (SELECT, INSERT, UPDATE, DELETE)
   * @param table Table name
   * @param duration Duration in milliseconds
   */
  recordDatabaseQuery(queryType: string, table: string, duration: number): void {
    const tags = {
      query_type: queryType.toUpperCase(),
      table
    };

    this.recordMetric('database.query.duration', duration, tags);
    this.recordMetric('database.query.count', 1, tags);
  }

  /**
   * Record cache metric
   * @param cacheType Type of cache (redis, memory, etc.)
   * @param hitRate Hit rate percentage
   */
  recordCacheHitRate(cacheType: string, hitRate: number): void {
    this.recordMetric('cache.hit.rate', hitRate, { cache_type: cacheType });
  }

  /**
   * Record memory usage metric
   * @param usage Memory usage in bytes
   */
  recordMemoryUsage(usage: number): void {
    this.recordMetric('memory.usage', usage);
  }

  /**
   * Record CPU usage metric
   * @param usage CPU usage percentage
   */
  recordCpuUsage(usage: number): void {
    this.recordMetric('cpu.usage', usage);
  }

  /**
   * Record active connections metric
   * @param count Number of active connections
   */
  recordActiveConnections(count: number): void {
    this.recordMetric('active.connections', count);
  }

  /**
   * Generate performance report
   */
  private generateReport(): void {
    try {
      const report: PerformanceReport = {
        timestamp: new Date(),
        metrics: [],
        summary: {
          totalMetrics: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0
        }
      };

      // Collect all metrics
      for (const [name, values] of Array.from(this.metrics.entries())) {
        if (values.length > 0) {
          const latest = values[values.length - 1];
          report.metrics.push(latest);
        }
      }

      // Calculate summary
      report.summary.totalMetrics = report.metrics.length;

      // Calculate average response time
      const responseTimeMetrics = report.metrics.filter(m => m.name === 'http.request.duration');
      if (responseTimeMetrics.length > 0) {
        report.summary.averageResponseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
      }

      // Calculate error rate
      const errorMetrics = report.metrics.filter(m => 
        m.name === 'http.request.count' && 
        m.tags?.status_code && 
        parseInt(m.tags.status_code) >= 400
      );
      const totalRequests = report.metrics.filter(m => m.name === 'http.request.count');
      if (totalRequests.length > 0) {
        report.summary.errorRate = (errorMetrics.length / totalRequests.length) * 100;
      }

      // Calculate throughput (requests per minute)
      const requestMetrics = report.metrics.filter(m => m.name === 'http.request.count');
      report.summary.throughput = requestMetrics.reduce((sum, m) => sum + m.value, 0);

      // Log report
      logger.info({
        msg: 'Performance metrics report generated',
        meta: {
          report: {
            timestamp: report.timestamp,
            summary: report.summary,
            metricCount: report.metrics.length
          }
        }
      });

      // Send to monitoring service
      monitoringService.captureEvent({
        message: 'Performance metrics report',
        level: 'info',
        extra: {
          summary: report.summary,
          metricCount: report.metrics.length
        }
      });

    } catch (error) {
      console.error('[PerformanceMetrics] Error generating report:', error);
    }
  }

  /**
   * Get metrics for a specific name
   * @param name Metric name
   * @param timeWindow Time window in minutes
   * @returns Array of metric values
   */
  getMetrics(name: string, timeWindow: number = 60): MetricValue[] {
    const metrics = this.metrics.get(name) || [];
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get all metrics
   * @param timeWindow Time window in minutes
   * @returns Map of metric names to values
   */
  getAllMetrics(timeWindow: number = 60): Map<string, MetricValue[]> {
    const result = new Map<string, MetricValue[]>();
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);

    for (const [name, metrics] of Array.from(this.metrics.entries())) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length > 0) {
        result.set(name, filtered);
      }
    }

    return result;
  }

  /**
   * Get metric statistics
   * @param name Metric name
   * @param timeWindow Time window in minutes
   * @returns Metric statistics
   */
  getMetricStatistics(name: string, timeWindow: number = 60): {
    count: number;
    average: number;
    min: number;
    max: number;
    sum: number;
    latest: number;
  } | null {
    const metrics = this.getMetrics(name, timeWindow);
    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      sum,
      latest: values[values.length - 1]
    };
  }

  /**
   * Get health status based on metrics
   * @returns Health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: Record<string, any>;
  } {
    const issues: string[] = [];
    const metrics: Record<string, any> = {};

    // Check response time
    const responseTimeStats = this.getMetricStatistics('http.request.duration', 5);
    if (responseTimeStats) {
      metrics.averageResponseTime = responseTimeStats.average;
      if (responseTimeStats.average > 2000) {
        issues.push('High response time detected');
      }
    }

    // Check error rate
    const errorRateStats = this.getMetricStatistics('http.request.count', 5);
    if (errorRateStats) {
      // This is simplified - in reality you'd calculate actual error rate
      metrics.requestCount = errorRateStats.count;
    }

    // Check memory usage
    const memoryStats = this.getMetricStatistics('memory.usage', 5);
    if (memoryStats) {
      metrics.memoryUsage = memoryStats.latest;
      if (memoryStats.latest > 1024 * 1024 * 1024) { // 1GB
        issues.push('High memory usage detected');
      }
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) {
      status = issues.length > 2 ? 'critical' : 'warning';
    }

    return {
      status,
      issues,
      metrics
    };
  }

  /**
   * Clear old metrics
   * @param olderThanMs Age threshold in milliseconds
   */
  clearOldMetrics(olderThanMs: number = 24 * 60 * 60 * 1000): void { // 24 hours
    const cutoff = new Date(Date.now() - olderThanMs);
    
    for (const [name, metrics] of Array.from(this.metrics.entries())) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

// Export singleton instance
export const performanceMetricsService = new PerformanceMetricsService();
