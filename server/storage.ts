
import { MockStorage } from './mockStorage.js';

import { 
  User, 
  InsertUser, 
  Org, 
  InsertOrg, 
  Job, 
  InsertJob, 
  Photo, 
  InsertPhoto, 
  Material, 
  InsertMaterial, 
  Mask, 
  InsertMask, 
  Quote, 
  InsertQuote,
  QuoteItem,
  InsertQuoteItem,
  CalibrationMeta,
  Settings,
  TradeCategoryMapping,
  InsertTradeCategoryMapping,
  UserOnboarding,
  InsertUserOnboarding,
  SubscriptionPlan,
  InsertSubscriptionPlan,
  SubscriptionHistory,
  InsertSubscriptionHistory,
  AdminIndustryPreference,
  InsertAdminIndustryPreference,
  PropertyNote,
  InsertPropertyNote,
  Opportunity,
  InsertOpportunity,
  OpportunityFollowup,
  InsertOpportunityFollowup,
  OpportunityNote,
  InsertOpportunityNote,
  OpportunityActivity,
  InsertOpportunityActivity,
  OpportunityDocument,
  InsertOpportunityDocument,
  Contact,
  InsertContact,
  Pipeline,
  InsertPipeline,
  PipelineStage,
  InsertPipelineStage,
  OpportunityTask,
  InsertOpportunityTask,
  users,
  orgs,
  orgMembers,
  settings,
  userPreferences,
  tradeCategoryMapping,
  userOnboarding,
  subscriptionPlans,
  subscriptionHistory,
  adminIndustryPreferences,
  jobs,
  photos,
  materials,
  masks,
  quotes,
  quoteItems,
  propertyNotes,
  opportunities,
  opportunityFollowups,
  opportunityTasks,
  opportunityNotes,
  opportunityActivities,
  opportunityDocuments,
  contacts,
  pipelines,
  pipelineStages,
  loginAttempts,
  securityEvents,
  verificationTokens,
  userSessions,
  adminActions,
  type LoginAttempt,
  type SecurityEvent,
  type VerificationToken,
  type UserSession,
  type AdminAction,
  type InsertAdminAction
} from "../shared/schema.js";
import { eq, desc, and, sql, gte, ne, asc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDatabase } from './db.js';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

// Define OrgMember type
type OrgMember = {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

// Only require DATABASE_URL if not in no-DB mode
if (!process.env.DATABASE_URL && process.env.NO_DB_MODE !== 'true') {
  throw new Error("DATABASE_URL is required");
}

// Helper function to check if database is available
function ensureDb(): NeonHttpDatabase {
  try {
    const db = getDatabase();
    if (!db) {
      console.error('[Storage] Database not available - getDatabase() returned null');
      throw new Error("Database not available");
    }
    return db;
  } catch (error: any) {
    console.error('[Storage] Failed to get database:', error?.message || String(error));
    throw error;
  }
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // User Preferences
  getUserPreferences(userId: string): Promise<any | undefined>;
  upsertUserPreferences(userId: string, preferences: any): Promise<any>;
  
  // Organizations
  getOrg(id: string): Promise<Org | undefined>;
  createOrg(org: InsertOrg, userId: string): Promise<Org>;
  updateOrg(id: string, updates: Partial<InsertOrg>): Promise<Org>;
  getUserOrgs(userId: string): Promise<Org[]>;
  getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined>;
  createOrgMember(orgId: string, userId: string, role?: string): Promise<OrgMember>;
  
  // Jobs
  createJob(job: InsertJob, userId: string): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  getJobs(userId: string): Promise<Job[]>;
  
  // Photos
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  getPhoto(id: string): Promise<Photo | undefined>;
  getJobPhotos(jobId: string, category?: 'marketing' | 'renovation_buyer'): Promise<Photo[]>;
  updatePhoto(id: string, data: { originalUrl: string; width: number; height: number }): Promise<Photo>;
  updatePhotoCategory(id: string, category: 'marketing' | 'renovation_buyer'): Promise<Photo>;
  deletePhoto(id: string): Promise<void>;
  updatePhotoCalibration(id: string, pixelsPerMeter: number, meta: CalibrationMeta): Promise<Photo>;
  updatePhotoCalibrationV2(photoId: string, calibration: { ppm: number; samples: CalibrationMeta['samples']; stdevPct?: number }): Promise<Photo>;
  getPhotoCalibration(photoId: string): Promise<{ ppm: number; samples: CalibrationMeta['samples']; stdevPct?: number } | null>;
  updatePhotoComposite(photoId: string, compositeUrl: string): Promise<Photo>;
  clearPhotoComposite(photoId: string): Promise<void>;
  
  // Property Notes (for real estate)
  getPropertyNotes(jobId: string): Promise<any[]>;
  createPropertyNote(data: { jobId: string; userId: string; noteText: string; tags?: string[] }): Promise<any>;
  updatePropertyNote(id: string, data: { noteText?: string; tags?: string[] }): Promise<any>;
  deletePropertyNote(id: string): Promise<void>;
  
  // Opportunities (for real estate)
  createOpportunity(opportunity: any): Promise<any>;
  getOpportunity(id: string): Promise<any | undefined>;
  getOpportunities(userId: string, filters?: any): Promise<any[]>;
  updateOpportunity(id: string, updates: any): Promise<any>;
  deleteOpportunity(id: string): Promise<void>;
  
  // Opportunity Follow-ups
  getOpportunityFollowups(opportunityId: string): Promise<any[]>;
  createOpportunityFollowup(data: any): Promise<any>;
  updateOpportunityFollowup(id: string, updates: any): Promise<any>;
  deleteOpportunityFollowup(id: string): Promise<void>;
  
  // Opportunity Notes
  getOpportunityNotes(opportunityId: string): Promise<any[]>;
  createOpportunityNote(data: any): Promise<any>;
  updateOpportunityNote(id: string, updates: any): Promise<any>;
  deleteOpportunityNote(id: string): Promise<void>;
  
  // Opportunity Activities
  getOpportunityActivities(opportunityId: string): Promise<any[]>;
  createOpportunityActivity(data: any): Promise<any>;
  
  // Opportunity Documents
  getOpportunityDocuments(opportunityId: string): Promise<any[]>;
  createOpportunityDocument(data: any): Promise<any>;
  deleteOpportunityDocument(id: string): Promise<void>;
  
  // Contacts
  getContacts(userId: string): Promise<any[]>;
  getContact(id: string): Promise<any | undefined>;
  createContact(data: any): Promise<any>;
  updateContact(id: string, updates: any): Promise<any>;
  deleteContact(id: string): Promise<void>;
  
  // Pipelines
  getPipelines(userId: string): Promise<any[]>;
  getPipeline(id: string): Promise<any | undefined>;
  createPipeline(data: any): Promise<any>;
  updatePipeline(id: string, updates: any): Promise<any>;
  
  // Pipeline Stages
  getPipelineStages(pipelineId: string): Promise<any[]>;
  getPipelineStage(id: string): Promise<any | undefined>;
  createPipelineStage(data: any): Promise<any>;
  updatePipelineStage(id: string, updates: any): Promise<any>;
  
  // Materials
  getAllMaterials(): Promise<Material[]>;
  getMaterials(userId?: string, category?: string, industry?: string): Promise<Material[]>;
  getMaterial(id: string): Promise<Material | null>;
  createMaterial(material: InsertMaterial, userId?: string): Promise<Material>;
  updateMaterial(id: string, material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;
  
  // Masks
  createMask(mask: InsertMask, userId: string): Promise<Mask>;
  getMask(id: string): Promise<Mask | null>;
  getMasksByPhoto(photoId: string): Promise<Mask[]>;
  deleteMask(id: string): Promise<void>;
  
  // Quotes
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByToken(token: string): Promise<Quote | undefined>;
  getQuotes(userId: string, filters?: { status?: string; jobId?: string }): Promise<Quote[]>;
  addQuoteItem(item: InsertQuoteItem): Promise<QuoteItem>;
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  updateQuoteItem(itemId: string, updates: Partial<QuoteItem>): Promise<QuoteItem>;
  deleteQuoteItem(itemId: string): Promise<void>;
  updateQuote(id: string, updates: Partial<Quote>): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;
  
  // Settings
  getOrgSettings(orgId: string): Promise<Settings | undefined>;
  updateOrgSettings(orgId: string, updates: Partial<Settings>): Promise<Settings>;
  
  // Trade Categories
  getTradeCategories(industry: string): Promise<TradeCategoryMapping[]>;
  getCategoryLabel(industry: string, categoryKey: string): Promise<string | null>;
  
  // Subscription Plans
  getSubscriptionPlans(industry: string): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | null>;
  getSubscriptionPlanByKey(planKey: string): Promise<SubscriptionPlan | null>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan>;
  
  // Subscription History
  createSubscriptionHistory(entry: InsertSubscriptionHistory): Promise<SubscriptionHistory>;
  getSubscriptionHistory(orgId: string): Promise<SubscriptionHistory[]>;
  
  // Org by Stripe
  getOrgByStripeSubscription(subscriptionId: string): Promise<Org | null>;
  getOrgByStripeCustomer(customerId: string): Promise<Org | null>;
  
  // User by Stripe
  getUserByStripeSubscription(subscriptionId: string): Promise<User | null>;
  getUserByStripeCustomer(customerId: string): Promise<User | null>;
  
  // Admin Industry Preferences
  upsertAdminIndustryPreference(userId: string, industry: string): Promise<void>;
  getAdminIndustryPreference(userId: string): Promise<{ preferredIndustry: string | null } | null>;
  
  // Get org by user ID (helper)
  getOrgByUserId(userId: string): Promise<Org | null>;
  
  // User Onboarding
  getUserOnboarding(userId: string): Promise<UserOnboarding | null>;
  updateUserOnboarding(userId: string, updates: Partial<InsertUserOnboarding>): Promise<UserOnboarding>;
  completeUserOnboarding(userId: string): Promise<void>;
  
  // Authentication & Security
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  createLoginAttempt(data: { email: string; ipAddress?: string; userAgent?: string; success: boolean; reason?: string }): Promise<void>;
  createSecurityEvent(data: { userId?: string; eventType: string; ipAddress?: string; userAgent?: string; details?: Record<string, any> }): Promise<void>;
  getRecentFailedLoginAttempts(email: string, windowMinutes: number): Promise<number>;
  createVerificationToken(data: { identifier: string; token: string; expires: Date }): Promise<void>;
  getVerificationToken(token: string): Promise<{ identifier: string; expires: Date; createdAt: Date } | null>;
  getVerificationTokensForIdentifier(identifier: string): Promise<Array<{ createdAt: Date }>>;
  deleteVerificationToken(token: string): Promise<void>;
  deleteVerificationTokensForIdentifier(identifier: string): Promise<void>;
  
  // User Sessions
  createUserSession(data: { userId: string; sessionId: string; deviceInfo?: any; ipAddress?: string; userAgent?: string }): Promise<UserSession>;
  getUserSessions(userId: string): Promise<UserSession[]>;
  getUserSession(sessionId: string): Promise<UserSession | undefined>;
  updateUserSession(sessionId: string, updates: { lastActive?: Date }): Promise<void>;
  deleteUserSession(sessionId: string): Promise<void>;
  deleteUserSessions(userId: string, excludeSessionId?: string): Promise<void>;
  
  // Security Events
  getSecurityEvents(userId: string, options?: { limit?: number; offset?: number; eventType?: string }): Promise<SecurityEvent[]>;
  
  // Admin Actions
  createAdminAction(data: InsertAdminAction): Promise<AdminAction>;
  getAdminActions(options?: { limit?: number; offset?: number; adminUserId?: string; actionType?: string }): Promise<AdminAction[]>;
}

export class PostgresStorage implements IStorage {
  
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await ensureDb().select().from(users).where(eq(users.id, id));
      return user;
    } catch (error: any) {
      // If query fails due to missing columns (migration hasn't run), try selecting only base columns
      if (error?.message?.includes('does not exist') || error?.message?.includes('column')) {
        console.warn('[Storage] Migration may not have run, selecting base columns only for getUser');
        try {
          const [user] = await ensureDb()
            .select({
              id: users.id,
              email: users.email,
              username: users.username,
              password: users.password,
              createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.id, id));
          // Return user with undefined for missing fields
          return user ? {
            ...user,
            lockedUntil: undefined,
            failedLoginAttempts: undefined,
            lastLoginAt: undefined,
            loginCount: undefined,
            isActive: undefined,
            emailVerifiedAt: undefined,
            emailVerified: undefined,
            passwordResetToken: undefined,
            passwordResetExpires: undefined,
            displayName: undefined,
            avatarUrl: undefined,
            timezone: undefined,
            isAdmin: false, // Default to false if column doesn't exist
            adminPermissions: undefined,
          } as User : undefined;
        } catch (fallbackError) {
          console.error('[Storage] Fallback query also failed for getUser:', fallbackError);
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Try to select all columns (including new security fields if migration has run)
      const [user] = await ensureDb().select().from(users).where(eq(users.email, email));
      return user;
    } catch (error: any) {
      // If query fails due to missing columns (migration hasn't run), try selecting only base columns
      if (error?.message?.includes('does not exist') || error?.message?.includes('column')) {
        console.warn('[Storage] Migration may not have run, selecting base columns only');
        try {
          const [user] = await ensureDb()
            .select({
              id: users.id,
              email: users.email,
              username: users.username,
              password: users.password,
              createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.email, email));
          // Return user with undefined for missing security fields
          return user ? {
            ...user,
            lockedUntil: undefined,
            failedLoginAttempts: undefined,
            lastLoginAt: undefined,
            loginCount: undefined,
            isActive: undefined,
            emailVerifiedAt: undefined,
            emailVerified: undefined,
            passwordResetToken: undefined,
            passwordResetExpires: undefined,
          } as User : undefined;
        } catch (fallbackError) {
          console.error('[Storage] Fallback query also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // Ensure isAdmin is set to false if not provided (for databases without migration)
      const userData = {
        ...insertUser,
        isAdmin: insertUser.isAdmin ?? false,
      };
      const [user] = await ensureDb().insert(users).values(userData).returning();
      if (!user) throw new Error("Failed to create user");
      return user;
    } catch (error: any) {
      // If query fails due to missing columns (migration hasn't run), try inserting only base columns
      if (error?.message?.includes('does not exist') || error?.message?.includes('column') || error?.message?.includes('is_admin')) {
        console.warn('[Storage] Migration may not have run for createUser, inserting base columns only');
        try {
          // Insert only base columns that should always exist
          const baseUserData: any = {
            id: insertUser.id,
            email: insertUser.email,
            username: insertUser.username,
            password: insertUser.password,
            createdAt: insertUser.createdAt,
          };
          
          // Add optional base fields if they exist in insertUser
          if ('isActive' in insertUser) baseUserData.isActive = insertUser.isActive;
          if ('failedLoginAttempts' in insertUser) baseUserData.failedLoginAttempts = insertUser.failedLoginAttempts;
          if ('loginCount' in insertUser) baseUserData.loginCount = insertUser.loginCount;
          if ('emailVerified' in insertUser) baseUserData.emailVerified = insertUser.emailVerified;
          if ('timezone' in insertUser) baseUserData.timezone = insertUser.timezone;
          
          const [user] = await ensureDb().insert(users).values(baseUserData).returning();
          if (!user) throw new Error("Failed to create user");
          
          // Return user with missing fields set to defaults
          return {
            ...user,
            isAdmin: false,
            adminPermissions: undefined,
            lockedUntil: undefined,
            lastLoginAt: undefined,
            emailVerifiedAt: undefined,
            passwordResetToken: undefined,
            passwordResetExpires: undefined,
            displayName: undefined,
            avatarUrl: undefined,
          } as User;
        } catch (fallbackError) {
          console.error('[Storage] Fallback createUser also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  async getOrg(id: string): Promise<Org | undefined> {
    try {
      const [org] = await ensureDb().select().from(orgs).where(eq(orgs.id, id));
      if (org) {
        // If industry column doesn't exist yet, default to 'pool'
        return {
          ...org,
          industry: org.industry || 'pool'
        };
      }
      return org;
    } catch (error: any) {
      // If the industry column doesn't exist, try selecting without it
      if (error?.message?.includes('industry') || error?.code === '42703') {
        console.warn('[getOrg] Industry column not found, using fallback query');
        try {
          const [org] = await ensureDb()
            .select({
              id: orgs.id,
              name: orgs.name,
              logoUrl: orgs.logoUrl,
              abn: orgs.abn,
              contactEmail: orgs.contactEmail,
              contactPhone: orgs.contactPhone,
              address: orgs.address,
              brandColors: orgs.brandColors,
              createdAt: orgs.createdAt,
            })
            .from(orgs)
            .where(eq(orgs.id, id));
          
          if (org) {
            return {
              ...org,
              industry: 'pool' // Default to pool for backward compatibility
            } as Org;
          }
          return undefined;
        } catch (fallbackError) {
          console.error('[getOrg] Fallback query also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  async updateOrg(id: string, updates: Partial<InsertOrg>): Promise<Org> {
    const [updated] = await ensureDb()
      .update(orgs)
      .set(updates)
      .where(eq(orgs.id, id))
      .returning();
    if (!updated) {
      throw new Error('Failed to update organization');
    }
    return updated;
  }

  async createOrg(insertOrg: InsertOrg, userId: string): Promise<Org> {
    try {
      const [org] = await ensureDb().insert(orgs).values(insertOrg).returning();
      if (!org) throw new Error("Failed to create organization");
      
      // Create org member record for owner
      await ensureDb().insert(orgMembers).values({
        orgId: org.id,
        userId,
        role: "owner"
      });
      
      // Create default settings
      await ensureDb().insert(settings).values({
        orgId: org.id
      });
      
      // Ensure industry is set (default to 'pool' if not provided or if column doesn't exist)
      return {
        ...org,
        industry: org.industry || insertOrg.industry || 'pool'
      };
    } catch (error: any) {
      // If the industry column doesn't exist, try creating without it
      if (error?.message?.includes('industry') || error?.code === '42703') {
        console.warn('[createOrg] Industry column not found, creating org without industry field');
        const { industry, ...orgWithoutIndustry } = insertOrg;
        try {
          const [org] = await ensureDb().insert(orgs).values(orgWithoutIndustry).returning();
          if (!org) throw new Error("Failed to create organization");
          
          // Create org member record for owner
          await ensureDb().insert(orgMembers).values({
            orgId: org.id,
            userId,
            role: "owner"
          });
          
          // Create default settings
          await ensureDb().insert(settings).values({
            orgId: org.id
          });
          
          // Return org with default industry
          return {
            ...org,
            industry: 'pool' // Default to pool for backward compatibility
          } as Org;
        } catch (fallbackError) {
          console.error('[createOrg] Fallback creation also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  async getUserOrgs(userId: string): Promise<Org[]> {
    try {
      // Use SECURITY DEFINER function to bypass RLS (Neon HTTP doesn't support session variables)
      const result = await ensureDb().execute(
        sql`SELECT * FROM system_get_user_orgs(${userId}::UUID)`
      );
      
      const rows = (result as any).rows || result;
      // Convert result to Org format
      const orgs: Org[] = rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        industry: row.industry || 'pool',
        subscriptionStatus: row.subscription_status,
        subscriptionTier: row.subscription_tier,
        industryLocked: row.industry_locked,
        createdAt: row.created_at,
        // Add other fields with defaults
        logoUrl: null,
        abn: null,
        contactEmail: null,
        contactPhone: null,
        address: null,
        brandColors: null,
      }));
      
      return orgs;
    } catch (error: any) {
      // If the function doesn't exist, try fallback
      if (error?.message?.includes('system_get_user_orgs') || error?.code === '42883') {
        console.warn('[getUserOrgs] Function not found, using fallback query');
        try {
          // Fallback: Direct query (may fail due to RLS, but try anyway)
          const result = await ensureDb()
            .select({ org: orgs })
            .from(orgMembers)
            .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
            .where(eq(orgMembers.userId, userId));
          
          const orgMap = new Map<string, Org>();
          result.forEach((r) => {
            if (r.org && r.org.id) {
              const org = {
                ...r.org,
                industry: r.org.industry || 'pool'
              };
              orgMap.set(org.id, org);
            }
          });
          
          return Array.from(orgMap.values());
        } catch (fallbackError) {
          console.error('[getUserOrgs] Fallback query also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  async getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined> {
    const [orgMember] = await ensureDb()
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)));
    
    return orgMember;
  }

  async createOrgMember(orgId: string, userId: string, role: string = "estimator"): Promise<OrgMember> {
    // Check if membership already exists
    const existing = await this.getOrgMember(userId, orgId);
    if (existing) {
      return existing;
    }
    
    // Create new membership
    const [orgMember] = await ensureDb()
      .insert(orgMembers)
      .values({
        orgId,
        userId,
        role: role as any // Type assertion needed for enum
      })
      .returning();
    
    if (!orgMember) {
      throw new Error("Failed to create organization member");
    }
    
    return orgMember;
  }

  async createJob(insertJob: InsertJob, userId: string): Promise<Job> {
    const [job] = await ensureDb().insert(jobs).values({
      ...insertJob,
      userId // Set user_id from parameter
    }).returning();
    if (!job) throw new Error("Failed to create job");
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    try {
      const [job] = await ensureDb().select().from(jobs).where(eq(jobs.id, id));
      return job;
    } catch (error: any) {
      // If query fails due to missing columns (migration not run), try selecting only base columns
      if (error?.message?.includes('does not exist') || error?.code === '42703') {
        console.warn('[getJob] Some columns may not exist, trying with base columns only');
        try {
          const [job] = await ensureDb()
            .select({
              id: jobs.id,
              orgId: jobs.orgId,
              userId: jobs.userId,
              clientName: jobs.clientName,
              clientPhone: jobs.clientPhone,
              clientEmail: jobs.clientEmail,
              address: jobs.address,
              status: jobs.status,
              createdBy: jobs.createdBy,
              createdAt: jobs.createdAt,
            })
            .from(jobs)
            .where(eq(jobs.id, id));
          return job as Job;
        } catch (fallbackError) {
          // If even base columns fail, rethrow original error
          throw error;
        }
      }
      throw error;
    }
  }

  async getJobs(userId: string): Promise<Job[]> {
    try {
      return await ensureDb().select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt));
    } catch (error: any) {
      // If query fails due to missing columns (migration not run), try selecting only base columns
      if (error?.message?.includes('does not exist') || error?.code === '42703') {
        console.warn('[getJobs] Some columns may not exist, trying with base columns only');
        try {
          return await ensureDb()
            .select({
              id: jobs.id,
              orgId: jobs.orgId,
              userId: jobs.userId,
              clientName: jobs.clientName,
              clientPhone: jobs.clientPhone,
              clientEmail: jobs.clientEmail,
              address: jobs.address,
              status: jobs.status,
              createdBy: jobs.createdBy,
              createdAt: jobs.createdAt,
            })
            .from(jobs)
            .where(eq(jobs.userId, userId))
            .orderBy(desc(jobs.createdAt)) as Job[];
        } catch (fallbackError) {
          // If even base columns fail, rethrow original error
          throw error;
        }
      }
      throw error;
    }
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    try {
      // Include all fields from updates (both base and property detail fields)
      const [job] = await ensureDb()
        .update(jobs)
        .set(updates)
        .where(eq(jobs.id, id))
        .returning();
      if (!job) throw new Error("Failed to update job");
      return job;
    } catch (error: any) {
      // If update fails due to missing columns, try with only base fields
      if (error?.message?.includes('does not exist') || error?.code === '42703') {
        console.warn('[updateJob] Some columns may not exist, trying with base fields only');
        const baseUpdates: any = {};
        const baseFields = ['clientName', 'clientPhone', 'clientEmail', 'address', 'status'];
        for (const field of baseFields) {
          if (field in updates) {
            baseUpdates[field] = (updates as any)[field];
          }
        }
        try {
          const [job] = await ensureDb()
            .update(jobs)
            .set(baseUpdates)
            .where(eq(jobs.id, id))
            .returning();
          if (!job) throw new Error("Failed to update job");
          return job;
        } catch (fallbackError) {
          // If even base fields fail, rethrow original error
          throw error;
        }
      }
      throw error;
    }
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const [photo] = await ensureDb().insert(photos).values(insertPhoto).returning();
    if (!photo) throw new Error("Failed to create photo");
    return photo;
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const [photo] = await ensureDb().select().from(photos).where(eq(photos.id, id));
    return photo;
  }

  async getJobPhotos(jobId: string, category?: 'marketing' | 'renovation_buyer'): Promise<Photo[]> {
    try {
      const conditions = [eq(photos.jobId, jobId)];
      if (category) {
        // Check if photoCategory column exists before using it
        // If migration hasn't run, this will fail, so we'll fall back to no category filter
        try {
          conditions.push(eq(photos.photoCategory, category));
        } catch (error: any) {
          // Column doesn't exist yet - ignore category filter
          console.warn('[getJobPhotos] photoCategory column not found, ignoring category filter:', error?.message);
        }
      }
      return await ensureDb()
        .select()
        .from(photos)
        .where(and(...conditions));
    } catch (error: any) {
      // If query fails due to missing column, try without category filter
      if (error?.message?.includes('photo_category') || error?.code === '42703') {
        console.warn('[getJobPhotos] photoCategory column not found, fetching all photos');
        return await ensureDb()
          .select()
          .from(photos)
          .where(eq(photos.jobId, jobId));
      }
      throw error;
    }
  }
  
  async updatePhotoCategory(id: string, category: 'marketing' | 'renovation_buyer'): Promise<Photo> {
    try {
      const [photo] = await ensureDb()
        .update(photos)
        .set({ photoCategory: category })
        .where(eq(photos.id, id))
        .returning();
      if (!photo) throw new Error("Failed to update photo category");
      return photo;
    } catch (error: any) {
      // If column doesn't exist, return the photo without updating category
      if (error?.message?.includes('photo_category') || error?.code === '42703') {
        console.warn('[updatePhotoCategory] photoCategory column not found, returning photo without update');
        const photo = await this.getPhoto(id);
        if (!photo) throw new Error("Photo not found");
        return photo;
      }
      throw error;
    }
  }

  async updatePhoto(id: string, data: { originalUrl: string; width: number; height: number }): Promise<Photo> {
    const [photo] = await ensureDb()
      .update(photos)
      .set({ 
        originalUrl: data.originalUrl,
        width: data.width,
        height: data.height
      })
      .where(eq(photos.id, id))
      .returning();
    if (!photo) throw new Error("Failed to update photo");
    return photo;
  }

  async deletePhoto(id: string): Promise<void> {
    await ensureDb()
      .delete(photos)
      .where(eq(photos.id, id));
  }

  async updatePhotoCalibration(id: string, pixelsPerMeter: number, meta: CalibrationMeta): Promise<Photo> {
    const [photo] = await ensureDb()
      .update(photos)
      .set({ 
        calibrationPixelsPerMeter: pixelsPerMeter.toString(),
        calibrationMetaJson: meta 
      })
      .where(eq(photos.id, id))
      .returning();
    if (!photo) throw new Error("Failed to update photo");
    return photo;
  }

  async updatePhotoCalibrationV2(photoId: string, calibration: { ppm: number; samples: any[]; stdevPct?: number }): Promise<Photo> {
    const [photo] = await ensureDb()
      .update(photos)
      .set({
        calibrationPixelsPerMeter: calibration.ppm.toString(),
        calibrationMetaJson: {
          samples: calibration.samples,
          stdevPct: calibration.stdevPct
        }
      })
      .where(eq(photos.id, photoId))
      .returning();
    
    if (!photo) {
      throw new Error('Photo not found');
    }
    
    return photo;
  }

  async getPhotoCalibration(photoId: string): Promise<{ ppm: number; samples: any[]; stdevPct?: number } | null> {
    const [photo] = await ensureDb().select({
      calibrationPixelsPerMeter: photos.calibrationPixelsPerMeter,
      calibrationMetaJson: photos.calibrationMetaJson
    })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    
    if (!photo || !photo.calibrationPixelsPerMeter) {
      return null;
    }
    
    const ppm = parseFloat(photo.calibrationPixelsPerMeter);
    const meta = photo.calibrationMetaJson as CalibrationMeta;
    
    if (meta?.samples) {
      // V2 format
      return {
        ppm,
        samples: meta.samples,
        stdevPct: meta.stdevPct ?? 0
      };
    } else {
      // Legacy V1 format - return empty for now since we can't reconstruct samples
      return {
        ppm,
        samples: [],
        stdevPct: 0
      };
    }
  }

  async updatePhotoComposite(photoId: string, compositeUrl: string): Promise<Photo> {
    const [photo] = await ensureDb()
      .update(photos)
      .set({
        compositeUrl,
        compositeGeneratedAt: new Date()
      })
      .where(eq(photos.id, photoId))
      .returning();
    
    if (!photo) {
      throw new Error('Photo not found');
    }
    
    return photo;
  }

  async clearPhotoComposite(photoId: string): Promise<void> {
    await ensureDb()
      .update(photos)
      .set({
        compositeUrl: null,
        compositeGeneratedAt: null
      })
      .where(eq(photos.id, photoId));
  }

  async getAllMaterials(): Promise<Material[]> {
    try {
      // Use SECURITY DEFINER function to bypass RLS (Neon HTTP doesn't support session variables)
      return await this.getMaterialsSystem(undefined, undefined);
    } catch (error) {
      console.error('[Storage] Failed to get all materials:', error);
      // Fallback to direct query if system function fails
      try {
        return await ensureDb().select().from(materials)
          .where(eq(materials.isActive, true))
          .orderBy(desc(materials.createdAt));
      } catch (fallbackError) {
        throw new Error(`Failed to get materials: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async getMaterial(id: string): Promise<Material | null> {
    try {
      const result = await ensureDb().select().from(materials).where(eq(materials.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('[Storage] Failed to get material:', error);
      throw new Error(`Failed to get material: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper to get materials using system function (bypasses RLS)
  private async getMaterialsSystem(orgId?: string, category?: string): Promise<Material[]> {
    try {
      const result = await ensureDb().execute(
        sql`SELECT * FROM system_get_materials(
          ${orgId || null}::UUID,
          ${category || null}::TEXT,
          NULL::TEXT
        )`
      );
      
      const rows = (result as any).rows || result;
      return rows.map((row: any) => ({
        id: row.id,
        orgId: row.org_id,
        name: row.name,
        sku: row.sku,
        category: row.category,
        unit: row.unit,
        price: row.price ? parseFloat(row.price.toString()) : null,
        imageUrl: row.image_url,
        textureUrl: row.texture_url,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) as Material[];
    } catch (error: any) {
      // If function doesn't exist, fall back to direct query
      if (error?.message?.includes('system_get_materials') || error?.code === '42883') {
        throw new Error('system_get_materials function not found - run migration 027');
      }
      throw error;
    }
  }

  async getMaterials(userId?: string, category?: string, industry?: string): Promise<Material[]> {
    try {
      // Use SECURITY DEFINER function to bypass RLS (Neon HTTP doesn't support session variables)
      // Note: system function may still use orgId, but we'll filter by userId in fallback
      let allMaterials = await this.getMaterialsSystem(undefined, category);
      
      // Filter by user: show global materials (userId IS NULL) OR user's own materials
      if (userId) {
        allMaterials = allMaterials.filter(m => 
          !m.userId || m.userId === userId // Global materials OR user's materials
        );
      } else {
        // If no userId provided, only show global materials
        allMaterials = allMaterials.filter(m => !m.userId);
      }
      
      // Filter by industry if provided (client-side filter since system function doesn't support it yet)
      if (industry) {
        const tradeCategories = await this.getTradeCategories(industry);
        const categoryKeys = tradeCategories.map(c => c.categoryKey);
        if (categoryKeys.length > 0) {
          allMaterials = allMaterials.filter(m => 
            m.category && categoryKeys.includes(m.category as any)
          );
        } else {
          // If no categories found for industry, return empty array
          return [];
        }
      }
      
      // Sort by creation date (descending)
      return allMaterials.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error: any) {
      // Fallback to direct query if system function fails
      console.warn('[getMaterials] System function failed, using direct query:', error?.message);
      let conditions = [eq(materials.isActive, true)];
      
      // Filter by user: global materials (userId IS NULL) OR user's materials
      if (userId) {
        conditions.push(
          sql`(${materials.userId} IS NULL OR ${materials.userId} = ${userId}::UUID)`
        );
      } else {
        // If no userId, only show global materials
        conditions.push(sql`${materials.userId} IS NULL`);
      }
      
      if (category) {
        conditions.push(eq(materials.category, category as any));
      }
      
      if (industry) {
        const tradeCategories = await this.getTradeCategories(industry);
        const categoryKeys = tradeCategories.map(c => c.categoryKey);
        if (categoryKeys.length > 0) {
          conditions.push(inArray(materials.category, categoryKeys));
        } else {
          return [];
        }
      }
      
      return await ensureDb().select().from(materials).where(and(...conditions)).orderBy(desc(materials.createdAt));
    }
  }

  async createMaterial(insertMaterial: InsertMaterial, userId?: string): Promise<Material> {
    try {
      const [material] = await ensureDb().insert(materials).values({
        ...insertMaterial,
        userId: userId || null // Set userId if provided, otherwise NULL (global material)
      }).returning();
      if (!material) throw new Error("Failed to create material");
      console.log('[materials] created id=' + material.id + ' name=' + material.name + ' userId=' + (userId || 'global'));
      return material;
    } catch (error) {
      console.error('[Storage] Failed to create material:', error);
      throw new Error(`Failed to create material: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateMaterial(id: string, updates: Partial<Material>): Promise<Material> {
    const [material] = await ensureDb()
      .update(materials)
      .set(updates)
      .where(eq(materials.id, id))
      .returning();
    if (!material) throw new Error('Failed to update material');
    return material;
  }

  async deleteMaterial(id: string): Promise<void> {
    await ensureDb().update(materials)
      .set({ isActive: false })
      .where(eq(materials.id, id));
  }

  async createMask(insertMask: InsertMask, userId: string): Promise<Mask> {
    const [mask] = await ensureDb().insert(masks).values({
      ...insertMask,
      userId // Set user_id from parameter
    }).returning();
    if (!mask) throw new Error("Failed to create mask");
    return mask;
  }

  async getMask(id: string): Promise<Mask | null> {
    const result = await ensureDb().select().from(masks).where(eq(masks.id, id)).limit(1);
    return result[0] || null;
  }

  async getMasksByPhoto(photoId: string): Promise<Mask[]> {
    return await ensureDb().select().from(masks).where(eq(masks.photoId, photoId));
  }

  async deleteMask(id: string): Promise<void> {
    await ensureDb().delete(masks).where(eq(masks.id, id));
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const [quote] = await ensureDb().insert(quotes).values({
      ...insertQuote,
      publicToken: randomUUID()
    }).returning();
    if (!quote) throw new Error("Failed to create quote");
    return quote;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await ensureDb().select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuoteByToken(token: string): Promise<Quote | undefined> {
    const [quote] = await ensureDb().select().from(quotes).where(eq(quotes.publicToken, token));
    return quote;
  }

  async getQuotes(userId: string, filters?: { status?: string; jobId?: string }): Promise<Quote[]> {
    let conditions = [eq(jobs.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(quotes.status, filters.status as any));
    }
    
    if (filters?.jobId) {
      conditions.push(eq(quotes.jobId, filters.jobId));
    }
    
    const results = await ensureDb()
      .select()
      .from(quotes)
      .innerJoin(jobs, eq(quotes.jobId, jobs.id))
      .where(and(...conditions));
    
    return results.map(r => r.quotes);
  }

  async addQuoteItem(insertItem: InsertQuoteItem): Promise<QuoteItem> {
    const [item] = await ensureDb().insert(quoteItems).values(insertItem).returning();
    if (!item) throw new Error("Failed to create quote item");
    return item;
  }

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return await ensureDb().select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }

  async updateQuoteItem(itemId: string, updates: Partial<QuoteItem>): Promise<QuoteItem> {
    const [item] = await ensureDb()
      .update(quoteItems)
      .set(updates)
      .where(eq(quoteItems.id, itemId))
      .returning();
    if (!item) throw new Error("Failed to update quote item");
    return item;
  }

  async deleteQuoteItem(itemId: string): Promise<void> {
    await ensureDb()
      .delete(quoteItems)
      .where(eq(quoteItems.id, itemId));
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    console.log('[Storage] updateQuote called with:', { id, updates });
    try {
      const [quote] = await ensureDb()
        .update(quotes)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(quotes.id, id))
        .returning();
      if (!quote) throw new Error("Failed to update quote");
      console.log('[Storage] Quote updated successfully:', quote);
      return quote;
    } catch (error) {
      console.error('[Storage] Error in updateQuote:', error);
      throw error;
    }
  }

  async deleteQuote(id: string): Promise<void> {
    // First delete all quote items, then delete the quote
    await ensureDb()
      .delete(quoteItems)
      .where(eq(quoteItems.quoteId, id));
    
    await ensureDb()
      .delete(quotes)
      .where(eq(quotes.id, id));
  }

  async getOrgSettings(orgId: string): Promise<Settings | undefined> {
    const [setting] = await ensureDb().select().from(settings).where(eq(settings.orgId, orgId));
    if (!setting) return undefined;
    
    return {
      currencyCode: setting.currencyCode,
      taxRate: parseFloat(setting.taxRate),
      depositDefaultPct: parseFloat(setting.depositDefaultPct),
      validityDays: setting.validityDays,
      pdfTerms: setting.pdfTerms ?? undefined
    };
  }

  async updateOrgSettings(orgId: string, updates: Partial<Settings>): Promise<Settings> {
    const dbUpdates: any = { ...updates };
    
    // Convert numbers to strings for database storage
    if (updates.taxRate !== undefined) {
      dbUpdates.taxRate = updates.taxRate.toString();
    }
    if (updates.depositDefaultPct !== undefined) {
      dbUpdates.depositDefaultPct = updates.depositDefaultPct.toString();
    }
    
    const [setting] = await ensureDb()
      .update(settings)
      .set(dbUpdates)
      .where(eq(settings.orgId, orgId))
      .returning();
    if (!setting) {
      throw new Error('Failed to update organization settings');
    }
    
    // Convert back to Settings type
    return {
      currencyCode: setting.currencyCode,
      taxRate: parseFloat(setting.taxRate),
      depositDefaultPct: parseFloat(setting.depositDefaultPct),
      validityDays: setting.validityDays,
      pdfTerms: setting.pdfTerms ?? undefined
    };
  }

  // Trade Category methods
  async getTradeCategories(industry: string): Promise<TradeCategoryMapping[]> {
    try {
      return await ensureDb()
        .select()
        .from(tradeCategoryMapping)
        .where(and(
          eq(tradeCategoryMapping.industry, industry),
          eq(tradeCategoryMapping.isActive, true)
        ))
        .orderBy(asc(tradeCategoryMapping.displayOrder));
    } catch (error: any) {
      // If the trade_category_mapping table doesn't exist yet (migration not run), return empty array
      if (error?.message?.includes('trade_category_mapping') || error?.code === '42P01') {
        console.warn('[getTradeCategories] Table not found, returning empty array (migration may not be run)');
        return [];
      }
      throw error;
    }
  }

  async getCategoryLabel(industry: string, categoryKey: string): Promise<string | null> {
    try {
      const [mapping] = await ensureDb()
        .select()
        .from(tradeCategoryMapping)
        .where(and(
          eq(tradeCategoryMapping.industry, industry),
          eq(tradeCategoryMapping.categoryKey, categoryKey),
          eq(tradeCategoryMapping.isActive, true)
        ))
        .limit(1);
      
      return mapping?.categoryLabel || null;
    } catch (error: any) {
      // If the trade_category_mapping table doesn't exist yet (migration not run), return null
      if (error?.message?.includes('trade_category_mapping') || error?.code === '42P01') {
        console.warn('[getCategoryLabel] Table not found, returning null (migration may not be run)');
        return null;
      }
      throw error;
    }
  }

  // User Onboarding methods
  async getUserOnboarding(userId: string): Promise<UserOnboarding | null> {
    try {
      // Use SECURITY DEFINER function to bypass RLS (Neon HTTP doesn't support session variables)
      const result = await ensureDb().execute(
        sql`SELECT * FROM system_get_user_onboarding(${userId}::UUID)`
      );
      
      const rows = (result as any).rows || result;
      if (rows && rows.length > 0) {
        const row = rows[0];
        return {
          userId: row.user_id,
          step: row.step,
          completed: row.completed,
          responses: row.responses,
          firstJobId: row.first_job_id,
          firstPhotoId: row.first_photo_id,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        } as UserOnboarding;
      }
      
      return null;
    } catch (error: any) {
      // If the user_onboarding table doesn't exist yet (migration not run), return null
      if (error?.message?.includes('user_onboarding') || error?.code === '42P01' || 
          error?.message?.includes('system_get_user_onboarding')) {
        console.warn('[getUserOnboarding] Table or function not found, returning null (migration may not be run)');
        return null;
      }
      throw error;
    }
  }

  async updateUserOnboarding(userId: string, updates: Partial<InsertUserOnboarding>): Promise<UserOnboarding> {
    try {
      // Use SECURITY DEFINER function to bypass RLS (Neon HTTP doesn't support session variables)
      const result = await ensureDb().execute(
        sql`SELECT * FROM system_update_user_onboarding(
          ${userId}::UUID,
          ${updates.step || 'welcome'}::TEXT,
          ${JSON.stringify(updates.responses || {})}::JSONB,
          ${updates.completed || false}::BOOLEAN,
          ${updates.firstJobId || null}::UUID,
          ${updates.firstPhotoId || null}::UUID
        )`
      );
      
      const rows = (result as any).rows || result;
      if (rows && rows.length > 0) {
        const row = rows[0];
        return {
          userId: row.user_id,
          step: row.step,
          completed: row.completed,
          responses: row.responses,
          firstJobId: row.first_job_id,
          firstPhotoId: row.first_photo_id,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        } as UserOnboarding;
      }
      
      throw new Error('Failed to update user onboarding');
    } catch (error: any) {
      // If the user_onboarding table doesn't exist yet (migration not run), return a default object
      if (error?.message?.includes('user_onboarding') || error?.code === '42P01' || 
          error?.message?.includes('system_update_user_onboarding')) {
        console.warn('[updateUserOnboarding] Table or function not found, returning default (migration may not be run)');
        return {
          userId,
          step: updates.step || 'welcome',
          completed: updates.completed || false,
          responses: updates.responses || {},
          firstJobId: updates.firstJobId || null,
          firstPhotoId: updates.firstPhotoId || null,
          completedAt: updates.completedAt || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as UserOnboarding;
      }
      throw error;
    }
  }

  async completeUserOnboarding(userId: string): Promise<void> {
    // Use SECURITY DEFINER function to bypass RLS (Neon HTTP doesn't support session variables)
    await ensureDb().execute(
      sql`SELECT system_complete_user_onboarding(${userId}::UUID)`
    );
  }

  // User Preferences methods
  async getUserPreferences(userId: string): Promise<any | undefined> {
    try {
      const [prefs] = await ensureDb()
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));
      return prefs;
    } catch (error: any) {
      // If table doesn't exist yet (migration not run), return undefined
      if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
        console.warn('[Storage] user_preferences table does not exist yet');
        return undefined;
      }
      throw error;
    }
  }

  async upsertUserPreferences(userId: string, preferences: any): Promise<any> {
    try {
      const existing = await this.getUserPreferences(userId);
      
      if (existing) {
        const [updated] = await ensureDb()
          .update(userPreferences)
          .set({
            ...preferences,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, userId))
          .returning();
        return updated;
      } else {
        const [created] = await ensureDb()
          .insert(userPreferences)
          .values({
            userId,
            ...preferences,
          })
          .returning();
        return created;
      }
    } catch (error: any) {
      // If table doesn't exist yet (migration not run), throw helpful error
      if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
        throw new Error('User preferences table does not exist. Please run migration 017_user_preferences_and_profile.sql');
      }
      throw error;
    }
  }

  // Authentication & Security methods
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updated] = await ensureDb()
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    if (!updated) {
      throw new Error('Failed to update user');
    }
    return updated;
  }

  async createLoginAttempt(data: { email: string; ipAddress?: string; userAgent?: string; success: boolean; reason?: string }): Promise<void> {
    await ensureDb().insert(loginAttempts).values({
      email: data.email,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      success: data.success,
      reason: data.reason || null,
    });
  }

  async createSecurityEvent(data: { userId?: string; eventType: string; ipAddress?: string; userAgent?: string; details?: Record<string, any> }): Promise<void> {
    await ensureDb().insert(securityEvents).values({
      userId: data.userId || null,
      eventType: data.eventType,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      details: data.details || null,
    });
  }

  async getRecentFailedLoginAttempts(email: string, windowMinutes: number): Promise<number> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const result = await ensureDb()
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.email, email),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, windowStart)
        )
      );
    return Number(result[0]?.count || 0);
  }

  async createVerificationToken(data: { identifier: string; token: string; expires: Date }): Promise<void> {
    await ensureDb().insert(verificationTokens).values({
      identifier: data.identifier,
      token: data.token,
      expires: data.expires,
    });
  }

  async getVerificationToken(token: string): Promise<{ identifier: string; expires: Date; createdAt: Date } | null> {
    const [vt] = await ensureDb()
      .select({ 
        identifier: verificationTokens.identifier, 
        expires: verificationTokens.expires,
        createdAt: verificationTokens.createdAt
      })
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token));
    
    if (!vt) return null;
    if (vt.expires < new Date()) return null; // Expired
    
    return { identifier: vt.identifier, expires: vt.expires, createdAt: vt.createdAt };
  }

  async getVerificationTokensForIdentifier(identifier: string): Promise<Array<{ createdAt: Date }>> {
    const tokens = await ensureDb()
      .select({ createdAt: verificationTokens.createdAt })
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier));
    
    return tokens;
  }

  async deleteVerificationToken(token: string): Promise<void> {
    await ensureDb()
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token));
  }

  async deleteVerificationTokensForIdentifier(identifier: string): Promise<void> {
    await ensureDb()
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier));
  }

  // User Sessions methods
  async createUserSession(data: { userId: string; sessionId: string; deviceInfo?: any; ipAddress?: string; userAgent?: string }): Promise<UserSession> {
    const [session] = await ensureDb()
      .insert(userSessions)
      .values({
        userId: data.userId,
        sessionId: data.sessionId,
        deviceInfo: data.deviceInfo || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      })
      .returning();
    return session;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return await ensureDb()
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.lastActive));
  }

  async getUserSession(sessionId: string): Promise<UserSession | undefined> {
    const [session] = await ensureDb()
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId));
    return session;
  }

  async updateUserSession(sessionId: string, updates: { lastActive?: Date }): Promise<void> {
    await ensureDb()
      .update(userSessions)
      .set(updates)
      .where(eq(userSessions.sessionId, sessionId));
  }

  async deleteUserSession(sessionId: string): Promise<void> {
    await ensureDb()
      .delete(userSessions)
      .where(eq(userSessions.sessionId, sessionId));
  }

  async deleteUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    if (excludeSessionId) {
      await ensureDb()
        .delete(userSessions)
        .where(
          and(
            eq(userSessions.userId, userId),
            ne(userSessions.sessionId, excludeSessionId)
          )
        );
    } else {
      await ensureDb()
        .delete(userSessions)
        .where(eq(userSessions.userId, userId));
    }
  }

  // Security Events methods
  async getSecurityEvents(userId: string, options?: { limit?: number; offset?: number; eventType?: string }): Promise<SecurityEvent[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const conditions = [eq(securityEvents.userId, userId)];
    if (options?.eventType) {
      conditions.push(eq(securityEvents.eventType, options.eventType));
    }
    
    return await ensureDb()
      .select()
      .from(securityEvents)
      .where(and(...conditions))
      .orderBy(desc(securityEvents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // Admin Actions methods
  async createAdminAction(data: InsertAdminAction): Promise<AdminAction> {
    const [action] = await ensureDb()
      .insert(adminActions)
      .values(data)
      .returning();
    if (!action) throw new Error("Failed to create admin action");
    return action;
  }

  async getAdminActions(options?: { limit?: number; offset?: number; adminUserId?: string; actionType?: string }): Promise<AdminAction[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const conditions = [];
    if (options?.adminUserId) {
      conditions.push(eq(adminActions.adminUserId, options.adminUserId));
    }
    if (options?.actionType) {
      conditions.push(eq(adminActions.actionType, options.actionType));
    }
    
    const query = ensureDb()
      .select()
      .from(adminActions)
      .orderBy(desc(adminActions.createdAt))
      .limit(limit)
      .offset(offset);
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }
    
    return await query;
  }

  // Property Notes methods
  async getPropertyNotes(jobId: string): Promise<PropertyNote[]> {
    try {
      return await ensureDb()
        .select()
        .from(propertyNotes)
        .where(eq(propertyNotes.jobId, jobId))
        .orderBy(desc(propertyNotes.createdAt));
    } catch (error: any) {
      // If table doesn't exist (migration not run), return empty array
      if (error?.message?.includes('property_notes') || error?.code === '42P01') {
        console.warn('[getPropertyNotes] property_notes table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async createPropertyNote(data: { jobId: string; userId: string; noteText: string; tags?: string[] }): Promise<PropertyNote> {
    try {
      const [note] = await ensureDb()
        .insert(propertyNotes)
        .values({
          jobId: data.jobId,
          userId: data.userId,
          noteText: data.noteText,
          tags: data.tags || [],
          updatedAt: new Date(),
        })
        .returning();
      if (!note) throw new Error("Failed to create property note");
      return note;
    } catch (error: any) {
      // If table doesn't exist (migration not run), throw a more helpful error
      if (error?.message?.includes('property_notes') || error?.code === '42P01') {
        throw new Error("Property notes feature requires database migration. Please run migration 034_add_property_notes.sql");
      }
      throw error;
    }
  }

  async updatePropertyNote(id: string, data: { noteText?: string; tags?: string[] }): Promise<PropertyNote> {
    try {
      const updates: any = { updatedAt: new Date() };
      if (data.noteText !== undefined) updates.noteText = data.noteText;
      if (data.tags !== undefined) updates.tags = data.tags;
      
      const [note] = await ensureDb()
        .update(propertyNotes)
        .set(updates)
        .where(eq(propertyNotes.id, id))
        .returning();
      if (!note) throw new Error("Failed to update property note");
      return note;
    } catch (error: any) {
      if (error?.message?.includes('property_notes') || error?.code === '42P01') {
        throw new Error("Property notes feature requires database migration. Please run migration 034_add_property_notes.sql");
      }
      throw error;
    }
  }

  async deletePropertyNote(id: string): Promise<void> {
    try {
      await ensureDb()
        .delete(propertyNotes)
        .where(eq(propertyNotes.id, id));
    } catch (error: any) {
      if (error?.message?.includes('property_notes') || error?.code === '42P01') {
        throw new Error("Property notes feature requires database migration. Please run migration 034_add_property_notes.sql");
      }
      throw error;
    }
  }

  // Opportunities methods
  async createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity> {
    try {
      // Ensure userId and createdBy are set
      const opportunityData = {
        ...opportunity,
        userId: opportunity.userId || (opportunity as any).userId,
        createdBy: opportunity.createdBy || (opportunity as any).createdBy || opportunity.userId || (opportunity as any).userId,
        updatedAt: new Date(),
      };
      
      console.log('[Storage] Creating opportunity with userId:', opportunityData.userId, 'createdBy:', opportunityData.createdBy);
      
      const [opp] = await ensureDb()
        .insert(opportunities)
        .values(opportunityData)
        .returning();
      if (!opp) throw new Error("Failed to create opportunity");
      
      console.log('[Storage] Opportunity created successfully:', opp.id, 'userId:', opp.userId);
      return opp;
    } catch (error: any) {
      console.error('[Storage] Error creating opportunity:', error);
      if (error?.message?.includes('opportunities') || error?.code === '42P01') {
        throw new Error("Opportunities feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    try {
      const [opp] = await ensureDb()
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, id));
      return opp;
    } catch (error: any) {
      if (error?.message?.includes('opportunities') || error?.code === '42P01') {
        console.warn('[getOpportunity] opportunities table not found, returning undefined');
        return undefined;
      }
      throw error;
    }
  }

  async getOpportunities(userId: string, filters?: { status?: string; pipelineStage?: string }): Promise<Opportunity[]> {
    try {
      console.log('[Storage] getOpportunities called with userId:', userId, 'filters:', filters);
      
      const conditions = [eq(opportunities.userId, userId)];
      if (filters?.status) {
        conditions.push(eq(opportunities.status, filters.status));
      }
      if (filters?.pipelineStage) {
        conditions.push(eq(opportunities.pipelineStage, filters.pipelineStage));
      }
      
      const results = await ensureDb()
        .select()
        .from(opportunities)
        .where(and(...conditions))
        .orderBy(desc(opportunities.createdAt));
      
      console.log('[Storage] getOpportunities found', results.length, 'opportunities for userId:', userId);
      if (results.length > 0) {
        console.log('[Storage] Sample opportunity userIds:', results.slice(0, 3).map(r => r.userId));
      }
      
      return results;
    } catch (error: any) {
      console.error('[Storage] Error in getOpportunities:', error);
      if (error?.message?.includes('opportunities') || error?.code === '42P01') {
        console.warn('[getOpportunities] opportunities table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity> {
    try {
      const [opp] = await ensureDb()
        .update(opportunities)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(opportunities.id, id))
        .returning();
      if (!opp) throw new Error("Failed to update opportunity");
      return opp;
    } catch (error: any) {
      if (error?.message?.includes('opportunities') || error?.code === '42P01') {
        throw new Error("Opportunities feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  async deleteOpportunity(id: string): Promise<void> {
    try {
      await ensureDb()
        .delete(opportunities)
        .where(eq(opportunities.id, id));
    } catch (error: any) {
      if (error?.message?.includes('opportunities') || error?.code === '42P01') {
        throw new Error("Opportunities feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  // Opportunity Follow-ups (uses opportunityTasks table - opportunityFollowups is an alias)
  async getOpportunityFollowup(id: string): Promise<OpportunityFollowup | undefined> {
    try {
      const [task] = await ensureDb()
        .select()
        .from(opportunityTasks)
        .where(eq(opportunityTasks.id, id));
      return task;
    } catch (error: any) {
      if (error?.message?.includes('opportunity_tasks') || error?.message?.includes('opportunity_follow_ups') || error?.code === '42P01') {
        console.warn('[getOpportunityFollowup] opportunity tasks table not found');
        return undefined;
      }
      throw error;
    }
  }

  async getOpportunityFollowups(opportunityId: string): Promise<OpportunityFollowup[]> {
    try {
      // Use opportunityTasks (opportunityFollowups is an alias to the same table)
      return await ensureDb()
        .select()
        .from(opportunityTasks)
        .where(eq(opportunityTasks.opportunityId, opportunityId))
        .orderBy(asc(opportunityTasks.taskOrder), asc(opportunityTasks.dueDate));
    } catch (error: any) {
      if (error?.message?.includes('opportunity_tasks') || error?.message?.includes('opportunity_follow_ups') || error?.code === '42P01') {
        console.warn('[getOpportunityFollowups] opportunity tasks table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async createOpportunityFollowup(data: InsertOpportunityFollowup): Promise<OpportunityFollowup> {
    try {
      // Map old schema fields to new schema
      const insertData: any = { ...data };
      if (data.taskText && !data.title) {
        insertData.title = data.taskText;
        delete insertData.taskText;
      }
      if (data.completed !== undefined && !data.status) {
        insertData.status = data.completed ? 'completed' : 'pending';
      }
      if (data.assignedTo && !data.assigneeId) {
        insertData.assigneeId = data.assignedTo;
      }

      // Use opportunityTasks (opportunityFollowups is an alias to the same table)
      const [task] = await ensureDb()
        .insert(opportunityTasks)
        .values({
          ...insertData,
          updatedAt: new Date(),
        })
        .returning();
      if (!task) throw new Error("Failed to create opportunity task");
      return task as any;
    } catch (error: any) {
      if (error?.message?.includes('opportunity_tasks') || error?.message?.includes('opportunity_follow_ups') || error?.code === '42P01') {
        throw new Error("Opportunity tasks feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  async updateOpportunityFollowup(id: string, updates: Partial<OpportunityFollowup>): Promise<OpportunityFollowup> {
    try {
      // Map old schema fields to new schema
      const updateData: any = { ...updates };
      if (updates.taskText && !updates.title) {
        updateData.title = updates.taskText;
        delete updateData.taskText;
      }
      if (updates.completed !== undefined && !updates.status) {
        updateData.status = updates.completed ? 'completed' : 'pending';
      }
      if (updates.assignedTo && !updates.assigneeId) {
        updateData.assigneeId = updates.assignedTo;
      }

      // Use opportunityTasks (opportunityFollowups is an alias to the same table)
      const [task] = await ensureDb()
        .update(opportunityTasks)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(opportunityTasks.id, id))
        .returning();
      if (!task) throw new Error("Failed to update opportunity task");
      return task as any;
    } catch (error: any) {
      if (error?.message?.includes('opportunity_tasks') || error?.message?.includes('opportunity_follow_ups') || error?.code === '42P01') {
        throw new Error("Opportunity tasks feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  async deleteOpportunityFollowup(id: string): Promise<void> {
    try {
      // Use opportunityTasks (opportunityFollowups is an alias to the same table)
      await ensureDb()
        .delete(opportunityTasks)
        .where(eq(opportunityTasks.id, id));
    } catch (error: any) {
      if (error?.message?.includes('opportunity_tasks') || error?.message?.includes('opportunity_follow_ups') || error?.code === '42P01') {
        throw new Error("Opportunity tasks feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  // Opportunity Notes
  async getOpportunityNotes(opportunityId: string): Promise<OpportunityNote[]> {
    try {
      return await ensureDb()
        .select()
        .from(opportunityNotes)
        .where(eq(opportunityNotes.opportunityId, opportunityId))
        .orderBy(desc(opportunityNotes.createdAt));
    } catch (error: any) {
      if (error?.message?.includes('opportunity_notes') || error?.code === '42P01') {
        console.warn('[getOpportunityNotes] opportunity_notes table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async createOpportunityNote(data: InsertOpportunityNote): Promise<OpportunityNote> {
    try {
      const [note] = await ensureDb()
        .insert(opportunityNotes)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning();
      if (!note) throw new Error("Failed to create opportunity note");
      return note;
    } catch (error: any) {
      if (error?.message?.includes('opportunity_notes') || error?.code === '42P01') {
        throw new Error("Opportunity notes feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  async updateOpportunityNote(id: string, updates: Partial<OpportunityNote>): Promise<OpportunityNote> {
    try {
      const [note] = await ensureDb()
        .update(opportunityNotes)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(opportunityNotes.id, id))
        .returning();
      if (!note) throw new Error("Failed to update opportunity note");
      return note;
    } catch (error: any) {
      if (error?.message?.includes('opportunity_notes') || error?.code === '42P01') {
        throw new Error("Opportunity notes feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  async deleteOpportunityNote(id: string): Promise<void> {
    try {
      await ensureDb()
        .delete(opportunityNotes)
        .where(eq(opportunityNotes.id, id));
    } catch (error: any) {
      if (error?.message?.includes('opportunity_notes') || error?.code === '42P01') {
        throw new Error("Opportunity notes feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  // Opportunity Activities
  async getOpportunityActivities(opportunityId: string): Promise<OpportunityActivity[]> {
    try {
      return await ensureDb()
        .select()
        .from(opportunityActivities)
        .where(eq(opportunityActivities.opportunityId, opportunityId))
        .orderBy(desc(opportunityActivities.createdAt));
    } catch (error: any) {
      if (error?.message?.includes('opportunity_activities') || error?.code === '42P01') {
        console.warn('[getOpportunityActivities] opportunity_activities table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async createOpportunityActivity(data: InsertOpportunityActivity): Promise<OpportunityActivity> {
    try {
      const [activity] = await ensureDb()
        .insert(opportunityActivities)
        .values(data)
        .returning();
      if (!activity) throw new Error("Failed to create opportunity activity");
      return activity;
    } catch (error: any) {
      if (error?.message?.includes('opportunity_activities') || error?.code === '42P01') {
        throw new Error("Opportunity activities feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  // Opportunity Documents
  async getOpportunityDocuments(opportunityId: string): Promise<OpportunityDocument[]> {
    try {
      return await ensureDb()
        .select()
        .from(opportunityDocuments)
        .where(eq(opportunityDocuments.opportunityId, opportunityId))
        .orderBy(desc(opportunityDocuments.createdAt));
    } catch (error: any) {
      if (error?.message?.includes('opportunity_documents') || error?.code === '42P01') {
        console.warn('[getOpportunityDocuments] opportunity_documents table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async createOpportunityDocument(data: InsertOpportunityDocument): Promise<OpportunityDocument> {
    try {
      const [doc] = await ensureDb()
        .insert(opportunityDocuments)
        .values(data)
        .returning();
      if (!doc) throw new Error("Failed to create opportunity document");
      return doc;
    } catch (error: any) {
      if (error?.message?.includes('opportunity_documents') || error?.code === '42P01') {
        throw new Error("Opportunity documents feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  async deleteOpportunityDocument(id: string): Promise<void> {
    try {
      await ensureDb()
        .delete(opportunityDocuments)
        .where(eq(opportunityDocuments.id, id));
    } catch (error: any) {
      if (error?.message?.includes('opportunity_documents') || error?.code === '42P01') {
        throw new Error("Opportunity documents feature requires database migration. Please run migration 035_create_opportunities_tables.sql");
      }
      throw error;
    }
  }

  // Contacts methods
  async getContacts(userId: string): Promise<Contact[]> {
    try {
      return await ensureDb()
        .select()
        .from(contacts)
        .where(eq(contacts.userId, userId))
        .orderBy(desc(contacts.createdAt));
    } catch (error: any) {
      if (error?.message?.includes('contacts') || error?.code === '42P01') {
        console.warn('[getContacts] contacts table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async getContact(id: string): Promise<Contact | undefined> {
    try {
      const [contact] = await ensureDb()
        .select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);
      return contact;
    } catch (error: any) {
      if (error?.message?.includes('contacts') || error?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }

  async createContact(data: InsertContact): Promise<Contact> {
    try {
      const [contact] = await ensureDb()
        .insert(contacts)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning();
      if (!contact) throw new Error("Failed to create contact");
      return contact;
    } catch (error: any) {
      if (error?.message?.includes('contacts') || error?.code === '42P01') {
        throw new Error("Contacts feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    try {
      const [updated] = await ensureDb()
        .update(contacts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();
      if (!updated) throw new Error("Failed to update contact");
      return updated;
    } catch (error: any) {
      if (error?.message?.includes('contacts') || error?.code === '42P01') {
        throw new Error("Contacts feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      await ensureDb()
        .delete(contacts)
        .where(eq(contacts.id, id));
    } catch (error: any) {
      if (error?.message?.includes('contacts') || error?.code === '42P01') {
        throw new Error("Contacts feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  // Pipelines methods
  async getPipelines(userId: string): Promise<Pipeline[]> {
    try {
      return await ensureDb()
        .select()
        .from(pipelines)
        .where(eq(pipelines.userId, userId))
        .orderBy(desc(pipelines.createdAt));
    } catch (error: any) {
      if (error?.message?.includes('pipelines') || error?.code === '42P01') {
        console.warn('[getPipelines] pipelines table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async getPipeline(id: string): Promise<Pipeline | undefined> {
    try {
      const [pipeline] = await ensureDb()
        .select()
        .from(pipelines)
        .where(eq(pipelines.id, id))
        .limit(1);
      return pipeline;
    } catch (error: any) {
      if (error?.message?.includes('pipelines') || error?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }

  async createPipeline(data: InsertPipeline): Promise<Pipeline> {
    try {
      const [pipeline] = await ensureDb()
        .insert(pipelines)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning();
      if (!pipeline) throw new Error("Failed to create pipeline");
      return pipeline;
    } catch (error: any) {
      if (error?.message?.includes('pipelines') || error?.code === '42P01') {
        throw new Error("Pipelines feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  async updatePipeline(id: string, updates: Partial<Pipeline>): Promise<Pipeline> {
    try {
      const [updated] = await ensureDb()
        .update(pipelines)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(pipelines.id, id))
        .returning();
      if (!updated) throw new Error("Failed to update pipeline");
      return updated;
    } catch (error: any) {
      if (error?.message?.includes('pipelines') || error?.code === '42P01') {
        throw new Error("Pipelines feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  // Pipeline Stages methods
  async getPipelineStages(pipelineId: string): Promise<PipelineStage[]> {
    try {
      return await ensureDb()
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipelineId))
        .orderBy(asc(pipelineStages.order));
    } catch (error: any) {
      if (error?.message?.includes('pipeline_stages') || error?.code === '42P01') {
        console.warn('[getPipelineStages] pipeline_stages table not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async getPipelineStage(id: string): Promise<PipelineStage | undefined> {
    try {
      const [stage] = await ensureDb()
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.id, id))
        .limit(1);
      return stage;
    } catch (error: any) {
      if (error?.message?.includes('pipeline_stages') || error?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }

  async createPipelineStage(data: InsertPipelineStage): Promise<PipelineStage> {
    try {
      const [stage] = await ensureDb()
        .insert(pipelineStages)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning();
      if (!stage) throw new Error("Failed to create pipeline stage");
      return stage;
    } catch (error: any) {
      if (error?.message?.includes('pipeline_stages') || error?.code === '42P01') {
        throw new Error("Pipeline stages feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  async updatePipelineStage(id: string, updates: Partial<PipelineStage>): Promise<PipelineStage> {
    try {
      const [updated] = await ensureDb()
        .update(pipelineStages)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(pipelineStages.id, id))
        .returning();
      if (!updated) throw new Error("Failed to update pipeline stage");
      return updated;
    } catch (error: any) {
      if (error?.message?.includes('pipeline_stages') || error?.code === '42P01') {
        throw new Error("Pipeline stages feature requires database migration. Please run migration 036_add_contacts_pipelines_kanban.sql");
      }
      throw error;
    }
  }

  // Subscription Plans methods
  async getSubscriptionPlans(industry: string): Promise<SubscriptionPlan[]> {
    const db = ensureDb();
    return await db
      .select()
      .from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.industry, industry),
        eq(subscriptionPlans.isActive, true)
      ))
      .orderBy(asc(subscriptionPlans.displayOrder));
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | null> {
    const db = ensureDb();
    const result = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getSubscriptionPlanByKey(planKey: string): Promise<SubscriptionPlan | null> {
    const db = ensureDb();
    const result = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.planKey, planKey))
      .limit(1);
    return result[0] || null;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await ensureDb()
      .insert(subscriptionPlans)
      .values(plan)
      .returning();
    if (!created) throw new Error("Failed to create subscription plan");
    return created;
  }

  async updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const [updated] = await ensureDb()
      .update(subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    if (!updated) throw new Error("Failed to update subscription plan");
    return updated;
  }

  // Subscription History methods
  async createSubscriptionHistory(entry: InsertSubscriptionHistory): Promise<SubscriptionHistory> {
    const [created] = await ensureDb()
      .insert(subscriptionHistory)
      .values(entry)
      .returning();
    if (!created) throw new Error("Failed to create subscription history");
    return created;
  }

  async getSubscriptionHistory(orgId: string): Promise<SubscriptionHistoryEntry[]> {
    return await ensureDb()
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.orgId, orgId))
      .orderBy(desc(subscriptionHistory.createdAt));
  }

  // Org by Stripe methods
  async getOrgByStripeSubscription(subscriptionId: string): Promise<Org | null> {
    const db = ensureDb();
    const result = await db
      .select()
      .from(orgs)
      .where(eq(orgs.stripeSubscriptionId, subscriptionId))
      .limit(1);
    return result[0] || null;
  }

  async getOrgByStripeCustomer(customerId: string): Promise<Org | null> {
    const db = ensureDb();
    const result = await db
      .select()
      .from(orgs)
      .where(eq(orgs.stripeCustomerId, customerId))
      .limit(1);
    return result[0] || null;
  }

  async getUserByStripeSubscription(subscriptionId: string): Promise<User | null> {
    const db = ensureDb();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.stripeSubscriptionId, subscriptionId))
      .limit(1);
    return result[0] || null;
  }

  async getUserByStripeCustomer(customerId: string): Promise<User | null> {
    const db = ensureDb();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    return result[0] || null;
  }

  // Admin Industry Preferences methods
  async upsertAdminIndustryPreference(userId: string, industry: string): Promise<void> {
    await ensureDb()
      .insert(adminIndustryPreferences)
      .values({
        userId,
        preferredIndustry: industry,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: adminIndustryPreferences.userId,
        set: {
          preferredIndustry: industry,
          updatedAt: new Date(),
        },
      });
  }

  async getAdminIndustryPreference(userId: string): Promise<{ preferredIndustry: string | null } | null> {
    const db = ensureDb();
    const result = await db
      .select()
      .from(adminIndustryPreferences)
      .where(eq(adminIndustryPreferences.userId, userId))
      .limit(1);
    return result[0] || null;
  }

  // Get org by user ID (helper)
  async getOrgByUserId(userId: string): Promise<Org | null> {
    const db = ensureDb();
    const result = await db
      .select({ org: orgs })
      .from(orgs)
      .innerJoin(orgMembers, eq(orgMembers.orgId, orgs.id))
      .where(eq(orgMembers.userId, userId))
      .limit(1);
    return result[0]?.org || null;
  }
}

// Use MockStorage in no-DB mode, PostgresStorage otherwise
let storage: IStorage;

async function initializeStorage() {
  try {
    if (process.env.NO_DB_MODE === 'true') {
      console.log('[Storage] Using MockStorage (no-DB mode)');
      storage = new MockStorage();
    } else {
      console.log('[Storage] Using PostgresStorage');
      storage = new PostgresStorage();
      
      // Test database connection - but don't crash if it fails
      try {
        await ensureDb().select().from(materials).limit(1);
        console.log('[Storage] Database connection test passed');
      } catch (testError: any) {
        // Log but don't throw - allow function to start even if DB test fails
        console.warn('[Storage] Database connection test failed, but continuing:', testError?.message);
        // Still use PostgresStorage - individual queries will handle errors
      }
    }
  } catch (error) {
    console.error('[Storage] Failed to initialize PostgresStorage, falling back to MockStorage:', error);
    storage = new MockStorage();
  }
}

// Initialize storage - wrap in try-catch to prevent unhandled rejections
(async () => {
  try {
    await initializeStorage();
  } catch (error) {
    console.error('[Storage] Critical initialization error, using MockStorage:', error);
    // Ensure storage is set even if initialization fails
    if (!storage) {
      storage = new MockStorage();
    }
  }
})();

export { storage };
