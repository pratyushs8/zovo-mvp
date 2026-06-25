ALTER TABLE "sessions" ADD COLUMN "intake_step" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "intake_answers" jsonb;
