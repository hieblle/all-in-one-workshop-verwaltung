import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/db";
import { trainer, zuweisung, type NutzerRolle } from "@/db/schema";

export class AccessDeniedError extends Error {
  constructor(message = "Zugriff verweigert") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function isTeamRolle(rolle: NutzerRolle | undefined): boolean {
  return rolle === "admin" || rolle === "team";
}

/**
 * Central access check for trainer roles (see CLAUDE.md): every query on
 * behalf of a trainer MUST pass through this guard. External trainers only
 * see workshops they are assigned to; admin/team have full access.
 *
 * Throws AccessDeniedError — callers translate this to a 403/notFound.
 */
export async function assertTrainerAccess(
  session: Session | null,
  workshopId: number,
): Promise<void> {
  const user = session?.user;
  if (!user?.nutzerId || !user.rolle) {
    throw new AccessDeniedError("Nicht angemeldet");
  }
  if (isTeamRolle(user.rolle)) return;

  const [assignment] = await db
    .select({ id: zuweisung.id })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(
      and(
        eq(zuweisung.workshopId, workshopId),
        eq(trainer.nutzerId, user.nutzerId),
        eq(trainer.aktiv, true),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw new AccessDeniedError();
  }
}
