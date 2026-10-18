import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// Cached on globalThis: dev hot reloads re-evaluate modules and would
// otherwise leak pool connections — or worse, open a second PGlite handle on
// the same data directory.
const globalForDb = globalThis as unknown as { db?: Db; pglite?: PGlite };

function createDb(): Db {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
    // Zero-install dev mode: embedded Postgres (PGlite) in .pglite/, no
    // DATABASE_URL needed. Migrations + seed run via src/instrumentation.ts.
    const client = new PGlite(".pglite");
    globalForDb.pglite = client;
    // The query API is identical to the node-postgres driver for our usage;
    // only the result HKT differs, hence the cast.
    return drizzlePglite(client, { schema }) as unknown as Db;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzlePg(pool, { schema });
}

export const db: Db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export function isEmbeddedDevDb(): boolean {
  return globalForDb.pglite !== undefined;
}
