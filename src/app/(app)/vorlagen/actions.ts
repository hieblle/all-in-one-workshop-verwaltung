"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { checklistenVorlage, checkpunktVorlage } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import { idSchema, punktFormSchema, vorlageFormSchema } from "@/lib/validation";

export async function createVorlageAction(formData: FormData): Promise<void> {
  await requireTeam();
  const daten = vorlageFormSchema.parse(Object.fromEntries(formData));
  await db
    .insert(checklistenVorlage)
    .values({ name: daten.name, giltFuerType: daten.giltFuerType ?? null });
  revalidatePath("/vorlagen");
}

export async function deleteVorlageAction(vorlageId: number): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(vorlageId);
  // Cascade removes the template items; already instantiated checkpunkte
  // keep existing (they reference checkpunkt_vorlage) — deletion is blocked
  // by the FK in that case, which is intentional.
  await db.delete(checklistenVorlage).where(eq(checklistenVorlage.id, id));
  revalidatePath("/vorlagen");
}

export async function createPunktAction(
  vorlageId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(vorlageId);
  const daten = punktFormSchema.parse(Object.fromEntries(formData));
  await db.insert(checkpunktVorlage).values({
    vorlageId: id,
    titel: daten.titel,
    phase: daten.phase,
    verantwortlichRolle: daten.verantwortlichRolle,
    faelligOffsetTage: daten.faelligOffsetTage,
    autoCheckRegel: daten.autoCheckRegel ?? null,
  });
  revalidatePath("/vorlagen");
}

export async function updatePunktAction(
  punktId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(punktId);
  const daten = punktFormSchema.parse(Object.fromEntries(formData));
  await db
    .update(checkpunktVorlage)
    .set({
      titel: daten.titel,
      phase: daten.phase,
      verantwortlichRolle: daten.verantwortlichRolle,
      faelligOffsetTage: daten.faelligOffsetTage,
      autoCheckRegel: daten.autoCheckRegel ?? null,
    })
    .where(eq(checkpunktVorlage.id, id));
  revalidatePath("/vorlagen");
}

export async function deletePunktAction(punktId: number): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(punktId);
  await db.delete(checkpunktVorlage).where(eq(checkpunktVorlage.id, id));
  revalidatePath("/vorlagen");
}
