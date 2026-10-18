import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { inputKlasse, sekundaerButton } from "@/components/ui";
import { db } from "@/db";
import { modul, vorschlagStatusEnum, workshopModul } from "@/db/schema";
import { isTeamRolle } from "@/lib/access";
import { eigeneWorkshopIds, ladeAenderungen, ladeVorschlaege } from "@/lib/changelog";
import { zuInputWert } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { changelogFilterSchema } from "@/lib/validation";
import {
  AenderungListe,
  VORSCHLAG_STATUS_LABEL,
  VorschlagListe,
} from "../workshops/[id]/changelog-bereich";

/**
 * Central overview (SPEC §1): all suggestions and changes, filterable — the
 * agenda for the monthly trainer round.
 */
export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const istTeam = isTeamRolle(session.user.rolle);
  const parsed = changelogFilterSchema.safeParse(await searchParams);
  const filter = parsed.success ? parsed.data : changelogFilterSchema.parse({});
  // Without explicit filter the agenda shows what is still open.
  const status = filter.status ?? "offen";

  const f = { modulId: filter.modul, von: filter.von, bis: filter.bis };
  const [vorschlaege, aenderungen] = await Promise.all([
    ladeVorschlaege(session, { ...f, status }),
    ladeAenderungen(session, f),
  ]);

  // Trainers only get modules from their own workshops in the filter.
  const eigene = istTeam ? null : await eigeneWorkshopIds(session);
  const modulListe = await db
    .selectDistinct({ id: modul.id, name: modul.name })
    .from(modul)
    .leftJoin(workshopModul, eq(workshopModul.modulId, modul.id))
    .where(
      and(
        isNull(modul.archiviertAm),
        eigene ? inArray(workshopModul.workshopId, eigene.length ? eigene : [-1]) : undefined,
      ),
    )
    .orderBy(asc(modul.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Change-Log</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Vorschläge (Ideen aus Workshops, noch nicht umgesetzt) und Änderungen (tatsächlich
          an den Folien geändert). Die offenen Vorschläge sind die Agenda der monatlichen
          Trainer-Runde.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Modul</span>
          <select name="modul" defaultValue={filter.modul ?? ""} className={inputKlasse}>
            <option value="">Alle</option>
            {modulListe.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Vorschläge</span>
          <select name="status" defaultValue={status} className={inputKlasse}>
            {vorschlagStatusEnum.enumValues.map((s) => (
              <option key={s} value={s}>
                {VORSCHLAG_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">von</span>
          <input
            type="date"
            name="von"
            defaultValue={filter.von ? zuInputWert(filter.von).slice(0, 10) : ""}
            className={inputKlasse}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">bis</span>
          <input
            type="date"
            name="bis"
            defaultValue={filter.bis ? zuInputWert(filter.bis).slice(0, 10) : ""}
            className={inputKlasse}
          />
        </label>
        <button type="submit" className={sekundaerButton}>
          Filtern
        </button>
        <Link href="/change-log" className="text-xs text-zinc-500 underline">
          Zurücksetzen
        </Link>
      </form>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-medium">
            Vorschläge — {VORSCHLAG_STATUS_LABEL[status]} ({vorschlaege.length})
          </h2>
          <VorschlagListe vorschlaege={vorschlaege} istTeam={istTeam} zeigeWorkshop />
        </section>
        <section className="space-y-2">
          <h2 className="font-medium">Änderungen ({aenderungen.length})</h2>
          <AenderungListe aenderungen={aenderungen} zeigeWorkshop />
        </section>
      </div>
    </div>
  );
}

