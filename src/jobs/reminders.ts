import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  checkpunkt,
  checkpunktVorlage,
  nutzer,
  trainer,
  workshop,
  zuweisung,
} from "@/db/schema";
import { sendMail } from "@/integrations/graph/mail";
import { formatDatum } from "@/lib/format";

export const ESKALATION_NACH_TAGEN = 2;

interface FaelligerPunkt {
  titel: string;
  faelligAm: Date | null;
  workshopId: number;
  workshopName: string;
  verantwortlichName: string | null;
  verantwortlichEmail: string | null;
}

export function istEskalationsfall(
  faelligAm: Date | null,
  now: Date,
  eskalationNachTagen: number = ESKALATION_NACH_TAGEN,
): boolean {
  if (!faelligAm) return false;
  const grenze = new Date(faelligAm);
  grenze.setDate(grenze.getDate() + eskalationNachTagen);
  return now > grenze;
}

/**
 * Daily reminder run (F1): mails every responsible user a digest of their due
 * open items; items overdue by more than ESKALATION_NACH_TAGEN days are
 * additionally escalated to the workshop's lead trainer. Until the Graph
 * admin consent lands (Phase 2), sendMail logs instead of sending.
 */
export async function sendeErinnerungen(now: Date = new Date()): Promise<{
  erinnerungen: number;
  eskalationen: number;
}> {
  const faellige: FaelligerPunkt[] = await db
    .select({
      titel: checkpunktVorlage.titel,
      faelligAm: checkpunkt.faelligAm,
      workshopId: workshop.id,
      workshopName: workshop.name,
      verantwortlichName: nutzer.name,
      verantwortlichEmail: nutzer.email,
    })
    .from(checkpunkt)
    .innerJoin(
      checkpunktVorlage,
      eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id),
    )
    .innerJoin(workshop, eq(checkpunkt.workshopId, workshop.id))
    .leftJoin(nutzer, eq(checkpunkt.verantwortlichUserId, nutzer.id))
    .where(and(eq(checkpunkt.status, "offen"), lte(checkpunkt.faelligAm, now)));

  // Digest per responsible user.
  const proNutzer = new Map<string, FaelligerPunkt[]>();
  for (const punkt of faellige) {
    if (!punkt.verantwortlichEmail) continue;
    const liste = proNutzer.get(punkt.verantwortlichEmail) ?? [];
    liste.push(punkt);
    proNutzer.set(punkt.verantwortlichEmail, liste);
  }

  let erinnerungen = 0;
  for (const [email, punkte] of proNutzer) {
    const zeilen = punkte.map(
      (p) =>
        `• ${p.titel} — Workshop „${p.workshopName}", fällig ${formatDatum(p.faelligAm)}`,
    );
    await sendMail({
      to: email,
      subject: `Workshop-Hub: ${punkte.length} fällige Checklistenpunkte`,
      text: `Hallo ${punkte[0].verantwortlichName},\n\nfolgende Checklistenpunkte sind fällig oder überfällig:\n\n${zeilen.join("\n")}\n\nBitte im Workshop-Hub erledigen oder delegieren.`,
    });
    erinnerungen++;
  }

  // Escalation to the lead trainer per workshop.
  const eskalationsPunkte = faellige.filter((p) =>
    istEskalationsfall(p.faelligAm, now),
  );
  const proWorkshop = new Map<number, FaelligerPunkt[]>();
  for (const punkt of eskalationsPunkte) {
    const liste = proWorkshop.get(punkt.workshopId) ?? [];
    liste.push(punkt);
    proWorkshop.set(punkt.workshopId, liste);
  }

  let eskalationen = 0;
  for (const [workshopId, punkte] of proWorkshop) {
    const [lead] = await db
      .select({ email: trainer.email, name: trainer.name })
      .from(zuweisung)
      .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
      .where(
        and(eq(zuweisung.workshopId, workshopId), eq(zuweisung.rolle, "lead")),
      )
      .limit(1);
    if (!lead) {
      console.warn(
        `[jobs] Eskalation für Workshop ${workshopId} ohne Lead — übersprungen.`,
      );
      continue;
    }
    const zeilen = punkte.map(
      (p) =>
        `• ${p.titel} — fällig ${formatDatum(p.faelligAm)} (${p.verantwortlichName ?? "niemand zugewiesen"})`,
    );
    await sendMail({
      to: lead.email,
      subject: `Workshop-Hub: Überfällige Punkte in „${punkte[0].workshopName}"`,
      text: `Hallo ${lead.name},\n\nin deinem Workshop „${punkte[0].workshopName}" sind Punkte seit mehr als ${ESKALATION_NACH_TAGEN} Tagen überfällig:\n\n${zeilen.join("\n")}\n\nBitte nachfassen.`,
    });
    eskalationen++;
  }

  return { erinnerungen, eskalationen };
}
