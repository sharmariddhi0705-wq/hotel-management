/**
 * Disposable MongoDB for local development and testing.
 *
 *   npm run dev:db
 *
 * Starts an in-memory MongoDB on a fixed port and writes its URI to
 * `.env.local`, so `npm run seed` and `npm run dev` work with no MongoDB
 * installation. Data lives in memory and is lost when the process stops — use a
 * real MongoDB (local or Atlas) for anything you want to keep.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.DEV_DB_PORT ?? 27018);
const ENV_FILE = resolve(process.cwd(), ".env.local");

async function main() {
  console.log("Starting in-memory MongoDB…");
  const server = await MongoMemoryServer.create({
    instance: { port: PORT, dbName: "hotel-management" },
  });

  const uri = server.getUri("hotel-management");
  updateEnvFile(uri);

  console.log(`\n  MongoDB ready at ${uri}`);
  console.log("  MONGODB_URI written to .env.local");
  console.log("\n  Next: run `npm run seed`, then `npm run dev` in another terminal.");
  console.log("  Data is in memory only and is lost when this process stops.");
  console.log("  Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    console.log("\nStopping in-memory MongoDB…");
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/** Rewrites MONGODB_URI in .env.local, leaving every other line untouched. */
function updateEnvFile(uri: string) {
  const line = `MONGODB_URI=${uri}`;

  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, `${line}\n`, "utf8");
    return;
  }

  const existing = readFileSync(ENV_FILE, "utf8");
  const next = existing.match(/^MONGODB_URI=.*$/m)
    ? existing.replace(/^MONGODB_URI=.*$/m, line)
    : `${existing.replace(/\n*$/, "\n")}${line}\n`;
  writeFileSync(ENV_FILE, next, "utf8");
}

main().catch((error) => {
  console.error("Could not start the in-memory MongoDB:", error);
  process.exit(1);
});
