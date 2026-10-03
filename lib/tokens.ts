import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Password-reset tokens.
 *
 * The raw token goes to the user (in the link); only its SHA-256 digest is
 * stored. A leaked database therefore cannot be used to reset anyone's
 * password, which is the same reasoning behind hashing passwords themselves.
 */

export const RESET_TOKEN_TTL_MINUTES = 60;

export function generateResetToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison so token checks do not leak length or prefix. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
