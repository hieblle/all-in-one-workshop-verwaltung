"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { kunde } from "@/db/schema";
import { getJetzt } from "@/lib/einstellungen";
import { requireTeam } from "@/lib/session";
import { idSchema, kundeFormSchema } from "@/lib/validation";
import { protokolliereAenderungen } from "@/lib/verlauf";

export async function createKundeAction(formData: FormData): Promise<void> {
  await requireTeam();
  const daten = kundeFormSchema.parse(Object.fromEntries(formData));
  await db.insert(kunde).values({ firma: daten.firma, hubspotId: daten.hubspotId ?? null });
  revalidatePath("/kunden");
}

export async function updateKundeAction(
  kundeId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(kundeId);
  const daten = kundeFormSchema.parse(Object.fromEntries(formData));
  const [vorher] = await db.select().from(kunde).where(eq(kunde.id, id)).limit(1);
  if (!vorher) return;
  const werte = { firma: daten.firma, hubspotId: daten.hubspotId ?? null };
  await db.update(kunde).set(werte).where(eq(kunde.id, id));
  await protokolliereAenderungen(
    { entitaet: "kunde", entitaetId: id, nutzerId: session.user.nutzerId ?? null },
    vorher,
    werte,
  );
  revalidatePath("/kunden");
  revalidatePath("/workshops");
}

// Customers are archived, never deleted — their workshops reference them.
export async function setKundeArchiviertAction(
  kundeId: number,
  archiviert: boolean,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(kundeId);
  await db
    .update(kunde)
    .set({ archiviertAm: archiviert ? await getJetzt() : null })
    .where(eq(kunde.id, id));
  revalidatePath("/kunden");
}
