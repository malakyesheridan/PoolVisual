import { storage } from '../storage.js';
import type { AuthenticatedRequest } from '../routes.js';

/**
 * Middleware to require industryType for protected routes
 * Blocks access if user doesn't have industryType set
 */
export async function requireIndustryType(
  req: AuthenticatedRequest,
  res: any,
  next: any
): Promise<void> {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await storage.getUser(req.user.id);
    if (!user?.industryType) {
      return res.status(403).json({
        message: "Industry selection required",
        redirectTo: "/onboarding",
        code: "INDUSTRY_REQUIRED"
      });
    }

    next();
  } catch (error: any) {
    console.error('[requireIndustryType] Error:', error);
    res.status(500).json({ message: "Failed to verify industry selection" });
  }
}

