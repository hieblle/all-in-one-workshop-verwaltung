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
