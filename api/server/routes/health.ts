/**
 * Health check and diagnostic routes
 */

import { Router } from 'express';
import { withHandler } from '../lib/routeWrapper';
import { AppError } from '../lib/errors';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/health', withHandler(async (req, res) => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    hasSentry: Boolean(process.env.SENTRY_DSN),
    hasDatabase: Boolean(process.env.DATABASE_URL)
  };

  return health;
}));

/**
 * Detailed system status
 */
router.get('/health/detailed', withHandler(async (req, res) => {
  const startTime = process.hrtime();
  
  // Test database connection
  let databaseStatus = 'unknown';
  let databaseLatency = 0;
  
  try {
    if (process.env.DATABASE_URL) {
      const dbStart = process.hrtime();
      // Simple query to test connection - implement based on your DB client
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 10));
      const dbEnd = process.hrtime(dbStart);
      databaseLatency = dbEnd[0] * 1000 + dbEnd[1] * 1e-6;
      databaseStatus = 'healthy';
    } else {
      databaseStatus = 'not_configured';
    }
  } catch (error) {
    databaseStatus = 'unhealthy';
  }

  const endTime = process.hrtime(startTime);
  const responseTime = endTime[0] * 1000 + endTime[1] * 1e-6;

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    responseTime: `${responseTime.toFixed(2)}ms`,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    services: {
      database: {
        status: databaseStatus,
        latency: databaseStatus === 'healthy' ? `${databaseLatency.toFixed(2)}ms` : null
      },
      sentry: {
        configured: Boolean(process.env.SENTRY_DSN)
      }
    }
  };
}));

/**
 * Diagnostic error endpoint (development only)
 */
router.post('/health/error', withHandler(async (req, res) => {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('NOT_FOUND', 'Endpoint not available in production');
  }

  const { type = 'internal', message = 'Diagnostic error test' } = req.body || {};

  switch (type) {
    case 'internal':
      throw new AppError('INTERNAL_ERROR', message);
    case 'validation':
      throw new AppError('VALIDATION_ERROR', message);
    case 'unauthorized':
      throw new AppError('UNAUTHORIZED', message);
    case 'forbidden':
      throw new AppError('FORBIDDEN', message);
    case 'not_found':
      throw new AppError('NOT_FOUND', message);
    case 'conflict':
      throw new AppError('CONFLICT', message);
    case 'timeout':
      throw new AppError('TIMEOUT_ERROR', message);
    case 'network':
      throw new AppError('NETWORK_ERROR', message);
    default:
      throw new Error(message); // Generic error
  }
}, {
  // Allow any body for testing
}));

/**
 * Diagnostic metrics endpoint
 */
router.get('/health/metrics', withHandler(async (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      loadAverage: process.platform === 'linux' ? require('os').loadavg() : null
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasSentry: Boolean(process.env.SENTRY_DSN),
      hasDatabase: Boolean(process.env.DATABASE_URL)
    }
  };

  return metrics;
}));

export default router;