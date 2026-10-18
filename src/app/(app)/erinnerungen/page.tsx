import { asc, eq, inArray } from "drizzle-orm";
import { inputKlasse, kleinerPrimaerButton, primaerButton } from "@/components/ui";
import { db } from "@/db";
import { nutzer, rhythmusEnum, wiederkehrendeErinnerung, type WiederkehrendeErinnerung } from "@/db/schema";
import { formatDatum, formatDatumZeit, zuInputWert } from "@/lib/format";
import { RHYTHMUS_LABEL } from "@/lib/rhythmus";
import { requireAdmin } from "@/lib/session";
import {
  createErinnerungAction,
  deleteErinnerungAction,
  setErinnerungAktivAction,
  updateErinnerungAction,
} from "./actions";

function Felder({
  e,
  team,
  standardEmpfaenger,
}: {
  e?: WiederkehrendeErinnerung;
  team: { id: number; name: string }[];
  standardEmpfaenger: number | undefined;
}) {
  return (
    <>
      <input name="titel" required placeholder="Titel" defaultValue={e?.titel} className={`${inputKlasse} w-72`} />
      <select name="rhythmus" defaultValue={e?.rhythmus ?? "monatlich_erster_montag"} className={inputKlasse}>
        {rhythmusEnum.enumValues.map((r) => (
          <option key={r} value={r}>
            {RHYTHMUS_LABEL[r]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-zinc-500">
        nächste Fälligkeit
        <input
          type="datetime-local"
          name="naechsteFaelligkeit"
          required
          defaultValue={zuInputWert(e?.naechsteFaelligkeit ?? null)}
          className={inputKlasse}
        />
      </label>
      <select name="empfaengerId" defaultValue={e?.empfaengerId ?? standardEmpfaenger} className={inputKlasse}>
        {team.map((n) => (
          <option key={n.id} value={n.id}>
            an {n.name}
          </option>
        ))}
      </select>
      <input name="link" type="url" placeholder="Link (optional)" defaultValue={e?.link ?? ""} className={`${inputKlasse} w-56`} />
      <input name="notiz" placeholder="Notiz (optional)" defaultValue={e?.notiz ?? ""} className={`${inputKlasse} w-56`} />
    </>
  );
}

/** Admin-only recurring reminders (SPEC §5) — reminders only, nothing is sent to trainers. */
export default async function ErinnerungenPage() {
  const session = await requireAdmin();

  const erinnerungen = await db
    .select({ e: wiederkehrendeErinnerung, empfaenger: nutzer.name })
    .from(wiederkehrendeErinnerung)
    .innerJoin(nutzer, eq(wiederkehrendeErinnerung.empfaengerId, nutzer.id))
    .orderBy(asc(wiederkehrendeErinnerung.naechsteFaelligkeit));
  const team = await db
    .select({ id: nutzer.id, name: nutzer.name })
    .from(nutzer)
    .where(inArray(nutzer.rolle, ["admin", "team"]))
    .orderBy(asc(nutzer.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Wiederkehrende Erinnerungen</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Nur Erinnerungen für euch selbst (Mail + Dashboard) — der Hub verschickt dabei
          nichts an Trainer. Abhaken im Dashboard setzt die nächste Fälligkeit.
        </p>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {erinnerungen.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">Noch keine Erinnerungen.</li>}
        {erinnerungen.map(({ e, empfaenger }) => (
          <li key={e.id} className="space-y-1 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${e.aktiv ? "" : "line-through opacity-50"}`}>{e.titel}</span>
              <span className="text-xs text-zinc-500">
                {RHYTHMUS_LABEL[e.rhythmus]} · nächste: {formatDatum(e.naechsteFaelligkeit)} · an {empfaenger}
                {e.zuletztErledigtAm ? ` · zuletzt erledigt ${formatDatumZeit(e.zuletztErledigtAm)}` : ""}
              </span>
              <details className="ml-auto">
                <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">Bearbeiten</summary>
                <form action={updateErinnerungAction.bind(null, e.id)} className="mt-2 flex flex-wrap items-center gap-2">
                  <Felder e={e} team={team} standardEmpfaenger={session.user.nutzerId} />
                  <button type="submit" className={kleinerPrimaerButton}>
                    Speichern
                  </button>
                </form>
                <div className="mt-2 flex gap-3">
                  <form action={setErinnerungAktivAction.bind(null, e.id, !e.aktiv)}>
                    <button type="submit" className="text-xs text-zinc-500 hover:underline">
                      {e.aktiv ? "Pausieren" : "Aktivieren"}
                    </button>
                  </form>
                  <form action={deleteErinnerungAction.bind(null, e.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Löschen
                    </button>
                  </form>
                </div>
              </details>
            </div>
            {(e.notiz || e.link) && (
              <p className="text-xs text-zinc-500">
                {e.notiz}
                {e.link && (
                  <>
                    {e.notiz ? " · " : ""}
                    <a href={e.link} className="underline">
                      {e.link}
                    </a>
                  </>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>

      <form action={createErinnerungAction} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <Felder team={team} standardEmpfaenger={session.user.nutzerId} />
        <button type="submit" className={primaerButton}>
          Erinnerung anlegen
        </button>
      </form>
    </div>
  );
}
