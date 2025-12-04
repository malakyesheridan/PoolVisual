import type { SessionOptions } from "iron-session";

// Validate SESSION_SECRET in production
const sessionSecret = process.env.SESSION_SECRET || "dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_32+chars";
if (!process.env.SESSION_SECRET || sessionSecret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set and at least 32 characters in production');
  }
  console.warn('[Session] Using weak dev secret - not suitable for production');
}

export const sessionOptions: SessionOptions = {
  cookieName: "ef.session", // Changed from pv.session - users will need to re-login after deployment
  password: sessionSecret,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // Changed from "lax" for better security
    httpOnly: true,
  },
};

// Type augmentation for req.session.user
declare module "iron-session" {
  interface IronSessionData {
    user?: { id: string; email: string; username?: string };
  }
}
