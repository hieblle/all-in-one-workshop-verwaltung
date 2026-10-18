import Link from "next/link";
import { kleinerPrimaerButton, liste, sekundaerButton } from "@/components/ui";
import { isTeamRolle } from "@/lib/access";
import {
  getTeamDashboard,
  getTrainerDashboard,
  type PunktEintrag,
  type WorkshopEintrag,
} from "@/lib/dashboard";
import { getJetzt } from "@/lib/einstellungen";
import {
  formatDatum,
  formatDatumZeit,
  STATUS_FARBEN,
  tageBisLabel,
} from "@/lib/format";
import { requireSession } from "@/lib/session";
import { antwortTrainerAction } from "./workshops/actions";
import { erinnerungErledigtAction } from "./actions";

function PunktListe({
  punkte,
  leerText,
  jetzt,
}: {
  punkte: PunktEintrag[];
  leerText: string;
  jetzt: Date;
}) {
  if (punkte.length === 0) {
    return <p className="text-sm text-zinc-500">{leerText}</p>;
  }
  const heute = new Date(jetzt);
  heute.setHours(0, 0, 0, 0);
  return (
    <ul className={liste}>
      {punkte.map((p) => {
        const ueberfaellig = p.faelligAm !== null && p.faelligAm < heute;
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{p.titel}</p>
              <p className="text-xs text-zinc-500">
                <Link href={`/workshops/${p.workshopId}`} className="hover:underline">
                  {p.workshopName}
                </Link>
                {p.verantwortlichName ? ` · ${p.verantwortlichName}` : " · service@ (niemand zugewiesen)"}
              </p>
            </div>
            <span
              className={`ml-auto whitespace-nowrap text-xs ${ueberfaellig ? "font-semibold text-red-600" : "text-zinc-500"}`}
            >
              {formatDatum(p.faelligAm)} ({tageBisLabel(p.faelligAm, jetzt)})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function WorkshopListe({
  eintraege,
  jetzt,
}: {
  eintraege: WorkshopEintrag[];
  jetzt: Date;
}) {
  return (
    <ul className={liste}>
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
              {w.termin1 ? ` (${tageBisLabel(w.termin1, jetzt)})` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const jetzt = await getJetzt();

  if (!isTeamRolle(session.user.rolle)) {
    const daten = await getTrainerDashboard(session, jetzt);
    return (
      <div className="space-y-8">
        <h1 className="text-xl font-semibold">
          Hallo {session.user.name?.split(" ")[0] ?? ""} 👋
        </h1>

        {daten.anfragen.length > 0 && (
          <section className="space-y-2 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <h2 className="font-medium">Neue Anfragen ({daten.anfragen.length})</h2>
            <ul className={liste}>
              {daten.anfragen.map((a) => (
                <li
                  key={a.zuweisungId}
                  className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 text-sm dark:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <Link href={`/workshops/${a.id}`} className="font-medium hover:underline">
                      {a.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {a.firma} · {formatDatumZeit(a.termin1)}
                    </p>
                  </div>
                  <span className="ml-auto flex gap-2">
                    <form action={antwortTrainerAction.bind(null, a.id, a.zuweisungId)}>
                      <input type="hidden" name="antwort" value="bestaetigt" />
                      <button type="submit" className={kleinerPrimaerButton}>
                        Zusagen
                      </button>
                    </form>
                    <form action={antwortTrainerAction.bind(null, a.id, a.zuweisungId)}>
                      <input type="hidden" name="antwort" value="abgesagt" />
                      <button type="submit" className={sekundaerButton}>
                        Absagen
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {daten.feedbackOffen.length > 0 && (
          <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Feedback ausstehend ({daten.feedbackOffen.length})
            </h2>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Bitte den Feedback-Bereich auf der Workshop-Seite ausfüllen (2–3 Minuten).
            </p>
            <WorkshopListe eintraege={daten.feedbackOffen} jetzt={jetzt} />
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-medium">Deine offenen Aufgaben ({daten.meinePunkte.length})</h2>
          <PunktListe
            punkte={daten.meinePunkte}
            leerText="Nichts offen — alles erledigt!"
            jetzt={jetzt}
          />
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Deine Workshops</h2>
          {daten.meineWorkshops.length === 0 ? (
            <p className="text-sm text-zinc-500">Aktuell keine zugesagten Workshops.</p>
          ) : (
            <WorkshopListe eintraege={daten.meineWorkshops} jetzt={jetzt} />
          )}
        </section>
      </div>
    );
  }

  const daten = await getTeamDashboard(session, jetzt);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {daten.erinnerungen.length > 0 && (
        <section className="space-y-2 rounded-lg border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950">
          <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            🔁 Deine Erinnerungen ({daten.erinnerungen.length})
          </h2>
          <ul className={liste}>
            {daten.erinnerungen.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <div className="min-w-0">
                  <p className="font-medium">{e.titel}</p>
                  <p className="text-xs text-zinc-500">
                    fällig {formatDatum(e.naechsteFaelligkeit)}
                    {e.notiz ? ` · ${e.notiz}` : ""}
                    {e.link && (
                      <>
                        {" · "}
                        <a href={e.link} className="underline">
                          Link
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <form action={erinnerungErledigtAction.bind(null, e.id)} className="ml-auto">
                  <button type="submit" className={kleinerPrimaerButton}>
                    Erledigt
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(daten.ohneTrainer.length > 0 || daten.offeneRechnungen.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {daten.ohneTrainer.length > 0 && (
            <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                ⚠️ Ohne Trainer ({daten.ohneTrainer.length})
              </h2>
              <WorkshopListe eintraege={daten.ohneTrainer} jetzt={jetzt} />
            </section>
          )}
          {daten.offeneRechnungen.length > 0 && (
            <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                💶 Rechnung offen ({daten.offeneRechnungen.length})
              </h2>
              <WorkshopListe eintraege={daten.offeneRechnungen} jetzt={jetzt} />
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
          jetzt={jetzt}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-medium">Nächste 7 Tage fällig ({daten.dieseWoche.length})</h2>
          <PunktListe
            punkte={daten.dieseWoche}
            leerText="In den nächsten 7 Tagen wird nichts fällig."
            jetzt={jetzt}
          />
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Meine Aufgaben ({daten.meinePunkte.length})</h2>
          <PunktListe
            punkte={daten.meinePunkte}
            leerText="Dir ist aktuell nichts zugewiesen."
            jetzt={jetzt}
          />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">
          Anstehende Workshops — nächste 30 Tage ({daten.anstehende.length})
        </h2>
        {daten.anstehende.length === 0 ? (
          <p className="text-sm text-zinc-500">Keine Termine in den nächsten 30 Tagen.</p>
        ) : (
          <WorkshopListe eintraege={daten.anstehende} jetzt={jetzt} />
        )}
      </section>
    </div>
  );
}
