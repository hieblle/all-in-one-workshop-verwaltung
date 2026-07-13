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

// Workshop ↔ trainer assignment. infomail_gesendet_am is set once the
// automatic info package has been mailed (F4, Phase 2).
export const zuweisung = pgTable(
  "zuweisung",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id, { onDelete: "cascade" }),
    trainerId: integer("trainer_id")
      .notNull()
      .references(() => trainer.id, { onDelete: "cascade" }),
    rolle: zuweisungRolleEnum("rolle").notNull().default("lead"),
    status: zuweisungStatusEnum("status").notNull().default("angefragt"),
    infomailGesendetAm: timestamp("infomail_gesendet_am", {
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
