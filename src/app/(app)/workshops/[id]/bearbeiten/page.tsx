import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { workshop, workshopModul } from "@/db/schema";
import { ladeFormularOptionen } from "@/lib/formular-optionen";
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

  const optionen = await ladeFormularOptionen();
  const gewaehlte = await db
    .select({ modulId: workshopModul.modulId })
    .from(workshopModul)
    .where(eq(workshopModul.workshopId, ws.id));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Workshop bearbeiten: {ws.name}</h1>
      <WorkshopForm
        action={updateWorkshopAction.bind(null, ws.id)}
        {...optionen}
        workshop={ws}
        gewaehlteModulIds={gewaehlte.map((g) => g.modulId)}
        submitLabel="Änderungen speichern"
      />
    </div>
  );
}
