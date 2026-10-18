import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/db";
import {
  checkpunkt,
  checkpunktVorlage,
  kalenderEintrag,
  kunde,
  modul,
  nutzer,
  trainer,
  trainerFeedback,
  verlauf,
  workshop,
  workshopModul,
  zuweisung,
  type TrainerFeedback,
  type Workshop,
  type WorkshopStatus,
  type WorkshopType,
  type ZuweisungStatus,
} from "@/db/schema";
import { assertTrainerAccess, isTeamRolle } from "@/lib/access";
import { berechneAutomatikSchritte, type AutomatikSchritt } from "@/lib/automatik";
import {
  ladeAenderungen,
  ladeVorschlaege,
  type AenderungEintrag,
  type VorschlagEintrag,
} from "@/lib/changelog";

export interface WorkshopFilter {
  status?: WorkshopStatus;
  type?: WorkshopType;
  trainerId?: number;
  von?: Date;
  bis?: Date;
  suche?: string;
  archiv?: boolean;
}

export interface WorkshopListEintrag {
  id: number;
  name: string;
  firma: string;
  type: WorkshopType;
  status: WorkshopStatus;
  termin1: Date | null;
  wsBetrag: string | null;
  verantwortlichName: string | null;
  archiviertAm: Date | null;
}

/**
 * Role-aware workshop listing: team sees everything (with filters, archived
 * only on request), trainers only workshops they are assigned to.
 * Trainer rows never carry the amount.
 */
export async function findWorkshops(
  session: Session,
  filter: WorkshopFilter,
): Promise<WorkshopListEintrag[]> {
  const user = session.user;
  const istTeam = isTeamRolle(user.rolle);
  const conditions = [];

  if (filter.status) conditions.push(eq(workshop.status, filter.status));
  if (filter.type) conditions.push(eq(workshop.type, filter.type));
  if (filter.von) conditions.push(gte(workshop.termin1, filter.von));
  if (filter.bis) conditions.push(lte(workshop.termin1, filter.bis));
  conditions.push(
    istTeam && filter.archiv
      ? isNotNull(workshop.archiviertAm)
      : isNull(workshop.archiviertAm),
  );
  if (filter.suche) {
    // Escape the escape char first, then the ILIKE wildcards.
    const muster = `%${filter.suche
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_")}%`;
    conditions.push(or(ilike(workshop.name, muster), ilike(kunde.firma, muster)));
  }
  if (filter.trainerId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(zuweisung)
          .where(
            and(
              eq(zuweisung.workshopId, workshop.id),
              eq(zuweisung.trainerId, filter.trainerId),
            ),
          ),
      ),
    );
  }

  if (!istTeam) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(zuweisung)
          .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
          .where(
            and(
              eq(zuweisung.workshopId, workshop.id),
              eq(trainer.nutzerId, user.nutzerId ?? -1),
              eq(trainer.aktiv, true),
              ne(zuweisung.status, "abgesagt"),
            ),
          ),
      ),
    );
  }

  const zeilen = await db
    .select({
      id: workshop.id,
      name: workshop.name,
      firma: kunde.firma,
      type: workshop.type,
      status: workshop.status,
      termin1: workshop.termin1,
      wsBetrag: workshop.wsBetrag,
      verantwortlichName: nutzer.name,
      archiviertAm: workshop.archiviertAm,
    })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .leftJoin(nutzer, eq(workshop.verantwortlichInternId, nutzer.id))
    .where(and(...conditions))
    .orderBy(sql`${workshop.termin1} ASC NULLS LAST`, desc(workshop.createdAt));

  return istTeam ? zeilen : zeilen.map((z) => ({ ...z, wsBetrag: null }));
}

// --- Detail ------------------------------------------------------------------

export interface CheckpunktEintrag {
  id: number;
  titel: string;
  phase: WorkshopStatus;
  faelligAm: Date | null;
  status: string;
  erledigtVia: string | null;
  erledigtAm: Date | null;
  erledigtVonName: string | null;
  verantwortlichUserId: number | null;
  verantwortlichName: string | null;
  linkFeld: string | null;
  // Only ad-hoc tasks can be deleted; template/system tasks are skipped instead.
  loeschbar: boolean;
}

// Fields every viewer may see (SPEC §2).
export interface WorkshopBasis {
  id: number;
  name: string;
  status: WorkshopStatus;
  type: WorkshopType;
  format: string | null;
  modus: Workshop["modus"];
  ort: string | null;
  firma: string;
  ansprechperson: string | null;
  termin1: Date | null;
  termin1Ende: Date | null;
  termin2: Date | null;
  termin2Ende: Date | null;
  terminFup: Date | null;
  terminFupEnde: Date | null;
  teamsMeetingUrl: string | null;
  praesentationUrl: string | null;
}

export interface ZuweisungEintrag {
  id: number;
  rolle: string;
  status: ZuweisungStatus;
  trainerId: number;
  trainerName: string;
  trainerEmail: string;
  anfrageGesendetAm: Date | null;
}

export interface FeedbackEintrag extends TrainerFeedback {
  trainerName: string;
}

export interface TeamWorkshopDetail {
  art: "team";
  basis: WorkshopBasis;
  workshop: Workshop;
  verantwortlichName: string | null;
  zuweisungen: ZuweisungEintrag[];
  checkpunkte: CheckpunktEintrag[];
  automatik: AutomatikSchritt[];
  module: { id: number; name: string; sharepointUrl: string | null }[];
  vorschlaege: VorschlagEintrag[];
  aenderungen: AenderungEintrag[];
  feedbacks: FeedbackEintrag[];
  verlauf: {
    id: number;
    entitaet: string;
    feld: string;
    alt: string | null;
    neu: string | null;
    nutzerName: string | null;
    createdAt: Date;
  }[];
}

export interface TrainerWorkshopDetail {
  art: "trainer";
  basis: WorkshopBasis;
  trainerId: number;
  eigeneZuweisung: { id: number; rolle: string; status: ZuweisungStatus };
  mitTrainer: { name: string; rolle: string; status: ZuweisungStatus }[];
  checkpunkte: CheckpunktEintrag[];
  module: { id: number; name: string }[];
  vorschlaege: VorschlagEintrag[];
  aenderungen: AenderungEintrag[];
  eigenesFeedback: TrainerFeedback | null;
}

export type WorkshopDetail = TeamWorkshopDetail | TrainerWorkshopDetail;

// Explicit column list: the trainer query must never load amount, invoice
// state, internal notes or team-only links (SPEC §2).
const basisSpalten = {
  id: workshop.id,
  name: workshop.name,
  status: workshop.status,
  type: workshop.type,
  format: workshop.format,
  modus: workshop.modus,
  ort: workshop.ort,
  firma: kunde.firma,
  ansprechperson: workshop.ansprechperson,
  termin1: workshop.termin1,
  termin1Ende: workshop.termin1Ende,
  termin2: workshop.termin2,
  termin2Ende: workshop.termin2Ende,
  terminFup: workshop.terminFup,
  terminFupEnde: workshop.terminFupEnde,
  teamsMeetingUrl: workshop.teamsMeetingUrl,
  praesentationUrl: workshop.verwendetesSlidedeck,
};

async function ladeCheckpunkte(
  workshopId: number,
  nurFuerNutzerId?: number,
): Promise<CheckpunktEintrag[]> {
  const erledigtVon = db
    .select({ id: nutzer.id, name: nutzer.name })
    .from(nutzer)
    .as("erledigt_von");
  const zeilen = await db
    .select({
      id: checkpunkt.id,
      vorlagePunktId: checkpunkt.vorlagePunktId,
      systemSchluessel: checkpunkt.systemSchluessel,
      titel: sql<string>`coalesce(${checkpunkt.titel}, ${checkpunktVorlage.titel})`,
      phase: sql<WorkshopStatus>`coalesce(${checkpunkt.phase}, ${checkpunktVorlage.phase})`,
      faelligAm: checkpunkt.faelligAm,
      status: checkpunkt.status,
      erledigtVia: checkpunkt.erledigtVia,
      erledigtAm: checkpunkt.erledigtAm,
      erledigtVonName: erledigtVon.name,
      verantwortlichUserId: checkpunkt.verantwortlichUserId,
      verantwortlichName: nutzer.name,
      linkFeld: checkpunktVorlage.linkFeld,
    })
    .from(checkpunkt)
    .leftJoin(checkpunktVorlage, eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id))
    .leftJoin(nutzer, eq(checkpunkt.verantwortlichUserId, nutzer.id))
    .leftJoin(erledigtVon, eq(checkpunkt.erledigtVonId, erledigtVon.id))
    .where(
      and(
        eq(checkpunkt.workshopId, workshopId),
        nurFuerNutzerId !== undefined
          ? eq(checkpunkt.verantwortlichUserId, nurFuerNutzerId)
          : undefined,
      ),
    )
    .orderBy(
      sql`coalesce(${checkpunktVorlage.reihenfolge}, 999)`,
      sql`${checkpunkt.faelligAm} ASC NULLS LAST`,
      asc(checkpunkt.id),
    );
  return zeilen.map(({ vorlagePunktId, systemSchluessel, ...rest }) => ({
    ...rest,
    loeschbar: vorlagePunktId === null && systemSchluessel === null,
  }));
}

async function ladeModule(workshopId: number) {
  return db
    .select({ id: modul.id, name: modul.name, sharepointUrl: modul.sharepointUrl })
    .from(workshopModul)
    .innerJoin(modul, eq(workshopModul.modulId, modul.id))
    .where(eq(workshopModul.workshopId, workshopId))
    .orderBy(asc(modul.name));
}

async function ladeZuweisungen(workshopId: number) {
  return db
    .select({
      id: zuweisung.id,
      rolle: zuweisung.rolle,
      status: zuweisung.status,
      anfrageGesendetAm: zuweisung.anfrageGesendetAm,
      infomailGesendetAm: zuweisung.infomailGesendetAm,
      feedbackErinnerungAm: zuweisung.feedbackErinnerungAm,
      trainerId: trainer.id,
      trainerName: trainer.name,
      trainerEmail: trainer.email,
      trainerNutzerId: trainer.nutzerId,
    })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(eq(zuweisung.workshopId, workshopId))
    .orderBy(asc(zuweisung.rolle), asc(trainer.name));
}

/**
 * Loads a workshop for the current viewer. Enforces assertTrainerAccess and
 * returns a different shape per role: trainers get only the fields of
 * SPEC §2, loaded with an explicit column list.
 */
export async function getWorkshopDetail(
  session: Session,
  workshopId: number,
): Promise<WorkshopDetail | null> {
  await assertTrainerAccess(session, workshopId);

  const [basis] = await db
    .select(basisSpalten)
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(eq(workshop.id, workshopId))
    .limit(1);
  if (!basis) return null;

  const zuweisungen = await ladeZuweisungen(workshopId);
  const modulListe = await ladeModule(workshopId);
  const changelogFilter = { workshopId, modulIds: modulListe.map((m) => m.id) };

  if (!isTeamRolle(session.user.rolle)) {
    const nutzerId = session.user.nutzerId ?? -1;
    const eigene = zuweisungen.find((z) => z.trainerNutzerId === nutzerId);
    if (!eigene) return null;
    const [eigenesFeedback] = await db
      .select()
      .from(trainerFeedback)
      .where(
        and(
          eq(trainerFeedback.workshopId, workshopId),
          eq(trainerFeedback.trainerId, eigene.trainerId),
        ),
      )
      .limit(1);
    return {
      art: "trainer",
      basis,
      trainerId: eigene.trainerId,
      eigeneZuweisung: { id: eigene.id, rolle: eigene.rolle, status: eigene.status },
      mitTrainer: zuweisungen
        .filter((z) => z.id !== eigene.id && z.status !== "abgesagt")
        .map((z) => ({ name: z.trainerName, rolle: z.rolle, status: z.status })),
      checkpunkte: await ladeCheckpunkte(workshopId, nutzerId),
      module: modulListe.map((m) => ({ id: m.id, name: m.name })),
      vorschlaege: await ladeVorschlaege(session, changelogFilter),
      aenderungen: await ladeAenderungen(session, changelogFilter),
      eigenesFeedback: eigenesFeedback ?? null,
    };
  }

  const [voll] = await db
    .select({ ws: workshop, verantwortlichName: nutzer.name })
    .from(workshop)
    .leftJoin(nutzer, eq(workshop.verantwortlichInternId, nutzer.id))
    .where(eq(workshop.id, workshopId))
    .limit(1);

  const feedbacks = await db
    .select({ feedback: trainerFeedback, trainerName: trainer.name })
    .from(trainerFeedback)
    .innerJoin(trainer, eq(trainerFeedback.trainerId, trainer.id))
    .where(eq(trainerFeedback.workshopId, workshopId));

  const kalender = await db
    .select({
      terminArt: kalenderEintrag.terminArt,
      status: kalenderEintrag.status,
      teamsMeetingAngefordert: kalenderEintrag.teamsMeetingAngefordert,
    })
    .from(kalenderEintrag)
    .where(eq(kalenderEintrag.workshopId, workshopId));

  const verlaufZeilen = await db
    .select({
      id: verlauf.id,
      entitaet: verlauf.entitaet,
      feld: verlauf.feld,
      alt: verlauf.alt,
      neu: verlauf.neu,
      nutzerName: nutzer.name,
      createdAt: verlauf.createdAt,
    })
    .from(verlauf)
    .leftJoin(nutzer, eq(verlauf.nutzerId, nutzer.id))
    .where(eq(verlauf.workshopId, workshopId))
    .orderBy(desc(verlauf.createdAt), desc(verlauf.id))
    .limit(200);

  const hatFeedback = new Set(feedbacks.map((f) => f.feedback.trainerId));

  return {
    art: "team",
    basis,
    workshop: voll.ws,
    verantwortlichName: voll.verantwortlichName,
    zuweisungen,
    checkpunkte: await ladeCheckpunkte(workshopId),
    automatik: berechneAutomatikSchritte({
      status: voll.ws.status,
      modus: voll.ws.modus,
      teamsMeetingUrl: voll.ws.teamsMeetingUrl,
      kalender,
      trainer: zuweisungen.map((z) => ({
        name: z.trainerName,
        status: z.status,
        anfrageGesendetAm: z.anfrageGesendetAm,
        infomailGesendetAm: z.infomailGesendetAm,
        feedbackErinnerungAm: z.feedbackErinnerungAm,
        hatFeedback: hatFeedback.has(z.trainerId),
      })),
    }),
    module: modulListe,
    vorschlaege: await ladeVorschlaege(session, changelogFilter),
    aenderungen: await ladeAenderungen(session, changelogFilter),
    feedbacks: feedbacks.map((f) => ({ ...f.feedback, trainerName: f.trainerName })),
    verlauf: verlaufZeilen,
  };
}
