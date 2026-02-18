import { notFound } from "next/navigation";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { ThreadSection } from "@/components/thread/thread-section";
import { ThreadFooterActions } from "@/components/thread/thread-footer-actions";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { GeneStatsPanel } from "@/components/gene/gene-stats-panel";
import { ContinueReadingButton } from "@/components/thread/continue-reading-button";
import { Separator } from "@/components/ui/separator";
import { PreReadCard } from "@/components/shared/pre-read-card";
import { fetchGeneData } from "@/lib/api/fetch-gene";
import { composeThreadFromGene } from "@/lib/thread/compose-thread-from-gene";

interface GeneThreadPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function GeneThreadPage({ params }: GeneThreadPageProps) {
  const { symbol } = await params;
  if (!symbol?.trim()) notFound();

  let gene;
  try {
    gene = await fetchGeneData(symbol);
  } catch {
    notFound();
  }

  const thread = composeThreadFromGene(gene);
  const threadFacts: string[] = [
    `Gene symbol: ${gene.symbol}.`,
    `Thread title: ${thread.title}.`,
    gene.clingenValidity
      ? `ClinGen validity: ${gene.clingenValidity}.`
      : "ClinGen validity is unavailable.",
    gene.clinvarSummary
      ? `ClinVar counts include ${gene.clinvarSummary.pathogenic.toLocaleString()} pathogenic, ${gene.clinvarSummary.likelyPathogenic.toLocaleString()} likely pathogenic, and ${gene.clinvarSummary.vus.toLocaleString()} VUS entries.`
      : "ClinVar summary is unavailable.",
    gene.topExpressions.length > 0
      ? `GTEx top tissues: ${gene.topExpressions
          .slice(0, 3)
          .map((t) => `${t.tissue} (${t.tpm.toFixed(1)} TPM)`)
          .join(", ")}.`
      : "GTEx tissue expression is unavailable.",
    gene.gnomadLandscape
      ? `gnomAD maps ${gene.gnomadLandscape.totalVariants.toLocaleString()} variants across the gene span on GRCh38.`
      : "gnomAD positional landscape is unavailable.",
  ];

  return (
    <div className="space-y-10">
      <BreadcrumbNav />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{thread.title}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {thread.subtitle}
        </p>
      </header>

      <PreReadCard
        pageType="gene-thread"
        title={thread.title}
        facts={threadFacts}
      />

      <Separator />

      <GeneStatsPanel gene={gene} compact />

      <Separator />

      {thread.sections.map((section, i) => (
        <ThreadSection
          key={section.title}
          title={section.title}
          prose={section.prose}
          imageAsset={section.imageAsset}
          isHero={i === 0}
        >
          {section.claims.length > 0 && (
            <EvidenceSheet
              claims={section.claims}
              sourceVersions={section.sourceVersions}
              triggerLabel="Open evidence"
            />
          )}
          {i < thread.sections.length - 1 && (
            <ContinueReadingButton
              threadTitle={thread.title}
              geneSymbol={symbol}
              sectionTitle={section.title}
              prose={section.prose}
              claimsSummary={section.claims
                .map((c) => c.claimText)
                .join(" ")
                .slice(0, 300)}
              nextSectionHint={thread.sections[i + 1]?.title}
            />
          )}
        </ThreadSection>
      ))}

      <footer className="space-y-4 pb-12">
        <p className="text-center text-sm text-muted-foreground">
          — End of thread —
        </p>
        <ThreadFooterActions
          title={thread.title}
          sharePath={`/thread/gene/${encodeURIComponent(gene.symbol)}`}
        />
      </footer>
    </div>
  );
}
