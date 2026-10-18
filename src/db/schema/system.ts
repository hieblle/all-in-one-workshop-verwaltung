import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nutzer } from "./nutzer";
import { workshop } from "./workshop";

// --- Postausgang -------------------------------------------------------------
// Every mail and calendar action the hub produces lands here first. It is the
// outbox, the protocol (SPEC §7) and — in the MVP — the preview: nothing
// leaves the hub while versandmodus = "vorschau".

export const postausgangArtEnum = pgEnum("postausgang_art", ["mail", "kalender"]);

export const postausgangStatusEnum = pgEnum("postausgang_status", [
  "vorschau", // MVP: generated, never sent
  "entwurf", // stage 3 test phase: stored as draft in the sender mailbox
  "gesendet",
  "fehlgeschlagen",
  "blockiert", // recipient not on the allow-list
]);

export type PostausgangStatus =
  (typeof postausgangStatusEnum.enumValues)[number];

export interface KalenderPayload {
  aktion: "anlegen" | "aktualisieren" | "absagen";
  terminArt: KalenderTerminArt;
  titel: string;
  start: string;
  ende: string;
  ort: string | null;
  vorlaeufig: boolean;
  teilnehmer: string[];
  teamsMeetingAnfordern: boolean;
  beschreibung: string;
}

export const postausgang = pgTable(
  "postausgang",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    art: postausgangArtEnum("art").notNull(),
    // Machine-readable reason, e.g. "trainer_anfrage", "sammelmail".
    anlass: text("anlass").notNull(),
    empfaenger: text("empfaenger").notNull(),
    betreff: text("betreff").notNull(),
    text: text("text").notNull(),
    kalender: jsonb("kalender").$type<KalenderPayload>(),
    workshopId: integer("workshop_id").references(() => workshop.id),
    status: postausgangStatusEnum("status").notNull(),
    fehler: text("fehler"),
    // Prevents duplicates of one-off mails (e.g. one digest per person and day).
    dedupeKey: text("dedupe_key"),
    // Simulated "now" at creation time (differs from created_at while the
    // admin simulates a date).
    erzeugtFuer: timestamp("erzeugt_fuer", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("postausgang_dedupe_unique").on(table.dedupeKey)],
);

// --- Kalender-Stand ---------------------------------------------------------
// What the hub believes is in the service@ calendar per workshop date, so it
// only touches events it created itself (SPEC §6) and only sends real changes.

export const kalenderTerminArtEnum = pgEnum("kalender_termin_art", [
  "termin1",
  "termin2",
  "fup",
]);

export type KalenderTerminArt =
  (typeof kalenderTerminArtEnum.enumValues)[number];

export const kalenderEintragStatusEnum = pgEnum("kalender_eintrag_status", [
  "vorlaeufig",
  "fixiert",
  "on_hold",
  "abgesagt",
]);

export const kalenderEintrag = pgTable(
  "kalender_eintrag",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id),
    terminArt: kalenderTerminArtEnum("termin_art").notNull(),
    // Graph event id once the Microsoft connection exists (stage 3).
    externeId: text("externe_id"),
    status: kalenderEintragStatusEnum("status").notNull(),
    // Fingerprint of the last pushed state (start, title, attendees, …).
    fingerabdruck: text("fingerabdruck").notNull(),
    teamsMeetingAngefordert: boolean("teams_meeting_angefordert")
      .notNull()
      .default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("kalender_eintrag_workshop_art_unique").on(
      table.workshopId,
      table.terminArt,
    ),
  ],
);

// --- Verlauf ----------------------------------------------------------------
// Who changed what when (SPEC §1). One generic table, written by
// src/lib/verlauf.ts from every mutating action.

export const verlauf = pgTable("verlauf", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entitaet: text("entitaet").notNull(),
  entitaetId: integer("entitaet_id").notNull(),
  workshopId: integer("workshop_id"),
  feld: text("feld").notNull(),
  alt: text("alt"),
  neu: text("neu"),
  nutzerId: integer("nutzer_id").references(() => nutzer.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Wiederkehrende Erinnerungen -------------------------------------------
// Admin-only reminders (SPEC §5), e.g. "Trainer-Feedbackrunde terminieren".

export const rhythmusEnum = pgEnum("rhythmus", [
  "woechentlich",
  "monatlich",
  "monatlich_erster_montag",
  "quartalsweise",
  "jaehrlich",
]);

export type Rhythmus = (typeof rhythmusEnum.enumValues)[number];

export const wiederkehrendeErinnerung = pgTable("wiederkehrende_erinnerung", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  titel: text("titel").notNull(),
  rhythmus: rhythmusEnum("rhythmus").notNull(),
  naechsteFaelligkeit: timestamp("naechste_faelligkeit", {
    withTimezone: true,
  }).notNull(),
  empfaengerId: integer("empfaenger_id")
    .notNull()
    .references(() => nutzer.id),
  link: text("link"),
  notiz: text("notiz"),
  aktiv: boolean("aktiv").notNull().default(true),
  zuletztErledigtAm: timestamp("zuletzt_erledigt_am", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Einstellungen & Job-Läufe ---------------------------------------------

// Key/value settings: datum_offset_tage (date simulation), versandmodus.
export const einstellung = pgTable("einstellung", {
  schluessel: text("schluessel").primaryKey(),
  wert: text("wert").notNull(),
});

// One row per background job run; three failures in a row raise an alarm
// mail to the admins (SPEC §8).
export const jobLauf = pgTable("job_lauf", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  job: text("job").notNull(),
  erfolg: boolean("erfolg").notNull(),
  meldung: text("meldung"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Postausgang = typeof postausgang.$inferSelect;
export type KalenderEintrag = typeof kalenderEintrag.$inferSelect;
export type WiederkehrendeErinnerung =
  typeof wiederkehrendeErinnerung.$inferSelect;
