CREATE TABLE "actor_claims" (
	"actor_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"reach" integer DEFAULT 1 NOT NULL,
	"said_at" timestamp with time zone,
	CONSTRAINT "actor_claims_actor_id_analysis_id_pk" PRIMARY KEY("actor_id","analysis_id")
);
--> statement-breakpoint
CREATE TABLE "actor_dimension_scores" (
	"actor_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"value" real,
	"n" integer NOT NULL,
	"confidence" text,
	"rubric_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_dimension_scores_actor_id_dimension_pk" PRIMARY KEY("actor_id","dimension")
);
--> statement-breakpoint
CREATE TABLE "actor_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"body" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"home_place_id" text,
	"public_role" jsonb,
	"party_family" text,
	"verified_contact" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "admin_login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "alerts_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"input_kind" text NOT NULL,
	"input_lang" text,
	"grade" text,
	"confidence" text,
	"structured" jsonb,
	"models" jsonb,
	"provider" text,
	"prompt_version" text,
	"config_version_id" integer,
	"mirror_test" jsonb,
	"disagreement" boolean DEFAULT false NOT NULL,
	"human_reviewed" boolean DEFAULT false NOT NULL,
	"progress" jsonb,
	"error" text,
	"cost_usd" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "analysis_renderings" (
	"analysis_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"lang" text NOT NULL,
	"body" jsonb NOT NULL,
	"model" text,
	"prompt_version" text,
	"consistency_check" jsonb,
	"native_reviewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_renderings_analysis_id_version_lang_pk" PRIMARY KEY("analysis_id","version","lang")
);
--> statement-breakpoint
CREATE TABLE "analysis_sources" (
	"analysis_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	"quote" text,
	"quote_verified" boolean DEFAULT false NOT NULL,
	"stance" text NOT NULL,
	CONSTRAINT "analysis_sources_analysis_id_source_id_pk" PRIMARY KEY("analysis_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "analysis_verdicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"slot" text NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"grade" text,
	"confidence" text,
	"abstained" boolean DEFAULT false NOT NULL,
	"coi_excluded" boolean DEFAULT false NOT NULL,
	"shadow" boolean DEFAULT false NOT NULL,
	"reasoning" text,
	"sources" jsonb,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"searches" jsonb,
	"cost_usd" double precision,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"analysis_id" uuid,
	"stage" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reason" text NOT NULL,
	"decision" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip_hash" text
);
--> statement-breakpoint
CREATE TABLE "briefing_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"reviewed_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "claim_places" (
	"analysis_id" uuid NOT NULL,
	"place_id" text NOT NULL,
	"confidence" real NOT NULL,
	CONSTRAINT "claim_places_analysis_id_place_id_pk" PRIMARY KEY("analysis_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "claim_topics" (
	"analysis_id" uuid NOT NULL,
	"topic_id" text NOT NULL,
	"confidence" real NOT NULL,
	CONSTRAINT "claim_topics_analysis_id_topic_id_pk" PRIMARY KEY("analysis_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_text" text NOT NULL,
	"lang" text NOT NULL,
	"claim_type" text NOT NULL,
	"text_hash" text NOT NULL,
	"embedding" real[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	"config" jsonb NOT NULL,
	"status" text NOT NULL,
	"harness_check" jsonb,
	"eval_run_id" uuid,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"reason" jsonb NOT NULL,
	"diff" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edition_stories" (
	"edition_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"topic_id" text NOT NULL,
	"salience" real NOT NULL,
	"headline" jsonb NOT NULL,
	"perception_fact" jsonb,
	CONSTRAINT "edition_stories_edition_id_analysis_id_pk" PRIMARY KEY("edition_id","analysis_id")
);
--> statement-breakpoint
CREATE TABLE "error_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_version_id" integer,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"slot" text,
	"step" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"searches" jsonb,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"finish_reason" text,
	"error_class" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_daily" (
	"date" text NOT NULL,
	"metric" text NOT NULL,
	"dims" text DEFAULT '' NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "metrics_daily_date_metric_dims_pk" PRIMARY KEY("date","metric","dims")
);
--> statement-breakpoint
CREATE TABLE "model_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"type" text NOT NULL,
	"country" text,
	"lang" text,
	CONSTRAINT "outlets_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"level" text NOT NULL,
	"names" jsonb NOT NULL,
	"local_name" text,
	"timezone" text NOT NULL,
	"coverage_level" text NOT NULL,
	"has_edition" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"question" jsonb NOT NULL,
	"true_value" real NOT NULL,
	"margin" real NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"original_wording" text NOT NULL,
	"year" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_item_id" uuid NOT NULL,
	"guess" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_counters" (
	"key" text NOT NULL,
	"window_start" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_counters_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"due_at" timestamp with time zone,
	"notes" text,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"outlet_id" uuid,
	"tier" integer NOT NULL,
	"lang" text,
	"published_at" timestamp with time zone,
	"snapshot_key" text,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"channel" text NOT NULL,
	"push_endpoint_ciphertext" text,
	"lang" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"names" jsonb NOT NULL,
	"country_code" text,
	"taxonomy_version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"lang" text,
	"place_id" text,
	"topic_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_political_self_id" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"placement_ciphertext" text NOT NULL,
	"key_id" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"purpose" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"prefs_ciphertext" text NOT NULL,
	"key_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text NOT NULL,
	"email_hash" text,
	"auth_provider" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
ALTER TABLE "actor_claims" ADD CONSTRAINT "actor_claims_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actor_claims" ADD CONSTRAINT "actor_claims_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actor_dimension_scores" ADD CONSTRAINT "actor_dimension_scores_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actor_replies" ADD CONSTRAINT "actor_replies_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_renderings" ADD CONSTRAINT "analysis_renderings_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_sources" ADD CONSTRAINT "analysis_sources_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_sources" ADD CONSTRAINT "analysis_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_verdicts" ADD CONSTRAINT "analysis_verdicts_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_places" ADD CONSTRAINT "claim_places_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_topics" ADD CONSTRAINT "claim_topics_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_stories" ADD CONSTRAINT "edition_stories_edition_id_briefing_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."briefing_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_stories" ADD CONSTRAINT "edition_stories_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_reports" ADD CONSTRAINT "error_reports_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_quiz_item_id_quiz_items_id_fk" FOREIGN KEY ("quiz_item_id") REFERENCES "public"."quiz_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_political_self_id" ADD CONSTRAINT "user_political_self_id_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_attempts_ip_idx" ON "admin_login_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "analyses_status_idx" ON "analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "analyses_created_idx" ON "analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verdicts_analysis_idx" ON "analysis_verdicts" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "edition_place_date_idx" ON "briefing_editions" USING btree ("place_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_text_hash_idx" ON "claims" USING btree ("text_hash");--> statement-breakpoint
CREATE INDEX "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_events_at_idx" ON "usage_events" USING btree ("created_at");