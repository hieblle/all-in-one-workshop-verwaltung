import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse the pool across hot reloads in dev — Next.js re-evaluates modules on
// every change and would otherwise leak connections.
const globalForDb = globalThis as unknown as { dbPool?: Pool };

const pool =
  globalForDb.dbPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbPool = pool;
}

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
