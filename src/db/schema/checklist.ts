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

// Who is responsible for a checklist item by default; resolved to a concrete
// nutzer when the item is instantiated for a workshop.
export const verantwortlichRolleEnum = pgEnum("verantwortlich_rolle", [
  "team",
  "trainer_lead",
  "trainer_co",
]);

// Auto-check rules are evaluated by the sync-in jobs (F5, Phase 2).
export const autoCheckRegelEnum = pgEnum("auto_check_regel", [
  "forms_vorab",
  "forms_feedback",
  "outlook_termin",
  "sevdesk_re",
  "teams_meeting",
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
  // phase uses the workshop status enum: the item becomes relevant when the
  // workshop enters this status.
  phase: workshopStatusEnum("phase").notNull(),
  verantwortlichRolle: verantwortlichRolleEnum("verantwortlich_rolle")
    .notNull()
    .default("team"),
  // Due date relative to termin_1 in days; negative = before the workshop.
  faelligOffsetTage: integer("faellig_offset_tage").notNull().default(0),
  autoCheckRegel: autoCheckRegelEnum("auto_check_regel"),
});

// Instantiated checklist item per workshop. The unique index keeps the
// instantiation on status changes idempotent (F1: re-entering a phase must
// not duplicate items).
export const checkpunkt = pgTable(
  "checkpunkt",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id, { onDelete: "cascade" }),
    vorlagePunktId: integer("vorlage_punkt_id")
      .notNull()
      .references(() => checkpunktVorlage.id),
    verantwortlichUserId: integer("verantwortlich_user_id").references(
      () => nutzer.id,
    ),
    faelligAm: timestamp("faellig_am", { withTimezone: true }),
    status: checkpunktStatusEnum("status").notNull().default("offen"),
    erledigtVia: erledigtViaEnum("erledigt_via"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("checkpunkt_workshop_vorlage_punkt_unique").on(
      table.workshopId,
      table.vorlagePunktId,
    ),
  ],
);

export type ChecklistenVorlage = typeof checklistenVorlage.$inferSelect;
export type CheckpunktVorlage = typeof checkpunktVorlage.$inferSelect;
export type Checkpunkt = typeof checkpunkt.$inferSelect;
