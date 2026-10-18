import type { NutzerRolle } from "@/db/schema";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nutzerId?: number;
      rolle?: NutzerRolle;
    } & DefaultSession["user"];
  }

  interface User {
    rolle?: NutzerRolle;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    nutzerId?: number;
    rolle?: NutzerRolle;
  }
}

// next-auth v5 sources its JWT type from @auth/core — augment it as well so
// the callback parameter types pick up the custom claims.
declare module "@auth/core/jwt" {
  interface JWT {
    nutzerId?: number;
    rolle?: NutzerRolle;
  }
}
