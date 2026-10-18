import { asc, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { kunde, modul, nutzer } from "@/db/schema";

// Option lists for the workshop form (archived entries are not offered).
export async function ladeFormularOptionen() {
  const [kunden, team, module] = await Promise.all([
    db
      .select({ id: kunde.id, firma: kunde.firma })
      .from(kunde)
      .where(isNull(kunde.archiviertAm))
      .orderBy(asc(kunde.firma)),
    db
      .select({ id: nutzer.id, name: nutzer.name })
      .from(nutzer)
      .where(inArray(nutzer.rolle, ["admin", "team"]))
      .orderBy(asc(nutzer.name)),
    db
      .select({ id: modul.id, name: modul.name })
      .from(modul)
      .where(isNull(modul.archiviertAm))
      .orderBy(asc(modul.name)),
  ]);
  return { kunden, team, module };
}
