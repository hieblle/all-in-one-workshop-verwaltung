import { desc } from "drizzle-orm";
import Link from "next/link";
import { inputKlasse, karte, primaerButton, sekundaerButton } from "@/components/ui";
import { db } from "@/db";
import { jobLauf } from "@/db/schema";
import { getDatumOffsetTage, getJetzt } from "@/lib/einstellungen";
import { formatDatum, formatDatumZeit } from "@/lib/format";
import { ABSENDER_EMAIL, istTestLoginAktiv, SERVICE_EMAIL } from "@/lib/konfig";
import { requireAdmin } from "@/lib/session";
import {
  naechsterTagAction,
  setDatumOffsetAction,
  tagesjobAusfuehrenAction,
  verschiebeDatumAction,
} from "./actions";

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ tagesjob?: string }>;
}) {
  await requireAdmin();
  const { tagesjob } = await searchParams;
  const offset = await getDatumOffsetTage();
  const jetzt = await getJetzt();
  const laeufe = await db.select().from(jobLauf).orderBy(desc(jobLauf.id)).limit(10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">System</h1>
        <p className="mt-1 text-sm text-zinc-500">
          MVP-Werkzeuge zum Durchspielen. Nichts hier verschickt echte Mails — alles landet
          im{" "}
          <Link href="/postausgang" className="underline">
            Postausgang
          </Link>
          .
        </p>
      </div>

      {tagesjob && (
        <p
          className={`rounded-md p-3 text-sm ${tagesjob === "ok" ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}
        >
          {tagesjob === "ok"
            ? "Tagesjob ausgeführt — neue Mails stehen im Postausgang."
            : "Tagesjob fehlgeschlagen — siehe Läufe unten."}
        </p>
      )}

      <section className={`space-y-3 ${karte}`}>
        <h2 className="font-medium">Datum simulieren</h2>
        <p className="text-sm">
          Der Hub rechnet aktuell mit <strong>{formatDatum(jetzt)}</strong>
          {offset !== 0 ? ` (${offset > 0 ? "+" : ""}${offset} Tage)` : " (echtes Datum)"}.
          Fristen, Überfällig-Markierungen, Erinnerungen und der Tagesjob verwenden dieses Datum.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[-7, -1, 1, 7, 14].map((t) => (
            <form key={t} action={verschiebeDatumAction.bind(null, t)}>
              <button type="submit" className={sekundaerButton}>
                {t > 0 ? `+${t}` : t} {Math.abs(t) === 1 ? "Tag" : "Tage"}
              </button>
            </form>
          ))}
          <form action={setDatumOffsetAction} className="flex items-center gap-1">
            <input name="tage" type="number" defaultValue={offset} className={`${inputKlasse} w-20`} />
            <button type="submit" className={sekundaerButton}>
              Tage setzen
            </button>
          </form>
          {offset !== 0 && (
            <form action={setDatumOffsetAction}>
              <input type="hidden" name="tage" value="0" />
              <button type="submit" className={sekundaerButton}>
                Zurück zu heute
              </button>
            </form>
          )}
        </div>
      </section>

      <section className={`space-y-3 ${karte}`}>
        <h2 className="font-medium">Tagesjob</h2>
        <p className="text-sm text-zinc-500">
          Läuft auf dem Server täglich um 07:00: Feedback-Erinnerungen an Trainer (+1),
          „Feedback fehlt“-Aufgaben (+7), Sammel-Mails, Eskalationen (2 Tage überfällig)
          und wiederkehrende Erinnerungen. Lokal hier per Hand.
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={tagesjobAusfuehrenAction}>
            <button type="submit" className={primaerButton}>
              Tagesjob jetzt ausführen
            </button>
          </form>
          <form action={naechsterTagAction}>
            <button type="submit" className={sekundaerButton}>
              Nächster Tag + Tagesjob
            </button>
          </form>
        </div>
        {laeufe.length > 0 && (
          <ul className="space-y-1 text-xs">
            {laeufe.map((l) => (
              <li key={l.id} className={l.erfolg ? "text-zinc-500" : "text-red-600"}>
                {formatDatumZeit(l.createdAt)} · {l.erfolg ? "✓" : "✗"} {l.meldung}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`space-y-1 text-sm ${karte}`}>
        <h2 className="mb-2 font-medium">Konfiguration</h2>
        <p>Versand: <strong>Vorschau</strong> (MVP — es geht nichts raus)</p>
        <p>Absender: {ABSENDER_EMAIL}</p>
        <p>Kalender / Fallback-Empfänger: {SERVICE_EMAIL}</p>
        <p>Test-Login: {istTestLoginAktiv() ? "aktiv" : "aus"}</p>
      </section>
    </div>
  );
}
