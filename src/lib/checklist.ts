import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistenVorlage,
  checkpunkt,
  checkpunktVorlage,
  trainer,
  workshop,
  zuweisung,
  type WorkshopStatus,
} from "@/db/schema";

// Due date relative to termin_1; negative offsets mean "days before".
export function berechneFaelligAm(
  termin1: Date | null,
  offsetTage: number,
): Date | null {
  if (!termin1) return null;
  const faellig = new Date(termin1);
  faellig.setDate(faellig.getDate() + offsetTage);
  return faellig;
}

export function resolveVerantwortlich(
  rolle: "team" | "trainer_lead" | "trainer_co",
  leadNutzerId: number | null,
  coNutzerId: number | null,
): number | null {
  if (rolle === "trainer_lead") return leadNutzerId;
  if (rolle === "trainer_co") return coNutzerId;
  return null; // team items start unassigned; the team delegates explicitly
}

/**
 * Instantiates all template items for a workshop phase (called on workshop
 * creation and every status change). Idempotent: the unique index on
 * (workshop_id, vorlage_punkt_id) makes re-entering a phase a no-op.
 */
export async function instanziiereCheckpunkte(
  workshopId: number,
  phase: WorkshopStatus,
): Promise<number> {
  const [ws] = await db
    .select({ type: workshop.type, termin1: workshop.termin1 })
    .from(workshop)
    .where(eq(workshop.id, workshopId))
    .limit(1);
  if (!ws) return 0;

  const punkte = await db
    .select({
      id: checkpunktVorlage.id,
      offsetTage: checkpunktVorlage.faelligOffsetTage,
      rolle: checkpunktVorlage.verantwortlichRolle,
    })
    .from(checkpunktVorlage)
    .innerJoin(
      checklistenVorlage,
      eq(checkpunktVorlage.vorlageId, checklistenVorlage.id),
    )
    .where(
      and(
        eq(checkpunktVorlage.phase, phase),
        or(
          isNull(checklistenVorlage.giltFuerType),
          eq(checklistenVorlage.giltFuerType, ws.type),
        ),
      ),
    );
  if (punkte.length === 0) return 0;

  const zuweisungen = await db
    .select({ rolle: zuweisung.rolle, nutzerId: trainer.nutzerId })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(eq(zuweisung.workshopId, workshopId));
  const leadNutzerId =
    zuweisungen.find((z) => z.rolle === "lead")?.nutzerId ?? null;
  const coNutzerId = zuweisungen.find((z) => z.rolle === "co")?.nutzerId ?? null;

  const inserted = await db
    .insert(checkpunkt)
    .values(
      punkte.map((p) => ({
        workshopId,
        vorlagePunktId: p.id,
        faelligAm: berechneFaelligAm(ws.termin1, p.offsetTage),
        verantwortlichUserId: resolveVerantwortlich(
          p.rolle,
          leadNutzerId,
          coNutzerId,
        ),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: checkpunkt.id });
  return inserted.length;
}

/**
 * Recomputes due dates of OPEN items after termin_1 changed. Completed and
 * skipped items keep their historical dates.
 */
export async function aktualisiereFaelligkeiten(
  workshopId: number,
): Promise<void> {
  const [ws] = await db
    .select({ termin1: workshop.termin1 })
    .from(workshop)
    .where(eq(workshop.id, workshopId))
    .limit(1);
  if (!ws) return;

  const offene = await db
    .select({
      id: checkpunkt.id,
      offsetTage: checkpunktVorlage.faelligOffsetTage,
    })
    .from(checkpunkt)
    .innerJoin(
      checkpunktVorlage,
      eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id),
    )
    .where(
      and(eq(checkpunkt.workshopId, workshopId), eq(checkpunkt.status, "offen")),
    );

  for (const punkt of offene) {
    await db
      .update(checkpunkt)
      .set({ faelligAm: berechneFaelligAm(ws.termin1, punkt.offsetTage) })
      .where(eq(checkpunkt.id, punkt.id));
  }
}
