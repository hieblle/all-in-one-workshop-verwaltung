import { createHash, randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { nutzer, trainer, type Nutzer } from "@/db/schema";

export const MAGIC_LINK_TTL_MINUTES = 30;

// Only the hash is persisted; the raw token travels exclusively in the mail link.
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function magicLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt === null || expiresAt.getTime() <= now.getTime();
}

// Trainer logins require an ACTIVE trainer profile: deactivating the trainer
// record (aktiv = false) is the mechanism to revoke access.
export async function hatAktivesTrainerProfil(nutzerId: number): Promise<boolean> {
  const [aktiv] = await db
    .select({ id: trainer.id })
    .from(trainer)
    .where(and(eq(trainer.nutzerId, nutzerId), eq(trainer.aktiv, true)))
    .limit(1);
  return aktiv !== undefined;
}

/**
 * Creates a single-use magic link token for a trainer account. Returns null
 * if no active trainer account exists for the email — callers must not leak
 * that difference to the client (no user enumeration). The team signs in via
 * Microsoft only (SPEC §3).
 */
export async function createMagicLinkToken(
  email: string,
): Promise<{ nutzer: Nutzer; rawToken: string } | null> {
  const [account] = await db
    .select()
    .from(nutzer)
    .where(and(eq(nutzer.email, email.toLowerCase()), eq(nutzer.rolle, "trainer")))
    .limit(1);

  if (!account || !(await hatAktivesTrainerProfil(account.id))) return null;

  const rawToken = generateRawToken();
  await db
    .update(nutzer)
    .set({
      magicLinkToken: hashToken(rawToken),
      magicLinkExpiresAt: magicLinkExpiry(),
    })
    .where(eq(nutzer.id, account.id));

  return { nutzer: account, rawToken };
}

/**
 * Verifies and consumes a magic link token. A single conditional UPDATE both
 * checks and consumes it, so two parallel clicks can't both succeed.
 * Returns the nutzer on success, null on unknown/expired/revoked.
 */
export async function verifyMagicLinkToken(
  rawToken: string,
): Promise<Nutzer | null> {
  const [account] = await db
    .update(nutzer)
    .set({ magicLinkToken: null, magicLinkExpiresAt: null })
    .where(
      and(
        eq(nutzer.magicLinkToken, hashToken(rawToken)),
        gt(nutzer.magicLinkExpiresAt, new Date()),
      ),
    )
    .returning();

  if (!account) return null;
  if (account.rolle !== "trainer" || !(await hatAktivesTrainerProfil(account.id))) {
    return null;
  }
  return account;
}
