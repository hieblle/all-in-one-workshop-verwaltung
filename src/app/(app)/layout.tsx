import Link from "next/link";
import { signOut } from "@/auth";
import { isTeamRolle } from "@/lib/access";
import { getDatumOffsetTage, getJetzt } from "@/lib/einstellungen";
import { formatDatum } from "@/lib/format";
import { requireSession } from "@/lib/session";

const linkKlasse =
  "text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const istTeam = isTeamRolle(session.user.rolle);
  const istAdmin = session.user.rolle === "admin";
  const offset = await getDatumOffsetTage();
  const jetzt = await getJetzt();

  return (
    <div className="min-h-screen">
      {offset !== 0 && (
        <div className="bg-amber-200 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
          Datum simuliert: Der Hub rechnet mit {formatDatum(jetzt)} ({offset > 0 ? "+" : ""}
          {offset} Tage).{" "}
          {istAdmin && (
            <Link href="/system" className="underline">
              Ändern
            </Link>
          )}
        </div>
      )}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">
            dbrains Workshop-Hub
          </Link>
          <Link href="/" className={linkKlasse}>
            Dashboard
          </Link>
          <Link href="/workshops" className={linkKlasse}>
            Workshops
          </Link>
          <Link href="/change-log" className={linkKlasse}>
            Change-Log
          </Link>
          {istTeam && (
            <>
              <Link href="/module" className={linkKlasse}>
                Module
              </Link>
              <Link href="/team" className={linkKlasse}>
                Team & Trainer
              </Link>
              <Link href="/kunden" className={linkKlasse}>
                Kunden
              </Link>
              <Link href="/vorlagen" className={linkKlasse}>
                Checkliste
              </Link>
              <Link href="/postausgang" className={linkKlasse}>
                Postausgang
              </Link>
            </>
          )}
          {istAdmin && (
            <>
              <Link href="/erinnerungen" className={linkKlasse}>
                Erinnerungen
              </Link>
              <Link href="/system" className={linkKlasse}>
                System
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
