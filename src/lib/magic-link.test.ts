import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

const {
  generateRawToken,
  hashToken,
  isExpired,
  magicLinkExpiry,
  MAGIC_LINK_TTL_MINUTES,
} = await import("./magic-link");

describe("magic-link tokens", () => {
  it("generates unique tokens with enough entropy", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).toHaveLength(64); // 32 bytes hex
    expect(a).not.toEqual(b);
  });

  it("hashes tokens with SHA-256, deterministically", () => {
    const raw = "test-token";
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(hashToken(raw)).toEqual(expected);
    expect(hashToken(raw)).toEqual(hashToken(raw));
    expect(hashToken(raw)).not.toEqual(raw);
  });

  it("sets the expiry to the configured TTL", () => {
    const now = new Date("2026-07-12T10:00:00Z");
    const expiry = magicLinkExpiry(now);
    expect(expiry.getTime() - now.getTime()).toEqual(
      MAGIC_LINK_TTL_MINUTES * 60 * 1000,
    );
  });

  it("treats missing and past expiry as expired, future as valid", () => {
    const now = new Date("2026-07-12T10:00:00Z");
    expect(isExpired(null, now)).toBe(true);
    expect(isExpired(new Date("2026-07-12T09:59:59Z"), now)).toBe(true);
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(new Date("2026-07-12T10:00:01Z"), now)).toBe(false);
  });
});
