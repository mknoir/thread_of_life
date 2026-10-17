import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { normalizeClinvarId, normalizedAllele } from "./variant-identifiers";
import type { VariantSourceResult } from "../types/variant";

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
  geneSymbols: string[];
  title?: string;
  chromosome?: string;
  position?: number;
  genomicAllele?: { chromosome: string; position: number; ref: string; alt: string };
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
 * Uses NCBI ESearch totals and documented classification property filters.
 */
export async function fetchClinvarGene(
  symbol: string
): Promise<ClinvarGeneResult | null> {
  try {
    const signal = AbortSignal.timeout(10000);
    // esearch to get count and IDs
    const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(symbol)}[gene]&retmax=0&retmode=json`;
    const searchRes = await fetch(searchUrl, { signal, next: { revalidate: 86400 } });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const totalCount = readSearchCount(searchData);

    // A successful zero-count query is evidence of zero records, not a fetch failure.
    if (totalCount === 0) return {
      totalVariants: 0, pathogenic: 0, likelyPathogenic: 0, vus: 0,
      benign: 0, likelyBenign: 0, conflicting: 0,
    };

    // Space this lookup's requests to avoid a seven-request burst against NCBI's
    // public three-requests-per-second limit. The shared deadline bounds all waits.
    const classifications: number[] = [];
    for (const significance of ["pathogenic", "likely pathogenic", "vus", "likely benign", "benign", "has conflicts"]) {
      await delay(350, undefined, { signal });
      classifications.push(await countClinvarBySignificance(symbol, significance, signal));
    }

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

/** Missing/malformed counts must never become evidence of zero observed records. */
function readSearchCount(data: { esearchresult?: { count?: unknown }; error?: unknown }): number {
  const raw = data?.esearchresult?.count;
  if (data?.error || (typeof raw !== "string" && typeof raw !== "number") || !/^\d+$/.test(String(raw))) {
    throw new Error("ClinVar returned no valid record count");
  }
  const count = Number(raw);
  if (!Number.isSafeInteger(count)) throw new Error("ClinVar returned an invalid record count");
  return count;
}

async function countClinvarBySignificance(
  symbol: string,
  significance: string,
  signal: AbortSignal
): Promise<number> {
  // NCBI's documented Properties filter avoids silently falling back to All Fields.
  // https://www.ncbi.nlm.nih.gov/clinvar/docs/properties/
  const term = `${symbol}[gene] AND "clinsig ${significance}"[Properties]`;
  const url = `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(term)}&retmax=0&retmode=json`;
  const res = await fetch(url, { signal, next: { revalidate: 86400 } });
  // Reject the whole breakdown on partial failure; its public type has no missing-category state.
  if (!res.ok) throw new Error(`ClinVar category query returned HTTP ${res.status}`);
  return readSearchCount(await res.json());
}

/**
 * Fetch a specific ClinVar variant by variation ID.
 */
export async function fetchClinvarVariant(
  variationId: string
): Promise<ClinvarVariantResult | null> {
  return (await fetchClinvarVariantEvidence(variationId)).data;
}

/** Unlike the compatibility wrapper, this preserves failure versus absent-record states. */
export async function fetchClinvarVariantEvidence(variationId: string): Promise<VariantSourceResult<ClinvarVariantResult>> {
  const requestedId = normalizeClinvarId(variationId);
  // ESummary accepts numeric ClinVar IDs, not rs IDs or chromosome-position alleles.
  if (!requestedId) return { status: "not_applicable", data: null, message: "ClinVar requires a numeric variation ID." };
  const sourceUrl = `https://www.ncbi.nlm.nih.gov/clinvar/variation/${requestedId}/`;
  try {
    const url = `${EUTILS_BASE}/esummary.fcgi?db=clinvar&id=${requestedId}&retmode=json`;
    const signal = AbortSignal.timeout(10000);
    let data;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, { signal, cache: "no-store" });
      if ((res.status === 429 || res.status === 503) && attempt === 0) {
        await delay(1000, undefined, { signal });
        continue;
      }
      if (!res.ok) throw new Error(`ClinVar returned HTTP ${res.status}.`);
      data = await res.json();
      if (data?.error && /rate|limit/i.test(String(data.error)) && attempt === 0) {
        await delay(1000, undefined, { signal });
        continue;
      }
      break;
    }
    if (data?.error) throw new Error(`ClinVar: ${String(data.error).slice(0, 200)}`);
    const result = data?.result;
    if (!result || !Array.isArray(result.uids)) throw new Error("ClinVar returned an unreadable summary response.");

    const uids = result.uids ?? [];
    if (!uids.includes(requestedId)) return { status: "not_found", data: null, url: sourceUrl, message: "ClinVar returned no matching variation record." };

    const record = result[requestedId];
    if (!record || (record.uid && record.uid !== requestedId)) throw new Error("ClinVar returned a mismatched variation record.");
    if (record.error) {
      if (/invalid uid|cannot get document summary|not found/i.test(String(record.error))) return { status: "not_found", data: null, url: sourceUrl, message: "ClinVar returned no matching variation record." };
      throw new Error(`ClinVar: ${String(record.error).slice(0, 200)}`);
    }
    // Current ESummary uses germline_classification; retain legacy payload compatibility.
    // Verified against NCBI ESummary variation 438907 on 2026-10-17.
    const classification = record.germline_classification ?? record.clinical_significance;
    const rawDescription = classification?.description;
    const geneSymbols = Array.isArray(record.genes)
      ? record.genes.map((gene: { symbol?: unknown }) => gene.symbol).filter((symbol: unknown): symbol is string => typeof symbol === "string" && symbol.length > 0)
      : [];
    const locations = Array.isArray(record.variation_set)
      ? record.variation_set.flatMap((variation: { variation_loc?: unknown[] }) => Array.isArray(variation.variation_loc) ? variation.variation_loc : [])
      : [];
    const primaryLocations = locations.filter((entry: { assembly_name?: string; chr?: string; start?: string }) => entry.assembly_name === "GRCh38" && entry.chr && entry.start);
    // A multi-component variant cannot be represented as a single point safely.
    const location = primaryLocations.length === 1 ? primaryLocations[0] : undefined;
    const position = Number(location?.start);
    const singleVariation = record.variation_set?.length === 1 ? record.variation_set[0] : undefined;
    const spdi = typeof singleVariation?.canonical_spdi === "string"
      ? singleVariation.canonical_spdi.match(/^(NC_\d+\.\d+):(\d+):([ACGTN]*):([ACGTN]*)$/) : null;
    const accession = spdi?.[1];
    // Match the exact GRCh38 chromosome accession rather than an older assembly's SPDI.
    const grch38Accessions: Record<string, string> = {
      "1": "NC_000001.11", "2": "NC_000002.12", "3": "NC_000003.12", "4": "NC_000004.12", "5": "NC_000005.10", "6": "NC_000006.12",
      "7": "NC_000007.14", "8": "NC_000008.11", "9": "NC_000009.12", "10": "NC_000010.11", "11": "NC_000011.10", "12": "NC_000012.12",
      "13": "NC_000013.11", "14": "NC_000014.9", "15": "NC_000015.10", "16": "NC_000016.10", "17": "NC_000017.11", "18": "NC_000018.10",
      "19": "NC_000019.10", "20": "NC_000020.11", "21": "NC_000021.9", "22": "NC_000022.11", X: "NC_000023.11", Y: "NC_000024.10", MT: "NC_012920.1",
    };
    const genomicAllele = spdi && location && accession === grch38Accessions[location.chr]
      ? { chromosome: location.chr, ...normalizedAllele(Number(spdi[2]) + 1, spdi[3], spdi[4]) } : undefined;

    return {
      status: "available", url: sourceUrl, data: {
      variationId: requestedId,
      clinicalSignificance: typeof rawDescription === "string" && rawDescription.trim() ? rawDescription.trim() : "Unknown",
      reviewStatus: typeof classification?.review_status === "string" && classification.review_status.trim() ? classification.review_status.trim() : "Unknown",
      geneSymbols,
      title: typeof record.title === "string" ? record.title : undefined,
      chromosome: location?.chr,
      position: Number.isSafeInteger(position) && position > 0 ? position : undefined,
      genomicAllele,
      submissions: [], // Full submissions require efetch with XML parsing
      },
    };
  } catch (error) {
    return { status: "unavailable", data: null, url: sourceUrl, message: error instanceof Error && /timeout|abort/i.test(error.name) ? "ClinVar timed out. Retry to fetch its classification." : error instanceof Error ? error.message : "ClinVar could not be reached." };
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
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });

    if (!res.ok) return [];

    const data = await res.json();
    return data?.esearchresult?.idlist ?? [];
  } catch {
    return [];
  }
}
