CREATE TABLE "source_snapshots" (
	"hash" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"text" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
