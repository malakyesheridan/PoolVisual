import { z } from 'zod';

// Email validation (matches current regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
export const emailSchema = z.string().email("Please enter a valid email address");

// Phone validation (matches current regex: /^[\+]?[0-9\s\-\(\)]{8,}$/)
export const phoneSchema = z.string()
  .regex(/^[\+]?[0-9\s\-\(\)]{8,}$/, "Please enter a valid phone number")
  .optional()
  .or(z.literal(""));

// Login form schema (EXACT match to current validation)
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
});

// Register form schema (ENHANCED - adds password strength requirements)
export const registerSchema = z.object({
  email: emailSchema,
  username: z.string()
    .min(2, "Username must be at least 2 characters")
    .max(50, "Username must be less than 50 characters"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  orgName: z.string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be less than 100 characters")
    .optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

// Job creation schema (SIMPLIFIED - orgId no longer required)
export const jobSchema = z.object({
  clientName: z.string()
    .min(1, "Client name is required")
    .min(2, "Client name must be at least 2 characters"),
  clientEmail: emailSchema.optional().or(z.literal("")),
  clientPhone: phoneSchema,
  address: z.string().optional()
});

// Organization creation schema (EXACT match to current validation)
export const orgSchema = z.object({
  name: z.string()
    .min(1, "Organization name is required")
    .min(2, "Organization name must be at least 2 characters"),
  contactEmail: emailSchema.optional().or(z.literal("")),
  contactPhone: phoneSchema,
  address: z.string().optional()
});

// Edit client info schema (for job-detail modal)
export const editClientSchema = z.object({
  clientName: z.string()
    .min(1, "Client name is required")
    .min(2, "Client name must be at least 2 characters"),
  clientPhone: phoneSchema,
  clientEmail: emailSchema.optional().or(z.literal("")),
  address: z.string().optional()
});

// Type exports for TypeScript inference
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type JobFormData = z.infer<typeof jobSchema>;
export type OrgFormData = z.infer<typeof orgSchema>;
export type EditClientFormData = z.infer<typeof editClientSchema>;

