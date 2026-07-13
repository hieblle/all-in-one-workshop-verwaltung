import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  autoCheckRegelEnum,
  checklistenVorlage,
  checkpunktVorlage,
  verantwortlichRolleEnum,
  workshopStatusEnum,
  workshopTypeEnum,
  type CheckpunktVorlage,
} from "@/db/schema";
import { requireTeam } from "@/lib/session";
import {
  createPunktAction,
  createVorlageAction,
  deletePunktAction,
  deleteVorlageAction,
  updatePunktAction,
} from "./actions";

const inputKlasse =
  "rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const ROLLE_LABEL: Record<string, string> = {
  team: "Team",
  trainer_lead: "Trainer (Lead)",
  trainer_co: "Trainer (Co)",
};

function PunktFelder({ punkt }: { punkt?: CheckpunktVorlage }) {
  return (
    <>
      <input
        name="titel"
        required
        placeholder="Titel"
        defaultValue={punkt?.titel}
        className={`${inputKlasse} w-56`}
      />
      <select name="phase" defaultValue={punkt?.phase ?? "Vorbereitung"} className={inputKlasse}>
        {workshopStatusEnum.enumValues.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        name="verantwortlichRolle"
        defaultValue={punkt?.verantwortlichRolle ?? "team"}
        className={inputKlasse}
      >
        {verantwortlichRolleEnum.enumValues.map((r) => (
          <option key={r} value={r}>
            {ROLLE_LABEL[r]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-zinc-500">
        Offset (Tage)
        <input
          name="faelligOffsetTage"
          type="number"
          required
          defaultValue={punkt?.faelligOffsetTage ?? -7}
          className={`${inputKlasse} w-20`}
        />
      </label>
      <select
        name="autoCheckRegel"
        defaultValue={punkt?.autoCheckRegel ?? ""}
        className={inputKlasse}
      >
        <option value="">kein Auto-Check</option>
        {autoCheckRegelEnum.enumValues.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </>
  );
}

export default async function VorlagenPage() {
  await requireTeam();

  const vorlagen = await db
    .select()
    .from(checklistenVorlage)
    .orderBy(asc(checklistenVorlage.name));
  const punkte = await db
    .select()
    .from(checkpunktVorlage)
    .orderBy(asc(checkpunktVorlage.faelligOffsetTage));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Checklisten-Vorlagen</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Punkte werden beim Statuswechsel eines Workshops automatisch
          instanziiert. Offset in Tagen relativ zu Termin 1 (negativ = davor).
        </p>
      </div>

      {vorlagen.map((vorlage) => {
        const vorlagenPunkte = punkte.filter((p) => p.vorlageId === vorlage.id);
        return (
          <section
            key={vorlage.id}
            className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{vorlage.name}</h2>
              <span className="text-xs text-zinc-500">
                {vorlage.giltFuerType
                  ? `gilt für: ${vorlage.giltFuerType}`
                  : "gilt für alle Workshop-Typen"}
              </span>
              <form
                action={deleteVorlageAction.bind(null, vorlage.id)}
                className="ml-auto"
              >
                <button
                  type="submit"
                  className="text-xs text-red-600 hover:underline"
                >
                  Vorlage löschen
                </button>
              </form>
            </div>

            {vorlagenPunkte.length === 0 ? (
              <p className="text-sm text-zinc-500">Noch keine Punkte.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
                {vorlagenPunkte.map((punkt) => (
                  <li key={punkt.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{punkt.titel}</span>
                      <span className="text-xs text-zinc-500">
                        {punkt.phase} · {ROLLE_LABEL[punkt.verantwortlichRolle]}{" "}
                        · Offset {punkt.faelligOffsetTage} Tage
                        {punkt.autoCheckRegel
                          ? ` · Auto-Check: ${punkt.autoCheckRegel}`
                          : ""}
                      </span>
                      <details className="ml-auto">
                        <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">
                          Bearbeiten
                        </summary>
                        <form
                          action={updatePunktAction.bind(null, punkt.id)}
                          className="mt-2 flex flex-wrap items-center gap-2"
                        >
                          <PunktFelder punkt={punkt} />
                          <button
                            type="submit"
                            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
                          >
                            Speichern
                          </button>
                        </form>
                      </details>
                      <form action={deletePunktAction.bind(null, punkt.id)}>
                        <button
                          type="submit"
                          className="text-xs text-red-600 hover:underline"
                        >
                          Löschen
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <details>
              <summary className="cursor-pointer text-sm text-zinc-600 hover:underline dark:text-zinc-400">
                + Punkt hinzufügen
              </summary>
              <form
                action={createPunktAction.bind(null, vorlage.id)}
                className="mt-2 flex flex-wrap items-center gap-2"
              >
                <PunktFelder />
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500"
                >
                  Hinzufügen
                </button>
              </form>
            </details>
          </section>
        );
      })}

      <section className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="text-sm font-medium">Neue Vorlage</h2>
        <form action={createVorlageAction} className="flex flex-wrap items-center gap-2">
          <input
            name="name"
            required
            placeholder="Name der Vorlage"
            className={`${inputKlasse} w-56`}
          />
          <select name="giltFuerType" defaultValue="" className={inputKlasse}>
            <option value="">gilt für alle Typen</option>
            {workshopTypeEnum.enumValues.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500"
          >
            Anlegen
          </button>
        </form>
      </section>
    </div>
  );
}
