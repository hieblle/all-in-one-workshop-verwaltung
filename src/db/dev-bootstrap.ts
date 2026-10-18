import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { db, isEmbeddedDevDb } from "./index";
import type * as schema from "./schema";
import { applySeed } from "./seed-data";

// Boots the zero-install dev database: applies pending migrations from
// ./drizzle and seeds demo data on first run. Called from instrumentation.ts
// before the dev server accepts requests — never in production.
export async function ensureDevDatabase(): Promise<void> {
  if (!isEmbeddedDevDb()) return;

  await migrate(db as unknown as PgliteDatabase<typeof schema>, {
    migrationsFolder: "drizzle",
  });
  const result = await applySeed(db);
  console.log(
    `[dev-db] Embedded database ready (.pglite/) — migrations applied, seed ${result}.`,
  );
}
