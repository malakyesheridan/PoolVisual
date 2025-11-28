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
import { eq, desc, and, or, like, sql, count } from 'drizzle-orm';
import { users, orgs, orgMembers, jobs, quotes, photos } from '../../shared/schema.js';
import { getDatabase } from '../lib/db.js';

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
    
    // Get system stats using Drizzle
    const db = getDatabase();
    
    const [
      totalUsersResult,
      totalOrgsResult,
      totalJobsResult,
      totalQuotesResult,
      activeUsersResult,
      recentSignupsResult
    ] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(orgs),
      db.select({ count: count() }).from(jobs),
      db.select({ count: count() }).from(quotes),
      db.select({ count: count() }).from(users).where(sql`last_login_at > NOW() - INTERVAL '30 days'`),
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '7 days'`)
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
        totalUsers: Number(totalUsersResult[0]?.count || 0),
        totalOrgs: Number(totalOrgsResult[0]?.count || 0),
        totalJobs: Number(totalJobsResult[0]?.count || 0),
        totalQuotes: Number(totalQuotesResult[0]?.count || 0),
        activeUsers: Number(activeUsersResult[0]?.count || 0),
        recentSignups: Number(recentSignupsResult[0]?.count || 0),
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

    const db = getDatabase();
    
    // Build query with optional search
    let userQuery = db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        isActive: users.isActive,
        isAdmin: users.isAdmin,
      })
      .from(users);
    
    let countQuery = db.select({ count: count() }).from(users);
    
    if (search) {
      const searchCondition = or(
        like(users.email, `%${search}%`),
        like(users.username, `%${search}%`)
      );
      userQuery = userQuery.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }
    
    userQuery = userQuery.orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    
    const [userList, countResult] = await Promise.all([
      userQuery,
      countQuery
    ]);

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
      users: userList,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
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

    const db = getDatabase();
    
    let orgQuery = db.select().from(orgs);
    let countQuery = db.select({ count: count() }).from(orgs);
    
    if (search) {
      const searchCondition = like(orgs.name, `%${search}%`);
      orgQuery = orgQuery.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }
    
    orgQuery = orgQuery.orderBy(desc(orgs.createdAt)).limit(limit).offset(offset);
    
    const [orgList, countResult] = await Promise.all([
      orgQuery,
      countQuery
    ]);

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
      organizations: orgList,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
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

