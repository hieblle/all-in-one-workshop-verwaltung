import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { nutzer } from "./nutzer";

// Trainers (internal + external). nutzer_id links a trainer to their login
// account — required for assertTrainerAccess on external trainer sessions.
export const trainer = pgTable(
  "trainer",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    extern: boolean("extern").notNull().default(true),
    verfuegbarkeitNotiz: text("verfuegbarkeit_notiz"),
    aktiv: boolean("aktiv").notNull().default(true),
    nutzerId: integer("nutzer_id").references(() => nutzer.id).unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "trainer_email_lowercase",
      sql`${table.email} = lower(${table.email})`,
    ),
  ],
);

export type Trainer = typeof trainer.$inferSelect;
export type NeuerTrainer = typeof trainer.$inferInsert;
