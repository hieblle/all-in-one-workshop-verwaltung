import { inputKlasse, kleinerPrimaerButton, sekundaerButton } from "@/components/ui";
import type { AenderungEintrag, VorschlagEintrag } from "@/lib/changelog";
import { formatDatum } from "@/lib/format";
import {
  addAenderungAction,
  addVorschlagAction,
  setVorschlagStatusAction,
} from "../actions";

export const VORSCHLAG_STATUS_LABEL: Record<string, string> = {
  offen: "offen",
  umgesetzt: "umgesetzt",
  verworfen: "verworfen",
};

const STATUS_KLASSE: Record<string, string> = {
  offen: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  umgesetzt: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  verworfen: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function VorschlagListe({
  vorschlaege,
  istTeam,
  zeigeWorkshop = false,
}: {
  vorschlaege: VorschlagEintrag[];
  istTeam: boolean;
  zeigeWorkshop?: boolean;
}) {
  if (vorschlaege.length === 0) {
    return <p className="text-sm text-zinc-500">Keine Vorschläge.</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {vorschlaege.map((v) => (
        <li key={v.id} className="space-y-1 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_KLASSE[v.status]}`}>
              {VORSCHLAG_STATUS_LABEL[v.status]}
            </span>
            <span className="text-xs text-zinc-500">
              {v.modulName ? `Modul ${v.modulName}` : "individuelle Folien"} · {v.erstelltVon} ·{" "}
              {formatDatum(v.createdAt)}
              {zeigeWorkshop && (v.workshopName ? ` · ${v.workshopName}` : " · anderer Workshop")}
            </span>
            {istTeam && v.status === "offen" && (
              <span className="ml-auto flex gap-1">
                <form action={setVorschlagStatusAction.bind(null, v.id)}>
                  <input type="hidden" name="status" value="umgesetzt" />
                  <button type="submit" className={sekundaerButton}>
                    Umgesetzt
                  </button>
                </form>
                <form action={setVorschlagStatusAction.bind(null, v.id)}>
                  <input type="hidden" name="status" value="verworfen" />
                  <button type="submit" className={sekundaerButton}>
                    Verwerfen
                  </button>
                </form>
              </span>
            )}
            {istTeam && v.status !== "offen" && (
              <form action={setVorschlagStatusAction.bind(null, v.id)} className="ml-auto">
                <input type="hidden" name="status" value="offen" />
                <button type="submit" className="text-xs text-zinc-500 hover:underline">
                  wieder öffnen
                </button>
              </form>
            )}
          </div>
          <p className="whitespace-pre-wrap">{v.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function AenderungListe({
  aenderungen,
  zeigeWorkshop = false,
}: {
  aenderungen: AenderungEintrag[];
  zeigeWorkshop?: boolean;
}) {
  if (aenderungen.length === 0) {
    return <p className="text-sm text-zinc-500">Noch keine Änderungen eingetragen.</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {aenderungen.map((a) => (
        <li key={a.id} className="space-y-1 px-3 py-2 text-sm">
          <p className="text-xs text-zinc-500">
            {formatDatum(a.createdAt)} · {a.modulName ? `Modul ${a.modulName}` : "individuelles Deck"} ·{" "}
            {a.erstelltVon}
            {zeigeWorkshop && (a.workshopName ? ` · ${a.workshopName}` : " · anderer Workshop")}
          </p>
          <p className="whitespace-pre-wrap">{a.text}</p>
          {a.vorschlagText && (
            <p className="text-xs text-zinc-500">setzt um: „{a.vorschlagText}“</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Change-log section on a workshop page (SPEC §1): suggestions (ideas, not
 * changed yet) and changes (made while preparing). Shows this workshop's
 * entries plus everything tied to its modules.
 */
export function ChangelogBereich({
  workshopId,
  module,
  vorschlaege,
  aenderungen,
  istTeam,
  darfEintragen,
}: {
  workshopId: number;
  module: { id: number; name: string }[];
  vorschlaege: VorschlagEintrag[];
  aenderungen: AenderungEintrag[];
  istTeam: boolean;
  darfEintragen: boolean;
}) {
  const offeneVorschlaege = vorschlaege.filter((v) => v.status === "offen");

  function ModulAuswahl() {
    return (
      <select name="modulId" defaultValue="" className={inputKlasse}>
        <option value="">nur individuelle Folien</option>
        {module.map((m) => (
          <option key={m.id} value={m.id}>
            Modul {m.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Vorschläge{" "}
          <span className="font-normal text-zinc-500">
            — Ideen für die Zukunft, an den Folien ist noch nichts geändert
          </span>
        </h3>
        <VorschlagListe vorschlaege={vorschlaege} istTeam={istTeam} zeigeWorkshop />
        {darfEintragen && (
          <form
            action={addVorschlagAction.bind(null, workshopId)}
            className="space-y-2 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700"
          >
            <textarea
              name="text"
              required
              rows={2}
              placeholder="z. B. Folie 12: Beispiel mit ChatGPT-Preisen ist veraltet"
              className={`${inputKlasse} w-full`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <ModulAuswahl />
              <button type="submit" className={kleinerPrimaerButton}>
                Vorschlag eintragen
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Änderungen{" "}
          <span className="font-normal text-zinc-500">— was bei der Vorbereitung tatsächlich geändert wurde</span>
        </h3>
        <AenderungListe aenderungen={aenderungen} zeigeWorkshop />
        {darfEintragen && (
          <form
            action={addAenderungAction.bind(null, workshopId)}
            className="space-y-2 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700"
          >
            <textarea
              name="text"
              required
              rows={2}
              placeholder="z. B. Beispiel auf Folie 12 durch aktuelle Preise ersetzt"
              className={`${inputKlasse} w-full`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <ModulAuswahl />
              {offeneVorschlaege.length > 0 && (
                <select name="vorschlagId" defaultValue="" className={`${inputKlasse} max-w-64`}>
                  <option value="">setzt keinen Vorschlag um</option>
                  {offeneVorschlaege.map((v) => (
                    <option key={v.id} value={v.id}>
                      setzt um: {v.text.slice(0, 60)}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className={kleinerPrimaerButton}>
                Änderung eintragen
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
