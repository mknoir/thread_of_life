import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { ThreadSection } from "@/components/thread/thread-section";
import { EvidenceSheet } from "@/components/gene/evidence-sheet";
import { ContinueReadingButton } from "@/components/thread/continue-reading-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ImageAsset } from "@/lib/types/image-pack";
import type { Claim } from "@/lib/types/claim";

/**
 * Mock thread data structure.
 * In production, threads will be composed from gene/variant summaries + curated narrative.
 */
interface ThreadData {
  id: string;
  title: string;
  subtitle: string;
  sections: {
    title: string;
    prose: string;
    imageAsset?: ImageAsset;
    claims: Claim[];
    sourceVersions: Record<string, string>;
  }[];
}

function getMockThread(id: string): ThreadData {
  return {
    id,
    title: "What does BRCA1 actually mean for you?",
    subtitle:
      "A gene everyone's heard of. Almost nobody understands. Let's change that.",
    sections: [
      {
        title: "Variation",
        prose:
          "BRCA1 sits on chromosome 17. It encodes a protein that helps repair broken DNA. When BRCA1 doesn't work correctly, cells lose a critical safety mechanism — and that's where the cancer risk begins. But \"doesn't work correctly\" covers a vast range: from clearly damaging mutations to variants whose effects we simply don't understand yet.",
        imageAsset: {
          id: "braided-rope",
          src: "/images/packs/thread/braided_rope.webp",
          alt: "A tightly braided rope showing intertwined strands",
          caption: "Every thread tells a story when you follow it far enough.",
          sourceName: "Thread of Life project",
          sourceUrl: "",
          license: "Project asset",
          attribution: "Thread of Life",
        },
        claims: [
          {
            claimText:
              "BRCA1 is a tumor suppressor gene with definitive evidence for hereditary breast and ovarian cancer.",
            confidenceLevel: "high",
            evidenceRefs: [
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
        ],
        sourceVersions: { clingen: "2025-09-15" },
      },
      {
        title: "Interpretation",
        prose:
          "Here's the uncomfortable truth: over half of all BRCA1 variants submitted to ClinVar are classified as \"Uncertain Significance\" (VUS). That means the labs that sequenced them couldn't confidently say whether they're harmful or harmless. This isn't a failure — it's an honest reflection of where the science stands. Interpretations change as evidence accumulates.",
        claims: [
          {
            claimText:
              "56% of BRCA1 variants in ClinVar are classified as VUS (Variants of Uncertain Significance).",
            confidenceLevel: "moderate",
            evidenceRefs: [
              {
                id: "clinvar-brca1-vus",
                sourceName: "ClinVar",
                date: "2025-12-01",
                link: "https://www.ncbi.nlm.nih.gov/clinvar/?term=BRCA1",
                excerpt:
                  "2,156 of 3,847 submitted variants classified as VUS.",
              },
            ],
          },
        ],
        sourceVersions: { clinvar: "2025-12-01" },
      },
      {
        title: "Constraint",
        prose:
          "gnomAD's constraint metrics tell us how tolerant BRCA1 is to different types of mutations in the general population. A low LOEUF score (0.488) means nature doesn't tolerate loss-of-function mutations in this gene well — which is consistent with its role as a critical DNA repair gene. This is indirect evidence, but it's powerful: evolution has been running this experiment for millions of years.",
        claims: [
          {
            claimText:
              "BRCA1 has a LOEUF score of 0.488, indicating moderate intolerance to loss-of-function variants.",
            confidenceLevel: "high",
            evidenceRefs: [
              {
                id: "gnomad-constraint",
                sourceName: "gnomAD",
                date: "2024-01-01",
                link: "https://gnomad.broadinstitute.org/gene/ENSG00000012048",
                excerpt: "LOEUF: 0.488, pLI: 0.00, mis_z: 1.53",
              },
            ],
          },
        ],
        sourceVersions: { gnomad: "4.1" },
      },
      {
        title: "Expression",
        prose:
          "GTEx data shows where BRCA1 is most active in the body. It's highly expressed in thyroid, breast, ovary, and uterus tissue — which aligns with the clinical observation that pathogenic variants primarily increase cancer risk in these organs. The gene isn't silent elsewhere, though; it plays a role in DNA repair across many cell types.",
        claims: [
          {
            claimText:
              "BRCA1 is most highly expressed in thyroid (72.4 TPM), breast (65.1 TPM), and ovary (58.3 TPM).",
            confidenceLevel: "high",
            evidenceRefs: [
              {
                id: "gtex-brca1",
                sourceName: "GTEx",
                date: "2023-06-01",
                link: "https://gtexportal.org/home/gene/BRCA1",
                excerpt:
                  "Top tissues by median TPM: Thyroid 72.4, Breast Mammary 65.1, Ovary 58.3.",
              },
            ],
          },
        ],
        sourceVersions: { gtex: "v8" },
      },
      {
        title: "Meaning",
        prose:
          "So what does it all mean? BRCA1 is one of the best-understood cancer genes in human genetics — and yet more than half its known variants remain uncertain. That's the honest state of genomic medicine in 2025. If you carry a pathogenic BRCA1 variant, the evidence is strong and actionable. If you carry a VUS, the evidence is still accumulating. Either way, you deserve to understand what the science actually says — not just what a test report summarizes in a sentence.",
        imageAsset: {
          id: "spiral-stairs",
          src: "/images/packs/thread/spiral_stairs.webp",
          alt: "A spiral staircase viewed from above, descending into depth",
          caption: "The deeper you go, the more the pattern reveals itself.",
          sourceName: "Thread of Life project",
          sourceUrl: "",
          license: "Project asset",
          attribution: "Thread of Life",
        },
        claims: [],
        sourceVersions: {},
      },
    ],
  };
}

interface ThreadPageProps {
  params: Promise<{ id: string }>;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { id } = await params;
  const thread = getMockThread(id);

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
