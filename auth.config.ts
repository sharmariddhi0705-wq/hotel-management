import type { NextAuthConfig } from "next-auth";
import { landingPageForRole, permissionForPath, can } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";

/**
 * Edge-safe half of the Auth.js configuration.
 *
 * The middleware runs on the Edge runtime, where Mongoose cannot run. Keeping
 * the providers out of this file means middleware can verify the session cookie
 * and enforce route access without ever importing the database layer; the
 * Credentials provider lives in `lib/auth.ts`, which only runs in Node.
 */

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export const authConfig = {
  // Credentials-based sign-in requires JWT sessions (no DB session lookup).
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  providers: [],
  callbacks: {
    /**
     * Copies identity onto the token at sign-in. `trigger === "update"` lets a
     * profile change refresh the session without forcing a re-login.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user.id ?? token.sub) as string;
        token.role = user.role;
        token.status = user.status;
        token.staffId = user.staffId ?? null;
      }
      if (trigger === "update" && session?.user) {
        token.name = session.user.name ?? token.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.staffId = token.staffId ?? null;
      }
      return session;
    },

    /**
     * Route gate. Runs in middleware for every matched request.
     *
     * Returning `false` sends the visitor to the sign-in page; returning a
     * `Response` performs an explicit redirect, which is how we bounce a signed-in
     * user away from /login and away from pages their role cannot see.
     */
    authorized({ auth, request }) {
      const { pathname, search } = request.nextUrl;
      const user = auth?.user;
      const isSignedIn = Boolean(user);

      if (isSignedIn && (pathname === "/login" || pathname === "/register")) {
        const url = request.nextUrl.clone();
        url.pathname = landingPageForRole(user!.role as UserRole);
        url.search = "";
        return Response.redirect(url);
      }

      /**
       * API routes answer with JSON, never a redirect. Let them through and let
       * `requirePermission` in each handler return a proper 401/403 envelope,
       * so a fetch() never silently receives the HTML of the login page.
       */
      if (pathname.startsWith("/api/")) return true;

      if (isPublicRoute(pathname)) return true;
      if (!isSignedIn) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        // Preserve where they were going so login can send them back.
        url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
        return Response.redirect(url);
      }

      // A deactivated account keeps a valid cookie until it expires, so check.
      if (user!.status !== "ACTIVE") {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "?error=AccountInactive";
        return Response.redirect(url);
      }

      const required = permissionForPath(pathname);
      if (required && !can(user!.role as UserRole, required)) {
        const url = request.nextUrl.clone();
        url.pathname = "/forbidden";
        url.search = `?from=${encodeURIComponent(pathname)}`;
        return Response.redirect(url);
      }

      return true;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
