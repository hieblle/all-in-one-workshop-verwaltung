import { ladeFormularOptionen } from "@/lib/formular-optionen";
import { requireTeam } from "@/lib/session";
import { createWorkshopAction } from "../actions";
import { WorkshopForm } from "../workshop-form";

export default async function NeuerWorkshopPage() {
  const session = await requireTeam();
  const optionen = await ladeFormularOptionen();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Neuer Workshop</h1>
      <WorkshopForm
        action={createWorkshopAction}
        {...optionen}
        // New workshops default to whoever creates them.
        standardVerantwortlichId={session.user.nutzerId}
        submitLabel="Workshop anlegen"
      />
    </div>
  );
}
