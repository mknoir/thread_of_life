import { Separator } from "@/components/ui/separator";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { GeneSummaryCard } from "@/components/gene/gene-summary";
import { EvidenceAccordion } from "@/components/gene/evidence-accordion";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { EpistemicAlert } from "@/components/shared/epistemic-alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeneSummary } from "@/lib/types/gene";

/**
 * Mock gene data — will be replaced by /api/gene/[symbol] call.
 */
function getMockGene(symbol: string): GeneSummary {
  return {
    symbol: symbol.toUpperCase(),
    name: symbol === "BRCA1"
      ? "Breast cancer type 1 susceptibility protein"
      : `${symbol.toUpperCase()} gene`,
    hgncId: "HGNC:1100",
    description:
      "This gene encodes a nuclear phosphoprotein that plays a role in maintaining genomic stability and acts as a tumor suppressor.",
    chromosome: "17",
    clinvarSummary: {
      totalVariants: 3847,
      pathogenic: 382,
      likelyPathogenic: 298,
      vus: 2156,
      benign: 612,
      likelyBenign: 287,
      conflicting: 112,
    },
    constraint: {
      pLI: 0.0,
      loeufScore: 0.488,
      misZScore: 1.53,
    },
    topExpressions: [
      { tissue: "Thyroid", tpm: 72.4, rank: 1 },
      { tissue: "Breast - Mammary", tpm: 65.1, rank: 2 },
      { tissue: "Ovary", tpm: 58.3, rank: 3 },
      { tissue: "Uterus", tpm: 51.7, rank: 4 },
      { tissue: "Testis", tpm: 44.2, rank: 5 },
    ],
    clingenValidity: "Definitive",
    claims: [
      {
        claimText: `${symbol.toUpperCase()} is classified as a tumor suppressor with definitive evidence for breast and ovarian cancer risk.`,
        confidenceLevel: "high",
        evidenceRefs: [
          {
            id: "clinvar-brca1-overview",
            sourceName: "ClinVar",
            date: "2025-12-01",
            link: "https://www.ncbi.nlm.nih.gov/clinvar/?term=BRCA1",
            excerpt:
              "3,847 variants submitted to ClinVar, with 382 classified as pathogenic.",
          },
          {
            id: "clingen-brca1",
            sourceName: "ClinGen",
            date: "2025-09-15",
            link: "https://search.clinicalgenome.org/kb/genes/HGNC:1100",
            excerpt:
              "Gene-disease validity: Definitive for hereditary breast and ovarian cancer.",
          },
        ],
      },
      {
        claimText:
          "A significant proportion of variants (56%) remain classified as Variants of Uncertain Significance.",
        confidenceLevel: "moderate",
        evidenceRefs: [
          {
            id: "clinvar-vus-count",
            sourceName: "ClinVar",
            date: "2025-12-01",
            link: "https://www.ncbi.nlm.nih.gov/clinvar/?term=BRCA1",
            excerpt:
              "2,156 of 3,847 submitted variants are classified as VUS.",
          },
        ],
      },
    ],
    sourceVersions: {
      clinvar: "2025-12-01",
      gnomad: "4.1",
      clingen: "2025-09-15",
      gtex: "v8",
    },
    fetchedAt: new Date().toISOString(),
  };
}

interface GenePageProps {
  params: Promise<{ symbol: string }>;
}

export default async function GenePage({ params }: GenePageProps) {
  const { symbol } = await params;
  const gene = getMockGene(symbol);

  return (
    <div className="space-y-8">
      <BreadcrumbNav />

      {/* Chapter 1: What is this gene? */}
      <section className="space-y-4">
        <GeneSummaryCard gene={gene} />
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {gene.description}
        </p>
        <EvidenceSheet
          claims={gene.claims}
          sourceVersions={gene.sourceVersions}
        />
      </section>

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
