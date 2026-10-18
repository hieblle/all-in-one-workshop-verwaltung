"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { wiederkehrendeErinnerung } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { erinnerungFormSchema, idSchema } from "@/lib/validation";

function werte(daten: ReturnType<typeof erinnerungFormSchema.parse>) {
  return {
    titel: daten.titel,
    rhythmus: daten.rhythmus,
    naechsteFaelligkeit: daten.naechsteFaelligkeit,
    empfaengerId: daten.empfaengerId,
    link: daten.link ?? null,
    notiz: daten.notiz ?? null,
  };
}

export async function createErinnerungAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const daten = erinnerungFormSchema.parse(Object.fromEntries(formData));
  await db.insert(wiederkehrendeErinnerung).values(werte(daten));
  revalidatePath("/erinnerungen");
  revalidatePath("/");
}

export async function updateErinnerungAction(
  erinnerungId: number,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(erinnerungId);
  const daten = erinnerungFormSchema.parse(Object.fromEntries(formData));
  await db
    .update(wiederkehrendeErinnerung)
    .set(werte(daten))
    .where(eq(wiederkehrendeErinnerung.id, id));
  revalidatePath("/erinnerungen");
  revalidatePath("/");
}

export async function setErinnerungAktivAction(
  erinnerungId: number,
  aktiv: boolean,
): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(erinnerungId);
  await db
    .update(wiederkehrendeErinnerung)
    .set({ aktiv })
    .where(eq(wiederkehrendeErinnerung.id, id));
  revalidatePath("/erinnerungen");
  revalidatePath("/");
}

export async function deleteErinnerungAction(erinnerungId: number): Promise<void> {
  await requireAdmin();
  const id = idSchema.parse(erinnerungId);
  await db.delete(wiederkehrendeErinnerung).where(eq(wiederkehrendeErinnerung.id, id));
  revalidatePath("/erinnerungen");
  revalidatePath("/");
}
