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
  composeFn: () => Promise<GeneSummary>,
  options: { refresh?: boolean } = {}
): Promise<GeneSummary> {
  const key = `gene:${symbol.toUpperCase()}:summary:v5`;
  const now = new Date();

  // Check cache
  const cached = options.refresh ? [] : await db
    .select()
    .from(geneSummaries)
    .where(eq(geneSummaries.key, key))
    .limit(1);

  if (cached.length > 0 && cached[0]!.expiresAt > now) {
    const summary = cached[0]!.data as GeneSummary;
    if (Object.keys(summary.sourceVersions ?? {}).length > 0) return summary;
  }

  // Cache miss — compose from sources
  const summary = await composeFn();
  if (Object.keys(summary.sourceVersions).length === 0) return summary;

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
  composeFn: () => Promise<VariantSummary>,
  options: { coordinateId?: string; refresh?: boolean } = {}
): Promise<VariantSummary> {
  const key = `variant:${variantId}:${options.coordinateId ?? ""}:summary:v2`;
  const now = new Date();

  const cached = options.refresh ? [] : await db
    .select()
    .from(variantSummaries)
    .where(eq(variantSummaries.key, key))
    .limit(1);

  if (cached.length > 0 && cached[0]!.expiresAt > now) {
    const summary = cached[0]!.data as VariantSummary;
    if (summary.sourceStatus?.clinvar && summary.sourceStatus?.gnomad && !Object.values(summary.sourceStatus).some((source) => source.status === "unavailable")) return summary;
  }

  const summary = await composeFn();
  // Do not persist outages as evidence that a variant has no classification/frequency.
  if (!summary.sourceStatus || Object.values(summary.sourceStatus).some((source) => source.status === "unavailable")) return summary;

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
