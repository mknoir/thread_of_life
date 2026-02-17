import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Stores composed gene summaries (from ClinVar + gnomAD + ClinGen + GTEx).
 * NOT raw API responses — these are derived domain objects with stable fields.
 */
export const geneSummaries = pgTable("gene_summaries", {
  key: text("key").primaryKey(),
  symbol: text("symbol").notNull(),
  data: jsonb("data").notNull(),
  sourceVersions: jsonb("source_versions"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Stores composed variant summaries (from ClinVar + gnomAD).
 * Same principle: derived, stable, UI-facing shapes.
 */
export const variantSummaries = pgTable("variant_summaries", {
  key: text("key").primaryKey(),
  variantId: text("variant_id").notNull(),
  data: jsonb("data").notNull(),
  sourceVersions: jsonb("source_versions"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Caches search results for fast, deterministic search.
 * Pre-seeded with known genes + populated by user queries.
 */
export const searchCache = pgTable("search_cache", {
  query: text("query").primaryKey(),
  results: jsonb("results").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
});
