"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { checklistenVorlage, checkpunkt, checkpunktVorlage, workshop } from "@/db/schema";
import { synchronisiereCheckliste } from "@/lib/checklist";
import { getJetzt } from "@/lib/einstellungen";
import { requireAdmin } from "@/lib/session";
import { idSchema, punktFormSchema, vorlageFormSchema } from "@/lib/validation";

// Template changes apply to all running workshops right away (SPEC §4:
// the admin refines the list without code).
async function synchronisiereLaufendeWorkshops(): Promise<void> {
  const jetzt = await getJetzt();
  const laufende = await db
    .select({ id: workshop.id })
    .from(workshop)
    .where(and(isNull(workshop.archiviertAm), ne(workshop.status, "Done")));
  for (const ws of laufende) {
    await synchronisiereCheckliste(ws.id, jetzt);
  }
}

function punktWerte(daten: ReturnType<typeof punktFormSchema.parse>) {
  return {
    titel: daten.titel,
    phase: daten.phase,
    verantwortlichRolle: daten.verantwortlichRolle,
    faelligOffsetTage: daten.faelligOffsetTage,
    reihenfolge: daten.reihenfolge,
    autoCheckRegel: daten.autoCheckRegel ?? null,
    nurModus: daten.nurModus ?? null,
    linkFeld: daten.linkFeld ?? null,
  };
}

export async function createVorlageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const daten = vorlageFormSchema.parse(Object.fromEntries(formData));
  await db
    .insert(checklistenVorlage)
    .values({ name: daten.name, giltFuerType: daten.giltFuerType ?? null });
  revalidatePath("/vorlagen");
}

export async function createPunktAction(
  vorlageId: number,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(vorlageId);
  const daten = punktFormSchema.parse(Object.fromEntries(formData));
  await db.insert(checkpunktVorlage).values({ vorlageId: id, ...punktWerte(daten) });
  await synchronisiereLaufendeWorkshops();
  revalidatePath("/vorlagen");
}

export async function updatePunktAction(
  punktId: number,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(punktId);
  const daten = punktFormSchema.parse(Object.fromEntries(formData));
  await db.update(checkpunktVorlage).set(punktWerte(daten)).where(eq(checkpunktVorlage.id, id));
  // Titles come from the template (coalesce); due dates follow the new offset.
  await synchronisiereLaufendeWorkshops();
  revalidatePath("/vorlagen");
}

/**
 * Removes a template task. Open instances disappear; completed or skipped
 * ones are kept as ad-hoc tasks so the history of past workshops survives.
 */
export async function deletePunktAction(punktId: number): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(punktId);
  const [punkt] = await db
    .select()
    .from(checkpunktVorlage)
    .where(eq(checkpunktVorlage.id, id))
    .limit(1);
  if (!punkt) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(checkpunkt)
      .where(and(eq(checkpunkt.vorlagePunktId, id), eq(checkpunkt.status, "offen")));
    await tx
      .update(checkpunkt)
      .set({ vorlagePunktId: null, titel: punkt.titel, phase: punkt.phase })
      .where(
        and(eq(checkpunkt.vorlagePunktId, id), inArray(checkpunkt.status, ["erledigt", "uebersprungen"])),
      );
    await tx.delete(checkpunktVorlage).where(eq(checkpunktVorlage.id, id));
  });
  revalidatePath("/vorlagen");
}

export async function deleteVorlageAction(vorlageId: number): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(vorlageId);
  const punkte = await db
    .select({ id: checkpunktVorlage.id })
    .from(checkpunktVorlage)
    .where(eq(checkpunktVorlage.vorlageId, id));
  for (const p of punkte) {
    await deletePunktAction(p.id);
  }
  await db.delete(checklistenVorlage).where(eq(checklistenVorlage.id, id));
  revalidatePath("/vorlagen");
}
