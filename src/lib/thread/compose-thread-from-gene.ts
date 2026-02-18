import "server-only";

import { getAssetById } from "@/lib/images/registry";
import type { GeneSummary } from "@/lib/types/gene";
import type { Claim } from "@/lib/types/claim";
import type { ImageAsset } from "@/lib/types/image-pack";

export interface ThreadSectionData {
  title: string;
  prose: string;
  imageAsset?: ImageAsset;
  claims: Claim[];
  sourceVersions: Record<string, string>;
}

export interface ThreadData {
  id: string;
  title: string;
  subtitle: string;
  sections: ThreadSectionData[];
}

/**
 * Compose a narrative thread from a GeneSummary.
 * Maps gene data to 4–5 sections with prose, claims, and archival images.
 */
export function composeThreadFromGene(gene: GeneSummary): ThreadData {
  const sym = gene.symbol;
  const clinvar = gene.clinvarSummary;
  const constraint = gene.constraint;
  const expressions = gene.topExpressions ?? [];
  const vusPercent = clinvar
    ? Math.round((clinvar.vus / clinvar.totalVariants) * 100)
    : 0;

  // Section-specific claims (filter from gene.claims or build new)
  const clingenClaims = gene.claims.filter((c) =>
    c.evidenceRefs.some((r) => r.sourceName === "ClinGen")
  );
  const clinvarClaims = gene.claims.filter((c) =>
    c.evidenceRefs.some((r) => r.sourceName === "ClinVar")
  );

  const sections: ThreadSectionData[] = [];

  // 1. Variation — ClinVar counts, chromosome
  const variationProse = clinvar
    ? `${sym} has ${clinvar.totalVariants.toLocaleString()} variants submitted to ClinVar${gene.chromosome ? ` (chromosome ${gene.chromosome})` : ""}. Among them, ${clinvar.pathogenic + clinvar.likelyPathogenic} are classified as pathogenic or likely pathogenic, and ${clinvar.vus.toLocaleString()} remain Variants of Uncertain Significance. Each variant is a thread in the story — some we understand, many we're still learning.`
    : `${sym}${gene.chromosome ? ` sits on chromosome ${gene.chromosome}` : ""}. Variant data from ClinVar helps map what we know — and what we don't — about how this gene behaves when it changes.`;

  sections.push({
    title: "Variation",
    prose: variationProse,
    imageAsset: getAssetById("thread", "braided-rope") ?? undefined,
    claims: clingenClaims,
    sourceVersions: gene.sourceVersions,
  });

  // 2. Interpretation — VUS %, conflicting
  const interpretationProse =
    clinvar && clinvar.vus > 0
      ? `Here's the uncomfortable truth: ${vusPercent}% of ${sym} variants in ClinVar are classified as "Uncertain Significance" (VUS). That means the labs that sequenced them couldn't confidently say whether they're harmful or harmless. This isn't a failure — it's an honest reflection of where the science stands. Interpretations change as evidence accumulates.${clinvar.conflicting > 0 ? ` And ${clinvar.conflicting} variants have conflicting classifications across submitters — labs sometimes disagree on what the evidence means.` : ""}`
      : `Interpretation of genetic variants is an evolving science. What we know about ${sym} today may shift as new evidence emerges.`;

  sections.push({
    title: "Interpretation",
    prose: interpretationProse,
    imageAsset: getAssetById("evidence", "broken-plate") ?? undefined,
    claims: clinvarClaims,
    sourceVersions: gene.sourceVersions,
  });

  // 3. Constraint — gnomAD LOEUF, pLI
  if (constraint) {
    const loeuf = constraint.loeufScore ?? 0;
    const constraintProse = `gnomAD's constraint metrics tell us how tolerant ${sym} is to different types of mutations in the general population. A LOEUF score of ${loeuf.toFixed(2)} ${loeuf < 0.5 ? "means nature doesn't tolerate loss-of-function mutations in this gene well" : "suggests moderate tolerance"}. This is indirect evidence, but it's powerful: evolution has been running this experiment for millions of years.`;
    const constraintClaims: Claim[] = [
      {
        claimText: `${sym} has a LOEUF score of ${loeuf.toFixed(2)}${constraint.pLI != null ? ` and pLI of ${constraint.pLI.toFixed(2)}` : ""}, indicating ${loeuf < 0.5 ? "intolerance" : "moderate tolerance"} to loss-of-function variants.`,
        confidenceLevel: "high",
        evidenceRefs: [
          {
            id: `gnomad-${sym}`,
            sourceName: "gnomAD",
            date: gene.sourceVersions.gnomad ?? "4.1",
            link: `https://gnomad.broadinstitute.org/gene/${sym}`,
            excerpt: `LOEUF: ${loeuf.toFixed(2)}${constraint.pLI != null ? `, pLI: ${constraint.pLI.toFixed(2)}` : ""}`,
          },
        ],
      },
    ];
    sections.push({
      title: "Constraint",
      prose: constraintProse,
      imageAsset: getAssetById("history", "tree-rings") ?? undefined,
      claims: constraintClaims,
      sourceVersions: { gnomad: gene.sourceVersions.gnomad ?? "4.1" },
    });
  }

  // 4. Expression — GTEx top tissues
  if (expressions.length > 0) {
    const top3 = expressions.slice(0, 3);
    const tissueList = top3
      .map((e) => `${e.tissue} (${e.tpm.toFixed(1)} TPM)`)
      .join(", ");
    const expressionProse = `GTEx data shows where ${sym} is most active in the body. Top tissues: ${tissueList}. Where a gene is expressed often aligns with where pathogenic variants cause disease — though the gene isn't silent elsewhere; it may play roles across many cell types.`;
    const expressionClaims: Claim[] = [
      {
        claimText: `${sym} is most highly expressed in ${top3.map((e) => e.tissue).join(", ")}.`,
        confidenceLevel: "high",
        evidenceRefs: [
          {
            id: `gtex-${sym}`,
            sourceName: "GTEx",
            date: gene.sourceVersions.gtex ?? "v10",
            link: `https://gtexportal.org/home/gene/${sym}`,
            excerpt: `Top tissues: ${tissueList}`,
          },
        ],
      },
    ];
    sections.push({
      title: "Expression",
      prose: expressionProse,
      imageAsset: getAssetById("thread", "spiral-stairs") ?? undefined,
      claims: expressionClaims,
      sourceVersions: { gtex: gene.sourceVersions.gtex ?? "v10" },
    });
  }

  // 5. Meaning — synthesis
  const meaningProse = clinvar
    ? `So what does it all mean? ${sym} is a gene we're still learning about. ${clinvar.pathogenic + clinvar.likelyPathogenic} variants are classified as pathogenic or likely pathogenic — evidence that's strong and actionable when it applies to you. ${clinvar.vus} variants remain uncertain. That's the honest state of genomic medicine: if you carry a pathogenic ${sym} variant, the evidence speaks clearly. If you carry a VUS, the evidence is still accumulating. Either way, you deserve to understand what the science actually says.`
    : `What we know about ${sym} is built from many sources — ClinVar, ClinGen, gnomAD, GTEx. Each adds a thread to the story. The picture is never complete, but it's always evolving.`;

  sections.push({
    title: "Meaning",
    prose: meaningProse,
    imageAsset: getAssetById("evidence", "book") ?? undefined,
    claims: [],
    sourceVersions: {},
  });

  return {
    id: `gene-${sym}`,
    title: `What does ${sym} actually mean?`,
    subtitle: `A thread through the evidence — ClinVar, gnomAD, ClinGen, and GTEx.`,
    sections,
  };
}
