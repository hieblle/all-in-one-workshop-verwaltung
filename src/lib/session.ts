import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccessDeniedError, isTeamRolle } from "@/lib/access";

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.nutzerId || !session.user.rolle) {
    redirect("/login");
  }
  return session;
}

// For team-only pages and actions (workshop mutations, template management).
export async function requireTeam(): Promise<Session> {
  const session = await requireSession();
  if (!isTeamRolle(session.user.rolle)) {
    throw new AccessDeniedError();
  }
  return session;
}
