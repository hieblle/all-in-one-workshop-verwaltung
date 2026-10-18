import { describe, expect, it } from "vitest";
import { naechsteFaelligkeit } from "./rhythmus";

describe("naechsteFaelligkeit", () => {
  it("jumps to the first Monday of the next month", () => {
    // Monday 5 Oct 2026 → first Monday of November is 2 Nov 2026.
    const naechste = naechsteFaelligkeit(
      new Date(2026, 9, 5, 9),
      "monatlich_erster_montag",
      new Date(2026, 9, 5, 12),
    );
    expect(naechste.getFullYear()).toBe(2026);
    expect(naechste.getMonth()).toBe(10);
    expect(naechste.getDate()).toBe(2);
    expect(naechste.getDay()).toBe(1);
  });

  it("skips periods that already passed when ticked off late", () => {
    const naechste = naechsteFaelligkeit(
      new Date(2026, 0, 10),
      "monatlich",
      new Date(2026, 3, 20),
    );
    expect(naechste.getMonth()).toBe(4);
    expect(naechste.getDate()).toBe(10);
  });

  it("supports weekly, quarterly and yearly rhythms", () => {
    const start = new Date(2026, 0, 1);
    expect(naechsteFaelligkeit(start, "woechentlich", start).getDate()).toBe(8);
    expect(naechsteFaelligkeit(start, "quartalsweise", start).getMonth()).toBe(3);
    expect(naechsteFaelligkeit(start, "jaehrlich", start).getFullYear()).toBe(2027);
  });
});
