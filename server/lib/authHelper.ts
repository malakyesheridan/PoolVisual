/**
 * Authentication Helper
 * Shared authentication utilities for both Express routes and Vercel serverless functions
 */

import { getIronSession } from 'iron-session';
import { sessionOptions } from '../session.js';
import { storage } from '../storage.js';
import type { Request, Response } from 'express';

export interface AuthResult {
  userId: string;
  user: {
    id: string;
    email: string;
    username?: string;
  };
}

/**
 * Authenticate request (works for both Express and Vercel)
 */
export async function authenticateRequest(
  req: Request | any,
  res?: Response | any
): Promise<AuthResult | null> {
  try {
    // Get session using iron-session
    const session = await getIronSession(req, res || {}, sessionOptions);
    
    if (!session?.user?.id) {
      return null;
    }
    
    return {
      userId: session.user.id,
      user: session.user
    };
  } catch (error) {
    console.error('[AuthHelper] Authentication error:', error);
    return null;
  }
}

/**
 * Verify user has access to a quote
 */
export async function verifyQuoteAccess(quoteId: string, userId: string): Promise<boolean> {
  try {
    const quote = await storage.getQuote(quoteId);
    if (!quote) {
      return false;
    }
    
    const job = await storage.getJob(quote.jobId);
    if (!job) {
      return false;
    }
    
    const userOrgs = await storage.getUserOrgs(userId);
    return userOrgs.some(org => org.id === job.orgId);
  } catch (error) {
    console.error('[AuthHelper] Quote access verification error:', error);
    return false;
  }
}

/**
 * Express middleware for authentication
 */
export function authenticateSession(req: any, res: any, next: any) {
  authenticateRequest(req, res)
    .then(auth => {
      if (!auth) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      req.user = { id: auth.userId };
      next();
    })
    .catch(() => {
      res.status(500).json({ message: 'Error verifying authentication' });
    });
}

