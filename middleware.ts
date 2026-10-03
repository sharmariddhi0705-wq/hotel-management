import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Route protection.
 *
 * `NextAuth(authConfig).auth` reads and verifies the session cookie on the Edge
 * runtime and delegates the decision to `callbacks.authorized`. Because the
 * config here contains no providers, nothing pulls Mongoose into the Edge
 * bundle.
 */
export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
  /**
   * Run on every request except Next internals, static assets and the Auth.js
   * endpoints themselves. API routes are intentionally *included*: they perform
   * their own server-side checks, but the cheap cookie check here rejects
   * anonymous traffic before it reaches the database.
   */
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)",
  ],
};
