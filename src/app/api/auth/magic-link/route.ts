import { NextResponse } from "next/server";
import { sendMail } from "@/integrations/graph/mail";
import { createMagicLinkToken, MAGIC_LINK_TTL_MINUTES } from "@/lib/magic-link";
import { checkRateLimit } from "@/lib/rate-limit";
import { magicLinkRequestSchema } from "@/lib/validation";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = magicLinkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige E-Mail-Adresse" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (
    !checkRateLimit(`email:${email}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS) ||
    !checkRateLimit(`ip:${ip}`, RATE_LIMIT_MAX * 4, RATE_LIMIT_WINDOW_MS)
  ) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const result = await createMagicLinkToken(parsed.data.email);
  if (result) {
    const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
    const link = `${baseUrl}/login/magic?token=${result.rawToken}`;
    await sendMail({
      to: result.nutzer.email,
      subject: "Dein Anmelde-Link – dbrains Workshop-Hub",
      text: `Hallo ${result.nutzer.name},\n\nmit diesem Link kannst du dich anmelden (gültig für ${MAGIC_LINK_TTL_MINUTES} Minuten, einmalig verwendbar):\n\n${link}\n\nFalls du keine Anmeldung angefordert hast, ignoriere diese E-Mail.`,
    });
  }

  // Same response whether or not the account exists — no user enumeration.
  return NextResponse.json({ ok: true });
}
