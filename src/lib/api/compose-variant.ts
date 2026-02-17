import "server-only";

import { fetchClinvarVariant } from "./clinvar";
import { fetchGnomadVariantFrequencies } from "./gnomad";
import type { VariantSummary, ClinicalSignificance, ReviewStatus } from "../types/variant";
import type { Claim } from "../types/claim";

/**
 * Compose a VariantSummary by fetching from ClinVar + gnomAD in parallel.
 */
export async function composeVariantSummary(
  variantId: string
): Promise<VariantSummary> {
  const [clinvarResult, gnomadResult] = await Promise.allSettled([
    fetchClinvarVariant(variantId),
    fetchGnomadVariantFrequencies(variantId),
  ]);

  const clinvar =
    clinvarResult.status === "fulfilled" ? clinvarResult.value : null;
  const frequencies =
    gnomadResult.status === "fulfilled" ? gnomadResult.value : [];

  const today = new Date().toISOString().split("T")[0]!;
  const claims: Claim[] = [];

  const clinSig = normalizeClinicalSignificance(
    clinvar?.clinicalSignificance ?? "Unknown"
  );

  if (clinvar) {
    claims.push({
      claimText: `This variant is classified as ${clinSig} in ClinVar.`,
      confidenceLevel:
        clinSig === "Pathogenic" || clinSig === "Benign" ? "high" : "moderate",
      evidenceRefs: [
        {
          id: `clinvar-${variantId}`,
          sourceName: "ClinVar",
          date: today,
          link: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${variantId}/`,
          excerpt: `Classification: ${clinSig}, Review status: ${clinvar.reviewStatus}`,
        },
      ],
    });
  }

  if (frequencies.length > 0) {
    const maxFreq = Math.max(...frequencies.map((f) => f.alleleFrequency));
    const maxPop = frequencies.find(
      (f) => f.alleleFrequency === maxFreq
    )?.population;

    claims.push({
      claimText: `Highest population frequency: ${maxFreq.toExponential(2)} in ${maxPop ?? "unknown"}.`,
      confidenceLevel: "moderate",
      evidenceRefs: [
        {
          id: `gnomad-freq-${variantId}`,
          sourceName: "gnomAD",
          date: today,
          link: `https://gnomad.broadinstitute.org/variant/${variantId}`,
          excerpt: `Max allele frequency ${maxFreq.toExponential(2)} in ${maxPop}`,
        },
      ],
    });
  }

  const sourceVersions: Record<string, string> = {};
  if (clinvar) sourceVersions.clinvar = today;
  if (frequencies.length > 0) sourceVersions.gnomad = "4.1";

  return {
    variantId,
    hgvs: "",
    gene: "",
    chromosome: "",
    position: 0,
    refAllele: "",
    altAllele: "",
    clinicalSignificance: clinSig,
    reviewStatus: normalizeReviewStatus(clinvar?.reviewStatus ?? ""),
    submissions: (clinvar?.submissions ?? []).map((s) => ({
      ...s,
      classification: normalizeClinicalSignificance(s.classification),
      reviewStatus: normalizeReviewStatus(s.reviewStatus),
    })),
    populationFrequencies: frequencies,
    claims,
    sourceVersions,
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeClinicalSignificance(raw: string): ClinicalSignificance {
  const lower = raw.toLowerCase();
  if (lower.includes("pathogenic") && !lower.includes("likely"))
    return "Pathogenic";
  if (lower.includes("likely pathogenic")) return "Likely pathogenic";
  if (lower.includes("uncertain")) return "Uncertain significance";
  if (lower.includes("likely benign")) return "Likely benign";
  if (lower.includes("benign") && !lower.includes("likely")) return "Benign";
  if (lower.includes("conflict")) return "Conflicting classifications";
  return "Other";
}

function normalizeReviewStatus(raw: string): ReviewStatus {
  const lower = raw.toLowerCase();
  if (lower.includes("practice guideline")) return "practice guideline";
  if (lower.includes("expert panel")) return "reviewed by expert panel";
  if (lower.includes("multiple") && lower.includes("no conflicts"))
    return "criteria provided, multiple submitters, no conflicts";
  if (lower.includes("conflicting"))
    return "criteria provided, conflicting classifications";
  if (lower.includes("single"))
    return "criteria provided, single submitter";
  if (lower.includes("no assertion"))
    return "no assertion criteria provided";
  return "no classification provided";
}
