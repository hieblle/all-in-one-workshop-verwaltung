import { eq } from "drizzle-orm";
import { db } from "@/db";
import { einstellung } from "@/db/schema";

const DATUM_OFFSET = "datum_offset_tage";

async function lies(schluessel: string): Promise<string | null> {
  const [zeile] = await db
    .select({ wert: einstellung.wert })
    .from(einstellung)
    .where(eq(einstellung.schluessel, schluessel))
    .limit(1);
  return zeile?.wert ?? null;
}

async function schreibe(schluessel: string, wert: string): Promise<void> {
  await db
    .insert(einstellung)
    .values({ schluessel, wert })
    .onConflictDoUpdate({ target: einstellung.schluessel, set: { wert } });
}

export async function getDatumOffsetTage(): Promise<number> {
  const wert = Number(await lies(DATUM_OFFSET));
  return Number.isFinite(wert) ? wert : 0;
}

export async function setDatumOffsetTage(tage: number): Promise<void> {
  await schreibe(DATUM_OFFSET, String(Math.trunc(tage)));
}

/**
 * "Now" as the hub sees it. In the MVP the admin can shift the date to play
 * through deadlines and reminders (SPEC §8 "Datum simulieren"); every
 * deadline, reminder and dashboard uses this instead of new Date().
 */
export async function getJetzt(): Promise<Date> {
  const offset = await getDatumOffsetTage();
  const jetzt = new Date();
  if (offset !== 0) jetzt.setDate(jetzt.getDate() + offset);
  return jetzt;
}
