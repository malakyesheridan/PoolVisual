/**
 * Database Health Service
 * Monitors database connectivity and performance
 */

import { executeQuery } from './dbHelpers.js';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  latency: number; // in milliseconds
  timestamp: Date;
  pool?: {
    total?: number;
    idle?: number;
    waiting?: number;
  };
  error?: string;
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Simple connectivity test
    const result = await executeQuery('SELECT 1 as health_check');
    
    const latency = Date.now() - startTime;
    
    // Determine status based on latency
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (latency > 1000) {
      status = 'degraded';
    } else if (latency > 5000) {
      status = 'down';
    }
    
    // Verify result
    if (!result || result.length === 0 || result[0].health_check !== 1) {
      return {
        status: 'down',
        latency,
        timestamp: new Date(),
        error: 'Database query returned unexpected result'
      };
    }
    
    return {
      status,
      latency,
      timestamp: new Date()
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      status: 'down',
      latency,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

/**
 * Get database connection pool stats (if available)
 */
export async function getPoolStats(): Promise<{
  total?: number;
  idle?: number;
  waiting?: number;
}> {
  try {
    // Try to get pool stats from pg_stat_activity
    // This is PostgreSQL-specific and may not work on all setups
    const stats = await executeQuery(`
      SELECT 
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    
    if (stats && stats.length > 0) {
      return {
        total: Number(stats[0].active || 0) + Number(stats[0].idle || 0) + Number(stats[0].idle_in_transaction || 0),
        idle: Number(stats[0].idle || 0),
        waiting: 0 // Not easily available from pg_stat_activity
      };
    }
    
    return {};
  } catch (error) {
    // Pool stats not available (might be using serverless DB)
    return {};
  }
}

