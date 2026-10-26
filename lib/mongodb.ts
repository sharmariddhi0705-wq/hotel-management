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
        /**
         * Passed explicitly rather than relying on the URI path. An Atlas
         * connection string copied from the dashboard ends at the host
         * (`…mongodb.net`) with no database, and Mongoose would silently use
         * `test` — so the app would appear to work while reading and writing
         * the wrong database.
         */
        dbName,
        /**
         * Below Vercel's 10s serverless limit, so a blocked connection returns
         * the app's own JSON error instead of a platform timeout.
         */
        serverSelectionTimeoutMS: 8_000,
        maxPoolSize: 10,
      })
      .then((m) => m)
      .catch((error: unknown) => {
        // Drop the rejected promise so the next request retries the connection.
        cached.promise = null;
        logConnectionDiagnostic(error, MONGODB_URI);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/**
 * Explains a failed connection in the server log.
 *
 * Server selection failures are almost always environmental rather than a bug,
 * and the three causes below account for nearly all of them. The client only
 * ever sees the generic "cannot reach the database" message; this detail stays
 * server-side.
 */
function logConnectionDiagnostic(error: unknown, uri: string): void {
  const name = (error as { name?: string })?.name ?? "";
  if (name !== "MongooseServerSelectionError" && name !== "MongoServerSelectionError") {
    return;
  }

  const redacted = uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
  console.error(
    [
      "[mongodb] Could not reach the cluster.",
      `  URI        : ${redacted}`,
      "  Check, in order:",
      "   1. Atlas > Network Access allows this server's IP.",
      "      Serverless hosts (Vercel, Netlify) use dynamic IPs, so they need 0.0.0.0/0.",
      "   2. Atlas > Database Access has this user with read/write on the database.",
      "   3. The password is URL-encoded if it contains @ : / ? # [ ] or %.",
    ].join("\n"),
  );
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
