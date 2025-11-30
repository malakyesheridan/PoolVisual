/**
 * Database Context Manager
 * Sets user context for RLS policies in session-based auth
 * 
 * NOTE: Neon HTTP driver doesn't support session variables.
 * This implementation uses Drizzle transactions to set context
 * before queries within the same transaction.
 */

import { getDatabase } from './db.js';
import { sql } from 'drizzle-orm';

export class DbContext {
  /**
   * Execute query with user context using Drizzle transaction
   * Neon HTTP doesn't support session variables, so we use transactions
   * to set context and execute queries in the same transaction
   */
  static async withUserContext<T>(
    userId: string,
    queryFn: (tx: any) => Promise<T>
  ): Promise<T> {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    // Use Drizzle transaction to set context and execute query together
    return await db.transaction(async (tx) => {
      // Set user context as part of the transaction
      await tx.execute(sql`SELECT set_user_context(${userId}::UUID)`);
      try {
        // Execute the query function with the transaction
        return await queryFn(tx);
      } finally {
        // Clear context (though it won't persist outside transaction anyway)
        await tx.execute(sql`SELECT set_user_context(NULL::UUID)`);
      }
    });
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

  /**
   * @deprecated - Neon HTTP doesn't support session variables
   * Use withUserContext instead
   */
  static async setUserContext(userId: string): Promise<void> {
    // This won't work with Neon HTTP - kept for compatibility
    const db = getDatabase();
    await db.execute(sql`SELECT set_user_context(${userId}::UUID)`);
  }

  /**
   * @deprecated - Neon HTTP doesn't support session variables
   */
  static async clearUserContext(): Promise<void> {
    // This won't work with Neon HTTP - kept for compatibility
    const db = getDatabase();
    await db.execute(sql`SELECT set_user_context(NULL::UUID)`);
  }
}
