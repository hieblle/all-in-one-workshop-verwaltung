import "dotenv/config";
import { db } from "./index";
import {
  checklistenVorlage,
  checkpunktVorlage,
  kunde,
  nutzer,
  trainer,
  workshop,
  zuweisung,
} from "./schema";

// Development/demo seed. Refuses to run on a non-empty database so it can
// never clobber real data. Real workshops arrive via the Notion import (Phase 1).
async function seed() {
  const vorhandene = await db.select({ id: nutzer.id }).from(nutzer).limit(1);
  if (vorhandene.length > 0) {
    console.log("Database already contains data — skipping seed.");
    return;
  }

  const [admin, , , trainerNutzer] = await db
    .insert(nutzer)
    .values([
      { name: "Leon", email: "leon@dbrains.academy", rolle: "admin" },
      { name: "Team Mitglied 1", email: "team1@dbrains.academy", rolle: "team" },
      { name: "Team Mitglied 2", email: "team2@dbrains.academy", rolle: "team" },
      { name: "Externe Trainerin", email: "trainerin@example.com", rolle: "trainer" },
    ])
    .returning();

  const [trainerExtern] = await db
    .insert(trainer)
    .values([
      {
        name: "Externe Trainerin",
        email: "trainerin@example.com",
        extern: true,
        nutzerId: trainerNutzer.id,
        verfuegbarkeitNotiz: "Di–Do verfügbar, Mo/Fr nur online",
      },
      {
        name: "Leon",
        email: "leon@dbrains.academy",
        extern: false,
        nutzerId: admin.id,
      },
    ])
    .returning();

  const [kundeA, kundeB] = await db
    .insert(kunde)
    .values([
      { firma: "Musterfirma GmbH" },
      { firma: "Beispiel AG" },
    ])
    .returning();

  const inDreissigTagen = new Date();
  inDreissigTagen.setDate(inDreissigTagen.getDate() + 30);

  const [ws1] = await db
    .insert(workshop)
    .values([
      {
        name: "KI-Grundlagen für Lehrlinge",
        unternehmenId: kundeA.id,
        ansprechperson: "Max Mustermann",
        type: "Lehrlinge",
        format: "dbrains academy",
        modus: "VOR ORT",
        status: "Vorbereitung",
        termin1: inDreissigTagen,
        wsBetrag: "2500.00",
      },
      {
        name: "Agentic AI Deep Dive",
        unternehmenId: kundeB.id,
        type: "Agentic AI",
        modus: "ONLINE",
        status: "Vorabstimmung",
      },
    ])
    .returning();

  await db.insert(zuweisung).values({
    workshopId: ws1.id,
    trainerId: trainerExtern.id,
    rolle: "lead",
    status: "bestaetigt",
  });

  const [vorlage] = await db
    .insert(checklistenVorlage)
    .values({ name: "Standard-Workshop", giltFuerType: null })
    .returning();

  await db.insert(checkpunktVorlage).values([
    {
      vorlageId: vorlage.id,
      titel: "Vorabstimmung mit Kunde dokumentieren",
      phase: "Vorabstimmung",
      verantwortlichRolle: "team",
      faelligOffsetTage: -30,
    },
    {
      vorlageId: vorlage.id,
      titel: "Angebot in SevDesk anlegen und versenden",
      phase: "Angebot",
      verantwortlichRolle: "team",
      faelligOffsetTage: -21,
      autoCheckRegel: "sevdesk_re",
    },
    {
      vorlageId: vorlage.id,
      titel: "Vorab-Fragebogen (MS Forms) an Teilnehmer senden",
      phase: "Vorbereitung",
      verantwortlichRolle: "team",
      faelligOffsetTage: -14,
      autoCheckRegel: "forms_vorab",
    },
    {
      vorlageId: vorlage.id,
      titel: "Agenda und Slidedeck finalisieren",
      phase: "Vorbereitung",
      verantwortlichRolle: "trainer_lead",
      faelligOffsetTage: -7,
    },
    {
      vorlageId: vorlage.id,
      titel: "Kalendereintrag für alle Beteiligten prüfen",
      phase: "Vorbereitung",
      verantwortlichRolle: "team",
      faelligOffsetTage: -7,
      autoCheckRegel: "outlook_termin",
    },
    {
      vorlageId: vorlage.id,
      titel: "Feedback-Formular versenden",
      phase: "Nachbereitung",
      verantwortlichRolle: "team",
      faelligOffsetTage: 1,
      autoCheckRegel: "forms_feedback",
    },
    {
      vorlageId: vorlage.id,
      titel: "Rechnung stellen",
      phase: "Nachbereitung",
      verantwortlichRolle: "team",
      faelligOffsetTage: 3,
      autoCheckRegel: "sevdesk_re",
    },
  ]);

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
