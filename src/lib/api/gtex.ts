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
    const gencodeId = await resolveGencodeId(symbol);
    if (!gencodeId) return [];
    const expressions = await fetchExpressionWithVersionFallback(gencodeId);

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

async function resolveGencodeId(symbol: string): Promise<string | null> {
  try {
    const url = `${GTEX_API}/reference/geneSearch?geneId=${encodeURIComponent(symbol.toUpperCase())}&genomeBuild=GRCh38%2Fhg38&page=0&itemsPerPage=1`;
    const res = await fetch(url, {
      next: { revalidate: 2592000 }, // 30 days
    });
    if (!res.ok) return null;

    const data = await res.json();
    const first = data?.data?.[0];
    const gencodeId = first?.gencodeId;
    return typeof gencodeId === "string" && gencodeId.length > 0
      ? gencodeId
      : null;
  } catch {
    return null;
  }
}

async function fetchExpressionWithVersionFallback(
  gencodeId: string
): Promise<Array<{ tissueSiteDetailId: string; median: number }>> {
  const candidates = buildGencodeCandidates(gencodeId);

  for (const candidate of candidates) {
    const data = await fetchMedianExpression(candidate);
    if (data.length > 0) {
      return data;
    }
  }

  return [];
}

function buildGencodeCandidates(gencodeId: string): string[] {
  const [base, versionRaw] = gencodeId.split(".");
  const version = Number(versionRaw);

  if (!base || Number.isNaN(version)) {
    return [gencodeId];
  }

  const candidates = [gencodeId];

  // GTEx v10 can lag newer GENCODE versions returned by reference APIs.
  // Probe a small nearby version window to recover expression data.
  for (let delta = 1; delta <= 8; delta += 1) {
    candidates.push(`${base}.${version + delta}`);
  }
  for (let delta = 1; delta <= 3; delta += 1) {
    const v = version - delta;
    if (v > 0) candidates.push(`${base}.${v}`);
  }

  return candidates;
}

async function fetchMedianExpression(
  gencodeId: string
): Promise<Array<{ tissueSiteDetailId: string; median: number }>> {
  const url = `${GTEX_API}/expression/medianGeneExpression?gencodeId=${encodeURIComponent(gencodeId)}&datasetId=gtex_v10&page=0&itemsPerPage=250`;
  const res = await fetch(url, {
    next: { revalidate: 2592000 }, // 30 days
  });

  if (!res.ok) return [];

  const data = await res.json();
  const expressions = data?.data ?? [];
  if (!Array.isArray(expressions)) return [];

  return expressions.filter(
    (e: { tissueSiteDetailId?: string; median?: number }) =>
      typeof e.tissueSiteDetailId === "string" && typeof e.median === "number"
  );
}

/**
 * Convert GTEx tissue IDs to readable names.
 */
function formatTissueName(tissueSiteDetailId: string): string {
  return tissueSiteDetailId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
