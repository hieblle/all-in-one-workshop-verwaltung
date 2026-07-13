import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Lightweight customer record — CRM stays in HubSpot, invoicing in SevDesk.
export const kunde = pgTable("kunde", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firma: text("firma").notNull(),
  hubspotId: text("hubspot_id"),
  sevdeskId: text("sevdesk_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Kunde = typeof kunde.$inferSelect;
export type NeuerKunde = typeof kunde.$inferInsert;
