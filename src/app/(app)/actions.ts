"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { trainer } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { verfuegbarkeitFormSchema } from "@/lib/validation";

// Self-service: trainers maintain their own availability note (F4 —
// deliberately NO calendar sync, just a free-text self declaration).
export async function updateVerfuegbarkeitAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const daten = verfuegbarkeitFormSchema.parse(Object.fromEntries(formData));

  await db
    .update(trainer)
    .set({ verfuegbarkeitNotiz: daten.verfuegbarkeitNotiz || null })
    .where(
      and(
        eq(trainer.nutzerId, session.user.nutzerId ?? -1),
        eq(trainer.aktiv, true),
      ),
    );

  revalidatePath("/");
}
