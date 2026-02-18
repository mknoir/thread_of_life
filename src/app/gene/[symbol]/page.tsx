import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { GeneSummaryCard } from "@/components/gene/gene-summary";
import { GeneStatsPanel } from "@/components/gene/gene-stats-panel";
import { EvidenceAccordion } from "@/components/gene/evidence-accordion";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { EpistemicAlert } from "@/components/shared/epistemic-alert";
import { PreReadCard } from "@/components/shared/pre-read-card";
import { fetchGeneData } from "@/lib/api/fetch-gene";
import type { GeneSummary } from "@/lib/types/gene";

interface GenePageProps {
  params: Promise<{ symbol: string }>;
}

export default async function GenePage({ params }: GenePageProps) {
  const { symbol } = await params;
  if (!symbol?.trim()) notFound();

  let gene: GeneSummary;
  try {
    gene = await fetchGeneData(symbol);
  } catch {
    notFound();
  }

  const geneFacts: string[] = [
    `Gene symbol: ${gene.symbol}.`,
    gene.clinvarSummary
      ? `ClinVar reports ${gene.clinvarSummary.totalVariants.toLocaleString()} total variants for this gene, including ${gene.clinvarSummary.pathogenic.toLocaleString()} pathogenic and ${gene.clinvarSummary.vus.toLocaleString()} VUS entries.`
      : "ClinVar summary is unavailable.",
    gene.constraint?.loeufScore != null
      ? `gnomAD LOEUF is ${gene.constraint.loeufScore.toFixed(3)}.`
      : "gnomAD LOEUF is unavailable.",
    gene.clingenValidity
      ? `ClinGen validity: ${gene.clingenValidity}.`
      : "ClinGen validity is unavailable.",
    gene.topExpressions.length > 0
      ? `Top GTEx tissues include ${gene.topExpressions
          .slice(0, 3)
          .map((t) => `${t.tissue} (${t.tpm.toFixed(1)} TPM)`)
          .join(", ")}.`
      : "GTEx tissue expression is unavailable.",
    gene.gnomadLandscape
      ? `gnomAD landscape spans chr${gene.gnomadLandscape.chromosome}:${gene.gnomadLandscape.regionStart.toLocaleString()}-${gene.gnomadLandscape.regionEnd.toLocaleString()} with ${gene.gnomadLandscape.totalVariants.toLocaleString()} mapped variants.`
      : "gnomAD positional landscape is unavailable.",
  ];

  return (
    <div className="space-y-8">
      <BreadcrumbNav />

      {/* Chapter 1: What is this gene? */}
      <section className="space-y-4">
        <GeneSummaryCard gene={gene} />
        {gene.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {gene.description}
          </p>
        )}
        <EvidenceSheet
          claims={gene.claims}
          sourceVersions={gene.sourceVersions}
        />
        <PreReadCard
          pageType="gene-summary"
          title={`${gene.symbol} gene summary`}
          facts={geneFacts}
        />
      </section>

      <Separator />

      <GeneStatsPanel gene={gene} />

      <Separator />

      {/* Chapter 2: What do we know? */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          What do we know?
        </h2>
        <p className="text-sm text-muted-foreground">
          Evidence from ClinVar, ClinGen, gnomAD, and GTEx — each telling a
          different part of the story.
        </p>
        <EvidenceAccordion gene={gene} />
      </section>

      <Separator />

      {/* Chapter 3: What's uncertain? */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          What&apos;s uncertain?
        </h2>
        <EpistemicAlert
          title="Interpretation is evolving"
          description={`${gene.clinvarSummary?.vus ?? 0} variants in this gene are still classified as Variants of Uncertain Significance. This is normal — it reflects the current state of knowledge, not a failure of science.`}
          confidenceLevel="moderate"
          uncertaintyIndex={
            gene.clinvarSummary
              ? Math.round(
                  (gene.clinvarSummary.vus / gene.clinvarSummary.totalVariants) *
                    100
                )
              : undefined
          }
        />
        {gene.clinvarSummary && gene.clinvarSummary.conflicting > 0 && (
          <EpistemicAlert
            title="Conflicting interpretations exist"
            description={`${gene.clinvarSummary.conflicting} variants have conflicting classifications across different submitters. This means labs disagree on what the evidence means.`}
            confidenceLevel="contested"
            uncertaintyIndex={Math.round(
              (gene.clinvarSummary.conflicting /
                gene.clinvarSummary.totalVariants) *
                100
            )}
          />
        )}
      </section>

      <Separator />

      {/* Data freshness footer */}
      <footer className="space-y-1 pb-8">
        <p className="text-[10px] text-muted-foreground">
          Data updated on:{" "}
          {Object.entries(gene.sourceVersions)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
        </p>
      </footer>
    </div>
  );
}
