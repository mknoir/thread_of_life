import "server-only";

import { composeVariantSummary } from "./compose-variant";
import type { VariantSummary } from "../types/variant";

/**
 * Fetch variant data with cache-aside when DB is available.
 * Falls back to direct composition (real-time API calls) when cache/DB fails.
 */
export async function fetchVariantData(id: string): Promise<VariantSummary> {
  const variantId = id.trim();
  if (!variantId) throw new Error("Invalid variant id");

  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("user:password")
  ) {
    try {
      const { getCachedVariantSummary } = await import("@/lib/cache");
      return await getCachedVariantSummary(variantId, () =>
        composeVariantSummary(variantId)
      );
    } catch {
      // DB/cache failed — fall back to direct composition (real-time APIs)
    }
  }

  return composeVariantSummary(variantId);
}
