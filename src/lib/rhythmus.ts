import type { Rhythmus } from "@/db/schema";

export const RHYTHMUS_LABEL: Record<Rhythmus, string> = {
  woechentlich: "wöchentlich",
  monatlich: "monatlich",
  monatlich_erster_montag: "monatlich, erster Montag",
  quartalsweise: "quartalsweise",
  jaehrlich: "jährlich",
};

function ersterMontag(jahr: number, monat: number, stunde: number): Date {
  const datum = new Date(jahr, monat, 1, stunde, 0, 0, 0);
  while (datum.getDay() !== 1) datum.setDate(datum.getDate() + 1);
  return datum;
}

/**
 * Next due date of a recurring reminder after it was ticked off. Always moves
 * forward from the previous due date, and skips past periods so a reminder
 * ticked off late doesn't immediately fall due again.
 */
export function naechsteFaelligkeit(
  bisher: Date,
  rhythmus: Rhythmus,
  jetzt: Date,
): Date {
  let naechste = new Date(bisher);
  do {
    if (rhythmus === "woechentlich") {
      naechste.setDate(naechste.getDate() + 7);
    } else if (rhythmus === "monatlich_erster_montag") {
      naechste = ersterMontag(
        naechste.getFullYear(),
        naechste.getMonth() + 1,
        naechste.getHours(),
      );
    } else {
      const monate = rhythmus === "monatlich" ? 1 : rhythmus === "quartalsweise" ? 3 : 12;
      naechste.setMonth(naechste.getMonth() + monate);
    }
  } while (naechste <= jetzt);
  return naechste;
}
