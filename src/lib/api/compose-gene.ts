import "server-only";

import { fetchClinvarGene } from "./clinvar";
import { fetchGnomadGeneConstraint } from "./gnomad";
import { fetchClingenValidity } from "./clingen";
import { fetchGtexExpression } from "./gtex";
import type { GeneSummary } from "../types/gene";
import type { Claim } from "../types/claim";

/**
 * Compose a GeneSummary by fetching from all four sources in parallel.
 * This is called on cache miss by getCachedGeneSummary.
 */
export async function composeGeneSummary(
  symbol: string
): Promise<GeneSummary> {
  const upperSymbol = symbol.toUpperCase();

  // Fetch all sources in parallel
  const [clinvarResult, constraintResult, clingenResult, gtexResult] =
    await Promise.allSettled([
      fetchClinvarGene(upperSymbol),
      fetchGnomadGeneConstraint(upperSymbol),
      fetchClingenValidity(upperSymbol),
      fetchGtexExpression(upperSymbol),
    ]);

  const clinvar =
    clinvarResult.status === "fulfilled" ? clinvarResult.value : null;
  const constraint =
    constraintResult.status === "fulfilled" ? constraintResult.value : null;
  const clingen =
    clingenResult.status === "fulfilled" ? clingenResult.value : null;
  const gtex =
    gtexResult.status === "fulfilled" ? gtexResult.value : [];

  // Build claims from the composed data
  const claims: Claim[] = [];
  const today = new Date().toISOString().split("T")[0]!;

  if (clingen?.validity) {
    claims.push({
      claimText: `${upperSymbol} has ${clingen.validity} gene-disease validity${clingen.disease ? ` for ${clingen.disease}` : ""} according to ClinGen.`,
      confidenceLevel: clingen.validity === "Definitive" ? "high" : "moderate",
      evidenceRefs: [
        {
          id: `clingen-${upperSymbol}`,
          sourceName: "ClinGen",
          date: today,
          link: `https://search.clinicalgenome.org/kb/genes/${upperSymbol}`,
          excerpt: `Gene-disease validity: ${clingen.validity}`,
        },
      ],
    });
  }

  if (clinvar && clinvar.vus > 0) {
    const vusPercent = Math.round(
      (clinvar.vus / clinvar.totalVariants) * 100
    );
    claims.push({
      claimText: `${vusPercent}% of variants (${clinvar.vus} of ${clinvar.totalVariants}) remain classified as Variants of Uncertain Significance.`,
      confidenceLevel: "moderate",
      evidenceRefs: [
        {
          id: `clinvar-vus-${upperSymbol}`,
          sourceName: "ClinVar",
          date: today,
          link: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${upperSymbol}[gene]`,
          excerpt: `${clinvar.vus} VUS of ${clinvar.totalVariants} total variants submitted.`,
        },
      ],
    });
  }

  const sourceVersions: Record<string, string> = {};
  if (clinvar) sourceVersions.clinvar = today;
  if (constraint) sourceVersions.gnomad = "4.1";
  if (clingen) sourceVersions.clingen = today;
  if (gtex.length > 0) sourceVersions.gtex = "v10";

  return {
    symbol: upperSymbol,
    name: `${upperSymbol} gene`,
    hgncId: "",
    description: "",
    chromosome: "",
    clinvarSummary: clinvar
      ? {
          totalVariants: clinvar.totalVariants,
          pathogenic: clinvar.pathogenic,
          likelyPathogenic: clinvar.likelyPathogenic,
          vus: clinvar.vus,
          benign: clinvar.benign,
          likelyBenign: clinvar.likelyBenign,
          conflicting: clinvar.conflicting,
          other: Math.max(
            0,
            clinvar.totalVariants -
              (clinvar.pathogenic +
                clinvar.likelyPathogenic +
                clinvar.vus +
                clinvar.likelyBenign +
                clinvar.benign +
                clinvar.conflicting)
          ),
        }
      : null,
    constraint: constraint
      ? {
          pLI: constraint.pLI,
          loeufScore: constraint.loeufScore,
          misZScore: constraint.misZScore,
        }
      : null,
    topExpressions: gtex,
    clingenValidity: clingen?.validity ?? null,
    claims,
    sourceVersions,
    fetchedAt: new Date().toISOString(),
  };
}
