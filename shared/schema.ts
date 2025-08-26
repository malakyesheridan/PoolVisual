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
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  category: materialCategoryEnum("category").notNull(),
  unit: materialUnitEnum("unit").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  price: numeric("price", { precision: 10, scale: 2 }),
  defaultWastagePct: numeric("default_wastage_pct", { precision: 5, scale: 2 }),
  defaultMarginPct: numeric("default_margin_pct", { precision: 5, scale: 2 }),
  textureUrl: text("texture_url"),
  thumbnailUrl: text("thumbnail_url"),
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
  createdBy: uuid("created_by").references(() => orgMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quotes
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
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

export const insertJobSchema = createInsertSchema(jobs).omit({ 
  id: true, 
  createdAt: true 
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
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
