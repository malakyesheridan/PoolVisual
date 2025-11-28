/**
 * Admin Authentication Middleware
 * 
 * Provides middleware to verify admin access and check permissions.
 * Admins have full system access and bypass RLS policies.
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';

export interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    username: string;
    isAdmin: boolean;
    adminPermissions: string[];
  };
}

/**
 * Middleware to require admin access
 * Returns 403 if user is not an admin
 */
export async function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).session?.user || (req as any).user;
    
    if (!user || !user.id) {
      res.status(401).json({ 
        ok: false,
        error: 'Authentication required' 
      });
      return;
    }

    // Get full user from database to check admin status
    const dbUser = await storage.getUser(user.id);
    
    if (!dbUser) {
      res.status(401).json({ 
        ok: false,
        error: 'User not found' 
      });
      return;
    }

    if (!dbUser.isAdmin) {
      res.status(403).json({ 
        ok: false,
        error: 'Admin access required' 
      });
      return;
    }

    // Attach admin user to request
    req.adminUser = {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username || '',
      isAdmin: dbUser.isAdmin || false,
      adminPermissions: (dbUser.adminPermissions as string[]) || [],
    };

    next();
  } catch (error: any) {
    console.error('[AdminAuth] Error checking admin access:', error);
    res.status(500).json({ 
      ok: false,
      error: 'Error verifying admin access' 
    });
  }
}

/**
 * Middleware factory to require specific permission
 * Usage: requirePermission('users.edit')(req, res, next)
 */
export function requirePermission(permission: string) {
  return async (
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // First ensure user is admin
    await requireAdmin(req, res, async () => {
      const admin = req.adminUser;
      
      if (!admin) {
        res.status(403).json({ 
          ok: false,
          error: 'Admin access required' 
        });
        return;
      }

      const permissions = admin.adminPermissions || [];
      
      // Check if user has wildcard permission or specific permission
      if (!permissions.includes('*') && !permissions.includes(permission)) {
        res.status(403).json({ 
          ok: false,
          error: `Permission required: ${permission}` 
        });
        return;
      }

      next();
    });
  };
}

/**
 * Helper function to check if user is admin (non-middleware)
 * Useful for conditional logic in routes
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    return user?.isAdmin === true && user?.isActive === true;
  } catch (error) {
    console.error('[AdminAuth] Error checking admin status:', error);
    return false;
  }
}

