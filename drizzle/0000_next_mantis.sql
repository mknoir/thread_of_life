CREATE TABLE "gene_summaries" (
	"key" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"data" jsonb NOT NULL,
	"source_versions" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"query" text PRIMARY KEY NOT NULL,
	"results" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "variant_summaries" (
	"key" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"source_versions" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL
);
