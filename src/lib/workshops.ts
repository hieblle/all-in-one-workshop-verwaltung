import { and, asc, desc, eq, exists, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/db";
import {
  checkpunkt,
  checkpunktVorlage,
  kunde,
  nutzer,
  threadKommentar,
  trainer,
  workshop,
  zuweisung,
  type WorkshopStatus,
  type WorkshopType,
} from "@/db/schema";
import { assertTrainerAccess, isTeamRolle } from "@/lib/access";

export interface WorkshopFilter {
  status?: WorkshopStatus;
  type?: WorkshopType;
  trainerId?: number;
  von?: Date;
  bis?: Date;
  suche?: string;
}

export interface WorkshopListEintrag {
  id: number;
  name: string;
  firma: string;
  type: WorkshopType;
  status: WorkshopStatus;
  termin1: Date | null;
  wsBetrag: string | null;
}

/**
 * Role-aware workshop listing: team sees everything (with filters), external
 * trainers only workshops they are assigned to (rule from CLAUDE.md §Rechte).
 */
export async function findWorkshops(
  session: Session,
  filter: WorkshopFilter,
): Promise<WorkshopListEintrag[]> {
  const user = session.user;
  const conditions = [];

  if (filter.status) conditions.push(eq(workshop.status, filter.status));
  if (filter.type) conditions.push(eq(workshop.type, filter.type));
  if (filter.von) conditions.push(gte(workshop.termin1, filter.von));
  if (filter.bis) conditions.push(lte(workshop.termin1, filter.bis));
  if (filter.suche) {
    // Escape the escape char first, then the ILIKE wildcards.
    const muster = `%${filter.suche
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_")}%`;
    conditions.push(
      or(ilike(workshop.name, muster), ilike(kunde.firma, muster)),
    );
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

  if (!isTeamRolle(user.rolle)) {
    // Trainer: restrict to assigned workshops via their trainer record.
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
            ),
          ),
      ),
    );
  }

  return db
    .select({
      id: workshop.id,
      name: workshop.name,
      firma: kunde.firma,
      type: workshop.type,
      status: workshop.status,
      termin1: workshop.termin1,
      wsBetrag: workshop.wsBetrag,
    })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      sql`${workshop.termin1} ASC NULLS LAST`,
      desc(workshop.createdAt),
    );
}

export interface WorkshopDetail {
  workshop: typeof workshop.$inferSelect;
  firma: string;
  zuweisungen: {
    id: number;
    rolle: string;
    status: string;
    trainerId: number;
    trainerName: string;
    trainerEmail: string;
  }[];
  checkpunkte: {
    id: number;
    titel: string;
    phase: WorkshopStatus;
    faelligAm: Date | null;
    status: string;
    erledigtVia: string | null;
    verantwortlichUserId: number | null;
    verantwortlichName: string | null;
  }[];
  kommentare: {
    id: number;
    text: string;
    createdAt: Date;
    autorName: string;
  }[];
}

/**
 * Loads a workshop with all detail sections. Enforces assertTrainerAccess;
 * for trainer roles the checklist is reduced to their own items (§3: externe
 * Trainer sehen nur eigene Checklistenpunkte). Financial fields must
 * additionally be hidden in the UI for trainer roles.
 */
export async function getWorkshopDetail(
  session: Session,
  workshopId: number,
): Promise<WorkshopDetail | null> {
  await assertTrainerAccess(session, workshopId);

  const [ws] = await db
    .select({ workshop: workshop, firma: kunde.firma })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(eq(workshop.id, workshopId))
    .limit(1);
  if (!ws) return null;

  const zuweisungen = await db
    .select({
      id: zuweisung.id,
      rolle: zuweisung.rolle,
      status: zuweisung.status,
      trainerId: trainer.id,
      trainerName: trainer.name,
      trainerEmail: trainer.email,
    })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(eq(zuweisung.workshopId, workshopId))
    .orderBy(asc(zuweisung.rolle));

  const istTeam = isTeamRolle(session.user.rolle);
  const checkpunktConditions = [eq(checkpunkt.workshopId, workshopId)];
  if (!istTeam) {
    checkpunktConditions.push(
      eq(checkpunkt.verantwortlichUserId, session.user.nutzerId ?? -1),
    );
  }

  // Ad-hoc items carry their own titel/phase; template items fall back to
  // the vorlage values — hence left join + coalesce.
  const checkpunkte = await db
    .select({
      id: checkpunkt.id,
      titel: sql<string>`coalesce(${checkpunkt.titel}, ${checkpunktVorlage.titel})`,
      phase: sql<WorkshopStatus>`coalesce(${checkpunkt.phase}, ${checkpunktVorlage.phase})`,
      faelligAm: checkpunkt.faelligAm,
      status: checkpunkt.status,
      erledigtVia: checkpunkt.erledigtVia,
      verantwortlichUserId: checkpunkt.verantwortlichUserId,
      verantwortlichName: nutzer.name,
    })
    .from(checkpunkt)
    .leftJoin(
      checkpunktVorlage,
      eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id),
    )
    .leftJoin(nutzer, eq(checkpunkt.verantwortlichUserId, nutzer.id))
    .where(and(...checkpunktConditions))
    .orderBy(sql`${checkpunkt.faelligAm} ASC NULLS LAST`, asc(checkpunkt.id));

  const kommentare = await db
    .select({
      id: threadKommentar.id,
      text: threadKommentar.text,
      createdAt: threadKommentar.createdAt,
      autorName: nutzer.name,
    })
    .from(threadKommentar)
    .innerJoin(nutzer, eq(threadKommentar.autorId, nutzer.id))
    .where(eq(threadKommentar.workshopId, workshopId))
    .orderBy(asc(threadKommentar.createdAt));

  return { workshop: ws.workshop, firma: ws.firma, zuweisungen, checkpunkte, kommentare };
}
