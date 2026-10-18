import {
  workshopFormatEnum,
  workshopModusEnum,
  workshopStatusEnum,
  workshopTypeEnum,
  type Workshop,
} from "@/db/schema";
import { zuInputWert } from "@/lib/format";
import { STANDARD_BEGINN, STANDARD_ENDE } from "@/lib/status";

interface Option {
  id: number;
  name: string;
}

const inputKlasse =
  "w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelKlasse = "flex flex-col gap-1 text-sm font-medium";
const hinweisKlasse = "text-xs font-normal text-zinc-500";

// Day + start/end time; new dates default to 09:00–17:00 (SPEC §6).
function TerminFeld({
  name,
  label,
  start,
  ende,
}: {
  name: "termin1" | "termin2" | "terminFup";
  label: string;
  start?: Date | null;
  ende?: Date | null;
}) {
  const startWert = zuInputWert(start ?? null);
  const endeWert = zuInputWert(ende ?? null);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={`${labelKlasse} w-44`}>
        {label}
        <input type="date" name={name} defaultValue={startWert.slice(0, 10)} className={inputKlasse} />
      </label>
      <label className={`${labelKlasse} w-28`}>
        von
        <input
          type="time"
          name={`${name}Von`}
          defaultValue={startWert.slice(11, 16) || STANDARD_BEGINN}
          className={inputKlasse}
        />
      </label>
      <label className={`${labelKlasse} w-28`}>
        bis
        <input
          type="time"
          name={`${name}Bis`}
          defaultValue={endeWert.slice(11, 16) || STANDARD_ENDE}
          className={inputKlasse}
        />
      </label>
    </div>
  );
}

function UrlFeld({
  name,
  label,
  hinweis,
  wert,
}: {
  name: keyof Workshop;
  label: string;
  hinweis?: string;
  wert?: string | null;
}) {
  return (
    <label className={labelKlasse}>
      <span>
        {label} {hinweis && <span className={hinweisKlasse}>({hinweis})</span>}
      </span>
      <input name={name} type="url" defaultValue={wert ?? ""} className={inputKlasse} />
    </label>
  );
}

export function WorkshopForm({
  action,
  kunden,
  team,
  module,
  workshop,
  gewaehlteModulIds = [],
  standardVerantwortlichId,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  kunden: { id: number; firma: string }[];
  team: Option[];
  module: Option[];
  workshop?: Workshop;
  gewaehlteModulIds?: number[];
  standardVerantwortlichId?: number;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-3xl space-y-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={`${labelKlasse} sm:col-span-2`}>
          Name *
          <input name="name" required defaultValue={workshop?.name} className={inputKlasse} />
        </label>

        <label className={labelKlasse}>
          Kunde
          <select name="kundeId" defaultValue={workshop?.unternehmenId ?? ""} className={inputKlasse}>
            <option value="">– Neue Firma anlegen –</option>
            {kunden.map((k) => (
              <option key={k.id} value={k.id}>
                {k.firma}
              </option>
            ))}
          </select>
        </label>
        <label className={labelKlasse}>
          <span>
            Neue Firma <span className={hinweisKlasse}>(falls kein Kunde gewählt)</span>
          </span>
          <input name="neueFirma" className={inputKlasse} />
        </label>

        <label className={labelKlasse}>
          Ansprechperson beim Kunden
          <input
            name="ansprechperson"
            defaultValue={workshop?.ansprechperson ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          <span>
            Verantwortlich (intern){" "}
            <span className={hinweisKlasse}>(leer → Erinnerungen an service@)</span>
          </span>
          <select
            name="verantwortlichInternId"
            defaultValue={
              workshop ? (workshop.verantwortlichInternId ?? "") : (standardVerantwortlichId ?? "")
            }
            className={inputKlasse}
          >
            <option value="">– niemand –</option>
            {team.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelKlasse}>
          Type *
          <select name="type" required defaultValue={workshop?.type ?? ""} className={inputKlasse}>
            <option value="" disabled>
              – wählen –
            </option>
            {workshopTypeEnum.enumValues.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={labelKlasse}>
          Format
          <select name="format" defaultValue={workshop?.format ?? ""} className={inputKlasse}>
            <option value="">–</option>
            {workshopFormatEnum.enumValues.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className={labelKlasse}>
          Modus
          <select name="modus" defaultValue={workshop?.modus ?? ""} className={inputKlasse}>
            <option value="">–</option>
            {workshopModusEnum.enumValues.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className={labelKlasse}>
          <span>
            Ort <span className={hinweisKlasse}>(Adresse bei Präsenz)</span>
          </span>
          <input name="ort" defaultValue={workshop?.ort ?? ""} className={inputKlasse} />
        </label>

        {!workshop && (
          <label className={labelKlasse}>
            Status
            <select name="status" defaultValue="Vorabstimmung" className={inputKlasse}>
              {workshopStatusEnum.enumValues.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        {workshop && <input type="hidden" name="status" value={workshop.status} />}

        <label className={labelKlasse}>
          <span>
            Betrag (EUR) <span className={hinweisKlasse}>(nur Team)</span>
          </span>
          <input
            name="wsBetrag"
            inputMode="decimal"
            placeholder="2500.00"
            defaultValue={workshop?.wsBetrag ?? ""}
            className={inputKlasse}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Termine</h2>
        <p className={hinweisKlasse}>
          Sobald Termin 1 eingetragen ist, entsteht ein vorläufiger Kalendereintrag in
          service@; ab Status „Vorbereitung“ ist er fixiert.
        </p>
        <div className="space-y-3">
          <TerminFeld name="termin1" label="Termin 1" start={workshop?.termin1} ende={workshop?.termin1Ende} />
          <TerminFeld name="termin2" label="Termin 2" start={workshop?.termin2} ende={workshop?.termin2Ende} />
          <TerminFeld name="terminFup" label="Follow-up" start={workshop?.terminFup} ende={workshop?.terminFupEnde} />
        </div>
      </section>

      {module.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Module</h2>
          <p className={hinweisKlasse}>
            Optional — verknüpft Vorschläge und Änderungen mit den wiederverwendbaren Bausteinen.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {module.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="modulIds"
                  value={m.id}
                  defaultChecked={gewaehlteModulIds.includes(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UrlFeld
          name="verwendetesSlidedeck"
          label="Präsentation"
          hinweis="SharePoint-Freigabe-Link, sieht der Trainer"
          wert={workshop?.verwendetesSlidedeck}
        />
        <UrlFeld
          name="teamsMeetingUrl"
          label="Teams-Meeting"
          hinweis="bei Online"
          wert={workshop?.teamsMeetingUrl}
        />
        <UrlFeld
          name="formsVorabUrl"
          label="Vorab-Fragebogen"
          hinweis="Forms-Link, nur Team"
          wert={workshop?.formsVorabUrl}
        />
        <UrlFeld
          name="formsFeedbackUrl"
          label="Teilnehmer-Feedback"
          hinweis="Forms-Link, nur Team"
          wert={workshop?.formsFeedbackUrl}
        />
        <UrlFeld
          name="sharepointUrl"
          label="SharePoint-Ordner"
          hinweis="Arbeitsordner, nur Team"
          wert={workshop?.sharepointUrl}
        />
        <UrlFeld
          name="notionProjectUrl"
          label="Notion (Aufbereitungsnotizen)"
          hinweis="nur Team"
          wert={workshop?.notionProjectUrl}
        />
        <label className={labelKlasse}>
          SevDesk-ID
          <input name="sevdeskId" defaultValue={workshop?.sevdeskId ?? ""} className={inputKlasse} />
        </label>
      </section>

      <section>
        <label className={labelKlasse}>
          <span>
            Interne Notizen <span className={hinweisKlasse}>(für Trainer nicht sichtbar)</span>
          </span>
          <textarea
            name="interneNotizen"
            rows={4}
            defaultValue={workshop?.interneNotizen ?? ""}
            className={inputKlasse}
          />
        </label>
      </section>

      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        {submitLabel}
      </button>
    </form>
  );
}
