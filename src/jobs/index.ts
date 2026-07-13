import { PgBoss } from "pg-boss";
import { sendeErinnerungen } from "./reminders";

const ERINNERUNGS_QUEUE = "checklist-erinnerungen";

const globalForJobs = globalThis as unknown as { boss?: PgBoss };

/**
 * Starts pg-boss and registers the daily reminder job. Requires a real
 * Postgres — in the embedded zero-install dev mode jobs are skipped (pg-boss
 * cannot run on PGlite). Sync failures must never block the app (CLAUDE.md),
 * hence the defensive error handling.
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

    await boss.createQueue(ERINNERUNGS_QUEUE);
    // Daily at 07:00 local server time.
    await boss.schedule(ERINNERUNGS_QUEUE, "0 7 * * *", undefined, {
      tz: "Europe/Vienna",
    });
    await boss.work(ERINNERUNGS_QUEUE, async () => {
      const ergebnis = await sendeErinnerungen();
      console.log(
        `[jobs] Erinnerungen: ${ergebnis.erinnerungen} Mails, ${ergebnis.eskalationen} Eskalationen.`,
      );
    });

    globalForJobs.boss = boss;
    console.log("[jobs] pg-boss gestartet, Erinnerungs-Job registriert (täglich 07:00).");
  } catch (error) {
    // Never block app startup on job infrastructure.
    console.error("[jobs] Start fehlgeschlagen — App läuft ohne Jobs weiter:", error);
  }
}
