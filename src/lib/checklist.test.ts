import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

const { berechneFaelligAm, regelErfuellt, resolveVerantwortlich } = await import("./checklist");

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
  const v = { teamId: 3, leadId: 7, coId: 9 };

  it("maps trainer roles to the confirmed trainers", () => {
    expect(resolveVerantwortlich("trainer_lead", v)).toBe(7);
    expect(resolveVerantwortlich("trainer_co", v)).toBe(9);
  });

  it("returns null when no matching trainer is confirmed", () => {
    expect(resolveVerantwortlich("trainer_lead", { ...v, leadId: null })).toBeNull();
  });

  it("gives team tasks to the verantwortlich intern (null → service@)", () => {
    expect(resolveVerantwortlich("team", v)).toBe(3);
    expect(resolveVerantwortlich("team", { ...v, teamId: null })).toBeNull();
  });
});

describe("regelErfuellt", () => {
  const leer = { termin1: null, hatTrainer: false, hatPraesentation: false, fixiert: false };

  it("ticks off tasks once the data proves them done", () => {
    expect(regelErfuellt("termin_eingetragen", { ...leer, termin1: new Date() })).toBe(true);
    expect(regelErfuellt("trainer_zugewiesen", { ...leer, hatTrainer: true })).toBe(true);
    expect(regelErfuellt("praesentation_eingetragen", { ...leer, hatPraesentation: true })).toBe(true);
    expect(regelErfuellt("angebot_angenommen", { ...leer, fixiert: true })).toBe(true);
  });

  it("keeps tasks open without the data", () => {
    expect(regelErfuellt("termin_eingetragen", leer)).toBe(false);
    expect(regelErfuellt("angebot_angenommen", leer)).toBe(false);
  });
});
