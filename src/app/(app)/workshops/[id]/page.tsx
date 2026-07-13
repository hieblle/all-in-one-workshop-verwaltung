import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { nutzer, trainer, workshopStatusEnum } from "@/db/schema";
import { AccessDeniedError, isTeamRolle } from "@/lib/access";
import {
  formatBetrag,
  formatDatum,
  formatDatumZeit,
  STATUS_FARBEN,
  STATUS_REIHENFOLGE,
} from "@/lib/format";
import { requireSession } from "@/lib/session";
import { idSchema } from "@/lib/validation";
import { getWorkshopDetail, type WorkshopDetail } from "@/lib/workshops";
import {
  addKommentarAction,
  addZuweisungAction,
  assignCheckpunktAction,
  changeStatusAction,
  removeZuweisungAction,
  setCheckpunktStatusAction,
} from "../actions";

const ZUWEISUNG_ROLLE_LABEL: Record<string, string> = {
  lead: "Lead",
  co: "Co-Trainer:in",
  uebergabe_extern: "Übergabe extern",
};

function ExternerLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {label} ↗
    </a>
  );
}

function Checkliste({
  detail,
  istTeam,
  alleNutzer,
}: {
  detail: WorkshopDetail;
  istTeam: boolean;
  alleNutzer: { id: number; name: string }[];
}) {
  const heute = new Date();
  const phasen = STATUS_REIHENFOLGE.filter((phase) =>
    detail.checkpunkte.some((p) => p.phase === phase),
  );

  if (detail.checkpunkte.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Noch keine Checklistenpunkte — sie entstehen automatisch beim
        Statuswechsel aus den Vorlagen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {phasen.map((phase) => (
        <div key={phase}>
          <h3 className="mb-1 text-xs font-semibold text-zinc-500">{phase}</h3>
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {detail.checkpunkte
              .filter((p) => p.phase === phase)
              .map((punkt) => {
                const ueberfaellig =
                  punkt.status === "offen" &&
                  punkt.faelligAm !== null &&
                  punkt.faelligAm < heute;
                return (
                  <li
                    key={punkt.id}
                    className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                  >
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
                    {punkt.erledigtVia === "auto" && (
                      <span className="rounded bg-green-100 px-1 text-[10px] text-green-800 dark:bg-green-950 dark:text-green-300">
                        auto
                      </span>
                    )}
                    <span
                      className={`text-xs ${ueberfaellig ? "font-semibold text-red-600" : "text-zinc-500"}`}
                    >
                      fällig {formatDatum(punkt.faelligAm)}
                      {ueberfaellig && " (überfällig)"}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {istTeam ? (
                        <form
                          action={assignCheckpunktAction.bind(
                            null,
                            detail.workshop.id,
                            punkt.id,
                          )}
                          className="flex items-center gap-1"
                        >
                          <select
                            name="verantwortlichUserId"
                            defaultValue={punkt.verantwortlichUserId ?? ""}
                            className="rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <option value="">– niemand –</option>
                            {alleNutzer.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            Zuweisen
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {punkt.verantwortlichName ?? "–"}
                        </span>
                      )}
                      {punkt.status === "offen" ? (
                        <>
                          <form
                            action={setCheckpunktStatusAction.bind(
                              null,
                              detail.workshop.id,
                              punkt.id,
                            )}
                          >
                            <input type="hidden" name="status" value="erledigt" />
                            <button
                              type="submit"
                              className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-500"
                            >
                              Erledigt
                            </button>
                          </form>
                          {istTeam && (
                            <form
                              action={setCheckpunktStatusAction.bind(
                                null,
                                detail.workshop.id,
                                punkt.id,
                              )}
                            >
                              <input
                                type="hidden"
                                name="status"
                                value="uebersprungen"
                              />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                              >
                                Überspringen
                              </button>
                            </form>
                          )}
                        </>
                      ) : (
                        <form
                          action={setCheckpunktStatusAction.bind(
                            null,
                            detail.workshop.id,
                            punkt.id,
                          )}
                        >
                          <input type="hidden" name="status" value="offen" />
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            Wieder öffnen
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
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

  let detail: WorkshopDetail | null;
  try {
    detail = await getWorkshopDetail(session, parsed.data);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
  if (!detail) notFound();

  const istTeam = isTeamRolle(session.user.rolle);
  const ws = detail.workshop;

  const [alleTrainer, alleNutzer] = istTeam
    ? await Promise.all([
        db
          .select({ id: trainer.id, name: trainer.name })
          .from(trainer)
          .orderBy(trainer.name),
        db
          .select({ id: nutzer.id, name: nutzer.name })
          .from(nutzer)
          .orderBy(nutzer.name),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/workshops" className="hover:underline">
              Workshops
            </Link>{" "}
            / {detail.firma}
          </p>
          <h1 className="text-2xl font-semibold">{ws.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_FARBEN[ws.status]}`}
          >
            {ws.status}
          </span>
          {istTeam && (
            <>
              <form
                action={changeStatusAction.bind(null, ws.id)}
                className="flex items-center gap-1"
              >
                <select
                  name="status"
                  defaultValue={ws.status}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {workshopStatusEnum.enumValues.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Status ändern
                </button>
              </form>
              <Link
                href={`/workshops/${ws.id}/bearbeiten`}
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Bearbeiten
              </Link>
            </>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-zinc-200 p-4 text-sm sm:grid-cols-3 lg:grid-cols-4 dark:border-zinc-800">
        <div>
          <dt className="text-xs text-zinc-500">Kunde</dt>
          <dd>{detail.firma}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Ansprechperson</dt>
          <dd>{ws.ansprechperson ?? "–"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Type</dt>
          <dd>{ws.type}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Format / Modus</dt>
          <dd>
            {ws.format ?? "–"} / {ws.modus ?? "–"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Termin 1</dt>
          <dd>{formatDatumZeit(ws.termin1)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Termin 2</dt>
          <dd>{formatDatumZeit(ws.termin2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Follow-up</dt>
          <dd>{formatDatumZeit(ws.terminFup)}</dd>
        </div>
        {istTeam && (
          <>
            <div>
              <dt className="text-xs text-zinc-500">Betrag</dt>
              <dd>{formatBetrag(ws.wsBetrag)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Rechnung</dt>
              <dd>{ws.rechnungStatus}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Trainer-RE</dt>
              <dd>{ws.trainerRe}</dd>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Links & Materialien</h2>
        <div className="flex flex-wrap gap-2">
          <ExternerLink href={ws.sharepointUrl} label="SharePoint" />
          <ExternerLink href={ws.verwendetesSlidedeck} label="Slidedeck" />
          <ExternerLink href={ws.teamsMeetingUrl} label="Teams-Meeting" />
          {istTeam && (
            <>
              <ExternerLink href={ws.notionProjectUrl} label="Notion-Projekt" />
              <ExternerLink href={ws.formsVorabUrl} label="Forms Vorab" />
              <ExternerLink href={ws.formsFeedbackUrl} label="Forms Feedback" />
            </>
          )}
          {!ws.sharepointUrl &&
            !ws.verwendetesSlidedeck &&
            !ws.teamsMeetingUrl && (
              <span className="text-sm text-zinc-500">
                Noch keine Links hinterlegt.
              </span>
            )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Trainer</h2>
        {detail.zuweisungen.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch niemand zugewiesen.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.zuweisungen.map((z) => (
              <li key={z.id} className="flex items-center gap-2">
                <span className="font-medium">{z.trainerName}</span>
                <span className="text-xs text-zinc-500">
                  {ZUWEISUNG_ROLLE_LABEL[z.rolle] ?? z.rolle} · {z.status}
                </span>
                {istTeam && (
                  <form action={removeZuweisungAction.bind(null, ws.id, z.id)}>
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Entfernen
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {istTeam && alleTrainer.length > 0 && (
          <form
            action={addZuweisungAction.bind(null, ws.id)}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <select
              name="trainerId"
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {alleTrainer.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              name="rolle"
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="lead">Lead</option>
              <option value="co">Co-Trainer:in</option>
              <option value="uebergabe_extern">Übergabe extern</option>
            </select>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Zuweisen
            </button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">
          Checkliste {!istTeam && <span className="text-xs font-normal text-zinc-500">(deine Punkte)</span>}
        </h2>
        <Checkliste detail={detail} istTeam={istTeam} alleNutzer={alleNutzer} />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Austausch</h2>
        {detail.kommentare.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch keine Kommentare.</p>
        ) : (
          <ul className="space-y-2">
            {detail.kommentare.map((k) => (
              <li
                key={k.id}
                className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="mb-1 text-xs text-zinc-500">
                  {k.autorName} · {formatDatumZeit(k.createdAt)}
                </p>
                <p className="whitespace-pre-wrap">{k.text}</p>
              </li>
            ))}
          </ul>
        )}
        <form action={addKommentarAction.bind(null, ws.id)} className="space-y-2">
          <textarea
            name="text"
            required
            rows={3}
            placeholder="Kommentar schreiben …"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Kommentar senden
          </button>
        </form>
      </section>
    </div>
  );
}
