import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

const { berechneFaelligAm, resolveVerantwortlich } = await import("./checklist");

describe("berechneFaelligAm", () => {
  const termin = new Date("2026-09-15T09:00:00");

  it("subtracts days for negative offsets (before the workshop)", () => {
    const faellig = berechneFaelligAm(termin, -14);
    expect(faellig?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("adds days for positive offsets (after the workshop)", () => {
    const faellig = berechneFaelligAm(termin, 3);
    expect(faellig?.toISOString().slice(0, 10)).toBe("2026-09-18");
  });

  it("returns null without termin_1", () => {
    expect(berechneFaelligAm(null, -7)).toBeNull();
  });

  it("does not mutate the input date", () => {
    const original = new Date(termin);
    berechneFaelligAm(termin, -30);
    expect(termin.getTime()).toBe(original.getTime());
  });
});

describe("resolveVerantwortlich", () => {
  it("maps trainer roles to the assigned trainers", () => {
    expect(resolveVerantwortlich("trainer_lead", 7, 9)).toBe(7);
    expect(resolveVerantwortlich("trainer_co", 7, 9)).toBe(9);
  });

  it("returns null when no matching trainer is assigned", () => {
    expect(resolveVerantwortlich("trainer_lead", null, 9)).toBeNull();
  });

  it("leaves team items unassigned for explicit delegation", () => {
    expect(resolveVerantwortlich("team", 7, 9)).toBeNull();
  });
});
