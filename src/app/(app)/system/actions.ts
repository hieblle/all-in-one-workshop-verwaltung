"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fuehreTagesjobAus } from "@/jobs/tagesjob";
import { getDatumOffsetTage, getJetzt, setDatumOffsetTage } from "@/lib/einstellungen";
import { requireAdmin } from "@/lib/session";
import { datumOffsetSchema } from "@/lib/validation";

// MVP tools (SPEC §8): simulate the date and run the daily job by hand, so
// deadlines and reminders can be played through without waiting days.

export async function setDatumOffsetAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { tage } = datumOffsetSchema.parse(Object.fromEntries(formData));
  await setDatumOffsetTage(tage);
  revalidatePath("/", "layout");
}

export async function verschiebeDatumAction(tage: number): Promise<void> {
  await requireAdmin();
  await setDatumOffsetTage((await getDatumOffsetTage()) + tage);
  revalidatePath("/", "layout");
}

export async function tagesjobAusfuehrenAction(): Promise<void> {
  await requireAdmin();
  const ergebnis = await fuehreTagesjobAus(await getJetzt());
  revalidatePath("/", "layout");
  redirect(`/system?tagesjob=${ergebnis.erfolg ? "ok" : "fehler"}`);
}

/** Moves one day forward and runs the daily job — "play the next day". */
export async function naechsterTagAction(): Promise<void> {
  await requireAdmin();
  await setDatumOffsetTage((await getDatumOffsetTage()) + 1);
  await fuehreTagesjobAus(await getJetzt());
  revalidatePath("/", "layout");
  redirect("/system?tagesjob=ok");
}
