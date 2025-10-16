
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Create drizzle db instance only if pool exists
const db = pool ? drizzle(pool) : null;

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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getOrg(id: string): Promise<Org | undefined> {
    const [org] = await db.select().from(orgs).where(eq(orgs.id, id));
    return org;
  }

  async createOrg(insertOrg: InsertOrg, userId: string): Promise<Org> {
    const [org] = await db.insert(orgs).values(insertOrg).returning();
    
    // Create org member record for owner
    await db.insert(orgMembers).values({
      orgId: org.id,
      userId,
      role: "owner"
    });
    
    // Create default settings
    await db.insert(settings).values({
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
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getJobs(orgId: string): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.orgId, orgId)).orderBy(desc(jobs.createdAt));
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const [photo] = await db.insert(photos).values(insertPhoto).returning();
    return photo;
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    return photo;
  }

  async updatePhotoCalibration(id: string, pixelsPerMeter: number, meta: CalibrationMeta): Promise<Photo> {
    const [photo] = await db
      .update(photos)
      .set({ 
        calibrationPixelsPerMeter: pixelsPerMeter.toString(),
        calibrationMetaJson: meta 
      })
      .where(eq(photos.id, id))
      .returning();
    return photo;
  }

  async updatePhotoCalibrationV2(photoId: string, calibration: { ppm: number; samples: any[]; stdevPct?: number }): Promise<Photo> {
    const [photo] = await db
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
    const [photo] = await db.select({
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
        stdevPct: meta.stdevPct
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
      return await db.select().from(materials)
        .where(eq(materials.isActive, true))
        .orderBy(desc(materials.createdAt));
    } catch (error) {
      console.error('[Storage] Failed to get all materials:', error);
      throw new Error(`Failed to get materials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMaterials(orgId?: string, category?: string): Promise<Material[]> {
    let query = db.select().from(materials).where(eq(materials.isActive, true));
    
    // Filter by organization if provided
    if (orgId) {
      query = query.where(and(eq(materials.isActive, true), eq(materials.orgId, orgId)));
    } else {
      // If no orgId, return global materials (orgId is null)
      query = query.where(and(eq(materials.isActive, true), sql`${materials.orgId} IS NULL`));
    }
    
    // Filter by category if provided
    if (category) {
      query = query.where(and(
        eq(materials.isActive, true),
        orgId ? eq(materials.orgId, orgId) : sql`${materials.orgId} IS NULL`,
        eq(materials.category, category)
      ));
    }
    
    return await query.orderBy(desc(materials.createdAt));
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    try {
      const [material] = await db.insert(materials).values(insertMaterial).returning();
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
    const [mask] = await db.insert(masks).values(insertMask).returning();
    return mask;
  }

  async getMasksByPhoto(photoId: string): Promise<Mask[]> {
    return await db.select().from(masks).where(eq(masks.photoId, photoId));
  }

  async deleteMask(id: string): Promise<void> {
    await db.delete(masks).where(eq(masks.id, id));
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const [quote] = await db.insert(quotes).values({
      ...insertQuote,
      publicToken: randomUUID()
    }).returning();
    return quote;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuoteByToken(token: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.publicToken, token));
    return quote;
  }

  async addQuoteItem(insertItem: InsertQuoteItem): Promise<QuoteItem> {
    const [item] = await db.insert(quoteItems).values(insertItem).returning();
    return item;
  }

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    const [quote] = await db
      .update(quotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return quote;
  }

  async getOrgSettings(orgId: string): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.orgId, orgId));
    return setting;
  }

  async updateOrgSettings(orgId: string, updates: Partial<Settings>): Promise<Settings> {
    const [setting] = await db
      .update(settings)
      .set(updates)
      .where(eq(settings.orgId, orgId))
      .returning();
    if (!setting) {
      throw new Error('Failed to update organization settings');
    }
    return setting;
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
      await db.select().from(materials).limit(1);
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
