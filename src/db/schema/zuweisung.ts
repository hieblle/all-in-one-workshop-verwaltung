import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { trainer } from "./trainer";
import { workshop } from "./workshop";

export const zuweisungRolleEnum = pgEnum("zuweisung_rolle", [
  "lead",
  "co",
  "uebergabe_extern",
]);

export const zuweisungStatusEnum = pgEnum("zuweisung_status", [
  "angefragt",
  "bestaetigt",
  "abgesagt",
]);

export type ZuweisungStatus = (typeof zuweisungStatusEnum.enumValues)[number];

// Workshop ↔ trainer assignment. The *_am timestamps record which automatic
// trainer mails went out (SPEC §5) — they make the automation idempotent and
// drive the ⚙ steps in the checklist overview.
export const zuweisung = pgTable(
  "zuweisung",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id),
    trainerId: integer("trainer_id")
      .notNull()
      .references(() => trainer.id),
    rolle: zuweisungRolleEnum("rolle").notNull().default("lead"),
    status: zuweisungStatusEnum("status").notNull().default("angefragt"),
    anfrageGesendetAm: timestamp("anfrage_gesendet_am", { withTimezone: true }),
    infomailGesendetAm: timestamp("infomail_gesendet_am", {
      withTimezone: true,
    }),
    feedbackErinnerungAm: timestamp("feedback_erinnerung_am", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("zuweisung_workshop_trainer_unique").on(
      table.workshopId,
      table.trainerId,
    ),
  ],
);

export type Zuweisung = typeof zuweisung.$inferSelect;
export type NeueZuweisung = typeof zuweisung.$inferInsert;
