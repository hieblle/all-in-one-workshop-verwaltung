import { and, desc, eq, gte, inArray, isNotNull, lte, ne, or, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { Session } from "next-auth";
import { db } from "@/db";
import {
  aenderung,
  modul,
  nutzer,
  trainer,
  vorschlag,
  workshop,
  zuweisung,
  type VorschlagStatus,
} from "@/db/schema";
import { isTeamRolle } from "@/lib/access";

// Visibility rule (SPEC §1/§2): trainers see every entry tied to a module,
// plus everything from their own workshops. Entries from other customers'
// workshops are shown without workshop/customer name.

export interface VorschlagEintrag {
  id: number;
  text: string;
  status: VorschlagStatus;
  modulId: number | null;
  modulName: string | null;
  workshopId: number;
  workshopName: string | null;
  erstelltVon: string;
  createdAt: Date;
  statusGeaendertAm: Date | null;
}

export interface AenderungEintrag {
  id: number;
  text: string;
  modulId: number | null;
  modulName: string | null;
  workshopId: number;
  workshopName: string | null;
  erstelltVon: string;
  createdAt: Date;
  vorschlagText: string | null;
}

export interface ChangelogFilter {
  workshopId?: number;
  modulIds?: number[];
  modulId?: number;
  status?: VorschlagStatus;
  trainerNutzerId?: number;
  von?: Date;
  bis?: Date;
}

/** Workshops a trainer session may see (assigned, not declined, active). */
export async function eigeneWorkshopIds(session: Session): Promise<number[]> {
  const zeilen = await db
    .select({ id: zuweisung.workshopId })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(
      and(
        eq(trainer.nutzerId, session.user.nutzerId ?? -1),
        eq(trainer.aktiv, true),
        ne(zuweisung.status, "abgesagt"),
      ),
    );
  return zeilen.map((z) => z.id);
}

async function sichtbarkeit(
  session: Session,
  spalten: { workshopId: AnyPgColumn; modulId: AnyPgColumn },
): Promise<{ bedingung?: SQL; eigene: Set<number> | null }> {
  if (isTeamRolle(session.user.rolle)) return { eigene: null };
  const eigene = await eigeneWorkshopIds(session);
  const bedingung = eigene.length
    ? or(isNotNull(spalten.modulId), inArray(spalten.workshopId, eigene))
    : isNotNull(spalten.modulId);
  return { bedingung, eigene: new Set(eigene) };
}

function filterBedingungen(
  f: ChangelogFilter,
  spalten: {
    workshopId: AnyPgColumn;
    modulId: AnyPgColumn;
    createdAt: AnyPgColumn;
    erstelltVonId: AnyPgColumn;
  },
): (SQL | undefined)[] {
  const modulBedingungen: SQL[] = [];
  if (f.modulIds?.length) modulBedingungen.push(inArray(spalten.modulId, f.modulIds));
  return [
    f.workshopId !== undefined && f.modulIds?.length
      ? or(eq(spalten.workshopId, f.workshopId), ...modulBedingungen)
      : f.workshopId !== undefined
        ? eq(spalten.workshopId, f.workshopId)
        : modulBedingungen[0],
    f.modulId !== undefined ? eq(spalten.modulId, f.modulId) : undefined,
    f.trainerNutzerId !== undefined ? eq(spalten.erstelltVonId, f.trainerNutzerId) : undefined,
    f.von ? gte(spalten.createdAt, f.von) : undefined,
    f.bis ? lte(spalten.createdAt, f.bis) : undefined,
  ];
}

export async function ladeVorschlaege(
  session: Session,
  f: ChangelogFilter = {},
): Promise<VorschlagEintrag[]> {
  const { bedingung, eigene } = await sichtbarkeit(session, vorschlag);
  const zeilen = await db
    .select({
      id: vorschlag.id,
      text: vorschlag.text,
      status: vorschlag.status,
      modulId: vorschlag.modulId,
      modulName: modul.name,
      workshopId: vorschlag.workshopId,
      workshopName: workshop.name,
      erstelltVon: nutzer.name,
      createdAt: vorschlag.createdAt,
      statusGeaendertAm: vorschlag.statusGeaendertAm,
    })
    .from(vorschlag)
    .innerJoin(workshop, eq(vorschlag.workshopId, workshop.id))
    .innerJoin(nutzer, eq(vorschlag.erstelltVonId, nutzer.id))
    .leftJoin(modul, eq(vorschlag.modulId, modul.id))
    .where(
      and(
        bedingung,
        f.status ? eq(vorschlag.status, f.status) : undefined,
        ...filterBedingungen(f, vorschlag),
      ),
    )
    .orderBy(desc(vorschlag.createdAt));

  return zeilen.map((z) => ({
    ...z,
    workshopName: eigene === null || eigene.has(z.workshopId) ? z.workshopName : null,
  }));
}

export async function ladeAenderungen(
  session: Session,
  f: ChangelogFilter = {},
): Promise<AenderungEintrag[]> {
  const { bedingung, eigene } = await sichtbarkeit(session, aenderung);
  const umgesetzterVorschlag = alias(vorschlag, "umgesetzter_vorschlag");
  const zeilen = await db
    .select({
      id: aenderung.id,
      text: aenderung.text,
      modulId: aenderung.modulId,
      modulName: modul.name,
      workshopId: aenderung.workshopId,
      workshopName: workshop.name,
      erstelltVon: nutzer.name,
      createdAt: aenderung.createdAt,
      vorschlagText: umgesetzterVorschlag.text,
    })
    .from(aenderung)
    .innerJoin(workshop, eq(aenderung.workshopId, workshop.id))
    .innerJoin(nutzer, eq(aenderung.erstelltVonId, nutzer.id))
    .leftJoin(modul, eq(aenderung.modulId, modul.id))
    .leftJoin(umgesetzterVorschlag, eq(aenderung.vorschlagId, umgesetzterVorschlag.id))
    .where(and(bedingung, ...filterBedingungen(f, aenderung)))
    .orderBy(desc(aenderung.createdAt));

  return zeilen.map((z) => ({
    ...z,
    workshopName: eigene === null || eigene.has(z.workshopId) ? z.workshopName : null,
  }));
}
