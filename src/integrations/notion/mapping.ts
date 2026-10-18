import {
  workshopFormatEnum,
  workshopModusEnum,
  workshopStatusEnum,
  workshopTypeEnum,
  type NeuerWorkshop,
} from "@/db/schema";
import type { NotionPage, NotionProperty } from "./client";

// Notion property names of the "Workshop Liste" database. Adjust here if the
// column names in Notion differ.
export const PROPERTY_MAP = {
  name: "Name",
  unternehmen: "Unternehmen",
  ansprechperson: "Ansprechperson",
  type: "Type",
  format: "Format",
  modus: "Modus",
  status: "Status",
  termin1: "Termin 1",
  termin2: "Termin 2",
  terminFup: "Termin FUP",
  wsBetrag: "WS Betrag",
  sharepointUrl: "SharePoint",
  slidedeck: "verwendetes Slidedeck",
} as const;

// Tolerant plain-value extraction across the Notion property types the
// template actually uses.
export function plainValue(prop: NotionProperty | undefined): string | null {
  if (!prop) return null;
  switch (prop.type) {
    case "title":
    case "rich_text": {
      const teile = prop[prop.type] as { plain_text: string }[];
      const text = teile.map((t) => t.plain_text).join("").trim();
      return text || null;
    }
    case "select":
    case "status": {
      const wert = prop[prop.type] as { name: string } | null;
      return wert?.name ?? null;
    }
    case "multi_select": {
      const werte = prop.multi_select as { name: string }[];
      return werte[0]?.name ?? null;
    }
    case "date": {
      const wert = prop.date as { start: string } | null;
      return wert?.start ?? null;
    }
    case "number": {
      const wert = prop.number as number | null;
      return wert === null ? null : String(wert);
    }
    case "url":
      return (prop.url as string | null) ?? null;
    case "email":
      return (prop.email as string | null) ?? null;
    default:
      return null;
  }
}

function alsDatum(wert: string | null): Date | null {
  if (!wert) return null;
  const datum = new Date(wert);
  return Number.isNaN(datum.getTime()) ? null : datum;
}

function alsEnum<T extends string>(
  wert: string | null,
  erlaubt: readonly T[],
  feld: string,
  warnungen: string[],
): T | null {
  if (!wert) return null;
  const treffer = erlaubt.find((e) => e === wert.trim());
  if (!treffer) {
    warnungen.push(`${feld}: unbekannter Wert "${wert}"`);
    return null;
  }
  return treffer;
}

export interface GemappterWorkshop {
  firma: string | null;
  workshop: Omit<NeuerWorkshop, "unternehmenId">;
  warnungen: string[];
}

export function mapNotionPage(page: NotionPage): GemappterWorkshop {
  const warnungen: string[] = [];
  const p = (key: keyof typeof PROPERTY_MAP) =>
    plainValue(page.properties[PROPERTY_MAP[key]]);

  const name = p("name");
  if (!name) warnungen.push("Name fehlt");

  const type = alsEnum(
    p("type"),
    workshopTypeEnum.enumValues,
    "Type",
    warnungen,
  );
  if (!type) warnungen.push("Type fehlt oder unbekannt — Zeile wird übersprungen");

  // Notion combines "On-Hold/Abgesagt"; the hub splits it (SPEC §6) — an
  // imported row lands on On-Hold and the team decides per workshop.
  const statusRoh = p("status");
  const status =
    alsEnum(
      statusRoh === "On-Hold/Abgesagt" ? "On-Hold" : statusRoh,
      workshopStatusEnum.enumValues,
      "Status",
      warnungen,
    ) ?? "Vorabstimmung";

  const betragRoh = p("wsBetrag");

  return {
    firma: p("unternehmen"),
    workshop: {
      name: name ?? "(ohne Namen)",
      ansprechperson: p("ansprechperson"),
      type: type ?? "Maßgeschneiderter Workshop",
      format: alsEnum(
        p("format"),
        workshopFormatEnum.enumValues,
        "Format",
        warnungen,
      ),
      modus: alsEnum(
        p("modus"),
        workshopModusEnum.enumValues,
        "Modus",
        warnungen,
      ),
      status,
      termin1: alsDatum(p("termin1")),
      termin2: alsDatum(p("termin2")),
      terminFup: alsDatum(p("terminFup")),
      wsBetrag: betragRoh,
      sharepointUrl: p("sharepointUrl"),
      verwendetesSlidedeck: p("slidedeck"),
    },
    warnungen,
  };
}
