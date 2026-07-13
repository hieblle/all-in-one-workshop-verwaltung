import { createHash, randomBytes } from "crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { nutzer, type Nutzer } from "@/db/schema";

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

/**
 * Creates a single-use magic link token for an external trainer account.
 * Returns null if no active trainer account exists for the email — callers
 * must not leak that difference to the client (no user enumeration).
 *
 * Development only: all roles may use the magic link, so the app can be
 * tested as admin/team without an Entra ID app registration.
 */
export async function createMagicLinkToken(
  email: string,
): Promise<{ nutzer: Nutzer; rawToken: string } | null> {
  const nurTrainer =
    process.env.NODE_ENV === "development"
      ? undefined
      : eq(nutzer.rolle, "trainer");
  const [account] = await db
    .select()
    .from(nutzer)
    .where(and(eq(nutzer.email, email.toLowerCase()), nurTrainer))
    .limit(1);

  if (!account) return null;

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
 * Verifies and consumes a magic link token (single use). Returns the nutzer
 * on success, null on unknown/expired token.
 */
export async function verifyMagicLinkToken(
  rawToken: string,
): Promise<Nutzer | null> {
  const [account] = await db
    .select()
    .from(nutzer)
    .where(
      and(
        eq(nutzer.magicLinkToken, hashToken(rawToken)),
        isNotNull(nutzer.magicLinkToken),
      ),
    )
    .limit(1);

  if (!account) return null;

  // Consume the token before checking expiry — a used link is dead either way.
  await db
    .update(nutzer)
    .set({ magicLinkToken: null, magicLinkExpiresAt: null })
    .where(eq(nutzer.id, account.id));

  if (isExpired(account.magicLinkExpiresAt)) return null;

  return account;
}
