
import { MockStorage } from './mockStorage';

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
  jobs,
  photos,
  materials,
  masks,
  quotes,
  quoteItems
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './db';

// Only require DATABASE_URL if not in no-DB mode
if (!process.env.DATABASE_URL && process.env.NO_DB_MODE !== 'true') {
  throw new Error("DATABASE_URL is required");
}

// Create drizzle db instance only if pool exists and not in no-DB mode
const db = (pool && process.env.NO_DB_MODE !== 'true') ? drizzle(pool) : null;

// Helper function to check if database is available
function ensureDb() {
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Organizations
  getOrg(id: string): Promise<Org | undefined>;
  createOrg(org: InsertOrg, userId: string): Promise<Org>;
  getUserOrgs(userId: string): Promise<Org[]>;
  getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined>;
  
  // Jobs
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  getJobs(orgId: string): Promise<Job[]>;
  
  // Photos
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  getPhoto(id: string): Promise<Photo | undefined>;
  updatePhotoCalibration(id: string, pixelsPerMeter: number, meta: CalibrationMeta): Promise<Photo>;
  updatePhotoCalibrationV2(photoId: string, calibration: { ppm: number; samples: CalibrationMeta['samples']; stdevPct?: number }): Promise<Photo>;
  getPhotoCalibration(photoId: string): Promise<{ ppm: number; samples: CalibrationMeta['samples']; stdevPct?: number } | null>;
  
  // Materials
  getAllMaterials(): Promise<Material[]>;
  getMaterials(orgId?: string, category?: string): Promise<Material[]>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;
  
  // Masks
  createMask(mask: InsertMask): Promise<Mask>;
  getMasksByPhoto(photoId: string): Promise<Mask[]>;
  deleteMask(id: string): Promise<void>;
  
  // Quotes
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByToken(token: string): Promise<Quote | undefined>;
  addQuoteItem(item: InsertQuoteItem): Promise<QuoteItem>;
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  updateQuote(id: string, updates: Partial<Quote>): Promise<Quote>;
  
  // Settings
  getOrgSettings(orgId: string): Promise<Settings | undefined>;
  updateOrgSettings(orgId: string, updates: Partial<Settings>): Promise<Settings>;
}

export class PostgresStorage implements IStorage {
  
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await ensureDb().select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await ensureDb().select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await ensureDb().insert(users).values(insertUser).returning();
    if (!user) throw new Error("Failed to create user");
    return user;
  }

  async getOrg(id: string): Promise<Org | undefined> {
    const [org] = await ensureDb().select().from(orgs).where(eq(orgs.id, id));
    return org;
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
    const result = await db
      .select({ org: orgs })
      .from(orgMembers)
      .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
      .where(eq(orgMembers.userId, userId));
    
    return result.map((r) => r.org);
  }

  async getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined> {
    const [orgMember] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)));
    
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

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const [photo] = await ensureDb().insert(photos).values(insertPhoto).returning();
    if (!photo) throw new Error("Failed to create photo");
    return photo;
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const [photo] = await ensureDb().select().from(photos).where(eq(photos.id, id));
    return photo;
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
      conditions.push(eq(materials.category, category));
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
    const [material] = await db
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

  async addQuoteItem(insertItem: InsertQuoteItem): Promise<QuoteItem> {
    const [item] = await ensureDb().insert(quoteItems).values(insertItem).returning();
    if (!item) throw new Error("Failed to create quote item");
    return item;
  }

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return await ensureDb().select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    const [quote] = await ensureDb()
      .update(quotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    if (!quote) throw new Error("Failed to update quote");
    return quote;
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
await initializeStorage();

export { storage };
