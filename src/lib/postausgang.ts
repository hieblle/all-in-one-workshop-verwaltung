import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  nutzer,
  postausgang,
  trainer,
  type KalenderPayload,
  type PostausgangStatus,
} from "@/db/schema";
import { SERVICE_EMAIL } from "@/lib/konfig";

// Single entry point for everything the hub sends (SPEC §7). In the MVP
// every entry stays a preview — the Graph adapter (stage 3) will pick up
// entries and turn them into drafts or real mails. Never call Graph directly
// from actions: this queue is the only path out.

interface Basis {
  anlass: string;
  workshopId?: number | null;
  dedupeKey?: string;
  jetzt: Date;
}

export interface MailAuftrag extends Basis {
  an: string;
  betreff: string;
  text: string;
}

export interface KalenderAuftrag extends Basis {
  payload: KalenderPayload;
}

// The hub only ever writes to people it knows: team, trainers and the
// service mailbox — never customers or participants (SPEC §0).
export async function istErlaubterEmpfaenger(email: string): Promise<boolean> {
  const adresse = email.toLowerCase();
  if (adresse === SERVICE_EMAIL) return true;
  const [alsNutzer] = await db
    .select({ one: sql`1` })
    .from(nutzer)
    .where(eq(nutzer.email, adresse))
    .limit(1);
  if (alsNutzer) return true;
  const [alsTrainer] = await db
    .select({ one: sql`1` })
    .from(trainer)
    .where(eq(trainer.email, adresse))
    .limit(1);
  return alsTrainer !== undefined;
}

function zielStatus(): PostausgangStatus {
  // Stage 3 adds "entwurf" (drafts in the sender mailbox) and real sending.
  return "vorschau";
}

/** Queues a mail. Returns false if it was a duplicate (dedupeKey). */
export async function queueMail(auftrag: MailAuftrag): Promise<boolean> {
  const erlaubt = await istErlaubterEmpfaenger(auftrag.an);
  const eingefuegt = await db
    .insert(postausgang)
    .values({
      art: "mail",
      anlass: auftrag.anlass,
      empfaenger: auftrag.an.toLowerCase(),
      betreff: auftrag.betreff,
      text: auftrag.text,
      workshopId: auftrag.workshopId ?? null,
      status: erlaubt ? zielStatus() : "blockiert",
      fehler: erlaubt ? null : "Empfänger ist weder Team, Trainer noch service@",
      dedupeKey: auftrag.dedupeKey ?? null,
      erzeugtFuer: auftrag.jetzt,
    })
    .onConflictDoNothing()
    .returning({ id: postausgang.id });
  return eingefuegt.length > 0;
}

/** Queues a calendar action for the service@ calendar. */
export async function queueKalender(auftrag: KalenderAuftrag): Promise<void> {
  const p = auftrag.payload;
  const teilnehmer = p.teilnehmer.length ? p.teilnehmer.join(", ") : "keine";
  await db
    .insert(postausgang)
    .values({
      art: "kalender",
      anlass: `kalender_${p.aktion}`,
      empfaenger: SERVICE_EMAIL,
      betreff: p.titel,
      text: `${p.aktion.toUpperCase()} · ${p.start} – ${p.ende}\nOrt: ${p.ort ?? "–"}\nTeilnehmer: ${teilnehmer}${p.teamsMeetingAnfordern ? "\nTeams-Meeting wird angefordert" : ""}\n\n${p.beschreibung}`,
      kalender: p,
      workshopId: auftrag.workshopId ?? null,
      status: zielStatus(),
      dedupeKey: auftrag.dedupeKey ?? null,
      erzeugtFuer: auftrag.jetzt,
    })
    .onConflictDoNothing();
}
