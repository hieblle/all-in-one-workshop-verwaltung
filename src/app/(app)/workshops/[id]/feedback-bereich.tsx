import { inputKlasse, kleinerPrimaerButton } from "@/components/ui";
import type { TrainerFeedback } from "@/db/schema";
import { formatDatumZeit } from "@/lib/format";
import type { FeedbackEintrag } from "@/lib/workshops";
import { saveFeedbackAction } from "../actions";

function NotenAuswahl({ name, wert }: { name: string; wert: number | null | undefined }) {
  return (
    <select name={name} defaultValue={wert ?? ""} className={inputKlasse}>
      <option value="">– Note –</option>
      {[5, 4, 3, 2, 1].map((n) => (
        <option key={n} value={n}>
          {n} {n === 5 ? "(sehr gut)" : n === 1 ? "(schlecht)" : ""}
        </option>
      ))}
    </select>
  );
}

/** The trainer's own feedback section (SPEC §1), editable any time. */
export function FeedbackFormular({
  workshopId,
  feedback,
}: {
  workshopId: number;
  feedback: TrainerFeedback | null;
}) {
  return (
    <form action={saveFeedbackAction.bind(null, workshopId)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Wie zufrieden warst du mit Organisation &amp; Abwicklung?</span>
          <NotenAuswahl name="abwicklungNote" wert={feedback?.abwicklungNote} />
          <textarea
            name="abwicklungText"
            rows={2}
            defaultValue={feedback?.abwicklungText ?? ""}
            placeholder="Was könnten wir besser machen?"
            className={inputKlasse}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Wie lief der Workshop?</span>
          <NotenAuswahl name="verlaufNote" wert={feedback?.verlaufNote} />
          <textarea
            name="verlaufText"
            rows={2}
            defaultValue={feedback?.verlaufText ?? ""}
            placeholder="Stimmung, Besonderheiten bei der Gruppe …"
            className={inputKlasse}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Sonstiges</span>
        <textarea
          name="sonstiges"
          rows={2}
          defaultValue={feedback?.sonstiges ?? ""}
          className={inputKlasse}
        />
      </label>
      <p className="text-xs text-zinc-500">
        Verbesserungsvorschläge für Folien und Beispiele bitte oben unter „Vorschläge“
        eintragen — jeder als eigener Eintrag.
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" className={kleinerPrimaerButton}>
          {feedback ? "Feedback aktualisieren" : "Feedback speichern"}
        </button>
        {feedback && (
          <span className="text-xs text-green-700 dark:text-green-400">
            ✓ gespeichert {formatDatumZeit(feedback.updatedAt)}
          </span>
        )}
      </div>
    </form>
  );
}

function Note({ label, note, text }: { label: string; note: number | null; text: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p>
        {note ? <span className="font-semibold">{note}/5</span> : "–"}
        {text && <span className="ml-2 whitespace-pre-wrap">{text}</span>}
      </p>
    </div>
  );
}

/** Team view of all trainer feedback for a workshop. */
export function FeedbackUebersicht({ feedbacks }: { feedbacks: FeedbackEintrag[] }) {
  if (feedbacks.length === 0) {
    return <p className="text-sm text-zinc-500">Noch kein Trainer-Feedback.</p>;
  }
  return (
    <ul className="space-y-3">
      {feedbacks.map((f) => (
        <li
          key={f.id}
          className="space-y-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
        >
          <p className="text-xs text-zinc-500">
            {f.trainerName} · {formatDatumZeit(f.updatedAt)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Note label="Abwicklung" note={f.abwicklungNote} text={f.abwicklungText} />
            <Note label="Verlauf" note={f.verlaufNote} text={f.verlaufText} />
          </div>
          {f.sonstiges && <p className="whitespace-pre-wrap">{f.sonstiges}</p>}
        </li>
      ))}
    </ul>
  );
}
