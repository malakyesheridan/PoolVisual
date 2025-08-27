/**
 * Comprehensive Zod validation schemas for the entire application
 * Provides runtime type safety at all API boundaries
 */

import { z } from 'zod';

// Common validation patterns
export const IdParamSchema = z.object({
  id: z.string().uuid()
});

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0)
});

// Organization schemas
export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  settings: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
});

// User schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  organizationId: z.string().uuid(),
  role: z.enum(['admin', 'manager', 'user']),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const CreateUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  username: z.string().min(1, "Username is required").max(50),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  role: z.enum(['admin', 'manager', 'user']).default('user')
});

export const LoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required")
});

// Client schemas
export const ClientSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const CreateClientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(255),
  email: z.string().email("Valid email is required").optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional()
});

// Job schemas
export const JobSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']),
  totalValue: z.number().min(0).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const CreateJobSchema = z.object({
  clientId: z.string().uuid("Valid client ID is required"),
  title: z.string().min(1, "Job title is required").max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).default('draft')
});

// Photo schemas
export const PhotoSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  originalUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  exifJson: z.record(z.unknown()).nullable(),
  calibrationPixelsPerMeter: z.number().positive().nullable(),
  calibrationMetaJson: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date()
});

export const UploadInitSchema = z.object({
  fileName: z.string().min(1, "File name is required").max(255),
  contentType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/, "Only JPEG, PNG, and WebP images are allowed"),
  jobId: z.string().uuid("Valid job ID is required"),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024, "File size must be less than 50MB")
});

// Material schemas
export const MaterialSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  category: z.enum(['coping', 'waterline_tiles', 'interior_finish', 'paving', 'fencing']),
  unitType: z.enum(['m2', 'lm', 'each']),
  unitPrice: z.number().min(0),
  margin: z.number().min(0).max(1),
  wastage: z.number().min(0).max(1),
  supplierCode: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const CreateMaterialSchema = z.object({
  name: z.string().min(1, "Material name is required").max(255),
  category: z.enum(['coping', 'waterline_tiles', 'interior_finish', 'paving', 'fencing']),
  unitType: z.enum(['m2', 'lm', 'each']),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  margin: z.number().min(0).max(1, "Margin must be between 0 and 1").default(0.2),
  wastage: z.number().min(0).max(1, "Wastage must be between 0 and 1").default(0.1),
  supplierCode: z.string().max(100).optional(),
  imageUrl: z.string().url().optional()
});

// Quote schemas
export const QuoteItemSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  materialId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  lineTotal: z.number().min(0),
  notes: z.string().max(500).optional()
});

export const QuoteSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  quoteNumber: z.string().min(1).max(50),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired']),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  total: z.number().min(0),
  validUntil: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  items: z.array(QuoteItemSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const CreateQuoteSchema = z.object({
  jobId: z.string().uuid("Valid job ID is required"),
  validUntil: z.coerce.date().refine(date => date > new Date(), "Valid until date must be in the future"),
  notes: z.string().max(2000).optional()
});

export const AddQuoteItemSchema = z.object({
  materialId: z.string().uuid("Valid material ID is required"),
  quantity: z.number().positive("Quantity must be positive"),
  notes: z.string().max(500).optional()
});

// Mask schemas for canvas editor
export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number()
});

export const PolygonSchema = z.object({
  points: z.array(Vec2Schema).min(3, "Polygon must have at least 3 points"),
  holes: z.array(z.array(Vec2Schema)).optional()
});

export const PolylineSchema = z.object({
  points: z.array(Vec2Schema).min(2, "Polyline must have at least 2 points")
});

export const CalibrationDataSchema = z.object({
  pixelsPerMeter: z.number().positive(),
  referenceLength: z.number().positive(),
  referencePixels: z.number().positive(),
  line: z.object({
    start: Vec2Schema,
    end: Vec2Schema
  })
});

// Editor schemas
export const ToolTypeSchema = z.enum(['area', 'linear', 'waterline', 'eraser', 'hand', 'select']);
export const ViewModeSchema = z.enum(['before', 'after', 'sideBySide']);

export const EditorStateSchema = z.object({
  zoom: z.number().min(0.1).max(10).default(1),
  pan: Vec2Schema.default({ x: 0, y: 0 }),
  activeTool: ToolTypeSchema.default('area'),
  brushSize: z.number().min(1).max(100).default(15),
  mode: ViewModeSchema.default('before'),
  calibration: CalibrationDataSchema.optional(),
  isDirty: z.boolean().default(false),
  lastSaved: z.string().optional()
});

export const AreaMaskSchema = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
  type: z.literal('area'),
  polygon: PolygonSchema,
  materialId: z.string().uuid().optional(),
  area_m2: z.number().min(0).optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const LinearMaskSchema = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
  type: z.literal('linear'),
  polyline: PolylineSchema,
  materialId: z.string().uuid().optional(),
  perimeter_m: z.number().min(0).optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const WaterlineMaskSchema = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
  type: z.literal('waterline_band'),
  polyline: PolylineSchema,
  band_height_m: z.number().positive(),
  materialId: z.string().uuid().optional(),
  perimeter_m: z.number().min(0).optional(),
  area_m2: z.number().min(0).optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const MaskSchema = z.discriminatedUnion('type', [
  AreaMaskSchema,
  LinearMaskSchema,
  WaterlineMaskSchema
]);

export const CreateMaskSchema = z.object({
  photoId: z.string().uuid("Valid photo ID is required"),
  type: z.enum(['area', 'linear', 'waterline_band']),
  pathJson: z.string().min(1, "Path data is required"),
  materialId: z.string().uuid().optional(),
  areaM2: z.number().min(0).optional(),
  perimeterM: z.number().min(0).optional(),
  bandHeightM: z.number().positive().optional()
});

// API Response schemas
export const ApiSuccessSchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
  requestId: z.string().uuid().optional()
});

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  message: z.string(),
  requestId: z.string().uuid().optional(),
  details: z.unknown().optional()
});

export const ApiResponseSchema = z.union([ApiSuccessSchema, ApiErrorSchema]);

// Validation helper function
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Create a simplified error for use in shared schemas
    const error = new Error('Validation failed');
    (error as any).code = 'VALIDATION_ERROR';
    (error as any).details = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }));
    throw error;
  }
  return result.data;
}

// Type exports for convenience
export type Organization = z.infer<typeof OrganizationSchema>;
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type CreateClient = z.infer<typeof CreateClientSchema>;
export type Job = z.infer<typeof JobSchema>;
export type CreateJob = z.infer<typeof CreateJobSchema>;
export type Photo = z.infer<typeof PhotoSchema>;
export type UploadInit = z.infer<typeof UploadInitSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type CreateMaterial = z.infer<typeof CreateMaterialSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type CreateQuote = z.infer<typeof CreateQuoteSchema>;
export type QuoteItem = z.infer<typeof QuoteItemSchema>;
export type AddQuoteItem = z.infer<typeof AddQuoteItemSchema>;
export type Vec2 = z.infer<typeof Vec2Schema>;
export type CalibrationData = z.infer<typeof CalibrationDataSchema>;
export type ToolType = z.infer<typeof ToolTypeSchema>;
export type ViewMode = z.infer<typeof ViewModeSchema>;
export type EditorState = z.infer<typeof EditorStateSchema>;
export type AreaMask = z.infer<typeof AreaMaskSchema>;
export type LinearMask = z.infer<typeof LinearMaskSchema>;
export type WaterlineMask = z.infer<typeof WaterlineMaskSchema>;
export type EditorMask = z.infer<typeof MaskSchema>;
export type CreateMask = z.infer<typeof CreateMaskSchema>;
export type ApiSuccess<T = unknown> = { ok: true; data: T; requestId?: string };
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;