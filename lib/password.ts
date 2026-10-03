import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * We use `bcryptjs` rather than the native `bcrypt` binding: it implements the
 * same bcrypt algorithm and produces interchangeable `$2a$`/`$2b$` hashes, but
 * needs no native compilation, which keeps `npm install` working on every
 * platform and lets the code run unchanged on serverless hosts.
 */

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
