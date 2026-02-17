import "server-only";

const GTEX_API = "https://gtexportal.org/api/v2";

interface GTExExpression {
  tissue: string;
  tpm: number;
  rank: number;
}

/**
 * Fetch top expression tissues for a gene from GTEx.
 */
export async function fetchGtexExpression(
  symbol: string,
  topN = 10
): Promise<GTExExpression[]> {
  try {
    const url = `${GTEX_API}/expression/medianGeneExpression?gencodeId=&geneSymbol=${encodeURIComponent(symbol.toUpperCase())}&datasetId=gtex_v8`;
    const res = await fetch(url, {
      next: { revalidate: 2592000 }, // 30 days
    });

    if (!res.ok) return [];

    const data = await res.json();
    const expressions = data?.data ?? [];

    if (!Array.isArray(expressions) || expressions.length === 0) return [];

    // Sort by median TPM descending and take top N
    const sorted = expressions
      .filter(
        (e: { tissueSiteDetailId: string; median: number }) =>
          e.median !== undefined && e.median !== null
      )
      .sort(
        (a: { median: number }, b: { median: number }) => b.median - a.median
      )
      .slice(0, topN);

    return sorted.map(
      (
        e: { tissueSiteDetailId: string; median: number },
        index: number
      ) => ({
        tissue: formatTissueName(e.tissueSiteDetailId),
        tpm: e.median,
        rank: index + 1,
      })
    );
  } catch (error) {
    console.error(`GTEx fetch failed for gene ${symbol}:`, error);
    return [];
  }
}

/**
 * Convert GTEx tissue IDs to readable names.
 */
function formatTissueName(tissueSiteDetailId: string): string {
  return tissueSiteDetailId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
