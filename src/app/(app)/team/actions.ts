"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { nutzer, trainer } from "@/db/schema";
import { AccessDeniedError } from "@/lib/access";
import { requireSession, requireTeam } from "@/lib/session";
import {
  idSchema,
  nutzerFormSchema,
  trainerFormSchema,
  trainerUpdateFormSchema,
} from "@/lib/validation";

function istUniqueVerletzung(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function createTrainerAction(formData: FormData): Promise<void> {
  await requireTeam();
  const daten = trainerFormSchema.parse(Object.fromEntries(formData));

  try {
    let nutzerId: number | null = null;
    if (daten.mitLogin) {
      const [vorhandener] = await db
        .select({ id: nutzer.id, rolle: nutzer.rolle })
        .from(nutzer)
        .where(eq(nutzer.email, daten.email))
        .limit(1);
      if (vorhandener) {
        if (vorhandener.rolle !== "trainer") redirect("/team?fehler=email");
        nutzerId = vorhandener.id;
      } else {
        const [neuerNutzer] = await db
          .insert(nutzer)
          .values({ name: daten.name, email: daten.email, rolle: "trainer" })
          .returning();
        nutzerId = neuerNutzer.id;
      }
    }

    await db.insert(trainer).values({
      name: daten.name,
      email: daten.email,
      extern: daten.extern,
      verfuegbarkeitNotiz: daten.verfuegbarkeitNotiz ?? null,
      nutzerId,
    });
  } catch (error) {
    if (istUniqueVerletzung(error)) redirect("/team?fehler=email");
    throw error;
  }

  revalidatePath("/team");
}

export async function updateTrainerAction(
  trainerId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(trainerId);
  const daten = trainerUpdateFormSchema.parse(Object.fromEntries(formData));

  try {
    await db
      .update(trainer)
      .set({
        name: daten.name,
        email: daten.email,
        extern: daten.extern,
        aktiv: daten.aktiv,
        verfuegbarkeitNotiz: daten.verfuegbarkeitNotiz ?? null,
      })
      .where(eq(trainer.id, id));
  } catch (error) {
    if (istUniqueVerletzung(error)) redirect("/team?fehler=email");
    throw error;
  }

  revalidatePath("/team");
}

export async function createNutzerAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  // Only admins may create team accounts (they get full access).
  if (session.user.rolle !== "admin") {
    throw new AccessDeniedError();
  }
  const daten = nutzerFormSchema.parse(Object.fromEntries(formData));

  try {
    await db
      .insert(nutzer)
      .values({ name: daten.name, email: daten.email, rolle: daten.rolle });
  } catch (error) {
    if (istUniqueVerletzung(error)) redirect("/team?fehler=email");
    throw error;
  }

  revalidatePath("/team");
}
