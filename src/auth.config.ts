import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no database imports allowed here, because the
// middleware bundle runs on the edge runtime. Providers live in src/auth.ts.
export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
