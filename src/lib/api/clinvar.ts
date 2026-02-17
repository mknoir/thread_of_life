import "server-only";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

interface ClinvarGeneResult {
  totalVariants: number;
  pathogenic: number;
  likelyPathogenic: number;
  vus: number;
  benign: number;
  likelyBenign: number;
  conflicting: number;
}

interface ClinvarVariantResult {
  variationId: string;
  clinicalSignificance: string;
  reviewStatus: string;
  submissions: {
    submitter: string;
    classification: string;
    condition: string;
    reviewStatus: string;
    dateLastEvaluated: string | null;
    method: string;
  }[];
}

/**
 * Search ClinVar for variants associated with a gene symbol.
 * Uses NCBI E-utilities: esearch + esummary.
 */
export async function fetchClinvarGene(
  symbol: string
): Promise<ClinvarGeneResult | null> {
  try {
    // esearch to get count and IDs
    const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(symbol)}[gene]&retmax=0&retmode=json`;
    const searchRes = await fetch(searchUrl, { next: { revalidate: 86400 } });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const totalCount = parseInt(searchData?.esearchresult?.count ?? "0", 10);

    if (totalCount === 0) return null;

    // For classification breakdown, query by significance
    const classifications = await Promise.all([
      countClinvarBySignificance(symbol, "pathogenic"),
      countClinvarBySignificance(symbol, "likely_pathogenic"),
      countClinvarBySignificance(symbol, "uncertain_significance"),
      countClinvarBySignificance(symbol, "likely_benign"),
      countClinvarBySignificance(symbol, "benign"),
      countClinvarBySignificance(symbol, "conflicting_interpretations"),
    ]);

    return {
      totalVariants: totalCount,
      pathogenic: classifications[0],
      likelyPathogenic: classifications[1],
      vus: classifications[2],
      benign: classifications[4],
      likelyBenign: classifications[3],
      conflicting: classifications[5],
    };
  } catch (error) {
    console.error(`ClinVar fetch failed for gene ${symbol}:`, error);
    return null;
  }
}

async function countClinvarBySignificance(
  symbol: string,
  significance: string
): Promise<number> {
  try {
    const url = `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(symbol)}[gene]+AND+${significance}[clinical_significance]&retmax=0&retmode=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) return 0;

    const data = await res.json();
    return parseInt(data?.esearchresult?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

/**
 * Fetch a specific ClinVar variant by variation ID.
 */
export async function fetchClinvarVariant(
  variationId: string
): Promise<ClinvarVariantResult | null> {
  try {
    const url = `${EUTILS_BASE}/esummary.fcgi?db=clinvar&id=${variationId}&retmode=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.result;
    if (!result) return null;

    const uids = result.uids ?? [];
    if (uids.length === 0) return null;

    const record = result[uids[0]];
    if (!record) return null;

    return {
      variationId: uids[0],
      clinicalSignificance:
        record.clinical_significance?.description ?? "Unknown",
      reviewStatus: record.clinical_significance?.review_status ?? "Unknown",
      submissions: [], // Full submissions require efetch with XML parsing
    };
  } catch (error) {
    console.error(`ClinVar variant fetch failed for ${variationId}:`, error);
    return null;
  }
}

/**
 * Search ClinVar for variant IDs matching a query (gene symbol, rsID, etc.)
 */
export async function searchClinvar(
  query: string,
  maxResults = 10
): Promise<string[]> {
  try {
    const url = `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) return [];

    const data = await res.json();
    return data?.esearchresult?.idlist ?? [];
  } catch {
    return [];
  }
}
