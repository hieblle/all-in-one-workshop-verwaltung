import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  notExists,
  notInArray,
  sql,
} from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/db";
import {
  checkpunkt,
  checkpunktVorlage,
  kunde,
  nutzer,
  trainer,
  trainerFeedback,
  wiederkehrendeErinnerung,
  workshop,
  zuweisung,
  type WorkshopStatus,
} from "@/db/schema";
import { INAKTIVE_STATUS, letzterTermin, plusTage, tagesende } from "@/lib/status";

export interface PunktEintrag {
  id: number;
  titel: string;
  faelligAm: Date | null;
  verantwortlichName: string | null;
  workshopId: number;
  workshopName: string;
}

export interface WorkshopEintrag {
  id: number;
  name: string;
  firma: string;
  status: WorkshopStatus;
  termin1: Date | null;
}

export interface ErinnerungEintrag {
  id: number;
  titel: string;
  naechsteFaelligkeit: Date;
  link: string | null;
  notiz: string | null;
}

export interface TeamDashboard {
  ueberfaellig: PunktEintrag[];
  dieseWoche: PunktEintrag[];
  meinePunkte: PunktEintrag[];
  anstehende: WorkshopEintrag[];
  ohneTrainer: WorkshopEintrag[];
  offeneRechnungen: WorkshopEintrag[];
  erinnerungen: ErinnerungEintrag[];
}

const punktTitel = sql<string>`coalesce(${checkpunkt.titel}, ${checkpunktVorlage.titel})`;

// Only open tasks of live workshops count (not archived, not paused).
const lebendig = and(
  isNull(workshop.archiviertAm),
  notInArray(workshop.status, INAKTIVE_STATUS),
);

function offenePunkteQuery() {
  return db
    .select({
      id: checkpunkt.id,
      titel: punktTitel,
      faelligAm: checkpunkt.faelligAm,
      verantwortlichName: nutzer.name,
      workshopId: workshop.id,
      workshopName: workshop.name,
    })
    .from(checkpunkt)
    .leftJoin(checkpunktVorlage, eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id))
    .innerJoin(workshop, eq(checkpunkt.workshopId, workshop.id))
    .leftJoin(nutzer, eq(checkpunkt.verantwortlichUserId, nutzer.id));
}

const workshopSpalten = {
  id: workshop.id,
  name: workshop.name,
  firma: kunde.firma,
  status: workshop.status,
  termin1: workshop.termin1,
};

export async function getTeamDashboard(
  session: Session,
  jetzt: Date,
): Promise<TeamDashboard> {
  const heute = new Date(jetzt);
  heute.setHours(0, 0, 0, 0);
  const inSiebenTagen = tagesende(plusTage(jetzt, 7));
  const inDreissigTagen = plusTage(jetzt, 30);
  const offen = eq(checkpunkt.status, "offen");

  const ueberfaellig = await offenePunkteQuery()
    .where(and(offen, lt(checkpunkt.faelligAm, heute), lebendig))
    .orderBy(asc(checkpunkt.faelligAm));

  const dieseWoche = await offenePunkteQuery()
    .where(
      and(
        offen,
        gte(checkpunkt.faelligAm, heute),
        lte(checkpunkt.faelligAm, inSiebenTagen),
        lebendig,
      ),
    )
    .orderBy(asc(checkpunkt.faelligAm));

  const meinePunkte = await offenePunkteQuery()
    .where(
      and(offen, eq(checkpunkt.verantwortlichUserId, session.user.nutzerId ?? -1), lebendig),
    )
    .orderBy(sql`${checkpunkt.faelligAm} ASC NULLS LAST`);

  const anstehende = await db
    .select(workshopSpalten)
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(
      and(
        gte(workshop.termin1, heute),
        lte(workshop.termin1, inDreissigTagen),
        lebendig,
        ne(workshop.status, "Done"),
      ),
    )
    .orderBy(asc(workshop.termin1));

  // Offer-to-delivery window without any trainer who hasn't declined —
  // deliberately without Nachbereitung: the nudge only matters before/during.
  const ohneTrainer = await db
    .select(workshopSpalten)
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(
      and(
        isNull(workshop.archiviertAm),
        inArray(workshop.status, ["Angebot", "Vorbereitung", "Durchführung"]),
        notExists(
          db
            .select({ one: sql`1` })
            .from(zuweisung)
            .where(
              and(eq(zuweisung.workshopId, workshop.id), ne(zuweisung.status, "abgesagt")),
            ),
        ),
      ),
    )
    .orderBy(sql`${workshop.termin1} ASC NULLS LAST`);

  const offeneRechnungen = await db
    .select(workshopSpalten)
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(
      and(
        isNull(workshop.archiviertAm),
        inArray(workshop.status, ["Nachbereitung", "Done"]),
        ne(workshop.rechnungStatus, "gesendet"),
      ),
    )
    .orderBy(sql`${workshop.termin1} ASC NULLS LAST`);

  const erinnerungen = await db
    .select({
      id: wiederkehrendeErinnerung.id,
      titel: wiederkehrendeErinnerung.titel,
      naechsteFaelligkeit: wiederkehrendeErinnerung.naechsteFaelligkeit,
      link: wiederkehrendeErinnerung.link,
      notiz: wiederkehrendeErinnerung.notiz,
    })
    .from(wiederkehrendeErinnerung)
    .where(
      and(
        eq(wiederkehrendeErinnerung.aktiv, true),
        eq(wiederkehrendeErinnerung.empfaengerId, session.user.nutzerId ?? -1),
        lte(wiederkehrendeErinnerung.naechsteFaelligkeit, tagesende(jetzt)),
      ),
    )
    .orderBy(asc(wiederkehrendeErinnerung.naechsteFaelligkeit));

  return {
    ueberfaellig,
    dieseWoche,
    meinePunkte,
    anstehende,
    ohneTrainer,
    offeneRechnungen,
    erinnerungen,
  };
}

export interface TrainerDashboard {
  trainerId: number | null;
  anfragen: (WorkshopEintrag & { zuweisungId: number })[];
  meineWorkshops: WorkshopEintrag[];
  meinePunkte: PunktEintrag[];
  feedbackOffen: WorkshopEintrag[];
}

export async function getTrainerDashboard(
  session: Session,
  jetzt: Date,
): Promise<TrainerDashboard> {
  const nutzerId = session.user.nutzerId ?? -1;

  // aktiv-guard mirrors assertTrainerAccess: a deactivated trainer sees nothing.
  const [eigenerTrainer] = await db
    .select({ id: trainer.id })
    .from(trainer)
    .where(and(eq(trainer.nutzerId, nutzerId), eq(trainer.aktiv, true)))
    .limit(1);
  if (!eigenerTrainer) {
    return { trainerId: null, anfragen: [], meineWorkshops: [], meinePunkte: [], feedbackOffen: [] };
  }

  const zeilen = await db
    .select({
      ...workshopSpalten,
      termin2: workshop.termin2,
      zuweisungId: zuweisung.id,
      zuweisungStatus: zuweisung.status,
      feedbackId: trainerFeedback.id,
    })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .innerJoin(zuweisung, eq(zuweisung.workshopId, workshop.id))
    .leftJoin(
      trainerFeedback,
      and(
        eq(trainerFeedback.workshopId, workshop.id),
        eq(trainerFeedback.trainerId, eigenerTrainer.id),
      ),
    )
    .where(
      and(
        eq(zuweisung.trainerId, eigenerTrainer.id),
        ne(zuweisung.status, "abgesagt"),
        isNull(workshop.archiviertAm),
        notInArray(workshop.status, INAKTIVE_STATUS),
      ),
    )
    .orderBy(sql`${workshop.termin1} ASC NULLS LAST`);

  const alsEintrag = ({ id, name, firma, status, termin1 }: (typeof zeilen)[number]) => ({
    id,
    name,
    firma,
    status,
    termin1,
  });

  const meinePunkte = await offenePunkteQuery()
    .where(
      and(eq(checkpunkt.status, "offen"), eq(checkpunkt.verantwortlichUserId, nutzerId), lebendig),
    )
    .orderBy(sql`${checkpunkt.faelligAm} ASC NULLS LAST`);

  return {
    trainerId: eigenerTrainer.id,
    anfragen: zeilen
      .filter((z) => z.zuweisungStatus === "angefragt")
      .map((z) => ({ ...alsEintrag(z), zuweisungId: z.zuweisungId })),
    meineWorkshops: zeilen
      .filter((z) => z.zuweisungStatus === "bestaetigt" && z.status !== "Done")
      .map(alsEintrag),
    meinePunkte,
    feedbackOffen: zeilen
      .filter((z) => {
        const ende = letzterTermin(z);
        return z.zuweisungStatus === "bestaetigt" && !z.feedbackId && ende !== null && ende < jetzt;
      })
      .map(alsEintrag),
  };
}
