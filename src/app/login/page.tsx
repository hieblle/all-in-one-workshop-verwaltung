import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithEntra } from "./actions";
import { MagicLinkForm } from "./magic-link-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">dbrains Workshop-Hub</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Source of Truth für den Workshop-Prozess
          </p>
        </div>

        {error === "link" && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Der Anmelde-Link ist ungültig oder abgelaufen. Bitte fordere einen
            neuen Link an.
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">Internes Team</h2>
          <form action={signInWithEntra}>
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Mit Microsoft anmelden
            </button>
          </form>
        </section>

        <div className="border-t border-zinc-200 dark:border-zinc-800" />

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">
            Externe Trainer:innen
          </h2>
          <MagicLinkForm />
        </section>

        {process.env.NODE_ENV === "development" && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Dev-Modus: Der Anmelde-Link funktioniert für alle Seed-Konten —
            z.&nbsp;B. <code>leon@dbrains.academy</code> (Admin) oder{" "}
            <code>trainerin@example.com</code> (Trainerin). Der Link erscheint
            im Terminal des Dev-Servers.
          </p>
        )}
      </div>
    </main>
  );
}
