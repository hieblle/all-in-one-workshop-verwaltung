import { PgBoss } from "pg-boss";
import { getJetzt } from "@/lib/einstellungen";
import { fuehreTagesjobAus } from "./tagesjob";

const TAGESJOB_QUEUE = "tagesjob";

const globalForJobs = globalThis as unknown as { boss?: PgBoss };

/**
 * Starts pg-boss and registers the daily job. Requires a real Postgres — in
 * the embedded zero-install dev mode (MVP) jobs are skipped because pg-boss
 * cannot run on PGlite; there the admin triggers the run from /system.
 * Job infrastructure must never block the app (CLAUDE.md).
 */
export async function bootstrapJobs(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("[jobs] Skipped — no DATABASE_URL (embedded dev database).");
    return;
  }
  if (globalForJobs.boss) return;

  try {
    const boss = new PgBoss(process.env.DATABASE_URL);
    boss.on("error", (error: Error) =>
      console.error("[jobs] pg-boss error:", error),
    );
    await boss.start();

    await boss.createQueue(TAGESJOB_QUEUE);
    await boss.schedule(TAGESJOB_QUEUE, "0 7 * * *", undefined, {
      tz: "Europe/Vienna",
    });
    await boss.work(TAGESJOB_QUEUE, async () => {
      const ergebnis = await fuehreTagesjobAus(await getJetzt());
      console.log(`[jobs] Tagesjob: ${ergebnis.meldung}`);
    });

    globalForJobs.boss = boss;
    console.log("[jobs] pg-boss gestartet, Tagesjob registriert (täglich 07:00).");
  } catch (error) {
    console.error("[jobs] Start fehlgeschlagen — App läuft ohne Jobs weiter:", error);
  }
}
