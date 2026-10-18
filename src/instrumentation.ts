// Runs once on server start (Next.js instrumentation hook): prepares the
// embedded dev database in zero-install mode and boots the job queue when a
// real Postgres is configured.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
    const { ensureDevDatabase } = await import("@/db/dev-bootstrap");
    await ensureDevDatabase();
  }

  const { bootstrapJobs } = await import("@/jobs");
  await bootstrapJobs();
}
