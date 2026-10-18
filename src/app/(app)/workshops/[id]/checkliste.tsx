import type { AutomatikSchritt } from "@/lib/automatik";
import { formatDatum, STATUS_REIHENFOLGE } from "@/lib/format";
import { sekundaerButton } from "@/components/ui";
import type { CheckpunktEintrag } from "@/lib/workshops";
import {
  addAdhocCheckpunktAction,
  assignCheckpunktAction,
  deleteCheckpunktAction,
  setCheckpunktStatusAction,
} from "../actions";

const AUTOMATIK_SYMBOL: Record<AutomatikSchritt["status"], { zeichen: string; klasse: string }> = {
  erledigt: { zeichen: "✓", klasse: "text-green-700 dark:text-green-400" },
  geplant: { zeichen: "⏳", klasse: "text-zinc-500" },
  fehler: { zeichen: "⚠", klasse: "text-red-600" },
  entfaellt: { zeichen: "–", klasse: "text-zinc-400" },
};

const kleinerButton =
  "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

function AufgabeZeile({
  punkt,
  workshopId,
  istTeam,
  team,
  links,
  heute,
}: {
  punkt: CheckpunktEintrag;
  workshopId: number;
  istTeam: boolean;
  team: { id: number; name: string }[];
  links: Record<string, string | null>;
  heute: Date;
}) {
  const ueberfaellig =
    punkt.status === "offen" && punkt.faelligAm !== null && punkt.faelligAm < heute;
  const statusAction = setCheckpunktStatusAction.bind(null, workshopId, punkt.id);
  const link = punkt.linkFeld ? links[punkt.linkFeld] : null;

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="w-4 text-center text-zinc-400">☐</span>
      <span
        className={
          punkt.status === "erledigt"
            ? "line-through opacity-60"
            : punkt.status === "uebersprungen"
              ? "italic opacity-50"
              : ""
        }
      >
        {punkt.titel}
      </span>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs underline">
          Link ↗
        </a>
      )}
      {punkt.status === "offen" ? (
        <span className={`text-xs ${ueberfaellig ? "font-semibold text-red-600" : "text-zinc-500"}`}>
          {punkt.faelligAm ? `fällig ${formatDatum(punkt.faelligAm)}` : "ohne Frist (kein Termin)"}
          {ueberfaellig && " (überfällig)"}
        </span>
      ) : (
        <span className="text-xs text-zinc-500">
          {punkt.status === "erledigt" ? "erledigt" : "übersprungen"}
          {punkt.erledigtVia === "auto"
            ? " · automatisch"
            : punkt.erledigtVonName
              ? ` · ${punkt.erledigtVonName}`
              : ""}
          {punkt.erledigtAm ? ` · ${formatDatum(punkt.erledigtAm)}` : ""}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2">
        {istTeam ? (
          <form
            action={assignCheckpunktAction.bind(null, workshopId, punkt.id)}
            className="flex items-center gap-1"
          >
            <select
              name="verantwortlichUserId"
              defaultValue={punkt.verantwortlichUserId ?? ""}
              className="rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">– Standard –</option>
              {team.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <button type="submit" className={kleinerButton}>
              Umhängen
            </button>
          </form>
        ) : null}
        {istTeam && punkt.verantwortlichName === null && punkt.status === "offen" && (
          <span className="text-xs text-zinc-500">→ service@</span>
        )}
        {istTeam &&
          punkt.verantwortlichName !== null &&
          !team.some((t) => t.id === punkt.verantwortlichUserId) && (
            <span className="text-xs text-zinc-500">{punkt.verantwortlichName}</span>
          )}
        {punkt.status === "offen" ? (
          <>
            <form action={statusAction}>
              <input type="hidden" name="status" value="erledigt" />
              <button
                type="submit"
                className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-500"
              >
                Erledigt
              </button>
            </form>
            {istTeam && (
              <form action={statusAction}>
                <input type="hidden" name="status" value="uebersprungen" />
                <button type="submit" className={kleinerButton}>
                  Überspringen
                </button>
              </form>
            )}
          </>
        ) : (
          <form action={statusAction}>
            <input type="hidden" name="status" value="offen" />
            <button type="submit" className={kleinerButton}>
              Wieder öffnen
            </button>
          </form>
        )}
        {istTeam && punkt.loeschbar && (
          <form action={deleteCheckpunktAction.bind(null, workshopId, punkt.id)}>
            <button
              type="submit"
              title="Eigene Aufgabe löschen"
              className="rounded px-1 text-xs text-zinc-400 hover:text-red-600"
            >
              ✕
            </button>
          </form>
        )}
      </span>
    </li>
  );
}

function AutomatikZeile({ schritt }: { schritt: AutomatikSchritt }) {
  const symbol = AUTOMATIK_SYMBOL[schritt.status];
  return (
    <li className="flex flex-wrap items-center gap-2 bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/50">
      <span className="w-4 text-center text-zinc-400" title="macht der Hub automatisch">
        ⚙
      </span>
      <span className={schritt.status === "entfaellt" ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}>
        {schritt.titel}
      </span>
      <span className={`text-xs ${symbol.klasse}`}>
        {symbol.zeichen} {schritt.detail}
      </span>
    </li>
  );
}

/**
 * One overview with both kinds of entries (SPEC §4): ☐ tasks for humans and
 * ⚙ automatic steps (status only, never reminders). Trainers see only their
 * own tasks.
 */
export function Checkliste({
  workshopId,
  punkte,
  automatik,
  istTeam,
  team = [],
  links = {},
  jetzt,
}: {
  workshopId: number;
  punkte: CheckpunktEintrag[];
  automatik: AutomatikSchritt[];
  istTeam: boolean;
  team?: { id: number; name: string }[];
  links?: Record<string, string | null>;
  jetzt: Date;
}) {
  const heute = new Date(jetzt);
  heute.setHours(0, 0, 0, 0);
  const phasen = STATUS_REIHENFOLGE.filter(
    (phase) =>
      punkte.some((p) => p.phase === phase) || automatik.some((a) => a.phase === phase),
  );

  if (phasen.length === 0) {
    return <p className="text-sm text-zinc-500">Keine offenen Aufgaben für dich.</p>;
  }

  return (
    <div className="space-y-4">
      {phasen.map((phase) => (
        <div key={phase}>
          <h3 className="mb-1 text-xs font-semibold text-zinc-500">{phase}</h3>
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {automatik
              .filter((a) => a.phase === phase)
              .map((a) => (
                <AutomatikZeile key={a.schluessel} schritt={a} />
              ))}
            {punkte
              .filter((p) => p.phase === phase)
              .map((p) => (
                <AufgabeZeile
                  key={p.id}
                  punkt={p}
                  workshopId={workshopId}
                  istTeam={istTeam}
                  team={team}
                  links={links}
                  heute={heute}
                />
              ))}
          </ul>
        </div>
      ))}

      {istTeam && (
        <details>
          <summary className="cursor-pointer text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            + Eigene Aufgabe hinzufügen
          </summary>
          <form
            action={addAdhocCheckpunktAction.bind(null, workshopId)}
            className="mt-2 flex flex-wrap items-center gap-2 text-sm"
          >
            <input
              name="titel"
              required
              placeholder="Was ist zu tun?"
              className="w-64 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <label className="flex items-center gap-1 text-xs text-zinc-500">
              fällig am
              <input
                type="datetime-local"
                name="faelligAm"
                className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <select
              name="verantwortlichUserId"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">– Verantwortlich intern –</option>
              {team.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <button type="submit" className={sekundaerButton}>
              Hinzufügen
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
