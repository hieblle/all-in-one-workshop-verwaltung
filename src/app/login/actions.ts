"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { istTestLoginAktiv } from "@/lib/konfig";
import { idSchema, magicLinkTokenSchema } from "@/lib/validation";

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

// MVP test login: pick an account instead of Microsoft/magic link (SPEC §8).
export async function signInWithTestLogin(formData: FormData): Promise<void> {
  if (!istTestLoginAktiv()) redirect("/login");
  const parsed = idSchema.safeParse(formData.get("nutzerId"));
  if (!parsed.success) redirect("/login");
  try {
    await signIn("test-login", { nutzerId: String(parsed.data), redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=test");
    throw error;
  }
}
