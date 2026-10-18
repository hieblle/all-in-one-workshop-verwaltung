import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Lightweight customer record. HubSpot stays the CRM: hubspot_id is an
// optional reference only, there is no integration (SPEC §1).
export const kunde = pgTable("kunde", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firma: text("firma").notNull(),
  hubspotId: text("hubspot_id"),
  sevdeskId: text("sevdesk_id"),
  archiviertAm: timestamp("archiviert_am", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Kunde = typeof kunde.$inferSelect;
export type NeuerKunde = typeof kunde.$inferInsert;
