import Link from "next/link";
import { isTeamRolle } from "@/lib/access";
import {
  getTeamDashboard,
  getTrainerDashboard,
  type PunktEintrag,
  type WorkshopEintrag,
} from "@/lib/dashboard";
import {
  formatDatum,
  formatDatumZeit,
  STATUS_FARBEN,
  tageBisLabel,
} from "@/lib/format";
import { requireSession } from "@/lib/session";
import { updateVerfuegbarkeitAction } from "./actions";

function PunktListe({
  punkte,
  leerText,
  ueberfaellig = false,
}: {
  punkte: PunktEintrag[];
  leerText: string;
  ueberfaellig?: boolean;
}) {
  if (punkte.length === 0) {
    return <p className="text-sm text-zinc-500">{leerText}</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {punkte.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{p.titel}</p>
            <p className="text-xs text-zinc-500">
              <Link href={`/workshops/${p.workshopId}`} className="hover:underline">
                {p.workshopName}
              </Link>
              {p.verantwortlichName ? ` · ${p.verantwortlichName}` : " · niemand zugewiesen"}
            </p>
          </div>
          <span
            className={`ml-auto whitespace-nowrap text-xs ${ueberfaellig ? "font-semibold text-red-600" : "text-zinc-500"}`}
          >
            {formatDatum(p.faelligAm)} ({tageBisLabel(p.faelligAm)})
          </span>
        </li>
      ))}
    </ul>
  );
}

function WorkshopListe({ eintraege }: { eintraege: WorkshopEintrag[] }) {
  return (
    <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {eintraege.map((w) => (
        <li key={w.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <div className="min-w-0">
            <Link href={`/workshops/${w.id}`} className="font-medium hover:underline">
              {w.name}
            </Link>
            <p className="text-xs text-zinc-500">{w.firma}</p>
          </div>
          <span className="ml-auto flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_FARBEN[w.status]}`}
            >
              {w.status}
            </span>
            <span className="whitespace-nowrap text-xs text-zinc-500">
              {formatDatumZeit(w.termin1)}
              {w.termin1 ? ` (${tageBisLabel(w.termin1)})` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();

  if (!isTeamRolle(session.user.rolle)) {
    const daten = await getTrainerDashboard(session);
    const heute = new Date();
    return (
      <div className="space-y-8">
        <h1 className="text-xl font-semibold">
          Hallo {session.user.name?.split(" ")[0] ?? ""} 👋
        </h1>

        <section className="space-y-2">
          <h2 className="font-medium">
            Deine offenen Aufgaben ({daten.meinePunkte.length})
          </h2>
          <PunktListe
            punkte={daten.meinePunkte}
            leerText="Nichts offen — alles erledigt!"
            ueberfaellig={daten.meinePunkte.some(
              (p) => p.faelligAm !== null && p.faelligAm < heute,
            )}
          />
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Deine Workshops</h2>
          {daten.meineWorkshops.length === 0 ? (
            <p className="text-sm text-zinc-500">Aktuell keine zugewiesenen Workshops.</p>
          ) : (
            <WorkshopListe eintraege={daten.meineWorkshops} />
          )}
        </section>

        <section className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-medium">Deine Verfügbarkeit</h2>
          <p className="text-xs text-zinc-500">
            Selbstauskunft für das Team — z. B. „Di–Do verfügbar, ab Oktober ausgebucht“.
          </p>
          <form action={updateVerfuegbarkeitAction} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="verfuegbarkeitNotiz"
              defaultValue={daten.verfuegbarkeitNotiz ?? ""}
              placeholder="Deine Verfügbarkeit …"
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Speichern
            </button>
          </form>
        </section>
      </div>
    );
  }

  const daten = await getTeamDashboard(session);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {(daten.ohneTrainer.length > 0 || daten.offeneRechnungen.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {daten.ohneTrainer.length > 0 && (
            <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                ⚠️ Ohne Trainer-Zuweisung ({daten.ohneTrainer.length})
              </h2>
              <WorkshopListe eintraege={daten.ohneTrainer} />
            </section>
          )}
          {daten.offeneRechnungen.length > 0 && (
            <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                💶 Rechnung offen ({daten.offeneRechnungen.length})
              </h2>
              <WorkshopListe eintraege={daten.offeneRechnungen} />
            </section>
          )}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-medium text-red-700 dark:text-red-400">
          Überfällig ({daten.ueberfaellig.length})
        </h2>
        <PunktListe
          punkte={daten.ueberfaellig}
          leerText="Nichts überfällig — sehr gut!"
          ueberfaellig
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-medium">Diese Woche fällig ({daten.dieseWoche.length})</h2>
          <PunktListe punkte={daten.dieseWoche} leerText="Diese Woche wird nichts fällig." />
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Meine Aufgaben ({daten.meinePunkte.length})</h2>
          <PunktListe punkte={daten.meinePunkte} leerText="Dir ist aktuell nichts zugewiesen." />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">
          Anstehende Workshops — nächste 30 Tage ({daten.anstehende.length})
        </h2>
        {daten.anstehende.length === 0 ? (
          <p className="text-sm text-zinc-500">Keine Termine in den nächsten 30 Tagen.</p>
        ) : (
          <WorkshopListe eintraege={daten.anstehende} />
        )}
      </section>
    </div>
  );
}
