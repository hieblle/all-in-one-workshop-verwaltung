import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { inputKlasse, kleinerPrimaerButton, primaerButton } from "@/components/ui";
import { db } from "@/db";
import { aenderung, modul, vorschlag, workshopModul } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import {
  createModulAction,
  deleteModulAction,
  setModulArchiviertAction,
  updateModulAction,
} from "./actions";

function ModulFelder({
  m,
}: {
  m?: { name: string; sharepointUrl: string | null; beschreibung: string | null };
}) {
  return (
    <>
      <input name="name" required placeholder="Name" defaultValue={m?.name} className={`${inputKlasse} w-56`} />
      <input
        name="sharepointUrl"
        type="url"
        placeholder="SharePoint-Link (nur Team)"
        defaultValue={m?.sharepointUrl ?? ""}
        className={`${inputKlasse} w-72`}
      />
      <input
        name="beschreibung"
        placeholder="Kurzbeschreibung (optional)"
        defaultValue={m?.beschreibung ?? ""}
        className={`${inputKlasse} w-72`}
      />
    </>
  );
}

export default async function ModulePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const session = await requireTeam();
  const istAdmin = session.user.rolle === "admin";
  const { fehler } = await searchParams;

  const modulListe = await db
    .select({
      id: modul.id,
      name: modul.name,
      sharepointUrl: modul.sharepointUrl,
      beschreibung: modul.beschreibung,
      archiviertAm: modul.archiviertAm,
      workshops: sql<number>`(select count(*) from ${workshopModul} where ${workshopModul.modulId} = ${modul.id})`.mapWith(Number),
      offeneVorschlaege: sql<number>`(select count(*) from ${vorschlag} where ${vorschlag.modulId} = ${modul.id} and ${vorschlag.status} = 'offen')`.mapWith(Number),
      aenderungen: sql<number>`(select count(*) from ${aenderung} where ${eq(aenderung.modulId, modul.id)})`.mapWith(Number),
    })
    .from(modul)
    .orderBy(asc(modul.archiviertAm), asc(modul.name));

  return (
    <div className="space-y-6">
      {fehler === "genutzt" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Dieses Modul wird von Workshops oder im Change-Log verwendet — bitte archivieren statt löschen.
        </p>
      )}
      <div>
        <h1 className="text-xl font-semibold">Module</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Wiederverwendbare Bausteine. Die Folien liegen im SharePoint — hier nur der Link
          (sieht nur das Team). Trainer sehen die Modulnamen und den Change-Log.
        </p>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {modulListe.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">Noch keine Module.</li>}
        {modulListe.map((m) => (
          <li key={m.id} className="space-y-1 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${m.archiviertAm ? "line-through opacity-50" : ""}`}>{m.name}</span>
              {m.sharepointUrl && (
                <a href={m.sharepointUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                  SharePoint ↗
                </a>
              )}
              <span className="text-xs text-zinc-500">
                {m.workshops} Workshops ·{" "}
                <Link href={`/change-log?modul=${m.id}`} className="hover:underline">
                  {m.offeneVorschlaege} offene Vorschläge · {m.aenderungen} Änderungen
                </Link>
              </span>
              <details className="ml-auto">
                <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">Bearbeiten</summary>
                <form action={updateModulAction.bind(null, m.id)} className="mt-2 flex flex-wrap items-center gap-2">
                  <ModulFelder m={m} />
                  <button type="submit" className={kleinerPrimaerButton}>
                    Speichern
                  </button>
                </form>
                <div className="mt-2 flex gap-3">
                  <form action={setModulArchiviertAction.bind(null, m.id, !m.archiviertAm)}>
                    <button type="submit" className="text-xs text-zinc-500 hover:underline">
                      {m.archiviertAm ? "Wiederherstellen" : "Archivieren"}
                    </button>
                  </form>
                  {istAdmin && (
                    <form action={deleteModulAction.bind(null, m.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Endgültig löschen
                      </button>
                    </form>
                  )}
                </div>
              </details>
            </div>
            {m.beschreibung && <p className="text-xs text-zinc-500">{m.beschreibung}</p>}
          </li>
        ))}
      </ul>

      <form action={createModulAction} className="flex flex-wrap items-center gap-2">
        <ModulFelder />
        <button type="submit" className={primaerButton}>
          Modul anlegen
        </button>
      </form>
    </div>
  );
}
