import { and, asc, eq, gte, inArray, lt, lte, ne, notExists, sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/db";
import {
  checkpunkt,
  checkpunktVorlage,
  kunde,
  nutzer,
  trainer,
  workshop,
  zuweisung,
  type WorkshopStatus,
} from "@/db/schema";

// The dashboard is the in-app replacement for reminder mails until the Graph
// consent lands: everything the daily job would send is surfaced here live.

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

export interface TeamDashboard {
  ueberfaellig: PunktEintrag[];
  dieseWoche: PunktEintrag[];
  meinePunkte: PunktEintrag[];
  anstehende: WorkshopEintrag[];
  ohneTrainer: WorkshopEintrag[];
  offeneRechnungen: WorkshopEintrag[];
}

const punktTitel = sql<string>`coalesce(${checkpunkt.titel}, ${checkpunktVorlage.titel})`;

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
    .leftJoin(
      checkpunktVorlage,
      eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id),
    )
    .innerJoin(workshop, eq(checkpunkt.workshopId, workshop.id))
    .leftJoin(nutzer, eq(checkpunkt.verantwortlichUserId, nutzer.id));
}

export async function getTeamDashboard(
  session: Session,
  now: Date = new Date(),
): Promise<TeamDashboard> {
  const inSiebenTagen = new Date(now);
  inSiebenTagen.setDate(inSiebenTagen.getDate() + 7);
  const inDreissigTagen = new Date(now);
  inDreissigTagen.setDate(inDreissigTagen.getDate() + 30);

  const aktiv = ne(workshop.status, "On-Hold/Abgesagt");

  const ueberfaellig = await offenePunkteQuery()
    .where(
      and(eq(checkpunkt.status, "offen"), lt(checkpunkt.faelligAm, now), aktiv),
    )
    .orderBy(asc(checkpunkt.faelligAm));

  const dieseWoche = await offenePunkteQuery()
    .where(
      and(
        eq(checkpunkt.status, "offen"),
        gte(checkpunkt.faelligAm, now),
        lte(checkpunkt.faelligAm, inSiebenTagen),
        aktiv,
      ),
    )
    .orderBy(asc(checkpunkt.faelligAm));

  const meinePunkte = await offenePunkteQuery()
    .where(
      and(
        eq(checkpunkt.status, "offen"),
        eq(checkpunkt.verantwortlichUserId, session.user.nutzerId ?? -1),
        aktiv,
      ),
    )
    .orderBy(sql`${checkpunkt.faelligAm} ASC NULLS LAST`);

  const anstehende = await db
    .select({
      id: workshop.id,
      name: workshop.name,
      firma: kunde.firma,
      status: workshop.status,
      termin1: workshop.termin1,
    })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(
      and(
        gte(workshop.termin1, now),
        lte(workshop.termin1, inDreissigTagen),
        aktiv,
        ne(workshop.status, "Done"),
      ),
    )
    .orderBy(asc(workshop.termin1));

  // Active workshops (offer accepted or later) with no trainer at all.
  const ohneTrainer = await db
    .select({
      id: workshop.id,
      name: workshop.name,
      firma: kunde.firma,
      status: workshop.status,
      termin1: workshop.termin1,
    })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(
      and(
        inArray(workshop.status, ["Angebot", "Vorbereitung", "Durchführung"]),
        notExists(
          db
            .select({ one: sql`1` })
            .from(zuweisung)
            .where(eq(zuweisung.workshopId, workshop.id)),
        ),
      ),
    )
    .orderBy(sql`${workshop.termin1} ASC NULLS LAST`);

  const offeneRechnungen = await db
    .select({
      id: workshop.id,
      name: workshop.name,
      firma: kunde.firma,
      status: workshop.status,
      termin1: workshop.termin1,
    })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(
      and(
        inArray(workshop.status, ["Nachbereitung", "Done"]),
        ne(workshop.rechnungStatus, "gesendet"),
      ),
    )
    .orderBy(sql`${workshop.termin1} ASC NULLS LAST`);

  return { ueberfaellig, dieseWoche, meinePunkte, anstehende, ohneTrainer, offeneRechnungen };
}

export interface TrainerDashboard {
  trainerId: number | null;
  verfuegbarkeitNotiz: string | null;
  meineWorkshops: WorkshopEintrag[];
  meinePunkte: PunktEintrag[];
}

export async function getTrainerDashboard(
  session: Session,
): Promise<TrainerDashboard> {
  const nutzerId = session.user.nutzerId ?? -1;

  const [eigenerTrainer] = await db
    .select({
      id: trainer.id,
      verfuegbarkeitNotiz: trainer.verfuegbarkeitNotiz,
    })
    .from(trainer)
    .where(eq(trainer.nutzerId, nutzerId))
    .limit(1);

  const meineWorkshops = eigenerTrainer
    ? await db
        .select({
          id: workshop.id,
          name: workshop.name,
          firma: kunde.firma,
          status: workshop.status,
          termin1: workshop.termin1,
        })
        .from(workshop)
        .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
        .innerJoin(zuweisung, eq(zuweisung.workshopId, workshop.id))
        .where(
          and(
            eq(zuweisung.trainerId, eigenerTrainer.id),
            ne(workshop.status, "On-Hold/Abgesagt"),
            ne(workshop.status, "Done"),
          ),
        )
        .orderBy(sql`${workshop.termin1} ASC NULLS LAST`)
    : [];

  const meinePunkte = await offenePunkteQuery()
    .where(
      and(
        eq(checkpunkt.status, "offen"),
        eq(checkpunkt.verantwortlichUserId, nutzerId),
        ne(workshop.status, "On-Hold/Abgesagt"),
      ),
    )
    .orderBy(sql`${checkpunkt.faelligAm} ASC NULLS LAST`);

  return {
    trainerId: eigenerTrainer?.id ?? null,
    verfuegbarkeitNotiz: eigenerTrainer?.verfuegbarkeitNotiz ?? null,
    meineWorkshops,
    meinePunkte,
  };
}
