import { db } from "@/db";
import { verlauf } from "@/db/schema";
import { formatDatumZeit } from "@/lib/format";

// Change history (SPEC §1): every mutating action records who changed which
// field from what to what. Values are stored as display strings.

type Wert = string | number | boolean | Date | null | undefined;

function alsText(wert: Wert): string | null {
  if (wert === null || wert === undefined || wert === "") return null;
  if (wert instanceof Date) return formatDatumZeit(wert);
  if (typeof wert === "boolean") return wert ? "ja" : "nein";
  return String(wert);
}

interface Kontext {
  entitaet: string;
  entitaetId: number;
  workshopId?: number | null;
  nutzerId: number | null;
}

/** Records one row per field whose value actually changed. */
export async function protokolliereAenderungen<T extends Record<string, Wert>>(
  kontext: Kontext,
  vorher: T,
  nachher: Partial<T>,
): Promise<void> {
  const zeilen = Object.keys(nachher)
    .map((feld) => ({
      feld,
      alt: alsText(vorher[feld]),
      neu: alsText(nachher[feld]),
    }))
    .filter((z) => z.alt !== z.neu)
    .map((z) => ({
      ...z,
      entitaet: kontext.entitaet,
      entitaetId: kontext.entitaetId,
      workshopId: kontext.workshopId ?? null,
      nutzerId: kontext.nutzerId,
    }));
  if (zeilen.length > 0) await db.insert(verlauf).values(zeilen);
}

/** Records a single event such as "angelegt" or "archiviert". */
export async function protokolliereEreignis(
  kontext: Kontext,
  feld: string,
  neu?: Wert,
  alt?: Wert,
): Promise<void> {
  await db.insert(verlauf).values({
    entitaet: kontext.entitaet,
    entitaetId: kontext.entitaetId,
    workshopId: kontext.workshopId ?? null,
    nutzerId: kontext.nutzerId,
    feld,
    alt: alsText(alt),
    neu: alsText(neu),
  });
}
