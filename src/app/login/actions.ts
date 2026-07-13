"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { magicLinkTokenSchema } from "@/lib/validation";

export async function signInWithEntra(): Promise<void> {
  await signIn("microsoft-entra-id", { redirectTo: "/" });
}

export async function signInWithMagicLink(formData: FormData): Promise<void> {
  const parsed = magicLinkTokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) {
    redirect("/login?error=link");
  }
  try {
    await signIn("magic-link", { token: parsed.data, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      // Unknown, expired or already used token.
      redirect("/login?error=link");
    }
    throw error; // NEXT_REDIRECT et al. must propagate
  }
}
