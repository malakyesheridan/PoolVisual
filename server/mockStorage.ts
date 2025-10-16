import bcrypt from 'bcryptjs';

// Mock storage implementation for no-DB mode
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
  OrgMember
} from "@shared/schema";

export class MockStorage {
  private jobs: Job[] = [];
  private users: User[] = [];
  private orgs: Org[] = [];
  private orgMembers: OrgMember[] = [];
  private photos: Photo[] = [];
  private materials: Material[] = [];
  private masks: Mask[] = [];
  private quotes: Quote[] = [];
  private quoteItems: QuoteItem[] = [];

  // Helper method to generate UUIDs
  private generateId = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // User methods
  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...insertUser,
      createdAt: new Date()
    };
    this.users.push(user);
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  // Organization methods
  async createOrg(insertOrg: InsertOrg, userId: string): Promise<Org> {
    const org: Org = {
      id: this.generateId(),
      ...insertOrg,
      createdAt: new Date()
    };
    this.orgs.push(org);
    
    // Create org member
    await this.createOrgMember({
      orgId: org.id,
      userId: userId,
      role: 'owner'
    });
    
    return org;
  }

  async getOrg(id: string): Promise<Org | undefined> {
    return this.orgs.find(o => o.id === id);
  }

  async getUserOrgs(userId: string): Promise<Org[]> {
    const memberOrgIds = this.orgMembers
      .filter(m => m.userId === userId)
      .map(m => m.orgId);
    return this.orgs.filter(o => memberOrgIds.includes(o.id));
  }

  async createOrgMember(insertMember: any): Promise<OrgMember> {
    const member: OrgMember = {
      id: this.generateId(),
      ...insertMember,
      createdAt: new Date()
    };
    this.orgMembers.push(member);
    return member;
  }

  async getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined> {
    return this.orgMembers.find(m => m.userId === userId && m.orgId === orgId);
  }

  // Job methods
  async createJob(insertJob: InsertJob): Promise<Job> {
    const job: Job = {
      id: this.generateId(),
      ...insertJob,
      createdAt: new Date()
    };
    this.jobs.push(job);
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.find(j => j.id === id);
  }

  async getJobs(orgId: string): Promise<Job[]> {
    return this.jobs.filter(j => j.orgId === orgId);
  }

  // Photo methods
  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const photo: Photo = {
      id: this.generateId(),
      ...insertPhoto,
      createdAt: new Date()
    };
    this.photos.push(photo);
    return photo;
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    return this.photos.find(p => p.id === id);
  }

  // Material methods
  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const material: Material = {
      id: this.generateId(),
      ...insertMaterial,
      createdAt: new Date()
    };
    this.materials.push(material);
    return material;
  }

  async getMaterials(orgId?: string): Promise<Material[]> {
    if (orgId) {
      return this.materials.filter(m => m.orgId === orgId);
    }
    return this.materials.filter(m => !m.orgId); // Global materials
  }

  // Mask methods
  async createMask(insertMask: InsertMask): Promise<Mask> {
    const mask: Mask = {
      id: this.generateId(),
      ...insertMask,
      createdAt: new Date()
    };
    this.masks.push(mask);
    return mask;
  }

  async getMasks(photoId: string): Promise<Mask[]> {
    return this.masks.filter(m => m.photoId === photoId);
  }

  async getMasksByPhoto(photoId: string): Promise<Mask[]> {
    return this.masks.filter(m => m.photoId === photoId);
  }

  async deleteMask(id: string): Promise<void> {
    this.masks = this.masks.filter(m => m.id !== id);
  }

  async updatePhotoCalibration(id: string, pixelsPerMeter: number, meta: any): Promise<Photo> {
    const photo = this.photos.find(p => p.id === id);
    if (!photo) throw new Error('Photo not found');
    
    photo.calibrationPixelsPerMeter = pixelsPerMeter.toString();
    photo.calibrationMetaJson = meta;
    return photo;
  }

  async updatePhotoCalibrationV2(photoId: string, calibration: { ppm: number; samples: any[]; stdevPct?: number }): Promise<Photo> {
    const photo = this.photos.find(p => p.id === photoId);
    if (!photo) throw new Error('Photo not found');
    
    photo.calibrationPixelsPerMeter = calibration.ppm.toString();
    photo.calibrationMetaJson = calibration;
    return photo;
  }

  async updateMaterial(id: string, updates: Partial<Material>): Promise<Material> {
    const index = this.materials.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Material not found');
    
    this.materials[index] = { ...this.materials[index], ...updates };
    return this.materials[index];
  }

  async getAllMaterials(): Promise<Material[]> {
    return this.materials;
  }

  async deleteMaterial(id: string): Promise<void> {
    this.materials = this.materials.filter(m => m.id !== id);
  }

  async getPhotoCalibration(photoId: string): Promise<{ ppm: number; samples: any[]; stdevPct?: number } | null> {
    const photo = this.photos.find(p => p.id === photoId);
    if (!photo || !photo.calibrationMetaJson) return null;
    
    return {
      ppm: parseFloat(photo.calibrationPixelsPerMeter || '0'),
      samples: photo.calibrationMetaJson.samples || [],
      stdevPct: photo.calibrationMetaJson.stdevPct
    };
  }

  // Quote methods
  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const quote: Quote = {
      id: this.generateId(),
      ...insertQuote,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.quotes.push(quote);
    return quote;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.find(q => q.id === id);
  }

  async getQuoteByToken(token: string): Promise<Quote | undefined> {
    return this.quotes.find(q => q.publicToken === token);
  }

  async addQuoteItem(insertItem: InsertQuoteItem): Promise<QuoteItem> {
    const item: QuoteItem = {
      id: this.generateId(),
      ...insertItem,
      createdAt: new Date()
    };
    this.quoteItems.push(item);
    return item;
  }

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return this.quoteItems.filter(i => i.quoteId === quoteId);
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    const index = this.quotes.findIndex(q => q.id === id);
    if (index === -1) {
      throw new Error('Quote not found');
    }
    this.quotes[index] = { ...this.quotes[index], ...updates, updatedAt: new Date() };
    return this.quotes[index];
  }

  async updateOrgSettings(orgId: string, updates: any): Promise<any> {
    // Mock implementation - just return the updates
    return { orgId, ...updates };
  }

  async getOrgSettings(orgId: string): Promise<any> {
    // Mock implementation - return default settings
    return {
      orgId,
      currencyCode: 'AUD',
      taxRate: 0.10,
      depositDefaultPct: 0.30,
      validityDays: 30
    };
  }

  // Initialize with some mock data
  async initializeMockData() {
    // Create a mock user with properly hashed password
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await this.createUser({
      email: 'test@example.com',
      username: 'testuser',
      password: hashedPassword
    });

    // Create a mock organization
    const org = await this.createOrg({
      name: 'Test Pool Company',
      contactEmail: 'contact@testpool.com',
      contactPhone: '+61 400 123 456',
      address: '123 Test Street, Test City'
    });

    // Create org member
    await this.createOrgMember({
      orgId: org.id,
      userId: user.id,
      role: 'owner'
    });

    // Create some mock materials
    await this.createMaterial({
      name: 'Travertine Silver',
      sku: 'TRV-SIL-001',
      category: 'coping',
      unit: 'lm',
      price: 85.00,
      defaultWastagePct: 8.0,
      defaultMarginPct: 25.0,
      isActive: true
    });

    await this.createMaterial({
      name: 'Glass Mosaic Blue',
      sku: 'GLM-BLU-001',
      category: 'waterline_tile',
      unit: 'm2',
      price: 160.00,
      defaultWastagePct: 10.0,
      defaultMarginPct: 35.0,
      isActive: true
    });

    console.log('[MockStorage] Initialized with test data');
    console.log('[MockStorage] Test user: test@example.com / password123');
    console.log('[MockStorage] Organization: Test Pool Company');
  }
}
