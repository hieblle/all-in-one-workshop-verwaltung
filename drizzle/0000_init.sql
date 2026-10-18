CREATE TYPE "public"."vorschlag_status" AS ENUM('offen', 'umgesetzt', 'verworfen');--> statement-breakpoint
CREATE TYPE "public"."auto_check_regel" AS ENUM('termin_eingetragen', 'trainer_zugewiesen', 'praesentation_eingetragen', 'angebot_angenommen');--> statement-breakpoint
CREATE TYPE "public"."checkpunkt_status" AS ENUM('offen', 'erledigt', 'uebersprungen');--> statement-breakpoint
CREATE TYPE "public"."erledigt_via" AS ENUM('manuell', 'auto');--> statement-breakpoint
CREATE TYPE "public"."link_feld" AS ENUM('forms_vorab', 'forms_feedback', 'notion');--> statement-breakpoint
CREATE TYPE "public"."nur_modus" AS ENUM('online', 'praesenz');--> statement-breakpoint
CREATE TYPE "public"."verantwortlich_rolle" AS ENUM('team', 'trainer_lead', 'trainer_co');--> statement-breakpoint
CREATE TYPE "public"."nutzer_rolle" AS ENUM('admin', 'team', 'trainer');--> statement-breakpoint
CREATE TYPE "public"."rechnung_status" AS ENUM('warten', 'senden', 'gesendet');--> statement-breakpoint
CREATE TYPE "public"."trainer_re_status" AS ENUM('offen', 'überwiesen');--> statement-breakpoint
CREATE TYPE "public"."workshop_format" AS ENUM('dbrains academy', 'dbrains x SCCH', 'dbrains x FB', 'dbrains x Land OÖ');--> statement-breakpoint
CREATE TYPE "public"."workshop_modus" AS ENUM('ONLINE', 'VOR ORT', 'SCCH', 'Webex');--> statement-breakpoint
CREATE TYPE "public"."workshop_status" AS ENUM('Vorabstimmung', 'Angebot', 'Vorbereitung', 'Durchführung', 'Nachbereitung', 'Done', 'On-Hold', 'Abgesagt');--> statement-breakpoint
CREATE TYPE "public"."workshop_type" AS ENUM('Lehrlinge', 'Beratung', 'Maßgeschneiderter Workshop', 'Agentic AI', 'Schule', 'Academy', 'Ideation', 'Keynote');--> statement-breakpoint
CREATE TYPE "public"."zuweisung_rolle" AS ENUM('lead', 'co', 'uebergabe_extern');--> statement-breakpoint
CREATE TYPE "public"."zuweisung_status" AS ENUM('angefragt', 'bestaetigt', 'abgesagt');--> statement-breakpoint
CREATE TYPE "public"."kalender_eintrag_status" AS ENUM('vorlaeufig', 'fixiert', 'on_hold', 'abgesagt');--> statement-breakpoint
CREATE TYPE "public"."kalender_termin_art" AS ENUM('termin1', 'termin2', 'fup');--> statement-breakpoint
CREATE TYPE "public"."postausgang_art" AS ENUM('mail', 'kalender');--> statement-breakpoint
CREATE TYPE "public"."postausgang_status" AS ENUM('vorschau', 'entwurf', 'gesendet', 'fehlgeschlagen', 'blockiert');--> statement-breakpoint
CREATE TYPE "public"."rhythmus" AS ENUM('woechentlich', 'monatlich', 'monatlich_erster_montag', 'quartalsweise', 'jaehrlich');--> statement-breakpoint
CREATE TABLE "aenderung" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "aenderung_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workshop_id" integer NOT NULL,
	"modul_id" integer,
	"vorschlag_id" integer,
	"text" text NOT NULL,
	"erstellt_von_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainer_feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trainer_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workshop_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"abwicklung_note" integer,
	"abwicklung_text" text,
	"verlauf_note" integer,
	"verlauf_text" text,
	"sonstiges" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vorschlag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vorschlag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workshop_id" integer NOT NULL,
	"modul_id" integer,
	"text" text NOT NULL,
	"status" "vorschlag_status" DEFAULT 'offen' NOT NULL,
	"erstellt_von_id" integer NOT NULL,
	"status_geaendert_von_id" integer,
	"status_geaendert_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklisten_vorlage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checklisten_vorlage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"gilt_fuer_type" "workshop_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkpunkt" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checkpunkt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workshop_id" integer NOT NULL,
	"vorlage_punkt_id" integer,
	"system_schluessel" text,
	"titel" text,
	"phase" "workshop_status",
	"verantwortlich_user_id" integer,
	"faellig_am" timestamp with time zone,
	"status" "checkpunkt_status" DEFAULT 'offen' NOT NULL,
	"erledigt_via" "erledigt_via",
	"erledigt_von_id" integer,
	"erledigt_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkpunkt_vorlage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checkpunkt_vorlage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vorlage_id" integer NOT NULL,
	"titel" text NOT NULL,
	"phase" "workshop_status" NOT NULL,
	"verantwortlich_rolle" "verantwortlich_rolle" DEFAULT 'team' NOT NULL,
	"faellig_offset_tage" integer DEFAULT 0 NOT NULL,
	"auto_check_regel" "auto_check_regel",
	"nur_modus" "nur_modus",
	"link_feld" "link_feld",
	"reihenfolge" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kunde" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kunde_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"firma" text NOT NULL,
	"hubspot_id" text,
	"sevdesk_id" text,
	"archiviert_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutzer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nutzer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"rolle" "nutzer_rolle" NOT NULL,
	"entra_oid" text,
	"magic_link_token" text,
	"magic_link_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nutzer_email_unique" UNIQUE("email"),
	CONSTRAINT "nutzer_entra_oid_unique" UNIQUE("entra_oid"),
	CONSTRAINT "nutzer_magic_link_token_unique" UNIQUE("magic_link_token"),
	CONSTRAINT "nutzer_email_lowercase" CHECK ("nutzer"."email" = lower("nutzer"."email"))
);
--> statement-breakpoint
CREATE TABLE "trainer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trainer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"extern" boolean DEFAULT true NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"nutzer_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trainer_email_unique" UNIQUE("email"),
	CONSTRAINT "trainer_nutzer_id_unique" UNIQUE("nutzer_id"),
	CONSTRAINT "trainer_email_lowercase" CHECK ("trainer"."email" = lower("trainer"."email"))
);
--> statement-breakpoint
CREATE TABLE "workshop" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workshop_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"unternehmen_id" integer NOT NULL,
	"ansprechperson" text,
	"type" "workshop_type" NOT NULL,
	"format" "workshop_format",
	"modus" "workshop_modus",
	"ort" text,
	"status" "workshop_status" DEFAULT 'Vorabstimmung' NOT NULL,
	"verantwortlich_intern_id" integer,
	"termin_1" timestamp with time zone,
	"termin_2" timestamp with time zone,
	"termin_fup" timestamp with time zone,
	"ws_betrag" numeric(10, 2),
	"rechnung_status" "rechnung_status" DEFAULT 'warten' NOT NULL,
	"trainer_re" "trainer_re_status" DEFAULT 'offen' NOT NULL,
	"sharepoint_url" text,
	"notion_project_url" text,
	"forms_vorab_url" text,
	"forms_feedback_url" text,
	"sevdesk_id" text,
	"teams_meeting_url" text,
	"verwendetes_slidedeck" text,
	"interne_notizen" text,
	"archiviert_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zuweisung" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zuweisung_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workshop_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"rolle" "zuweisung_rolle" DEFAULT 'lead' NOT NULL,
	"status" "zuweisung_status" DEFAULT 'angefragt' NOT NULL,
	"anfrage_gesendet_am" timestamp with time zone,
	"infomail_gesendet_am" timestamp with time zone,
	"feedback_erinnerung_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modul" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "modul_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"sharepoint_url" text,
	"beschreibung" text,
	"archiviert_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_modul" (
	"workshop_id" integer NOT NULL,
	"modul_id" integer NOT NULL,
	CONSTRAINT "workshop_modul_workshop_id_modul_id_pk" PRIMARY KEY("workshop_id","modul_id")
);
--> statement-breakpoint
CREATE TABLE "einstellung" (
	"schluessel" text PRIMARY KEY NOT NULL,
	"wert" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_lauf" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_lauf_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"job" text NOT NULL,
	"erfolg" boolean NOT NULL,
	"meldung" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kalender_eintrag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kalender_eintrag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workshop_id" integer NOT NULL,
	"termin_art" "kalender_termin_art" NOT NULL,
	"externe_id" text,
	"status" "kalender_eintrag_status" NOT NULL,
	"fingerabdruck" text NOT NULL,
	"teams_meeting_angefordert" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "postausgang" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "postausgang_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"art" "postausgang_art" NOT NULL,
	"anlass" text NOT NULL,
	"empfaenger" text NOT NULL,
	"betreff" text NOT NULL,
	"text" text NOT NULL,
	"kalender" jsonb,
	"workshop_id" integer,
	"status" "postausgang_status" NOT NULL,
	"fehler" text,
	"dedupe_key" text,
	"erzeugt_fuer" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verlauf" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "verlauf_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entitaet" text NOT NULL,
	"entitaet_id" integer NOT NULL,
	"workshop_id" integer,
	"feld" text NOT NULL,
	"alt" text,
	"neu" text,
	"nutzer_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiederkehrende_erinnerung" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wiederkehrende_erinnerung_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"titel" text NOT NULL,
	"rhythmus" "rhythmus" NOT NULL,
	"naechste_faelligkeit" timestamp with time zone NOT NULL,
	"empfaenger_id" integer NOT NULL,
	"link" text,
	"notiz" text,
	"aktiv" boolean DEFAULT true NOT NULL,
	"zuletzt_erledigt_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aenderung" ADD CONSTRAINT "aenderung_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aenderung" ADD CONSTRAINT "aenderung_modul_id_modul_id_fk" FOREIGN KEY ("modul_id") REFERENCES "public"."modul"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aenderung" ADD CONSTRAINT "aenderung_vorschlag_id_vorschlag_id_fk" FOREIGN KEY ("vorschlag_id") REFERENCES "public"."vorschlag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aenderung" ADD CONSTRAINT "aenderung_erstellt_von_id_nutzer_id_fk" FOREIGN KEY ("erstellt_von_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_feedback" ADD CONSTRAINT "trainer_feedback_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_feedback" ADD CONSTRAINT "trainer_feedback_trainer_id_trainer_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vorschlag" ADD CONSTRAINT "vorschlag_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vorschlag" ADD CONSTRAINT "vorschlag_modul_id_modul_id_fk" FOREIGN KEY ("modul_id") REFERENCES "public"."modul"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vorschlag" ADD CONSTRAINT "vorschlag_erstellt_von_id_nutzer_id_fk" FOREIGN KEY ("erstellt_von_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vorschlag" ADD CONSTRAINT "vorschlag_status_geaendert_von_id_nutzer_id_fk" FOREIGN KEY ("status_geaendert_von_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD CONSTRAINT "checkpunkt_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD CONSTRAINT "checkpunkt_vorlage_punkt_id_checkpunkt_vorlage_id_fk" FOREIGN KEY ("vorlage_punkt_id") REFERENCES "public"."checkpunkt_vorlage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD CONSTRAINT "checkpunkt_verantwortlich_user_id_nutzer_id_fk" FOREIGN KEY ("verantwortlich_user_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD CONSTRAINT "checkpunkt_erledigt_von_id_nutzer_id_fk" FOREIGN KEY ("erledigt_von_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt_vorlage" ADD CONSTRAINT "checkpunkt_vorlage_vorlage_id_checklisten_vorlage_id_fk" FOREIGN KEY ("vorlage_id") REFERENCES "public"."checklisten_vorlage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer" ADD CONSTRAINT "trainer_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop" ADD CONSTRAINT "workshop_unternehmen_id_kunde_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."kunde"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop" ADD CONSTRAINT "workshop_verantwortlich_intern_id_nutzer_id_fk" FOREIGN KEY ("verantwortlich_intern_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuweisung" ADD CONSTRAINT "zuweisung_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuweisung" ADD CONSTRAINT "zuweisung_trainer_id_trainer_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_modul" ADD CONSTRAINT "workshop_modul_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_modul" ADD CONSTRAINT "workshop_modul_modul_id_modul_id_fk" FOREIGN KEY ("modul_id") REFERENCES "public"."modul"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kalender_eintrag" ADD CONSTRAINT "kalender_eintrag_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postausgang" ADD CONSTRAINT "postausgang_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verlauf" ADD CONSTRAINT "verlauf_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiederkehrende_erinnerung" ADD CONSTRAINT "wiederkehrende_erinnerung_empfaenger_id_nutzer_id_fk" FOREIGN KEY ("empfaenger_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trainer_feedback_workshop_trainer_unique" ON "trainer_feedback" USING btree ("workshop_id","trainer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkpunkt_workshop_vorlage_punkt_unique" ON "checkpunkt" USING btree ("workshop_id","vorlage_punkt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkpunkt_workshop_system_schluessel_unique" ON "checkpunkt" USING btree ("workshop_id","system_schluessel");--> statement-breakpoint
CREATE UNIQUE INDEX "zuweisung_workshop_trainer_unique" ON "zuweisung" USING btree ("workshop_id","trainer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kalender_eintrag_workshop_art_unique" ON "kalender_eintrag" USING btree ("workshop_id","termin_art");--> statement-breakpoint
CREATE UNIQUE INDEX "postausgang_dedupe_unique" ON "postausgang" USING btree ("dedupe_key");