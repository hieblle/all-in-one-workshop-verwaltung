import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { modul } from "./modul";
import { nutzer } from "./nutzer";
import { trainer } from "./trainer";
import { workshop } from "./workshop";

// Two kinds of entries (SPEC §1): a Vorschlag is an idea from during/after a
// workshop — nothing changed yet. An Aenderung is the actual change made while
// preparing a workshop (the real change log) and may implement a Vorschlag.

export const vorschlagStatusEnum = pgEnum("vorschlag_status", [
  "offen",
  "umgesetzt",
  "verworfen",
]);

export type VorschlagStatus = (typeof vorschlagStatusEnum.enumValues)[number];

export const vorschlag = pgTable("vorschlag", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workshopId: integer("workshop_id")
    .notNull()
    .references(() => workshop.id),
  modulId: integer("modul_id").references(() => modul.id),
  text: text("text").notNull(),
  status: vorschlagStatusEnum("status").notNull().default("offen"),
  erstelltVonId: integer("erstellt_von_id")
    .notNull()
    .references(() => nutzer.id),
  statusGeaendertVonId: integer("status_geaendert_von_id").references(
    () => nutzer.id,
  ),
  statusGeaendertAm: timestamp("status_geaendert_am", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const aenderung = pgTable("aenderung", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workshopId: integer("workshop_id")
    .notNull()
    .references(() => workshop.id),
  // null → change only to this workshop's individual deck.
  modulId: integer("modul_id").references(() => modul.id),
  vorschlagId: integer("vorschlag_id").references(() => vorschlag.id),
  text: text("text").notNull(),
  erstelltVonId: integer("erstellt_von_id")
    .notNull()
    .references(() => nutzer.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The trainer's feedback section on the workshop page (SPEC §1). One per
// trainer and workshop; suggestions go into `vorschlag`.
export const trainerFeedback = pgTable(
  "trainer_feedback",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id),
    trainerId: integer("trainer_id")
      .notNull()
      .references(() => trainer.id),
    abwicklungNote: integer("abwicklung_note"),
    abwicklungText: text("abwicklung_text"),
    verlaufNote: integer("verlauf_note"),
    verlaufText: text("verlauf_text"),
    sonstiges: text("sonstiges"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("trainer_feedback_workshop_trainer_unique").on(
      table.workshopId,
      table.trainerId,
    ),
  ],
);

export type Vorschlag = typeof vorschlag.$inferSelect;
export type Aenderung = typeof aenderung.$inferSelect;
export type TrainerFeedback = typeof trainerFeedback.$inferSelect;
