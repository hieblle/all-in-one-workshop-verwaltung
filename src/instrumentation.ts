// Runs once on server start (Next.js instrumentation hook). Used to prepare
// the embedded dev database in zero-install mode; a real DATABASE_URL skips
// this entirely.
export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    !process.env.DATABASE_URL &&
    process.env.NODE_ENV !== "production"
  ) {
    const { ensureDevDatabase } = await import("@/db/dev-bootstrap");
    await ensureDevDatabase();
  }
}
