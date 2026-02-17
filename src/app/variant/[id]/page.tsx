import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { ClaimHeader } from "@/components/variant/claim-header";
import { EvidenceTable } from "@/components/variant/evidence-table";
import { TimelineControls } from "@/components/variant/timeline-controls";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { EpistemicAlert } from "@/components/shared/epistemic-alert";
import type { VariantSummary } from "@/lib/types/variant";

function getMockVariant(id: string): VariantSummary {
  return {
    variantId: id,
    hgvs: "NM_007294.4:c.5266dupC",
    gene: "BRCA1",
    chromosome: "17",
    position: 43057051,
    refAllele: "C",
    altAllele: "CC",
    clinicalSignificance: "Pathogenic",
    reviewStatus: "reviewed by expert panel",
    submissions: [
      {
        submitter: "ENIGMA",
        classification: "Pathogenic",
        condition: "Hereditary breast and ovarian cancer",
        reviewStatus: "reviewed by expert panel",
        dateLastEvaluated: "2024-09-01",
        method: "clinical testing",
      },
      {
        submitter: "GeneDx",
        classification: "Pathogenic",
        condition: "Hereditary cancer-predisposing syndrome",
        reviewStatus: "criteria provided, single submitter",
        dateLastEvaluated: "2023-12-15",
        method: "clinical testing",
      },
      {
        submitter: "Invitae",
        classification: "Pathogenic",
        condition: "Hereditary breast and ovarian cancer",
        reviewStatus: "criteria provided, single submitter",
        dateLastEvaluated: "2024-03-22",
        method: "clinical testing",
      },
      {
        submitter: "Ambry Genetics",
        classification: "Pathogenic",
        condition: "Hereditary cancer-predisposing syndrome",
        reviewStatus: "criteria provided, single submitter",
        dateLastEvaluated: "2023-08-10",
        method: "clinical testing",
      },
    ],
    populationFrequencies: [
      {
        population: "European (non-Finnish)",
        alleleFrequency: 0.00012,
        alleleCount: 15,
        alleleNumber: 125000,
        homozygoteCount: 0,
      },
      {
        population: "Ashkenazi Jewish",
        alleleFrequency: 0.011,
        alleleCount: 55,
        alleleNumber: 5000,
        homozygoteCount: 0,
      },
      {
        population: "South Asian",
        alleleFrequency: 0.00003,
        alleleCount: 1,
        alleleNumber: 30000,
        homozygoteCount: 0,
      },
    ],
    claims: [
      {
        claimText:
          "This variant is classified as Pathogenic by expert panel review (ENIGMA consortium).",
        confidenceLevel: "high",
        evidenceRefs: [
          {
            id: "enigma-5266dupc",
            sourceName: "ClinVar (ENIGMA)",
            date: "2024-09-01",
            link: "https://www.ncbi.nlm.nih.gov/clinvar/variation/55598/",
            excerpt:
              "Expert panel reviewed: Pathogenic for hereditary breast and ovarian cancer.",
          },
        ],
      },
      {
        claimText:
          "This variant shows significant population frequency variation — notably elevated in Ashkenazi Jewish populations.",
        confidenceLevel: "moderate",
        evidenceRefs: [
          {
            id: "gnomad-freq",
            sourceName: "gnomAD",
            date: "2024-01-01",
            link: "https://gnomad.broadinstitute.org/variant/17-43057051-C-CC",
            excerpt:
              "Allele frequency 0.011 in Ashkenazi Jewish vs 0.00012 in European (non-Finnish).",
          },
        ],
      },
    ],
    sourceVersions: {
      clinvar: "2025-12-01",
      gnomad: "4.1",
    },
    fetchedAt: new Date().toISOString(),
  };
}

interface VariantPageProps {
  params: Promise<{ id: string }>;
}

export default async function VariantPage({ params }: VariantPageProps) {
  const { id } = await params;
  const variant = getMockVariant(id);

  return (
    <div className="space-y-8">
      <BreadcrumbNav />

      <ClaimHeader
        hgvs={variant.hgvs}
        gene={variant.gene}
        clinicalSignificance={variant.clinicalSignificance}
        reviewStatus={variant.reviewStatus}
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
              This variant in <strong>{variant.gene}</strong> results in a
              frameshift that disrupts protein function. It has been reviewed by
              the ENIGMA expert panel and classified as{" "}
              <strong>{variant.clinicalSignificance}</strong> for hereditary
              breast and ovarian cancer.
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
