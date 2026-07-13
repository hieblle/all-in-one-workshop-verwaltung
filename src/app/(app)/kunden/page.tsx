import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { kunde, workshop } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import { createKundeAction, updateKundeAction } from "./actions";

const inputKlasse =
  "rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function KundenPage() {
  await requireTeam();

  const kunden = await db
    .select({
      id: kunde.id,
      firma: kunde.firma,
      hubspotId: kunde.hubspotId,
      workshops: sql<number>`count(${workshop.id})`.mapWith(Number),
    })
    .from(kunde)
    .leftJoin(workshop, eq(workshop.unternehmenId, kunde.id))
    .groupBy(kunde.id)
    .orderBy(asc(kunde.firma));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Kunden</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Leichtgewichtige Kundenliste — das CRM bleibt HubSpot, die
          Rechnungsstellung SevDesk (Verknüpfung folgt in Phase 2).
        </p>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {kunden.map((k) => (
          <li key={k.id} className="px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{k.firma}</span>
              <Link
                href={`/workshops?suche=${encodeURIComponent(k.firma)}`}
                className="text-xs text-zinc-500 hover:underline"
              >
                {k.workshops} Workshop{k.workshops === 1 ? "" : "s"}
              </Link>
              <details className="ml-auto">
                <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">
                  Umbenennen
                </summary>
                <form
                  action={updateKundeAction.bind(null, k.id)}
                  className="mt-2 flex items-center gap-2"
                >
                  <input name="firma" required defaultValue={k.firma} className={`${inputKlasse} w-64`} />
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Speichern
                  </button>
                </form>
              </details>
            </div>
          </li>
        ))}
      </ul>

      <form action={createKundeAction} className="flex flex-wrap items-center gap-2">
        <input name="firma" required placeholder="Neue Firma" className={`${inputKlasse} w-64`} />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500"
        >
          Anlegen
        </button>
      </form>
    </div>
  );
}
