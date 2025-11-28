/**
 * Admin API Routes
 * 
 * Provides administrative endpoints for system management.
 * All routes require admin authentication via requireAdmin middleware.
 */

import { Router } from 'express';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { logAdminAction, AdminActionTypes } from '../lib/adminAudit.js';
import { storage } from '../storage.js';
import { PasswordService } from '../lib/passwordService.js';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { users, orgs, orgMembers, jobs, quotes, photos } from '../../shared/schema.js';

export const adminRouter = Router();

// All admin routes require authentication
adminRouter.use(requireAdmin);

/**
 * GET /api/admin/overview
 * Get system overview statistics
 */
adminRouter.get('/overview', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    
    // Get system stats (using raw SQL for efficiency)
    const db = (await import('../lib/db.js')).getDatabase();
    
    const [
      totalUsers,
      totalOrgs,
      totalJobs,
      totalQuotes,
      activeUsers,
      recentSignups
    ] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM users`),
      db.execute(sql`SELECT COUNT(*) as count FROM orgs`),
      db.execute(sql`SELECT COUNT(*) as count FROM jobs`),
      db.execute(sql`SELECT COUNT(*) as count FROM quotes`),
      db.execute(sql`SELECT COUNT(*) as count FROM users WHERE last_login_at > NOW() - INTERVAL '30 days'`),
      db.execute(sql`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'`)
    ]);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'system',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      stats: {
        totalUsers: Number(totalUsers.rows[0]?.count || 0),
        totalOrgs: Number(totalOrgs.rows[0]?.count || 0),
        totalJobs: Number(jobs.rows[0]?.count || 0),
        totalQuotes: Number(quotes.rows[0]?.count || 0),
        activeUsers: Number(activeUsers.rows[0]?.count || 0),
        recentSignups: Number(recentSignups.rows[0]?.count || 0),
      }
    });
  } catch (error: any) {
    console.error('[Admin/Overview] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get overview' });
  }
});

/**
 * GET /api/admin/users
 * List all users with pagination and filtering
 */
adminRouter.get('/users', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    const db = (await import('../lib/db.js')).getDatabase();
    
    let query = sql`SELECT id, email, username, created_at, last_login_at, is_active, is_admin FROM users WHERE 1=1`;
    const params: any[] = [];
    
    if (search) {
      query = sql`${query} AND (email ILIKE ${`%${search}%`} OR username ILIKE ${`%${search}%`})`;
    }
    
    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await db.execute(query);
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM users ${search ? sql`WHERE email ILIKE ${`%${search}%`} OR username ILIKE ${`%${search}%`}` : sql``}`);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'users',
        metadata: { page, limit, search },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      users: result.rows,
      pagination: {
        page,
        limit,
        total: Number(countResult.rows[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult.rows[0]?.count || 0) / limit),
      }
    });
  } catch (error: any) {
    console.error('[Admin/Users] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get users' });
  }
});

/**
 * GET /api/admin/users/:id
 * Get user details
 */
adminRouter.get('/users/:id', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const userId = req.params.id;

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Get user's organizations
    const userOrgs = await storage.getUserOrgs(userId);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.USER_CREATE, // Using as view action
      {
        resourceType: 'user',
        resourceId: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      user: {
        ...user,
        password: undefined, // Never return password
      },
      organizations: userOrgs,
    });
  } catch (error: any) {
    console.error('[Admin/User] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get user' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user
 */
adminRouter.put('/users/:id', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const userId = req.params.id;
    const updates = req.body;

    // Don't allow updating admin status via this endpoint (use separate endpoint)
    const { isAdmin, adminPermissions, ...safeUpdates } = updates;
    
    // If password is being updated, hash it
    if (safeUpdates.password) {
      safeUpdates.password = await PasswordService.hashPassword(safeUpdates.password);
    }

    const previousUser = await storage.getUser(userId);
    if (!previousUser) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const updatedUser = await storage.updateUser(userId, safeUpdates);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.USER_UPDATE,
      {
        resourceType: 'user',
        resourceId: userId,
        previousValue: { ...previousUser, password: undefined },
        newValue: { ...updatedUser, password: undefined },
        changes: safeUpdates,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      user: {
        ...updatedUser,
        password: undefined, // Never return password
      }
    });
  } catch (error: any) {
    console.error('[Admin/UpdateUser] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to update user' });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password
 */
adminRouter.post('/users/:id/reset-password', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ ok: false, error: 'New password is required' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const hashedPassword = await PasswordService.hashPassword(newPassword);
    await storage.updateUser(userId, { password: hashedPassword });

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.USER_RESET_PASSWORD,
      {
        resourceType: 'user',
        resourceId: userId,
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({ ok: true, message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('[Admin/ResetPassword] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to reset password' });
  }
});

/**
 * POST /api/admin/users/:id/activate
 * Activate or deactivate user account
 */
adminRouter.post('/users/:id/activate', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const userId = req.params.id;
    const { isActive } = req.body;

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    await storage.updateUser(userId, { isActive: isActive !== false });

    await logAdminAction(
      adminUser.id,
      isActive !== false ? AdminActionTypes.USER_ACTIVATE : AdminActionTypes.USER_DEACTIVATE,
      {
        resourceType: 'user',
        resourceId: userId,
        metadata: { email: user.email, isActive: isActive !== false },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({ ok: true, message: `User ${isActive !== false ? 'activated' : 'deactivated'} successfully` });
  } catch (error: any) {
    console.error('[Admin/ActivateUser] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to update user status' });
  }
});

/**
 * GET /api/admin/organizations
 * List all organizations
 */
adminRouter.get('/organizations', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    const db = (await import('../lib/db.js')).getDatabase();
    
    let query = sql`SELECT * FROM orgs WHERE 1=1`;
    if (search) {
      query = sql`${query} AND name ILIKE ${`%${search}%`}`;
    }
    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await db.execute(query);
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM orgs ${search ? sql`WHERE name ILIKE ${`%${search}%`}` : sql``}`);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'organizations',
        metadata: { page, limit, search },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      organizations: result.rows,
      pagination: {
        page,
        limit,
        total: Number(countResult.rows[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult.rows[0]?.count || 0) / limit),
      }
    });
  } catch (error: any) {
    console.error('[Admin/Organizations] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get organizations' });
  }
});

/**
 * GET /api/admin/audit-logs
 * Get admin action audit logs
 */
adminRouter.get('/audit-logs', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const logs = await storage.getAdminActions({
      limit,
      offset,
      adminUserId: req.query.adminUserId as string,
      actionType: req.query.actionType as string,
    });

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.AUDIT_VIEW,
      {
        resourceType: 'audit_logs',
        metadata: { page, limit },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      logs,
      pagination: {
        page,
        limit,
      }
    });
  } catch (error: any) {
    console.error('[Admin/AuditLogs] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get audit logs' });
  }
});

