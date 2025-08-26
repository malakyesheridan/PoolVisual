/**
 * Structured logging system with optional Sentry integration
 */

import { isAppError } from './errors.js';

// Log levels
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  msg: string;
  code?: string;
  meta?: Record<string, unknown>;
  err?: unknown;
  requestId?: string;
  userId?: string;
  organizationId?: string;
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  enableSentry: boolean;
  enableConsole: boolean;
}

class Logger {
  private config: LoggerConfig;
  private sentry: typeof import('@sentry/react') | null = null;

  constructor() {
    // Use import.meta.env for Vite instead of process.env
    const isDevelopment = import.meta.env.MODE === 'development';
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    
    this.config = {
      level: (isDevelopment ? 'debug' : 'info') as LogLevel,
      enableSentry: Boolean(sentryDsn),
      enableConsole: true
    };

    // Initialize Sentry if DSN is provided
    if (this.config.enableSentry && typeof window !== 'undefined') {
      this.initSentry();
    }
  }

  private async initSentry(): Promise<void> {
    try {
      const Sentry = await import('@sentry/react');
      
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE || 'development',
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
        ],
        tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      });

      this.sentry = Sentry;
    } catch (error) {
      console.warn('Failed to initialize Sentry:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex <= configLevelIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, msg, code, meta, err, requestId, userId, organizationId } = entry;
    
    const logObject = {
      timestamp,
      level: level.toUpperCase(),
      msg,
      ...(code && { code }),
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...(organizationId && { organizationId }),
      ...(meta && Object.keys(meta).length > 0 && { meta }),
      ...(err && { err: this.serializeError(err) })
    };

    return JSON.stringify(logObject);
  }

  private serializeError(err: unknown): unknown {
    if (isAppError(err)) {
      return err.toJSON();
    }
    
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack
      };
    }
    
    return err;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const formatted = this.formatLogEntry(entry);
    
    switch (entry.level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
    }
  }

  private logToSentry(entry: LogEntry): void {
    if (!this.sentry || !this.config.enableSentry) return;

    const { level, msg, code, meta, err, requestId, userId, organizationId } = entry;

    // Set context
    this.sentry.setContext('log_entry', {
      code,
      meta,
      requestId,
      userId,
      organizationId
    });

    if (level === 'error' && err) {
      if (isAppError(err)) {
        this.sentry.captureException(err, {
          tags: { code: err.code },
          extra: { meta: err.meta }
        });
      } else {
        this.sentry.captureException(err instanceof Error ? err : new Error(String(err)));
      }
    } else if (level === 'warn' || level === 'error') {
      this.sentry.captureMessage(msg, level as 'warning' | 'error');
    }
  }

  private log(level: LogLevel, params: {
    msg: string;
    code?: string;
    meta?: Record<string, unknown>;
    err?: unknown;
    requestId?: string;
    userId?: string;
    organizationId?: string;
  }): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...params
    };

    this.logToConsole(entry);
    this.logToSentry(entry);
  }

  error(params: {
    msg: string;
    code?: string;
    meta?: Record<string, unknown>;
    err?: unknown;
    requestId?: string;
    userId?: string;
    organizationId?: string;
  }): void {
    this.log('error', params);
  }

  warn(params: {
    msg: string;
    code?: string;
    meta?: Record<string, unknown>;
    err?: unknown;
    requestId?: string;
    userId?: string;
    organizationId?: string;
  }): void {
    this.log('warn', params);
  }

  info(params: {
    msg: string;
    code?: string;
    meta?: Record<string, unknown>;
    requestId?: string;
    userId?: string;
    organizationId?: string;
  }): void {
    this.log('info', params);
  }

  debug(params: {
    msg: string;
    code?: string;
    meta?: Record<string, unknown>;
    requestId?: string;
    userId?: string;
    organizationId?: string;
  }): void {
    this.log('debug', params);
  }

  // Convenience method for logging errors
  logError(error: unknown, context?: {
    msg?: string;
    requestId?: string;
    userId?: string;
    organizationId?: string;
    meta?: Record<string, unknown>;
  }): void {
    if (isAppError(error)) {
      this.error({
        msg: context?.msg || error.message,
        code: error.code,
        err: error,
        requestId: context?.requestId || error.requestId,
        userId: context?.userId,
        organizationId: context?.organizationId,
        meta: { ...error.meta, ...context?.meta }
      });
    } else {
      this.error({
        msg: context?.msg || 'Unexpected error occurred',
        err: error,
        requestId: context?.requestId,
        userId: context?.userId,
        organizationId: context?.organizationId,
        meta: context?.meta
      });
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;