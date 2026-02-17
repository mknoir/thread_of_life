import { notFound } from "next/navigation";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { ThreadSection } from "@/components/thread/thread-section";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { ContinueReadingButton } from "@/components/thread/continue-reading-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { composeGeneSummary } from "@/lib/api/compose-gene";
import { composeThreadFromGene } from "@/lib/thread/compose-thread-from-gene";

async function fetchGeneData(symbol: string) {
  const upperSymbol = symbol.trim().toUpperCase();
  if (!upperSymbol) throw new Error("Invalid symbol");

  try {
    if (
      process.env.DATABASE_URL &&
      !process.env.DATABASE_URL.includes("user:password")
    ) {
      const { getCachedGeneSummary } = await import("@/lib/cache");
      return getCachedGeneSummary(upperSymbol, () =>
        composeGeneSummary(upperSymbol)
      );
    }
    return composeGeneSummary(upperSymbol);
  } catch {
    throw new Error(`Failed to fetch gene ${upperSymbol}`);
  }
}

interface GeneThreadPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function GeneThreadPage({ params }: GeneThreadPageProps) {
  const { symbol } = await params;
  let gene;
  try {
    gene = await fetchGeneData(symbol);
  } catch {
    notFound();
  }

  const thread = composeThreadFromGene(gene);

  return (
    <div className="space-y-10">
      <BreadcrumbNav />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{thread.title}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {thread.subtitle}
        </p>
      </header>

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
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm">
            Share this thread
          </Button>
          <Button variant="outline" size="sm">
            Copy permalink
          </Button>
        </div>
      </footer>
    </div>
  );
}
