"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { wiederkehrendeErinnerung } from "@/db/schema";
import { getJetzt } from "@/lib/einstellungen";
import { naechsteFaelligkeit } from "@/lib/rhythmus";
import { requireSession } from "@/lib/session";
import { idSchema } from "@/lib/validation";

// Ticking off a recurring reminder on the dashboard moves it to its next due
// date (SPEC §5). Only the recipient can tick it off.
export async function erinnerungErledigtAction(erinnerungId: number): Promise<void> {
  const session = await requireSession();
  const id = idSchema.parse(erinnerungId);
  const jetzt = await getJetzt();

  const [e] = await db
    .select()
    .from(wiederkehrendeErinnerung)
    .where(
      and(
        eq(wiederkehrendeErinnerung.id, id),
        eq(wiederkehrendeErinnerung.empfaengerId, session.user.nutzerId ?? -1),
      ),
    )
    .limit(1);
  if (!e) return;

  await db
    .update(wiederkehrendeErinnerung)
    .set({
      naechsteFaelligkeit: naechsteFaelligkeit(e.naechsteFaelligkeit, e.rhythmus, jetzt),
      zuletztErledigtAm: jetzt,
    })
    .where(eq(wiederkehrendeErinnerung.id, id));
  revalidatePath("/");
  revalidatePath("/erinnerungen");
}
