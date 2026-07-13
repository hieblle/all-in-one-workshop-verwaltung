import type { WorkshopStatus } from "@/db/schema";

export function formatDatum(datum: Date | null): string {
  if (!datum) return "–";
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(datum);
}

export function formatDatumZeit(datum: Date | null): string {
  if (!datum) return "–";
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(datum);
}

export function formatBetrag(betrag: string | null): string {
  if (!betrag) return "–";
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(betrag));
}

// Value for <input type="datetime-local"> in local time (toISOString would
// shift by the timezone offset).
export function zuInputWert(datum: Date | null): string {
  if (!datum) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${datum.getFullYear()}-${pad(datum.getMonth() + 1)}-${pad(datum.getDate())}T${pad(datum.getHours())}:${pad(datum.getMinutes())}`;
}

export function tageBisLabel(datum: Date | null, now: Date = new Date()): string {
  if (!datum) return "ohne Termin";
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const ziel = new Date(datum);
  ziel.setHours(0, 0, 0, 0);
  const tage = Math.round((ziel.getTime() - start.getTime()) / 86_400_000);
  if (tage === 0) return "heute";
  if (tage === 1) return "morgen";
  if (tage === -1) return "gestern";
  if (tage < 0) return `vor ${-tage} Tagen`;
  return `in ${tage} Tagen`;
}

// Board column order mirrors the process flow from the Notion template.
export const STATUS_REIHENFOLGE: WorkshopStatus[] = [
  "Vorabstimmung",
  "Angebot",
  "Vorbereitung",
  "Durchführung",
  "Nachbereitung",
  "Done",
  "On-Hold/Abgesagt",
];

export const STATUS_FARBEN: Record<WorkshopStatus, string> = {
  Vorabstimmung: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Angebot: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Vorbereitung:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Durchführung:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Nachbereitung: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  "On-Hold/Abgesagt":
    "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  Done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};
