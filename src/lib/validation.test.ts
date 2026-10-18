import { describe, expect, it } from "vitest";
import {
  magicLinkRequestSchema,
  workshopFilterSchema,
  workshopFormSchema,
} from "./validation";

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

describe("workshopFormSchema", () => {
  const basis = {
    name: "KI-Workshop",
    type: "Lehrlinge",
    status: "Vorabstimmung",
    kundeId: "3",
  };

  it("parses a minimal valid form", () => {
    const ergebnis = workshopFormSchema.safeParse(basis);
    expect(ergebnis.success).toBe(true);
    if (ergebnis.success) {
      expect(ergebnis.data.kundeId).toBe(3);
    }
  });

  it("treats empty strings from FormData as undefined", () => {
    const ergebnis = workshopFormSchema.safeParse({
      ...basis,
      format: "",
      termin1: "",
      wsBetrag: "",
      sharepointUrl: "",
    });
    expect(ergebnis.success).toBe(true);
    if (ergebnis.success) {
      expect(ergebnis.data.format).toBeUndefined();
      expect(ergebnis.data.termin1).toBeUndefined();
      expect(ergebnis.data.wsBetrag).toBeUndefined();
    }
  });

  it("requires either kundeId or neueFirma", () => {
    expect(
      workshopFormSchema.safeParse({ ...basis, kundeId: "" }).success,
    ).toBe(false);
    expect(
      workshopFormSchema.safeParse({ ...basis, kundeId: "", neueFirma: "Neu GmbH" })
        .success,
    ).toBe(true);
  });

  it("normalizes German decimal commas in the amount", () => {
    const ergebnis = workshopFormSchema.safeParse({
      ...basis,
      wsBetrag: "2500,50",
    });
    expect(ergebnis.success).toBe(true);
    if (ergebnis.success) expect(ergebnis.data.wsBetrag).toBe("2500.50");
  });

  it("rejects unknown enum values and invalid URLs", () => {
    expect(
      workshopFormSchema.safeParse({ ...basis, type: "Quatsch" }).success,
    ).toBe(false);
    expect(
      workshopFormSchema.safeParse({ ...basis, sharepointUrl: "kein-link" })
        .success,
    ).toBe(false);
  });
});

describe("workshopFormSchema — Termine", () => {
  const basis = { name: "Test", neueFirma: "Firma", type: "Beratung" };

  it("defaults a date to 09:00–17:00", () => {
    const d = workshopFormSchema.parse({ ...basis, termin1: "2026-11-03" });
    expect(d.termin1?.getHours()).toBe(9);
    expect(d.termin1Ende?.getHours()).toBe(17);
    expect(d.termin1Ende?.getDate()).toBe(3);
  });

  it("takes explicit start and end times", () => {
    const d = workshopFormSchema.parse({
      ...basis,
      termin2: "2026-11-04",
      termin2Von: "13:30",
      termin2Bis: "16:00",
    });
    expect(d.termin2?.getHours()).toBe(13);
    expect(d.termin2?.getMinutes()).toBe(30);
    expect(d.termin2Ende?.getHours()).toBe(16);
  });

  it("ignores times without a date", () => {
    const d = workshopFormSchema.parse({ ...basis, termin1: "", termin1Von: "09:00" });
    expect(d.termin1).toBeUndefined();
    expect(d.termin1Ende).toBeUndefined();
  });

  it("rejects an end before the start", () => {
    const r = workshopFormSchema.safeParse({
      ...basis,
      termin1: "2026-11-03",
      termin1Von: "15:00",
      termin1Bis: "10:00",
    });
    expect(r.success).toBe(false);
  });
});

describe("workshopFilterSchema", () => {
  it("defaults to the list view with no filters", () => {
    const ergebnis = workshopFilterSchema.parse({});
    expect(ergebnis.ansicht).toBe("liste");
    expect(ergebnis.status).toBeUndefined();
  });

  it("parses filter values from search params", () => {
    const ergebnis = workshopFilterSchema.parse({
      status: "Vorbereitung",
      trainer: "2",
      von: "2026-09-01",
      ansicht: "board",
    });
    expect(ergebnis.status).toBe("Vorbereitung");
    expect(ergebnis.trainer).toBe(2);
    expect(ergebnis.von).toBeInstanceOf(Date);
    expect(ergebnis.ansicht).toBe("board");
  });
});
