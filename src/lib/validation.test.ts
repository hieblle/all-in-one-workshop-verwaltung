import { describe, expect, it } from "vitest";
import { magicLinkRequestSchema } from "./validation";

describe("magicLinkRequestSchema", () => {
  it("accepts a valid email", () => {
    expect(
      magicLinkRequestSchema.safeParse({ email: "trainer@example.com" })
        .success,
    ).toBe(true);
  });

  it("rejects invalid payloads", () => {
    expect(magicLinkRequestSchema.safeParse({ email: "kein-email" }).success).toBe(false);
    expect(magicLinkRequestSchema.safeParse({}).success).toBe(false);
    expect(magicLinkRequestSchema.safeParse(null).success).toBe(false);
  });
});
