// One-time import of the Notion "Workshop Liste" (PLAN.md Phase 1).
//
// Usage:
//   npm run import:notion            -- dry run, prints what would be imported
//   npm run import:notion -- --apply -- actually writes to the database
//
// Requires NOTION_API_KEY and NOTION_WORKSHOP_DB_ID in .env; property names
// are configured in src/integrations/notion/mapping.ts (PROPERTY_MAP).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { kunde, workshop } from "../src/db/schema";
import { fetchAllePages } from "../src/integrations/notion/client";
import { mapNotionPage } from "../src/integrations/notion/mapping";
import { instanziiereCheckpunkte } from "../src/lib/checklist";

const AKTIVE_STATUS = new Set([
  "Vorabstimmung",
  "Angebot",
  "Vorbereitung",
  "Durchführung",
  "Nachbereitung",
]);

async function main() {
  const apply = process.argv.includes("--apply");
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_WORKSHOP_DB_ID;
  if (!apiKey || !databaseId) {
    console.error(
      "NOTION_API_KEY und NOTION_WORKSHOP_DB_ID in .env setzen (siehe .env.example).",
    );
    process.exit(1);
  }

  console.log(`Lese Notion-Datenbank ${databaseId} …`);
  const pages = await fetchAllePages(databaseId, apiKey);
  console.log(`${pages.length} Einträge gefunden.\n`);

  let importiert = 0;
  let uebersprungen = 0;

  for (const page of pages) {
    const { firma, workshop: werte, warnungen } = mapNotionPage(page);
    const label = `„${werte.name}"`;

    const kritisch = warnungen.some((w) => w.includes("übersprungen"));
    if (kritisch) {
      console.warn(`SKIP  ${label}: ${warnungen.join("; ")}`);
      uebersprungen++;
      continue;
    }
    if (warnungen.length > 0) {
      console.warn(`WARN  ${label}: ${warnungen.join("; ")}`);
    }

    const [vorhanden] = await db
      .select({ id: workshop.id })
      .from(workshop)
      .where(eq(workshop.name, werte.name))
      .limit(1);
    if (vorhanden) {
      console.log(`SKIP  ${label}: existiert bereits (id ${vorhanden.id})`);
      uebersprungen++;
      continue;
    }

    if (!apply) {
      console.log(
        `DRY   ${label}: ${firma ?? "(ohne Firma)"} · ${werte.type} · ${werte.status}`,
      );
      importiert++;
      continue;
    }

    let kundeId: number;
    const firmenName = firma ?? "(unbekannt)";
    const [bestehenderKunde] = await db
      .select({ id: kunde.id })
      .from(kunde)
      .where(eq(kunde.firma, firmenName))
      .limit(1);
    if (bestehenderKunde) {
      kundeId = bestehenderKunde.id;
    } else {
      const [neuerKunde] = await db
        .insert(kunde)
        .values({ firma: firmenName })
        .returning();
      kundeId = neuerKunde.id;
    }

    const [neu] = await db
      .insert(workshop)
      .values({ ...werte, unternehmenId: kundeId })
      .returning({ id: workshop.id, status: workshop.status });

    // Checklists only for workshops still in the running process — importing
    // finished workshops must not create noise.
    if (AKTIVE_STATUS.has(neu.status)) {
      await instanziiereCheckpunkte(neu.id, neu.status);
    }
    console.log(`OK    ${label} → id ${neu.id}`);
    importiert++;
  }

  console.log(
    `\n${apply ? "Importiert" : "Würde importieren"}: ${importiert}, übersprungen: ${uebersprungen}.`,
  );
  if (!apply) {
    console.log("Trockenlauf — mit »npm run import:notion -- --apply« schreiben.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import fehlgeschlagen:", err);
    process.exit(1);
  });
