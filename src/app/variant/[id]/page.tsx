import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { ClaimHeader } from "@/components/variant/claim-header";
import { EvidenceTable } from "@/components/variant/evidence-table";
import { TimelineControls } from "@/components/variant/timeline-controls";
import { GeneVariantTrack } from "@/components/variant/gene-variant-track";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { EpistemicAlert } from "@/components/shared/epistemic-alert";
import { PreReadCard } from "@/components/shared/pre-read-card";
import { fetchVariantData } from "@/lib/api/fetch-variant";
import type { VariantSummary } from "@/lib/types/variant";

interface VariantPageProps {
  params: Promise<{ id: string }>;
}

export default async function VariantPage({ params }: VariantPageProps) {
  const { id } = await params;
  if (!id?.trim()) notFound();

  let variant: VariantSummary;
  try {
    variant = await fetchVariantData(id);
  } catch {
    notFound();
  }

  const variantFacts: string[] = [
    `Variant ID: ${variant.variantId}.`,
    `Gene: ${variant.gene}.`,
    `Coordinate: chr${variant.chromosome}:${variant.position.toLocaleString()} ${variant.refAllele}>${variant.altAllele}.`,
    `ClinVar significance: ${variant.clinicalSignificance}.`,
    `ClinVar review status: ${variant.reviewStatus}.`,
    `ClinVar submissions: ${variant.submissions.length.toLocaleString()}.`,
    variant.populationFrequencies.length > 0
      ? `Highest listed gnomAD population allele frequency is ${Math.max(
          ...variant.populationFrequencies.map((pf) => pf.alleleFrequency)
        ).toExponential(2)}.`
      : "gnomAD population frequencies are unavailable.",
  ];

  return (
    <div className="space-y-8">
      <BreadcrumbNav />

      <ClaimHeader
        hgvs={variant.hgvs || variant.variantId}
        gene={variant.gene || "Variant"}
        clinicalSignificance={variant.clinicalSignificance}
        reviewStatus={variant.reviewStatus}
      />
      <PreReadCard
        pageType="variant-summary"
        title={variant.hgvs || variant.variantId}
        facts={variantFacts}
      />

      <Separator />

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Summary tab */}
        <TabsContent value="summary" className="space-y-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              This variant is currently classified as{" "}
              <strong>{variant.clinicalSignificance}</strong>. Interpretations
              can evolve as evidence accumulates from clinical submissions and
              population data.
            </p>
          </div>

          {variant.populationFrequencies.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Population frequencies</h3>
              <div className="space-y-2">
                {variant.populationFrequencies.map((pf) => (
                  <div key={pf.population} className="flex items-center gap-3">
                    <span className="w-44 truncate text-xs">
                      {pf.population}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/30"
                        style={{
                          width: `${Math.min(100, pf.alleleFrequency * 5000)}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {pf.alleleFrequency < 0.0001
                        ? pf.alleleFrequency.toExponential(1)
                        : pf.alleleFrequency.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {variant.regionalVariants &&
            variant.regionStart &&
            variant.regionEnd && (
              <GeneVariantTrack
                gene={variant.gene}
                chromosome={variant.chromosome}
                regionStart={variant.regionStart}
                regionEnd={variant.regionEnd}
                variants={variant.regionalVariants}
                focusVariantId={variant.variantId}
              />
            )}

          <EpistemicAlert
            title="Population bias likely"
            description="Allele frequencies may be skewed by uneven representation across populations in gnomAD. Interpret with caution for underrepresented groups."
            confidenceLevel="low"
          />

          <EvidenceSheet
            claims={variant.claims}
            sourceVersions={variant.sourceVersions}
          />
        </TabsContent>

        {/* Evidence tab */}
        <TabsContent value="evidence" className="space-y-4">
          <h3 className="text-lg font-semibold">ClinVar submissions</h3>
          <p className="text-sm text-muted-foreground">
            {variant.submissions.length} submissions from{" "}
            {new Set(variant.submissions.map((s) => s.submitter)).size}{" "}
            submitters.
          </p>
          <EvidenceTable submissions={variant.submissions} />
        </TabsContent>

        {/* Timeline tab */}
        <TabsContent value="timeline" className="space-y-4">
          <h3 className="text-lg font-semibold">
            How interpretation has changed
          </h3>
          <p className="text-sm text-muted-foreground">
            Scrub through ClinVar release history to see how this variant&apos;s
            classification has evolved.
          </p>
          <TimelineControls
            years={[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]}
          />
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Historical timeline visualization coming soon
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <footer className="space-y-1 pb-8">
        <p className="text-[10px] text-muted-foreground">
          Data updated on:{" "}
          {Object.entries(variant.sourceVersions)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
        </p>
      </footer>
    </div>
  );
}
