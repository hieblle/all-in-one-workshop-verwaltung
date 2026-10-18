import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistenVorlage,
  checkpunkt,
  checkpunktVorlage,
  trainer,
  workshop,
  zuweisung,
} from "@/db/schema";
import { istFixiert, modusKategorie } from "@/lib/status";

type Rolle = "team" | "trainer_lead" | "trainer_co";
type Regel =
  | "termin_eingetragen"
  | "trainer_zugewiesen"
  | "praesentation_eingetragen"
  | "angebot_angenommen";

// Due date relative to termin_1; negative offsets mean "days before".
export function berechneFaelligAm(
  termin1: Date | null,
  offsetTage: number,
): Date | null {
  if (!termin1) return null;
  const faellig = new Date(termin1);
  faellig.setDate(faellig.getDate() + offsetTage);
  return faellig;
}

export interface Verantwortliche {
  teamId: number | null;
  leadId: number | null;
  coId: number | null;
}

// Team tasks go to the workshop's verantwortlich intern (null → reminders go
// to the service mailbox), trainer tasks to the confirmed trainer (SPEC §5).
export function resolveVerantwortlich(
  rolle: Rolle,
  v: Verantwortliche,
): number | null {
  if (rolle === "trainer_lead") return v.leadId;
  if (rolle === "trainer_co") return v.coId;
  return v.teamId;
}

export interface RegelKontext {
  termin1: Date | null;
  hatTrainer: boolean;
  hatPraesentation: boolean;
  fixiert: boolean;
}

export function regelErfuellt(regel: Regel, k: RegelKontext): boolean {
  switch (regel) {
    case "termin_eingetragen":
      return k.termin1 !== null;
    case "trainer_zugewiesen":
      return k.hatTrainer;
    case "praesentation_eingetragen":
      return k.hatPraesentation;
    case "angebot_angenommen":
      return k.fixiert;
  }
}

/**
 * Brings a workshop's task list in line with its templates and current data.
 * Idempotent — call it after every change to a workshop, its trainers or the
 * templates:
 * - instantiates missing template tasks (all phases, so the overview always
 *   shows the whole process),
 * - skips tasks that don't fit the delivery mode (and reopens them if the
 *   mode changes back),
 * - fills unassigned responsibles,
 * - recomputes due dates of open tasks,
 * - ticks off / reopens tasks with an auto-check rule.
 */
export async function synchronisiereCheckliste(
  workshopId: number,
  jetzt: Date,
): Promise<void> {
  const [ws] = await db
    .select({
      type: workshop.type,
      modus: workshop.modus,
      status: workshop.status,
      termin1: workshop.termin1,
      verantwortlichInternId: workshop.verantwortlichInternId,
      verwendetesSlidedeck: workshop.verwendetesSlidedeck,
    })
    .from(workshop)
    .where(eq(workshop.id, workshopId))
    .limit(1);
  if (!ws) return;

  const zuweisungen = await db
    .select({
      rolle: zuweisung.rolle,
      status: zuweisung.status,
      nutzerId: trainer.nutzerId,
    })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(eq(zuweisung.workshopId, workshopId));
  const bestaetigt = zuweisungen.filter((z) => z.status === "bestaetigt");
  const verantwortliche: Verantwortliche = {
    teamId: ws.verantwortlichInternId,
    leadId: bestaetigt.find((z) => z.rolle === "lead")?.nutzerId ?? null,
    coId: bestaetigt.find((z) => z.rolle === "co")?.nutzerId ?? null,
  };
  const kontext: RegelKontext = {
    termin1: ws.termin1,
    hatTrainer: zuweisungen.some((z) => z.status !== "abgesagt"),
    hatPraesentation: ws.verwendetesSlidedeck !== null,
    fixiert: istFixiert(ws.status),
  };

  const vorlagePunkte = await db
    .select({ id: checkpunktVorlage.id })
    .from(checkpunktVorlage)
    .innerJoin(
      checklistenVorlage,
      eq(checkpunktVorlage.vorlageId, checklistenVorlage.id),
    )
    .where(
      or(
        isNull(checklistenVorlage.giltFuerType),
        eq(checklistenVorlage.giltFuerType, ws.type),
      ),
    );
  if (vorlagePunkte.length > 0) {
    await db
      .insert(checkpunkt)
      .values(vorlagePunkte.map((p) => ({ workshopId, vorlagePunktId: p.id })))
      .onConflictDoNothing();
  }

  const punkte = await db
    .select({
      id: checkpunkt.id,
      status: checkpunkt.status,
      erledigtVia: checkpunkt.erledigtVia,
      verantwortlichUserId: checkpunkt.verantwortlichUserId,
      faelligAm: checkpunkt.faelligAm,
      rolle: checkpunktVorlage.verantwortlichRolle,
      offsetTage: checkpunktVorlage.faelligOffsetTage,
      regel: checkpunktVorlage.autoCheckRegel,
      nurModus: checkpunktVorlage.nurModus,
    })
    .from(checkpunkt)
    .innerJoin(
      checkpunktVorlage,
      eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id),
    )
    .where(eq(checkpunkt.workshopId, workshopId));

  const kategorie = modusKategorie(ws.modus);
  for (const p of punkte) {
    const aenderung: Partial<typeof checkpunkt.$inferInsert> = {};
    const passtModus =
      p.nurModus === null || kategorie === null || p.nurModus === kategorie;
    let status = p.status;

    if (!passtModus && status === "offen") {
      status = "uebersprungen";
      Object.assign(aenderung, { status, erledigtVia: "auto", erledigtAm: jetzt });
    } else if (passtModus && status === "uebersprungen" && p.erledigtVia === "auto") {
      status = "offen";
      Object.assign(aenderung, { status, erledigtVia: null, erledigtAm: null });
    }

    if (p.regel && passtModus) {
      const erfuellt = regelErfuellt(p.regel, kontext);
      if (erfuellt && status === "offen") {
        status = "erledigt";
        Object.assign(aenderung, {
          status,
          erledigtVia: "auto",
          erledigtAm: jetzt,
          erledigtVonId: null,
        });
      } else if (!erfuellt && status === "erledigt" && p.erledigtVia === "auto") {
        status = "offen";
        Object.assign(aenderung, { status, erledigtVia: null, erledigtAm: null });
      }
    }

    if (status === "offen") {
      if (p.verantwortlichUserId === null) {
        const ziel = resolveVerantwortlich(p.rolle, verantwortliche);
        if (ziel !== null) aenderung.verantwortlichUserId = ziel;
      }
      const faellig = berechneFaelligAm(ws.termin1, p.offsetTage);
      if ((faellig?.getTime() ?? null) !== (p.faelligAm?.getTime() ?? null)) {
        aenderung.faelligAm = faellig;
      }
    }

    if (Object.keys(aenderung).length > 0) {
      await db.update(checkpunkt).set(aenderung).where(eq(checkpunkt.id, p.id));
    }
  }
}

/**
 * Moves open tasks away from a person — used when the verantwortlich intern
 * changes or a trainer drops out. Passing null as target un-assigns them so
 * the next synchronisiereCheckliste fills in the new default. Tasks someone
 * deliberately re-assigned to a third person stay untouched.
 */
export async function uebertrageOffenePunkte(
  workshopId: number,
  vonNutzerId: number,
  anNutzerId: number | null,
): Promise<void> {
  await db
    .update(checkpunkt)
    .set({ verantwortlichUserId: anNutzerId })
    .where(
      and(
        eq(checkpunkt.workshopId, workshopId),
        eq(checkpunkt.status, "offen"),
        eq(checkpunkt.verantwortlichUserId, vonNutzerId),
      ),
    );
}
