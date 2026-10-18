import { NextResponse } from "next/server";
import { getJetzt } from "@/lib/einstellungen";
import { HUB_URL } from "@/lib/konfig";
import { createMagicLinkToken, MAGIC_LINK_TTL_MINUTES } from "@/lib/magic-link";
import { queueMail } from "@/lib/postausgang";
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
    const link = `${HUB_URL}/login/magic?token=${result.rawToken}`;
    // The Postausgang keeps a protocol of every mail — but never the live
    // login token. Until mails go out (stage 3), the link is only printed to
    // the dev server console.
    if (process.env.NODE_ENV === "development") {
      console.log(`[magic-link] ${result.nutzer.email}: ${link}`);
    }
    await queueMail({
      anlass: "login_link",
      jetzt: await getJetzt(),
      an: result.nutzer.email,
      betreff: "Dein Anmelde-Link – dbrains Workshop-Hub",
      text: `Hallo ${result.nutzer.name},\n\nmit diesem Link kannst du dich anmelden (gültig für ${MAGIC_LINK_TTL_MINUTES} Minuten, einmalig verwendbar):\n\n${HUB_URL}/login/magic?token=[nicht gespeichert]\n\nFalls du keine Anmeldung angefordert hast, ignoriere diese E-Mail.`,
    });
  }

  // Same response whether or not the account exists — no user enumeration.
  return NextResponse.json({ ok: true });
}
