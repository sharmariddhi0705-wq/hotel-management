import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/constants";

/**
 * Augments the Auth.js session, user and JWT with the fields this app puts on
 * them, so `session.user.role` and `token.role` are typed everywhere instead of
 * falling back to the `Record<string, unknown>` index signature.
 */

interface AppTokenClaims {
  id: string;
  role: UserRole;
  status: string;
  staffId?: string | null;
}

declare module "next-auth" {
  interface Session {
    user: AppTokenClaims & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role: UserRole;
    status: string;
    staffId?: string | null;
  }
}

/**
 * `next-auth/jwt` only re-exports `@auth/core/jwt`, so the augmentation has to
 * target the core module — augmenting the re-export has no effect.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: string;
    staffId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: string;
    staffId?: string | null;
  }
}
