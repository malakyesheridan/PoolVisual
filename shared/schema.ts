import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, numeric, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const orgRoleEnum = pgEnum("org_role", ["owner", "estimator", "field-tech", "viewer"]);
export const materialCategoryEnum = pgEnum("material_category", ["coping", "waterline_tile", "interior", "paving", "fencing"]);
export const materialUnitEnum = pgEnum("material_unit", ["m2", "lm", "each"]);
export const jobStatusEnum = pgEnum("job_status", ["new", "estimating", "sent", "accepted", "declined", "scheduled", "completed"]);
export const maskTypeEnum = pgEnum("mask_type", ["area", "linear", "waterline_band"]);
export const quoteStatusEnum = pgEnum("quote_status", ["draft", "sent", "accepted", "declined"]);
export const quoteItemKindEnum = pgEnum("quote_item_kind", ["material", "labor", "adjustment"]);
export const laborRuleTypeEnum = pgEnum("labor_rule_type", ["flat", "per_m2", "per_lm", "tiered"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Security fields
  lockedUntil: timestamp("locked_until"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
  isActive: boolean("is_active").default(true),
  emailVerifiedAt: timestamp("email_verified_at"),
  // Email verification (from migration 004)
  emailVerified: boolean("email_verified").default(false),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
});

// Organizations
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  abn: text("abn"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  brandColors: jsonb("brand_colors"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Organization members
export const orgMembers = pgTable("org_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: orgRoleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Organization settings
export const settings = pgTable("settings", {
  orgId: uuid("org_id").references(() => orgs.id).unique().notNull(),
  currencyCode: text("currency_code").default("AUD").notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0.10").notNull(),
  depositDefaultPct: numeric("deposit_default_pct", { precision: 5, scale: 4 }).default("0.30").notNull(),
  validityDays: integer("validity_days").default(30).notNull(),
  pdfTerms: text("pdf_terms"),
});

// Materials
export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id),
  supplier: text("supplier").default("PoolTile"),
  sourceUrl: text("source_url"),
  name: text("name").notNull(),
  sku: text("sku"),
  category: materialCategoryEnum("category").notNull(),
  unit: materialUnitEnum("unit").notNull(),
  color: text("color"),
  finish: text("finish"),
  tileWidthMm: integer("tile_width_mm"),
  tileHeightMm: integer("tile_height_mm"),
  sheetWidthMm: integer("sheet_width_mm"),
  sheetHeightMm: integer("sheet_height_mm"),
  thicknessMm: integer("thickness_mm"),
  groutWidthMm: integer("grout_width_mm"),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  price: numeric("price", { precision: 10, scale: 2 }),
  wastagePct: numeric("wastage_pct", { precision: 5, scale: 2 }).default("8"),
  marginPct: numeric("margin_pct", { precision: 5, scale: 2 }),
  textureUrl: text("texture_url"),
  thumbnailUrl: text("thumbnail_url"),
  physicalRepeatM: numeric("physical_repeat_m", { precision: 10, scale: 4 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Labor rules
export const laborRules = pgTable("labor_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  ruleType: laborRuleTypeEnum("rule_type").notNull(),
  baseAmount: numeric("base_amount", { precision: 10, scale: 2 }),
  rate: numeric("rate", { precision: 10, scale: 2 }),
  tiersJson: jsonb("tiers_json"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Jobs
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  address: text("address"),
  status: jobStatusEnum("status").default("new").notNull(),
  createdBy: uuid("created_by").references(() => orgMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Photos
export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  originalUrl: text("original_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  exifJson: jsonb("exif_json"),
  calibrationPixelsPerMeter: numeric("calibration_pixels_per_meter", { precision: 10, scale: 4 }),
  calibrationMetaJson: jsonb("calibration_meta_json"),
  compositeUrl: text("composite_url"), // Cached composite image URL
  compositeGeneratedAt: timestamp("composite_generated_at"), // When composite was last generated
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Masks
export const masks = pgTable("masks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: uuid("photo_id").references(() => photos.id).notNull(),
  type: maskTypeEnum("type").notNull(),
  pathJson: jsonb("path_json").notNull(),
  bandHeightM: numeric("band_height_m", { precision: 10, scale: 2 }),
  areaM2: numeric("area_m2", { precision: 10, scale: 2 }),
  perimeterM: numeric("perimeter_m", { precision: 10, scale: 2 }),
  materialId: uuid("material_id").references(() => materials.id),
  calcMetaJson: jsonb("calc_meta_json"), // For material settings: repeatScale, rotationDeg, brightness, contrast
  // Multi-Level Geometry fields (additive)
  depthLevel: integer("depth_level").default(0), // 0=surface, 1=mid-level, 2=deep
  elevationM: numeric("elevation_m", { precision: 10, scale: 2 }).default(0), // Elevation in meters
  zIndex: integer("z_index").default(0), // Rendering order for z-buffer
  isStepped: boolean("is_stepped").default(false), // Whether this mask represents stepped geometry
  createdBy: uuid("created_by").references(() => orgMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Import runs for supplier data
export const importRuns = pgTable("import_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  supplier: text("supplier").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  totals: jsonb("totals"),
  log: text("log"),
});

// Quotes
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  name: text("name"),
  status: quoteStatusEnum("status").default("draft").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }),
  gst: numeric("gst", { precision: 10, scale: 2 }),
  total: numeric("total", { precision: 10, scale: 2 }),
  depositPct: numeric("deposit_pct", { precision: 5, scale: 4 }),
  pdfUrl: text("pdf_url"),
  publicToken: text("public_token").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  validityDays: integer("validity_days").default(30).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Quote items
export const quoteItems = pgTable("quote_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: uuid("quote_id").references(() => quotes.id).notNull(),
  kind: quoteItemKindEnum("kind").notNull(),
  materialId: uuid("material_id").references(() => materials.id),
  laborRuleId: uuid("labor_rule_id").references(() => laborRules.id),
  description: text("description").notNull(),
  unit: text("unit"),
  qty: numeric("qty", { precision: 10, scale: 2 }),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }),
  calcMetaJson: jsonb("calc_meta_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Public links
export const publicLinks = pgTable("public_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: uuid("quote_id").references(() => quotes.id).notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  payloadJson: jsonb("payload_json"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Audit logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook dedupe
export const webhookDedupe = pgTable("webhook_dedupe", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export const insertOrgSchema = createInsertSchema(orgs).omit({ 
  id: true, 
  createdAt: true 
});

export const insertJobSchema = createInsertSchema(jobs, {
  createdBy: z.string().uuid().optional() // Override to make optional
}).omit({ 
  id: true, 
  createdAt: true,
  createdBy: true
});

export const insertPhotoSchema = createInsertSchema(photos).omit({ 
  id: true, 
  createdAt: true 
});

export const insertMaterialSchema = createInsertSchema(materials).omit({ 
  id: true, 
  createdAt: true 
});

export const insertMaskSchema = createInsertSchema(masks).omit({ 
  id: true, 
  createdAt: true 
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({ 
  id: true, 
  createdAt: true 
});

// Enhanced Canvas Editor Types
export interface Vec2 {
  x: number;
  y: number;
}

export interface Polygon {
  points: Vec2[];
  holes?: Vec2[][];
}

export interface Polyline {
  points: Vec2[];
}

export type MaskType = 'area' | 'linear' | 'waterline_band';
export type ToolType = 'hand' | 'area' | 'linear' | 'waterline' | 'eraser' | 'calibration';
export type ViewMode = 'before' | 'after' | 'sideBySide';

export interface MaskBase {
  id: string;
  photoId: string;
  type: MaskType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AreaMask extends MaskBase {
  type: 'area';
  polygon: Polygon;
  area_m2?: number;
  materialId?: string;
  materialSettings?: {
    scale: number;
    rotation: number;
    brightness: number;
    contrast: number;
  };
}

export interface LinearMask extends MaskBase {
  type: 'linear';
  polyline: Polyline;
  perimeter_m?: number;
  materialId?: string;
}

export interface WaterlineMask extends MaskBase {
  type: 'waterline_band';
  polyline: Polyline;
  band_height_m: number;
  perimeter_m?: number;
  area_m2?: number;
  materialId?: string;
}

export type EditorMask = AreaMask | LinearMask | WaterlineMask;

// New robust calibration system
export type CalState = 'idle' | 'placingA' | 'placingB' | 'lengthEntry' | 'ready';

export interface CalibrationTemp {
  a?: Vec2;
  b?: Vec2;
  preview?: Vec2;   // last pointer for live dashed line
  meters?: number;
}

export interface CalSample {
  id: string;            // uuid
  a: Vec2;
  b: Vec2;
  meters: number;        // user input
  ppm: number;           // derived
  createdAt: string;
}

export interface Calibration {
  ppm: number;                 // global average
  samples: CalSample[];        // 1..3 recommended
  stdevPct?: number;           // variation % among samples
}

// Legacy interface for backward compatibility
export interface CalibrationData {
  pixelsPerMeter: number;
  a: Vec2;
  b: Vec2;
  lengthMeters: number;
}

export interface EditorState {
  zoom: number;
  pan: Vec2;
  activeTool: ToolType;
  brushSize: number;
  selectedMaskId?: string;
  calibration?: CalibrationData;
  calibrationV2?: Calibration;
  calState: CalState;
  calTemp: CalibrationTemp;
  mode: ViewMode;
  isDirty: boolean;
  lastSaved?: string;
}

// Zod schemas for API validation
export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const PolygonSchema = z.object({
  points: z.array(Vec2Schema),
  holes: z.array(z.array(Vec2Schema)).optional(),
});

export const PolylineSchema = z.object({
  points: z.array(Vec2Schema),
});

// New calibration schemas
export const CalSampleSchema = z.object({
  id: z.string().uuid(),
  a: Vec2Schema,
  b: Vec2Schema,
  meters: z.number().min(0.25, "Reference length must be at least 0.25m"),
  ppm: z.number().positive(),
  createdAt: z.string(),
});

export const CalibrationSchema = z.object({
  ppm: z.number().positive(),
  samples: z.array(CalSampleSchema).min(1).max(5),
  stdevPct: z.number().optional(),
});

// Legacy schema
export const CalibrationDataSchema = z.object({
  pixelsPerMeter: z.number().positive(),
  a: Vec2Schema,
  b: Vec2Schema,
  lengthMeters: z.number().positive(),
});

export const AreaMaskSchema = z.object({
  id: z.string(),
  photoId: z.string(),
  type: z.literal('area'),
  polygon: PolygonSchema,
  area_m2: z.number().optional(),
  materialId: z.string().optional(),
  materialSettings: z.object({
    scale: z.number(),
    rotation: z.number(),
    brightness: z.number(),
    contrast: z.number(),
  }).optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LinearMaskSchema = z.object({
  id: z.string(),
  photoId: z.string(),
  type: z.literal('linear'),
  polyline: PolylineSchema,
  perimeter_m: z.number().optional(),
  materialId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WaterlineMaskSchema = z.object({
  id: z.string(),
  photoId: z.string(),
  type: z.literal('waterline_band'),
  polyline: PolylineSchema,
  band_height_m: z.number().positive(),
  perimeter_m: z.number().optional(),
  area_m2: z.number().optional(),
  materialId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const EditorMaskSchema = z.discriminatedUnion('type', [
  AreaMaskSchema,
  LinearMaskSchema,
  WaterlineMaskSchema,
]);

export const EditorStateSchema = z.object({
  zoom: z.number().min(0.1).max(10),
  pan: Vec2Schema,
  activeTool: z.enum(['hand', 'area', 'linear', 'waterline', 'eraser', 'calibration']),
  brushSize: z.number().min(1).max(100),
  selectedMaskId: z.string().optional(),
  calibration: CalibrationSchema.optional(),
  mode: z.enum(['before', 'after', 'sideBySide']),
  isDirty: z.boolean(),
  lastSaved: z.string().optional(),
});

// Types
// Login attempts audit table
export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Security events audit table
export const securityEvents = pgTable("security_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Verification tokens table
export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(), // Email address
  token: text("token").notNull().unique(), // 64-char hex token
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type Org = typeof orgs.$inferSelect;
export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Mask = typeof masks.$inferSelect;
export type InsertMask = z.infer<typeof insertMaskSchema>;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;

// Calibration metadata schema
export const CalibrationMetaSchema = z.object({
  samples: z.array(z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    distance: z.number(),
    pixels: z.number()
  })),
  stdevPct: z.number().optional(),
  method: z.string().optional()
});

export type CalibrationMeta = z.infer<typeof CalibrationMetaSchema>;

// Settings schema for organization settings
export const SettingsSchema = z.object({
  currencyCode: z.string().default("AUD"),
  taxRate: z.number().default(0.10),
  depositDefaultPct: z.number().default(0.30),
  validityDays: z.number().default(30),
  pdfTerms: z.string().optional()
});

export type Settings = z.infer<typeof SettingsSchema>;