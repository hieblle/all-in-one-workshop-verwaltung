import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { nutzer, type NutzerRolle } from "@/db/schema";
import { istTestLoginAktiv } from "@/lib/konfig";
import { hatAktivesTrainerProfil, verifyMagicLinkToken } from "@/lib/magic-link";
import { idSchema } from "@/lib/validation";

// Only accounts from the dbrains Microsoft tenant (SPEC §3). Checked on the
// token itself, not just via the issuer config, so a misconfigured issuer
// (/common) can't let a foreign account take over a team account.
function erlaubterTenant(): string | null {
  if (process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID) {
    return process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  }
  const treffer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.match(
    /login\.microsoftonline\.com\/([0-9a-f-]{36})\//i,
  );
  return treffer?.[1] ?? null;
}

// Session check on every request: a demoted, deleted or deactivated account
// (trainer.aktiv = false) loses access immediately (SPEC §3).
async function aktuelleRolle(nutzerId: number): Promise<NutzerRolle | null> {
  const [dbUser] = await db
    .select({ rolle: nutzer.rolle })
    .from(nutzer)
    .where(eq(nutzer.id, nutzerId))
    .limit(1);
  if (!dbUser) return null;
  if (dbUser.rolle === "trainer" && !(await hatAktivesTrainerProfil(nutzerId))) {
    return null;
  }
  return dbUser.rolle;
}

// No self-signup: Entra sign-ins are only accepted for existing team rows
// (matched by entra_oid, falling back to email on first login). Magic links
// only work for active trainers. The test login exists for the MVP only.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: { token: {} },
      async authorize(credentials) {
        if (typeof credentials?.token !== "string") return null;
        const account = await verifyMagicLinkToken(credentials.token);
        if (!account) return null;
        return {
          id: String(account.id),
          name: account.name,
          email: account.email,
          rolle: account.rolle,
        };
      },
    }),
    Credentials({
      id: "test-login",
      name: "Test-Login",
      credentials: { nutzerId: {} },
      async authorize(credentials) {
        if (!istTestLoginAktiv()) return null;
        const parsed = idSchema.safeParse(credentials?.nutzerId);
        if (!parsed.success) return null;
        const [account] = await db
          .select()
          .from(nutzer)
          .where(eq(nutzer.id, parsed.data))
          .limit(1);
        if (!account || (await aktuelleRolle(account.id)) === null) return null;
        return {
          id: String(account.id),
          name: account.name,
          email: account.email,
          rolle: account.rolle,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      const tenant = erlaubterTenant();
      if (!tenant || profile?.tid !== tenant) return false;

      const oid = (profile?.oid ?? profile?.sub) as string | undefined;
      const email = user.email?.toLowerCase();
      if (!oid || !email) return false;

      const [byOid] = await db
        .select()
        .from(nutzer)
        .where(eq(nutzer.entraOid, oid))
        .limit(1);
      if (byOid) return byOid.rolle !== "trainer";

      // First Entra login: link the OID to a pre-provisioned team account.
      const [byEmail] = await db
        .select()
        .from(nutzer)
        .where(eq(nutzer.email, email))
        .limit(1);
      if (!byEmail || byEmail.rolle === "trainer") return false;

      await db
        .update(nutzer)
        .set({ entraOid: oid })
        .where(eq(nutzer.id, byEmail.id));
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        if (
          (account?.provider === "magic-link" || account?.provider === "test-login") &&
          "rolle" in user
        ) {
          token.nutzerId = Number(user.id);
          token.rolle = user.rolle as NutzerRolle;
          return token;
        }

        if (account?.provider === "microsoft-entra-id") {
          const oid = (profile?.oid ?? profile?.sub) as string;
          const [dbUser] = await db
            .select()
            .from(nutzer)
            .where(eq(nutzer.entraOid, oid))
            .limit(1);
          if (dbUser) {
            token.nutzerId = dbUser.id;
            token.rolle = dbUser.rolle;
          }
        }
        return token;
      }

      if (token.nutzerId !== undefined) {
        const rolle = await aktuelleRolle(token.nutzerId);
        if (rolle === null) return null; // deleted/deactivated → destroy the session
        token.rolle = rolle;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.nutzerId !== undefined) {
        session.user.id = String(token.nutzerId);
        session.user.nutzerId = token.nutzerId;
        session.user.rolle = token.rolle;
      }
      return session;
    },
  },
});
