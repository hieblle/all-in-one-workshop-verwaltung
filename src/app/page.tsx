import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

const ROLLE_LABEL: Record<string, string> = {
  admin: "Admin",
  team: "Team",
  trainer: "Trainer:in",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">dbrains Workshop-Hub</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Angemeldet als {session.user.name ?? session.user.email}
            {session.user.rolle
              ? ` (${ROLLE_LABEL[session.user.rolle] ?? session.user.rolle})`
              : null}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Abmelden
          </button>
        </form>
      </header>

      <section className="mt-8 rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <h2 className="font-medium">Fundament steht</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Phase 0 ist abgeschlossen: Datenbank-Schema, Authentifizierung und
          Deployment. Die Workshop-Verwaltung (Listen- und Board-Ansicht) folgt
          in Phase 1.
        </p>
      </section>
    </main>
  );
}
