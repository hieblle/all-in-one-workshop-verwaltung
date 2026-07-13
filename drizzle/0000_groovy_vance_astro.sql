CREATE TYPE "public"."auto_check_regel" AS ENUM('forms_vorab', 'forms_feedback', 'outlook_termin', 'sevdesk_re', 'teams_meeting');--> statement-breakpoint
CREATE TYPE "public"."checkpunkt_status" AS ENUM('offen', 'erledigt', 'uebersprungen');--> statement-breakpoint
CREATE TYPE "public"."erledigt_via" AS ENUM('manuell', 'auto');--> statement-breakpoint
CREATE TYPE "public"."verantwortlich_rolle" AS ENUM('team', 'trainer_lead', 'trainer_co');--> statement-breakpoint
CREATE TYPE "public"."nutzer_rolle" AS ENUM('admin', 'team', 'trainer');--> statement-breakpoint
CREATE TYPE "public"."rechnung_status" AS ENUM('warten', 'senden', 'gesendet');--> statement-breakpoint
CREATE TYPE "public"."trainer_re_status" AS ENUM('offen', 'überwiesen');--> statement-breakpoint
CREATE TYPE "public"."workshop_format" AS ENUM('dbrains academy', 'dbrains x SCCH', 'dbrains x FB', 'dbrains x Land OÖ');--> statement-breakpoint
CREATE TYPE "public"."workshop_modus" AS ENUM('ONLINE', 'VOR ORT', 'SCCH', 'Webex');--> statement-breakpoint
CREATE TYPE "public"."workshop_status" AS ENUM('Vorabstimmung', 'Angebot', 'Vorbereitung', 'Durchführung', 'Nachbereitung', 'On-Hold/Abgesagt', 'Done');--> statement-breakpoint
CREATE TYPE "public"."workshop_type" AS ENUM('Lehrlinge', 'Beratung', 'Maßgeschneiderter Workshop', 'Agentic AI', 'Schule', 'Academy', 'Ideation', 'Keynote');--> statement-breakpoint
CREATE TYPE "public"."zuweisung_rolle" AS ENUM('lead', 'co', 'uebergabe_extern');--> statement-breakpoint
CREATE TYPE "public"."zuweisung_status" AS ENUM('angefragt', 'bestaetigt', 'abgesagt');--> statement-breakpoint
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
	"vorlage_punkt_id" integer NOT NULL,
	"verantwortlich_user_id" integer,
	"faellig_am" timestamp with time zone,
	"status" "checkpunkt_status" DEFAULT 'offen' NOT NULL,
	"erledigt_via" "erledigt_via",
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
	"auto_check_regel" "auto_check_regel"
);
--> statement-breakpoint
CREATE TABLE "kunde" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kunde_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"firma" text NOT NULL,
	"hubspot_id" text,
	"sevdesk_id" text,
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
	"verfuegbarkeit_notiz" text,
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
	"status" "workshop_status" DEFAULT 'Vorabstimmung' NOT NULL,
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
	"infomail_gesendet_am" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_kommentar" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "thread_kommentar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workshop_id" integer NOT NULL,
	"autor_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD CONSTRAINT "checkpunkt_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD CONSTRAINT "checkpunkt_vorlage_punkt_id_checkpunkt_vorlage_id_fk" FOREIGN KEY ("vorlage_punkt_id") REFERENCES "public"."checkpunkt_vorlage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD CONSTRAINT "checkpunkt_verantwortlich_user_id_nutzer_id_fk" FOREIGN KEY ("verantwortlich_user_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpunkt_vorlage" ADD CONSTRAINT "checkpunkt_vorlage_vorlage_id_checklisten_vorlage_id_fk" FOREIGN KEY ("vorlage_id") REFERENCES "public"."checklisten_vorlage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer" ADD CONSTRAINT "trainer_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop" ADD CONSTRAINT "workshop_unternehmen_id_kunde_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."kunde"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuweisung" ADD CONSTRAINT "zuweisung_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuweisung" ADD CONSTRAINT "zuweisung_trainer_id_trainer_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_kommentar" ADD CONSTRAINT "thread_kommentar_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_kommentar" ADD CONSTRAINT "thread_kommentar_autor_id_nutzer_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkpunkt_workshop_vorlage_punkt_unique" ON "checkpunkt" USING btree ("workshop_id","vorlage_punkt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zuweisung_workshop_trainer_unique" ON "zuweisung" USING btree ("workshop_id","trainer_id");