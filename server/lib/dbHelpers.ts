/**
 * Database Helpers - Raw SQL execution for AI Enhancement tables
 * Uses Neon serverless client which works with tagged template literals
 */

import { getSql } from '../db';

export async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
  const sql = getSql();
  if (!sql) {
    throw new Error('Database connection not available');
  }
  
  // Neon client uses tagged template literals, but we need to handle parameterized queries
  // For raw SQL execution with parameters, we'll construct the query and execute it
  // Note: This is a simplified version - for production, consider using Drizzle's sql helper
  try {
    // Convert parameterized query to template literal format
    // This is a basic implementation - for complex queries, use Drizzle's query builder
    let formattedQuery = query;
    // Replace all occurrences of each placeholder (not just the first)
    // Process in reverse order to avoid replacing $10 before $1
    for (let i = params.length - 1; i >= 0; i--) {
      const placeholder = `$${i + 1}`;
      const param = params[i];
      let value: string;
      
      if (param === null || param === undefined) {
        value = 'NULL';
      } else if (typeof param === 'string') {
        // Escape single quotes and wrap in quotes
        value = `'${param.replace(/'/g, "''")}'`;
      } else if (typeof param === 'number' || typeof param === 'boolean') {
        value = String(param);
      } else {
        // For objects/arrays, stringify and escape
        value = `'${JSON.stringify(param).replace(/'/g, "''")}'`;
      }
      
      // Replace ALL occurrences of this placeholder
      formattedQuery = formattedQuery.split(placeholder).join(value);
    }
    
    // Execute raw SQL using Neon client
    // Neon client requires template literals, but we have a pre-formatted query string
    // We use Function constructor to create a proper template literal call (safer than eval)
    // This is safe because we've already escaped all parameters
    // Escape backticks and template literal syntax in the query
    const escapedQuery = formattedQuery.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
    // Create a function that executes the SQL as a template literal
    const executeRawSQL = new Function('sql', `return sql\`${escapedQuery}\``);
    const result = await executeRawSQL(sql);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('[dbHelpers] Query execution failed:', error);
    throw error;
  }
}

export async function transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
  // Neon serverless doesn't support traditional transactions
  // Execute queries sequentially - for true transactions, use Drizzle's transaction API
  const sql = getSql();
  if (!sql) {
    throw new Error('Database connection not available');
  }
  
  try {
    const tx: Transaction = {
      execute: async (query: string, params?: any[]) => {
        return await executeQuery(query, params || []);
      }
    };
    
    return await callback(tx);
  } catch (error) {
    throw error;
  }
}

interface Transaction {
  execute(sql: string, params?: any[]): Promise<any[]>;
}
