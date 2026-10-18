import { and, desc, eq, inArray, isNull, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checkpunkt,
  checkpunktVorlage,
  jobLauf,
  nutzer,
  trainer,
  trainerFeedback,
  wiederkehrendeErinnerung,
  workshop,
  zuweisung,
} from "@/db/schema";
import { formatDatum } from "@/lib/format";
import { HUB_URL, SERVICE_EMAIL } from "@/lib/konfig";
import { queueMail } from "@/lib/postausgang";
import {
  INAKTIVE_STATUS,
  letzterTermin,
  plusTage,
  tagesende,
  tagesSchluessel,
} from "@/lib/status";

export const ESKALATION_NACH_TAGEN = 2;
// Feedback automation only looks back this far, so the first run after an
// import doesn't mail trainers about workshops from months ago.
const FEEDBACK_RUECKBLICK_TAGE = 30;
const JOB_NAME = "tagesjob";
const ALARM_NACH_FEHLVERSUCHEN = 3;

export function istEskalationsfall(
  faelligAm: Date | null,
  now: Date,
  eskalationNachTagen: number = ESKALATION_NACH_TAGEN,
): boolean {
  if (!faelligAm) return false;
  return now > plusTage(faelligAm, eskalationNachTagen);
}

function link(workshopId: number): string {
  return `${HUB_URL}/workshops/${workshopId}`;
}

// --- 1. Trainer-Feedback -------------------------------------------------------

async function feedbackAutomatik(jetzt: Date): Promise<void> {
  const kandidaten = await db
    .select({
      zuweisungId: zuweisung.id,
      feedbackErinnerungAm: zuweisung.feedbackErinnerungAm,
      workshopId: workshop.id,
      workshopName: workshop.name,
      termin1: workshop.termin1,
      termin2: workshop.termin2,
      verantwortlichInternId: workshop.verantwortlichInternId,
      trainerId: trainer.id,
      trainerName: trainer.name,
      trainerEmail: trainer.email,
      feedbackId: trainerFeedback.id,
    })
    .from(zuweisung)
    .innerJoin(workshop, eq(zuweisung.workshopId, workshop.id))
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .leftJoin(
      trainerFeedback,
      and(
        eq(trainerFeedback.workshopId, zuweisung.workshopId),
        eq(trainerFeedback.trainerId, zuweisung.trainerId),
      ),
    )
    .where(
      and(
        eq(zuweisung.status, "bestaetigt"),
        eq(trainer.aktiv, true),
        isNull(workshop.archiviertAm),
        notInArray(workshop.status, INAKTIVE_STATUS),
      ),
    );

  for (const k of kandidaten) {
    if (k.feedbackId) continue;
    const ende = letzterTermin(k);
    if (!ende || ende < plusTage(jetzt, -FEEDBACK_RUECKBLICK_TAGE)) continue;

    // +1: one single reminder to the trainer (SPEC §5).
    if (!k.feedbackErinnerungAm && plusTage(ende, 1) <= jetzt) {
      await queueMail({
        anlass: "trainer_feedback_erinnerung",
        workshopId: k.workshopId,
        jetzt,
        an: k.trainerEmail,
        dedupeKey: `feedback_erinnerung:${k.zuweisungId}`,
        betreff: `Kurzes Feedback zu ${k.workshopName}?`,
        text: `Hallo ${k.trainerName},\n\ndanke für den Workshop „${k.workshopName}“! Bitte füll auf der Workshop-Seite kurz den Feedback-Bereich aus (2–3 Minuten) — und trag gern Verbesserungsvorschläge für Folien und Beispiele ein:\n\n${link(k.workshopId)}\n\nDanke!`,
      });
      await db
        .update(zuweisung)
        .set({ feedbackErinnerungAm: jetzt })
        .where(eq(zuweisung.id, k.zuweisungId));
    }

    // +7: still missing → task for the team instead of more trainer mails.
    if (plusTage(ende, 7) <= jetzt) {
      await db
        .insert(checkpunkt)
        .values({
          workshopId: k.workshopId,
          systemSchluessel: `feedback_fehlt:${k.trainerId}`,
          titel: `Trainer-Feedback von ${k.trainerName} fehlt — nachfragen`,
          phase: "Nachbereitung",
          verantwortlichUserId: k.verantwortlichInternId,
          faelligAm: jetzt,
        })
        .onConflictDoNothing();
    }
  }
}

// --- 2. Sammel-Mails & Eskalationen ----------------------------------------

interface FaelligerPunkt {
  titel: string;
  faelligAm: Date | null;
  workshopId: number;
  workshopName: string;
  verantwortlichEmail: string | null;
  verantwortlichName: string | null;
  verantwortlichRolle: string | null;
  verantwortlichInternEmail: string | null;
  linkFeld: string | null;
  formsVorabUrl: string | null;
  formsFeedbackUrl: string | null;
  notionProjectUrl: string | null;
}

function punktZeile(p: FaelligerPunkt): string {
  const extra =
    p.linkFeld === "forms_vorab"
      ? p.formsVorabUrl
      : p.linkFeld === "forms_feedback"
        ? p.formsFeedbackUrl
        : p.linkFeld === "notion"
          ? p.notionProjectUrl
          : null;
  return `• ${p.titel} — „${p.workshopName}“, fällig ${formatDatum(p.faelligAm)}\n  ${link(p.workshopId)}${extra ? `\n  Link: ${extra}` : ""}`;
}

function gruppiere<T>(liste: T[], schluessel: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const eintrag of liste) {
    const k = schluessel(eintrag);
    map.set(k, [...(map.get(k) ?? []), eintrag]);
  }
  return map;
}

async function sammelMails(jetzt: Date): Promise<void> {
  const verantwortlich = db
    .select({ id: nutzer.id, email: nutzer.email })
    .from(nutzer)
    .as("verantwortlich_intern");

  const faellige: FaelligerPunkt[] = await db
    .select({
      titel: sql<string>`coalesce(${checkpunkt.titel}, ${checkpunktVorlage.titel})`,
      faelligAm: checkpunkt.faelligAm,
      workshopId: workshop.id,
      workshopName: workshop.name,
      verantwortlichEmail: nutzer.email,
      verantwortlichName: nutzer.name,
      verantwortlichRolle: nutzer.rolle,
      verantwortlichInternEmail: verantwortlich.email,
      linkFeld: checkpunktVorlage.linkFeld,
      formsVorabUrl: workshop.formsVorabUrl,
      formsFeedbackUrl: workshop.formsFeedbackUrl,
      notionProjectUrl: workshop.notionProjectUrl,
    })
    .from(checkpunkt)
    .leftJoin(checkpunktVorlage, eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id))
    .innerJoin(workshop, eq(checkpunkt.workshopId, workshop.id))
    .leftJoin(nutzer, eq(checkpunkt.verantwortlichUserId, nutzer.id))
    .leftJoin(verantwortlich, eq(workshop.verantwortlichInternId, verantwortlich.id))
    .where(
      and(
        eq(checkpunkt.status, "offen"),
        lte(checkpunkt.faelligAm, tagesende(jetzt)),
        isNull(workshop.archiviertAm),
        notInArray(workshop.status, INAKTIVE_STATUS),
      ),
    );

  const tag = tagesSchluessel(jetzt);

  // One digest per person and day; unassigned tasks go to service@ (SPEC §5).
  for (const [email, punkte] of gruppiere(faellige, (p) => p.verantwortlichEmail ?? SERVICE_EMAIL)) {
    const name = punkte[0].verantwortlichName ?? "Team";
    await queueMail({
      anlass: "sammelmail",
      jetzt,
      an: email,
      dedupeKey: `sammelmail:${email}:${tag}`,
      betreff: `Workshop-Hub: ${punkte.length} ${punkte.length === 1 ? "Aufgabe" : "Aufgaben"} fällig`,
      text: `Hallo ${name},\n\nheute fällig oder überfällig:\n\n${punkte.map(punktZeile).join("\n\n")}\n\nBitte im Workshop-Hub erledigen oder umhängen.`,
    });
  }

  // Escalation after 2 days: team tasks → admins, trainer tasks → the
  // workshop's verantwortlich intern (or service@).
  const eskalation = faellige.filter((p) => istEskalationsfall(p.faelligAm, jetzt));
  if (eskalation.length === 0) return;

  const admins = await db
    .select({ email: nutzer.email })
    .from(nutzer)
    .where(eq(nutzer.rolle, "admin"));

  const empfaengerVon = (p: FaelligerPunkt): string[] =>
    p.verantwortlichRolle === "trainer"
      ? [p.verantwortlichInternEmail ?? SERVICE_EMAIL]
      : admins.map((a) => a.email);

  const proEmpfaenger = new Map<string, FaelligerPunkt[]>();
  for (const p of eskalation) {
    for (const email of empfaengerVon(p)) {
      proEmpfaenger.set(email, [...(proEmpfaenger.get(email) ?? []), p]);
    }
  }

  for (const [email, punkte] of proEmpfaenger) {
    await queueMail({
      anlass: "eskalation",
      jetzt,
      an: email,
      dedupeKey: `eskalation:${email}:${tag}`,
      betreff: `Workshop-Hub: ${punkte.length} seit über ${ESKALATION_NACH_TAGEN} Tagen überfällig`,
      text: `Hallo,\n\nfolgende Aufgaben sind seit mehr als ${ESKALATION_NACH_TAGEN} Tagen überfällig:\n\n${punkte
        .map((p) => `${punktZeile(p)}\n  zuständig: ${p.verantwortlichName ?? "niemand (service@)"}`)
        .join("\n\n")}\n\nBitte nachfassen.`,
    });
  }
}

// --- 3. Wiederkehrende Erinnerungen --------------------------------------

async function wiederkehrende(jetzt: Date): Promise<void> {
  const faellig = await db
    .select({
      id: wiederkehrendeErinnerung.id,
      titel: wiederkehrendeErinnerung.titel,
      naechsteFaelligkeit: wiederkehrendeErinnerung.naechsteFaelligkeit,
      link: wiederkehrendeErinnerung.link,
      notiz: wiederkehrendeErinnerung.notiz,
      email: nutzer.email,
      name: nutzer.name,
    })
    .from(wiederkehrendeErinnerung)
    .innerJoin(nutzer, eq(wiederkehrendeErinnerung.empfaengerId, nutzer.id))
    .where(
      and(
        eq(wiederkehrendeErinnerung.aktiv, true),
        lte(wiederkehrendeErinnerung.naechsteFaelligkeit, tagesende(jetzt)),
      ),
    );

  for (const e of faellig) {
    // One mail per due date; the reminder stays on the dashboard until ticked.
    await queueMail({
      anlass: "wiederkehrende_erinnerung",
      jetzt,
      an: e.email,
      dedupeKey: `wiederkehrend:${e.id}:${tagesSchluessel(e.naechsteFaelligkeit)}`,
      betreff: `Erinnerung: ${e.titel}`,
      text: `Hallo ${e.name},\n\nErinnerung: ${e.titel}${e.notiz ? `\n\n${e.notiz}` : ""}${e.link ? `\n\nLink: ${e.link}` : ""}\n\nAbhaken im Dashboard: ${HUB_URL}/`,
    });
  }
}

// --- Einstieg ----------------------------------------------------------------

export interface TagesjobErgebnis {
  erfolg: boolean;
  meldung: string;
}

/**
 * The daily run (07:00 via pg-boss; in the MVP triggered manually from
 * /system, optionally with a simulated date). Failures are recorded; three in
 * a row raise an alarm mail to the admins.
 */
export async function fuehreTagesjobAus(jetzt: Date): Promise<TagesjobErgebnis> {
  try {
    await feedbackAutomatik(jetzt);
    await sammelMails(jetzt);
    await wiederkehrende(jetzt);
    const meldung = `ok (${formatDatum(jetzt)})`;
    await db.insert(jobLauf).values({ job: JOB_NAME, erfolg: true, meldung });
    return { erfolg: true, meldung };
  } catch (error) {
    const meldung = error instanceof Error ? error.message : String(error);
    console.error("[tagesjob] fehlgeschlagen:", error);
    await db.insert(jobLauf).values({ job: JOB_NAME, erfolg: false, meldung });
    await pruefeAlarm(jetzt);
    return { erfolg: false, meldung };
  }
}

async function pruefeAlarm(jetzt: Date): Promise<void> {
  const letzte = await db
    .select({ erfolg: jobLauf.erfolg, meldung: jobLauf.meldung })
    .from(jobLauf)
    .where(eq(jobLauf.job, JOB_NAME))
    .orderBy(desc(jobLauf.id))
    .limit(ALARM_NACH_FEHLVERSUCHEN);
  if (letzte.length < ALARM_NACH_FEHLVERSUCHEN || letzte.some((l) => l.erfolg)) return;

  const admins = await db
    .select({ email: nutzer.email })
    .from(nutzer)
    .where(inArray(nutzer.rolle, ["admin"]));
  for (const admin of admins) {
    await queueMail({
      anlass: "alarm",
      jetzt,
      an: admin.email,
      dedupeKey: `alarm:${JOB_NAME}:${admin.email}:${tagesSchluessel(jetzt)}`,
      betreff: "⚠️ Workshop-Hub: Tagesjob schlägt wiederholt fehl",
      text: `Der Tagesjob (Erinnerungen, Feedback, Sammel-Mails) ist ${ALARM_NACH_FEHLVERSUCHEN}× hintereinander fehlgeschlagen.\n\nLetzte Meldung: ${letzte[0].meldung}\n\nStatus: ${HUB_URL}/system`,
    });
  }
}
