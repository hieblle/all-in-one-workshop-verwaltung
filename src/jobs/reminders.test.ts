import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/integrations/graph/mail", () => ({ sendMail: vi.fn() }));

const { istEskalationsfall } = await import("./reminders");

describe("istEskalationsfall", () => {
  const now = new Date("2026-09-10T08:00:00");

  it("does not escalate items due less than 2 days ago", () => {
    expect(istEskalationsfall(new Date("2026-09-09"), now)).toBe(false);
    expect(istEskalationsfall(new Date("2026-09-08T08:00:00"), now)).toBe(false);
  });

  it("escalates items overdue by more than 2 days", () => {
    expect(istEskalationsfall(new Date("2026-09-07T07:00:00"), now)).toBe(true);
    expect(istEskalationsfall(new Date("2026-08-01"), now)).toBe(true);
  });

  it("never escalates items without a due date", () => {
    expect(istEskalationsfall(null, now)).toBe(false);
  });
});
