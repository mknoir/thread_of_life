import "server-only";

const GNOMAD_API = "https://gnomad.broadinstitute.org/api";

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
    const res = await fetch(GNOMAD_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { geneSymbol: symbol.toUpperCase() },
      }),
      next: { revalidate: 2592000 }, // 30 days
    });

    if (!res.ok) return null;

    const data = await res.json();
    const constraint = data?.data?.gene?.gnomad_constraint;

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
    const res = await fetch(GNOMAD_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { variantId },
      }),
      next: { revalidate: 2592000 }, // 30 days
    });

    if (!res.ok) return [];

    const data = await res.json();
    const variant = data?.data?.variant;
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
