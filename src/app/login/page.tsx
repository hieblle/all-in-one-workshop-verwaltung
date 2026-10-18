import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { nutzer } from "@/db/schema";
import { istTestLoginAktiv } from "@/lib/konfig";
import { signInWithEntra, signInWithTestLogin } from "./actions";
import { MagicLinkForm } from "./magic-link-form";

const ROLLE_LABEL: Record<string, string> = {
  admin: "Admin",
  team: "Team",
  trainer: "Trainer:in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;
  const testLogin = istTestLoginAktiv();
  const konten = testLogin
    ? await db
        .select({ id: nutzer.id, name: nutzer.name, email: nutzer.email, rolle: nutzer.rolle })
        .from(nutzer)
        .orderBy(asc(nutzer.rolle), asc(nutzer.name))
    : [];

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">dbrains Workshop-Hub</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Workshop- und Trainer-Verwaltung der dbrains academy
          </p>
        </div>

        {error === "link" && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Der Anmelde-Link ist ungültig oder abgelaufen. Bitte fordere einen
            neuen Link an.
          </p>
        )}
        {error === "test" && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Dieses Konto kann sich nicht anmelden (z.&nbsp;B. deaktivierter Trainer).
          </p>
        )}

        {testLogin && (
          <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Test-Login (MVP)
            </h2>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Konto wählen und sofort sehen, was diese Rolle sieht. Nur zum
              Testen — wird mit der Microsoft-Anbindung entfernt.
            </p>
            <ul className="space-y-1">
              {konten.map((k) => (
                <li key={k.id}>
                  <form action={signInWithTestLogin}>
                    <input type="hidden" name="nutzerId" value={k.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between rounded-md border border-amber-300 bg-white px-3 py-1.5 text-left text-sm hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      <span>{k.name}</span>
                      <span className="text-xs text-zinc-500">{ROLLE_LABEL[k.rolle]}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
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
          <h2 className="text-sm font-medium text-zinc-500">Trainer:innen</h2>
          <MagicLinkForm />
        </section>
      </div>
    </main>
  );
}
