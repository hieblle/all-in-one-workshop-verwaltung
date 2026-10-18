import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no database imports allowed here, because the
// middleware bundle runs on the edge runtime. Providers live in src/auth.ts.
export const authConfig = {
  providers: [],
  // Trainers stay signed in for 30 days after a magic link (SPEC §3).
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
