import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "./index";
import {
  checklistenVorlage,
  checkpunkt,
  checkpunktVorlage,
  kunde,
  nutzer,
  threadKommentar,
  trainer,
  workshop,
  zuweisung,
  type NeuerWorkshop,
  type WorkshopStatus,
} from "./schema";
import { instanziiereCheckpunkte } from "@/lib/checklist";

// Rich demo dataset standing in for the real Notion import: realistic
// workshops across all statuses with deliberate gaps (overdue items, missing
// trainers, open invoices) so the app has something to surface. All dates are
// relative to seed time so the data never goes stale. Refuses to run on a
// non-empty database.

const PHASEN_REIHENFOLGE: WorkshopStatus[] = [
  "Vorabstimmung",
  "Angebot",
  "Vorbereitung",
  "Durchführung",
  "Nachbereitung",
  "Done",
];

function inTagen(tage: number, stunde = 9): Date {
  const datum = new Date();
  datum.setDate(datum.getDate() + tage);
  datum.setHours(stunde, 0, 0, 0);
  return datum;
}

function sharepoint(pfad: string): string {
  return `https://dbrains.sharepoint.com/sites/workshops/${pfad}`;
}

export async function applySeed(db: Db): Promise<"seeded" | "skipped"> {
  const vorhandene = await db.select({ id: nutzer.id }).from(nutzer).limit(1);
  if (vorhandene.length > 0) {
    return "skipped";
  }

  // --- Nutzer & Trainer ------------------------------------------------
  const [leon, romana, , , trainerinNutzer, thomasNutzer] = await db
    .insert(nutzer)
    .values([
      { name: "Leon", email: "leon@dbrains.academy", rolle: "admin" },
      { name: "Romana", email: "romana@dbrains.academy", rolle: "team" },
      { name: "Martin", email: "martin@dbrains.academy", rolle: "team" },
      { name: "Sarah", email: "sarah@dbrains.academy", rolle: "team" },
      { name: "Externe Trainerin", email: "trainerin@example.com", rolle: "trainer" },
      { name: "Thomas Brunner", email: "thomas.brunner@trainernetz.example.com", rolle: "trainer" },
    ])
    .returning();

  const [trainerin, thomas, leonTrainer, romanaTrainer] = await db
    .insert(trainer)
    .values([
      {
        name: "Externe Trainerin",
        email: "trainerin@example.com",
        extern: true,
        nutzerId: trainerinNutzer.id,
        verfuegbarkeitNotiz: "Di–Do verfügbar, Mo/Fr nur online",
      },
      {
        name: "Thomas Brunner",
        email: "thomas.brunner@trainernetz.example.com",
        extern: true,
        nutzerId: thomasNutzer.id,
        verfuegbarkeitNotiz: "September ausgebucht, ab Oktober wieder frei",
      },
      { name: "Leon", email: "leon@dbrains.academy", extern: false, nutzerId: leon.id },
      { name: "Romana", email: "romana@dbrains.academy", extern: false, nutzerId: romana.id },
    ])
    .returning();

  // --- Kunden -----------------------------------------------------------
  const kunden = await db
    .insert(kunde)
    .values([
      { firma: "Alpenland Maschinenbau GmbH" },
      { firma: "TechnoWerk Linz GmbH" },
      { firma: "Bäckerei Wimmer" },
      { firma: "Stadtgemeinde Traun" },
      { firma: "HTL Wels" },
      { firma: "Energie OÖ AG" },
      { firma: "Kanzlei Mayr & Partner" },
      { firma: "Möbelwerk Steiner GmbH" },
      { firma: "VersicherungsPlus AG" },
      { firma: "Logistik Pichler GmbH" },
    ])
    .returning();
  const kundeNach = new Map(kunden.map((k) => [k.firma, k.id]));

  // --- Checklisten-Vorlagen ----------------------------------------------
  const [standard, lehrlinge] = await db
    .insert(checklistenVorlage)
    .values([
      { name: "Standard-Workshop", giltFuerType: null },
      { name: "Zusatz Lehrlings-Workshops", giltFuerType: "Lehrlinge" },
    ])
    .returning();

  await db.insert(checkpunktVorlage).values([
    // Vorabstimmung
    { vorlageId: standard.id, titel: "Erstgespräch dokumentieren (Notizen in SharePoint)", phase: "Vorabstimmung", verantwortlichRolle: "team", faelligOffsetTage: -42 },
    { vorlageId: standard.id, titel: "Zieltermin mit Kunde abstimmen", phase: "Vorabstimmung", verantwortlichRolle: "team", faelligOffsetTage: -35 },
    // Angebot
    { vorlageId: standard.id, titel: "Angebot in SevDesk erstellen und versenden", phase: "Angebot", verantwortlichRolle: "team", faelligOffsetTage: -28, autoCheckRegel: "sevdesk_re" },
    { vorlageId: standard.id, titel: "Angebot nachfassen (falls keine Rückmeldung)", phase: "Angebot", verantwortlichRolle: "team", faelligOffsetTage: -21 },
    // Vorbereitung
    { vorlageId: standard.id, titel: "Vorab-Fragebogen (MS Forms) an Teilnehmer senden", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -14, autoCheckRegel: "forms_vorab" },
    { vorlageId: standard.id, titel: "Kalendereintrag für alle Beteiligten anlegen", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -14, autoCheckRegel: "outlook_termin" },
    { vorlageId: standard.id, titel: "Teams-Meeting anlegen (bei ONLINE)", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -10, autoCheckRegel: "teams_meeting" },
    { vorlageId: standard.id, titel: "Agenda aus Vorgespräch + Forms-Antworten erstellen", phase: "Vorbereitung", verantwortlichRolle: "trainer_lead", faelligOffsetTage: -7 },
    { vorlageId: standard.id, titel: "Slidedeck finalisieren und in SharePoint ablegen", phase: "Vorbereitung", verantwortlichRolle: "trainer_lead", faelligOffsetTage: -3 },
    { vorlageId: standard.id, titel: "Raum, Technik und Catering mit Kunde klären", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -5 },
    // Durchführung
    { vorlageId: standard.id, titel: "Teilnehmerliste und Feedback-QR-Code vorbereiten", phase: "Durchführung", verantwortlichRolle: "trainer_lead", faelligOffsetTage: -1 },
    // Nachbereitung
    { vorlageId: standard.id, titel: "Feedback-Formular versenden", phase: "Nachbereitung", verantwortlichRolle: "team", faelligOffsetTage: 1, autoCheckRegel: "forms_feedback" },
    { vorlageId: standard.id, titel: "Follow-up-Mail mit Materialien an Kunde", phase: "Nachbereitung", verantwortlichRolle: "trainer_lead", faelligOffsetTage: 3 },
    { vorlageId: standard.id, titel: "Rechnung in SevDesk stellen", phase: "Nachbereitung", verantwortlichRolle: "team", faelligOffsetTage: 5, autoCheckRegel: "sevdesk_re" },
    { vorlageId: standard.id, titel: "FUP-Termin vorschlagen", phase: "Nachbereitung", verantwortlichRolle: "team", faelligOffsetTage: 14 },
    // Lehrlinge-Zusatz
    { vorlageId: lehrlinge.id, titel: "Einverständniserklärungen der Erziehungsberechtigten einholen", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -14 },
    { vorlageId: lehrlinge.id, titel: "Ausbilder:innen über Ablauf informieren", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -7 },
  ]);

  // --- Workshops ----------------------------------------------------------
  // leadId/coId reference trainer records; erledigtBis marks how far the
  // checklist is ticked off ("phase" = everything before current phase).
  interface SeedWorkshop {
    daten: Omit<NeuerWorkshop, "unternehmenId"> & { firma: string };
    leadId?: number;
    coId?: number;
    aktuellePhaseErledigt?: number; // how many items of the current phase are done
  }

  const seedWorkshops: SeedWorkshop[] = [
    // --- Vorbereitung (die heiße Phase) — Reihenfolge 1+2 fix für Demo/Doku
    {
      daten: {
        firma: "Alpenland Maschinenbau GmbH", name: "KI-Grundlagen für Lehrlinge",
        ansprechperson: "Max Mustermann", type: "Lehrlinge", format: "dbrains academy",
        modus: "VOR ORT", status: "Vorbereitung", termin1: inTagen(12), termin2: inTagen(26),
        wsBetrag: "2500.00", sharepointUrl: sharepoint("alpenland-lehrlinge"),
        formsVorabUrl: "https://forms.office.com/r/beispiel1",
      },
      leadId: undefined, coId: undefined, aktuellePhaseErledigt: 2,
    },
    {
      daten: {
        firma: "TechnoWerk Linz GmbH", name: "Agentic AI Deep Dive",
        ansprechperson: "Dr. Petra Lang", type: "Agentic AI", modus: "ONLINE",
        status: "Vorabstimmung", wsBetrag: "4800.00",
      },
    },
    {
      daten: {
        firma: "Energie OÖ AG", name: "KI im Kundenservice — Pilotworkshop",
        ansprechperson: "Herbert Aigner", type: "Maßgeschneiderter Workshop",
        format: "dbrains academy", modus: "VOR ORT", status: "Vorbereitung",
        termin1: inTagen(5), wsBetrag: "5200.00",
        sharepointUrl: sharepoint("energie-ooe-kundenservice"),
        interneNotizen:
          "Vorstand will bei der Ergebnispräsentation dabei sein — Folien unbedingt auf Deutsch.\nBudget für Follow-up ist laut Hr. Aigner bereits reserviert.",
      },
      leadId: undefined, aktuellePhaseErledigt: 1, // bewusst OHNE Trainer → sichtbare Lücke
    },
    {
      daten: {
        firma: "HTL Wels", name: "Prompt Engineering für Maturaklassen",
        ansprechperson: "Prof. Kerschbaum", type: "Schule", format: "dbrains x Land OÖ",
        modus: "VOR ORT", status: "Vorbereitung", termin1: inTagen(20),
        wsBetrag: "1800.00", sharepointUrl: sharepoint("htl-wels-prompting"),
      },
      leadId: undefined, coId: undefined, aktuellePhaseErledigt: 4,
    },
    {
      daten: {
        firma: "Stadtgemeinde Traun", name: "KI-Werkzeuge in der Verwaltung",
        ansprechperson: "Mag. Hofstätter", type: "Beratung", modus: "Webex",
        status: "Vorbereitung", termin1: inTagen(33), wsBetrag: "3600.00",
      },
      leadId: undefined, aktuellePhaseErledigt: 0,
    },
    // --- Durchführung
    {
      daten: {
        firma: "Möbelwerk Steiner GmbH", name: "Ideation-Sprint: KI-Anwendungsfälle",
        ansprechperson: "Klaus Steiner", type: "Ideation", modus: "VOR ORT",
        status: "Durchführung", termin1: inTagen(0, 8), wsBetrag: "2900.00",
        sharepointUrl: sharepoint("steiner-ideation"),
      },
      leadId: undefined, aktuellePhaseErledigt: 1,
    },
    // --- Nachbereitung
    {
      daten: {
        firma: "VersicherungsPlus AG", name: "KI-Kompetenz für Führungskräfte",
        ansprechperson: "Mag. Doris Ecker", type: "Academy", format: "dbrains academy",
        modus: "VOR ORT", status: "Nachbereitung", termin1: inTagen(-6),
        wsBetrag: "6400.00", rechnungStatus: "senden",
        sharepointUrl: sharepoint("versicherungsplus-fk"),
        formsFeedbackUrl: "https://forms.office.com/r/beispiel2",
      },
      leadId: undefined, aktuellePhaseErledigt: 1,
    },
    {
      daten: {
        firma: "Logistik Pichler GmbH", name: "Automatisierung im Backoffice",
        ansprechperson: "Eva Pichler", type: "Beratung", modus: "ONLINE",
        status: "Nachbereitung", termin1: inTagen(-12), wsBetrag: "3100.00",
        rechnungStatus: "warten",
      },
      leadId: undefined, aktuellePhaseErledigt: 3,
    },
    // --- Angebot
    {
      daten: {
        firma: "Kanzlei Mayr & Partner", name: "KI in der Rechtsberatung — Keynote",
        ansprechperson: "Dr. Mayr", type: "Keynote", modus: "VOR ORT",
        status: "Angebot", termin1: inTagen(45), wsBetrag: "1500.00",
      },
      leadId: undefined, aktuellePhaseErledigt: 1,
    },
    {
      daten: {
        firma: "Bäckerei Wimmer", name: "Digitalisierung im Handwerk",
        ansprechperson: "Josef Wimmer", type: "Beratung", modus: "VOR ORT",
        status: "Angebot", termin1: inTagen(60), wsBetrag: "2200.00",
      },
      aktuellePhaseErledigt: 0,
    },
    {
      daten: {
        firma: "TechnoWerk Linz GmbH", name: "Agentic AI Aufbau-Workshop",
        ansprechperson: "Dr. Petra Lang", type: "Agentic AI", format: "dbrains x SCCH",
        modus: "SCCH", status: "Angebot", wsBetrag: "5400.00",
      },
      aktuellePhaseErledigt: 0,
    },
    // --- Vorabstimmung
    {
      daten: {
        firma: "Energie OÖ AG", name: "Follow-up: KI-Governance",
        ansprechperson: "Herbert Aigner", type: "Beratung", status: "Vorabstimmung",
      },
    },
    {
      daten: {
        firma: "HTL Wels", name: "Lehrkräfte-Fortbildung KI im Unterricht",
        ansprechperson: "Prof. Kerschbaum", type: "Schule", format: "dbrains x Land OÖ",
        status: "Vorabstimmung",
      },
    },
    // --- On-Hold
    {
      daten: {
        firma: "Stadtgemeinde Traun", name: "Bürgerservice-Chatbot Schulung",
        ansprechperson: "Mag. Hofstätter", type: "Maßgeschneiderter Workshop",
        status: "On-Hold/Abgesagt",
      },
    },
    {
      daten: {
        firma: "Bäckerei Wimmer", name: "Social-Media-Content mit KI",
        type: "Ideation", status: "On-Hold/Abgesagt",
      },
    },
  ];

  // Done workshops from the last months.
  const doneWorkshops: SeedWorkshop[] = [
    { daten: { firma: "Alpenland Maschinenbau GmbH", name: "KI-Einführung Produktionsteam", type: "Maßgeschneiderter Workshop", modus: "VOR ORT", status: "Done", termin1: inTagen(-30), wsBetrag: "4100.00", rechnungStatus: "gesendet", trainerRe: "überwiesen", verwendetesSlidedeck: sharepoint("alpenland-produktion/slides.pptx") }, leadId: undefined },
    { daten: { firma: "VersicherungsPlus AG", name: "Prompt-Basics für Sachbearbeitung", type: "Academy", format: "dbrains academy", modus: "ONLINE", status: "Done", termin1: inTagen(-45), wsBetrag: "2800.00", rechnungStatus: "gesendet", trainerRe: "überwiesen" }, leadId: undefined },
    { daten: { firma: "HTL Wels", name: "KI-Projektwoche 5. Jahrgang", type: "Schule", format: "dbrains x Land OÖ", modus: "VOR ORT", status: "Done", termin1: inTagen(-60), wsBetrag: "2000.00", rechnungStatus: "gesendet", trainerRe: "überwiesen" }, leadId: undefined },
    { daten: { firma: "Kanzlei Mayr & Partner", name: "Keynote Kanzleitag 2026", type: "Keynote", modus: "VOR ORT", status: "Done", termin1: inTagen(-75), wsBetrag: "1500.00", rechnungStatus: "gesendet", trainerRe: "offen" }, leadId: undefined },
    { daten: { firma: "Logistik Pichler GmbH", name: "KI-Potenzialanalyse", type: "Beratung", modus: "ONLINE", status: "Done", termin1: inTagen(-90), wsBetrag: "3300.00", rechnungStatus: "gesendet", trainerRe: "überwiesen" }, leadId: undefined },
    // Done, aber Rechnung nie gestellt → soll auffallen!
    { daten: { firma: "Möbelwerk Steiner GmbH", name: "ChatGPT im Vertrieb", type: "Maßgeschneiderter Workshop", modus: "VOR ORT", status: "Done", termin1: inTagen(-21), wsBetrag: "2600.00", rechnungStatus: "warten" }, leadId: undefined },
    { daten: { firma: "TechnoWerk Linz GmbH", name: "Agentic AI Grundlagen", type: "Agentic AI", format: "dbrains x SCCH", modus: "SCCH", status: "Done", termin1: inTagen(-40), wsBetrag: "4900.00", rechnungStatus: "gesendet", trainerRe: "überwiesen" }, leadId: undefined },
    { daten: { firma: "Energie OÖ AG", name: "KI-Awareness Belegschaft", type: "Academy", format: "dbrains academy", modus: "ONLINE", status: "Done", termin1: inTagen(-55), wsBetrag: "3800.00", rechnungStatus: "gesendet", trainerRe: "überwiesen" }, leadId: undefined },
  ];

  // Rotate trainers across workshops: Trainerin, Thomas, Leon, Romana.
  const rotation = [trainerin.id, thomas.id, leonTrainer.id, romanaTrainer.id];
  const alle = [...seedWorkshops, ...doneWorkshops];
  alle.forEach((w, i) => {
    // Workshop 1 (KI-Grundlagen) fix an Trainerin (Demo Trainer-Sicht),
    // Workshop 2 (Agentic AI Deep Dive) und Nr. 3 bewusst ohne Lead.
    if (i === 0) { w.leadId = trainerin.id; w.coId = romanaTrainer.id; return; }
    if (i === 1 || i === 2) { w.leadId = undefined; return; }
    if (w.daten.status === "On-Hold/Abgesagt" || w.daten.status === "Vorabstimmung") return;
    w.leadId = rotation[i % rotation.length];
    if (w.leadId === trainerin.id) w.coId = leonTrainer.id;
  });

  for (const eintrag of alle) {
    const { firma, ...werte } = eintrag.daten;
    const [neu] = await db
      .insert(workshop)
      .values({ ...werte, unternehmenId: kundeNach.get(firma)! })
      .returning();

    if (eintrag.leadId) {
      await db.insert(zuweisung).values({
        workshopId: neu.id, trainerId: eintrag.leadId, rolle: "lead", status: "bestaetigt",
      });
    }
    if (eintrag.coId) {
      await db.insert(zuweisung).values({
        workshopId: neu.id, trainerId: eintrag.coId, rolle: "co", status: "bestaetigt",
      });
    }

    // Instantiate the checklist history up to the current phase and tick off
    // everything from completed phases plus a slice of the current phase.
    const phaseIndex = PHASEN_REIHENFOLGE.indexOf(neu.status);
    if (phaseIndex < 0) continue; // On-Hold/Abgesagt: keine Checkliste

    // Done workshops: only the two with open invoices keep a visible tail.
    const istDone = neu.status === "Done";
    const brauchtNachbereitung = istDone && werte.rechnungStatus === "warten";
    if (istDone && !brauchtNachbereitung) continue;

    const phasen = istDone
      ? ["Nachbereitung" as const]
      : PHASEN_REIHENFOLGE.slice(0, phaseIndex + 1);
    for (const phase of phasen) {
      await instanziiereCheckpunkte(neu.id, phase);
    }

    const punkte = await db
      .select({ id: checkpunkt.id, phase: checkpunktVorlage.phase })
      .from(checkpunkt)
      .innerJoin(checkpunktVorlage, eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id))
      .where(eq(checkpunkt.workshopId, neu.id));

    const erledigteIds: number[] = [];
    let aktuelleErledigt = 0;
    for (const punkt of punkte) {
      const punktPhaseIndex = PHASEN_REIHENFOLGE.indexOf(punkt.phase);
      const istFruehere = !istDone && punktPhaseIndex < phaseIndex;
      const istAktuelle = istDone
        ? punkt.phase === "Nachbereitung"
        : punktPhaseIndex === phaseIndex;
      if (istFruehere) {
        erledigteIds.push(punkt.id);
      } else if (istAktuelle && aktuelleErledigt < (eintrag.aktuellePhaseErledigt ?? 0)) {
        erledigteIds.push(punkt.id);
        aktuelleErledigt++;
      }
    }
    if (erledigteIds.length > 0) {
      await db
        .update(checkpunkt)
        .set({ status: "erledigt", erledigtVia: "manuell" })
        .where(inArray(checkpunkt.id, erledigteIds));
    }
  }

  // Give open team items an owner (Romana) so reminders have someone to mail
  // — except for the workshop that deliberately has no trainer yet: its gaps
  // should stay visible.
  const [wsOhneTrainer] = await db
    .select({ id: workshop.id })
    .from(workshop)
    .where(eq(workshop.name, "KI im Kundenservice — Pilotworkshop"))
    .limit(1);
  const offeneOhneVerantwortung = await db
    .select({ id: checkpunkt.id, workshopId: checkpunkt.workshopId })
    .from(checkpunkt)
    .where(
      and(eq(checkpunkt.status, "offen"), isNull(checkpunkt.verantwortlichUserId)),
    );
  const zuRomana = offeneOhneVerantwortung
    .filter((p) => p.workshopId !== wsOhneTrainer.id)
    .map((p) => p.id);
  if (zuRomana.length > 0) {
    await db
      .update(checkpunkt)
      .set({ verantwortlichUserId: romana.id })
      .where(inArray(checkpunkt.id, zuRomana));
  }

  // --- Thread-Kommentare ----------------------------------------------------
  const [wsLehrlinge] = await db
    .select({ id: workshop.id })
    .from(workshop)
    .where(eq(workshop.name, "KI-Grundlagen für Lehrlinge"))
    .limit(1);
  const [wsFuehrung] = await db
    .select({ id: workshop.id })
    .from(workshop)
    .where(eq(workshop.name, "KI-Kompetenz für Führungskräfte"))
    .limit(1);

  await db.insert(threadKommentar).values([
    {
      workshopId: wsLehrlinge.id, autorId: romana.id,
      text: "Kunde hat angefragt, ob wir die Gruppe teilen können — 24 Lehrlinge sind zu viele für einen Raum. Ich kläre einen zweiten Termin.",
    },
    {
      workshopId: wsLehrlinge.id, autorId: trainerinNutzer.id,
      text: "Passt für mich! Ich würde dann beide Gruppen übernehmen. Agenda-Entwurf lade ich bis Freitag in SharePoint hoch.",
    },
    {
      workshopId: wsLehrlinge.id, autorId: leon.id,
      text: "Super. Denkt an die Einverständniserklärungen — sind bei Minderjährigen Pflicht (steht in der Checkliste).",
    },
    {
      workshopId: wsFuehrung.id, autorId: leon.id,
      text: "Feedback vom Vorstand war sehr positiv. Follow-up-Angebot für Q1 vorbereiten?",
    },
  ]);

  // One ad-hoc checklist item (no template behind it).
  await db.insert(checkpunkt).values({
    workshopId: wsLehrlinge.id,
    titel: "Zweiten Raum für Gruppe B organisieren",
    phase: "Vorbereitung",
    faelligAm: inTagen(4),
    verantwortlichUserId: romana.id,
  });

  return "seeded";
}
