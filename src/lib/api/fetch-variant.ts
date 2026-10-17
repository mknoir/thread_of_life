import "server-only";

import { composeVariantSummary } from "./compose-variant";
import { parseVariantRequest } from "./variant-identifiers";
import type { VariantSummary } from "../types/variant";

/**
 * Fetch variant data with cache-aside when DB is available.
 * Falls back to direct composition (real-time API calls) when cache/DB fails.
 */
export async function fetchVariantData(id: string, options: { coordinateId?: string; refresh?: boolean } = {}): Promise<VariantSummary> {
  const selection = parseVariantRequest(id, options.coordinateId);
  if (!selection) throw new Error("Invalid variant identifier. Choose a numeric ClinVar ID or a specific GRCh38 allele.");
  const { variantId } = selection;
  // One composition promise survives a cache timeout or failed database write.
  let composition: Promise<VariantSummary> | undefined;
  const compose = () => composition ??= composeVariantSummary(variantId, selection.coordinate?.id);

  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("user:password")
  ) {
    try {
      const { getCachedVariantSummary } = await import("@/lib/cache");
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          getCachedVariantSummary(variantId, compose, { coordinateId: selection.coordinate?.id, refresh: options.refresh }),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Variant cache timed out")), 1500); }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // DB/cache failed — fall back to direct composition (real-time APIs)
    }
  }

  return compose();
}
