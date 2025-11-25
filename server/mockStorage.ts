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
  InsertQuoteItem
} from "../shared/schema.js";

// Define OrgMember type for mock storage
type OrgMember = {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

export class MockStorage {
  private jobs: Job[] = [];
  private users: User[] = [];
  private orgs: Org[] = [];
  private orgMembers: Array<{ orgId: string; userId: string; role: string }> = [];
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
      name: insertOrg.name,
      createdAt: new Date(),
      logoUrl: insertOrg.logoUrl ?? null,
      abn: insertOrg.abn ?? null,
      contactEmail: insertOrg.contactEmail ?? null,
      contactPhone: insertOrg.contactPhone ?? null,
      address: insertOrg.address ?? null,
      brandColors: insertOrg.brandColors ?? null
    };
    this.orgs.push(org);
    
    // Create org member
    await this.createOrgMember(org.id, userId, 'owner');
    
    return org;
  }

  async getOrg(id: string): Promise<Org | undefined> {
    return this.orgs.find(o => o.id === id);
  }

  async updateOrg(id: string, updates: Partial<InsertOrg>): Promise<Org> {
    const orgIndex = this.orgs.findIndex(o => o.id === id);
    if (orgIndex === -1) {
      throw new Error('Organization not found');
    }
    this.orgs[orgIndex] = { ...this.orgs[orgIndex], ...updates };
    return this.orgs[orgIndex];
  }

  async getUserOrgs(userId: string): Promise<Org[]> {
    const memberOrgIds = this.orgMembers
      .filter(m => m.userId === userId)
      .map(m => m.orgId);
    return this.orgs.filter(o => memberOrgIds.includes(o.id));
  }

  async createOrgMember(orgId: string, userId: string, role: string = "estimator"): Promise<OrgMember> {
    // Check if membership already exists
    const existing = this.orgMembers.find(m => m.userId === userId && m.orgId === orgId);
    if (existing) {
      return {
        id: this.generateId(),
        orgId: existing.orgId,
        userId: existing.userId,
        role: existing.role,
        createdAt: new Date()
      };
    }
    
    // Create new membership
    const member = { orgId, userId, role };
    this.orgMembers.push(member);
    
    return {
      id: this.generateId(),
      orgId: member.orgId,
      userId: member.userId,
      role: member.role,
      createdAt: new Date()
    };
  }

  async getOrgMember(userId: string, orgId: string): Promise<OrgMember | undefined> {
    const member = this.orgMembers.find(m => m.userId === userId && m.orgId === orgId);
    if (!member) return undefined;
    
    return {
      id: this.generateId(), // Generate a unique ID for the member
      orgId: member.orgId,
      userId: member.userId,
      role: member.role,
      createdAt: new Date()
    };
  }

  // Job methods
  async createJob(insertJob: InsertJob): Promise<Job> {
    const job: Job = {
      id: this.generateId(),
      createdAt: new Date(),
      status: insertJob.status ?? 'new',
      address: insertJob.address ?? null,
      orgId: insertJob.orgId,
      clientName: insertJob.clientName,
      clientPhone: insertJob.clientPhone ?? null,
      clientEmail: insertJob.clientEmail ?? null,
      createdBy: insertJob.createdBy
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
      createdAt: new Date(),
      jobId: insertPhoto.jobId,
      originalUrl: insertPhoto.originalUrl,
      width: insertPhoto.width,
      height: insertPhoto.height,
      exifJson: insertPhoto.exifJson ?? null,
      calibrationPixelsPerMeter: insertPhoto.calibrationPixelsPerMeter ?? null,
      calibrationMetaJson: insertPhoto.calibrationMetaJson ?? null
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
      createdAt: new Date(),
      name: insertMaterial.name,
      category: insertMaterial.category,
      unit: insertMaterial.unit,
      finish: insertMaterial.finish ?? null,
      orgId: insertMaterial.orgId ?? null,
      supplier: insertMaterial.supplier ?? null,
      sourceUrl: insertMaterial.sourceUrl ?? null,
      sku: insertMaterial.sku ?? null,
      cost: insertMaterial.cost ?? null,
      price: insertMaterial.price ?? null,
      wastagePct: insertMaterial.wastagePct ?? null,
      marginPct: insertMaterial.marginPct ?? null,
      color: insertMaterial.color ?? null,
      tileWidthMm: insertMaterial.tileWidthMm ?? null,
      tileHeightMm: insertMaterial.tileHeightMm ?? null,
      sheetWidthMm: insertMaterial.sheetWidthMm ?? null,
      sheetHeightMm: insertMaterial.sheetHeightMm ?? null,
      thicknessMm: insertMaterial.thicknessMm ?? null,
      groutWidthMm: insertMaterial.groutWidthMm ?? null,
      textureUrl: insertMaterial.textureUrl ?? null,
      thumbnailUrl: insertMaterial.thumbnailUrl ?? null,
      physicalRepeatM: insertMaterial.physicalRepeatM ?? null,
      notes: insertMaterial.notes ?? null,
      isActive: insertMaterial.isActive ?? true
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
      createdAt: new Date(),
      type: insertMask.type,
      createdBy: insertMask.createdBy,
      photoId: insertMask.photoId,
      pathJson: insertMask.pathJson,
      bandHeightM: insertMask.bandHeightM ?? null,
      areaM2: insertMask.areaM2 ?? null,
      perimeterM: insertMask.perimeterM ?? null,
      materialId: insertMask.materialId ?? null,
      calcMetaJson: insertMask.calcMetaJson ?? null,
      // Multi-Level Geometry fields (additive)
      depthLevel: insertMask.depthLevel ?? 0,
      elevationM: insertMask.elevationM ?? 0,
      zIndex: insertMask.zIndex ?? 0,
      isStepped: insertMask.isStepped ?? false
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
    
    const existingMaterial = this.materials[index];
    if (!existingMaterial) throw new Error('Material not found');
    
    const updatedMaterial: Material = {
      id: existingMaterial.id,
      name: updates.name !== undefined ? updates.name : existingMaterial.name,
      createdAt: existingMaterial.createdAt,
      orgId: updates.orgId !== undefined ? updates.orgId : existingMaterial.orgId,
      supplier: updates.supplier !== undefined ? updates.supplier : existingMaterial.supplier,
      sourceUrl: updates.sourceUrl !== undefined ? updates.sourceUrl : existingMaterial.sourceUrl,
      sku: updates.sku !== undefined ? updates.sku : existingMaterial.sku,
      category: updates.category !== undefined ? updates.category : existingMaterial.category,
      unit: updates.unit !== undefined ? updates.unit : existingMaterial.unit,
      finish: updates.finish !== undefined ? updates.finish : existingMaterial.finish,
      cost: updates.cost !== undefined ? updates.cost : existingMaterial.cost,
      price: updates.price !== undefined ? updates.price : existingMaterial.price,
      wastagePct: updates.wastagePct !== undefined ? updates.wastagePct : existingMaterial.wastagePct,
      marginPct: updates.marginPct !== undefined ? updates.marginPct : existingMaterial.marginPct,
      color: updates.color !== undefined ? updates.color : existingMaterial.color,
      tileWidthMm: updates.tileWidthMm !== undefined ? updates.tileWidthMm : existingMaterial.tileWidthMm,
      tileHeightMm: updates.tileHeightMm !== undefined ? updates.tileHeightMm : existingMaterial.tileHeightMm,
      sheetWidthMm: updates.sheetWidthMm !== undefined ? updates.sheetWidthMm : existingMaterial.sheetWidthMm,
      sheetHeightMm: updates.sheetHeightMm !== undefined ? updates.sheetHeightMm : existingMaterial.sheetHeightMm,
      thicknessMm: updates.thicknessMm !== undefined ? updates.thicknessMm : existingMaterial.thicknessMm,
      groutWidthMm: updates.groutWidthMm !== undefined ? updates.groutWidthMm : existingMaterial.groutWidthMm,
      textureUrl: updates.textureUrl !== undefined ? updates.textureUrl : existingMaterial.textureUrl,
      thumbnailUrl: updates.thumbnailUrl !== undefined ? updates.thumbnailUrl : existingMaterial.thumbnailUrl,
      physicalRepeatM: updates.physicalRepeatM !== undefined ? updates.physicalRepeatM : existingMaterial.physicalRepeatM,
      notes: updates.notes !== undefined ? updates.notes : existingMaterial.notes,
      isActive: updates.isActive !== undefined ? updates.isActive : existingMaterial.isActive
    };
    
    this.materials[index] = updatedMaterial;
    return updatedMaterial;
  }

  async getAllMaterials(): Promise<Material[]> {
    return this.materials;
  }

  async getMaterial(id: string): Promise<Material | null> {
    return this.materials.find(m => m.id === id) || null;
  }

  async deleteMaterial(id: string): Promise<void> {
    this.materials = this.materials.filter(m => m.id !== id);
  }

  async getPhotoCalibration(photoId: string): Promise<{ ppm: number; samples: any[]; stdevPct?: number } | null> {
    const photo = this.photos.find(p => p.id === photoId);
    if (!photo || !photo.calibrationMetaJson) return null;
    
    const meta = photo.calibrationMetaJson as any;
    return {
      ppm: parseFloat(photo.calibrationPixelsPerMeter || '0'),
      samples: meta.samples || [],
      stdevPct: meta.stdevPct
    };
  }

  // Quote methods
  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const quote: Quote = {
      id: this.generateId(),
      createdAt: new Date(),
      status: insertQuote.status ?? 'draft',
      jobId: insertQuote.jobId,
      name: insertQuote.name ?? null,
      subtotal: insertQuote.subtotal ?? null,
      gst: insertQuote.gst ?? null,
      total: insertQuote.total ?? null,
      depositPct: insertQuote.depositPct ?? null,
      pdfUrl: insertQuote.pdfUrl ?? null,
      publicToken: insertQuote.publicToken ?? null,
      stripePaymentIntentId: insertQuote.stripePaymentIntentId ?? null,
      validityDays: insertQuote.validityDays ?? 30,
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
      createdAt: new Date(),
      unit: insertItem.unit ?? null,
      materialId: insertItem.materialId ?? null,
      calcMetaJson: insertItem.calcMetaJson ?? null,
      quoteId: insertItem.quoteId,
      kind: insertItem.kind,
      laborRuleId: insertItem.laborRuleId ?? null,
      description: insertItem.description,
      qty: insertItem.qty ?? null,
      unitPrice: insertItem.unitPrice ?? null,
      lineTotal: insertItem.lineTotal ?? null
    };
    this.quoteItems.push(item);
    return item;
  }

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return this.quoteItems.filter(i => i.quoteId === quoteId);
  }

  async deleteQuote(id: string): Promise<void> {
    // Delete quote items first
    this.quoteItems = this.quoteItems.filter(item => item.quoteId !== id);
    // Then delete the quote
    this.quotes = this.quotes.filter(q => q.id !== id);
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    const index = this.quotes.findIndex(q => q.id === id);
    if (index === -1) {
      throw new Error('Quote not found');
    }
    
    const existingQuote = this.quotes[index];
    if (!existingQuote) {
      throw new Error('Quote not found');
    }
    
    const updatedQuote: Quote = {
      id: existingQuote.id,
      createdAt: existingQuote.createdAt,
      status: updates.status !== undefined ? updates.status : existingQuote.status,
      jobId: updates.jobId !== undefined ? updates.jobId : existingQuote.jobId,
      name: updates.name !== undefined ? updates.name : existingQuote.name,
      subtotal: updates.subtotal !== undefined ? updates.subtotal : existingQuote.subtotal,
      gst: updates.gst !== undefined ? updates.gst : existingQuote.gst,
      total: updates.total !== undefined ? updates.total : existingQuote.total,
      depositPct: updates.depositPct !== undefined ? updates.depositPct : existingQuote.depositPct,
      pdfUrl: updates.pdfUrl !== undefined ? updates.pdfUrl : existingQuote.pdfUrl,
      publicToken: updates.publicToken !== undefined ? updates.publicToken : existingQuote.publicToken,
      stripePaymentIntentId: updates.stripePaymentIntentId !== undefined ? updates.stripePaymentIntentId : existingQuote.stripePaymentIntentId,
      validityDays: updates.validityDays !== undefined ? updates.validityDays : existingQuote.validityDays,
      updatedAt: new Date()
    };
    
    this.quotes[index] = updatedQuote;
    return updatedQuote;
  }

  async updateOrgSettings(orgId: string, updates: any): Promise<any> {
    // Mock implementation - just return the updates
    return { 
      orgId, 
      ...updates,
      taxRate: updates.taxRate?.toString() ?? '0.10',
      depositDefaultPct: updates.depositDefaultPct?.toString() ?? '0.30'
    };
  }

  async getOrgSettings(orgId: string): Promise<any> {
    // Mock implementation - return default settings
    return {
      orgId,
      currencyCode: 'AUD',
      taxRate: '0.10',
      depositDefaultPct: '0.30',
      validityDays: 30
    };
  }

  // Authentication & Security methods (mock implementations)
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    this.users[userIndex] = { ...this.users[userIndex], ...updates };
    return this.users[userIndex];
  }

  async createLoginAttempt(data: { email: string; ipAddress?: string; userAgent?: string; success: boolean; reason?: string }): Promise<void> {
    // Mock: just log to console
    console.log('[MockStorage] Login attempt:', data);
  }

  async createSecurityEvent(data: { userId?: string; eventType: string; ipAddress?: string; userAgent?: string; details?: Record<string, any> }): Promise<void> {
    // Mock: just log to console
    console.log('[MockStorage] Security event:', data);
  }

  async getRecentFailedLoginAttempts(email: string, windowMinutes: number): Promise<number> {
    // Mock: return 0 (no failed attempts in mock mode)
    return 0;
  }

  async createVerificationToken(data: { identifier: string; token: string; expires: Date }): Promise<void> {
    // Mock: just log to console
    console.log('[MockStorage] Verification token created:', data.identifier);
  }

  async getVerificationToken(token: string): Promise<{ identifier: string; expires: Date } | null> {
    // Mock: return null (tokens not stored in mock mode)
    return null;
  }

  async deleteVerificationToken(token: string): Promise<void> {
    // Mock: no-op
  }

  async deleteVerificationTokensForIdentifier(identifier: string): Promise<void> {
    // Mock: no-op
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
    }, user.id);

    // Create org member
    await this.createOrgMember(org.id, user.id, 'owner');

    // Create some mock materials
    await this.createMaterial({
      name: 'Travertine Silver',
      sku: 'TRV-SIL-001',
      category: 'coping',
      unit: 'lm',
      price: '85.00',
      wastagePct: '8.0',
      marginPct: '25.0',
      isActive: true
    });

    await this.createMaterial({
      name: 'Glass Mosaic Blue',
      sku: 'GLM-BLU-001',
      category: 'waterline_tile',
      unit: 'm2',
      price: '160.00',
      wastagePct: '10.0',
      marginPct: '35.0',
      isActive: true
    });

    console.log('[MockStorage] Initialized with test data');
    console.log('[MockStorage] Test user: test@example.com / password123');
    console.log('[MockStorage] Organization: Test Pool Company');
  }
}
