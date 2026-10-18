import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checkpunkt,
  checkpunktVorlage,
  kalenderEintrag,
  kunde,
  modul,
  nutzer,
  trainer,
  workshop,
  workshopModul,
  zuweisung,
  type KalenderPayload,
  type KalenderTerminArt,
  type WorkshopModus,
  type WorkshopStatus,
  type ZuweisungStatus,
} from "@/db/schema";
import { synchronisiereCheckliste } from "@/lib/checklist";
import { formatDatum, formatDatumZeit, formatTerminSpanne } from "@/lib/format";
import { HUB_URL, SERVICE_EMAIL } from "@/lib/konfig";
import { queueKalender, queueMail } from "@/lib/postausgang";
import {
  istFixiert,
  istInaktiv,
  letzterTermin,
  modusKategorie,
  terminEnde,
} from "@/lib/status";

// The ⚙ part of the process (SPEC §4–§6): calendar entries in service@ and
// the automatic trainer mails. Everything goes through the Postausgang; all
// functions are idempotent and safe to call after any change.

function workshopLink(workshopId: number): string {
  return `${HUB_URL}/workshops/${workshopId}`;
}

const LOGIN_HINWEIS = `Anmeldung im Workshop-Hub: ${HUB_URL}/login — E-Mail-Adresse eingeben, du bekommst einen Login-Link.`;

async function ladeKontext(workshopId: number) {
  const [zeile] = await db
    .select({ ws: workshop, firma: kunde.firma })
    .from(workshop)
    .innerJoin(kunde, eq(workshop.unternehmenId, kunde.id))
    .where(eq(workshop.id, workshopId))
    .limit(1);
  if (!zeile) return null;

  const [verantwortlich] = zeile.ws.verantwortlichInternId
    ? await db
        .select({ name: nutzer.name, email: nutzer.email })
        .from(nutzer)
        .where(eq(nutzer.id, zeile.ws.verantwortlichInternId))
        .limit(1)
    : [];

  const trainerListe = await db
    .select({
      zuweisungId: zuweisung.id,
      rolle: zuweisung.rolle,
      status: zuweisung.status,
      anfrageGesendetAm: zuweisung.anfrageGesendetAm,
      infomailGesendetAm: zuweisung.infomailGesendetAm,
      trainerId: trainer.id,
      nutzerId: trainer.nutzerId,
      name: trainer.name,
      email: trainer.email,
    })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(eq(zuweisung.workshopId, workshopId))
    .orderBy(asc(zuweisung.rolle), asc(trainer.name));

  const modulListe = await db
    .select({ name: modul.name })
    .from(workshopModul)
    .innerJoin(modul, eq(workshopModul.modulId, modul.id))
    .where(eq(workshopModul.workshopId, workshopId))
    .orderBy(asc(modul.name));

  return {
    ws: zeile.ws,
    firma: zeile.firma,
    // Fallback recipient for team notifications (SPEC §5).
    teamEmpfaenger: verantwortlich?.email ?? SERVICE_EMAIL,
    teamName: verantwortlich?.name ?? "Team",
    trainer: trainerListe,
    module: modulListe.map((m) => m.name),
  };
}

type Kontext = NonNullable<Awaited<ReturnType<typeof ladeKontext>>>;

// No request/info mails for workshops that already took place (e.g. after
// an import or when a past workshop is edited).
function istVorbei(ws: Kontext["ws"], jetzt: Date): boolean {
  const ende = letzterTermin(ws);
  return ende !== null && ende < jetzt;
}

function termineText(ws: Kontext["ws"]): string {
  const zeilen = [
    ws.termin1 && `Termin: ${formatTerminSpanne(ws.termin1, ws.termin1Ende)}`,
    ws.termin2 && `Tag 2: ${formatTerminSpanne(ws.termin2, ws.termin2Ende)}`,
    ws.terminFup && `Follow-up: ${formatTerminSpanne(ws.terminFup, ws.terminFupEnde)}`,
  ].filter(Boolean);
  return zeilen.length ? zeilen.join("\n") : "Termin: noch offen";
}

function ortText(ws: Kontext["ws"]): string {
  if (modusKategorie(ws.modus) === "online") {
    return `Online${ws.teamsMeetingUrl ? ` — ${ws.teamsMeetingUrl}` : " (Link folgt)"}`;
  }
  return ws.ort ?? ws.modus ?? "noch offen";
}

// --- Kalender ----------------------------------------------------------------

const TERMIN_FELDER: {
  art: KalenderTerminArt;
  feld: "termin1" | "termin2" | "terminFup";
  endeFeld: "termin1Ende" | "termin2Ende" | "terminFupEnde";
  zusatz: string;
}[] = [
  { art: "termin1", feld: "termin1", endeFeld: "termin1Ende", zusatz: "" },
  { art: "termin2", feld: "termin2", endeFeld: "termin2Ende", zusatz: " (Tag 2)" },
  { art: "fup", feld: "terminFup", endeFeld: "terminFupEnde", zusatz: " (Follow-up)" },
];

/**
 * Brings the service@ calendar in line with the workshop (SPEC §6): an entry
 * exists as soon as a date is set — tentative until the offer is accepted,
 * then fixed; date changes send updates, "Abgesagt" sends a cancellation,
 * "On-Hold" marks the title. Confirmed trainers are attendees.
 */
export async function synchronisiereKalender(
  workshopId: number,
  jetzt: Date,
): Promise<void> {
  const k = await ladeKontext(workshopId);
  if (!k || k.ws.archiviertAm) return;
  const { ws } = k;

  const bestehende = await db
    .select()
    .from(kalenderEintrag)
    .where(eq(kalenderEintrag.workshopId, workshopId));

  const bestaetigte = k.trainer.filter((t) => t.status === "bestaetigt");
  const trainerNamen = bestaetigte.map((t) => t.name).join(", ") || "Trainer offen";
  const online = modusKategorie(ws.modus) === "online";

  for (const { art, feld, endeFeld, zusatz } of TERMIN_FELDER) {
    const start = ws[feld];
    const bestehend = bestehende.find((e) => e.terminArt === art);

    if (!start || ws.status === "Abgesagt") {
      if (bestehend && bestehend.status !== "abgesagt") {
        await queueKalender({
          anlass: "kalender",
          workshopId,
          jetzt,
          payload: {
            aktion: "absagen",
            terminArt: art,
            titel: `Abgesagt: ${ws.name}${zusatz} · ${k.firma}`,
            start: "",
            ende: "",
            ort: null,
            vorlaeufig: false,
            teilnehmer: bestaetigte.map((t) => t.email),
            teamsMeetingAnfordern: false,
            beschreibung: workshopLink(workshopId),
          },
        });
        await db
          .update(kalenderEintrag)
          .set({ status: "abgesagt", fingerabdruck: "" })
          .where(eq(kalenderEintrag.id, bestehend.id));
      }
      continue;
    }

    const status =
      ws.status === "On-Hold" ? "on_hold" : istFixiert(ws.status) ? "fixiert" : "vorlaeufig";
    const praefix =
      status === "vorlaeufig" ? "[Vorläufig] " : status === "on_hold" ? "[On Hold] " : "";
    const ende = terminEnde(start, ws[endeFeld]);
    const payload: KalenderPayload = {
      aktion: "anlegen",
      terminArt: art,
      // No internal data in the entry — trainers see the invite (SPEC §6).
      titel: `${praefix}${ws.name}${zusatz} · ${k.firma} · ${trainerNamen}`,
      start: formatDatumZeit(start),
      ende: formatDatumZeit(ende),
      ort: online ? (ws.teamsMeetingUrl ?? "Teams-Meeting") : ws.ort,
      vorlaeufig: status === "vorlaeufig",
      teilnehmer: bestaetigte.map((t) => t.email),
      teamsMeetingAnfordern: online && !ws.teamsMeetingUrl,
      beschreibung: `Workshop-Seite im Hub: ${workshopLink(workshopId)}`,
    };
    const fingerabdruck = JSON.stringify({ ...payload, aktion: undefined, status });

    if (!bestehend || bestehend.status === "abgesagt") {
      // Never create entries for dates that already passed (imports, edits
      // of old workshops) — existing entries are still updated/cancelled.
      if (start < jetzt) continue;
      await queueKalender({ anlass: "kalender", workshopId, jetzt, payload });
      await db
        .insert(kalenderEintrag)
        .values({
          workshopId,
          terminArt: art,
          status,
          fingerabdruck,
          teamsMeetingAngefordert: payload.teamsMeetingAnfordern,
        })
        .onConflictDoUpdate({
          target: [kalenderEintrag.workshopId, kalenderEintrag.terminArt],
          set: { status, fingerabdruck, teamsMeetingAngefordert: payload.teamsMeetingAnfordern },
        });
    } else if (bestehend.fingerabdruck !== fingerabdruck) {
      await queueKalender({
        anlass: "kalender",
        workshopId,
        jetzt,
        payload: { ...payload, aktion: "aktualisieren" },
      });
      await db
        .update(kalenderEintrag)
        .set({ status, fingerabdruck, teamsMeetingAngefordert: payload.teamsMeetingAnfordern })
        .where(eq(kalenderEintrag.id, bestehend.id));
    }
  }
}

// --- Trainer-Mails -------------------------------------------------------------

/** SPEC §5 (1): request mail as soon as a trainer is assigned. */
export async function sendeAnfragen(workshopId: number, jetzt: Date): Promise<void> {
  const k = await ladeKontext(workshopId);
  if (!k || k.ws.archiviertAm || istInaktiv(k.ws.status) || istVorbei(k.ws, jetzt)) return;

  for (const t of k.trainer) {
    if (t.status !== "angefragt" || t.anfrageGesendetAm) continue;
    await queueMail({
      anlass: "trainer_anfrage",
      workshopId,
      jetzt,
      an: t.email,
      betreff: `Anfrage: ${k.ws.name} (${k.firma})`,
      text: [
        `Hallo ${t.name},`,
        "",
        "wir würden dich gerne für folgenden Workshop anfragen:",
        "",
        `${k.ws.name} — ${k.firma}`,
        termineText(k.ws),
        `Ort: ${ortText(k.ws)}`,
        k.module.length ? `Module: ${k.module.join(", ")}` : null,
        "",
        `Bitte sag im Workshop-Hub zu oder ab: ${workshopLink(workshopId)}`,
        LOGIN_HINWEIS,
        "",
        `Danke! ${k.teamName}`,
      ]
        .filter((z) => z !== null)
        .join("\n"),
    });
    await db
      .update(zuweisung)
      .set({ anfrageGesendetAm: jetzt })
      .where(eq(zuweisung.id, t.zuweisungId));
  }
}

/** SPEC §5 (3): info package once the workshop is fixed. */
export async function sendeInfopakete(workshopId: number, jetzt: Date): Promise<void> {
  const k = await ladeKontext(workshopId);
  if (
    !k ||
    k.ws.archiviertAm ||
    istInaktiv(k.ws.status) ||
    !istFixiert(k.ws.status) ||
    istVorbei(k.ws, jetzt)
  ) {
    return;
  }

  for (const t of k.trainer) {
    if (t.status !== "bestaetigt" || t.infomailGesendetAm) continue;

    const aufgaben = t.nutzerId
      ? await db
          .select({
            titel: sql<string>`coalesce(${checkpunkt.titel}, ${checkpunktVorlage.titel})`,
            faelligAm: checkpunkt.faelligAm,
          })
          .from(checkpunkt)
          .leftJoin(checkpunktVorlage, eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id))
          .where(
            and(
              eq(checkpunkt.workshopId, workshopId),
              eq(checkpunkt.verantwortlichUserId, t.nutzerId),
              eq(checkpunkt.status, "offen"),
            ),
          )
          .orderBy(sql`${checkpunkt.faelligAm} ASC NULLS LAST`)
      : [];

    await queueMail({
      anlass: "trainer_infopaket",
      workshopId,
      jetzt,
      an: t.email,
      betreff: `Infopaket: ${k.ws.name} (${k.firma}) ist fixiert`,
      text: [
        `Hallo ${t.name},`,
        "",
        `der Workshop „${k.ws.name}“ bei ${k.firma} ist fixiert. Alles Wichtige auf einen Blick:`,
        "",
        termineText(k.ws),
        `Ort: ${ortText(k.ws)}`,
        `Ansprechperson beim Kunden: ${k.ws.ansprechperson ?? "–"}`,
        k.module.length ? `Module: ${k.module.join(", ")}` : null,
        `Präsentation: ${k.ws.verwendetesSlidedeck ?? "folgt"}`,
        "",
        aufgaben.length ? "Deine Aufgaben:" : null,
        ...aufgaben.map((a) => `• ${a.titel} — bis ${formatDatum(a.faelligAm)}`),
        aufgaben.length ? "" : null,
        `Workshop-Seite: ${workshopLink(workshopId)}`,
        LOGIN_HINWEIS,
        "",
        `Danke! ${k.teamName}`,
      ]
        .filter((z) => z !== null)
        .join("\n"),
    });
    await db
      .update(zuweisung)
      .set({ infomailGesendetAm: jetzt })
      .where(eq(zuweisung.id, t.zuweisungId));
  }
}

/** SPEC §5 (4): relevant change without calendar relevance (new presentation). */
async function sendeUpdateMails(
  k: Kontext,
  was: string,
  jetzt: Date,
): Promise<void> {
  for (const t of k.trainer) {
    if (t.status !== "bestaetigt" || !t.infomailGesendetAm) continue;
    await queueMail({
      anlass: "trainer_update",
      workshopId: k.ws.id,
      jetzt,
      an: t.email,
      betreff: `Änderung bei ${k.ws.name} (${k.firma})`,
      text: `Hallo ${t.name},\n\nbeim Workshop „${k.ws.name}“ gibt es eine Änderung:\n\n${was}\n\nWorkshop-Seite: ${workshopLink(k.ws.id)}\n\nDanke! ${k.teamName}`,
    });
  }
}

// --- Einstiegspunkte für Actions ----------------------------------------------

export interface WorkshopVorher {
  status: WorkshopStatus;
  verwendetesSlidedeck: string | null;
}

/** Call after any change to a workshop's fields or status. */
export async function nachWorkshopAenderung(
  workshopId: number,
  vorher: WorkshopVorher | null,
  jetzt: Date,
): Promise<void> {
  await synchronisiereCheckliste(workshopId, jetzt);
  await synchronisiereKalender(workshopId, jetzt);

  const k = await ladeKontext(workshopId);
  if (!k || k.ws.archiviertAm) return;
  if (
    vorher &&
    k.ws.verwendetesSlidedeck &&
    k.ws.verwendetesSlidedeck !== vorher.verwendetesSlidedeck
  ) {
    await sendeUpdateMails(k, `Neue Präsentation: ${k.ws.verwendetesSlidedeck}`, jetzt);
  }
  await sendeAnfragen(workshopId, jetzt);
  await sendeInfopakete(workshopId, jetzt);
}

/** Call after a trainer was assigned or removed. */
export async function nachZuweisungAenderung(
  workshopId: number,
  jetzt: Date,
): Promise<void> {
  await synchronisiereCheckliste(workshopId, jetzt);
  await synchronisiereKalender(workshopId, jetzt);
  await sendeAnfragen(workshopId, jetzt);
  await sendeInfopakete(workshopId, jetzt);
}

/** Call after a trainer accepted or declined in the portal. */
export async function nachTrainerAntwort(
  zuweisungId: number,
  status: ZuweisungStatus,
  jetzt: Date,
): Promise<void> {
  const [z] = await db
    .select({ workshopId: zuweisung.workshopId, trainerName: trainer.name })
    .from(zuweisung)
    .innerJoin(trainer, eq(zuweisung.trainerId, trainer.id))
    .where(eq(zuweisung.id, zuweisungId))
    .limit(1);
  if (!z) return;

  if (status === "abgesagt") {
    const k = await ladeKontext(z.workshopId);
    if (k) {
      await queueMail({
        anlass: "trainer_absage",
        workshopId: z.workshopId,
        jetzt,
        an: k.teamEmpfaenger,
        betreff: `Absage: ${z.trainerName} für ${k.ws.name}`,
        text: `Hallo ${k.teamName},\n\n${z.trainerName} hat für den Workshop „${k.ws.name}“ (${k.firma}) abgesagt.\n\nBitte einen anderen Trainer zuweisen: ${workshopLink(z.workshopId)}`,
      });
    }
  }
  await nachZuweisungAenderung(z.workshopId, jetzt);
}

// --- ⚙ Schritte für die Übersicht -------------------------------------------

export type AutomatikStatus = "erledigt" | "geplant" | "fehler" | "entfaellt";

export interface AutomatikSchritt {
  schluessel: string;
  titel: string;
  phase: WorkshopStatus;
  status: AutomatikStatus;
  detail: string;
}

export interface AutomatikEingabe {
  status: WorkshopStatus;
  modus: WorkshopModus | null;
  teamsMeetingUrl: string | null;
  kalender: { terminArt: KalenderTerminArt; status: string; teamsMeetingAngefordert: boolean }[];
  trainer: {
    name: string;
    status: ZuweisungStatus;
    anfrageGesendetAm: Date | null;
    infomailGesendetAm: Date | null;
    feedbackErinnerungAm: Date | null;
    hatFeedback: boolean;
  }[];
}

function namen(liste: { name: string }[]): string {
  return liste.map((t) => t.name).join(", ");
}

/**
 * Derives the fixed ⚙ steps of SPEC §4 from data. Pure function: the status
 * is never stored, so it can't drift from what actually happened.
 */
export function berechneAutomatikSchritte(e: AutomatikEingabe): AutomatikSchritt[] {
  const termin1 = e.kalender.find((k) => k.terminArt === "termin1");
  const aktiveTrainer = e.trainer.filter((t) => t.status !== "abgesagt");
  const bestaetigte = e.trainer.filter((t) => t.status === "bestaetigt");
  const angefragte = e.trainer.filter((t) => t.status === "angefragt");
  const online = modusKategorie(e.modus) === "online";

  const schritte: AutomatikSchritt[] = [];

  schritte.push({
    schluessel: "kalender_vorlaeufig",
    titel: "Kalendereintrag service@, vorläufig",
    phase: "Vorabstimmung",
    status: termin1 && termin1.status !== "abgesagt" ? "erledigt" : "geplant",
    detail: termin1 && termin1.status !== "abgesagt" ? "Eintrag erzeugt" : "sobald ein Termin eingetragen ist",
  });

  const ohneAnfrage = aktiveTrainer.filter((t) => !t.anfrageGesendetAm && t.status === "angefragt");
  schritte.push({
    schluessel: "trainer_anfrage",
    titel: "Anfrage-Mail an Trainer",
    phase: "Angebot",
    status: aktiveTrainer.length === 0 ? "geplant" : ohneAnfrage.length ? "geplant" : "erledigt",
    detail:
      aktiveTrainer.length === 0
        ? "sobald ein Trainer zugewiesen ist"
        : ohneAnfrage.length
          ? `ausstehend für ${namen(ohneAnfrage)}`
          : `an ${namen(aktiveTrainer)}`,
  });

  const alleAbgesagt = e.trainer.length > 0 && aktiveTrainer.length === 0;
  schritte.push({
    schluessel: "trainer_zusage",
    titel: "Zusage Trainer",
    phase: "Angebot",
    status: bestaetigte.length ? "erledigt" : alleAbgesagt ? "fehler" : "geplant",
    detail: bestaetigte.length
      ? `zugesagt: ${namen(bestaetigte)}${angefragte.length ? ` · offen: ${namen(angefragte)}` : ""}`
      : alleAbgesagt
        ? "alle angefragten Trainer haben abgesagt — Team ist informiert"
        : angefragte.length
          ? `wartet auf ${namen(angefragte)}`
          : "Trainer klickt im Portal auf Zusagen/Absagen",
  });

  schritte.push({
    schluessel: "kalender_fixiert",
    titel: "Kalender fixiert, Trainer eingeladen",
    phase: "Vorbereitung",
    status: termin1?.status === "fixiert" ? "erledigt" : "geplant",
    detail:
      termin1?.status === "fixiert"
        ? bestaetigte.length
          ? `eingeladen: ${namen(bestaetigte)}`
          : "fixiert — noch kein Trainer zugesagt"
        : "bei Status Vorbereitung (Angebot angenommen)",
  });

  schritte.push({
    schluessel: "teams_meeting",
    titel: "Teams-Meeting erstellt",
    phase: "Vorbereitung",
    status: !online ? "entfaellt" : e.teamsMeetingUrl ? "erledigt" : "geplant",
    detail: !online
      ? "nur bei Online-Workshops"
      : e.teamsMeetingUrl
        ? "Link eingetragen"
        : termin1?.teamsMeetingAngefordert
          ? "angefordert — wird ab der Microsoft-Anbindung automatisch erzeugt; Link kann manuell eingetragen werden"
          : "mit dem Kalendereintrag",
  });

  const ohneInfo = bestaetigte.filter((t) => !t.infomailGesendetAm);
  schritte.push({
    schluessel: "infopaket",
    titel: "Infopaket an Trainer",
    phase: "Vorbereitung",
    status: bestaetigte.length && !ohneInfo.length ? "erledigt" : "geplant",
    detail:
      bestaetigte.length && !ohneInfo.length
        ? `an ${namen(bestaetigte)}`
        : "bei Status Vorbereitung an alle zugesagten Trainer",
  });

  const ohneErinnerung = bestaetigte.filter((t) => !t.feedbackErinnerungAm && !t.hatFeedback);
  schritte.push({
    schluessel: "feedback_erinnerung",
    titel: "Erinnerung „Feedback ausfüllen“ an Trainer",
    phase: "Nachbereitung",
    status: bestaetigte.length && !ohneErinnerung.length ? "erledigt" : "geplant",
    detail:
      bestaetigte.length && !ohneErinnerung.length
        ? "verschickt bzw. Feedback schon da"
        : "einmalig 1 Tag nach dem Workshop",
  });

  const ohneFeedback = bestaetigte.filter((t) => !t.hatFeedback);
  schritte.push({
    schluessel: "trainer_feedback",
    titel: "Trainer-Feedback eingegangen",
    phase: "Nachbereitung",
    status: bestaetigte.length && !ohneFeedback.length ? "erledigt" : "geplant",
    detail:
      bestaetigte.length && !ohneFeedback.length
        ? `von ${namen(bestaetigte)}`
        : ohneFeedback.length
          ? `fehlt von ${namen(ohneFeedback)} — nach 7 Tagen wird daraus eine Team-Aufgabe`
          : "nach dem Workshop",
  });

  if (istInaktiv(e.status)) {
    return schritte.map((s) =>
      s.status === "geplant" ? { ...s, status: "entfaellt", detail: `pausiert (${e.status})` } : s,
    );
  }
  return schritte;
}

// Workshops without a verantwortlich intern still need someone to receive
// team notifications — exported for the daily job.
export async function teamEmpfaengerFuer(workshopId: number): Promise<string> {
  const [zeile] = await db
    .select({ email: nutzer.email })
    .from(workshop)
    .leftJoin(nutzer, eq(workshop.verantwortlichInternId, nutzer.id))
    .where(and(eq(workshop.id, workshopId), isNull(workshop.archiviertAm)))
    .limit(1);
  return zeile?.email ?? SERVICE_EMAIL;
}
