import "server-only";

import { eq } from "drizzle-orm";
import { db } from "./db";
import { geneSummaries, variantSummaries } from "./db/schema";
import type { GeneSummary } from "./types/gene";
import type { VariantSummary } from "./types/variant";

/** TTLs in milliseconds */
const TTL = {
  clinvar: 24 * 60 * 60 * 1000, // 24 hours
  gnomad: 30 * 24 * 60 * 60 * 1000, // 30 days
  clingen: 14 * 24 * 60 * 60 * 1000, // 14 days
  gtex: 30 * 24 * 60 * 60 * 1000, // 30 days
  /** Composite TTL for gene summaries — use the shortest source TTL */
  gene: 24 * 60 * 60 * 1000, // 24 hours (driven by ClinVar)
  /** Composite TTL for variant summaries */
  variant: 24 * 60 * 60 * 1000, // 24 hours (driven by ClinVar)
} as const;

/**
 * Cache-aside pattern for gene summaries.
 *
 * 1. Check gene_summaries (key + not expired)
 * 2. HIT: return cached summary
 * 3. MISS: call composeFn to fetch + compose from sources
 * 4. Store in gene_summaries with source_versions
 * 5. Return
 */
export async function getCachedGeneSummary(
  symbol: string,
  composeFn: () => Promise<GeneSummary>
): Promise<GeneSummary> {
  const key = `gene:${symbol.toUpperCase()}:summary:v5`;
  const now = new Date();

  // Check cache
  const cached = await db
    .select()
    .from(geneSummaries)
    .where(eq(geneSummaries.key, key))
    .limit(1);

  if (cached.length > 0 && cached[0]!.expiresAt > now) {
    return cached[0]!.data as GeneSummary;
  }

  // Cache miss — compose from sources
  const summary = await composeFn();

  // Store in cache
  const expiresAt = new Date(now.getTime() + TTL.gene);

  await db
    .insert(geneSummaries)
    .values({
      key,
      symbol: symbol.toUpperCase(),
      data: summary,
      sourceVersions: summary.sourceVersions,
      fetchedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: geneSummaries.key,
      set: {
        data: summary,
        sourceVersions: summary.sourceVersions,
        fetchedAt: now,
        expiresAt,
      },
    });

  return summary;
}

/**
 * Cache-aside pattern for variant summaries.
 */
export async function getCachedVariantSummary(
  variantId: string,
  composeFn: () => Promise<VariantSummary>
): Promise<VariantSummary> {
  const key = `variant:${variantId}:summary:v1`;
  const now = new Date();

  const cached = await db
    .select()
    .from(variantSummaries)
    .where(eq(variantSummaries.key, key))
    .limit(1);

  if (cached.length > 0 && cached[0]!.expiresAt > now) {
    return cached[0]!.data as VariantSummary;
  }

  const summary = await composeFn();

  const expiresAt = new Date(now.getTime() + TTL.variant);

  await db
    .insert(variantSummaries)
    .values({
      key,
      variantId,
      data: summary,
      sourceVersions: summary.sourceVersions,
      fetchedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: variantSummaries.key,
      set: {
        data: summary,
        sourceVersions: summary.sourceVersions,
        fetchedAt: now,
        expiresAt,
      },
    });

  return summary;
}
