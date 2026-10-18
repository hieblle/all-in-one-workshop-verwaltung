import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { workshop } from "./workshop";

// Reusable workshop building block (SPEC §1). Slides live in SharePoint —
// the module only links there, and that link is team-only.
export const modul = pgTable("modul", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  sharepointUrl: text("sharepoint_url"),
  beschreibung: text("beschreibung"),
  archiviertAm: timestamp("archiviert_am", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workshopModul = pgTable(
  "workshop_modul",
  {
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id),
    modulId: integer("modul_id")
      .notNull()
      .references(() => modul.id),
  },
  (table) => [primaryKey({ columns: [table.workshopId, table.modulId] })],
);

export type Modul = typeof modul.$inferSelect;
