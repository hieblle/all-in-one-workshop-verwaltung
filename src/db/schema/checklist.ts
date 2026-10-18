import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nutzer } from "./nutzer";
import { workshop, workshopStatusEnum, workshopTypeEnum } from "./workshop";

// Templates hold only ☐ tasks for humans. The ⚙ automatic steps are a fixed,
// code-defined list (src/lib/automatik.ts) whose status is derived from data —
// they never generate reminders (SPEC §4).

// Who is responsible for a task by default; resolved to a concrete nutzer
// when the item is instantiated. "team" → the workshop's verantwortlich intern.
export const verantwortlichRolleEnum = pgEnum("verantwortlich_rolle", [
  "team",
  "trainer_lead",
  "trainer_co",
]);

// Rules by which the hub ticks off a task itself once the data proves it done.
export const autoCheckRegelEnum = pgEnum("auto_check_regel", [
  "termin_eingetragen",
  "trainer_zugewiesen",
  "praesentation_eingetragen",
  "angebot_angenommen",
]);

// Tasks that only apply to one delivery mode (e.g. "Raum klären" → Präsenz).
export const nurModusEnum = pgEnum("nur_modus", ["online", "praesenz"]);

// Workshop link shown next to the task and in reminder mails.
export const linkFeldEnum = pgEnum("link_feld", [
  "forms_vorab",
  "forms_feedback",
  "notion",
]);

export const checkpunktStatusEnum = pgEnum("checkpunkt_status", [
  "offen",
  "erledigt",
  "uebersprungen",
]);

export const erledigtViaEnum = pgEnum("erledigt_via", ["manuell", "auto"]);

// Template: one checklist per workshop type (gilt_fuer_type = null → applies to all).
export const checklistenVorlage = pgTable("checklisten_vorlage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  giltFuerType: workshopTypeEnum("gilt_fuer_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const checkpunktVorlage = pgTable("checkpunkt_vorlage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vorlageId: integer("vorlage_id")
    .notNull()
    .references(() => checklistenVorlage.id, { onDelete: "cascade" }),
  titel: text("titel").notNull(),
  phase: workshopStatusEnum("phase").notNull(),
  verantwortlichRolle: verantwortlichRolleEnum("verantwortlich_rolle")
    .notNull()
    .default("team"),
  // Due date relative to termin_1 in days; negative = before the workshop.
  faelligOffsetTage: integer("faellig_offset_tage").notNull().default(0),
  autoCheckRegel: autoCheckRegelEnum("auto_check_regel"),
  nurModus: nurModusEnum("nur_modus"),
  linkFeld: linkFeldEnum("link_feld"),
  reihenfolge: integer("reihenfolge").notNull().default(0),
});

// Instantiated task per workshop. The unique index keeps instantiation
// idempotent. Ad-hoc items have no vorlage_punkt_id and carry their own
// titel/phase; items the hub creates itself (e.g. "Trainer-Feedback fehlt")
// carry a system_schluessel so they are created only once.
export const checkpunkt = pgTable(
  "checkpunkt",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id),
    vorlagePunktId: integer("vorlage_punkt_id").references(
      () => checkpunktVorlage.id,
    ),
    systemSchluessel: text("system_schluessel"),
    titel: text("titel"),
    phase: workshopStatusEnum("phase"),
    verantwortlichUserId: integer("verantwortlich_user_id").references(
      () => nutzer.id,
    ),
    faelligAm: timestamp("faellig_am", { withTimezone: true }),
    status: checkpunktStatusEnum("status").notNull().default("offen"),
    erledigtVia: erledigtViaEnum("erledigt_via"),
    erledigtVonId: integer("erledigt_von_id").references(() => nutzer.id),
    erledigtAm: timestamp("erledigt_am", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("checkpunkt_workshop_vorlage_punkt_unique").on(
      table.workshopId,
      table.vorlagePunktId,
    ),
    uniqueIndex("checkpunkt_workshop_system_schluessel_unique").on(
      table.workshopId,
      table.systemSchluessel,
    ),
  ],
);

export type ChecklistenVorlage = typeof checklistenVorlage.$inferSelect;
export type CheckpunktVorlage = typeof checkpunktVorlage.$inferSelect;
export type Checkpunkt = typeof checkpunkt.$inferSelect;
