import {
  workshopFormatEnum,
  workshopModusEnum,
  workshopStatusEnum,
  workshopTypeEnum,
  type Workshop,
} from "@/db/schema";
import { zuInputWert } from "@/lib/format";

interface KundeOption {
  id: number;
  firma: string;
}

const inputKlasse =
  "w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelKlasse = "flex flex-col gap-1 text-sm font-medium";
const hinweisKlasse = "text-xs font-normal text-zinc-500";

export function WorkshopForm({
  action,
  kunden,
  workshop,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  kunden: KundeOption[];
  workshop?: Workshop;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={`${labelKlasse} sm:col-span-2`}>
          Name *
          <input
            name="name"
            required
            defaultValue={workshop?.name}
            className={inputKlasse}
          />
        </label>

        <label className={labelKlasse}>
          Kunde
          <select
            name="kundeId"
            defaultValue={workshop?.unternehmenId ?? ""}
            className={inputKlasse}
          >
            <option value="">– Neue Firma anlegen –</option>
            {kunden.map((k) => (
              <option key={k.id} value={k.id}>
                {k.firma}
              </option>
            ))}
          </select>
        </label>
        <label className={labelKlasse}>
          Neue Firma <span className={hinweisKlasse}>(falls kein Kunde gewählt)</span>
          <input name="neueFirma" className={inputKlasse} />
        </label>

        <label className={labelKlasse}>
          Ansprechperson
          <input
            name="ansprechperson"
            defaultValue={workshop?.ansprechperson ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Type *
          <select
            name="type"
            required
            defaultValue={workshop?.type ?? ""}
            className={inputKlasse}
          >
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
          <select
            name="format"
            defaultValue={workshop?.format ?? ""}
            className={inputKlasse}
          >
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
          <select
            name="modus"
            defaultValue={workshop?.modus ?? ""}
            className={inputKlasse}
          >
            <option value="">–</option>
            {workshopModusEnum.enumValues.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {!workshop && (
          <label className={labelKlasse}>
            Status
            <select
              name="status"
              defaultValue="Vorabstimmung"
              className={inputKlasse}
            >
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
          Betrag (EUR)
          <input
            name="wsBetrag"
            inputMode="decimal"
            placeholder="2500.00"
            defaultValue={workshop?.wsBetrag ?? ""}
            className={inputKlasse}
          />
        </label>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={labelKlasse}>
          Termin 1
          <input
            type="datetime-local"
            name="termin1"
            defaultValue={zuInputWert(workshop?.termin1 ?? null)}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Termin 2
          <input
            type="datetime-local"
            name="termin2"
            defaultValue={zuInputWert(workshop?.termin2 ?? null)}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Follow-up
          <input
            type="datetime-local"
            name="terminFup"
            defaultValue={zuInputWert(workshop?.terminFup ?? null)}
            className={inputKlasse}
          />
        </label>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelKlasse}>
          SharePoint-Ordner (URL)
          <input
            name="sharepointUrl"
            type="url"
            defaultValue={workshop?.sharepointUrl ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Notion-Projekt (URL)
          <input
            name="notionProjectUrl"
            type="url"
            defaultValue={workshop?.notionProjectUrl ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Forms Vorab-Fragebogen (URL)
          <input
            name="formsVorabUrl"
            type="url"
            defaultValue={workshop?.formsVorabUrl ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Forms Feedback (URL)
          <input
            name="formsFeedbackUrl"
            type="url"
            defaultValue={workshop?.formsFeedbackUrl ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Teams-Meeting (URL)
          <input
            name="teamsMeetingUrl"
            type="url"
            defaultValue={workshop?.teamsMeetingUrl ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          Slidedeck (SharePoint-URL)
          <input
            name="verwendetesSlidedeck"
            type="url"
            defaultValue={workshop?.verwendetesSlidedeck ?? ""}
            className={inputKlasse}
          />
        </label>
        <label className={labelKlasse}>
          SevDesk-ID
          <input
            name="sevdeskId"
            defaultValue={workshop?.sevdeskId ?? ""}
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
