ALTER TABLE "subscriptions" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_sent_at" timestamp with time zone;