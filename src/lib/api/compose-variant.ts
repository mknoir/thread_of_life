import "server-only";

import { fetchClinvarVariantEvidence } from "./clinvar";
import { fetchGnomadVariantEvidence } from "./gnomad";
import { normalizedAllele, parseCoordinateVariant, parseVariantRequest } from "./variant-identifiers";
import type { VariantSummary, ClinicalSignificance, ReviewStatus, VariantSourceResult, PopulationFrequency } from "../types/variant";
import type { Claim } from "../types/claim";

/**
 * Fetch each source using its own identifier namespace, and verify paired alleles.
 */
export async function composeVariantSummary(
  id: string,
  coordinateId?: string
): Promise<VariantSummary> {
  const selection = parseVariantRequest(id, coordinateId);
  if (!selection) throw new Error("Use a numeric ClinVar variation ID or a specific GRCh38 chromosome-position-reference-alternate allele.");
  const { variantId, clinvarId } = selection;
  let parsedVariant = selection.coordinate;
  const clinvarResult = clinvarId ? await fetchClinvarVariantEvidence(clinvarId) : {
    status: "not_applicable" as const, data: null, message: "No matched numeric ClinVar variation ID is available for this allele.",
  };
  const clinvar = clinvarResult.data;
  let gnomadResult: VariantSourceResult<PopulationFrequency[]> | undefined;
  const genomicAllele = clinvar?.genomicAllele;
  if (clinvar && parsedVariant) {
    const provided = normalizedAllele(parsedVariant.position, parsedVariant.refAllele, parsedVariant.altAllele);
    if (!genomicAllele || genomicAllele.chromosome !== parsedVariant.chromosome || provided.position !== genomicAllele.position || provided.ref !== genomicAllele.ref || provided.alt !== genomicAllele.alt) {
      gnomadResult = { status: "unavailable", data: null, message: "The supplied genomic allele could not be verified against this ClinVar record. Population evidence was not combined." };
      parsedVariant = null;
    }
  }
  // SPDI substitutions are already unambiguous; empty insertion/deletion alleles
  // require a supplied and verified VCF anchor and are never invented here.
  if (!parsedVariant && !gnomadResult && genomicAllele?.ref && genomicAllele.alt) {
    parsedVariant = parseCoordinateVariant(`${genomicAllele.chromosome}-${genomicAllele.position}-${genomicAllele.ref}-${genomicAllele.alt}`);
  }
  gnomadResult ??= parsedVariant ? await fetchGnomadVariantEvidence(parsedVariant.id) : {
    status: "not_applicable", data: null, message: "A verified GRCh38 allele is required to fetch gnomAD frequencies.",
  };
  const frequencies = gnomadResult.data ?? [];

  const today = new Date().toISOString().split("T")[0]!;
  const claims: Claim[] = [];

  const clinSig = normalizeClinicalSignificance(
    clinvar?.clinicalSignificance ?? "Unknown"
  );

  if (clinvar) {
    claims.push({
      // Keep the exact upstream wording: the display enum cannot represent mixed labels.
      claimText: clinvar.clinicalSignificance === "Unknown"
        ? "This ClinVar record did not return a germline classification."
        : `ClinVar reports the germline classification as ${clinvar.clinicalSignificance}.`,
      confidenceLevel: /expert panel|practice guideline/i.test(clinvar.reviewStatus) ? "high" : "moderate",
      evidenceRefs: [
        {
          id: `clinvar-${clinvarId}`,
          sourceName: "ClinVar",
          date: today,
          link: clinvarResult.url!,
          excerpt: `Classification: ${clinvar.clinicalSignificance}, Review status: ${clinvar.reviewStatus}`,
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
      claimText: `Highest returned population frequency in gnomAD v4.1 ${gnomadResult.dataset}: ${maxFreq.toExponential(2)} in ${maxPop ?? "unknown"}.`,
      confidenceLevel: "moderate",
      evidenceRefs: [
        {
          id: `gnomad-freq-${parsedVariant?.id}`,
          sourceName: "gnomAD",
          date: today,
          link: gnomadResult.url!,
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
    coordinateId: parsedVariant?.id,
    hgvs: clinvar?.title ?? variantId,
    gene: clinvar?.geneSymbols.join(", ") ?? "",
    chromosome: parsedVariant?.chromosome ?? clinvar?.chromosome ?? "",
    position: parsedVariant?.position ?? clinvar?.position ?? 0,
    refAllele: parsedVariant?.refAllele ?? "",
    altAllele: parsedVariant?.altAllele ?? "",
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
    sourceStatus: {
      clinvar: { status: clinvarResult.status, message: clinvarResult.message, url: clinvarResult.url },
      gnomad: { status: gnomadResult.status, message: gnomadResult.message, url: gnomadResult.url, dataset: gnomadResult.dataset },
    },
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeClinicalSignificance(raw: string): ClinicalSignificance {
  const lower = raw.toLowerCase();
  // "Conflicting classifications of pathogenicity" contains "pathogenic".
  if (lower.includes("conflict")) return "Conflicting classifications";
  if (lower.includes("pathogenic") && !lower.includes("likely"))
    return "Pathogenic";
  if (lower.includes("likely pathogenic")) return "Likely pathogenic";
  if (lower.includes("uncertain")) return "Uncertain significance";
  if (lower.includes("likely benign")) return "Likely benign";
  if (lower.includes("benign") && !lower.includes("likely")) return "Benign";
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
