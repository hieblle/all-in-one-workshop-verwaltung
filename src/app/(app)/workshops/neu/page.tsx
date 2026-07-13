import { db } from "@/db";
import { kunde } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import { createWorkshopAction } from "../actions";
import { WorkshopForm } from "../workshop-form";

export default async function NeuerWorkshopPage() {
  await requireTeam();
  const kunden = await db
    .select({ id: kunde.id, firma: kunde.firma })
    .from(kunde)
    .orderBy(kunde.firma);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Neuer Workshop</h1>
      <WorkshopForm
        action={createWorkshopAction}
        kunden={kunden}
        submitLabel="Workshop anlegen"
      />
    </div>
  );
}
