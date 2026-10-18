import type { WorkshopModus, WorkshopStatus } from "@/db/schema";

// Offer accepted → the workshop is fixed (calendar entry final, SPEC §6).
export const FIXIERTE_STATUS: WorkshopStatus[] = [
  "Vorbereitung",
  "Durchführung",
  "Nachbereitung",
  "Done",
];

// Workshops in these states produce no reminders and no trainer mails.
export const INAKTIVE_STATUS: WorkshopStatus[] = ["On-Hold", "Abgesagt"];

export function istFixiert(status: WorkshopStatus): boolean {
  return FIXIERTE_STATUS.includes(status);
}

export function istInaktiv(status: WorkshopStatus): boolean {
  return INAKTIVE_STATUS.includes(status);
}

export type ModusKategorie = "online" | "praesenz";

export function modusKategorie(
  modus: WorkshopModus | null,
): ModusKategorie | null {
  if (modus === null) return null;
  return modus === "ONLINE" || modus === "Webex" ? "online" : "praesenz";
}

// The last delivery date; "after the workshop" is measured from here.
export function letzterTermin(ws: {
  termin1: Date | null;
  termin2: Date | null;
}): Date | null {
  if (ws.termin1 && ws.termin2) {
    return ws.termin2 > ws.termin1 ? ws.termin2 : ws.termin1;
  }
  return ws.termin1 ?? ws.termin2;
}

export function plusTage(datum: Date, tage: number): Date {
  const neu = new Date(datum);
  neu.setDate(neu.getDate() + tage);
  return neu;
}

export function tagesende(datum: Date): Date {
  const ende = new Date(datum);
  ende.setHours(23, 59, 59, 999);
  return ende;
}

export function tagesSchluessel(datum: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${datum.getFullYear()}-${pad(datum.getMonth() + 1)}-${pad(datum.getDate())}`;
}

export const STANDARD_BEGINN = "09:00";
export const STANDARD_ENDE = "17:00";

// Fallback for dates without an end time (e.g. imported from Notion):
// 17:00 the same day, or one hour after a late start.
export function terminEnde(start: Date, ende: Date | null): Date {
  if (ende && ende > start) return ende;
  const standard = new Date(start);
  standard.setHours(17, 0, 0, 0);
  return standard > start ? standard : new Date(start.getTime() + 3_600_000);
}
