import Link from "next/link";
import { db } from "@/db";
import { trainer } from "@/db/schema";
import { isTeamRolle } from "@/lib/access";
import {
  formatBetrag,
  formatDatum,
  STATUS_FARBEN,
  STATUS_REIHENFOLGE,
} from "@/lib/format";
import { requireSession } from "@/lib/session";
import { findWorkshops, type WorkshopListEintrag } from "@/lib/workshops";
import { workshopFilterSchema } from "@/lib/validation";
import { workshopTypeEnum } from "@/db/schema";
import { zuInputWert } from "@/lib/format";

function StatusBadge({ status }: { status: WorkshopListEintrag["status"] }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_FARBEN[status]}`}
    >
      {status}
    </span>
  );
}

export default async function WorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const istTeam = isTeamRolle(session.user.rolle);

  const roh = await searchParams;
  const parsed = workshopFilterSchema.safeParse(roh);
  const filter = parsed.success
    ? parsed.data
    : workshopFilterSchema.parse({});

  const workshops = await findWorkshops(session, {
    status: filter.status,
    type: filter.type,
    trainerId: filter.trainer,
    von: filter.von,
    bis: filter.bis,
  });

  const alleTrainer = istTeam
    ? await db
        .select({ id: trainer.id, name: trainer.name })
        .from(trainer)
        .orderBy(trainer.name)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Workshops</h1>
        {istTeam && (
          <Link
            href="/workshops/neu"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            + Neuer Workshop
          </Link>
        )}
      </div>

      {istTeam && (
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Status</span>
            <select
              name="status"
              defaultValue={filter.status ?? ""}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Alle</option>
              {STATUS_REIHENFOLGE.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Type</span>
            <select
              name="type"
              defaultValue={filter.type ?? ""}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Alle</option>
              {workshopTypeEnum.enumValues.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Trainer</span>
            <select
              name="trainer"
              defaultValue={filter.trainer ?? ""}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Alle</option>
              {alleTrainer.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Termin von</span>
            <input
              type="date"
              name="von"
              defaultValue={filter.von ? zuInputWert(filter.von).slice(0, 10) : ""}
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">bis</span>
            <input
              type="date"
              name="bis"
              defaultValue={filter.bis ? zuInputWert(filter.bis).slice(0, 10) : ""}
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <input type="hidden" name="ansicht" value={filter.ansicht} />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Filtern
          </button>
          <Link href="/workshops" className="text-xs text-zinc-500 underline">
            Zurücksetzen
          </Link>
          <span className="ml-auto flex gap-1 text-xs">
            <Link
              href={{ pathname: "/workshops", query: { ...roh, ansicht: "liste" } }}
              className={`rounded-md px-2 py-1 ${filter.ansicht === "liste" ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Liste
            </Link>
            <Link
              href={{ pathname: "/workshops", query: { ...roh, ansicht: "board" } }}
              className={`rounded-md px-2 py-1 ${filter.ansicht === "board" ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Board
            </Link>
          </span>
        </form>
      )}

      {workshops.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Keine Workshops gefunden.
        </p>
      ) : filter.ansicht === "board" && istTeam ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-7">
          {STATUS_REIHENFOLGE.map((status) => {
            const spalte = workshops.filter((w) => w.status === status);
            return (
              <div key={status} className="space-y-2">
                <h2 className="text-xs font-semibold text-zinc-500">
                  {status} ({spalte.length})
                </h2>
                {spalte.map((w) => (
                  <Link
                    key={w.id}
                    href={`/workshops/${w.id}`}
                    className="block rounded-md border border-zinc-200 p-2 text-sm hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    <span className="font-medium">{w.name}</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {w.firma} · {formatDatum(w.termin1)}
                    </span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Workshop</th>
                <th className="px-3 py-2 font-medium">Kunde</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Termin 1</th>
                {istTeam && <th className="px-3 py-2 font-medium">Betrag</th>}
              </tr>
            </thead>
            <tbody>
              {workshops.map((w) => (
                <tr
                  key={w.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/workshops/${w.id}`}
                      className="font-medium hover:underline"
                    >
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{w.firma}</td>
                  <td className="px-3 py-2">{w.type}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-3 py-2">{formatDatum(w.termin1)}</td>
                  {istTeam && (
                    <td className="px-3 py-2">{formatBetrag(w.wsBetrag)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
