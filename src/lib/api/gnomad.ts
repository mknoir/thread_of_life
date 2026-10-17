import "server-only";
import type { GnomadGeneLandscape } from "@/lib/types/gene";
import type { PopulationFrequency, VariantSourceResult } from "../types/variant";
import { parseCoordinateVariant } from "./variant-identifiers";

const GNOMAD_API = "https://gnomad.broadinstitute.org/api";
const GNOMAD_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0",
  Origin: "https://gnomad.broadinstitute.org",
  Referer: "https://gnomad.broadinstitute.org/",
};

interface GnomadGeneConstraint {
  pLI: number | null;
  loeufScore: number | null;
  misZScore: number | null;
}


interface GnomadGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

async function gnomadGraphql<T>(
  query: string,
  variables: Record<string, string>,
  noStore = false
): Promise<GnomadGraphqlResponse<T> | null> {
  const res = await fetch(GNOMAD_API, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: GNOMAD_HEADERS,
    body: JSON.stringify({ query, variables }),
    ...(noStore ? { cache: "no-store" as const } : { next: { revalidate: 2592000 } }), // 30 days for gene data
  });
  if (!res.ok) throw new Error(`gnomAD returned HTTP ${res.status}.`);
  const payload = (await res.json()) as GnomadGraphqlResponse<T>;
  return payload;
}

function isLofConsequence(consequence: string): boolean {
  return [
    "transcript_ablation",
    "splice_acceptor_variant",
    "splice_donor_variant",
    "stop_gained",
    "frameshift_variant",
    "stop_lost",
    "start_lost",
  ].includes(consequence);
}

/**
 * Fetch gene constraint metrics from gnomAD GraphQL API.
 */
export async function fetchGnomadGeneConstraint(
  symbol: string
): Promise<GnomadGeneConstraint | null> {
  const query = `
    query GeneConstraint($geneSymbol: String!) {
      gene(gene_symbol: $geneSymbol, reference_genome: GRCh38) {
        gene_id
        symbol
        gnomad_constraint {
          pLI
          oe_lof_upper
          mis_z
        }
      }
    }
  `;

  try {
    const payload = await gnomadGraphql<{
      gene?: { gnomad_constraint?: { pLI?: number; oe_lof_upper?: number; mis_z?: number } };
    }>(query, { geneSymbol: symbol.toUpperCase() });
    const constraint = payload?.data?.gene?.gnomad_constraint;

    if (!constraint) return null;

    return {
      pLI: constraint.pLI ?? null,
      loeufScore: constraint.oe_lof_upper ?? null,
      misZScore: constraint.mis_z ?? null,
    };
  } catch (error) {
    console.error(`gnomAD gene constraint fetch failed for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch variant population frequencies from gnomAD.
 */
export async function fetchGnomadVariantFrequencies(variantId: string): Promise<PopulationFrequency[]> {
  return (await fetchGnomadVariantEvidence(variantId)).data ?? [];
}

/** Preserve absent records and failed GraphQL requests as distinct source states. */
export async function fetchGnomadVariantEvidence(variantId: string): Promise<VariantSourceResult<PopulationFrequency[]>> {
  const parsed = parseCoordinateVariant(variantId);
  if (!parsed) return { status: "not_applicable", data: null, message: "gnomAD requires a GRCh38 chromosome-position-reference-alternate allele ID." };
  const url = `https://gnomad.broadinstitute.org/variant/${parsed.id}?dataset=gnomad_r4`;
  const query = `
    query VariantFrequencies($variantId: String!) {
      variant(variantId: $variantId, dataset: gnomad_r4) {
        variant_id
        genome { populations { id ac an homozygote_count } }
        exome { populations { id ac an homozygote_count } }
      }
    }
  `;
  type RawPopulation = { id?: unknown; ac?: unknown; an?: unknown; homozygote_count?: unknown };
  try {
    const payload = await gnomadGraphql<{
      variant?: {
        variant_id?: string;
        exome?: { populations?: RawPopulation[] } | null;
        genome?: { populations?: RawPopulation[] } | null;
      } | null;
    }>(query, { variantId: parsed.id }, true);
    if (payload?.errors?.length) {
      const message = payload.errors.map((error) => error.message ?? "GraphQL error").join("; ").slice(0, 300);
      // gnomAD reports a missing dataset allele as a GraphQL error, not HTTP404.
      if (/variant not found|not found in (?:the )?dataset/i.test(message)) {
        return { status: "not_found", data: null, url, message: "This allele was not found in gnomAD v4.1. Its population frequency is unknown." };
      }
      throw new Error(`gnomAD: ${message}`);
    }
    if (!payload?.data || !("variant" in payload.data)) throw new Error("gnomAD returned an unreadable variant response.");
    const variant = payload.data.variant;
    if (variant === null) return { status: "not_found", data: null, url, message: "This allele was not found in gnomAD v4.1. Its population frequency is unknown." };
    if (!variant || variant.variant_id !== parsed.id) throw new Error("gnomAD returned a mismatched variant record.");
    const labels: Record<string, string> = {
      afr: "African/African American", amr: "Admixed American", asj: "Ashkenazi Jewish", eas: "East Asian",
      fin: "European (Finnish)", nfe: "European (non-Finnish)", sas: "South Asian", mid: "Middle Eastern",
      ami: "Amish", remaining: "Remaining ancestry groups", oth: "Other",
    };
    const populationsFor = (populations: RawPopulation[] | undefined): PopulationFrequency[] => {
      if (!Array.isArray(populations)) return [];
      return populations.flatMap((population) => {
        if (typeof population.id !== "string" || !labels[population.id]) return [];
        const { ac, an, homozygote_count: hom } = population;
        if (!Number.isSafeInteger(ac) || !Number.isSafeInteger(an) || Number(ac) < 0 || Number(an) <= 0 || Number(ac) > Number(an)) return [];
        return [{ population: labels[population.id], alleleFrequency: Number(ac) / Number(an), alleleCount: Number(ac), alleleNumber: Number(an),
          homozygoteCount: Number.isSafeInteger(hom) && Number(hom) >= 0 ? Number(hom) : null }];
      });
    };
    const exomes = populationsFor(variant.exome?.populations);
    const genomes = populationsFor(variant.genome?.populations);
    // Do not let an empty exome array hide usable genome data, or add overlapping cohorts.
    const data = exomes.length ? exomes : genomes;
    const dataset = exomes.length ? "exomes" : "genomes";
    if (!data.length) return { status: "unavailable", data: null, url, message: "The gnomAD record has no usable population allele counts. Frequency is unknown." };
    return { status: "available", data, url, dataset, message: `gnomAD v4.1 ${dataset}; populations with measured allele numbers.` };
  } catch (error) {
    return { status: "unavailable", data: null, url, message: error instanceof Error && /timeout|abort/i.test(error.name) ? "gnomAD timed out. Retry to fetch population frequencies." : error instanceof Error ? error.message : "gnomAD could not be reached." };
  }
}

/**
 * Fetch and aggregate full-gene variant distribution from gnomAD.
 * Uses all returned variants for the gene, then compresses to bins for UI rendering.
 */
export async function fetchGnomadGeneLandscape(
  symbol: string,
  binCount = 120
): Promise<GnomadGeneLandscape | null> {
  const query = `
    query GeneVariantLandscape($geneSymbol: String!) {
      gene(gene_symbol: $geneSymbol, reference_genome: GRCh38) {
        chrom
        start
        stop
        variants(dataset: gnomad_r4) {
          pos
          consequence
          exome { ac an }
          genome { ac an }
        }
      }
    }
  `;

  try {
    const payload = await gnomadGraphql<{
      gene?: {
        chrom?: string;
        start?: number;
        stop?: number;
        variants?: Array<{
          pos?: number;
          consequence?: string;
          exome?: { ac?: number; an?: number } | null;
          genome?: { ac?: number; an?: number } | null;
        }>;
      };
    }>(query, { geneSymbol: symbol.toUpperCase() });

    const gene = payload?.data?.gene;
    if (!gene?.chrom || !gene.start || !gene.stop) return null;
    const chromosome = gene.chrom;
    const regionStart = gene.start;
    const regionEnd = gene.stop;

    const variants = gene.variants ?? [];
    const safeBinCount = Math.max(24, Math.min(200, binCount));
    const regionLength = Math.max(1, regionEnd - regionStart + 1);
    const step = Math.max(1, Math.ceil(regionLength / safeBinCount));

    const bins = Array.from({ length: safeBinCount }, (_, index) => {
      const start = regionStart + index * step;
      const end = Math.min(regionEnd, start + step - 1);
      return {
        index,
        start,
        end,
        total: 0,
        lof: 0,
        missense: 0,
        synonymous: 0,
        other: 0,
        maxAf: 0,
      };
    });

    for (const variant of variants) {
      if (!variant.pos || variant.pos < regionStart || variant.pos > regionEnd) continue;
      const idx = Math.min(
        bins.length - 1,
        Math.floor((variant.pos - regionStart) / step)
      );
      const bin = bins[idx];
      bin.total += 1;
      const consequence = variant.consequence ?? "other";
      if (isLofConsequence(consequence)) bin.lof += 1;
      else if (consequence.includes("missense")) bin.missense += 1;
      else if (consequence.includes("synonymous")) bin.synonymous += 1;
      else bin.other += 1;

      const exomeAf =
        (variant.exome?.an ?? 0) > 0
          ? (variant.exome?.ac ?? 0) / (variant.exome?.an ?? 1)
          : 0;
      const genomeAf =
        (variant.genome?.an ?? 0) > 0
          ? (variant.genome?.ac ?? 0) / (variant.genome?.an ?? 1)
          : 0;
      bin.maxAf = Math.max(bin.maxAf, exomeAf, genomeAf);
    }

    return {
      chromosome,
      regionStart,
      regionEnd,
      totalVariants: variants.length,
      binCount: bins.length,
      bins,
    };
  } catch (error) {
    console.error(`gnomAD gene landscape fetch failed for ${symbol}:`, error);
    return null;
  }
}
