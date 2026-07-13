"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  checkpunkt,
  kunde,
  threadKommentar,
  workshop,
  zuweisung,
} from "@/db/schema";
import { AccessDeniedError, assertTrainerAccess, isTeamRolle } from "@/lib/access";
import {
  aktualisiereFaelligkeiten,
  instanziiereCheckpunkte,
} from "@/lib/checklist";
import { requireSession, requireTeam } from "@/lib/session";
import {
  checkpunktStatusFormSchema,
  checkpunktZuweisungFormSchema,
  idSchema,
  kommentarFormSchema,
  workshopFormSchema,
  workshopStatusFormSchema,
  zuweisungFormSchema,
} from "@/lib/validation";

async function resolveKundeId(daten: {
  kundeId?: number;
  neueFirma?: string;
}): Promise<number> {
  if (daten.kundeId !== undefined) return daten.kundeId;
  const firma = daten.neueFirma!;
  const [vorhanden] = await db
    .select({ id: kunde.id })
    .from(kunde)
    .where(eq(kunde.firma, firma))
    .limit(1);
  if (vorhanden) return vorhanden.id;
  const [neu] = await db.insert(kunde).values({ firma }).returning();
  return neu.id;
}

function workshopWerte(daten: ReturnType<typeof workshopFormSchema.parse>) {
  return {
    name: daten.name,
    ansprechperson: daten.ansprechperson ?? null,
    type: daten.type,
    format: daten.format ?? null,
    modus: daten.modus ?? null,
    termin1: daten.termin1 ?? null,
    termin2: daten.termin2 ?? null,
    terminFup: daten.terminFup ?? null,
    wsBetrag: daten.wsBetrag ?? null,
    sharepointUrl: daten.sharepointUrl ?? null,
    notionProjectUrl: daten.notionProjectUrl ?? null,
    formsVorabUrl: daten.formsVorabUrl ?? null,
    formsFeedbackUrl: daten.formsFeedbackUrl ?? null,
    teamsMeetingUrl: daten.teamsMeetingUrl ?? null,
    verwendetesSlidedeck: daten.verwendetesSlidedeck ?? null,
    sevdeskId: daten.sevdeskId ?? null,
  };
}

export async function createWorkshopAction(formData: FormData): Promise<void> {
  await requireTeam();
  const daten = workshopFormSchema.parse(Object.fromEntries(formData));
  const kundeId = await resolveKundeId(daten);

  const [neu] = await db
    .insert(workshop)
    .values({ ...workshopWerte(daten), unternehmenId: kundeId, status: daten.status })
    .returning({ id: workshop.id });

  await instanziiereCheckpunkte(neu.id, daten.status);
  revalidatePath("/workshops");
  redirect(`/workshops/${neu.id}`);
}

export async function updateWorkshopAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(workshopId);
  const daten = workshopFormSchema.parse(Object.fromEntries(formData));
  const kundeId = await resolveKundeId(daten);

  const [vorher] = await db
    .select({ termin1: workshop.termin1 })
    .from(workshop)
    .where(eq(workshop.id, id))
    .limit(1);

  await db
    .update(workshop)
    .set({ ...workshopWerte(daten), unternehmenId: kundeId })
    .where(eq(workshop.id, id));

  const terminGeaendert =
    (vorher?.termin1?.getTime() ?? null) !== (daten.termin1?.getTime() ?? null);
  if (terminGeaendert) {
    await aktualisiereFaelligkeiten(id);
  }

  revalidatePath("/workshops");
  revalidatePath(`/workshops/${id}`);
  redirect(`/workshops/${id}`);
}

export async function changeStatusAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(workshopId);
  const { status } = workshopStatusFormSchema.parse(
    Object.fromEntries(formData),
  );

  await db.update(workshop).set({ status }).where(eq(workshop.id, id));
  await instanziiereCheckpunkte(id, status);

  revalidatePath("/workshops");
  revalidatePath(`/workshops/${id}`);
}

export async function addZuweisungAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(workshopId);
  const daten = zuweisungFormSchema.parse(Object.fromEntries(formData));

  await db
    .insert(zuweisung)
    .values({ workshopId: id, trainerId: daten.trainerId, rolle: daten.rolle })
    .onConflictDoNothing();

  revalidatePath(`/workshops/${id}`);
}

export async function removeZuweisungAction(
  workshopId: number,
  zuweisungId: number,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(workshopId);
  const zId = idSchema.parse(zuweisungId);

  await db
    .delete(zuweisung)
    .where(and(eq(zuweisung.id, zId), eq(zuweisung.workshopId, id)));

  revalidatePath(`/workshops/${id}`);
}

export async function addKommentarAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(workshopId);
  await assertTrainerAccess(session, id);
  const { text } = kommentarFormSchema.parse(Object.fromEntries(formData));

  await db.insert(threadKommentar).values({
    workshopId: id,
    autorId: session.user.nutzerId!,
    text,
  });

  revalidatePath(`/workshops/${id}`);
}

export async function setCheckpunktStatusAction(
  workshopId: number,
  checkpunktId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(workshopId);
  const cpId = idSchema.parse(checkpunktId);
  await assertTrainerAccess(session, id);
  const { status } = checkpunktStatusFormSchema.parse(
    Object.fromEntries(formData),
  );

  const [punkt] = await db
    .select({ verantwortlichUserId: checkpunkt.verantwortlichUserId })
    .from(checkpunkt)
    .where(and(eq(checkpunkt.id, cpId), eq(checkpunkt.workshopId, id)))
    .limit(1);
  if (!punkt) return;

  // Trainers may only check off their own items; the team may touch all.
  if (
    !isTeamRolle(session.user.rolle) &&
    punkt.verantwortlichUserId !== session.user.nutzerId
  ) {
    throw new AccessDeniedError();
  }

  await db
    .update(checkpunkt)
    .set({
      status,
      erledigtVia: status === "erledigt" ? "manuell" : null,
    })
    .where(eq(checkpunkt.id, cpId));

  revalidatePath(`/workshops/${id}`);
}

export async function assignCheckpunktAction(
  workshopId: number,
  checkpunktId: number,
  formData: FormData,
): Promise<void> {
  await requireTeam();
  const id = idSchema.parse(workshopId);
  const cpId = idSchema.parse(checkpunktId);
  const daten = checkpunktZuweisungFormSchema.parse(
    Object.fromEntries(formData),
  );

  await db
    .update(checkpunkt)
    .set({ verantwortlichUserId: daten.verantwortlichUserId ?? null })
    .where(and(eq(checkpunkt.id, cpId), eq(checkpunkt.workshopId, id)));

  revalidatePath(`/workshops/${id}`);
}
