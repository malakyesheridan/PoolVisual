/**
 * Authentication Middleware
 * Sets database user context for RLS policies
 */

import { Request, Response, NextFunction } from 'express';
import { DbContext } from '../lib/dbContext.js';

/**
 * Middleware to set database user context for RLS
 * Must run after authenticateSession
 */
export function setDbUserContext(
  req: any,
  res: Response,
  next: NextFunction
): void {
  const userId = req.session?.user?.id || req.user?.id;
  
  if (userId) {
    // Set context before request handlers
    DbContext.setUserContext(userId)
      .then(() => next())
      .catch((err) => {
        console.error('[Auth] Failed to set DB context:', err);
        res.status(500).json({ error: 'Database context error' });
      });
  } else {
    // No user ID - continue without context (for public routes)
    next();
  }
}

/**
 * Middleware to clear DB context after request
 */
export function clearDbUserContext(
  req: any,
  res: Response,
  next: NextFunction
): void {
  res.on('finish', () => {
    DbContext.clearUserContext().catch((err) => {
      console.error('[Auth] Failed to clear DB context:', err);
    });
  });
  next();
}
