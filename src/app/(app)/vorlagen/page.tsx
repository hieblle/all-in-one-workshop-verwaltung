import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  autoCheckRegelEnum,
  checklistenVorlage,
  checkpunktVorlage,
  linkFeldEnum,
  nurModusEnum,
  verantwortlichRolleEnum,
  workshopStatusEnum,
  workshopTypeEnum,
  type CheckpunktVorlage,
} from "@/db/schema";
import { berechneAutomatikSchritte } from "@/lib/automatik";
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
  team: "Team (Verantwortlich intern)",
  trainer_lead: "Lead-Trainer",
  trainer_co: "Co-Trainer",
};

const REGEL_LABEL: Record<string, string> = {
  termin_eingetragen: "abhaken, sobald Termin 1 eingetragen ist",
  trainer_zugewiesen: "abhaken, sobald ein Trainer zugewiesen ist",
  praesentation_eingetragen: "abhaken, sobald die Präsentation verlinkt ist",
  angebot_angenommen: "entfällt, sobald das Angebot angenommen ist (Status Vorbereitung)",
};

const MODUS_LABEL: Record<string, string> = { online: "nur Online", praesenz: "nur Präsenz" };
const LINK_LABEL: Record<string, string> = {
  forms_vorab: "Link: Vorab-Fragebogen",
  forms_feedback: "Link: Teilnehmer-Feedback",
  notion: "Link: Notion",
};

function PunktFelder({ punkt }: { punkt?: CheckpunktVorlage }) {
  return (
    <>
      <input
        name="titel"
        required
        placeholder="Titel"
        defaultValue={punkt?.titel}
        className={`${inputKlasse} w-72`}
      />
      <select name="phase" defaultValue={punkt?.phase ?? "Vorbereitung"} className={inputKlasse}>
        {workshopStatusEnum.enumValues
          .filter((s) => s !== "On-Hold" && s !== "Abgesagt")
          .map((s) => (
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
        Frist (Tage zu Termin 1)
        <input
          name="faelligOffsetTage"
          type="number"
          required
          defaultValue={punkt?.faelligOffsetTage ?? -7}
          className={`${inputKlasse} w-20`}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-zinc-500">
        Reihenfolge
        <input
          name="reihenfolge"
          type="number"
          defaultValue={punkt?.reihenfolge ?? 0}
          className={`${inputKlasse} w-16`}
        />
      </label>
      <select name="autoCheckRegel" defaultValue={punkt?.autoCheckRegel ?? ""} className={inputKlasse}>
        <option value="">manuell abhaken</option>
        {autoCheckRegelEnum.enumValues.map((r) => (
          <option key={r} value={r}>
            {REGEL_LABEL[r]}
          </option>
        ))}
      </select>
      <select name="nurModus" defaultValue={punkt?.nurModus ?? ""} className={inputKlasse}>
        <option value="">Online &amp; Präsenz</option>
        {nurModusEnum.enumValues.map((m) => (
          <option key={m} value={m}>
            {MODUS_LABEL[m]}
          </option>
        ))}
      </select>
      <select name="linkFeld" defaultValue={punkt?.linkFeld ?? ""} className={inputKlasse}>
        <option value="">kein Link</option>
        {linkFeldEnum.enumValues.map((l) => (
          <option key={l} value={l}>
            {LINK_LABEL[l]}
          </option>
        ))}
      </select>
    </>
  );
}

export default async function VorlagenPage() {
  const session = await requireTeam();
  const istAdmin = session.user.rolle === "admin";

  const vorlagen = await db
    .select()
    .from(checklistenVorlage)
    .orderBy(asc(checklistenVorlage.name));
  const punkte = await db
    .select()
    .from(checkpunktVorlage)
    .orderBy(asc(checkpunktVorlage.reihenfolge), asc(checkpunktVorlage.faelligOffsetTage));

  // The fixed ⚙ steps, rendered from an empty workshop for documentation.
  const automatik = berechneAutomatikSchritte({
    status: "Vorabstimmung",
    modus: "ONLINE",
    teamsMeetingUrl: null,
    kalender: [],
    trainer: [],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Checkliste</h1>
        <p className="mt-1 text-sm text-zinc-500">
          ☐ Aufgaben für Menschen kommen aus den Vorlagen unten: Jeder Workshop bekommt sie
          automatisch, Fristen relativ zu Termin 1 (negativ = davor). Nur Aufgaben erzeugen
          Erinnerungen. {istAdmin ? "Änderungen gelten sofort für alle laufenden Workshops." : "Ändern kann nur ein Admin."}
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
              {istAdmin && (
                <form action={deleteVorlageAction.bind(null, vorlage.id)} className="ml-auto">
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Vorlage löschen
                  </button>
                </form>
              )}
            </div>

            {vorlagenPunkte.length === 0 ? (
              <p className="text-sm text-zinc-500">Noch keine Aufgaben.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
                {vorlagenPunkte.map((punkt) => (
                  <li key={punkt.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-4 text-center text-zinc-400">☐</span>
                      <span className="font-medium">{punkt.titel}</span>
                      <span className="text-xs text-zinc-500">
                        {punkt.phase} · {ROLLE_LABEL[punkt.verantwortlichRolle]} ·{" "}
                        {punkt.faelligOffsetTage > 0 ? "+" : ""}
                        {punkt.faelligOffsetTage} Tage
                        {punkt.autoCheckRegel ? ` · ${REGEL_LABEL[punkt.autoCheckRegel]}` : ""}
                        {punkt.nurModus ? ` · ${MODUS_LABEL[punkt.nurModus]}` : ""}
                        {punkt.linkFeld ? ` · ${LINK_LABEL[punkt.linkFeld]}` : ""}
                      </span>
                      {istAdmin && (
                        <>
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
                            <button type="submit" className="text-xs text-red-600 hover:underline">
                              Löschen
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {istAdmin && (
              <details>
                <summary className="cursor-pointer text-sm text-zinc-600 hover:underline dark:text-zinc-400">
                  + Aufgabe hinzufügen
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
            )}
          </section>
        );
      })}

      {istAdmin && (
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
      )}

      <section className="space-y-2">
        <h2 className="font-medium">⚙ Automatik-Schritte</h2>
        <p className="text-sm text-zinc-500">
          Fest eingebaut — der Hub erledigt sie selbst und zeigt in jedem Workshop nur den
          Status. Sie erzeugen nie Erinnerungen.
        </p>
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
          {automatik.map((a) => (
            <li key={a.schluessel} className="flex flex-wrap gap-2 bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
              <span className="w-4 text-center text-zinc-400">⚙</span>
              <span>{a.titel}</span>
              <span className="text-xs text-zinc-500">{a.phase}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
