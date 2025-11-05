/**
 * Database Helpers - Raw SQL execution for AI Enhancement tables
 */

import { pool } from '../db';

export async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  if (!pool) {
    throw new Error('Database pool not available');
  }
  
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error('Database pool not available');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await callback({
      execute: async (sql, params) => {
        const r = await client.query(sql, params);
        return r.rows;
      }
    });
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

interface Transaction {
  execute(sql: string, params?: any[]): Promise<any[]>;
}

