import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import type { Db } from "./index";
import {
  aenderung,
  checklistenVorlage,
  checkpunkt,
  checkpunktVorlage,
  kunde,
  modul,
  nutzer,
  trainer,
  trainerFeedback,
  vorschlag,
  wiederkehrendeErinnerung,
  workshop,
  workshopModul,
  zuweisung,
  type NeuerWorkshop,
  type ZuweisungStatus,
} from "./schema";
import { nachWorkshopAenderung } from "@/lib/automatik";

// MVP test dataset (SPEC §8: "nur Testdaten"): realistic workshops in every
// phase with deliberate gaps — overdue tasks, a workshop without trainer, a
// pending trainer request, missing feedback — so every screen has something
// to show. All dates are relative to seed time. Runs through the real
// automation, so the Postausgang starts with realistic previews. Refuses to
// run on a non-empty database.

function inTagen(tage: number, stunde = 9): Date {
  const datum = new Date();
  datum.setDate(datum.getDate() + tage);
  datum.setHours(stunde, 0, 0, 0);
  return datum;
}

function ersterMontagNaechsterMonat(): Date {
  const datum = new Date();
  datum.setMonth(datum.getMonth() + 1, 1);
  datum.setHours(9, 0, 0, 0);
  while (datum.getDay() !== 1) datum.setDate(datum.getDate() + 1);
  return datum;
}

function sharepoint(pfad: string): string {
  return `https://dbrains.sharepoint.com/sites/workshops/Shared%20Documents/${pfad}`;
}

export async function applySeed(db: Db): Promise<"seeded" | "skipped"> {
  const vorhandene = await db.select({ id: nutzer.id }).from(nutzer).limit(1);
  if (vorhandene.length > 0) {
    return "skipped";
  }
  const jetzt = new Date();

  // --- Nutzer & Trainer ------------------------------------------------
  const [leon, romana, martin, , annaNutzer, thomasNutzer, juliaNutzer] = await db
    .insert(nutzer)
    .values([
      { name: "Leon", email: "leon@dbrains.academy", rolle: "admin" },
      { name: "Romana", email: "romana@dbrains.academy", rolle: "team" },
      { name: "Martin", email: "martin@dbrains.academy", rolle: "team" },
      { name: "Sarah", email: "sarah@dbrains.academy", rolle: "team" },
      { name: "Anna Berger", email: "anna.berger@example.com", rolle: "trainer" },
      { name: "Thomas Brunner", email: "thomas.brunner@example.com", rolle: "trainer" },
      { name: "Julia Wagner", email: "julia.wagner@example.com", rolle: "trainer" },
    ])
    .returning();

  const [anna, thomas, , leonTrainer, romanaTrainer] = await db
    .insert(trainer)
    .values([
      { name: "Anna Berger", email: "anna.berger@example.com", extern: true, nutzerId: annaNutzer.id },
      { name: "Thomas Brunner", email: "thomas.brunner@example.com", extern: true, nutzerId: thomasNutzer.id },
      // Deactivated: shows that access ends immediately.
      { name: "Julia Wagner", email: "julia.wagner@example.com", extern: true, aktiv: false, nutzerId: juliaNutzer.id },
      { name: "Leon", email: "leon@dbrains.academy", extern: false, nutzerId: leon.id },
      { name: "Romana", email: "romana@dbrains.academy", extern: false, nutzerId: romana.id },
    ])
    .returning();

  // --- Kunden & Module ---------------------------------------------------
  const kunden = await db
    .insert(kunde)
    .values([
      { firma: "Alpenland Maschinenbau GmbH", hubspotId: "18273645" },
      { firma: "TechnoWerk Linz GmbH" },
      { firma: "Bäckerei Wimmer" },
      { firma: "Stadtgemeinde Traun" },
      { firma: "HTL Wels" },
      { firma: "Energie OÖ AG", hubspotId: "99120034" },
      { firma: "Kanzlei Mayr & Partner" },
      { firma: "VersicherungsPlus AG" },
      { firma: "Logistik Pichler GmbH" },
    ])
    .returning();
  const kundeNach = new Map(kunden.map((k) => [k.firma, k.id]));

  const modulListe = await db
    .insert(modul)
    .values([
      { name: "KI-Grundlagen", sharepointUrl: sharepoint("Module/KI-Grundlagen"), beschreibung: "Was ist KI, wie funktionieren Sprachmodelle, Chancen & Grenzen" },
      { name: "Prompting", sharepointUrl: sharepoint("Module/Prompting"), beschreibung: "Gute Prompts, Rollen, Beispiele, Übungen" },
      { name: "Copilot in Outlook & Teams", sharepointUrl: sharepoint("Module/Copilot") },
      { name: "KI-Recht / AI Act", sharepointUrl: sharepoint("Module/AI-Act") },
      { name: "Agentic AI Basics", sharepointUrl: sharepoint("Module/Agentic-AI") },
    ])
    .returning();
  const modulNach = new Map(modulListe.map((m) => [m.name, m.id]));

  // --- Checkliste (SPEC §4) ------------------------------------------------
  const [standard, lehrlinge] = await db
    .insert(checklistenVorlage)
    .values([
      { name: "Standard-Workshop", giltFuerType: null },
      { name: "Zusatz Lehrlings-Workshops", giltFuerType: "Lehrlinge" },
    ])
    .returning();

  await db.insert(checkpunktVorlage).values([
    { vorlageId: standard.id, reihenfolge: 10, titel: "Erstgespräch dokumentieren", phase: "Vorabstimmung", verantwortlichRolle: "team", faelligOffsetTage: -42, linkFeld: "notion" },
    { vorlageId: standard.id, reihenfolge: 20, titel: "Termin mit Kunde abstimmen und eintragen", phase: "Vorabstimmung", verantwortlichRolle: "team", faelligOffsetTage: -35, autoCheckRegel: "termin_eingetragen" },
    { vorlageId: standard.id, reihenfolge: 30, titel: "Angebot erstellen und versenden", phase: "Angebot", verantwortlichRolle: "team", faelligOffsetTage: -28 },
    { vorlageId: standard.id, reihenfolge: 40, titel: "Angebot nachfassen", phase: "Angebot", verantwortlichRolle: "team", faelligOffsetTage: -21, autoCheckRegel: "angebot_angenommen" },
    { vorlageId: standard.id, reihenfolge: 50, titel: "Trainer zuweisen", phase: "Angebot", verantwortlichRolle: "team", faelligOffsetTage: -21, autoCheckRegel: "trainer_zugewiesen" },
    { vorlageId: standard.id, reihenfolge: 60, titel: "Vorab-Fragebogen an Teilnehmer senden", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -14, linkFeld: "forms_vorab" },
    { vorlageId: standard.id, reihenfolge: 70, titel: "Raum, Technik und Catering mit Kunde klären", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -7, nurModus: "praesenz" },
    { vorlageId: standard.id, reihenfolge: 80, titel: "Präsentation finalisieren und Link eintragen", phase: "Vorbereitung", verantwortlichRolle: "trainer_lead", faelligOffsetTage: -3, autoCheckRegel: "praesentation_eingetragen" },
    { vorlageId: standard.id, reihenfolge: 90, titel: "Änderungen an Folien eintragen", phase: "Vorbereitung", verantwortlichRolle: "trainer_lead", faelligOffsetTage: -3 },
    { vorlageId: standard.id, reihenfolge: 100, titel: "Teilnehmer-Feedback auswerten", phase: "Nachbereitung", verantwortlichRolle: "team", faelligOffsetTage: 3, linkFeld: "forms_feedback" },
    { vorlageId: standard.id, reihenfolge: 110, titel: "Follow-up-Mail mit Materialien an Kunde", phase: "Nachbereitung", verantwortlichRolle: "team", faelligOffsetTage: 3 },
    { vorlageId: standard.id, reihenfolge: 120, titel: "Bei Ansprechperson nachfragen, ob alles gepasst hat", phase: "Nachbereitung", verantwortlichRolle: "team", faelligOffsetTage: 7 },
    { vorlageId: standard.id, reihenfolge: 130, titel: "Rechnung stellen", phase: "Nachbereitung", verantwortlichRolle: "team", faelligOffsetTage: 7 },
    { vorlageId: lehrlinge.id, reihenfolge: 65, titel: "Einverständniserklärungen der Erziehungsberechtigten einholen", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -14 },
    { vorlageId: lehrlinge.id, reihenfolge: 75, titel: "Ausbilder:innen über Ablauf informieren", phase: "Vorbereitung", verantwortlichRolle: "team", faelligOffsetTage: -7 },
  ]);

  // --- Workshops --------------------------------------------------------
  interface SeedWorkshop {
    daten: Omit<NeuerWorkshop, "unternehmenId"> & { firma: string };
    module?: string[];
    trainer?: { id: number; rolle: "lead" | "co"; status: ZuweisungStatus }[];
    // Tasks due before now are ticked off — except these (deliberate gaps).
    offenLassen?: string[];
    feedbackVon?: number;
    archiviert?: boolean;
  }

  const seedWorkshops: SeedWorkshop[] = [
    {
      daten: {
        firma: "Alpenland Maschinenbau GmbH", name: "KI-Grundlagen für Lehrlinge",
        ansprechperson: "Max Mustermann", type: "Lehrlinge", format: "dbrains academy",
        modus: "VOR ORT", ort: "Werk Steyr, Schulungsraum 2", status: "Vorbereitung",
        verantwortlichInternId: romana.id, termin1: inTagen(9), termin2: inTagen(23),
        wsBetrag: "2500.00", sharepointUrl: sharepoint("Kunden/Alpenland"),
        formsVorabUrl: "https://forms.office.com/r/vorab-alpenland",
        interneNotizen: "24 Lehrlinge — Kunde überlegt, die Gruppe zu teilen.",
      },
      module: ["KI-Grundlagen", "Prompting"],
      trainer: [
        { id: anna.id, rolle: "lead", status: "bestaetigt" },
        { id: romanaTrainer.id, rolle: "co", status: "bestaetigt" },
      ],
      offenLassen: ["Vorab-Fragebogen"],
    },
    {
      daten: {
        firma: "Energie OÖ AG", name: "KI im Kundenservice — Pilotworkshop",
        ansprechperson: "Herbert Aigner", type: "Maßgeschneiderter Workshop",
        format: "dbrains academy", modus: "VOR ORT", ort: "Linz, Böhmerwaldstraße 3",
        status: "Vorbereitung", verantwortlichInternId: martin.id, termin1: inTagen(5),
        wsBetrag: "5200.00", sharepointUrl: sharepoint("Kunden/Energie-OOE"),
        interneNotizen: "Vorstand will bei der Ergebnispräsentation dabei sein — Folien unbedingt auf Deutsch.",
      },
      module: ["KI-Grundlagen", "Copilot in Outlook & Teams"],
      // Deliberately without trainer → visible gap on the dashboard.
    },
    {
      daten: {
        firma: "HTL Wels", name: "Prompt Engineering für Maturaklassen",
        ansprechperson: "Prof. Kerschbaum", type: "Schule", format: "dbrains x Land OÖ",
        modus: "ONLINE", status: "Vorbereitung", verantwortlichInternId: romana.id,
        termin1: inTagen(16), wsBetrag: "1800.00",
        verwendetesSlidedeck: sharepoint("Kunden/HTL-Wels/Prompting-Matura.pptx"),
        formsVorabUrl: "https://forms.office.com/r/vorab-htl",
      },
      module: ["Prompting"],
      trainer: [{ id: thomas.id, rolle: "lead", status: "bestaetigt" }],
    },
    {
      daten: {
        firma: "TechnoWerk Linz GmbH", name: "Agentic AI Deep Dive",
        ansprechperson: "Dr. Petra Lang", type: "Agentic AI", format: "dbrains x SCCH",
        modus: "ONLINE", status: "Angebot", verantwortlichInternId: leon.id,
        termin1: inTagen(30), wsBetrag: "4800.00",
      },
      module: ["Agentic AI Basics"],
      // Pending request → trainer sees "Zusagen / Absagen".
      trainer: [{ id: anna.id, rolle: "lead", status: "angefragt" }],
    },
    {
      daten: {
        firma: "Kanzlei Mayr & Partner", name: "KI in der Rechtsberatung — Keynote",
        ansprechperson: "Dr. Mayr", type: "Keynote", modus: "VOR ORT", ort: "Wien, Graben 12",
        status: "Angebot", verantwortlichInternId: null, termin1: inTagen(45), wsBetrag: "1500.00",
      },
      module: ["KI-Recht / AI Act"],
    },
    {
      daten: {
        firma: "Stadtgemeinde Traun", name: "KI-Werkzeuge in der Verwaltung",
        ansprechperson: "Mag. Hofstätter", type: "Beratung", modus: "Webex",
        status: "Vorabstimmung", verantwortlichInternId: romana.id,
      },
    },
    {
      daten: {
        firma: "VersicherungsPlus AG", name: "KI-Kompetenz für Führungskräfte",
        ansprechperson: "Mag. Doris Ecker", type: "Academy", format: "dbrains academy",
        modus: "VOR ORT", ort: "Linz, Zentrale", status: "Nachbereitung",
        verantwortlichInternId: romana.id, termin1: inTagen(-2), wsBetrag: "6400.00",
        rechnungStatus: "senden",
        verwendetesSlidedeck: sharepoint("Kunden/VersicherungsPlus/FK-Workshop.pptx"),
        formsFeedbackUrl: "https://forms.office.com/r/feedback-vplus",
      },
      module: ["KI-Grundlagen", "KI-Recht / AI Act"],
      trainer: [{ id: thomas.id, rolle: "lead", status: "bestaetigt" }],
      offenLassen: ["Teilnehmer-Feedback", "Follow-up"],
    },
    {
      daten: {
        firma: "Logistik Pichler GmbH", name: "Automatisierung im Backoffice",
        ansprechperson: "Eva Pichler", type: "Beratung", modus: "ONLINE",
        teamsMeetingUrl: "https://teams.microsoft.com/l/meetup-join/beispiel",
        status: "Nachbereitung", verantwortlichInternId: martin.id, termin1: inTagen(-12),
        wsBetrag: "3100.00", formsFeedbackUrl: "https://forms.office.com/r/feedback-pichler",
        verwendetesSlidedeck: sharepoint("Kunden/Pichler/Backoffice.pptx"),
      },
      module: ["Copilot in Outlook & Teams"],
      trainer: [{ id: anna.id, rolle: "lead", status: "bestaetigt" }],
      offenLassen: ["Rechnung"],
      feedbackVon: anna.id,
    },
    {
      daten: {
        firma: "Alpenland Maschinenbau GmbH", name: "KI-Einführung Produktionsteam",
        type: "Maßgeschneiderter Workshop", modus: "VOR ORT", status: "Done",
        verantwortlichInternId: romana.id, termin1: inTagen(-40), wsBetrag: "4100.00",
        rechnungStatus: "gesendet", trainerRe: "überwiesen",
        verwendetesSlidedeck: sharepoint("Kunden/Alpenland/Produktion.pptx"),
      },
      module: ["KI-Grundlagen"],
      trainer: [{ id: leonTrainer.id, rolle: "lead", status: "bestaetigt" }],
    },
    {
      daten: {
        firma: "Bäckerei Wimmer", name: "Social-Media-Content mit KI",
        type: "Ideation", status: "On-Hold", verantwortlichInternId: martin.id,
        termin1: inTagen(60),
      },
    },
    {
      daten: {
        firma: "TechnoWerk Linz GmbH", name: "Agentic AI Grundlagen 2025",
        type: "Agentic AI", status: "Done", termin1: inTagen(-300), wsBetrag: "4900.00",
        rechnungStatus: "gesendet", trainerRe: "überwiesen",
      },
      archiviert: true,
    },
  ];

  const idNach = new Map<string, number>();
  for (const eintrag of seedWorkshops) {
    const { firma, ...werte } = eintrag.daten;
    // Seed dates are full days 09:00–17:00 like the form default.
    const bis17 = (d: Date | null | undefined) => {
      if (!d) return null;
      const ende = new Date(d);
      ende.setHours(17, 0, 0, 0);
      return ende;
    };
    werte.termin1Ende = bis17(werte.termin1);
    werte.termin2Ende = bis17(werte.termin2);
    const [neu] = await db
      .insert(workshop)
      .values({ ...werte, unternehmenId: kundeNach.get(firma)! })
      .returning();
    idNach.set(neu.name, neu.id);

    if (eintrag.module?.length) {
      await db
        .insert(workshopModul)
        .values(eintrag.module.map((m) => ({ workshopId: neu.id, modulId: modulNach.get(m)! })));
    }
    for (const t of eintrag.trainer ?? []) {
      await db.insert(zuweisung).values({ workshopId: neu.id, trainerId: t.id, rolle: t.rolle, status: t.status });
    }
    if (eintrag.archiviert) {
      await db.update(workshop).set({ archiviertAm: jetzt }).where(eq(workshop.id, neu.id));
      continue;
    }

    // Run the real automation: checklist, calendar, trainer mails.
    await nachWorkshopAenderung(neu.id, null, jetzt);

    // Pretend the team did its job so far — apart from the deliberate gaps.
    const faellige = await db
      .select({ id: checkpunkt.id, titel: checkpunktVorlage.titel })
      .from(checkpunkt)
      .innerJoin(checkpunktVorlage, eq(checkpunkt.vorlagePunktId, checkpunktVorlage.id))
      .where(
        and(
          eq(checkpunkt.workshopId, neu.id),
          eq(checkpunkt.status, "offen"),
          isNotNull(checkpunkt.faelligAm),
          lt(checkpunkt.faelligAm, neu.status === "Done" ? inTagen(365) : inTagen(0, 0)),
        ),
      );
    const erledigen = faellige
      .filter((p) => !(eintrag.offenLassen ?? []).some((prefix) => p.titel.startsWith(prefix)))
      .map((p) => p.id);
    if (erledigen.length > 0) {
      await db
        .update(checkpunkt)
        .set({ status: "erledigt", erledigtVia: "manuell", erledigtVonId: romana.id, erledigtAm: jetzt })
        .where(inArray(checkpunkt.id, erledigen));
    }

    if (eintrag.feedbackVon) {
      await db.insert(trainerFeedback).values({
        workshopId: neu.id,
        trainerId: eintrag.feedbackVon,
        abwicklungNote: 5,
        abwicklungText: "Alles top organisiert, Infos kamen rechtzeitig.",
        verlaufNote: 4,
        verlaufText: "Gruppe sehr interessiert, viele Fragen zu Datenschutz.",
        sonstiges: "Beamer im Raum war etwas schwach.",
      });
    }
  }

  // Past workshops: their trainers got the info package back then.
  const vergangene = await db
    .select({ id: workshop.id })
    .from(workshop)
    .where(lt(workshop.termin1, jetzt));
  await db
    .update(zuweisung)
    .set({ infomailGesendetAm: inTagen(-50) })
    .where(
      and(
        eq(zuweisung.status, "bestaetigt"),
        inArray(zuweisung.workshopId, vergangene.map((v) => v.id)),
      ),
    );

  // --- Change-Log ----------------------------------------------------------
  const pichler = idNach.get("Automatisierung im Backoffice")!;
  const vplus = idNach.get("KI-Kompetenz für Führungskräfte")!;
  const alpenlandAlt = idNach.get("KI-Einführung Produktionsteam")!;
  await db
    .insert(vorschlag)
    .values([
      { workshopId: pichler, modulId: modulNach.get("Copilot in Outlook & Teams")!, text: "Folie 14: Screenshot zeigt noch das alte Copilot-Menü — neu aufnehmen.", erstelltVonId: annaNutzer.id },
      { workshopId: pichler, modulId: null, text: "Kundenbeispiel Lieferschein-Erkennung hat super funktioniert — für ähnliche Kunden merken.", erstelltVonId: annaNutzer.id },
      { workshopId: vplus, modulId: modulNach.get("KI-Recht / AI Act")!, text: "AI-Act-Fristen aktualisieren (Stand Q3).", erstelltVonId: thomasNutzer.id },
      { workshopId: alpenlandAlt, modulId: modulNach.get("KI-Grundlagen")!, text: "Übung „Halluzinationen erkennen“ dauert länger als geplant — 10 Minuten mehr einplanen.", erstelltVonId: leon.id, status: "umgesetzt", statusGeaendertAm: inTagen(-20), statusGeaendertVonId: leon.id },
    ]);
  await db.insert(aenderung).values([
    { workshopId: idNach.get("KI-Grundlagen für Lehrlinge")!, modulId: modulNach.get("KI-Grundlagen")!, text: "Übung „Halluzinationen erkennen“ auf 25 Minuten verlängert, Agenda angepasst.", erstelltVonId: annaNutzer.id, vorschlagId: null },
    { workshopId: idNach.get("Prompt Engineering für Maturaklassen")!, modulId: null, text: "Beispiele auf Maturathemen (Deutsch, Geschichte) umgestellt.", erstelltVonId: thomasNutzer.id },
  ]);

  // --- Wiederkehrende Erinnerungen ------------------------------------------
  await db.insert(wiederkehrendeErinnerung).values([
    {
      titel: "Trainer-Feedbackrunde terminieren und Einladung verschicken",
      rhythmus: "monatlich_erster_montag",
      naechsteFaelligkeit: ersterMontagNaechsterMonat(),
      empfaengerId: leon.id,
      link: "http://localhost:3000/change-log",
      notiz: "Agenda: offene Vorschläge im Change-Log",
    },
    {
      titel: "Microsoft-Secret der Hub-App erneuern",
      rhythmus: "jaehrlich",
      naechsteFaelligkeit: inTagen(330),
      empfaengerId: leon.id,
      notiz: "Läuft nach spätestens 24 Monaten ab — Erneuerung in Entra, dann im Server eintragen.",
    },
  ]);

  return "seeded";
}
