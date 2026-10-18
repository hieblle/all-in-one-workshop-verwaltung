"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { aenderung, modul, vorschlag, workshopModul } from "@/db/schema";
import { getJetzt } from "@/lib/einstellungen";
import { requireAdmin, requireTeam } from "@/lib/session";
import { idSchema, modulFormSchema } from "@/lib/validation";
import { protokolliereAenderungen } from "@/lib/verlauf";

function werte(daten: ReturnType<typeof modulFormSchema.parse>) {
  return {
    name: daten.name,
    sharepointUrl: daten.sharepointUrl ?? null,
    beschreibung: daten.beschreibung ?? null,
  };
}

export async function createModulAction(formData: FormData): Promise<void> {
  await requireTeam();
  const daten = modulFormSchema.parse(Object.fromEntries(formData));
  await db.insert(modul).values(werte(daten));
  revalidatePath("/module");
}

export async function updateModulAction(modulId: number, formData: FormData): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(modulId);
  const daten = modulFormSchema.parse(Object.fromEntries(formData));
  const [vorher] = await db.select().from(modul).where(eq(modul.id, id)).limit(1);
  if (!vorher) return;
  await db.update(modul).set(werte(daten)).where(eq(modul.id, id));
  await protokolliereAenderungen(
    { entitaet: "modul", entitaetId: id, nutzerId: session.user.nutzerId ?? null },
    vorher,
    werte(daten),
  );
  revalidatePath("/module");
}

export async function setModulArchiviertAction(
  modulId: number,
  archiviert: boolean,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(modulId);
  await db
    .update(modul)
    .set({ archiviertAm: archiviert ? await getJetzt() : null })
    .where(eq(modul.id, id));
  revalidatePath("/module");
}

/** Admin-only; modules referenced by workshops or the change log are archived instead. */
export async function deleteModulAction(modulId: number): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(modulId);
  const [inWorkshop] = await db
    .select({ id: workshopModul.workshopId })
    .from(workshopModul)
    .where(eq(workshopModul.modulId, id))
    .limit(1);
  const [inVorschlag] = await db
    .select({ id: vorschlag.id })
    .from(vorschlag)
    .where(eq(vorschlag.modulId, id))
    .limit(1);
  const [inAenderung] = await db
    .select({ id: aenderung.id })
    .from(aenderung)
    .where(eq(aenderung.modulId, id))
    .limit(1);
  if (inWorkshop || inVorschlag || inAenderung) redirect("/module?fehler=genutzt");
  await db.delete(modul).where(eq(modul.id, id));
  revalidatePath("/module");
}
