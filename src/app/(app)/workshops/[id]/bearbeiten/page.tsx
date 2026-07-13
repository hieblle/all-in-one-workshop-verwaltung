import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { kunde, workshop } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import { idSchema } from "@/lib/validation";
import { deleteWorkshopAction, updateWorkshopAction } from "../../actions";
import { WorkshopForm } from "../../workshop-form";

export default async function WorkshopBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeam();
  const roh = await params;
  const parsed = idSchema.safeParse(roh.id);
  if (!parsed.success) notFound();

  const [ws] = await db
    .select()
    .from(workshop)
    .where(eq(workshop.id, parsed.data))
    .limit(1);
  if (!ws) notFound();

  const kunden = await db
    .select({ id: kunde.id, firma: kunde.firma })
    .from(kunde)
    .orderBy(kunde.firma);

  const action = updateWorkshopAction.bind(null, ws.id);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Workshop bearbeiten: {ws.name}</h1>
      <WorkshopForm
        action={action}
        kunden={kunden}
        workshop={ws}
        submitLabel="Änderungen speichern"
      />

      <details className="max-w-2xl rounded-lg border border-red-200 p-4 dark:border-red-900">
        <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">
          Workshop löschen
        </summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Löscht den Workshop samt Checkliste, Zuweisungen und Kommentaren —
          endgültig. Abgesagte Workshops besser auf „On-Hold/Abgesagt“ setzen,
          damit die Historie erhalten bleibt.
        </p>
        <form action={deleteWorkshopAction.bind(null, ws.id)} className="mt-3">
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
          >
            Ja, endgültig löschen
          </button>
        </form>
      </details>
    </div>
  );
}
