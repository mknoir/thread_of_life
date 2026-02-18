import "server-only";
import type { GnomadGeneLandscape } from "@/lib/types/gene";

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

interface GnomadVariantFrequency {
  population: string;
  alleleFrequency: number;
  alleleCount: number;
  alleleNumber: number;
  homozygoteCount: number;
}

interface GnomadGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

async function gnomadGraphql<T>(
  query: string,
  variables: Record<string, string>
): Promise<GnomadGraphqlResponse<T> | null> {
  const res = await fetch(GNOMAD_API, {
    method: "POST",
    headers: GNOMAD_HEADERS,
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 2592000 }, // 30 days
  });
  if (!res.ok) return null;
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
export async function fetchGnomadVariantFrequencies(
  variantId: string
): Promise<GnomadVariantFrequency[]> {
  // variantId format: "1-55516888-G-A" (chrom-pos-ref-alt)
  const parts = variantId.split("-");
  if (parts.length !== 4) return [];

  const query = `
    query VariantFrequencies($variantId: String!) {
      variant(variantId: $variantId, dataset: gnomad_r4) {
        variant_id
        genome {
          populations {
            id
            ac
            an
            homozygote_count
          }
        }
        exome {
          populations {
            id
            ac
            an
            homozygote_count
          }
        }
      }
    }
  `;

  try {
    const payload = await gnomadGraphql<{
      variant?: {
        exome?: { populations?: Array<{ id: string; ac: number; an: number; homozygote_count: number }> };
        genome?: { populations?: Array<{ id: string; ac: number; an: number; homozygote_count: number }> };
      };
    }>(query, { variantId });
    const variant = payload?.data?.variant;
    if (!variant) return [];

    // Prefer exome data, fall back to genome
    const populations =
      variant.exome?.populations ?? variant.genome?.populations ?? [];

    const POPULATION_LABELS: Record<string, string> = {
      afr: "African/African American",
      amr: "Admixed American",
      asj: "Ashkenazi Jewish",
      eas: "East Asian",
      fin: "European (Finnish)",
      nfe: "European (non-Finnish)",
      sas: "South Asian",
      oth: "Other",
    };

    return populations
      .filter(
        (p: { id: string; ac: number; an: number }) =>
          POPULATION_LABELS[p.id] && p.an > 0
      )
      .map((p: { id: string; ac: number; an: number; homozygote_count: number }) => ({
        population: POPULATION_LABELS[p.id] ?? p.id,
        alleleFrequency: p.an > 0 ? p.ac / p.an : 0,
        alleleCount: p.ac,
        alleleNumber: p.an,
        homozygoteCount: p.homozygote_count ?? 0,
      }));
  } catch (error) {
    console.error(
      `gnomAD variant frequencies fetch failed for ${variantId}:`,
      error
    );
    return [];
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
