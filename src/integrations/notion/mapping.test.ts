import { describe, expect, it } from "vitest";
import type { NotionPage } from "./client";
import { mapNotionPage, plainValue } from "./mapping";

function page(properties: NotionPage["properties"]): NotionPage {
  return { id: "test-page", properties };
}

describe("plainValue", () => {
  it("extracts title, select, date, number and url values", () => {
    expect(
      plainValue({ type: "title", title: [{ plain_text: "KI-" }, { plain_text: "Workshop" }] }),
    ).toBe("KI-Workshop");
    expect(plainValue({ type: "select", select: { name: "ONLINE" } })).toBe("ONLINE");
    expect(plainValue({ type: "status", status: { name: "Angebot" } })).toBe("Angebot");
    expect(plainValue({ type: "date", date: { start: "2026-09-15" } })).toBe("2026-09-15");
    expect(plainValue({ type: "number", number: 2500 })).toBe("2500");
    expect(plainValue({ type: "url", url: "https://example.com" })).toBe("https://example.com");
  });

  it("returns null for empty or unknown properties", () => {
    expect(plainValue(undefined)).toBeNull();
    expect(plainValue({ type: "select", select: null })).toBeNull();
    expect(plainValue({ type: "rich_text", rich_text: [] })).toBeNull();
    expect(plainValue({ type: "people", people: [] })).toBeNull();
  });
});

describe("mapNotionPage", () => {
  it("maps a complete page without warnings", () => {
    const ergebnis = mapNotionPage(
      page({
        Name: { type: "title", title: [{ plain_text: "KI für Lehrlinge" }] },
        Unternehmen: { type: "rich_text", rich_text: [{ plain_text: "Musterfirma" }] },
        Type: { type: "select", select: { name: "Lehrlinge" } },
        Modus: { type: "select", select: { name: "VOR ORT" } },
        Status: { type: "status", status: { name: "Vorbereitung" } },
        "Termin 1": { type: "date", date: { start: "2026-09-15T09:00:00.000+02:00" } },
        "WS Betrag": { type: "number", number: 2500 },
      }),
    );

    expect(ergebnis.warnungen).toEqual([]);
    expect(ergebnis.firma).toBe("Musterfirma");
    expect(ergebnis.workshop.name).toBe("KI für Lehrlinge");
    expect(ergebnis.workshop.type).toBe("Lehrlinge");
    expect(ergebnis.workshop.status).toBe("Vorbereitung");
    expect(ergebnis.workshop.termin1).toBeInstanceOf(Date);
    expect(ergebnis.workshop.wsBetrag).toBe("2500");
  });

  it("collects warnings for unknown enum values and missing type", () => {
    const ergebnis = mapNotionPage(
      page({
        Name: { type: "title", title: [{ plain_text: "Test" }] },
        Type: { type: "select", select: { name: "Gibt es nicht" } },
        Status: { type: "status", status: { name: "Erledigt?" } },
      }),
    );

    expect(ergebnis.warnungen.join(" ")).toContain("Type");
    expect(ergebnis.warnungen.join(" ")).toContain("übersprungen");
    expect(ergebnis.workshop.status).toBe("Vorabstimmung"); // fallback
  });
});
