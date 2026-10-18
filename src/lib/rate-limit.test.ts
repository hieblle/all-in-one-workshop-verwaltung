import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

const WINDOW = 15 * 60 * 1000;

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows up to the maximum within the window", () => {
    const now = 1_000_000;
    expect(checkRateLimit("k", 3, WINDOW, now)).toBe(true);
    expect(checkRateLimit("k", 3, WINDOW, now + 1)).toBe(true);
    expect(checkRateLimit("k", 3, WINDOW, now + 2)).toBe(true);
    expect(checkRateLimit("k", 3, WINDOW, now + 3)).toBe(false);
  });

  it("frees the budget once the window has passed", () => {
    const now = 1_000_000;
    expect(checkRateLimit("k", 1, WINDOW, now)).toBe(true);
    expect(checkRateLimit("k", 1, WINDOW, now + 10)).toBe(false);
    expect(checkRateLimit("k", 1, WINDOW, now + WINDOW + 11)).toBe(true);
  });

  it("tracks keys independently", () => {
    const now = 1_000_000;
    expect(checkRateLimit("a", 1, WINDOW, now)).toBe(true);
    expect(checkRateLimit("b", 1, WINDOW, now)).toBe(true);
    expect(checkRateLimit("a", 1, WINDOW, now + 1)).toBe(false);
  });
});
