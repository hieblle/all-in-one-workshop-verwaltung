"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { nutzer, trainer, zuweisung } from "@/db/schema";
import { requireAdmin, requireTeam } from "@/lib/session";
import {
  idSchema,
  nutzerFormSchema,
  trainerFormSchema,
  trainerUpdateFormSchema,
} from "@/lib/validation";
import { protokolliereAenderungen, protokolliereEreignis } from "@/lib/verlauf";

function istUniqueVerletzung(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Every trainer gets a login account (SPEC §3). Internal trainers reuse their
 * existing team account, external ones get a trainer account (magic link).
 */
export async function createTrainerAction(formData: FormData): Promise<void> {
  const session = await requireTeam();
  const daten = trainerFormSchema.parse(Object.fromEntries(formData));

  let trainerId: number;
  try {
    const [vorhandener] = await db
      .select({ id: nutzer.id })
      .from(nutzer)
      .where(eq(nutzer.email, daten.email))
      .limit(1);
    const nutzerId =
      vorhandener?.id ??
      (
        await db
          .insert(nutzer)
          .values({ name: daten.name, email: daten.email, rolle: "trainer" })
          .returning({ id: nutzer.id })
      )[0].id;

    const [neu] = await db
      .insert(trainer)
      .values({ name: daten.name, email: daten.email, extern: daten.extern, nutzerId })
      .returning({ id: trainer.id });
    trainerId = neu.id;
  } catch (error) {
    if (istUniqueVerletzung(error)) redirect("/team?fehler=email");
    throw error;
  }

  await protokolliereEreignis(
    { entitaet: "trainer", entitaetId: trainerId, nutzerId: session.user.nutzerId ?? null },
    "angelegt",
    daten.name,
  );
  revalidatePath("/team");
}

export async function updateTrainerAction(
  trainerId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(trainerId);
  const daten = trainerUpdateFormSchema.parse(Object.fromEntries(formData));

  const [vorher] = await db.select().from(trainer).where(eq(trainer.id, id)).limit(1);
  if (!vorher) return;

  try {
    await db.transaction(async (tx) => {
      await tx.update(trainer).set(daten).where(eq(trainer.id, id));
      // Keep the login account in sync — otherwise the magic link would go
      // to the old address. Team accounts of internal trainers stay as they are.
      if (vorher.nutzerId !== null) {
        await tx
          .update(nutzer)
          .set({ name: daten.name, email: daten.email })
          .where(sql`${nutzer.id} = ${vorher.nutzerId} and ${nutzer.rolle} = 'trainer'`);
      }
    });
  } catch (error) {
    if (istUniqueVerletzung(error)) redirect("/team?fehler=email");
    throw error;
  }

  await protokolliereAenderungen(
    { entitaet: "trainer", entitaetId: id, nutzerId: session.user.nutzerId ?? null },
    vorher,
    daten,
  );
  revalidatePath("/team");
}

/** Admin-only; trainers with assignments are archived (deactivated) instead. */
export async function deleteTrainerAction(trainerId: number): Promise<void> {
  const session = await requireAdmin();
  const id = idSchema.parse(trainerId);

  const [genutzt] = await db
    .select({ id: zuweisung.id })
    .from(zuweisung)
    .where(eq(zuweisung.trainerId, id))
    .limit(1);
  if (genutzt) redirect("/team?fehler=trainer_genutzt");

  const [t] = await db.select().from(trainer).where(eq(trainer.id, id)).limit(1);
  if (!t) return;
  await db.transaction(async (tx) => {
    await tx.delete(trainer).where(eq(trainer.id, id));
    if (t.nutzerId !== null) {
      await tx
        .delete(nutzer)
        .where(sql`${nutzer.id} = ${t.nutzerId} and ${nutzer.rolle} = 'trainer'`);
    }
  });
  await protokolliereEreignis(
    { entitaet: "trainer", entitaetId: id, nutzerId: session.user.nutzerId ?? null },
    "endgültig gelöscht",
    undefined,
    t.name,
  );
  revalidatePath("/team");
}

export async function createNutzerAction(formData: FormData): Promise<void> {
  // Only admins may create team accounts (they get full access).
  await requireAdmin();
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
