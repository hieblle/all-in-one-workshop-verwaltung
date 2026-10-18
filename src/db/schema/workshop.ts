import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { kunde } from "./kunde";
import { nutzer } from "./nutzer";

// Enum labels mirror the Notion "Workshop Liste" verbatim (domain language,
// see CLAUDE.md) — do not translate or normalize them. Exception: Notion's
// combined "On-Hold/Abgesagt" is split because the calendar treats the two
// differently (SPEC §6: on hold keeps the entry, cancelled sends a cancellation).
export const workshopTypeEnum = pgEnum("workshop_type", [
  "Lehrlinge",
  "Beratung",
  "Maßgeschneiderter Workshop",
  "Agentic AI",
  "Schule",
  "Academy",
  "Ideation",
  "Keynote",
]);

export const workshopFormatEnum = pgEnum("workshop_format", [
  "dbrains academy",
  "dbrains x SCCH",
  "dbrains x FB",
  "dbrains x Land OÖ",
]);

export const workshopModusEnum = pgEnum("workshop_modus", [
  "ONLINE",
  "VOR ORT",
  "SCCH",
  "Webex",
]);

export const workshopStatusEnum = pgEnum("workshop_status", [
  "Vorabstimmung",
  "Angebot",
  "Vorbereitung",
  "Durchführung",
  "Nachbereitung",
  "Done",
  "On-Hold",
  "Abgesagt",
]);

export const rechnungStatusEnum = pgEnum("rechnung_status", [
  "warten",
  "senden",
  "gesendet",
]);

export const trainerReStatusEnum = pgEnum("trainer_re_status", [
  "offen",
  "überwiesen",
]);

export type WorkshopType = (typeof workshopTypeEnum.enumValues)[number];
export type WorkshopStatus = (typeof workshopStatusEnum.enumValues)[number];
export type WorkshopModus = (typeof workshopModusEnum.enumValues)[number];

export const workshop = pgTable("workshop", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  unternehmenId: integer("unternehmen_id")
    .notNull()
    .references(() => kunde.id),
  ansprechperson: text("ansprechperson"),
  type: workshopTypeEnum("type").notNull(),
  format: workshopFormatEnum("format"),
  modus: workshopModusEnum("modus"),
  ort: text("ort"),
  status: workshopStatusEnum("status").notNull().default("Vorabstimmung"),
  // Team member organising this workshop; team checklist items and their
  // reminders go here. null → the shared service mailbox (SPEC §5).
  verantwortlichInternId: integer("verantwortlich_intern_id").references(
    () => nutzer.id,
  ),
  // Start + end per date; the form defaults to 09:00–17:00.
  termin1: timestamp("termin_1", { withTimezone: true }),
  termin1Ende: timestamp("termin_1_ende", { withTimezone: true }),
  termin2: timestamp("termin_2", { withTimezone: true }),
  termin2Ende: timestamp("termin_2_ende", { withTimezone: true }),
  terminFup: timestamp("termin_fup", { withTimezone: true }),
  terminFupEnde: timestamp("termin_fup_ende", { withTimezone: true }),
  wsBetrag: numeric("ws_betrag", { precision: 10, scale: 2 }),
  rechnungStatus: rechnungStatusEnum("rechnung_status")
    .notNull()
    .default("warten"),
  trainerRe: trainerReStatusEnum("trainer_re").notNull().default("offen"),
  // External systems: the app stores links/ids only, never files (hub, not monolith).
  // verwendetes_slidedeck is THE presentation link trainers see (SPEC §2);
  // sharepoint_url is the team-only working folder.
  sharepointUrl: text("sharepoint_url"),
  notionProjectUrl: text("notion_project_url"),
  formsVorabUrl: text("forms_vorab_url"),
  formsFeedbackUrl: text("forms_feedback_url"),
  sevdeskId: text("sevdesk_id"),
  teamsMeetingUrl: text("teams_meeting_url"),
  verwendetesSlidedeck: text("verwendetes_slidedeck"),
  // Internal notes are team-only — never expose them to trainer roles.
  interneNotizen: text("interne_notizen"),
  // Archive instead of delete (SPEC §1); only admins hard-delete.
  archiviertAm: timestamp("archiviert_am", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Workshop = typeof workshop.$inferSelect;
export type NeuerWorkshop = typeof workshop.$inferInsert;
