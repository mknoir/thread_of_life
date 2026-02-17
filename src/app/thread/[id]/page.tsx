import { redirect, notFound } from "next/navigation";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { ThreadSection } from "@/components/thread/thread-section";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { ContinueReadingButton } from "@/components/thread/continue-reading-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  GENE_JOURNEY_REDIRECTS,
  JOURNEY_REDIRECTS,
  getCuratedThread,
} from "@/lib/thread/curated-threads";

interface ThreadPageProps {
  params: Promise<{ id: string }>;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { id } = await params;

  // Gene journeys redirect to dynamic gene thread
  const geneSymbol = GENE_JOURNEY_REDIRECTS[id];
  if (geneSymbol) {
    redirect(`/thread/gene/${geneSymbol}`);
  }

  // Other redirects (e.g. create-your-own)
  const redirectPath = JOURNEY_REDIRECTS[id];
  if (redirectPath) {
    redirect(redirectPath);
  }

  // Conceptual journeys use curated content
  const thread = getCuratedThread(id);
  if (!thread) notFound();

  return (
    <div className="space-y-10">
      <BreadcrumbNav />

      {/* Thread header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{thread.title}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {thread.subtitle}
        </p>
      </header>

      <Separator />

      {/* The scroll story */}
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

      {/* Thread footer */}
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
