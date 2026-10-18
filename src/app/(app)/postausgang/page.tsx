import { and, desc, eq, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { postausgang, workshop } from "@/db/schema";
import { formatDatumZeit } from "@/lib/format";
import { ABSENDER_EMAIL, SERVICE_EMAIL } from "@/lib/konfig";
import { requireTeam } from "@/lib/session";

const ANLASS_LABEL: Record<string, string> = {
  trainer_anfrage: "Anfrage an Trainer",
  trainer_infopaket: "Infopaket",
  trainer_update: "Update an Trainer",
  trainer_absage: "Absage-Info ans Team",
  trainer_feedback_erinnerung: "Feedback-Erinnerung",
  sammelmail: "Sammel-Mail",
  eskalation: "Eskalation",
  wiederkehrende_erinnerung: "Wiederkehrende Erinnerung",
  alarm: "Alarm",
  login_link: "Login-Link",
  kalender_anlegen: "Kalender: anlegen",
  kalender_aktualisieren: "Kalender: aktualisieren",
  kalender_absagen: "Kalender: absagen",
};

const STATUS_KLASSE: Record<string, string> = {
  vorschau: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  entwurf: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  gesendet: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  fehlgeschlagen: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  blockiert: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

/**
 * Preview + protocol of everything the hub would send (SPEC §7/§8). In the
 * MVP nothing leaves the hub — this page shows what would have gone out.
 */
export default async function PostausgangPage({
  searchParams,
}: {
  searchParams: Promise<{ art?: string; workshop?: string }>;
}) {
  await requireTeam();
  const { art, workshop: workshopParam } = await searchParams;
  const bedingungen: SQL[] = [];
  if (art === "mail" || art === "kalender") bedingungen.push(eq(postausgang.art, art));
  const workshopId = Number(workshopParam);
  if (Number.isInteger(workshopId) && workshopId > 0) {
    bedingungen.push(eq(postausgang.workshopId, workshopId));
  }

  const eintraege = await db
    .select({ p: postausgang, workshopName: workshop.name })
    .from(postausgang)
    .leftJoin(workshop, eq(postausgang.workshopId, workshop.id))
    .where(bedingungen.length ? and(...bedingungen) : undefined)
    .orderBy(desc(postausgang.id))
    .limit(300);

  const filterLink = (wert?: string) =>
    `/postausgang${wert ? `?art=${wert}` : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Postausgang</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Vorschau: Alles, was der Hub verschicken würde — Mails von {ABSENDER_EMAIL},
          Kalendereinträge in {SERVICE_EMAIL}. Im MVP geht nichts raus.
        </p>
      </div>

      <div className="flex gap-2 text-xs">
        {[
          { wert: undefined, label: "Alle" },
          { wert: "mail", label: "Mails" },
          { wert: "kalender", label: "Kalender" },
        ].map((f) => (
          <Link
            key={f.label}
            href={filterLink(f.wert)}
            className={`rounded-md px-2 py-1 ${art === f.wert || (!art && !f.wert) ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            {f.label}
          </Link>
        ))}
        {workshopParam && (
          <Link href="/postausgang" className="rounded-md px-2 py-1 underline">
            Workshop-Filter entfernen
          </Link>
        )}
      </div>

      {eintraege.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Noch nichts im Postausgang.
        </p>
      ) : (
        <ul className="space-y-2">
          {eintraege.map(({ p, workshopName }) => (
            <li key={p.id} className="rounded-md border border-zinc-200 text-sm dark:border-zinc-800">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
                  <span>{p.art === "mail" ? "✉️" : "📅"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_KLASSE[p.status]}`}>{p.status}</span>
                  <span className="font-medium">{p.betreff}</span>
                  <span className="text-xs text-zinc-500">
                    an {p.empfaenger} · {ANLASS_LABEL[p.anlass] ?? p.anlass}
                    {workshopName && ` · ${workshopName}`}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">
                    {formatDatumZeit(p.erzeugtFuer)}
                    {Math.abs(p.erzeugtFuer.getTime() - p.createdAt.getTime()) > 3_600_000 && " (simuliert)"}
                  </span>
                </summary>
                <div className="space-y-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  {p.fehler && <p className="text-xs text-red-600">{p.fehler}</p>}
                  <pre className="whitespace-pre-wrap font-sans text-sm">{p.text}</pre>
                  {p.workshopId && (
                    <Link href={`/workshops/${p.workshopId}`} className="text-xs underline">
                      zum Workshop
                    </Link>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
