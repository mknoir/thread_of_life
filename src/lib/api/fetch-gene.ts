import "server-only";

import { composeGeneSummary } from "./compose-gene";
import type { GeneSummary } from "../types/gene";

/**
 * Fetch gene data with cache-aside when DB is available.
 * Falls back to direct composition (real-time API calls) when cache/DB fails.
 */
export async function fetchGeneData(symbol: string): Promise<GeneSummary> {
  const upperSymbol = symbol.trim().toUpperCase();
  if (!upperSymbol) throw new Error("Invalid symbol");

  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("user:password")
  ) {
    try {
      const { getCachedGeneSummary } = await import("@/lib/cache");
      return await getCachedGeneSummary(upperSymbol, () =>
        composeGeneSummary(upperSymbol)
      );
    } catch {
      // DB/cache failed — fall back to direct composition (real-time APIs)
    }
  }

  return composeGeneSummary(upperSymbol);
}
