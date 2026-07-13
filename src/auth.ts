import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { nutzer, type NutzerRolle } from "@/db/schema";
import { verifyMagicLinkToken } from "@/lib/magic-link";

const ROLLE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// No self-signup: Entra sign-ins are only accepted for existing nutzer rows
// (matched by entra_oid, falling back to email on first login). Magic links
// only work for accounts with rolle = trainer.
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
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      const oid = (profile?.oid ?? profile?.sub) as string | undefined;
      const email = user.email?.toLowerCase();
      if (!oid || !email) return false;

      const [byOid] = await db
        .select()
        .from(nutzer)
        .where(eq(nutzer.entraOid, oid))
        .limit(1);
      if (byOid) return true;

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
        if (account?.provider === "magic-link" && "rolle" in user) {
          token.nutzerId = Number(user.id);
          token.rolle = user.rolle as NutzerRolle;
          token.rolleRefreshedAt = Date.now();
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
            token.rolleRefreshedAt = Date.now();
          }
        }
        return token;
      }

      // Re-validate the role claim against the DB at most every 5 minutes so
      // demoted or deleted accounts lose access promptly instead of keeping
      // their frozen JWT role for the whole session lifetime.
      const isStale =
        token.nutzerId !== undefined &&
        (token.rolleRefreshedAt === undefined ||
          Date.now() - token.rolleRefreshedAt > ROLLE_REFRESH_INTERVAL_MS);
      if (isStale) {
        const [dbUser] = await db
          .select()
          .from(nutzer)
          .where(eq(nutzer.id, token.nutzerId as number))
          .limit(1);
        if (!dbUser) return null; // account deleted → destroy the session
        token.rolle = dbUser.rolle;
        token.rolleRefreshedAt = Date.now();
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
