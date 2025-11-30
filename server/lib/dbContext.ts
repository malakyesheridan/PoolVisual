/**
 * Database Context Manager
 * Sets user context for RLS policies in session-based auth
 */

import { getDatabase } from './db.js';
import { sql } from 'drizzle-orm';

export class DbContext {
  /**
   * Set user context for RLS policies
   * Must be called before queries that need RLS
   */
  static async setUserContext(userId: string): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`SELECT set_user_context(${userId}::UUID)`);
  }

  /**
   * Clear user context
   */
  static async clearUserContext(): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`SELECT set_user_context(NULL::UUID)`);
  }

  /**
   * Execute query with user context
   */
  static async withUserContext<T>(
    userId: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    await this.setUserContext(userId);
    try {
      return await queryFn();
    } finally {
      await this.clearUserContext();
    }
  }

  /**
   * Execute query without user context (system operations)
   * Uses SECURITY DEFINER functions
   */
  static async withoutContext<T>(
    queryFn: () => Promise<T>
  ): Promise<T> {
    // No context set - uses SECURITY DEFINER functions
    return await queryFn();
  }
}
