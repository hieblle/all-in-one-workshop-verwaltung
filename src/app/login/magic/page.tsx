import { redirect } from "next/navigation";
import { signInWithMagicLink } from "../actions";

// Deliberately requires a click instead of signing in on GET: mail scanners
// prefetch links and would consume the single-use token.
export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold">dbrains Workshop-Hub</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Klicke auf den Button, um die Anmeldung abzuschließen.
        </p>
        <form action={signInWithMagicLink}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Jetzt anmelden
          </button>
        </form>
      </div>
    </main>
  );
}
