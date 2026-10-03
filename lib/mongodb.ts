import mongoose, { type Mongoose } from "mongoose";

/**
 * Cached Mongoose connection.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every reload until MongoDB refuses them. We therefore park
 * the connection (and the in-flight promise, so concurrent requests share one
 * handshake) on `globalThis`, which survives module re-evaluation.
 */

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global._mongooseCache) {
  global._mongooseCache = cached;
}

export async function connectToDatabase(): Promise<Mongoose> {
  /**
   * Read at call time, not at module scope: scripts load their environment with
   * `loadEnvConfig` at runtime, and ES module imports are hoisted above that
   * call — a top-level read would capture an undefined value.
   */
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not defined. Copy .env.example to .env.local and set it.",
    );
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        // Fail fast instead of hanging a request for 30s when Mongo is down.
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 10,
      })
      .then((m) => m)
      .catch((error) => {
        // Drop the rejected promise so the next request retries the connection.
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/** Closes the connection. Used by scripts (seed) so the process can exit. */
export async function disconnectFromDatabase(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}

export default connectToDatabase;
