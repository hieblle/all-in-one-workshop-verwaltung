import Link from "next/link";
import { signOut } from "@/auth";
import { isTeamRolle } from "@/lib/access";
import { requireSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const istTeam = isTeamRolle(session.user.rolle);

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">
            dbrains Workshop-Hub
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Dashboard
          </Link>
          <Link
            href="/workshops"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Workshops
          </Link>
          {istTeam && (
            <>
              <Link
                href="/vorlagen"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Vorlagen
              </Link>
              <Link
                href="/team"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Team & Trainer
              </Link>
              <Link
                href="/kunden"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Kunden
              </Link>
            </>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {session.user.name ?? session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Abmelden
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
