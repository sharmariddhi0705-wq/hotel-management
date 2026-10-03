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
  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;
  const cluster = process.env.MONGODB_CLUSTER;
  const dbName = process.env.MONGODB_DB_NAME || "hotel-management";

  // Use MONGODB_URI if provided, or build it dynamically using encodeURIComponent
  const MONGODB_URI =
    process.env.MONGODB_URI ||
    (username && password && cluster
      ? `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority`
      : null);

  if (!MONGODB_URI) {
    throw new Error(
      "Database credentials missing. Set MONGODB_URI or MONGODB_USERNAME/MONGODB_PASSWORD in .env.local",
    );
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 10,
      })
      .then((m) => m)
      .catch((error) => {
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
