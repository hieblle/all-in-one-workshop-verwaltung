import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { kunde, workshop } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import { idSchema } from "@/lib/validation";
import { updateWorkshopAction } from "../../actions";
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
    </div>
  );
}
