import type { Session } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isTeamRolle } from "@/lib/access";

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.nutzerId || !session.user.rolle) {
    redirect("/login");
  }
  return session;
}

// For team-only pages and actions. Others get a 404 — trainers don't even
// learn that the page exists.
export async function requireTeam(): Promise<Session> {
  const session = await requireSession();
  if (!isTeamRolle(session.user.rolle)) {
    notFound();
  }
  return session;
}

// Admin-only (SPEC §2): hard delete, team accounts, templates, recurring
// reminders, system settings.
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.rolle !== "admin") {
    notFound();
  }
  return session;
}
