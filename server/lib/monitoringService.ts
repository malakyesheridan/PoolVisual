/**
 * Enhanced Monitoring Service
 * 
 * Builds upon existing Sentry integration to provide comprehensive monitoring
 * Integrates with existing error handling and logging systems
 */

// Guarded import - only load Sentry if enabled
let Sentry: any = null;

// Initialize Sentry lazily when needed (handled in initSentry method)

// Simple logger fallback
const logger = {
  info: (data: any) => console.log('[MonitoringService]', data.msg || data),
  error: (data: any) => console.error('[MonitoringService]', data.msg || data, data.err || '')
};

export interface MonitoringConfig {
  sentryDsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  enablePerformanceMonitoring?: boolean;
  enableSessionReplay?: boolean;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface CustomEvent {
  message: string;
  level: 'info' | 'warning' | 'error' | 'fatal';
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
}

export class MonitoringService {
  private sentry: any = null;
  private config: MonitoringConfig;
  private performanceMetrics: Map<string, PerformanceMetric[]> = new Map();
  private isInitialized = false;

  constructor(config: MonitoringConfig = {}) {
    this.config = {
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      sampleRate: 1.0,
      tracesSampleRate: 0.1,
      enablePerformanceMonitoring: true,
      enableSessionReplay: false,
      ...config
    };
  }

  /**
   * Initialize monitoring service
   */
  async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Initialize Sentry if DSN is provided
      if (this.config.sentryDsn && process.env.SENTRY_NODE_ENABLED === 'true') {
        await this.initSentry();
      } else {
        console.log('[MonitoringService] Running in no-op mode (Sentry not enabled or DSN not provided)');
      }

      // Initialize performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.initPerformanceMonitoring();
      }

      this.isInitialized = true;
      logger.info({
        msg: 'Monitoring service initialized',
        meta: {
          sentryEnabled: !!this.sentry,
          performanceMonitoring: this.config.enablePerformanceMonitoring,
          environment: this.config.environment
        }
      });

    } catch (error) {
      console.error('[MonitoringService] Failed to initialize:', error);
      // Don't throw - monitoring should not break the application
    }
  }

  /**
   * Initialize Sentry
   */
  private async initSentry(): Promise<void> {
    try {
      const SentryModule = await import('@sentry/node');
      // Handle both ESM and CommonJS exports
      const Sentry = SentryModule.default || SentryModule;
      
      Sentry.init({
        dsn: this.config.sentryDsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        
        // Performance monitoring
        integrations: [
          Sentry.httpIntegration(),
          ...(this.config.enableSessionReplay ? [] : []) // Remove unsupported integrations
        ],

        // Error filtering
        beforeSend(event) {
          // Filter out development errors
          if (process.env.NODE_ENV === 'development') {
            return null;
          }
          return event;
        },

        // Custom tags
        initialScope: {
          tags: {
            component: 'poolvisual-server',
            version: this.config.release
          }
        }
      });

      this.sentry = Sentry;

    } catch (error) {
      console.warn('[MonitoringService] Failed to initialize Sentry:', error);
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initPerformanceMonitoring(): void {
    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.recordMetric('memory.heap_used', memUsage.heapUsed, 'bytes');
      this.recordMetric('memory.heap_total', memUsage.heapTotal, 'bytes');
      this.recordMetric('memory.external', memUsage.external, 'bytes');
      this.recordMetric('memory.rss', memUsage.rss, 'bytes');
    }, 60000); // Every minute

    // Monitor CPU usage
    const startUsage = process.cpuUsage();
    setInterval(() => {
      const usage = process.cpuUsage(startUsage);
      const totalUsage = usage.user + usage.system;
      this.recordMetric('cpu.usage', totalUsage, 'microseconds');
    }, 60000); // Every minute

    // Monitor event loop lag
    setInterval(() => {
      const start = process.hrtime();
      setImmediate(() => {
        const delta = process.hrtime(start);
        const lag = delta[0] * 1000 + delta[1] / 1000000; // Convert to milliseconds
        this.recordMetric('event_loop.lag', lag, 'milliseconds');
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Capture error with context
   * @param error Error to capture
   * @param context Additional context
   */
  captureError(error: Error, context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    user?: { id?: string; email?: string; username?: string };
    level?: 'error' | 'warning' | 'fatal';
  }): void {
    try {
      // Log to existing logger
      console.error('[MonitoringService] Error captured:', error.message);

      // Send to Sentry if available
      if (this.sentry) {
        this.sentry.withScope((scope: any) => {
          if (context?.tags) {
            Object.entries(context.tags).forEach(([key, value]) => {
              scope.setTag(key, value);
            });
          }

          if (context?.extra) {
            Object.entries(context.extra).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }

          if (context?.user) {
            scope.setUser(context.user);
          }

          if (context?.level) {
            scope.setLevel(context.level);
          }

          this.sentry.captureException(error);
        });
      }

    } catch (monitoringError) {
      console.error('[MonitoringService] Error capturing error:', monitoringError);
    }
  }

  /**
   * Capture custom event
   * @param event Custom event data
   */
  captureEvent(event: CustomEvent): void {
    try {
      // Log to existing logger
      logger.info({
        msg: 'Custom event captured',
        meta: event
      });

      // Send to Sentry if available
      if (this.sentry) {
        this.sentry.withScope((scope: any) => {
          if (event.tags) {
            Object.entries(event.tags).forEach(([key, value]) => {
              scope.setTag(key, value);
            });
          }

          if (event.extra) {
            Object.entries(event.extra).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }

          if (event.user) {
            scope.setUser(event.user);
          }

          this.sentry.captureMessage(event.message, event.level);
        });
      }

    } catch (error) {
      console.error('[MonitoringService] Error capturing event:', error);
    }
  }

  /**
   * Record performance metric
   * @param name Metric name
   * @param value Metric value
   * @param unit Metric unit
   * @param tags Optional tags
   */
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    try {
      const metric: PerformanceMetric = {
        name,
        value,
        unit,
        tags,
        timestamp: new Date()
      };

      // Store metric
      if (!this.performanceMetrics.has(name)) {
        this.performanceMetrics.set(name, []);
      }
      
      const metrics = this.performanceMetrics.get(name)!;
      metrics.push(metric);

      // Keep only last 100 metrics per name
      if (metrics.length > 100) {
        metrics.shift();
      }

      // Send to Sentry if available
      if (this.sentry) {
        this.sentry.addBreadcrumb({
          message: `Metric: ${name}`,
          category: 'metric',
          data: {
            value,
            unit,
            ...tags
          },
          level: 'info'
        });
      }

    } catch (error) {
      console.error('[MonitoringService] Error recording metric:', error);
    }
  }

  /**
   * Start performance transaction
   * @param name Transaction name
   * @param operation Operation name
   * @returns Transaction object
   */
  startTransaction(name: string, operation: string): {
    finish: () => void;
    setTag: (key: string, value: string) => void;
    setData: (key: string, value: any) => void;
  } {
    const startTime = Date.now();

    return {
      finish: () => {
        const duration = Date.now() - startTime;
        this.recordMetric(`transaction.${name}.duration`, duration, 'milliseconds');
        
        if (this.sentry) {
          this.sentry.addBreadcrumb({
            message: `Transaction: ${name}`,
            category: 'transaction',
            data: {
              operation,
              duration
            },
            level: 'info'
          });
        }
      },
      setTag: (key: string, value: string) => {
        // Store tags for transaction
      },
      setData: (key: string, value: any) => {
        // Store data for transaction
      }
    };
  }

  /**
   * Get performance metrics
   * @param name Optional metric name filter
   * @returns Performance metrics
   */
  getMetrics(name?: string): PerformanceMetric[] | Map<string, PerformanceMetric[]> {
    if (name) {
      return this.performanceMetrics.get(name) || [];
    }
    return this.performanceMetrics;
  }

  /**
   * Get metric statistics
   * @param name Metric name
   * @param timeWindow Time window in minutes
   * @returns Metric statistics
   */
  getMetricStats(name: string, timeWindow: number = 60): {
    count: number;
    average: number;
    min: number;
    max: number;
    sum: number;
  } | null {
    const metrics = this.performanceMetrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentMetrics = metrics.filter(m => m.timestamp && m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return null;
    }

    const values = recentMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      sum
    };
  }

  /**
   * Set user context
   * @param user User information
   */
  setUser(user: { id?: string; email?: string; username?: string }): void {
    try {
      if (this.sentry) {
        this.sentry.setUser(user);
      }
    } catch (error) {
      console.error('[MonitoringService] Error setting user:', error);
    }
  }

  /**
   * Add breadcrumb
   * @param message Breadcrumb message
   * @param category Breadcrumb category
   * @param data Additional data
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    try {
      if (this.sentry) {
        this.sentry.addBreadcrumb({
          message,
          category,
          data,
          level: 'info'
        });
      }
    } catch (error) {
      console.error('[MonitoringService] Error adding breadcrumb:', error);
    }
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    try {
      if (this.sentry) {
        await this.sentry.flush(2000); // Wait up to 2 seconds
      }
    } catch (error) {
      console.error('[MonitoringService] Error flushing events:', error);
    }
  }

  /**
   * Close monitoring service
   */
  async close(): Promise<void> {
    try {
      await this.flush();
      this.isInitialized = false;
    } catch (error) {
      console.error('[MonitoringService] Error closing service:', error);
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService({
  sentryDsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  enablePerformanceMonitoring: true
});
