import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const nutzerRolleEnum = pgEnum("nutzer_rolle", [
  "admin",
  "team",
  "trainer",
]);

export type NutzerRolle = (typeof nutzerRolleEnum.enumValues)[number];

// App users: internal team signs in via Entra ID SSO, external trainers via
// magic link. Only the SHA-256 hash of the magic link token is stored.
export const nutzer = pgTable(
  "nutzer",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    rolle: nutzerRolleEnum("rolle").notNull(),
    entraOid: text("entra_oid").unique(),
    magicLinkToken: text("magic_link_token").unique(),
    magicLinkExpiresAt: timestamp("magic_link_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Auth lookups lower-case the input; enforce the invariant on write so a
    // mixed-case import can never lock an account out.
    check("nutzer_email_lowercase", sql`${table.email} = lower(${table.email})`),
  ],
);

export type Nutzer = typeof nutzer.$inferSelect;
export type NeuerNutzer = typeof nutzer.$inferInsert;
