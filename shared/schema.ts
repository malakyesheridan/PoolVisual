import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, numeric, integer, boolean, timestamp, jsonb, pgEnum, unique } from "drizzle-orm/pg-core";
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
export const photoCategoryEnum = pgEnum("photo_category", ["marketing", "renovation_buyer"]);

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
  // Profile fields
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").default("UTC"),
  // Admin fields
  isAdmin: boolean("is_admin").default(false).notNull(),
  adminPermissions: jsonb("admin_permissions").default(sql`'[]'::jsonb`),
  // Personalization fields (from migration 028)
  // Made required in migration 038 - default 'pool' for backward compatibility
  industryType: text("industry_type").notNull().default("pool"),
  enhancementsBalance: numeric("enhancements_balance", { precision: 20, scale: 0 }).default("0"),
  trialEnhancementsGranted: boolean("trial_enhancements_granted").default(false),
  trialStartedAt: timestamp("trial_started_at"),
  // Free trial system fields
  isTrial: boolean("is_trial").default(false),
  trialStartDate: timestamp("trial_start_date"),
  trialEnhancements: integer("trial_enhancements").default(0),
  hasUsedTrial: boolean("has_used_trial").default(false),
  // Subscription fields (user-level)
  subscriptionPlanId: uuid("subscription_plan_id").references(() => subscriptionPlans.id),
  subscriptionStatus: text("subscription_status").default("trial"),
  subscriptionTier: text("subscription_tier").default("t1"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStartedAt: timestamp("subscription_started_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  subscriptionTrialEndsAt: timestamp("subscription_trial_ends_at"),
  // Settings fields (user-level, migrated from org settings)
  currencyCode: text("currency_code").default("AUD"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0.10"),
  depositDefaultPct: numeric("deposit_default_pct", { precision: 5, scale: 4 }).default("0.30"),
  validityDays: integer("validity_days").default(30),
  pdfTerms: text("pdf_terms"),
  // Referral system fields
  referralCode: text("referral_code").unique(),
  referralRewardsEarned: integer("referral_rewards_earned").default(0),
  referralRewardsLimit: integer("referral_rewards_limit").default(200),
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
  industry: text("industry"), // Industry/trade type: pool, landscaping, building, electrical, plumbing, real_estate, other
  subscriptionPlanId: uuid("subscription_plan_id"),
  subscriptionStatus: text("subscription_status").default("trial"),
  subscriptionTier: text("subscription_tier").default("t1"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStartedAt: timestamp("subscription_started_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  subscriptionTrialEndsAt: timestamp("subscription_trial_ends_at"),
  industryLocked: boolean("industry_locked").default(true),
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

// User preferences
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").references(() => users.id).primaryKey(),
  dateFormat: text("date_format").default("dd/mm/yyyy").notNull(),
  measurementUnits: text("measurement_units").default("metric").notNull(),
  language: text("language").default("en").notNull(),
  theme: text("theme").default("light").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Trade category mapping
export const tradeCategoryMapping = pgTable("trade_category_mapping", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  industry: text("industry").notNull(),
  categoryKey: text("category_key").notNull(),
  categoryLabel: text("category_label").notNull(),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User onboarding
export const userOnboarding = pgTable("user_onboarding", {
  userId: uuid("user_id").references(() => users.id).primaryKey(),
  step: text("step").default("welcome").notNull(),
  completed: boolean("completed").default(false),
  responses: jsonb("responses").default(sql`'{}'::jsonb`),
  firstJobId: uuid("first_job_id").references(() => jobs.id),
  firstPhotoId: uuid("first_photo_id").references(() => photos.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Referrals table
export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerUserId: uuid("referrer_user_id").references(() => users.id).notNull(),
  refereeUserId: uuid("referee_user_id").references(() => users.id).notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'completed', 'rewarded'
  referrerRewarded: boolean("referrer_rewarded").default(false),
  refereeRewarded: boolean("referee_rewarded").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueReferee: unique().on(table.refereeUserId), // Prevent duplicate referrals for same referee
}));

// Subscription Plans
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  planKey: text("plan_key").notNull().unique(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  tier: text("tier").notNull(),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }),
  priceYearly: numeric("price_yearly", { precision: 10, scale: 2 }),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  features: jsonb("features").default(sql`'{}'::jsonb`),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Subscription History
export const subscriptionHistory = pgTable("subscription_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id), // Deprecated, kept for backward compatibility
  userId: uuid("user_id").references(() => users.id), // User who owns this subscription history
  planId: uuid("plan_id").references(() => subscriptionPlans.id),
  eventType: text("event_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  fromTier: text("from_tier"),
  toTier: text("to_tier"),
  stripeEventId: text("stripe_event_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin Industry Preferences
export const adminIndustryPreferences = pgTable("admin_industry_preferences", {
  userId: uuid("user_id").references(() => users.id).primaryKey(),
  preferredIndustry: text("preferred_industry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Materials
export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id), // Deprecated, kept for backward compatibility
  userId: uuid("user_id").references(() => users.id), // NULL = global material, UUID = user-specific
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
  orgId: uuid("org_id").references(() => orgs.id), // Deprecated, kept for backward compatibility
  userId: uuid("user_id").references(() => users.id).notNull(), // User who owns this labor rule
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
  orgId: uuid("org_id").references(() => orgs.id), // Deprecated, kept for backward compatibility
  userId: uuid("user_id").references(() => users.id).notNull(), // User who owns this job
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  address: text("address"),
  status: jobStatusEnum("status").default("new").notNull(),
  createdBy: uuid("created_by").references(() => orgMembers.id), // Deprecated, kept for backward compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Property details (for real estate)
  bedrooms: integer("bedrooms"),
  bathrooms: numeric("bathrooms", { precision: 3, scale: 1 }),
  garageSpaces: integer("garage_spaces"),
  estimatedPrice: text("estimated_price"), // Changed to text to support special values like "POA", "$600,000", etc.
  propertyType: text("property_type"),
  landSizeM2: numeric("land_size_m2", { precision: 10, scale: 2 }),
  interiorSizeM2: numeric("interior_size_m2", { precision: 10, scale: 2 }),
  yearBuilt: integer("year_built"),
  yearRenovated: integer("year_renovated"),
  propertyStatus: text("property_status"),
  listingDate: timestamp("listing_date"),
  mlsNumber: text("mls_number"),
  propertyDescription: text("property_description"),
  propertyFeatures: jsonb("property_features").default(sql`'[]'::jsonb`),
  propertyCondition: text("property_condition"),
  hoaFees: numeric("hoa_fees", { precision: 10, scale: 2 }),
  propertyTaxes: numeric("property_taxes", { precision: 10, scale: 2 }),
  suburb: text("suburb"),
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
  photoCategory: photoCategoryEnum("photo_category").default("marketing").notNull(),
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
  createdBy: uuid("created_by").references(() => orgMembers.id), // Deprecated, kept for backward compatibility
  userId: uuid("user_id").references(() => users.id).notNull(), // User who owns this mask
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
  orgId: uuid("org_id").references(() => orgs.id), // Optional, kept for backward compatibility
  userId: uuid("user_id").references(() => users.id), // User who performed the action
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

// Property notes (for real estate)
export const propertyNotes = pgTable("property_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  noteText: text("note_text").notNull(),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contacts (for real estate CRM)
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  orgId: uuid("org_id").references(() => orgs.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  address: text("address"),
  notes: text("notes"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  buyerProfile: jsonb("buyer_profile").default(sql`'{}'::jsonb`), // Structured buyer specifications
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pipelines (for real estate CRM)
export const pipelines = pgTable("pipelines", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  orgId: uuid("org_id").references(() => orgs.id),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  stageOrder: text("stage_order").array().default(sql`'{}'::text[]`), // Array of stage IDs in order
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pipeline Stages
export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id).notNull(),
  name: text("name").notNull(),
  order: integer("order").default(0).notNull(),
  color: text("color").default("#6B7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Stage Name Overrides
export const userStageNames = pgTable("user_stage_names", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  stageId: uuid("stage_id").references(() => pipelineStages.id).notNull(),
  customName: text("custom_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserStage: unique().on(table.userId, table.stageId),
}));

// Opportunities (for real estate CRM)
export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  orgId: uuid("org_id").references(() => orgs.id),
  title: text("title").notNull(), // e.g. "123 Main St Renovation"
  contactId: uuid("contact_id").references(() => contacts.id), // Foreign key to Contact
  pipelineId: uuid("pipeline_id").references(() => pipelines.id),
  stageId: uuid("stage_id").references(() => pipelineStages.id),
  status: text("status").default("open").notNull(), // 'open' | 'won' | 'lost' | 'abandoned'
  opportunityType: text("opportunity_type").default("buyer").notNull(), // 'buyer' | 'seller' | 'both'
  value: numeric("value", { precision: 12, scale: 2 }), // potential revenue (renamed from estimatedValue)
  ownerId: uuid("owner_id").references(() => users.id), // assigned user
  tags: text("tags").array().default(sql`'{}'::text[]`),
  // Legacy fields (keep for backward compatibility)
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  propertyAddress: text("property_address"),
  propertyJobId: uuid("property_job_id").references(() => jobs.id),
  pipelineStage: text("pipeline_stage").default("new"), // Legacy field
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  probabilityPct: integer("probability_pct").default(0),
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  source: text("source"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
});

// Opportunity Tasks (renamed from follow-ups for clarity)
export const opportunityTasks = pgTable("opportunity_tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id).notNull(),
  title: text("title").notNull(), // Task title
  description: text("description"), // Optional description
  status: text("status").default("pending").notNull(), // 'pending' | 'completed'
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  completedBy: uuid("completed_by").references(() => users.id),
  assigneeId: uuid("assignee_id").references(() => users.id), // Renamed from assignedTo
  taskOrder: integer("task_order").default(0),
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Legacy table name alias (for backward compatibility)
export const opportunityFollowups = opportunityTasks;

// Opportunity notes
export const opportunityNotes = pgTable("opportunity_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  noteText: text("note_text").notNull(),
  noteType: text("note_type").default("general"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Opportunity activities
export const opportunityActivities = pgTable("opportunity_activities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  activityType: text("activity_type").notNull(),
  activityTitle: text("activity_title").notNull(),
  activityDescription: text("activity_description"),
  activityData: jsonb("activity_data").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Opportunity documents
export const opportunityDocuments = pgTable("opportunity_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  description: text("description"),
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
  createdBy: z.string().uuid().optional(), // Deprecated
  orgId: z.string().uuid().optional(), // Deprecated
  userId: z.string().uuid().optional() // Will be set from session
}).omit({ 
  id: true, 
  createdAt: true,
  createdBy: true,
  orgId: true,
  userId: true // Will be set from session in API
});

export const insertPhotoSchema = createInsertSchema(photos).omit({ 
  id: true, 
  createdAt: true 
});

export const insertPropertyNoteSchema = createInsertSchema(propertyNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpportunityFollowupSchema = createInsertSchema(opportunityFollowups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpportunityNoteSchema = createInsertSchema(opportunityNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpportunityActivitySchema = createInsertSchema(opportunityActivities).omit({
  id: true,
  createdAt: true,
});

export const insertOpportunityDocumentSchema = createInsertSchema(opportunityDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Actions (for action tracking and follow-ups)
export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id),
  agentId: uuid("agent_id").references(() => users.id), // User who created or owns the action
  contactId: uuid("contact_id").references(() => contacts.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  propertyId: uuid("property_id").references(() => jobs.id), // Property/job reference
  actionType: text("action_type").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertActionSchema = createInsertSchema(actions).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineSchema = createInsertSchema(pipelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// User sessions table for tracking active sessions
export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  deviceInfo: jsonb("device_info"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  lastActive: timestamp("last_active", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Admin actions table for audit logging
export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: uuid("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  actionType: text("action_type").notNull(),
  resourceType: text("resource_type"),
  resourceId: uuid("resource_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type AdminAction = typeof adminActions.$inferSelect;
export type InsertAdminAction = typeof adminActions.$inferInsert;
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
export type TradeCategoryMapping = typeof tradeCategoryMapping.$inferSelect;
export type InsertTradeCategoryMapping = typeof tradeCategoryMapping.$inferInsert;
export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type InsertUserOnboarding = typeof userOnboarding.$inferInsert;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type InsertSubscriptionHistory = typeof subscriptionHistory.$inferInsert;
export type AdminIndustryPreference = typeof adminIndustryPreferences.$inferSelect;
export type InsertAdminIndustryPreference = typeof adminIndustryPreferences.$inferInsert;
export type PropertyNote = typeof propertyNotes.$inferSelect;
export type InsertPropertyNote = z.infer<typeof insertPropertyNoteSchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type OpportunityFollowup = typeof opportunityFollowups.$inferSelect;
export type InsertOpportunityFollowup = z.infer<typeof insertOpportunityFollowupSchema>;
export type OpportunityNote = typeof opportunityNotes.$inferSelect;
export type InsertOpportunityNote = z.infer<typeof insertOpportunityNoteSchema>;
export type OpportunityActivity = typeof opportunityActivities.$inferSelect;
export type InsertOpportunityActivity = z.infer<typeof insertOpportunityActivitySchema>;
export type OpportunityDocument = typeof opportunityDocuments.$inferSelect;
export type InsertOpportunityDocument = z.infer<typeof insertOpportunityDocumentSchema>;
export type OpportunityTask = typeof opportunityTasks.$inferSelect;
export type InsertOpportunityTask = typeof opportunityTasks.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;
export type Action = typeof actions.$inferSelect;
export type InsertAction = z.infer<typeof insertActionSchema>;

// Buyer Form Links (for shareable buyer inquiry forms)
export const buyerFormLinks = pgTable("buyer_form_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id).notNull(),
  propertyId: uuid("property_id").references(() => jobs.id), // Optional: link to a specific property
  token: text("token").notNull().unique(), // Secure random token for public access
  status: text("status").default("active").notNull(), // 'active' | 'disabled'
  expiresAt: timestamp("expires_at"), // Optional expiry
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Buyer Form Submissions (tracks form submissions)
export const buyerFormSubmissions = pgTable("buyer_form_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  formLinkId: uuid("form_link_id").references(() => buyerFormLinks.id).notNull(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  createdContactId: uuid("created_contact_id").references(() => contacts.id), // Contact created/updated from submission
  createdOpportunityId: uuid("created_opportunity_id").references(() => opportunities.id), // Opportunity created from submission
  payload: jsonb("payload").default(sql`'{}'::jsonb`).notNull(), // Full form submission data
  requestIp: text("request_ip"), // Optional: IP address (privacy-conscious)
  userAgent: text("user_agent"), // Optional: user agent string
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BuyerFormLink = typeof buyerFormLinks.$inferSelect;
export type InsertBuyerFormLink = typeof buyerFormLinks.$inferInsert;
export type BuyerFormSubmission = typeof buyerFormSubmissions.$inferSelect;
export type InsertBuyerFormSubmission = typeof buyerFormSubmissions.$inferInsert;

// Match Suggestions (for Buyer-Property Match Alerts & Follow-Up Prompts)
export const matchSuggestions = pgTable("match_suggestions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  propertyId: uuid("property_id").references(() => jobs.id).notNull(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  matchScore: integer("match_score").notNull(),
  matchTier: text("match_tier").notNull(),
  status: text("status").default("new").notNull(),
  source: text("source").default("auto_match_v1").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  actedByUserId: uuid("acted_by_user_id").references(() => users.id),
  actedAt: timestamp("acted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MatchSuggestion = typeof matchSuggestions.$inferSelect;
export type InsertMatchSuggestion = typeof matchSuggestions.$inferInsert;

export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipeline = typeof pipelines.$inferInsert;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = typeof pipelineStages.$inferInsert;

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