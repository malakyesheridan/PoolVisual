/**
 * Server-side logging system with optional Sentry integration
 */

import { isAppError } from './errors';

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

class ServerLogger {
  private config: {
    level: LogLevel;
    enableSentry: boolean;
  };

  constructor() {
    this.config = {
      level: (process.env.NODE_ENV === 'production' ? 'info' : 'debug') as LogLevel,
      enableSentry: Boolean(process.env.SENTRY_DSN)
    };
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
      ...(err ? { err: this.serializeError(err) } : {})
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
        meta: { ...error.meta, ...(context?.meta || {}) }
      });
      if (context?.requestId || error.requestId) {
        this.error({
          msg: context?.msg || error.message,
          code: error.code,
          err: error,
          requestId: context?.requestId || error.requestId,
          meta: { ...error.meta, ...(context?.meta || {}) }
        });
      }
      if (context?.userId) {
        this.error({
          msg: context?.msg || error.message,
          code: error.code,
          err: error,
          userId: context.userId,
          meta: { ...error.meta, ...(context?.meta || {}) }
        });
      }
      if (context?.organizationId) {
        this.error({
          msg: context?.msg || error.message,
          code: error.code,
          err: error,
          organizationId: context.organizationId,
          meta: { ...error.meta, ...(context?.meta || {}) }
        });
      }
    } else {
      this.error({
        msg: context?.msg || 'Unexpected error occurred',
        err: error,
        meta: context?.meta || {}
      });
      if (context?.requestId) {
        this.error({
          msg: context?.msg || 'Unexpected error occurred',
          err: error,
          requestId: context.requestId,
          meta: context?.meta || {}
        });
      }
      if (context?.userId) {
        this.error({
          msg: context?.msg || 'Unexpected error occurred',
          err: error,
          userId: context.userId,
          meta: context?.meta || {}
        });
      }
      if (context?.organizationId) {
        this.error({
          msg: context?.msg || 'Unexpected error occurred',
          err: error,
          organizationId: context.organizationId,
          meta: context?.meta || {}
        });
      }
    }
  }
}

export const logger = new ServerLogger();
export default logger;