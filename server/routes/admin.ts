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
import { eq, desc, and, or, like, sql, count, gte, lt, isNull, isNotNull } from 'drizzle-orm';
import { 
  users, orgs, orgMembers, jobs, quotes, photos, materials, userOnboarding,
  subscriptionPlans, subscriptionHistory, userSessions, securityEvents, loginAttempts
} from '../../shared/schema.js';
import { getDatabase } from '../db.js';

export const adminRouter = Router();

// All admin routes require authentication
adminRouter.use(requireAdmin);

/**
 * GET /api/admin/overview
 * Get system overview statistics with enhanced, actionable metrics
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
      recentSignupsResult,
      totalPhotosResult,
      totalMaterialsResult,
      onboardingCompletedResult,
      totalQuoteValueResult,
      // Subscription metrics
      activeSubscriptionsResult,
      trialSubscriptionsResult,
      pastDueSubscriptionsResult,
      canceledSubscriptionsResult,
      trialExpiringSoonResult,
      // User engagement metrics
      stuckInOnboardingResult,
      inactiveUsersResult,
      // Operational metrics
      jobsStuckResult,
      quotesPendingResult,
      // Financial metrics
      mrrResult,
      churnedThisMonthResult
    ] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(orgs),
      db.select({ count: count() }).from(jobs),
      db.select({ count: count() }).from(quotes),
      db.select({ count: count() }).from(users).where(sql`last_login_at > NOW() - INTERVAL '30 days'`),
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '7 days'`),
      db.select({ count: count() }).from(photos),
      db.select({ count: count() }).from(materials),
      // Get onboarding completion count
      db.select({ count: count() }).from(userOnboarding).where(sql`completed = true`).catch(() => [{ count: 0 }]),
      // Get total quote value
      db.select({ total: sql<number>`COALESCE(SUM(${quotes.total}::numeric), 0)` }).from(quotes).catch(() => [{ total: 0 }]),
      // Subscription status breakdown
      db.select({ count: count() }).from(orgs).where(eq(orgs.subscriptionStatus, 'active')).catch(() => [{ count: 0 }]),
      db.select({ count: count() }).from(orgs).where(eq(orgs.subscriptionStatus, 'trial')).catch(() => [{ count: 0 }]),
      db.select({ count: count() }).from(orgs).where(eq(orgs.subscriptionStatus, 'past_due')).catch(() => [{ count: 0 }]),
      db.select({ count: count() }).from(orgs).where(eq(orgs.subscriptionStatus, 'canceled')).catch(() => [{ count: 0 }]),
      // Trial expiring in next 7 days
      db.select({ count: count() }).from(orgs).where(
        and(
          eq(orgs.subscriptionStatus, 'trial'),
          sql`subscription_trial_ends_at IS NOT NULL`,
          sql`subscription_trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'`
        )
      ).catch(() => [{ count: 0 }]),
      // Users stuck in onboarding (started but not completed in 7+ days)
      db.select({ count: count() }).from(userOnboarding).where(
        and(
          sql`completed = false`,
          sql`created_at < NOW() - INTERVAL '7 days'`
        )
      ).catch(() => [{ count: 0 }]),
      // Inactive users (no login in 30+ days)
      db.select({ count: count() }).from(users).where(
        or(
          sql`last_login_at IS NULL`,
          sql`last_login_at < NOW() - INTERVAL '30 days'`
        )
      ).catch(() => [{ count: 0 }]),
      // Jobs stuck (in progress > 7 days) - assuming status field exists
      db.select({ count: count() }).from(jobs).where(
        and(
          sql`status IN ('estimating', 'scheduled')`,
          sql`created_at < NOW() - INTERVAL '7 days'`
        )
      ).catch(() => [{ count: 0 }]),
      // Quotes pending (sent but not accepted/declined > 14 days)
      db.select({ count: count() }).from(quotes).where(
        and(
          eq(quotes.status, 'sent'),
          sql`created_at < NOW() - INTERVAL '14 days'`
        )
      ).catch(() => [{ count: 0 }]),
      // MRR calculation (simplified - sum of monthly subscription values)
      db.execute(sql`
        SELECT COALESCE(SUM(
          CASE 
            WHEN o.subscription_tier = 't1' THEN COALESCE(sp.price_monthly::numeric, 0)
            WHEN o.subscription_tier = 't2' THEN COALESCE(sp.price_monthly::numeric, 0)
            WHEN o.subscription_tier = 't3' THEN COALESCE(sp.price_monthly::numeric, 0)
            ELSE 0
          END
        ), 0) as mrr
        FROM orgs o
        LEFT JOIN subscription_plans sp ON o.subscription_plan_id = sp.id
        WHERE o.subscription_status = 'active'
      `).catch(() => [{ mrr: 0 }]),
      // Churned this month (canceled in last 30 days)
      db.select({ count: count() }).from(orgs).where(
        and(
          eq(orgs.subscriptionStatus, 'canceled'),
          sql`updated_at > NOW() - INTERVAL '30 days'`
        )
      ).catch(() => [{ count: 0 }])
    ]);

    // Calculate engagement metrics
    const totalUsers = Number(totalUsersResult[0]?.count || 0);
    const totalJobs = Number(totalJobsResult[0]?.count || 0);
    const totalQuotes = Number(totalQuotesResult[0]?.count || 0);
    const totalPhotos = Number(totalPhotosResult[0]?.count || 0);
    const onboardingCompleted = Array.isArray(onboardingCompletedResult) ? Number(onboardingCompletedResult[0]?.count || 0) : 0;
    const totalQuoteValue = Array.isArray(totalQuoteValueResult) ? Number(totalQuoteValueResult[0]?.total || 0) : 0;
    
    // Extract MRR
    const mrrData = Array.isArray(mrrResult) ? mrrResult : (mrrResult as any).rows || [];
    const mrr = Number(mrrData[0]?.mrr || 0);

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
        // Basic counts
        totalUsers: totalUsers,
        totalOrgs: Number(totalOrgsResult[0]?.count || 0),
        totalJobs: totalJobs,
        totalQuotes: totalQuotes,
        totalPhotos: totalPhotos,
        totalMaterials: Number(totalMaterialsResult[0]?.count || 0),
        activeUsers: Number(activeUsersResult[0]?.count || 0),
        recentSignups: Number(recentSignupsResult[0]?.count || 0),
        onboardingCompleted: onboardingCompleted,
        totalQuoteValue: totalQuoteValue,
        // Engagement metrics
        avgJobsPerUser: totalUsers > 0 ? (totalJobs / totalUsers).toFixed(2) : '0.00',
        avgQuotesPerJob: totalJobs > 0 ? (totalQuotes / totalJobs).toFixed(2) : '0.00',
        avgPhotosPerJob: totalJobs > 0 ? (totalPhotos / totalJobs).toFixed(2) : '0.00',
        onboardingCompletionRate: totalUsers > 0 ? ((onboardingCompleted / totalUsers) * 100).toFixed(1) : '0.0',
        avgQuoteValue: totalQuotes > 0 ? (totalQuoteValue / totalQuotes).toFixed(2) : '0.00',
        // Subscription metrics (actionable)
        activeSubscriptions: Number(activeSubscriptionsResult[0]?.count || 0),
        trialSubscriptions: Number(trialSubscriptionsResult[0]?.count || 0),
        pastDueSubscriptions: Number(pastDueSubscriptionsResult[0]?.count || 0),
        canceledSubscriptions: Number(canceledSubscriptionsResult[0]?.count || 0),
        trialExpiringSoon: Number(trialExpiringSoonResult[0]?.count || 0),
        // User engagement (actionable)
        stuckInOnboarding: Number(stuckInOnboardingResult[0]?.count || 0),
        inactiveUsers: Number(inactiveUsersResult[0]?.count || 0),
        // Operational (actionable)
        jobsStuck: Number(jobsStuckResult[0]?.count || 0),
        quotesPending: Number(quotesPendingResult[0]?.count || 0),
        // Financial
        mrr: mrr,
        churnedThisMonth: Number(churnedThisMonthResult[0]?.count || 0),
      }
    });
  } catch (error: any) {
    console.error('[Admin/Overview] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get overview' });
  }
});

/**
 * GET /api/admin/analytics/time-series
 * Get time-series data for charts (users, jobs, quotes over time)
 */
adminRouter.get('/analytics/time-series', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const days = parseInt(req.query.days as string) || 30;
    
    const db = getDatabase();
    
    // Get daily signups - days is already sanitized (parsed as integer)
    const userSignupsResult = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::integer as count
      FROM users
      WHERE created_at > NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const userSignups = Array.isArray(userSignupsResult) ? userSignupsResult : ((userSignupsResult as any).rows || []);
    
    // Get daily job creations
    const jobCreationsResult = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::integer as count
      FROM jobs
      WHERE created_at > NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const jobCreations = Array.isArray(jobCreationsResult) ? jobCreationsResult : ((jobCreationsResult as any).rows || []);
    
    // Get daily quote creations
    const quoteCreationsResult = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::integer as count
      FROM quotes
      WHERE created_at > NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const quoteCreations = Array.isArray(quoteCreationsResult) ? quoteCreationsResult : ((quoteCreationsResult as any).rows || []);
    
    // Get daily active users
    const activeUsersResult = await db.execute(sql`
      SELECT 
        DATE(last_login_at) as date,
        COUNT(DISTINCT id)::integer as count
      FROM users
      WHERE last_login_at > NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY DATE(last_login_at)
      ORDER BY date ASC
    `);
    const activeUsers = Array.isArray(activeUsersResult) ? activeUsersResult : ((activeUsersResult as any).rows || []);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'analytics',
        metadata: { type: 'time-series', days },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    // Combine data by date
    // Neon HTTP returns array directly, not { rows: [...] }
    const dateMap = new Map<string, { date: string; users: number; jobs: number; quotes: number; activeUsers: number }>();
    
    // Initialize all dates in range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dateMap.set(dateStr, { date: dateStr, users: 0, jobs: 0, quotes: 0, activeUsers: 0 });
    }
    
    // Add user signups
    userSignups.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
      const entry = dateMap.get(dateStr);
      if (entry) entry.users = Number(row.count || 0);
    });
    
    // Add job creations
    jobCreations.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
      const entry = dateMap.get(dateStr);
      if (entry) entry.jobs = Number(row.count || 0);
    });
    
    // Add quote creations
    quoteCreations.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
      const entry = dateMap.get(dateStr);
      if (entry) entry.quotes = Number(row.count || 0);
    });
    
    // Add active users
    activeUsers.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
      const entry = dateMap.get(dateStr);
      if (entry) entry.activeUsers = Number(row.count || 0);
    });

    res.json({
      ok: true,
      data: Array.from(dateMap.values())
    });
  } catch (error: any) {
    console.error('[Admin/Analytics/TimeSeries] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get time-series data' });
  }
});

/**
 * GET /api/admin/analytics/growth
 * Get growth metrics (WoW, MoM, YoY)
 */
adminRouter.get('/analytics/growth', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const db = getDatabase();
    
    // Get current period counts
    const [currentWeek, currentMonth, currentYear] = await Promise.all([
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '7 days'`),
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '30 days'`),
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '365 days'`)
    ]);
    
    // Get previous period counts
    const [prevWeek, prevMonth, prevYear] = await Promise.all([
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days'`),
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '60 days' AND created_at <= NOW() - INTERVAL '30 days'`),
      db.select({ count: count() }).from(users).where(sql`created_at > NOW() - INTERVAL '730 days' AND created_at <= NOW() - INTERVAL '365 days'`)
    ]);
    
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'analytics',
        metadata: { type: 'growth' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      growth: {
        users: {
          weekOverWeek: calculateGrowth(
            Number(currentWeek[0]?.count || 0),
            Number(prevWeek[0]?.count || 0)
          ).toFixed(1),
          monthOverMonth: calculateGrowth(
            Number(currentMonth[0]?.count || 0),
            Number(prevMonth[0]?.count || 0)
          ).toFixed(1),
          yearOverYear: calculateGrowth(
            Number(currentYear[0]?.count || 0),
            Number(prevYear[0]?.count || 0)
          ).toFixed(1),
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin/Analytics/Growth] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get growth metrics' });
  }
});

/**
 * GET /api/admin/analytics/industry-breakdown
 * Get breakdown by industry
 */
adminRouter.get('/analytics/industry-breakdown', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const db = getDatabase();
    
    // Get users by industry (from onboarding or orgs)
    const usersByIndustry = await db.execute(sql`
      SELECT 
        COALESCE(o.industry, 'unknown') as industry,
        COUNT(DISTINCT u.id)::integer as user_count
      FROM users u
      LEFT JOIN org_members om ON om.user_id = u.id
      LEFT JOIN orgs o ON o.id = om.org_id
      GROUP BY o.industry
      ORDER BY user_count DESC
    `).catch(() => []);
    
    // Get jobs by industry
    const jobsByIndustry = await db.execute(sql`
      SELECT 
        COALESCE(o.industry, 'unknown') as industry,
        COUNT(j.id)::integer as job_count
      FROM jobs j
      LEFT JOIN orgs o ON o.id = j.org_id
      GROUP BY o.industry
      ORDER BY job_count DESC
    `).catch(() => []);
    
    // Get quotes by industry
    const quotesByIndustry = await db.execute(sql`
      SELECT 
        COALESCE(o.industry, 'unknown') as industry,
        COUNT(q.id)::integer as quote_count,
        COALESCE(SUM(q.total::numeric), 0)::numeric as total_value
      FROM quotes q
      LEFT JOIN jobs j ON j.id = q.job_id
      LEFT JOIN orgs o ON o.id = j.org_id
      GROUP BY o.industry
      ORDER BY quote_count DESC
    `).catch(() => []);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'analytics',
        metadata: { type: 'industry-breakdown' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      breakdown: {
        users: (Array.isArray(usersByIndustry) ? usersByIndustry : []).map((row: any) => ({
          industry: row.industry || 'unknown',
          count: Number(row.user_count || 0)
        })),
        jobs: (Array.isArray(jobsByIndustry) ? jobsByIndustry : []).map((row: any) => ({
          industry: row.industry || 'unknown',
          count: Number(row.job_count || 0)
        })),
        quotes: (Array.isArray(quotesByIndustry) ? quotesByIndustry : []).map((row: any) => ({
          industry: row.industry || 'unknown',
          count: Number(row.quote_count || 0),
          totalValue: Number(row.total_value || 0)
        }))
      }
    });
  } catch (error: any) {
    console.error('[Admin/Analytics/IndustryBreakdown] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get industry breakdown' });
  }
});

/**
 * GET /api/admin/analytics/activity
 * Get recent activity feed
 */
adminRouter.get('/analytics/activity', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const limit = parseInt(req.query.limit as string) || 20;
    const db = getDatabase();
    
    // Get recent user signups
    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      createdAt: users.createdAt,
      type: sql<string>`'user_signup'`
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);
    
    // Get recent jobs
    const recentJobs = await db.select({
      id: jobs.id,
      clientName: jobs.clientName,
      status: jobs.status,
      createdAt: jobs.createdAt,
      type: sql<string>`'job_created'`
    })
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
    
    // Get recent quotes
    const recentQuotes = await db.select({
      id: quotes.id,
      status: quotes.status,
      total: quotes.total,
      createdAt: quotes.createdAt,
      type: sql<string>`'quote_created'`
    })
    .from(quotes)
    .orderBy(desc(quotes.createdAt))
    .limit(limit);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'analytics',
        metadata: { type: 'activity' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    // Combine and sort by date
    const activities = [
      ...recentUsers.map(u => ({ ...u, type: 'user_signup' })),
      ...recentJobs.map(j => ({ ...j, type: 'job_created' })),
      ...recentQuotes.map(q => ({ ...q, type: 'quote_created' }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, limit);

    res.json({
      ok: true,
      activities
    });
  } catch (error: any) {
    console.error('[Admin/Analytics/Activity] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get activity feed' });
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
 * Get comprehensive user details with all associated data
 */
adminRouter.get('/users/:id', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const userId = req.params.id;

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const db = getDatabase();
    
    // Get user's organizations with full details
    const userOrgs = await storage.getUserOrgs(userId);
    const orgIds = userOrgs.map(org => org.id);

    // Get all jobs for user's organizations
    const allJobs = orgIds.length > 0 
      ? await Promise.all(orgIds.map(orgId => storage.getJobs(orgId)))
      : [];
    const jobs = allJobs.flat();
    
    // Get all quotes for those jobs (quotes are linked to jobs, so query by job IDs)
    const jobIds = jobs.map(job => job.id);
    const { inArray } = await import('drizzle-orm');
    const userQuotes = jobIds.length > 0
      ? await db.select().from(quotes).where(inArray(quotes.jobId, jobIds)).orderBy(desc(quotes.createdAt))
      : [];
    
    // Get all photos for those jobs
    const userPhotos = jobIds.length > 0
      ? await db.select().from(photos).where(inArray(photos.jobId, jobIds)).orderBy(desc(photos.createdAt))
      : [];
    
    // Get user onboarding data
    const onboarding = await storage.getUserOnboarding(userId);
    
    // Get user sessions (last 10)
    const sessions = await storage.getUserSessions(userId);
    
    // Get security events (last 20)
    const securityEvents = await storage.getSecurityEvents(userId, { limit: 20 });
    
    // Get login attempts (last 10)
    const recentLoginAttempts = await db.select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, user.email))
      .orderBy(desc(loginAttempts.createdAt))
      .limit(10)
      .catch(() => []);

    // Calculate usage stats
    const usageStats = {
      totalJobs: jobs.length,
      totalQuotes: userQuotes.length,
      totalPhotos: userPhotos.length,
      jobsThisMonth: jobs.filter(j => {
        const created = new Date(j.createdAt);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length,
      quotesThisMonth: userQuotes.filter(q => {
        const created = new Date(q.createdAt);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length,
      photosThisMonth: userPhotos.filter((p: any) => {
        const created = new Date(p.createdAt);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length,
    };

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
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
      jobs: jobs.slice(0, 50), // Limit to recent 50
      quotes: userQuotes.slice(0, 50), // Limit to recent 50
      photos: userPhotos.slice(0, 100), // Limit to recent 100
      onboarding,
      sessions: sessions.slice(0, 10),
      securityEvents: securityEvents.slice(0, 20),
      loginAttempts: recentLoginAttempts,
      usageStats,
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
 * GET /api/admin/organizations/:id
 * Get comprehensive organization details with all associated data
 */
adminRouter.get('/organizations/:id', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const orgId = req.params.id;

    const db = getDatabase();
    
    // Get organization
    const org = await storage.getOrg(orgId);
    if (!org) {
      return res.status(404).json({ ok: false, error: 'Organization not found' });
    }

    // Get subscription plan details if exists
    const subscriptionPlan = org.subscriptionPlanId
      ? await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, org.subscriptionPlanId)).limit(1)
      : null;

    // Get subscription history
    const subscriptionHistoryList = await db.select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.orgId, orgId))
      .orderBy(desc(subscriptionHistory.createdAt))
      .limit(50);

    // Get all members
    const members = await db.select({
      id: orgMembers.id,
      userId: orgMembers.userId,
      role: orgMembers.role,
      createdAt: orgMembers.createdAt,
      user: {
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      }
    })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, orgId))
      .orderBy(desc(orgMembers.createdAt));

    // Get all jobs
    const orgJobs = await storage.getJobs(orgId);
    
    // Get all quotes for those jobs (quotes are linked to jobs)
    const jobIds = orgJobs.map(job => job.id);
    const { inArray } = await import('drizzle-orm');
    const orgQuotes = jobIds.length > 0
      ? await db.select().from(quotes).where(inArray(quotes.jobId, jobIds)).orderBy(desc(quotes.createdAt))
      : [];
    
    // Get all photos
    const orgPhotos = jobIds.length > 0
      ? await db.select().from(photos).where(inArray(photos.jobId, jobIds)).orderBy(desc(photos.createdAt))
      : [];
    
    // Get materials
    const orgMaterials = await storage.getMaterials(orgId);
    
    // Get settings
    const settings = await storage.getOrgSettings(orgId);
    
    // Calculate usage stats
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const usageStats = {
      totalJobs: orgJobs.length,
      totalQuotes: orgQuotes.length,
      totalPhotos: orgPhotos.length,
      totalMaterials: orgMaterials.length,
      jobsThisMonth: orgJobs.filter(j => new Date(j.createdAt) >= thisMonth).length,
      quotesThisMonth: orgQuotes.filter(q => new Date(q.createdAt) >= thisMonth).length,
      photosThisMonth: orgPhotos.filter((p: any) => new Date(p.createdAt) >= thisMonth).length,
      totalQuoteValue: orgQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0),
      avgQuoteValue: orgQuotes.length > 0 
        ? orgQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0) / orgQuotes.length 
        : 0,
    };

    // Calculate financial summary
    const financialSummary = {
      totalQuoteValue: usageStats.totalQuoteValue,
      avgQuoteValue: usageStats.avgQuoteValue,
      quotesThisMonth: usageStats.quotesThisMonth,
      quoteValueThisMonth: orgQuotes
        .filter(q => new Date(q.createdAt) >= thisMonth)
        .reduce((sum, q) => sum + Number(q.total || 0), 0),
    };

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'organization',
        resourceId: orgId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      organization: org,
      subscriptionPlan: subscriptionPlan?.[0] || null,
      subscriptionHistory: subscriptionHistoryList,
      members: members.map(m => ({
        ...m,
        user: m.user,
      })),
      jobs: orgJobs.slice(0, 50), // Limit to recent 50
      quotes: orgQuotes.slice(0, 50), // Limit to recent 50
      photos: orgPhotos.slice(0, 100), // Limit to recent 100
      materials: orgMaterials.slice(0, 100), // Limit to recent 100
      settings,
      usageStats,
      financialSummary,
    });
  } catch (error: any) {
    console.error('[Admin/Organization] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get organization' });
  }
});

/**
 * GET /api/admin/jobs
 * List all jobs with pagination and filtering
 */
adminRouter.get('/jobs', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const industry = req.query.industry as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    
    // Build conditions
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(jobs.clientName, `%${search}%`),
          like(jobs.clientEmail, `%${search}%`),
          like(jobs.address, `%${search}%`)
        )
      );
    }
    
    if (status) {
      conditions.push(eq(jobs.status, status as any));
    }
    
    // For industry filter, use raw SQL with join
    if (industry) {
      // Use raw SQL for industry filter with join
      const industryCondition = sql`EXISTS (SELECT 1 FROM orgs WHERE orgs.id = ${jobs.orgId} AND orgs.industry = ${industry})`;
      conditions.push(industryCondition);
    }
    
    const whereCondition = conditions.length > 0 
      ? (conditions.length === 1 ? conditions[0] : and(...conditions))
      : undefined;
    
    let jobQuery = db
      .select({
        id: jobs.id,
        clientName: jobs.clientName,
        clientEmail: jobs.clientEmail,
        clientPhone: jobs.clientPhone,
        address: jobs.address,
        status: jobs.status,
        createdAt: jobs.createdAt,
        orgId: jobs.orgId,
      })
      .from(jobs);
    
    let countQuery = db.select({ count: count() }).from(jobs);
    
    if (whereCondition) {
      jobQuery = jobQuery.where(whereCondition);
      countQuery = countQuery.where(whereCondition);
    }
    
    jobQuery = jobQuery.orderBy(desc(jobs.createdAt)).limit(limit).offset(offset);
    
    const [jobList, countResult] = await Promise.all([
      jobQuery,
      countQuery
    ]);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'jobs',
        metadata: { page, limit, search, status, industry },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      jobs: jobList,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      }
    });
  } catch (error: any) {
    console.error('[Admin/Jobs] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get jobs' });
  }
});

/**
 * GET /api/admin/quotes
 * List all quotes with pagination and filtering
 */
adminRouter.get('/quotes', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    
    let quoteQuery = db
      .select({
        id: quotes.id,
        jobId: quotes.jobId,
        name: quotes.name,
        status: quotes.status,
        subtotal: quotes.subtotal,
        gst: quotes.gst,
        total: quotes.total,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes);
    
    let countQuery = db.select({ count: count() }).from(quotes);
    
    if (search) {
      const searchCondition = like(quotes.name, `%${search}%`);
      quoteQuery = quoteQuery.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }
    
    if (status) {
      const statusCondition = eq(quotes.status, status as any);
      quoteQuery = quoteQuery.where(statusCondition);
      countQuery = countQuery.where(statusCondition);
    }
    
    quoteQuery = quoteQuery.orderBy(desc(quotes.createdAt)).limit(limit).offset(offset);
    
    const [quoteList, countResult] = await Promise.all([
      quoteQuery,
      countQuery
    ]);

    await logAdminAction(
      adminUser.id,
      AdminActionTypes.ANALYTICS_VIEW,
      {
        resourceType: 'quotes',
        metadata: { page, limit, search, status },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      ok: true,
      quotes: quoteList,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      }
    });
  } catch (error: any) {
    console.error('[Admin/Quotes] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get quotes' });
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

/**
 * POST /api/admin/switch-industry-view
 * Switch admin's preferred industry view (doesn't affect org)
 */
adminRouter.post('/switch-industry-view', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser;
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const { industry } = req.body;
    
    if (!industry || !['pool', 'landscaping', 'building', 'electrical', 'plumbing', 'real_estate', 'other'].includes(industry)) {
      return res.status(400).json({ 
        ok: false,
        error: 'Invalid industry. Must be one of: pool, landscaping, building, electrical, plumbing, real_estate, other' 
      });
    }

    // Update or create admin preference
    await storage.upsertAdminIndustryPreference(adminUser.id, industry);

    // Log admin action
    await logAdminAction({
      adminUserId: adminUser.id,
      actionType: AdminActionTypes.SETTINGS_UPDATE,
      resourceType: 'admin_preference',
      details: { industry },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ ok: true, industry });
  } catch (error: any) {
    console.error('[Admin/SwitchIndustryView] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to switch industry view' });
  }
});

/**
 * GET /api/admin/industry-view
 * Get admin's preferred industry view
 */
adminRouter.get('/industry-view', async (req: AdminRequest, res) => {
  try {
    const adminUser = req.adminUser;
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const preference = await storage.getAdminIndustryPreference(adminUser.id);
    res.json({ 
      ok: true, 
      industry: preference?.preferredIndustry || null 
    });
  } catch (error: any) {
    console.error('[Admin/GetIndustryView] Error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to get industry view' });
  }
});

