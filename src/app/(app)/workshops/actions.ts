"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Session } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  aenderung,
  checkpunkt,
  kalenderEintrag,
  kunde,
  postausgang,
  trainer,
  trainerFeedback,
  vorschlag,
  workshop,
  workshopModul,
  zuweisung,
} from "@/db/schema";
import { AccessDeniedError, assertTrainerAccess, isTeamRolle } from "@/lib/access";
import {
  nachTrainerAntwort,
  nachWorkshopAenderung,
  nachZuweisungAenderung,
} from "@/lib/automatik";
import { synchronisiereCheckliste, uebertrageOffenePunkte } from "@/lib/checklist";
import { getJetzt } from "@/lib/einstellungen";
import { requireAdmin, requireSession, requireTeam } from "@/lib/session";
import {
  adhocPunktFormSchema,
  aenderungFormSchema,
  checkpunktStatusFormSchema,
  checkpunktZuweisungFormSchema,
  feedbackFormSchema,
  idListeSchema,
  idSchema,
  rechnungFormSchema,
  teamsLinkFormSchema,
  vorschlagFormSchema,
  vorschlagStatusFormSchema,
  workshopFormSchema,
  workshopStatusFormSchema,
  zuweisungAntwortSchema,
  zuweisungFormSchema,
} from "@/lib/validation";
import { protokolliereAenderungen, protokolliereEreignis } from "@/lib/verlauf";

function nutzerIdVon(session: Session): number | null {
  return session.user.nutzerId ?? null;
}

function aktualisiere(workshopId: number): void {
  revalidatePath("/workshops");
  revalidatePath(`/workshops/${workshopId}`);
  revalidatePath("/");
}

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
    ort: daten.ort ?? null,
    verantwortlichInternId: daten.verantwortlichInternId ?? null,
    termin1: daten.termin1 ?? null,
    termin1Ende: daten.termin1Ende ?? null,
    termin2: daten.termin2 ?? null,
    termin2Ende: daten.termin2Ende ?? null,
    terminFup: daten.terminFup ?? null,
    terminFupEnde: daten.terminFupEnde ?? null,
    wsBetrag: daten.wsBetrag ?? null,
    sharepointUrl: daten.sharepointUrl ?? null,
    notionProjectUrl: daten.notionProjectUrl ?? null,
    formsVorabUrl: daten.formsVorabUrl ?? null,
    formsFeedbackUrl: daten.formsFeedbackUrl ?? null,
    teamsMeetingUrl: daten.teamsMeetingUrl ?? null,
    verwendetesSlidedeck: daten.verwendetesSlidedeck ?? null,
    sevdeskId: daten.sevdeskId ?? null,
    interneNotizen: daten.interneNotizen ?? null,
  };
}

async function setzeModule(workshopId: number, modulIds: number[]): Promise<void> {
  await db.delete(workshopModul).where(eq(workshopModul.workshopId, workshopId));
  if (modulIds.length > 0) {
    await db
      .insert(workshopModul)
      .values([...new Set(modulIds)].map((modulId) => ({ workshopId, modulId })));
  }
}

// --- Workshop ----------------------------------------------------------------

export async function createWorkshopAction(formData: FormData): Promise<void> {
  const session = await requireTeam();
  const daten = workshopFormSchema.parse(Object.fromEntries(formData));
  const modulIds = idListeSchema.parse(formData.getAll("modulIds"));
  const kundeId = await resolveKundeId(daten);
  const jetzt = await getJetzt();

  const [neu] = await db
    .insert(workshop)
    .values({ ...workshopWerte(daten), unternehmenId: kundeId, status: daten.status })
    .returning({ id: workshop.id });
  await setzeModule(neu.id, modulIds);

  await protokolliereEreignis(
    { entitaet: "workshop", entitaetId: neu.id, workshopId: neu.id, nutzerId: nutzerIdVon(session) },
    "angelegt",
    daten.name,
  );
  await nachWorkshopAenderung(neu.id, null, jetzt);
  revalidatePath("/workshops");
  redirect(`/workshops/${neu.id}`);
}

export async function updateWorkshopAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const daten = workshopFormSchema.parse(Object.fromEntries(formData));
  const modulIds = idListeSchema.parse(formData.getAll("modulIds"));
  const kundeId = await resolveKundeId(daten);
  const jetzt = await getJetzt();

  const [vorher] = await db.select().from(workshop).where(eq(workshop.id, id)).limit(1);
  if (!vorher) return;

  const werte = { ...workshopWerte(daten), unternehmenId: kundeId };
  await db.update(workshop).set(werte).where(eq(workshop.id, id));
  await setzeModule(id, modulIds);

  await protokolliereAenderungen(
    { entitaet: "workshop", entitaetId: id, workshopId: id, nutzerId: nutzerIdVon(session) },
    vorher,
    werte,
  );

  // Hand open team tasks over to the new verantwortlich intern.
  if (
    vorher.verantwortlichInternId !== null &&
    vorher.verantwortlichInternId !== werte.verantwortlichInternId
  ) {
    await uebertrageOffenePunkte(id, vorher.verantwortlichInternId, werte.verantwortlichInternId);
  }

  await nachWorkshopAenderung(id, vorher, jetzt);
  aktualisiere(id);
  redirect(`/workshops/${id}`);
}

export async function changeStatusAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const { status } = workshopStatusFormSchema.parse(Object.fromEntries(formData));
  const jetzt = await getJetzt();

  const [vorher] = await db.select().from(workshop).where(eq(workshop.id, id)).limit(1);
  if (!vorher || vorher.status === status) return;

  await db.update(workshop).set({ status }).where(eq(workshop.id, id));
  await protokolliereAenderungen(
    { entitaet: "workshop", entitaetId: id, workshopId: id, nutzerId: nutzerIdVon(session) },
    { status: vorher.status },
    { status },
  );
  await nachWorkshopAenderung(id, vorher, jetzt);
  aktualisiere(id);
}

export async function setTeamsLinkAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const { teamsMeetingUrl } = teamsLinkFormSchema.parse(Object.fromEntries(formData));
  const jetzt = await getJetzt();

  const [vorher] = await db.select().from(workshop).where(eq(workshop.id, id)).limit(1);
  if (!vorher) return;
  await db
    .update(workshop)
    .set({ teamsMeetingUrl: teamsMeetingUrl ?? null })
    .where(eq(workshop.id, id));
  await protokolliereAenderungen(
    { entitaet: "workshop", entitaetId: id, workshopId: id, nutzerId: nutzerIdVon(session) },
    { teamsMeetingUrl: vorher.teamsMeetingUrl },
    { teamsMeetingUrl: teamsMeetingUrl ?? null },
  );
  // Calendar entry and trainer info pick up the manual link (SPEC §6).
  await nachWorkshopAenderung(id, vorher, jetzt);
  aktualisiere(id);
}

export async function archiveWorkshopAction(workshopId: number): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const jetzt = await getJetzt();
  await db.update(workshop).set({ archiviertAm: jetzt }).where(eq(workshop.id, id));
  await protokolliereEreignis(
    { entitaet: "workshop", entitaetId: id, workshopId: id, nutzerId: nutzerIdVon(session) },
    "archiviert",
  );
  aktualisiere(id);
  redirect("/workshops");
}

export async function restoreWorkshopAction(workshopId: number): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  await db.update(workshop).set({ archiviertAm: null }).where(eq(workshop.id, id));
  await protokolliereEreignis(
    { entitaet: "workshop", entitaetId: id, workshopId: id, nutzerId: nutzerIdVon(session) },
    "wiederhergestellt",
  );
  aktualisiere(id);
}

/**
 * Admin-only hard delete (SPEC §1). Removes the workshop and everything that
 * belongs to it explicitly — the schema has no cascades on purpose. The
 * Postausgang protocol and the change history are kept.
 */
export async function deleteWorkshopAction(workshopId: number): Promise<void> {
  const session = await requireAdmin();
  const id = idSchema.parse(workshopId);
  const [ws] = await db
    .select({ name: workshop.name, archiviertAm: workshop.archiviertAm })
    .from(workshop)
    .where(eq(workshop.id, id))
    .limit(1);
  // Only archived workshops can be deleted — a deliberate second step.
  if (!ws?.archiviertAm) return;

  await db.transaction(async (tx) => {
    const eigeneVorschlaege = tx
      .select({ id: vorschlag.id })
      .from(vorschlag)
      .where(eq(vorschlag.workshopId, id));
    await tx
      .update(aenderung)
      .set({ vorschlagId: null })
      .where(inArray(aenderung.vorschlagId, eigeneVorschlaege));
    await tx.delete(aenderung).where(eq(aenderung.workshopId, id));
    await tx.delete(vorschlag).where(eq(vorschlag.workshopId, id));
    await tx.delete(trainerFeedback).where(eq(trainerFeedback.workshopId, id));
    await tx.delete(checkpunkt).where(eq(checkpunkt.workshopId, id));
    await tx.delete(zuweisung).where(eq(zuweisung.workshopId, id));
    await tx.delete(workshopModul).where(eq(workshopModul.workshopId, id));
    await tx.delete(kalenderEintrag).where(eq(kalenderEintrag.workshopId, id));
    await tx.update(postausgang).set({ workshopId: null }).where(eq(postausgang.workshopId, id));
    await tx.delete(workshop).where(eq(workshop.id, id));
  });
  await protokolliereEreignis(
    { entitaet: "workshop", entitaetId: id, workshopId: id, nutzerId: nutzerIdVon(session) },
    "endgültig gelöscht",
    ws.name,
  );
  revalidatePath("/workshops");
  redirect("/workshops?archiv=on");
}

export async function updateRechnungAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const daten = rechnungFormSchema.parse(Object.fromEntries(formData));

  const [vorher] = await db
    .select({ rechnungStatus: workshop.rechnungStatus, trainerRe: workshop.trainerRe })
    .from(workshop)
    .where(eq(workshop.id, id))
    .limit(1);
  if (!vorher) return;
  await db.update(workshop).set(daten).where(eq(workshop.id, id));
  await protokolliereAenderungen(
    { entitaet: "workshop", entitaetId: id, workshopId: id, nutzerId: nutzerIdVon(session) },
    vorher,
    daten,
  );
  aktualisiere(id);
}

// --- Trainer-Zuweisung ---------------------------------------------------------

export async function addZuweisungAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const daten = zuweisungFormSchema.parse(Object.fromEntries(formData));
  const jetzt = await getJetzt();

  const [neu] = await db
    .insert(zuweisung)
    .values({ workshopId: id, trainerId: daten.trainerId, rolle: daten.rolle })
    .onConflictDoNothing()
    .returning({ id: zuweisung.id });
  if (!neu) return;

  const [t] = await db
    .select({ name: trainer.name })
    .from(trainer)
    .where(eq(trainer.id, daten.trainerId))
    .limit(1);
  await protokolliereEreignis(
    { entitaet: "zuweisung", entitaetId: neu.id, workshopId: id, nutzerId: nutzerIdVon(session) },
    "Trainer angefragt",
    `${t?.name ?? daten.trainerId} (${daten.rolle})`,
  );
  await nachZuweisungAenderung(id, jetzt);
  aktualisiere(id);
}

export async function removeZuweisungAction(
  workshopId: number,
  zuweisungId: number,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const zId = idSchema.parse(zuweisungId);
  const jetzt = await getJetzt();

  const [z] = await db
    .select({ nutzerId: trainer.nutzerId, name: trainer.name })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(and(eq(zuweisung.id, zId), eq(zuweisung.workshopId, id)))
    .limit(1);
  if (!z) return;

  await db.delete(zuweisung).where(eq(zuweisung.id, zId));
  if (z.nutzerId !== null) await uebertrageOffenePunkte(id, z.nutzerId, null);
  await protokolliereEreignis(
    { entitaet: "zuweisung", entitaetId: zId, workshopId: id, nutzerId: nutzerIdVon(session) },
    "Trainer entfernt",
    undefined,
    z.name,
  );
  await nachZuweisungAenderung(id, jetzt);
  aktualisiere(id);
}

async function setzeZuweisungStatus(
  session: Session,
  workshopId: number,
  zuweisungId: number,
  status: "bestaetigt" | "abgesagt",
): Promise<void> {
  const jetzt = await getJetzt();
  const [z] = await db
    .select({ status: zuweisung.status, nutzerId: trainer.nutzerId })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(and(eq(zuweisung.id, zuweisungId), eq(zuweisung.workshopId, workshopId)))
    .limit(1);
  if (!z || z.status === status) return;

  await db.update(zuweisung).set({ status }).where(eq(zuweisung.id, zuweisungId));
  if (status === "abgesagt" && z.nutzerId !== null) {
    await uebertrageOffenePunkte(workshopId, z.nutzerId, null);
  }
  await protokolliereAenderungen(
    { entitaet: "zuweisung", entitaetId: zuweisungId, workshopId, nutzerId: nutzerIdVon(session) },
    { status: z.status },
    { status },
  );
  await nachTrainerAntwort(zuweisungId, status, jetzt);
  aktualisiere(workshopId);
}

/** Trainer accepts or declines a request in the portal (SPEC §5). */
export async function antwortTrainerAction(
  workshopId: number,
  zuweisungId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(workshopId);
  const zId = idSchema.parse(zuweisungId);
  await assertTrainerAccess(session, id);
  const { antwort } = zuweisungAntwortSchema.parse(Object.fromEntries(formData));

  const [eigene] = await db
    .select({ id: zuweisung.id, status: zuweisung.status })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(and(eq(zuweisung.id, zId), eq(trainer.nutzerId, session.user.nutzerId ?? -1)))
    .limit(1);
  if (!eigene) throw new AccessDeniedError();
  if (eigene.status !== "angefragt") return;

  await setzeZuweisungStatus(session, id, zId, antwort);
  if (antwort === "abgesagt") redirect("/");
}

/** Team records an answer that came in by phone or mail. */
export async function setZuweisungStatusAction(
  workshopId: number,
  zuweisungId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const { antwort } = zuweisungAntwortSchema.parse(Object.fromEntries(formData));
  await setzeZuweisungStatus(session, idSchema.parse(workshopId), idSchema.parse(zuweisungId), antwort);
}

// --- Checkliste ------------------------------------------------------------------

export async function setCheckpunktStatusAction(
  workshopId: number,
  checkpunktId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(workshopId);
  const cpId = idSchema.parse(checkpunktId);
  await assertTrainerAccess(session, id);
  const { status } = checkpunktStatusFormSchema.parse(Object.fromEntries(formData));
  const jetzt = await getJetzt();

  const [punkt] = await db
    .select({
      verantwortlichUserId: checkpunkt.verantwortlichUserId,
      status: checkpunkt.status,
    })
    .from(checkpunkt)
    .where(and(eq(checkpunkt.id, cpId), eq(checkpunkt.workshopId, id)))
    .limit(1);
  if (!punkt) return;

  // Trainers may only tick off their own tasks and can't skip; the team may touch all.
  if (
    !isTeamRolle(session.user.rolle) &&
    (punkt.verantwortlichUserId !== session.user.nutzerId || status === "uebersprungen")
  ) {
    throw new AccessDeniedError();
  }

  const offen = status === "offen";
  await db
    .update(checkpunkt)
    .set({
      status,
      erledigtVia: offen ? null : "manuell",
      erledigtVonId: offen ? null : nutzerIdVon(session),
      erledigtAm: offen ? null : jetzt,
    })
    .where(eq(checkpunkt.id, cpId));
  await protokolliereAenderungen(
    { entitaet: "checkpunkt", entitaetId: cpId, workshopId: id, nutzerId: nutzerIdVon(session) },
    { status: punkt.status },
    { status },
  );
  aktualisiere(id);
}

export async function addAdhocCheckpunktAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const daten = adhocPunktFormSchema.parse(Object.fromEntries(formData));

  const [ws] = await db
    .select({ status: workshop.status, verantwortlichInternId: workshop.verantwortlichInternId })
    .from(workshop)
    .where(eq(workshop.id, id))
    .limit(1);
  if (!ws) return;

  const [neu] = await db
    .insert(checkpunkt)
    .values({
      workshopId: id,
      titel: daten.titel,
      // Ad-hoc items belong to the phase the workshop is in right now.
      phase: ws.status,
      faelligAm: daten.faelligAm ?? null,
      verantwortlichUserId: daten.verantwortlichUserId ?? ws.verantwortlichInternId,
    })
    .returning({ id: checkpunkt.id });
  await protokolliereEreignis(
    { entitaet: "checkpunkt", entitaetId: neu.id, workshopId: id, nutzerId: nutzerIdVon(session) },
    "Aufgabe angelegt",
    daten.titel,
  );
  aktualisiere(id);
}

// Only ad-hoc tasks can be deleted — template tasks are skipped instead
// (they would be re-created by the next synchronisation).
export async function deleteCheckpunktAction(
  workshopId: number,
  checkpunktId: number,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const cpId = idSchema.parse(checkpunktId);

  const geloescht = await db
    .delete(checkpunkt)
    .where(
      and(
        eq(checkpunkt.id, cpId),
        eq(checkpunkt.workshopId, id),
        isNull(checkpunkt.vorlagePunktId),
        isNull(checkpunkt.systemSchluessel),
      ),
    )
    .returning({ titel: checkpunkt.titel });
  if (geloescht.length > 0) {
    await protokolliereEreignis(
      { entitaet: "checkpunkt", entitaetId: cpId, workshopId: id, nutzerId: nutzerIdVon(session) },
      "Aufgabe gelöscht",
      undefined,
      geloescht[0].titel,
    );
  }
  aktualisiere(id);
}

export async function assignCheckpunktAction(
  workshopId: number,
  checkpunktId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const id = idSchema.parse(workshopId);
  const cpId = idSchema.parse(checkpunktId);
  const daten = checkpunktZuweisungFormSchema.parse(Object.fromEntries(formData));

  const [vorher] = await db
    .select({ verantwortlichUserId: checkpunkt.verantwortlichUserId })
    .from(checkpunkt)
    .where(and(eq(checkpunkt.id, cpId), eq(checkpunkt.workshopId, id)))
    .limit(1);
  if (!vorher) return;

  await db
    .update(checkpunkt)
    .set({ verantwortlichUserId: daten.verantwortlichUserId ?? null })
    .where(eq(checkpunkt.id, cpId));
  await protokolliereAenderungen(
    { entitaet: "checkpunkt", entitaetId: cpId, workshopId: id, nutzerId: nutzerIdVon(session) },
    { verantwortlich: vorher.verantwortlichUserId },
    { verantwortlich: daten.verantwortlichUserId ?? null },
  );
  // Unassigning falls back to the default responsible.
  await synchronisiereCheckliste(id, await getJetzt());
  aktualisiere(id);
}

// --- Vorschläge, Änderungen, Feedback -------------------------------------------

async function istAktiverTrainerDesWorkshops(session: Session, workshopId: number) {
  const [eigene] = await db
    .select({ trainerId: trainer.id, rolle: zuweisung.rolle })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(
      and(
        eq(zuweisung.workshopId, workshopId),
        eq(trainer.nutzerId, session.user.nutzerId ?? -1),
        eq(zuweisung.status, "bestaetigt"),
      ),
    )
    .limit(1);
  return eigene ?? null;
}

export async function addVorschlagAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(workshopId);
  await assertTrainerAccess(session, id);
  if (!isTeamRolle(session.user.rolle) && !(await istAktiverTrainerDesWorkshops(session, id))) {
    throw new AccessDeniedError();
  }
  const daten = vorschlagFormSchema.parse(Object.fromEntries(formData));

  const [neu] = await db
    .insert(vorschlag)
    .values({
      workshopId: id,
      modulId: daten.modulId ?? null,
      text: daten.text,
      erstelltVonId: session.user.nutzerId!,
    })
    .returning({ id: vorschlag.id });
  await protokolliereEreignis(
    { entitaet: "vorschlag", entitaetId: neu.id, workshopId: id, nutzerId: nutzerIdVon(session) },
    "Vorschlag eingetragen",
    daten.text,
  );
  aktualisiere(id);
  revalidatePath("/change-log");
}

export async function setVorschlagStatusAction(
  vorschlagId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireTeam();
  const vId = idSchema.parse(vorschlagId);
  const { status } = vorschlagStatusFormSchema.parse(Object.fromEntries(formData));
  const jetzt = await getJetzt();

  const [vorher] = await db
    .select({ status: vorschlag.status, workshopId: vorschlag.workshopId })
    .from(vorschlag)
    .where(eq(vorschlag.id, vId))
    .limit(1);
  if (!vorher) return;

  await db
    .update(vorschlag)
    .set({
      status,
      statusGeaendertAm: jetzt,
      statusGeaendertVonId: nutzerIdVon(session),
    })
    .where(eq(vorschlag.id, vId));
  await protokolliereAenderungen(
    {
      entitaet: "vorschlag",
      entitaetId: vId,
      workshopId: vorher.workshopId,
      nutzerId: nutzerIdVon(session),
    },
    { status: vorher.status },
    { status },
  );
  aktualisiere(vorher.workshopId);
  revalidatePath("/change-log");
}

/** The actual change log: recorded while preparing a workshop (SPEC §1). */
export async function addAenderungAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(workshopId);
  await assertTrainerAccess(session, id);
  if (!isTeamRolle(session.user.rolle) && !(await istAktiverTrainerDesWorkshops(session, id))) {
    throw new AccessDeniedError();
  }
  const daten = aenderungFormSchema.parse(Object.fromEntries(formData));
  const jetzt = await getJetzt();

  const [neu] = await db
    .insert(aenderung)
    .values({
      workshopId: id,
      modulId: daten.modulId ?? null,
      vorschlagId: daten.vorschlagId ?? null,
      text: daten.text,
      erstelltVonId: session.user.nutzerId!,
    })
    .returning({ id: aenderung.id });

  if (daten.vorschlagId) {
    await db
      .update(vorschlag)
      .set({
        status: "umgesetzt",
        statusGeaendertAm: jetzt,
        statusGeaendertVonId: nutzerIdVon(session),
      })
      .where(and(eq(vorschlag.id, daten.vorschlagId), eq(vorschlag.status, "offen")));
  }
  await protokolliereEreignis(
    { entitaet: "aenderung", entitaetId: neu.id, workshopId: id, nutzerId: nutzerIdVon(session) },
    "Änderung eingetragen",
    daten.text,
  );
  aktualisiere(id);
  revalidatePath("/change-log");
}

/** Trainer's own feedback section (SPEC §1) — one per trainer and workshop. */
export async function saveFeedbackAction(
  workshopId: number,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(workshopId);
  await assertTrainerAccess(session, id);
  const eigene = await istAktiverTrainerDesWorkshops(session, id);
  if (!eigene) throw new AccessDeniedError();
  const daten = feedbackFormSchema.parse(Object.fromEntries(formData));

  const werte = {
    abwicklungNote: daten.abwicklungNote ?? null,
    abwicklungText: daten.abwicklungText ?? null,
    verlaufNote: daten.verlaufNote ?? null,
    verlaufText: daten.verlaufText ?? null,
    sonstiges: daten.sonstiges ?? null,
  };
  const [gespeichert] = await db
    .insert(trainerFeedback)
    .values({ workshopId: id, trainerId: eigene.trainerId, ...werte })
    .onConflictDoUpdate({
      target: [trainerFeedback.workshopId, trainerFeedback.trainerId],
      set: werte,
    })
    .returning({ id: trainerFeedback.id });
  // The team's "Feedback fehlt — nachfragen" task resolves itself.
  await db
    .update(checkpunkt)
    .set({ status: "erledigt", erledigtVia: "auto", erledigtAm: await getJetzt() })
    .where(
      and(
        eq(checkpunkt.workshopId, id),
        eq(checkpunkt.systemSchluessel, `feedback_fehlt:${eigene.trainerId}`),
        eq(checkpunkt.status, "offen"),
      ),
    );
  await protokolliereEreignis(
    {
      entitaet: "trainer_feedback",
      entitaetId: gespeichert.id,
      workshopId: id,
      nutzerId: nutzerIdVon(session),
    },
    "Trainer-Feedback gespeichert",
  );
  aktualisiere(id);
}
