"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { kunde } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import { idSchema, kundeFormSchema } from "@/lib/validation";

export async function createKundeAction(formData: FormData): Promise<void> {
  await requireTeam();
  const daten = kundeFormSchema.parse(Object.fromEntries(formData));
  await db.insert(kunde).values({ firma: daten.firma });
  revalidatePath("/kunden");
}

export async function updateKundeAction(
  kundeId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(kundeId);
  const daten = kundeFormSchema.parse(Object.fromEntries(formData));
  await db.update(kunde).set({ firma: daten.firma }).where(eq(kunde.id, id));
  revalidatePath("/kunden");
  revalidatePath("/workshops");
}
