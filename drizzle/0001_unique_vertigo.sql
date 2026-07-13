ALTER TABLE "checkpunkt" ALTER COLUMN "vorlage_punkt_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD COLUMN "titel" text;--> statement-breakpoint
ALTER TABLE "checkpunkt" ADD COLUMN "phase" "workshop_status";--> statement-breakpoint
ALTER TABLE "workshop" ADD COLUMN "interne_notizen" text;