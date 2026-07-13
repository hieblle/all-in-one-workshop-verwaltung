import { asc } from "drizzle-orm";
import { db } from "@/db";
import { nutzer, trainer } from "@/db/schema";
import { requireTeam } from "@/lib/session";
import {
  createNutzerAction,
  createTrainerAction,
  updateTrainerAction,
} from "./actions";

const inputKlasse =
  "rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const ROLLE_LABEL: Record<string, string> = {
  admin: "Admin",
  team: "Team",
  trainer: "Trainer:in",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const session = await requireTeam();
  const { fehler } = await searchParams;
  const istAdmin = session.user.rolle === "admin";

  const alleTrainer = await db.select().from(trainer).orderBy(asc(trainer.name));
  const alleNutzer = await db
    .select({ id: nutzer.id, name: nutzer.name, email: nutzer.email, rolle: nutzer.rolle })
    .from(nutzer)
    .orderBy(asc(nutzer.name));

  return (
    <div className="space-y-10">
      {fehler === "email" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Diese E-Mail-Adresse ist bereits vergeben.
        </p>
      )}

      <div>
        <h1 className="text-xl font-semibold">Team & Trainer</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Trainer mit Login-Zugang melden sich per Magic-Link an und sehen nur
          ihre zugewiesenen Workshops.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Trainer ({alleTrainer.length})</h2>
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {alleTrainer.map((t) => (
            <li key={t.id} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-medium ${t.aktiv ? "" : "line-through opacity-50"}`}>
                  {t.name}
                </span>
                <span className="text-xs text-zinc-500">
                  {t.email} · {t.extern ? "extern" : "intern"}
                  {t.nutzerId ? " · Login aktiv" : " · kein Login"}
                  {t.aktiv ? "" : " · deaktiviert"}
                </span>
                {t.verfuegbarkeitNotiz && (
                  <span className="w-full text-xs text-zinc-500 sm:ml-auto sm:w-auto">
                    Verfügbarkeit: {t.verfuegbarkeitNotiz}
                  </span>
                )}
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">
                  Bearbeiten
                </summary>
                <form
                  action={updateTrainerAction.bind(null, t.id)}
                  className="mt-2 flex flex-wrap items-center gap-2"
                >
                  <input name="name" required defaultValue={t.name} className={`${inputKlasse} w-44`} />
                  <input name="email" type="email" required defaultValue={t.email} className={`${inputKlasse} w-56`} />
                  <input
                    name="verfuegbarkeitNotiz"
                    defaultValue={t.verfuegbarkeitNotiz ?? ""}
                    placeholder="Verfügbarkeit"
                    className={`${inputKlasse} w-56`}
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="extern" defaultChecked={t.extern} /> extern
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="aktiv" defaultChecked={t.aktiv} /> aktiv
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Speichern
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>

        <details className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <summary className="cursor-pointer text-sm font-medium">+ Trainer anlegen</summary>
          <form action={createTrainerAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input name="name" required placeholder="Name" className={`${inputKlasse} w-44`} />
            <input name="email" type="email" required placeholder="E-Mail" className={`${inputKlasse} w-56`} />
            <input
              name="verfuegbarkeitNotiz"
              placeholder="Verfügbarkeit (optional)"
              className={`${inputKlasse} w-56`}
            />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="extern" defaultChecked /> extern
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="mitLogin" defaultChecked /> Login-Zugang (Magic-Link)
            </label>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500"
            >
              Anlegen
            </button>
          </form>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Nutzer-Konten ({alleNutzer.length})</h2>
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {alleNutzer.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{n.name}</span>
              <span className="text-xs text-zinc-500">{n.email}</span>
              <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                {ROLLE_LABEL[n.rolle]}
              </span>
            </li>
          ))}
        </ul>

        {istAdmin ? (
          <details className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
            <summary className="cursor-pointer text-sm font-medium">
              + Nutzer-Konto anlegen (Team-Mitglied)
            </summary>
            <p className="mt-2 text-xs text-zinc-500">
              Team-Konten melden sich per Microsoft (Entra ID) an — die E-Mail
              muss der Microsoft-Adresse entsprechen. Es gibt kein Self-Signup.
            </p>
            <form action={createNutzerAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input name="name" required placeholder="Name" className={`${inputKlasse} w-44`} />
              <input name="email" type="email" required placeholder="E-Mail" className={`${inputKlasse} w-56`} />
              <select name="rolle" defaultValue="team" className={inputKlasse}>
                <option value="team">Team</option>
                <option value="admin">Admin</option>
                <option value="trainer">Trainer:in</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500"
              >
                Anlegen
              </button>
            </form>
          </details>
        ) : (
          <p className="text-xs text-zinc-500">
            Neue Nutzer-Konten können nur Admins anlegen.
          </p>
        )}
      </section>
    </div>
  );
}
