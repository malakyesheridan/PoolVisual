
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
  users,
  orgs,
  orgMembers,
  settings,
  userPreferences,
  jobs,
  photos,
  materials,
  masks,
  quotes,
  quoteItems,
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
import { eq, desc, and, sql, gte, ne } from "drizzle-orm";
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
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  getJobs(orgId: string): Promise<Job[]>;
  
  // Photos
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  getPhoto(id: string): Promise<Photo | undefined>;
  getJobPhotos(jobId: string): Promise<Photo[]>;
  updatePhoto(id: string, data: { originalUrl: string; width: number; height: number }): Promise<Photo>;
  deletePhoto(id: string): Promise<void>;
  updatePhotoCalibration(id: string, pixelsPerMeter: number, meta: CalibrationMeta): Promise<Photo>;
  updatePhotoCalibrationV2(photoId: string, calibration: { ppm: number; samples: CalibrationMeta['samples']; stdevPct?: number }): Promise<Photo>;
  getPhotoCalibration(photoId: string): Promise<{ ppm: number; samples: CalibrationMeta['samples']; stdevPct?: number } | null>;
  updatePhotoComposite(photoId: string, compositeUrl: string): Promise<Photo>;
  clearPhotoComposite(photoId: string): Promise<void>;
  
  // Materials
  getAllMaterials(): Promise<Material[]>;
  getMaterials(orgId?: string, category?: string): Promise<Material[]>;
  getMaterial(id: string): Promise<Material | null>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;
  
  // Masks
  createMask(mask: InsertMask): Promise<Mask>;
  getMask(id: string): Promise<Mask | null>;
  getMasksByPhoto(photoId: string): Promise<Mask[]>;
  deleteMask(id: string): Promise<void>;
  
  // Quotes
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByToken(token: string): Promise<Quote | undefined>;
  getQuotes(orgId: string, filters?: { status?: string; jobId?: string }): Promise<Quote[]>;
  addQuoteItem(item: InsertQuoteItem): Promise<QuoteItem>;
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  updateQuoteItem(itemId: string, updates: Partial<QuoteItem>): Promise<QuoteItem>;
  deleteQuoteItem(itemId: string): Promise<void>;
  updateQuote(id: string, updates: Partial<Quote>): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;
  
  // Settings
  getOrgSettings(orgId: string): Promise<Settings | undefined>;
  updateOrgSettings(orgId: string, updates: Partial<Settings>): Promise<Settings>;
  
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
    const [org] = await ensureDb().select().from(orgs).where(eq(orgs.id, id));
    return org;
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
    
    return org;
  }

  async getUserOrgs(userId: string): Promise<Org[]> {
    const result = await ensureDb()
      .select({ org: orgs })
      .from(orgMembers)
      .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
      .where(eq(orgMembers.userId, userId));
    
    // Deduplicate by org ID in case of multiple memberships in same org
    const orgMap = new Map<string, Org>();
    result.forEach((r) => {
      if (r.org && r.org.id) {
        orgMap.set(r.org.id, r.org);
      }
    });
    
    return Array.from(orgMap.values());
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

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await ensureDb().insert(jobs).values(insertJob).returning();
    if (!job) throw new Error("Failed to create job");
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await ensureDb().select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getJobs(orgId: string): Promise<Job[]> {
    return await ensureDb().select().from(jobs).where(eq(jobs.orgId, orgId)).orderBy(desc(jobs.createdAt));
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    const [job] = await ensureDb()
      .update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning();
    if (!job) throw new Error("Failed to update job");
    return job;
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

  async getJobPhotos(jobId: string): Promise<Photo[]> {
    return await ensureDb().select().from(photos).where(eq(photos.jobId, jobId));
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
      return await ensureDb().select().from(materials)
        .where(eq(materials.isActive, true))
        .orderBy(desc(materials.createdAt));
    } catch (error) {
      console.error('[Storage] Failed to get all materials:', error);
      throw new Error(`Failed to get materials: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async getMaterials(orgId?: string, category?: string): Promise<Material[]> {
    let conditions = [eq(materials.isActive, true)];
    
    // Filter by organization if provided
    if (orgId) {
      conditions.push(eq(materials.orgId, orgId));
    } else {
      // If no orgId, return global materials (orgId is null)
      conditions.push(sql`${materials.orgId} IS NULL`);
    }
    
    // Filter by category if provided
    if (category) {
      conditions.push(eq(materials.category, category as any));
    }
    
    return await ensureDb().select().from(materials).where(and(...conditions)).orderBy(desc(materials.createdAt));
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    try {
      const [material] = await ensureDb().insert(materials).values(insertMaterial).returning();
      if (!material) throw new Error("Failed to create material");
      console.log('[materials] created id=' + material.id + ' name=' + material.name);
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

  async createMask(insertMask: InsertMask): Promise<Mask> {
    const [mask] = await ensureDb().insert(masks).values(insertMask).returning();
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

  async getQuotes(orgId: string, filters?: { status?: string; jobId?: string }): Promise<Quote[]> {
    let conditions = [eq(jobs.orgId, orgId)];
    
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
      
      // Test database connection synchronously during initialization
      await ensureDb().select().from(materials).limit(1);
      console.log('[Storage] Database connection test passed');
    }
  } catch (error) {
    console.error('[Storage] Failed to initialize PostgresStorage, falling back to MockStorage:', error);
    storage = new MockStorage();
  }
}

// Initialize storage synchronously
(async () => {
  await initializeStorage();
})();

export { storage };
