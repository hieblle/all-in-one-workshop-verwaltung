import { asc, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  gefahrButton,
  inputKlasse,
  karte,
  kleinerPrimaerButton,
  sekundaerButton,
} from "@/components/ui";
import { db } from "@/db";
import {
  nutzer,
  rechnungStatusEnum,
  trainer,
  trainerReStatusEnum,
  workshopStatusEnum,
} from "@/db/schema";
import { AccessDeniedError } from "@/lib/access";
import { getJetzt } from "@/lib/einstellungen";
import {
  formatBetrag,
  formatDatumZeit,
  formatTerminSpanne,
  STATUS_FARBEN,
} from "@/lib/format";
import { requireSession } from "@/lib/session";
import { idSchema } from "@/lib/validation";
import {
  getWorkshopDetail,
  type TeamWorkshopDetail,
  type TrainerWorkshopDetail,
  type WorkshopBasis,
} from "@/lib/workshops";
import {
  addZuweisungAction,
  antwortTrainerAction,
  archiveWorkshopAction,
  changeStatusAction,
  deleteWorkshopAction,
  removeZuweisungAction,
  restoreWorkshopAction,
  setTeamsLinkAction,
  setZuweisungStatusAction,
  updateRechnungAction,
} from "../actions";
import { ChangelogBereich } from "./changelog-bereich";
import { Checkliste } from "./checkliste";
import { FeedbackFormular, FeedbackUebersicht } from "./feedback-bereich";

const ZUWEISUNG_ROLLE_LABEL: Record<string, string> = {
  lead: "Lead",
  co: "Co-Trainer:in",
  uebergabe_extern: "Übergabe extern",
};

const ZUWEISUNG_STATUS_LABEL: Record<string, string> = {
  angefragt: "angefragt",
  bestaetigt: "zugesagt",
  abgesagt: "abgesagt",
};

const FELD_LABEL: Record<string, string> = {
  termin1: "Termin 1",
  termin1Ende: "Termin 1 Ende",
  termin2: "Termin 2",
  termin2Ende: "Termin 2 Ende",
  terminFup: "Follow-up",
  terminFupEnde: "Follow-up Ende",
  verantwortlichInternId: "Verantwortlich intern (ID)",
  verwendetesSlidedeck: "Präsentation",
  teamsMeetingUrl: "Teams-Meeting",
  unternehmenId: "Kunde (ID)",
  wsBetrag: "Betrag",
  rechnungStatus: "Rechnung",
  trainerRe: "Trainer-RE",
  interneNotizen: "Interne Notizen",
  formsVorabUrl: "Vorab-Fragebogen",
  formsFeedbackUrl: "Teilnehmer-Feedback",
};

function ExternerLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={sekundaerButton}>
      {label} ↗
    </a>
  );
}

// SharePoint sharing links download the file with ?download=1.
function downloadLink(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function BasisInfos({ b }: { b: WorkshopBasis }) {
  return (
    <>
      <Info label="Kunde">{b.firma}</Info>
      <Info label="Ansprechperson">{b.ansprechperson ?? "–"}</Info>
      <Info label="Type">{b.type}</Info>
      <Info label="Format / Modus">
        {b.format ?? "–"} / {b.modus ?? "–"}
      </Info>
      <Info label="Ort">{b.ort ?? "–"}</Info>
      <Info label="Termin 1">{formatTerminSpanne(b.termin1, b.termin1Ende)}</Info>
      <Info label="Termin 2">{formatTerminSpanne(b.termin2, b.termin2Ende)}</Info>
      <Info label="Follow-up">{formatTerminSpanne(b.terminFup, b.terminFupEnde)}</Info>
    </>
  );
}

function Praesentation({ url }: { url: string | null }) {
  if (!url) {
    return <p className="text-sm text-zinc-500">Die Präsentation ist noch nicht verlinkt.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      <a href={url} target="_blank" rel="noopener noreferrer" className={kleinerPrimaerButton}>
        Präsentation öffnen ↗
      </a>
      <a href={downloadLink(url)} className={sekundaerButton}>
        Herunterladen ↓
      </a>
    </div>
  );
}

// --- Trainer-Sicht --------------------------------------------------------------

function TrainerAnsicht({ d, jetzt }: { d: TrainerWorkshopDetail; jetzt: Date }) {
  const b = d.basis;
  const bestaetigt = d.eigeneZuweisung.status === "bestaetigt";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/" className="hover:underline">
            Dashboard
          </Link>{" "}
          / {b.firma}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{b.name}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_FARBEN[b.status]}`}>
            {b.status}
          </span>
        </div>
      </div>

      {d.eigeneZuweisung.status === "angefragt" && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <p className="text-sm font-medium">
            Du bist für diesen Workshop angefragt ({ZUWEISUNG_ROLLE_LABEL[d.eigeneZuweisung.rolle]}).
          </p>
          <span className="ml-auto flex gap-2">
            <form action={antwortTrainerAction.bind(null, b.id, d.eigeneZuweisung.id)}>
              <input type="hidden" name="antwort" value="bestaetigt" />
              <button type="submit" className={kleinerPrimaerButton}>
                Zusagen
              </button>
            </form>
            <form action={antwortTrainerAction.bind(null, b.id, d.eigeneZuweisung.id)}>
              <input type="hidden" name="antwort" value="abgesagt" />
              <button type="submit" className={sekundaerButton}>
                Absagen
              </button>
            </form>
          </span>
        </section>
      )}

      <section
        className={`grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4 ${karte}`}
      >
        <BasisInfos b={b} />
        <Info label="Teams-Meeting">
          {b.teamsMeetingUrl ? (
            <a href={b.teamsMeetingUrl} target="_blank" rel="noopener noreferrer" className="underline">
              beitreten ↗
            </a>
          ) : (
            "–"
          )}
        </Info>
        <Info label="Module">{d.module.map((m) => m.name).join(", ") || "–"}</Info>
        <Info label="Mit-Trainer">
          {d.mitTrainer.length
            ? d.mitTrainer.map((t) => `${t.name} (${ZUWEISUNG_ROLLE_LABEL[t.rolle]})`).join(", ")
            : "–"}
        </Info>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Präsentation</h2>
        <Praesentation url={b.praesentationUrl} />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Deine Aufgaben</h2>
        <Checkliste
          workshopId={b.id}
          punkte={d.checkpunkte}
          automatik={[]}
          istTeam={false}
          jetzt={jetzt}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Vorschläge &amp; Change-Log</h2>
        <ChangelogBereich
          workshopId={b.id}
          module={d.module}
          vorschlaege={d.vorschlaege}
          aenderungen={d.aenderungen}
          istTeam={false}
          darfEintragen={bestaetigt}
        />
      </section>

      {bestaetigt && (
        <section className={`space-y-3 ${karte}`}>
          <h2 className="font-medium">Dein Feedback</h2>
          <p className="text-xs text-zinc-500">
            Nach dem Workshop: kurzes Feedback an das dbrains-Team (2–3 Minuten). Nur das
            Team sieht es.
          </p>
          <FeedbackFormular workshopId={b.id} feedback={d.eigenesFeedback} />
        </section>
      )}
    </div>
  );
}

// --- Team-Sicht -------------------------------------------------------------------

async function TeamAnsicht({
  d,
  jetzt,
  istAdmin,
}: {
  d: TeamWorkshopDetail;
  jetzt: Date;
  istAdmin: boolean;
}) {
  const ws = d.workshop;
  const [alleTrainer, team] = await Promise.all([
    db
      .select({ id: trainer.id, name: trainer.name, aktiv: trainer.aktiv })
      .from(trainer)
      .orderBy(asc(trainer.name)),
    db
      .select({ id: nutzer.id, name: nutzer.name })
      .from(nutzer)
      .where(inArray(nutzer.rolle, ["admin", "team"]))
      .orderBy(asc(nutzer.name)),
  ]);
  const zugewiesen = new Set(d.zuweisungen.map((z) => z.trainerId));
  const verfuegbar = alleTrainer.filter((t) => t.aktiv && !zugewiesen.has(t.id));

  return (
    <div className="space-y-8">
      {ws.archiviertAm && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-300 bg-zinc-100 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span>📦 Archiviert am {formatDatumZeit(ws.archiviertAm)} — erscheint in keiner Liste und erzeugt keine Erinnerungen.</span>
          <form action={restoreWorkshopAction.bind(null, ws.id)}>
            <button type="submit" className={sekundaerButton}>
              Wiederherstellen
            </button>
          </form>
          {istAdmin && (
            <details className="ml-auto">
              <summary className="cursor-pointer text-xs text-red-700 hover:underline dark:text-red-400">
                Endgültig löschen …
              </summary>
              <div className="mt-2 space-y-2">
                <p className="max-w-sm text-xs text-zinc-600 dark:text-zinc-400">
                  Löscht den Workshop samt Checkliste, Zuweisungen, Vorschlägen,
                  Änderungen und Feedback unwiderruflich. Verlauf und Postausgang
                  bleiben erhalten.
                </p>
                <form action={deleteWorkshopAction.bind(null, ws.id)}>
                  <button type="submit" className={gefahrButton}>
                    Ja, endgültig löschen
                  </button>
                </form>
              </div>
            </details>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/workshops" className="hover:underline">
              Workshops
            </Link>{" "}
            / {d.basis.firma}
          </p>
          <h1 className="text-2xl font-semibold">{ws.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_FARBEN[ws.status]}`}>
            {ws.status}
          </span>
          <form action={changeStatusAction.bind(null, ws.id)} className="flex items-center gap-1">
            <select name="status" defaultValue={ws.status} className={`${inputKlasse} text-xs`}>
              {workshopStatusEnum.enumValues.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className={sekundaerButton}>
              Status ändern
            </button>
          </form>
          <Link href={`/workshops/${ws.id}/bearbeiten`} className={sekundaerButton}>
            Bearbeiten
          </Link>
          {!ws.archiviertAm && (
            <form action={archiveWorkshopAction.bind(null, ws.id)}>
              <button type="submit" className={sekundaerButton} title="Statt löschen: archivieren">
                Archivieren
              </button>
            </form>
          )}
        </div>
      </div>

      <section
        className={`grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4 ${karte}`}
      >
        <BasisInfos b={d.basis} />
        <Info label="Verantwortlich (intern)">
          {d.verantwortlichName ?? <span className="text-zinc-500">niemand → service@</span>}
        </Info>
        <Info label="Betrag">{formatBetrag(ws.wsBetrag)}</Info>
        <div className="col-span-2">
          <dt className="text-xs text-zinc-500">Rechnung / Trainer-RE</dt>
          <dd>
            <form
              action={updateRechnungAction.bind(null, ws.id)}
              className="mt-1 flex flex-wrap items-center gap-2"
            >
              <select name="rechnungStatus" defaultValue={ws.rechnungStatus} className={`${inputKlasse} text-xs`}>
                {rechnungStatusEnum.enumValues.map((s) => (
                  <option key={s} value={s}>
                    Rechnung: {s}
                  </option>
                ))}
              </select>
              <select name="trainerRe" defaultValue={ws.trainerRe} className={`${inputKlasse} text-xs`}>
                {trainerReStatusEnum.enumValues.map((s) => (
                  <option key={s} value={s}>
                    Trainer-RE: {s}
                  </option>
                ))}
              </select>
              <button type="submit" className={sekundaerButton}>
                Speichern
              </button>
            </form>
          </dd>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Präsentation &amp; Links</h2>
        <Praesentation url={ws.verwendetesSlidedeck} />
        <div className="flex flex-wrap gap-2 pt-1">
          <ExternerLink href={ws.sharepointUrl} label="SharePoint-Ordner" />
          <ExternerLink href={ws.notionProjectUrl} label="Notion (Aufbereitung)" />
          <ExternerLink href={ws.formsVorabUrl} label="Vorab-Fragebogen" />
          <ExternerLink href={ws.formsFeedbackUrl} label="Teilnehmer-Feedback" />
          {d.module.map((m) => (
            <ExternerLink key={m.id} href={m.sharepointUrl} label={`Modul ${m.name}`} />
          ))}
        </div>
        <form
          action={setTeamsLinkAction.bind(null, ws.id)}
          className="flex flex-wrap items-center gap-2 pt-1 text-sm"
        >
          <label className="text-xs text-zinc-500" htmlFor="teamsMeetingUrl">
            Teams-Meeting
          </label>
          <input
            id="teamsMeetingUrl"
            name="teamsMeetingUrl"
            type="url"
            defaultValue={ws.teamsMeetingUrl ?? ""}
            placeholder="https://teams.microsoft.com/…"
            className={`${inputKlasse} w-80`}
          />
          <button type="submit" className={sekundaerButton}>
            Link speichern
          </button>
          <span className="text-xs text-zinc-500">
            überschreibt den automatischen Link · Kalender &amp; Trainer werden aktualisiert
          </span>
        </form>
        {d.module.length === 0 && (
          <p className="text-xs text-zinc-500">Keine Module zugeordnet (optional, unter „Bearbeiten“).</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Trainer</h2>
        {d.zuweisungen.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch niemand zugewiesen.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {d.zuweisungen.map((z) => (
              <li key={z.id} className="flex flex-wrap items-center gap-2">
                <span className={`font-medium ${z.status === "abgesagt" ? "line-through opacity-60" : ""}`}>
                  {z.trainerName}
                </span>
                <span className="text-xs text-zinc-500">
                  {ZUWEISUNG_ROLLE_LABEL[z.rolle] ?? z.rolle} · {ZUWEISUNG_STATUS_LABEL[z.status]}
                  {z.anfrageGesendetAm ? ` · angefragt ${formatDatumZeit(z.anfrageGesendetAm)}` : ""}
                </span>
                {z.status === "angefragt" && (
                  <>
                    <form action={setZuweisungStatusAction.bind(null, ws.id, z.id)}>
                      <input type="hidden" name="antwort" value="bestaetigt" />
                      <button type="submit" className="text-xs text-blue-700 hover:underline dark:text-blue-400" title="Zusage kam per Telefon/Mail">
                        Zusage eintragen
                      </button>
                    </form>
                    <form action={setZuweisungStatusAction.bind(null, ws.id, z.id)}>
                      <input type="hidden" name="antwort" value="abgesagt" />
                      <button type="submit" className="text-xs text-zinc-500 hover:underline">
                        Absage eintragen
                      </button>
                    </form>
                  </>
                )}
                <form action={removeZuweisungAction.bind(null, ws.id, z.id)}>
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Entfernen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {verfuegbar.length > 0 && (
          <form
            action={addZuweisungAction.bind(null, ws.id)}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <select name="trainerId" className={inputKlasse}>
              {verfuegbar.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select name="rolle" className={inputKlasse}>
              <option value="lead">Lead</option>
              <option value="co">Co-Trainer:in</option>
              <option value="uebergabe_extern">Übergabe extern</option>
            </select>
            <button type="submit" className={sekundaerButton}>
              Anfragen
            </button>
            <span className="text-xs text-zinc-500">→ Trainer bekommt automatisch eine Anfrage-Mail</span>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">
          Checkliste{" "}
          <span className="text-xs font-normal text-zinc-500">
            ☐ Aufgabe für Menschen · ⚙ macht der Hub automatisch
          </span>
        </h2>
        <Checkliste
          workshopId={ws.id}
          punkte={d.checkpunkte}
          automatik={d.automatik}
          istTeam
          team={team}
          links={{
            forms_vorab: ws.formsVorabUrl,
            forms_feedback: ws.formsFeedbackUrl,
            notion: ws.notionProjectUrl,
          }}
          jetzt={jetzt}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Vorschläge &amp; Change-Log</h2>
        <ChangelogBereich
          workshopId={ws.id}
          module={d.module}
          vorschlaege={d.vorschlaege}
          aenderungen={d.aenderungen}
          istTeam
          darfEintragen
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Trainer-Feedback</h2>
        <FeedbackUebersicht feedbacks={d.feedbacks} />
      </section>

      {ws.interneNotizen && (
        <section className="space-y-2">
          <h2 className="font-medium">
            Interne Notizen{" "}
            <span className="text-xs font-normal text-zinc-500">(für Trainer nicht sichtbar)</span>
          </h2>
          <p className="whitespace-pre-wrap rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            {ws.interneNotizen}
          </p>
        </section>
      )}

      <details className={karte}>
        <summary className="cursor-pointer font-medium">Verlauf ({d.verlauf.length})</summary>
        {d.verlauf.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Noch keine Änderungen protokolliert.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {d.verlauf.map((v) => (
              <li key={v.id} className="flex flex-wrap gap-x-2">
                <span className="text-xs text-zinc-500">
                  {formatDatumZeit(v.createdAt)} · {v.nutzerName ?? "System"}
                </span>
                <span>
                  <span className="font-medium">{FELD_LABEL[v.feld] ?? v.feld}</span>
                  {v.alt !== null || v.neu !== null ? ": " : ""}
                  {v.alt !== null && <span className="text-zinc-500 line-through">{v.alt}</span>}
                  {v.alt !== null && v.neu !== null && " → "}
                  {v.neu}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const roh = await params;
  const parsed = idSchema.safeParse(roh.id);
  if (!parsed.success) notFound();

  let detail;
  try {
    detail = await getWorkshopDetail(session, parsed.data);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
  if (!detail) notFound();
  const jetzt = await getJetzt();

  return detail.art === "team" ? (
    <TeamAnsicht d={detail} jetzt={jetzt} istAdmin={session.user.rolle === "admin"} />
  ) : (
    <TrainerAnsicht d={detail} jetzt={jetzt} />
  );
}
