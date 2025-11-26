import type { SessionOptions } from "iron-session";
export const sessionOptions: SessionOptions = {
  cookieName: "ef.session", // Changed from pv.session - users will need to re-login after deployment
  password: process.env.SESSION_SECRET || "dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_32+chars",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
  },
};

// Type augmentation for req.session.user
declare module "iron-session" {
  interface IronSessionData {
    user?: { id: string; email: string; username?: string };
  }
}
