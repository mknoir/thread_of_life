import "server-only";

import { composeGeneSummary } from "./compose-gene";
import type { GeneSummary } from "../types/gene";

/**
 * Fetch gene data with cache-aside when DB is available.
 * Falls back to direct composition (real-time API calls) when cache/DB fails.
 */
export async function fetchGeneData(symbol: string, options: { refresh?: boolean } = {}): Promise<GeneSummary> {
  const upperSymbol = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_.-]{0,39}$/.test(upperSymbol)) throw new Error("Invalid symbol");
  let composition: Promise<GeneSummary> | undefined;
  const compose = () => composition ??= composeGeneSummary(upperSymbol);

  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("user:password")
  ) {
    try {
      const { getCachedGeneSummary } = await import("@/lib/cache");
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          getCachedGeneSummary(upperSymbol, compose, options),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Gene cache timed out")), 1500); }),
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
