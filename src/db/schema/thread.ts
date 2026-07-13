import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nutzer } from "./nutzer";
import { workshop } from "./workshop";

// Per-workshop exchange thread between team and assigned trainers (F4).
export const threadKommentar = pgTable("thread_kommentar", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workshopId: integer("workshop_id")
    .notNull()
    .references(() => workshop.id, { onDelete: "cascade" }),
  autorId: integer("autor_id")
    .notNull()
    .references(() => nutzer.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ThreadKommentar = typeof threadKommentar.$inferSelect;
export type NeuerThreadKommentar = typeof threadKommentar.$inferInsert;
